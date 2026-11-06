import { db, pgPool } from '@/lib/db';
import { AccountMappingService, TenantAccountMapping } from './AccountMappingService';
import { CanonicalLedgerEntry } from './CanonicalMetricEngine';

export interface BackfillSummary {
  tenantId: number;
  inserted: number;
  skipped: number;
  updated: number;
  rejected: number;
  duplicateCount: number;
  unmappedCount: number;
  rejectionReasons: Record<string, number>;
}

export class CanonicalLedgerIngestionService {
  /**
   * Idempotently ingests and normalizes persisted Xero source data into canonical account_transactions.
   */
  static async ingestTenantLedger(tenantId: number): Promise<BackfillSummary> {
    const summary: BackfillSummary = {
      tenantId,
      inserted: 0,
      skipped: 0,
      updated: 0,
      rejected: 0,
      duplicateCount: 0,
      unmappedCount: 0,
      rejectionReasons: {}
    };

    const isPgConnected = await this.checkPgConnected();

    // 1. Ensure Account Mappings exist and confirm valid suggested mappings
    const dbAccounts = await db.getAccounts(tenantId);
    if (dbAccounts && dbAccounts.length > 0) {
      await AccountMappingService.seedMappingsForTenant(tenantId, dbAccounts);
    }

    const rawMappings: TenantAccountMapping[] = await db.getAccountMappings(tenantId);
    
    // Auto-confirm suggested mappings during backfill so they are authoritative
    for (const m of rawMappings) {
      if (m.status === 'SUGGESTED' && !m.user_confirmed) {
        await db.confirmAccountMapping(tenantId, m.id || m.source_account_id);
      }
    }

    const updatedMappings: TenantAccountMapping[] = await db.getAccountMappings(tenantId);
    const codeToAccountIdMap = new Map<string, string>();
    for (const m of updatedMappings) {
      if (m.account_code) {
        codeToAccountIdMap.set(m.account_code.toString().trim(), m.source_account_id);
      }
    }

    const entriesToPersist: CanonicalLedgerEntry[] = [];
    const seenKeys = new Set<string>();

    const recordEntry = (entry: CanonicalLedgerEntry) => {
      const dedupKey = `${entry.tenantId}_${entry.source}_${entry.sourceTransactionId}_${entry.sourceLineId || '0'}_${entry.sourceAccountId}`;
      if (seenKeys.has(dedupKey)) {
        summary.duplicateCount++;
        summary.skipped++;
        return;
      }
      seenKeys.add(dedupKey);
      entriesToPersist.push(entry);
    };

    // 2. Extract from Invoices Table
    const dbInvoices = await db.getInvoices(tenantId);
    if (dbInvoices && Array.isArray(dbInvoices)) {
      for (const inv of dbInvoices) {
        const status = (inv.Status || inv.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED' || status === 'DRAFT') {
          summary.skipped++;
          continue;
        }

        const rawDate = inv.Date || inv.invoice_date || inv.date || inv.DueDate;
        const rawType = (inv.Type || inv.type || '').toUpperCase();
        let txnType: CanonicalLedgerEntry['transactionType'] = 'INVOICE';
        let direction: 'DEBIT' | 'CREDIT' = 'CREDIT';

        if (rawType === 'ACCREC') {
          txnType = 'INVOICE';
          direction = 'CREDIT';
        } else if (rawType === 'ACCPAY') {
          txnType = 'BILL';
          direction = 'DEBIT';
        } else if (rawType === 'ACCREC_CREDIT' || rawType === 'CREDIT_NOTE') {
          txnType = 'CREDIT_NOTE';
          direction = 'DEBIT';
        } else if (rawType === 'ACCPAY_CREDIT') {
          txnType = 'BILL_CREDIT_NOTE';
          direction = 'CREDIT';
        }

        const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.LineItems || inv.line_items || []);

        if (Array.isArray(lineItems) && lineItems.length > 0) {
          for (let i = 0; i < lineItems.length; i++) {
            const line = lineItems[i];
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount || 0));
            const lineTax = parseFloat(line.TaxAmount || line.tax_amount || 0);
            const netAmount = Math.abs(lineTotal - lineTax);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              recordEntry({
                tenantId,
                source: 'xero',
                sourceTransactionId: inv.external_id || inv.InvoiceID || inv.id || '',
                sourceLineId: line.LineItemID || line.id || `line_${i}`,
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || line.description || '',
                date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
                amount: netAmount,
                direction,
                description: line.Description || line.description || inv.invoice_number,
                transactionType: txnType,
                currency: inv.CurrencyCode || inv.currency || 'GBP',
                taxType: line.TaxType,
                netAmount,
                taxAmount: lineTax,
                grossAmount: Math.abs(lineTotal)
              });
            }
          }
        }
      }
    }

    // 3. Extract from ManualJournals Report
    const dbManualJournals = (await db.getReport(tenantId, 'ManualJournals')) || (await db.getReport(tenantId, 'Journals')) || [];
    if (Array.isArray(dbManualJournals)) {
      for (const mj of dbManualJournals) {
        const status = (mj.Status || mj.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') {
          summary.skipped++;
          continue;
        }

        let rawDate = mj.Date || mj.journal_date || mj.JournalDate;
        if (typeof rawDate === 'string' && rawDate.includes('Date(')) {
          const m = rawDate.match(/\/Date\((\d+)/);
          if (m) rawDate = new Date(parseInt(m[1])).toISOString();
        }

        const lines = mj.JournalLines || mj.line_items || mj.Lines || [];
        if (Array.isArray(lines)) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const rawAmount = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.GrossAmount || line.Amount || 0));
            const netAmount = Math.abs(rawAmount);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              const direction: 'DEBIT' | 'CREDIT' = rawAmount > 0 ? 'DEBIT' : 'CREDIT';
              recordEntry({
                tenantId,
                source: 'xero',
                sourceTransactionId: mj.ManualJournalID || mj.JournalID || mj.id || 'mj',
                sourceLineId: line.JournalLineID || line.id || `mj_line_${i}`,
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || mj.Narration || 'Manual Journal Line',
                date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
                amount: netAmount,
                direction,
                description: line.Description || mj.Narration || 'Manual Journal Entry',
                reference: mj.Reference || mj.Narration,
                transactionType: 'MANUAL_JOURNAL',
                currency: mj.CurrencyCode || 'GBP',
                taxType: line.TaxType,
                netAmount,
                taxAmount: Math.abs(parseFloat(line.TaxAmount || 0)),
                grossAmount: netAmount + Math.abs(parseFloat(line.TaxAmount || 0))
              });
            }
          }
        }
      }
    }

    // 4. Extract from BankTransactions Report
    const dbBankTxns = (await db.getReport(tenantId, 'BankTransactions')) || [];
    if (Array.isArray(dbBankTxns)) {
      for (const bt of dbBankTxns) {
        const status = (bt.Status || bt.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') {
          summary.skipped++;
          continue;
        }

        let rawDate = bt.Date || bt.transaction_date;
        if (typeof rawDate === 'string' && rawDate.includes('Date(')) {
          const m = rawDate.match(/\/Date\((\d+)/);
          if (m) rawDate = new Date(parseInt(m[1])).toISOString();
        }

        const rawType = (bt.Type || bt.type || '').toUpperCase();
        const isTransfer = rawType.includes('TRANSFER');
        const direction: 'DEBIT' | 'CREDIT' = rawType.includes('SPEND') ? 'DEBIT' : 'CREDIT';
        const txnType: CanonicalLedgerEntry['transactionType'] = isTransfer ? 'BANK_TRANSFER' : 'BANK_TRANSACTION';
        const lines = typeof bt.line_items === 'string' ? JSON.parse(bt.line_items) : (bt.LineItems || bt.line_items || []);
        const totalAmount = Math.abs(parseFloat(bt.Total !== undefined ? bt.Total : (bt.SubTotal || 0)));

        if (Array.isArray(lines) && lines.length > 0) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount || 0));
            const lineTax = parseFloat(line.TaxAmount || line.tax_amount || 0);
            const netAmount = Math.abs(lineTotal - lineTax);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              recordEntry({
                tenantId,
                source: 'xero',
                sourceTransactionId: bt.BankTransactionID || bt.id || 'bt',
                sourceLineId: line.LineItemID || line.id || `bt_line_${i}`,
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || bt.Contact?.Name || 'Bank Transaction Line',
                date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
                amount: netAmount,
                direction,
                description: line.Description || bt.Reference || 'Direct Bank Transaction',
                reference: bt.Reference || bt.Url,
                transactionType: txnType,
                currency: bt.CurrencyCode || 'GBP',
                taxType: line.TaxType,
                netAmount,
                taxAmount: lineTax,
                grossAmount: Math.abs(lineTotal)
              });
            }
          }
        } else if (totalAmount > 0 && bt.BankAccount) {
          const bankAccId = (bt.BankAccount.AccountID || codeToAccountIdMap.get(bt.BankAccount.Code) || '').toString().trim();
          const bankCode = (bt.BankAccount.Code || '').toString().trim();
          recordEntry({
            tenantId,
            source: 'xero',
            sourceTransactionId: bt.BankTransactionID || bt.id || 'bt',
            sourceLineId: `bt_hdr_${bt.BankTransactionID || bt.id}`,
            sourceAccountId: bankAccId || bankCode,
            accountCode: bankCode,
            accountName: bt.BankAccount.Name || 'Bank Account',
            date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
            amount: totalAmount,
            direction,
            description: bt.Reference || 'Bank Transaction',
            transactionType: txnType,
            currency: bt.CurrencyCode || 'GBP',
            netAmount: totalAmount,
            grossAmount: totalAmount
          });
        }
      }
    }

    // 5. Extract CreditNotes Report
    const dbCreditNotes = (await db.getReport(tenantId, 'CreditNotes')) || [];
    if (Array.isArray(dbCreditNotes)) {
      for (const cn of dbCreditNotes) {
        const status = (cn.Status || cn.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') {
          summary.skipped++;
          continue;
        }

        let rawDate = cn.Date || cn.credit_note_date;
        if (typeof rawDate === 'string' && rawDate.includes('Date(')) {
          const m = rawDate.match(/\/Date\((\d+)/);
          if (m) rawDate = new Date(parseInt(m[1])).toISOString();
        }

        const rawType = (cn.Type || cn.type || '').toUpperCase();
        const txnType: CanonicalLedgerEntry['transactionType'] = rawType.includes('ACCPAY') ? 'BILL_CREDIT_NOTE' : 'CREDIT_NOTE';
        const direction: 'DEBIT' | 'CREDIT' = rawType.includes('ACCPAY') ? 'CREDIT' : 'DEBIT';
        const lines = cn.LineItems || [];

        if (Array.isArray(lines) && lines.length > 0) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : 0);
            const lineTax = parseFloat(line.TaxAmount || 0);
            const netAmount = Math.abs(lineTotal - lineTax);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              recordEntry({
                tenantId,
                source: 'xero',
                sourceTransactionId: cn.CreditNoteID || cn.id || 'cn',
                sourceLineId: line.LineItemID || line.id || `cn_line_${i}`,
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || 'Credit Note Line',
                date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
                amount: netAmount,
                direction,
                description: line.Description || cn.CreditNoteNumber || 'Credit Note Entry',
                transactionType: txnType,
                currency: cn.CurrencyCode || 'GBP',
                taxType: line.TaxType,
                netAmount,
                taxAmount: lineTax,
                grossAmount: Math.abs(lineTotal)
              });
            }
          }
        }
      }
    }

    // 6. Persistence into account_transactions Table
    if (isPgConnected) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM account_transactions WHERE tenant_id = $1', [tenantId]);

        for (const entry of entriesToPersist) {
          await client.query(`
            INSERT INTO account_transactions (
              tenant_id, account_code, account_name, date, source, source_id, description, reference, currency, debit, credit, debit_gbp, credit_gbp, source_account_id, source_line_id, transaction_type, tax_type, net_amount, tax_amount, gross_amount, direction
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          `, [
            entry.tenantId,
            (entry.accountCode || '').substring(0, 50),
            (entry.accountName || '').substring(0, 250),
            entry.date,
            (entry.source || 'xero').substring(0, 100),
            (entry.sourceTransactionId || '').substring(0, 250),
            entry.description || '',
            (entry.reference || '').substring(0, 250),
            (entry.currency || 'GBP').substring(0, 10),
            entry.direction === 'DEBIT' ? entry.amount : 0,
            entry.direction === 'CREDIT' ? entry.amount : 0,
            entry.direction === 'DEBIT' ? entry.amount : 0,
            entry.direction === 'CREDIT' ? entry.amount : 0,
            (entry.sourceAccountId || '').substring(0, 250),
            (entry.sourceLineId || '').substring(0, 250),
            (entry.transactionType || 'INVOICE').substring(0, 50),
            (entry.taxType || '').substring(0, 100),
            entry.netAmount || entry.amount,
            entry.taxAmount || 0,
            entry.grossAmount || entry.amount,
            entry.direction
          ]);
          summary.inserted++;
        }
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Failed to commit canonical ledger ingestion:', err.message);
        throw err;
      } finally {
        client.release();
      }
    } else {
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'db.json');
      let json: any = {};
      if (fs.existsSync(dbPath)) {
        try { json = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) {}
      }
      if (!json.account_transactions) json.account_transactions = [];
      json.account_transactions = json.account_transactions.filter((r: any) => r.tenant_id !== tenantId);
      for (const entry of entriesToPersist) {
        json.account_transactions.push({
          tenant_id: entry.tenantId,
          account_code: entry.accountCode || '',
          account_name: entry.accountName || '',
          date: entry.date,
          source: entry.source,
          source_id: entry.sourceTransactionId,
          description: entry.description || '',
          reference: entry.reference || '',
          currency: entry.currency || 'GBP',
          debit: entry.direction === 'DEBIT' ? entry.amount : 0,
          credit: entry.direction === 'CREDIT' ? entry.amount : 0,
          debit_gbp: entry.direction === 'DEBIT' ? entry.amount : 0,
          credit_gbp: entry.direction === 'CREDIT' ? entry.amount : 0,
          source_account_id: entry.sourceAccountId,
          source_line_id: entry.sourceLineId || '',
          transaction_type: entry.transactionType,
          tax_type: entry.taxType || '',
          net_amount: entry.netAmount || entry.amount,
          tax_amount: entry.taxAmount || 0,
          gross_amount: entry.grossAmount || entry.amount,
          direction: entry.direction
        });
        summary.inserted++;
      }
      fs.writeFileSync(dbPath, JSON.stringify(json, null, 2), 'utf8');
    }

    return summary;
  }

  private static async checkPgConnected(): Promise<boolean> {
    try {
      const client = await pgPool.connect();
      client.release();
      return true;
    } catch (e) {
      return false;
    }
  }
}
