import { db, parseXeroDate } from '../db';

export const TaxSyncService = {
  syncTaxTransactions: async (tenantId: number): Promise<void> => {
    // 1. Get raw Master TaxRates from database
    const taxRatesReport = await db.getReport(tenantId, 'TaxRates');
    const taxRatesList = Array.isArray(taxRatesReport) ? taxRatesReport : [];
    const taxRatesMap: Record<string, { name: string; rate: number }> = {};
    for (const rate of taxRatesList) {
      if (rate.TaxType) {
        taxRatesMap[rate.TaxType] = {
          name: rate.Name || '',
          rate: parseFloat(rate.EffectiveRate || rate.DisplayTaxRate || 0)
        };
      }
    }

    // 2. Load Invoices and CreditNotes from database reports
    const invoicesReport = await db.getReport(tenantId, 'Invoices');
    const invoicesList = Array.isArray(invoicesReport) ? invoicesReport : [];

    const creditNotesReport = await db.getReport(tenantId, 'CreditNotes');
    const creditNotesList = Array.isArray(creditNotesReport) ? creditNotesReport : [];

    const transactionsToSave: any[] = [];

    // Helper to process line items
    const processLines = (
      xeroTxnId: string,
      txnType: 'INVOICE' | 'CREDITNOTE',
      sourceType: 'ACCREC' | 'ACCPAY',
      direction: 'OUTPUT' | 'INPUT',
      dateStr: string,
      status: string,
      currency: string,
      contactName: string,
      lineItems: any[]
    ) => {
      if (!Array.isArray(lineItems)) return;
      const parsedDate = parseXeroDate(dateStr);
      if (!parsedDate) return;

      for (const line of lineItems) {
        const taxType = line.TaxType;
        if (!taxType || taxType === 'NONE') continue;

        const taxAmount = parseFloat(line.TaxAmount || 0);
        const taxableAmount = parseFloat(line.LineAmount || 0);
        if (taxAmount === 0 && taxableAmount === 0) continue;

        const rateInfo = taxRatesMap[taxType] || { name: taxType, rate: 0 };

        transactionsToSave.push({
          xero_transaction_id: xeroTxnId,
          transaction_type: txnType,
          source_type: sourceType,
          direction,
          date: parsedDate,
          tax_type: taxType,
          tax_rate_name: rateInfo.name,
          tax_rate_percent: rateInfo.rate,
          taxable_amount: taxableAmount,
          tax_amount: taxAmount,
          status,
          currency,
          contact_name: contactName,
          account_code: line.AccountCode || ''
        });
      }
    };

    // 3. Process Invoices
    for (const inv of invoicesList) {
      const status = (inv.Status || '').toUpperCase();
      // Skip draft, deleted, voided invoices
      if (status === 'DRAFT' || status === 'DELETED' || status === 'VOIDED') continue;

      const sourceType = (inv.Type || '').toUpperCase() === 'ACCREC' ? 'ACCREC' : 'ACCPAY';
      const direction = sourceType === 'ACCREC' ? 'OUTPUT' : 'INPUT';
      const currency = inv.CurrencyCode || '';
      const contactName = inv.Contact?.Name || '';

      processLines(
        inv.InvoiceID,
        'INVOICE',
        sourceType,
        direction,
        inv.Date,
        inv.Status,
        currency,
        contactName,
        inv.LineItems
      );
    }

    // 4. Process Credit Notes
    for (const cn of creditNotesList) {
      const status = (cn.Status || '').toUpperCase();
      // Skip draft, deleted, voided credit notes
      if (status === 'DRAFT' || status === 'DELETED' || status === 'VOIDED') continue;

      const type = (cn.Type || '').toUpperCase();
      const sourceType = type === 'ACCRECCREDIT' ? 'ACCREC' : 'ACCPAY';
      const direction = sourceType === 'ACCREC' ? 'OUTPUT' : 'INPUT';
      const currency = cn.CurrencyCode || '';
      const contactName = cn.Contact?.Name || '';

      processLines(
        cn.CreditNoteID,
        'CREDITNOTE',
        sourceType,
        direction,
        cn.Date,
        cn.Status,
        currency,
        contactName,
        cn.LineItems
      );
    }

    // 5. Save to database using saveTaxTransactions
    await db.clearTaxTransactions(tenantId);
    if (transactionsToSave.length > 0) {
      await db.saveTaxTransactions(tenantId, transactionsToSave);
    }

    console.log(`Successfully synced ${transactionsToSave.length} tax transactions for tenant ${tenantId}`);
  }
};
