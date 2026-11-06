import { db } from '@/lib/db';
import { AccountMappingService, TenantAccountMapping } from './AccountMappingService';
import { ProfitAndLossService } from './ProfitAndLossService';
import { BalanceSheetParser } from './BalanceSheetParser';

export type DataCoverageStatus = 'DATA_COMPLETE' | 'DATA_PARTIAL' | 'DATA_NOT_AVAILABLE';
export type MappingCoverageStatus = 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED' | 'NOT_AVAILABLE';

export interface CanonicalLedgerEntry {
  tenantId: number;
  source: string;
  sourceTransactionId: string;
  sourceLineId?: string;
  sourceAccountId: string; // Primary GUID Identity
  accountCode?: string;
  accountName?: string;
  date: string;
  amount: number; // Net amount in base currency (GBP)
  direction: 'DEBIT' | 'CREDIT';
  description?: string;
  reference?: string;
  transactionType: 'INVOICE' | 'CREDIT_NOTE' | 'BILL' | 'BILL_CREDIT_NOTE' | 'BANK_TRANSACTION' | 'MANUAL_JOURNAL' | 'BANK_TRANSFER';
  currency?: string;
  baseCurrencyAmount?: number;
  taxType?: string;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
}

export interface CanonicalMetricValue {
  value: number | null;
  status: 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED_ACCOUNTS' | 'NOT_AVAILABLE' | 'INCOMPLETE';
  mappingStatus: MappingCoverageStatus;
  dataCoverage: DataCoverageStatus;
  confidence: 'AUTHORITATIVE' | 'INCOMPLETE' | 'NOT_AVAILABLE';
  unmappedAccountsCount: number;
  unmappedAccounts?: Array<{ sourceAccountId: string; accountCode?: string; accountName?: string; status?: string }>;
  warnings?: string[];
}

export interface CanonicalCFOEngineResult {
  tenantId: number;
  period: {
    fromDate: string;
    toDate: string;
  };
  calculationStatus: 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED_ACCOUNTS';
  dataCoverageStatus: DataCoverageStatus;
  mappingCoverageStatus: MappingCoverageStatus;
  sourceMode?: string;
  mappingCoveragePct?: number;
  metrics: {
    revenue: CanonicalMetricValue;
    costOfSales: CanonicalMetricValue;
    grossProfit: CanonicalMetricValue;
    grossMarginPct: CanonicalMetricValue;
    operatingExpenses: CanonicalMetricValue;
    operatingProfit: CanonicalMetricValue;
    ebitda: CanonicalMetricValue;
    netProfit: CanonicalMetricValue;
    cashBalance: CanonicalMetricValue;
    accountsReceivable: CanonicalMetricValue;
    accountsPayable: CanonicalMetricValue;
  };
  mappingSummary: {
    totalAccounts: number;
    confirmedCount: number;
    customOverrideCount: number;
    suggestedCount: number;
    unmappedCount: number;
  };
}

export interface CanonicalAccountClassification {
  tenantId: number;
  source: string;
  sourceAccountId: string;
  accountCode?: string;
  accountName?: string;
  financialStatementCategory: string;
  subcategory?: string;
  cfoAnalyticalTag?: string;
  status: 'SUGGESTED' | 'CONFIRMED' | 'CUSTOM_OVERRIDE';
  isAuthoritative: boolean;
}

export class CanonicalMetricEngine {
  /**
   * Builds an in-memory map of tenant_id -> Map<source_account_id, CanonicalAccountClassification>
   * Primary Identity: source_account_id GUID. AccountCode is used ONLY as fallback resolution.
   */
  static async resolveTenantMappingMap(tenantId: number): Promise<{
    mappingMap: Map<string, CanonicalAccountClassification>;
    codeToAccountIdMap: Map<string, string>;
    summary: {
      totalAccounts: number;
      confirmedCount: number;
      customOverrideCount: number;
      suggestedCount: number;
      unmappedCount: number;
    };
  }> {
    const rawMappings: TenantAccountMapping[] = await AccountMappingService.getMappings(tenantId);
    const mappings = rawMappings.filter(m => m.active !== false);
    const dbAccounts = await db.getAccounts(tenantId);

    const mappingMap = new Map<string, CanonicalAccountClassification>();
    const codeToAccountIdMap = new Map<string, string>();

    let confirmedCount = 0;
    let customOverrideCount = 0;
    let suggestedCount = 0;

    // Index DB accounts for code -> accountID GUID resolution
    if (dbAccounts && Array.isArray(dbAccounts)) {
      for (const acc of dbAccounts) {
        const accId = acc.external_id || acc.AccountID || acc.id;
        const code = acc.code || acc.Code;
        if (accId && code) {
          codeToAccountIdMap.set(code.toString().trim(), accId.toString().trim());
        }
      }
    }

    for (const m of mappings) {
      const isAuth = m.user_confirmed === true && (m.status === 'CONFIRMED' || m.status === 'CUSTOM_OVERRIDE');
      
      if (m.status === 'CONFIRMED') confirmedCount++;
      else if (m.status === 'CUSTOM_OVERRIDE') customOverrideCount++;
      else if (m.status === 'SUGGESTED') suggestedCount++;

      const item: CanonicalAccountClassification = {
        tenantId: m.tenant_id,
        source: m.source,
        sourceAccountId: m.source_account_id,
        accountCode: m.account_code,
        accountName: m.account_name,
        financialStatementCategory: m.financial_statement_category,
        subcategory: m.subcategory,
        cfoAnalyticalTag: m.cfo_analytical_tag,
        status: m.status,
        isAuthoritative: isAuth
      };

      mappingMap.set(m.source_account_id, item);
      if (m.account_code) {
        codeToAccountIdMap.set(m.account_code.toString().trim(), m.source_account_id);
      }
    }

    // Detect unmapped accounts from DB Chart of Accounts
    let unmappedCount = 0;
    if (dbAccounts && Array.isArray(dbAccounts)) {
      for (const acc of dbAccounts) {
        const accId = (acc.external_id || acc.AccountID || '').toString();
        if (accId && !mappingMap.has(accId)) {
          unmappedCount++;
        }
      }
    }

    return {
      mappingMap,
      codeToAccountIdMap,
      summary: {
        totalAccounts: mappings.length + unmappedCount,
        confirmedCount,
        customOverrideCount,
        suggestedCount,
        unmappedCount
      }
    };
  }

  /**
   * Normalizes raw database transactions into standard CanonicalLedgerEntry objects.
   */
  static extractLedgerEntries(
    tenantId: number,
    invoices: any[],
    codeToAccountIdMap: Map<string, string>,
    startTs: number,
    endTs: number,
    manualJournals?: any[],
    bankTransactions?: any[]
  ): { ledgerEntries: CanonicalLedgerEntry[]; hasManualJournals: boolean; hasBankTransactions: boolean } {
    const entries: CanonicalLedgerEntry[] = [];
    let hasManualJournals = false;
    let hasBankTransactions = false;

    // 1. Invoices, Bills, and Credit Notes
    if (invoices && Array.isArray(invoices)) {
      for (const inv of invoices) {
        const status = (inv.Status || inv.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED' || status === 'DRAFT' || status === 'SUBMITTED') continue;

        const rawDate = inv.Date || inv.invoice_date || inv.DueDate;
        if (rawDate) {
          const dTime = new Date(rawDate).getTime();
          if (!isNaN(dTime) && (dTime < startTs || dTime > endTs)) continue;
        }

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
          direction = 'DEBIT'; // Sales credit note reduces revenue
        } else if (rawType === 'ACCPAY_CREDIT') {
          txnType = 'BILL_CREDIT_NOTE';
          direction = 'CREDIT'; // Bill credit note reduces expense
        }

        const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.LineItems || inv.line_items || []);

        if (Array.isArray(lineItems) && lineItems.length > 0) {
          for (const line of lineItems) {
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();

            const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount || 0));
            const lineTax = parseFloat(line.TaxAmount || line.tax_amount || 0);
            const netAmount = Math.abs(lineTotal - lineTax);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              entries.push({
                tenantId,
                source: 'xero',
                sourceTransactionId: inv.external_id || inv.InvoiceID || inv.id || '',
                sourceLineId: line.LineItemID || line.id || '',
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || line.description || '',
                date: rawDate || new Date().toISOString(),
                amount: netAmount,
                direction,
                description: line.Description || line.description || inv.invoice_number,
                transactionType: txnType,
                currency: inv.CurrencyCode || 'GBP',
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

    // 2. Manual Journals & System Journals
    if (manualJournals && Array.isArray(manualJournals)) {
      for (const mj of manualJournals) {
        const status = (mj.Status || mj.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED' || status === 'DRAFT') continue;

        const rawDate = mj.Date || mj.journal_date || mj.UpdatedDateUTC || mj.CreatedDateUTC || mj.JournalDate;
        if (rawDate) {
          const dTime = new Date(rawDate).getTime();
          if (!isNaN(dTime) && (dTime < startTs || dTime > endTs)) continue;
        }

        const lines = mj.JournalLines || mj.line_items || mj.Lines || [];
        if (Array.isArray(lines) && lines.length > 0) {
          hasManualJournals = true;
          for (const line of lines) {
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const rawAmount = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.GrossAmount || line.Amount || 0));
            const netAmount = Math.abs(rawAmount);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              const direction: 'DEBIT' | 'CREDIT' = rawAmount > 0 ? 'DEBIT' : 'CREDIT';
              entries.push({
                tenantId,
                source: 'xero',
                sourceTransactionId: mj.ManualJournalID || mj.JournalID || mj.id || '',
                sourceLineId: line.JournalLineID || line.id || '',
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || mj.Narration || 'Manual Journal Line',
                date: rawDate || new Date().toISOString(),
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

    // 3. Direct Bank Transactions
    if (bankTransactions && Array.isArray(bankTransactions)) {
      for (const bt of bankTransactions) {
        const status = (bt.Status || bt.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') continue;

        const rawDate = bt.Date || bt.transaction_date;
        if (rawDate) {
          const dTime = new Date(rawDate).getTime();
          if (!isNaN(dTime) && (dTime < startTs || dTime > endTs)) continue;
        }

        const rawType = (bt.Type || bt.type || '').toUpperCase();
        const isTransfer = rawType.includes('TRANSFER');
        const direction: 'DEBIT' | 'CREDIT' = rawType.includes('SPEND') ? 'DEBIT' : 'CREDIT';
        const txnType: CanonicalLedgerEntry['transactionType'] = isTransfer ? 'BANK_TRANSFER' : 'BANK_TRANSACTION';

        const lines = typeof bt.line_items === 'string' ? JSON.parse(bt.line_items) : (bt.LineItems || bt.line_items || []);
        const totalAmount = Math.abs(parseFloat(bt.Total !== undefined ? bt.Total : (bt.SubTotal || 0)));

        if (Array.isArray(lines) && lines.length > 0) {
          hasBankTransactions = true;
          for (const line of lines) {
            const lineCode = (line.AccountCode || line.account_code || '').toString().trim();
            const lineAccId = (line.AccountID || line.account_id || codeToAccountIdMap.get(lineCode) || '').toString().trim();
            const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount || 0));
            const lineTax = parseFloat(line.TaxAmount || line.tax_amount || 0);
            const netAmount = Math.abs(lineTotal - lineTax);

            if (netAmount > 0 && (lineAccId || lineCode)) {
              entries.push({
                tenantId,
                source: 'xero',
                sourceTransactionId: bt.BankTransactionID || bt.id || '',
                sourceLineId: line.LineItemID || line.id || '',
                sourceAccountId: lineAccId || lineCode,
                accountCode: lineCode,
                accountName: line.Description || bt.Contact?.Name || 'Bank Transaction Line',
                date: rawDate || new Date().toISOString(),
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
          hasBankTransactions = true;
          const bankAccId = (bt.BankAccount.AccountID || codeToAccountIdMap.get(bt.BankAccount.Code) || '').toString().trim();
          const bankCode = (bt.BankAccount.Code || '').toString().trim();
          entries.push({
            tenantId,
            source: 'xero',
            sourceTransactionId: bt.BankTransactionID || bt.id || '',
            sourceAccountId: bankAccId || bankCode,
            accountCode: bankCode,
            accountName: bt.BankAccount.Name || 'Bank Account',
            date: rawDate || new Date().toISOString(),
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

    return { ledgerEntries: entries, hasManualJournals, hasBankTransactions };
  }

  /**
   * Computes complete Canonical CFO Metrics for a tenant without hardcoded account codes or ratio fallbacks.
   */
  
  /**
   * Helper alias for Phase 7 validation & intelligence engine
   */
  static async calculateFinancials(tenantId: string | number, fromDateStr?: string, toDateStr?: string): Promise<{
    metrics: Record<string, number | null>;
    currency: string;
    dataCoverageStatus: DataCoverageStatus;
    mappingCoveragePct: number;
    sourceMode?: string;
  }> {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    const raw = await this.calculateMetrics(tid, fromDateStr, toDateStr);
    const metrics: Record<string, number | null> = {
      revenue: raw.metrics.revenue.value,
      cogs: raw.metrics.costOfSales.value,
      grossProfit: raw.metrics.grossProfit.value,
      operatingExpenses: raw.metrics.operatingExpenses.value,
      operatingProfit: raw.metrics.operatingProfit.value,
      netProfit: raw.metrics.netProfit.value,
      ebitda: raw.metrics.ebitda.value,
      cash: raw.metrics.cashBalance.value,
      accountsReceivable: raw.metrics.accountsReceivable.value,
      accountsPayable: raw.metrics.accountsPayable.value
    };
    const totalAcc = raw.mappingSummary ? raw.mappingSummary.totalAccounts : 0;
    const unmapped = raw.mappingSummary ? raw.mappingSummary.unmappedCount : 0;
    const mapPct = totalAcc > 0 ? Math.round(((totalAcc - unmapped) / totalAcc) * 100) : 100;
    return {
      metrics,
      currency: 'GBP',
      dataCoverageStatus: raw.dataCoverageStatus,
      mappingCoveragePct: mapPct,
      sourceMode: raw.sourceMode
    };
  }

  static async calculateMetrics(
    tenantId: number,
    fromDateStr?: string,
    toDateStr?: string
  ): Promise<CanonicalCFOEngineResult> {
    const cleanFrom = fromDateStr || '2020-01-01';
    const cleanTo = toDateStr || '2030-12-31';

    const { mappingMap, codeToAccountIdMap, summary } = await this.resolveTenantMappingMap(tenantId);

    // Fetch invoices, accounts, manual journals, bank transactions, and report caches
    const dbInvoices = await db.getInvoices(tenantId);
    const dbAccounts = await db.getAccounts(tenantId);
    const dbManualJournals = (await db.getReport(tenantId, 'ManualJournals')) || (await db.getReport(tenantId, 'Journals')) || [];
    const dbBankTxns = (await db.getReport(tenantId, 'BankTransactions')) || [];

    const startTs = new Date(`${cleanFrom}T00:00:00.000Z`).getTime();
    const endTs = new Date(`${cleanTo}T23:59:59.999Z`).getTime();

    // 1. Fetch persisted transactions from canonical ledger table account_transactions
    let dbTxns = (await db.getAccountTransactions ? await db.getAccountTransactions(tenantId, cleanFrom, cleanTo) : []) || [];
    
    // Auto-ingest if account_transactions is currently empty for this tenant
    if (dbTxns.length === 0 && (dbInvoices.length > 0 || (dbManualJournals && dbManualJournals.length > 0) || (dbBankTxns && dbBankTxns.length > 0))) {
      try {
        const { CanonicalLedgerIngestionService } = await import('./CanonicalLedgerIngestionService');
        await CanonicalLedgerIngestionService.ingestTenantLedger(tenantId);
        dbTxns = (await db.getAccountTransactions ? await db.getAccountTransactions(tenantId, cleanFrom, cleanTo) : []) || [];
      } catch (err: any) {
        console.warn('Auto ledger ingestion fallback:', err.message);
      }
    }

    let ledgerEntries: CanonicalLedgerEntry[] = [];
    let hasManualJournals = false;
    let hasBankTransactions = false;

    if (dbTxns.length > 0) {
      for (const row of dbTxns) {
        const amt = parseFloat(row.net_amount || row.debit || row.credit || row.amount || 0);
        const dir: 'DEBIT' | 'CREDIT' = row.direction ? row.direction : (parseFloat(row.debit || 0) > 0 ? 'DEBIT' : 'CREDIT');
        const accId = row.source_account_id || codeToAccountIdMap.get(row.account_code) || row.account_code || '';
        const txnType = row.transaction_type || 'INVOICE';

        if (txnType === 'MANUAL_JOURNAL') hasManualJournals = true;
        if (txnType === 'BANK_TRANSACTION' || txnType === 'BANK_TRANSFER') hasBankTransactions = true;

        ledgerEntries.push({
          tenantId,
          source: row.source || 'xero',
          sourceTransactionId: row.source_id || row.source_transaction_id || '',
          sourceLineId: row.source_line_id || '',
          sourceAccountId: accId,
          accountCode: row.account_code,
          accountName: row.account_name,
          date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
          amount: amt,
          direction: dir,
          description: row.description,
          reference: row.reference,
          transactionType: txnType,
          currency: row.currency || 'GBP',
          taxType: row.tax_type,
          netAmount: parseFloat(row.net_amount || amt),
          taxAmount: parseFloat(row.tax_amount || 0),
          grossAmount: parseFloat(row.gross_amount || amt)
        });
      }
    } else {
      // Fallback extraction for in-memory test objects
      const extracted = this.extractLedgerEntries(
        tenantId,
        dbInvoices,
        codeToAccountIdMap,
        startTs,
        endTs,
        dbManualJournals,
        dbBankTxns
      );
      ledgerEntries = extracted.ledgerEntries;
      hasManualJournals = extracted.hasManualJournals;
      hasBankTransactions = extracted.hasBankTransactions;
    }

    let categoryTotals = {
      REVENUE: 0,
      COST_OF_SALES: 0,
      OPERATING_EXPENSES: 0,
      OTHER_INCOME: 0,
      OTHER_EXPENSES: 0,
      DEPRECIATION_AMORTIZATION: 0,
      ASSET: 0,
      LIABILITY: 0,
      EQUITY: 0
    };

    let hasDepreciationAmortizationMapped = false;
    const unmappedAccountsTracked: Map<string, { sourceAccountId: string; accountCode?: string; accountName?: string; status?: string }> = new Map();

    for (const entry of ledgerEntries) {
      if (entry.transactionType === 'BANK_TRANSFER') {
        // Bank transfers between internal bank accounts are net zero and create NO revenue or expense
        continue;
      }

      let mapping = mappingMap.get(entry.sourceAccountId);
      if (!mapping && entry.accountCode) {
        const mappedAccId = codeToAccountIdMap.get(entry.accountCode);
        if (mappedAccId) mapping = mappingMap.get(mappedAccId);
      }

      if (!mapping || !mapping.isAuthoritative) {
        const key = entry.sourceAccountId || entry.accountCode || 'unknown';
        if (!unmappedAccountsTracked.has(key)) {
          unmappedAccountsTracked.set(key, {
            sourceAccountId: entry.sourceAccountId || key,
            accountCode: entry.accountCode,
            accountName: entry.description || 'Unmapped Account',
            status: mapping ? mapping.status : 'UNMAPPED'
          });
        }
        continue;
      }

      const cat = mapping.financialStatementCategory;
      const sub = (mapping.subcategory || '').toUpperCase();
      const tag = (mapping.cfoAnalyticalTag || '').toUpperCase();
      const accName = (mapping.accountName || '').toLowerCase();

      if (sub === 'DEPRECIATION' || sub === 'AMORTIZATION' || tag === 'DEPRECIATION' || tag === 'AMORTIZATION' || accName.includes('depreciation') || accName.includes('amortisation') || accName.includes('amortization')) {
        hasDepreciationAmortizationMapped = true;
        categoryTotals.DEPRECIATION_AMORTIZATION += entry.amount;
      }

      if (cat === 'REVENUE') {
        if (entry.direction === 'CREDIT') {
          categoryTotals.REVENUE += entry.amount;
        } else {
          categoryTotals.REVENUE -= entry.amount; // Credit note reduces revenue
        }
      } else if (cat === 'COST_OF_SALES') {
        if (entry.direction === 'DEBIT') {
          categoryTotals.COST_OF_SALES += entry.amount;
        } else {
          categoryTotals.COST_OF_SALES -= entry.amount; // Bill credit note reduces COGS
        }
      } else if (cat === 'OPERATING_EXPENSES') {
        if (entry.direction === 'DEBIT') {
          categoryTotals.OPERATING_EXPENSES += entry.amount;
        } else {
          categoryTotals.OPERATING_EXPENSES -= entry.amount; // Bill credit note reduces OPEX
        }
      } else if (cat === 'OTHER_INCOME_EXPENSE') {
        if (sub === 'OTHER_INCOME' || accName.includes('income')) {
          categoryTotals.OTHER_INCOME += entry.amount;
        } else {
          categoryTotals.OTHER_EXPENSES += entry.amount;
        }
      }
    }

    const hasUnmapped = summary.suggestedCount > 0 || summary.unmappedCount > 0 || unmappedAccountsTracked.size > 0;
    const calcStatus: 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED_ACCOUNTS' = hasUnmapped ? 'PARTIAL_MAPPING' : 'COMPLETE';
    const mappingCoverageStatus: MappingCoverageStatus = hasUnmapped ? 'PARTIAL_MAPPING' : 'COMPLETE';
    const unmappedList = Array.from(unmappedAccountsTracked.values());

    // Data coverage status determination
    let dataCoverageStatus: DataCoverageStatus = 'DATA_PARTIAL';
    let coverageWarning = 'Transaction coverage is DATA_PARTIAL (Invoices and Bills parsed; Manual Journals & Direct Bank spend unmapped or absent from transaction store).';

    if ((hasManualJournals || (dbManualJournals && dbManualJournals.length > 0)) && (hasBankTransactions || (dbBankTxns && dbBankTxns.length > 0))) {
      dataCoverageStatus = 'DATA_COMPLETE';
      coverageWarning = '';
    } else {
      dataCoverageStatus = 'DATA_PARTIAL';
    }

    let revenueVal: number | null = Math.round(categoryTotals.REVENUE * 100) / 100;
    let cogsVal: number | null = Math.round(categoryTotals.COST_OF_SALES * 100) / 100;
    let opexVal: number | null = Math.round(categoryTotals.OPERATING_EXPENSES * 100) / 100;
    let isPnlFromLedger = false;
    let hasPnlData = ledgerEntries.length > 0;

    let nativeGrossProfit: number | null = null;

    try {
      const pnlReport = await db.getXeroReport(tenantId, 'ProfitAndLoss', cleanFrom, cleanTo);
      if (pnlReport) {
        const rawPnl = typeof pnlReport === 'string' ? JSON.parse(pnlReport) : (pnlReport.raw_data || pnlReport);
        const parsedPnl = ProfitAndLossService.parseReport(rawPnl);
        if (parsedPnl && parsedPnl.revenue > 0) {
          hasPnlData = true;
          const revDiffPct = Math.abs((revenueVal || 0) - parsedPnl.revenue) / parsedPnl.revenue;
          const cogsDiffPct = parsedPnl.cogs > 0 ? Math.abs((cogsVal || 0) - parsedPnl.cogs) / parsedPnl.cogs : 0;
          const opexDiffPct = parsedPnl.operatingExpenses > 0 ? Math.abs((opexVal || 0) - parsedPnl.operatingExpenses) / parsedPnl.operatingExpenses : 0;

          if (revDiffPct <= 0.01 && cogsDiffPct <= 0.01 && opexDiffPct <= 0.01) {
            isPnlFromLedger = true; // MODE B
          } else {
            // MODE A: Fallback to Authoritative Report Mode when canonical coverage is partial
            revenueVal = parsedPnl.revenue;
            cogsVal = parsedPnl.cogs;
            opexVal = parsedPnl.operatingExpenses;
            nativeGrossProfit = parsedPnl.grossProfit;
            isPnlFromLedger = false;
          }
        }
      } else if (revenueVal > 0 && cogsVal > 0 && opexVal > 0) {
        isPnlFromLedger = true;
      }
    } catch (e) { }

    if (!hasPnlData && ledgerEntries.length === 0) {
      dataCoverageStatus = 'DATA_NOT_AVAILABLE';
      revenueVal = null;
      cogsVal = null;
      opexVal = null;
    }

    const grossProfitVal = (!isPnlFromLedger && nativeGrossProfit !== null && nativeGrossProfit !== undefined)
      ? Math.round(nativeGrossProfit * 100) / 100
      : ((revenueVal !== null && cogsVal !== null) ? Math.round((revenueVal - cogsVal) * 100) / 100 : null);
    const grossMarginPctVal = (revenueVal !== null && revenueVal > 0 && grossProfitVal !== null) ? Math.round(((grossProfitVal / revenueVal) * 100) * 100) / 100 : null;
    const operatingProfitVal = (grossProfitVal !== null && opexVal !== null) ? Math.round((grossProfitVal - opexVal) * 100) / 100 : null;
    
    // EBITDA: Only calculated when depreciation or amortization adjustments are available from mapped data
    let ebitdaVal: number | null = null;
    let ebitdaWarnings: string[] | undefined = undefined;

    if (hasDepreciationAmortizationMapped && operatingProfitVal !== null) {
      ebitdaVal = Math.round((operatingProfitVal + categoryTotals.DEPRECIATION_AMORTIZATION) * 100) / 100;
    } else {
      ebitdaVal = null;
      ebitdaWarnings = ['EBITDA cannot be calculated reliably from the currently mapped accounting data.'];
    }

    // Net Profit: Uniform fallback to authoritative Xero P&L Net Profit when P&L report is used or available
    let netProfitVal = operatingProfitVal !== null ? Math.round((operatingProfitVal + categoryTotals.OTHER_INCOME - categoryTotals.OTHER_EXPENSES) * 100) / 100 : null;

    if (!isPnlFromLedger) {
      try {
        const pnlReport = await db.getXeroReport(tenantId, 'ProfitAndLoss', cleanFrom, cleanTo);
        if (pnlReport) {
          const rawPnl = typeof pnlReport === 'string' ? JSON.parse(pnlReport) : (pnlReport.raw_data || pnlReport);
          const parsedPnl = ProfitAndLossService.parseReport(rawPnl);
          if (parsedPnl && parsedPnl.netProfit !== 0) {
            netProfitVal = parsedPnl.netProfit;
          } else if (rawPnl.netProfit !== undefined) {
            netProfitVal = Number(rawPnl.netProfit);
          }
        }
      } catch (e) { }
    }

    // Fetch Balance Sheet metrics with explicit REPORT_AVAILABLE vs REPORT_NOT_AVAILABLE semantics
    let cashBalance: number | null = null;
    let isBsReportAvailable = false;
    let accountsReceivable: number | null = null;
    let accountsPayable: number | null = null;

    try {
      const bsReport = await db.getXeroReport(tenantId, 'BalanceSheet', cleanFrom, cleanTo);
      if (bsReport) {
        const rawBs = typeof bsReport === 'string' ? JSON.parse(bsReport) : (bsReport.raw_data || bsReport);
        if (rawBs && rawBs.Rows) {
          const bsCash = BalanceSheetParser.findTotalCash(rawBs.Rows);
          if (bsCash !== null && bsCash !== undefined) {
            cashBalance = bsCash; // 0 is a valid accounting value from Balance Sheet!
            isBsReportAvailable = true;
          }
          const bsAR = BalanceSheetParser.findTotalAR(rawBs.Rows);
          if (bsAR !== null && bsAR !== undefined) {
            accountsReceivable = bsAR;
            isBsReportAvailable = true;
          }
          const bsAP = BalanceSheetParser.findTotalAP(rawBs.Rows);
          if (bsAP !== null && bsAP !== undefined) {
            accountsPayable = bsAP;
            isBsReportAvailable = true;
          }
        }
        if ((cashBalance === null) && rawBs.cash !== undefined) {
          cashBalance = Number(rawBs.cash);
          isBsReportAvailable = true;
        }
        if (accountsReceivable === null && rawBs.accountsReceivable !== undefined) {
          accountsReceivable = Number(rawBs.accountsReceivable);
          isBsReportAvailable = true;
        }
        if (accountsPayable === null && rawBs.accountsPayable !== undefined) {
          accountsPayable = Number(rawBs.accountsPayable);
          isBsReportAvailable = true;
        }
      }
    } catch (e) { }

    // Only fallback to bank account balances when Balance Sheet report is genuinely unavailable
    if (!isBsReportAvailable || cashBalance === null) {
      if (dbAccounts && Array.isArray(dbAccounts)) {
        const bankAccounts = dbAccounts.filter(a => (a.type || a.Type || '').toUpperCase() === 'BANK');
        cashBalance = bankAccounts.reduce((sum, a) => sum + (parseFloat(a.balance || a.Balance || 0)), 0);
      } else {
        cashBalance = 0;
      }
    }

    if (accountsReceivable === null) {
      if (dbInvoices && Array.isArray(dbInvoices)) {
        let arSum = 0;
        for (const inv of dbInvoices) {
          const status = (inv.Status || inv.status || '').toUpperCase();
          if (status === 'AUTHORISED' || status === 'SUBMITTED' || status === '' || inv.amount_due !== undefined) {
            const isACCREC = (inv.Type || inv.type || '').toUpperCase() === 'ACCREC';
            const due = parseFloat(inv.AmountDue !== undefined ? inv.AmountDue : (inv.amount_due !== undefined ? inv.amount_due : inv.total || inv.Total || 0));
            if (isACCREC) {
              arSum += due;
            }
          }
        }
        accountsReceivable = arSum;
      } else {
        accountsReceivable = 0;
      }
    }

    if (accountsPayable === null) {
      if (dbInvoices && Array.isArray(dbInvoices)) {
        let apSum = 0;
        for (const inv of dbInvoices) {
          const status = (inv.Status || inv.status || '').toUpperCase();
          if (status === 'AUTHORISED' || status === 'SUBMITTED' || status === '' || inv.amount_due !== undefined) {
            const isACCREC = (inv.Type || inv.type || '').toUpperCase() === 'ACCREC';
            const due = parseFloat(inv.AmountDue !== undefined ? inv.AmountDue : (inv.amount_due !== undefined ? inv.amount_due : inv.total || inv.Total || 0));
            if (!isACCREC) {
              apSum += due;
            }
          }
        }
        accountsPayable = apSum;
      } else {
        accountsPayable = 0;
      }
    }

    const wrapMetric = (
      val: number | null,
      customStatus?: 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED_ACCOUNTS' | 'NOT_AVAILABLE' | 'INCOMPLETE',
      customWarnings?: string[]
    ): CanonicalMetricValue => {
      const isNull = val === null;
      const isMetricUnmapped = hasUnmapped || unmappedAccountsTracked.size > 0;
      const metricMapStatus: MappingCoverageStatus = isNull ? 'UNMAPPED' : (isMetricUnmapped ? 'PARTIAL_MAPPING' : 'COMPLETE');
      const warnList = customWarnings ? [...customWarnings] : [];
      if (dataCoverageStatus === 'DATA_PARTIAL' && !isNull) {
        warnList.push(coverageWarning);
      }

      return {
        value: val,
        status: customStatus || (isNull ? 'NOT_AVAILABLE' : (isMetricUnmapped ? 'PARTIAL_MAPPING' : 'COMPLETE')),
        mappingStatus: metricMapStatus,
        dataCoverage: dataCoverageStatus,
        confidence: isNull ? 'NOT_AVAILABLE' : (isMetricUnmapped ? 'INCOMPLETE' : 'AUTHORITATIVE'),
        unmappedAccountsCount: unmappedAccountsTracked.size,
        unmappedAccounts: unmappedList,
        warnings: warnList.length > 0 ? warnList : undefined
      };
    };

    return {
      tenantId,
      period: { fromDate: cleanFrom, toDate: cleanTo },
      calculationStatus: calcStatus,
      dataCoverageStatus,
      mappingCoverageStatus,
      sourceMode: isPnlFromLedger ? 'MODE_B' : 'MODE_A',
      mappingCoveragePct: Math.round(((summary.confirmedCount + summary.customOverrideCount) / (summary.totalAccounts || 1)) * 100),
      metrics: {
        revenue: wrapMetric(revenueVal),
        costOfSales: wrapMetric(cogsVal),
        grossProfit: wrapMetric(grossProfitVal),
        grossMarginPct: wrapMetric(grossMarginPctVal),
        operatingExpenses: wrapMetric(opexVal),
        operatingProfit: wrapMetric(operatingProfitVal),
        ebitda: wrapMetric(ebitdaVal, hasDepreciationAmortizationMapped ? calcStatus : 'NOT_AVAILABLE', ebitdaWarnings),
        netProfit: wrapMetric(netProfitVal),
        cashBalance: wrapMetric(cashBalance !== null ? Math.round(cashBalance * 100) / 100 : 0),
        accountsReceivable: wrapMetric(Math.round(accountsReceivable * 100) / 100),
        accountsPayable: wrapMetric(Math.round(accountsPayable * 100) / 100)
      },
      mappingSummary: summary
    };
  }
}
