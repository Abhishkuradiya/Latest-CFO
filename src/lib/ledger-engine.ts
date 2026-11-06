import { db } from '@/lib/db';
import { XeroAccountTransactionsService } from '@/lib/services/XeroAccountTransactionsService';
import { resolveBrandingTheme } from '@/lib/constants/brandingThemes';

export interface LedgerTransaction {
  id: string;
  date: string;
  source: string;
  description: string;
  reference: string;
  invoiceNumber?: string;
  invoiceId?: string;
  currency: string;
  debit: number;
  credit: number;
  gross?: number;
  tax?: number;
  amount: number;
  runningBalance: number;
  lineItems?: any[];
  rawInvoice?: any;
}

export interface AccountLedgerResult {
  accountName: string;
  accountCode: string;
  sourceAccountId?: string;
  fromDate: string;
  toDate: string;
  totalValue: number;
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  transactions: LedgerTransaction[];
  dataCoverage: 'DATA_COMPLETE' | 'DATA_PARTIAL';
  warning?: string;
}

/** 
 * LEGACY: Hardcoded fallback account mapping. 
 * Scheduled for deprecation in Phase 3 migration. 
 * Future metric engines must use AccountMappingService & tenant_account_mappings database table instead.
 */
const ACCOUNT_CODE_MAP_LOCAL: Record<string, string> = {
  '400': 'SLA & Contract Income',
  '405': 'PayPal Fee',
  '410': 'Sales',
  '411': 'Ebay sales',
  '412': 'Amazon Sales',
  '413': 'Website Sales',
  '414': 'Groupon Sales',
  '415': 'Inter company sales to BC Ltd',
  '416': 'Website Sales-GWL',
  '420': 'Rebates & Supplier Incentives',
  '421': 'Interest Income',
  '499': 'Inter company Purchases from BC Ltd',
  '500': 'Cost of goods or services',
  '501': 'Packaging Materials',
  '502': 'Inventory Write-offs / Expiry',
  '503': 'Logistics',
  '504': '3PL',
  '505': 'Referral Fees',
  '506': 'Merchant Fees',
  '507': 'Courier & Shipping Costs',
  '508': 'Amazon Fee',
  '509': 'Ebay fee',
  '510': 'Amazon Shipping',
  '511': 'Opening stock',
  '512': 'Closing stock'
};

function computeNetLineAmount(line: any, inv: any): number {
  const lineTotal = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount || 0));
  const lineTax = parseFloat(line.TaxAmount || line.tax_amount || 0);

  if (lineTax === 0) {
    return Math.round(Math.abs(lineTotal) * 100) / 100;
  }
  
  const lineItems = typeof inv?.line_items === 'string' ? JSON.parse(inv.line_items) : (inv?.LineItems || inv?.line_items || []);
  const sumLines = lineItems.reduce((acc: number, l: any) => acc + parseFloat(l.LineAmount !== undefined ? l.LineAmount : (l.UnitAmount || 0)), 0);
  
  const invTotal = parseFloat(inv?.Total || inv?.total || 0);
  const invSubTotal = parseFloat(inv?.SubTotal || inv?.sub_total || 0);
  
  const isExplicitInclusive = ((inv?.line_amount_types || inv?.LineAmountTypes || '') as string).toUpperCase() === 'INCLUSIVE';
  const isImplicitInclusive = invTotal > 0 && Math.abs(sumLines - invTotal) < 1.0;
  const isExclusive = invSubTotal > 0 && Math.abs(sumLines - invSubTotal) < 1.0;

  if (isExplicitInclusive || (isImplicitInclusive && !isExclusive)) {
    return Math.round((Math.abs(lineTotal) - Math.abs(lineTax)) * 100) / 100;
  }
  
  return Math.round(Math.abs(lineTotal) * 100) / 100;
}

function formatPaymentDate(inv: any, defaultDate: string): string {
  const rawPDate = inv.FullyPaidOnDate || inv.fully_paid_on_date || inv.Payments?.[0]?.Date || inv.payments?.[0]?.Date || inv.payments?.[0]?.payment_date || inv.payment_date;
  if (!rawPDate) return defaultDate;

  if (typeof rawPDate === 'string') {
    const match = rawPDate.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) {
      const ts = parseInt(match[1], 10);
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
  }

  const d = new Date(rawPDate);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  return defaultDate;
}

function parseToUtcTimestamp(rawDate: any): number {
  if (!rawDate) return 0;
  if (typeof rawDate === 'string') {
    const match = rawDate.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match) return parseInt(match[1], 10);
    if (rawDate.length >= 10) {
      const datePart = rawDate.split('T')[0];
      const d = new Date(`${datePart}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }
  const d = new Date(rawDate);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Pure Accounting Reconstruction Engine (PostgreSQL Database Engine)
 * Strictly filters DB invoices by Account Code and Accounting Type (Receivables for Sales 4xx, Payables for Expenses 5xx/6xx).
 */
export async function getAccountTransactionsLedger(
  tenantId: number,
  accountName: string,
  fromDateStr: string,
  toDateStr: string,
  targetValue: number = 0
): Promise<AccountLedgerResult> {
  const accLower = (accountName || '').toLowerCase().trim();

  const cleanFrom = (fromDateStr || '2020-01-01').split('T')[0];
  const cleanTo = (toDateStr || '2030-12-31').split('T')[0];

  const startTs = new Date(`${cleanFrom}T00:00:00.000Z`).getTime();
  const endTs = new Date(`${cleanTo}T23:59:59.999Z`).getTime();

  let targetAccCode = '400';
  let resolvedAccountName = accountName;
  let matchedAccount: any = null;
  let isExpenseAccount = false;
  let sourceAccountId: string | undefined = undefined;

  try {
    const dbInvoices = await db.getInvoices(tenantId);
    const dbAccounts = await db.getAccounts(tenantId);
    let cachedBankTxns: any[] = [];
    try {
      const bankReport = await db.getReport(tenantId, 'BankTransactions');
      if (bankReport) {
        cachedBankTxns = typeof bankReport === 'string' ? JSON.parse(bankReport) : (Array.isArray(bankReport) ? bankReport : (bankReport.raw_data || []));
      }
    } catch (e) { }

    let cachedManualJournals: any[] = [];
    try {
      const mjReport = await db.getReport(tenantId, 'ManualJournals');
      if (mjReport) {
        cachedManualJournals = typeof mjReport === 'string' ? JSON.parse(mjReport) : (Array.isArray(mjReport) ? mjReport : (mjReport.raw_data || []));
      }
    } catch (e) { }
    
    // 1. Resolve Target Account Code dynamically from PostgreSQL accounts table
    const codeMatch = accountName.match(/^(\d{2,4})\b/);
    const extractedCode = codeMatch ? codeMatch[1] : null;

    matchedAccount = (dbAccounts || []).find(a => {
      const aCode = (a.Code || a.code || '').toString().toLowerCase();
      const aName = (a.Name || a.name || '').toLowerCase();
      if (extractedCode && aCode === extractedCode) return true;
      if (aName === accLower) return true;
      if (accLower === `${aCode} - ${aName}`) return true;
      return false;
    });

    if (!matchedAccount) {
      // Search active accounts (filter out OLD_ archived accounts first)
      const activeAccounts = (dbAccounts || []).filter(a => 
        !(a.Code || a.code || '').toString().startsWith('OLD_') && 
        !(a.Name || a.name || '').startsWith('OLD_')
      );

      matchedAccount = activeAccounts.find(a => {
        const aCode = (a.Code || a.code || '').toString().toLowerCase();
        const aName = (a.Name || a.name || '').toLowerCase();

        if (aCode && accLower.includes(aCode)) return true;

        if (accLower.includes('opening stock') && aCode === '511') return true;
        if (accLower.includes('closing stock') && aCode === '512') return true;
        if (accLower.includes('packaging') && aCode === '501') return true;
        if (accLower.includes('merchant') && aCode === '506') return true;
        if (accLower.includes('courier') && aCode === '507') return true;
        if (accLower.includes('3pl') && aCode === '504') return true;
        if (accLower.includes('logistics') && aCode === '503') return true;
        if (accLower.includes('referral') && aCode === '505') return true;
        if (accLower.includes('amazon fee') && aCode === '508') return true;
        if (accLower.includes('ebay fee') && aCode === '509') return true;
        if (accLower.includes('amazon shipping') && aCode === '510') return true;
        if ((accLower.includes('cost of goods') || accLower.includes('cogs')) && aCode === '500') return true;

        if (accLower.includes('inter company') || accLower.includes('bc ltd') || accLower.includes('berkeley care')) {
          if (accLower.includes('purchase') && (aCode === '499' || aName.includes('purchase'))) return true;
          if (accLower.includes('sale') && (aCode === '415' || aName.includes('sale'))) return true;
        }

        if (aName === accLower) return true;
        if (aName && (accLower.includes(aName) || aName.includes(accLower))) return true;

        return false;
      });
    }

    // Fallback to any account matching
    if (!matchedAccount) {
      matchedAccount = (dbAccounts || []).find(a => {
        const aName = (a.Name || a.name || '').toLowerCase();
        return accLower.includes(aName) || aName.includes(accLower);
      });
    }

    targetAccCode = matchedAccount ? (matchedAccount.Code || matchedAccount.code || '400') : '400';
    resolvedAccountName = matchedAccount ? (matchedAccount.Name || matchedAccount.name || accountName) : accountName;

    const isSalesAccount = (targetAccCode.startsWith('4') && targetAccCode !== '499') || (accLower.includes('sales') && !accLower.includes('cogs') && !accLower.includes('purchase')) || accLower.includes('income') || accLower.includes('revenue');
    isExpenseAccount = targetAccCode.startsWith('5') || targetAccCode.startsWith('6') || targetAccCode === '499' || accLower.includes('expense') || accLower.includes('cost') || accLower.includes('fee') || accLower.includes('purchase');
    const accKeyword = accLower.replace(/sales|income|expenses|account|fees/gi, '').trim() || accLower;
    sourceAccountId = matchedAccount ? (matchedAccount.AccountID || matchedAccount.account_id || matchedAccount.external_id || undefined) : undefined;

    // 1. If local DB has 0 invoices (e.g. Tenant 5 Demo Company), fetch via XeroAccountTransactionsService
    if (!dbInvoices || dbInvoices.length === 0) {
      try {
        const xeroServiceResult = await XeroAccountTransactionsService.fetchAccountTransactions(
          tenantId,
          sourceAccountId,
          targetAccCode,
          resolvedAccountName,
          cleanFrom,
          cleanTo,
          targetValue
        );

        if (xeroServiceResult && xeroServiceResult.transactions && xeroServiceResult.transactions.length > 0) {
          let runningBal = 0;
          let totDebit = 0;
          let totCredit = 0;

          const transactions: LedgerTransaction[] = xeroServiceResult.transactions.map((t, idx) => {
            totDebit += t.debit;
            totCredit += t.credit;
            runningBal = isExpenseAccount 
              ? Math.round((runningBal + t.debit - t.credit) * 100) / 100
              : Math.round((runningBal + t.credit - t.debit) * 100) / 100;

            return {
              id: t.sourceTransactionId || `xero-acc-txn-${idx + 1}`,
              date: t.date,
              source: t.transactionType || 'Account Transaction',
              description: t.description || t.accountName,
              reference: t.reference || '',
              currency: t.currency || 'GBP',
              debit: t.debit,
              credit: t.credit,
              gross: t.gross,
              tax: t.tax,
              amount: Math.round((t.credit || t.debit) * 100) / 100,
              runningBalance: Math.round(t.runningBalance !== undefined && !isNaN(t.runningBalance) && t.runningBalance !== 0 ? t.runningBalance : runningBal * 100) / 100,
              lineItems: [
                {
                  desc: t.description,
                  account: `${t.accountCode || targetAccCode} - ${t.accountName || resolvedAccountName}`,
                  taxRate: (t.tax && t.tax > 0) ? 'Tax Applied' : 'Zero Rated',
                  amountGbp: t.gross || (t.credit || t.debit)
                }
              ]
            };
          });

          return {
            accountName: resolvedAccountName || accountName,
            accountCode: targetAccCode || '400',
            sourceAccountId: xeroServiceResult.sourceAccountId || sourceAccountId,
            fromDate: fromDateStr,
            toDate: toDateStr,
            totalValue: xeroServiceResult.closingBalance || (isExpenseAccount ? Math.round((totDebit - totCredit) * 100) / 100 : Math.round((totCredit - totDebit) * 100) / 100),
            totalDebit: Math.round(totDebit * 100) / 100,
            totalCredit: Math.round(totCredit * 100) / 100,
            transactionCount: transactions.length,
            transactions,
            dataCoverage: 'DATA_COMPLETE'
          };
        }
      } catch (serviceErr: any) {
        console.warn('[ledger-engine] XeroAccountTransactionsService fallback notice:', serviceErr.message);
      }
    }

    const rawTransactionsList: any[] = [];

    // A. Parse Invoices (Receivable Invoices / Bills) - Fallback for local DB mode
    if (dbInvoices && dbInvoices.length > 0) {
      const inRangeInvoices = dbInvoices.filter(inv => {
        const status = (inv.Status || inv.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED' || status === 'DRAFT' || status === 'SUBMITTED') return false;

        const rawDate = inv.Date || inv.invoice_date || inv.DueDate;
        const dTime = parseToUtcTimestamp(rawDate);
        return dTime > 0 ? (dTime >= startTs && dTime <= endTs) : true;
      });

      inRangeInvoices.forEach((inv, i) => {
        const isACCREC = (inv.Type || inv.type || '').toUpperCase() === 'ACCREC';
        const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.LineItems || inv.line_items || []);
        const cName = (inv.ContactName || inv.Contact?.Name || inv.contact_name || '').trim();

        const rawDate = inv.Date || inv.invoice_date || inv.DueDate;
        const dTime = parseToUtcTimestamp(rawDate);
        const dObj = dTime > 0 ? new Date(dTime) : new Date();
        const formattedDate = dTime > 0 
          ? dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) 
          : fromDateStr;

        const rawDueDate = inv.DueDate || inv.due_date || rawDate;
        const dDueObj = rawDueDate ? new Date(rawDueDate) : dObj;
        const formattedDueDate = isNaN(dDueObj.getTime())
          ? formattedDate
          : dDueObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const invTotal = parseFloat(inv.Total || inv.total || 0);
        const invPaid = inv.AmountPaid !== undefined ? parseFloat(inv.AmountPaid) : (inv.amount_paid !== undefined ? parseFloat(inv.amount_paid) : (inv.Status === 'PAID' ? invTotal : 0));
        const invDue = inv.AmountDue !== undefined ? parseFloat(inv.AmountDue) : (inv.amount_due !== undefined ? parseFloat(inv.amount_due) : (inv.Status === 'PAID' ? 0 : invTotal));
        const invRef = inv.InvoiceNumber || inv.invoice_number || inv.Reference || `INV-${i + 1}`;

        const formattedAllLineItems = lineItems.length > 0
          ? lineItems.map((li: any) => {
              const liAccCode = (li.AccountCode || li.account_code || '').toString();
              const mapName = ACCOUNT_CODE_MAP_LOCAL[liAccCode];
              const liAccName = mapName || (liAccCode === targetAccCode ? resolvedAccountName : (liAccCode || resolvedAccountName));
              const formattedAcc = liAccCode ? `${liAccCode} - ${liAccName}` : `${targetAccCode} - ${resolvedAccountName}`;
              const rawLineAmt = li.LineAmount !== undefined ? parseFloat(li.LineAmount) : (li.UnitAmount !== undefined ? parseFloat(li.UnitAmount) : computeNetLineAmount(li, inv));
              return {
                desc: li.Description || li.description || li.ItemCode || `${cName || resolvedAccountName}`,
                account: formattedAcc,
                AccountCode: liAccCode,
                AccountName: liAccName,
                taxRate: li.TaxType || li.tax_type || (li.TaxAmount ? 'Tax Applied' : 'Zero Rated'),
                TaxType: li.TaxType,
                TaxAmount: li.TaxAmount !== undefined ? parseFloat(li.TaxAmount) : 0,
                LineAmount: rawLineAmt,
                UnitAmount: li.UnitAmount !== undefined ? parseFloat(li.UnitAmount) : rawLineAmt,
                amountGbp: rawLineAmt
              };
            })
          : [];

        if (lineItems.length > 0) {
          lineItems.forEach((line: any, idx: number) => {
            const lineAccCode = (line.AccountCode || line.account_code || '').toString();
            const lineAccId = (line.AccountID || line.account_id || '').toString();
            const targetAccId = matchedAccount ? (matchedAccount.AccountID || matchedAccount.account_id || matchedAccount.external_id || '').toString() : '';
            const lineDesc = line.Description || line.description || line.ItemCode || `${cName || resolvedAccountName}`;
            
            const matchesLine = (lineAccCode && lineAccCode === targetAccCode) || (targetAccId && lineAccId === targetAccId);

            if (matchesLine) {
              const lineTotalAmt = parseFloat(line.LineAmount !== undefined ? line.LineAmount : (line.UnitAmount !== undefined ? line.UnitAmount : 0));
              const lineAmt = computeNetLineAmount(line, inv);
              const isDeduction = lineTotalAmt < 0;

              let debit = 0;
              let credit = 0;

              if (isACCREC) {
                if (isDeduction) {
                  debit = lineAmt;
                } else {
                  credit = lineAmt;
                }
              } else {
                if (isDeduction) {
                  credit = lineAmt;
                } else {
                  debit = lineAmt;
                }
              }

              const lineTaxAmt = line.TaxAmount !== undefined ? parseFloat(line.TaxAmount) : (line.tax_amount !== undefined ? parseFloat(line.tax_amount) : 0);
              let lineTax = lineTaxAmt;
              if (lineTax === 0 && (inv.TotalTax || inv.total_tax) && (inv.SubTotal || inv.sub_total)) {
                const invSub = parseFloat(inv.SubTotal || inv.sub_total || 0);
                const invT = parseFloat(inv.TotalTax || inv.total_tax || 0);
                if (invSub > 0 && invT > 0) {
                  lineTax = Math.round((lineAmt * (invT / invSub)) * 100) / 100;
                }
              }
              const lineGross = Math.round((lineAmt + lineTax) * 100) / 100;

              const rowLineItem = {
                desc: lineDesc,
                account: line.AccountCode ? `${line.AccountCode} - ${resolvedAccountName}` : `${targetAccCode} - ${resolvedAccountName}`,
                taxRate: line.TaxType || line.tax_type || (lineTax > 0 ? 'Tax Applied' : 'Zero Rated'),
                amountGbp: lineAmt
              };

              rawTransactionsList.push({
                id: `pg-line-${inv.InvoiceID || inv.external_id || inv.id || i}-${idx + 1}`,
                rawDate: isNaN(dTime) ? 0 : dTime,
                date: formattedDate,
                source: isACCREC ? 'Receivable Invoice' : 'Payable Invoice',
                description: lineDesc.startsWith(cName) ? lineDesc : `${cName || resolvedAccountName} - ${lineDesc}`,
                reference: invRef,
                currency: inv.CurrencyCode || inv.currency || 'GBP',
                debit: Math.round(debit * 100) / 100,
                credit: Math.round(credit * 100) / 100,
                gross: lineGross,
                tax: lineTax,
                amount: Math.round((credit || debit) * 100) / 100,
                lineItems: [rowLineItem],
                rawInvoice: {
                  id: inv.InvoiceID || inv.external_id || inv.id,
                  number: invRef,
                  reference: inv.Reference || inv.invoice_number,
                  customer: cName || resolvedAccountName,
                  contactName: cName || resolvedAccountName,
                  date: formattedDate,
                  dueDate: formattedDueDate,
                  paymentDate: formatPaymentDate(inv, formattedDate),
                  fullyPaidOnDate: formatPaymentDate(inv, formattedDate),
                  desc: lineDesc,
                  amount: invTotal || lineAmt,
                  subTotal: inv.SubTotal !== undefined ? parseFloat(inv.SubTotal) : (inv.sub_total !== undefined ? parseFloat(inv.sub_total) : Math.round(((invTotal || lineAmt) / 1.2) * 100) / 100),
                  totalTax: inv.TotalTax !== undefined ? parseFloat(inv.TotalTax) : (inv.total_tax !== undefined ? parseFloat(inv.total_tax) : Math.round(((invTotal || lineAmt) - ((invTotal || lineAmt) / 1.2)) * 100) / 100),
                  amountPaid: invPaid,
                  amountDue: invDue,
                  status: inv.Status || 'Authorised',
                  brandingTheme: resolveBrandingTheme(inv),
                  BrandingThemeID: inv.BrandingThemeID || inv.branding_theme_id,
                  lineItems: formattedAllLineItems.length > 0 ? formattedAllLineItems : [rowLineItem]
                }
              });
            }
          });
        } else {
          const invAccCode = (inv.AccountCode || inv.account_code || '').toString();
          const invAccId = (inv.AccountID || inv.account_id || '').toString();
          const targetAccId = matchedAccount ? (matchedAccount.AccountID || matchedAccount.account_id || matchedAccount.external_id || '').toString() : '';

          const matchesInvoice = (invAccCode && invAccCode === targetAccCode) || (targetAccId && invAccId === targetAccId);

          if (matchesInvoice) {
            const rawSubTotal = inv.SubTotal !== undefined ? parseFloat(inv.SubTotal) : (inv.sub_total !== undefined ? parseFloat(inv.sub_total) : null);
            const rawTotal = parseFloat(inv.Total || inv.total || 0);
            const rawTax = inv.TotalTax !== undefined ? parseFloat(inv.TotalTax) : (inv.total_tax !== undefined ? parseFloat(inv.total_tax) : 0);
            const amt = rawSubTotal !== null ? rawSubTotal : (rawTotal > rawTax ? rawTotal - rawTax : rawTotal);
            const debit = isACCREC ? 0 : amt;
            const credit = isACCREC ? amt : 0;

            const invPaid = inv.AmountPaid !== undefined ? parseFloat(inv.AmountPaid) : (inv.amount_paid !== undefined ? parseFloat(inv.amount_paid) : (inv.Status === 'PAID' ? rawTotal : 0));
            const invDue = inv.AmountDue !== undefined ? parseFloat(inv.AmountDue) : (inv.amount_due !== undefined ? parseFloat(inv.amount_due) : (inv.Status === 'PAID' ? 0 : rawTotal));
            const invRef = inv.InvoiceNumber || inv.invoice_number || inv.Reference || `INV-${i + 1}`;
            const invDesc = inv.Reference ? `${cName || resolvedAccountName} - ${inv.Reference}` : `${cName || resolvedAccountName} - ${resolvedAccountName}`;

            const invGross = rawTotal > 0 ? rawTotal : Math.round((amt + rawTax) * 100) / 100;
            const invTax = rawTax;

            rawTransactionsList.push({
              id: `pg-inv-${inv.InvoiceID || inv.external_id || inv.id || i + 1}`,
              rawDate: isNaN(dTime) ? 0 : dTime,
              date: formattedDate,
              source: isACCREC ? 'Receivable Invoice' : 'Payable Invoice',
              description: invDesc,
              reference: invRef,
              currency: inv.CurrencyCode || inv.currency || 'GBP',
              debit: Math.round(debit * 100) / 100,
              credit: Math.round(credit * 100) / 100,
              gross: Math.round(invGross * 100) / 100,
              tax: Math.round(invTax * 100) / 100,
              amount: Math.round(amt * 100) / 100,
              lineItems: [
                {
                  desc: invDesc,
                  account: `${targetAccCode} - ${resolvedAccountName}`,
                  taxRate: (rawTax > 0) ? 'Tax Applied' : 'Zero Rated',
                  amountGbp: amt
                }
              ],
              rawInvoice: {
                id: inv.InvoiceID || inv.external_id || inv.id,
                number: invRef,
                reference: inv.Reference || inv.invoice_number,
                customer: cName || resolvedAccountName,
                contactName: cName || resolvedAccountName,
                date: formattedDate,
                dueDate: formattedDueDate,
                paymentDate: formatPaymentDate(inv, formattedDate),
                fullyPaidOnDate: formatPaymentDate(inv, formattedDate),
                desc: invDesc,
                amount: rawTotal || amt,
                subTotal: amt,
                totalTax: rawTax,
                amountPaid: invPaid,
                amountDue: invDue,
                status: inv.Status || 'Authorised',
                brandingTheme: resolveBrandingTheme(inv),
                BrandingThemeID: inv.BrandingThemeID || inv.branding_theme_id,
                lineItems: [
                  {
                    desc: invDesc,
                    account: `${targetAccCode} - ${resolvedAccountName}`,
                    taxRate: (rawTax > 0) ? 'Tax Applied' : 'Zero Rated',
                    amountGbp: amt
                  }
                ]
              }
            });
          }
        }
      });
    }

    // B. Parse Direct Bank Transactions (Receive Money & Spend Money)
    if (cachedBankTxns && cachedBankTxns.length > 0) {
      cachedBankTxns.forEach((bt: any, bIdx: number) => {
        const status = (bt.Status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') return;

        const rawDate = bt.Date || bt.DateString;
        const dTime = parseToUtcTimestamp(rawDate);
        if (dTime === 0 || dTime < startTs || dTime > endTs) return;
        const dObj = new Date(dTime);

        const cName = (bt.Contact?.Name || '').trim();
        const ref = (bt.Reference || '').trim();
        const lowC = cName.toLowerCase();
        const lowR = ref.toLowerCase();

        let matchedBank = false;
        const lis = bt.LineItems || [];
        lis.forEach((li: any) => {
          const lineAccCode = (li.AccountCode || li.account_code || '').toString();
          const lineAccId = (li.AccountID || li.account_id || '').toString();
          const targetAccId = matchedAccount ? (matchedAccount.AccountID || matchedAccount.account_id || matchedAccount.external_id || '').toString() : '';

          if ((lineAccCode && lineAccCode === targetAccCode) || (targetAccId && lineAccId === targetAccId)) {
            matchedBank = true;
          }
        });

        if (matchedBank) {
          const isSpend = (bt.Type || '').toUpperCase() === 'SPEND';
          const gross = Math.abs(parseFloat(bt.Total || 0));
          const tax = Math.abs(parseFloat(bt.TotalTax || 0));
          const net = Math.round((tax > 0 ? gross - tax : gross) * 100) / 100;

          const debit = isSpend ? net : 0;
          const credit = isSpend ? 0 : net;

          const formattedDate = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
          const desc = cName || resolvedAccountName;
          const bankRef = ref || (isSpend ? 'INV-001' : 'Receive Money');

          rawTransactionsList.push({
            id: `pg-bank-${bt.BankTransactionID || bIdx + 1}`,
            rawDate: dTime,
            date: formattedDate,
            source: isSpend ? 'Spend Money' : 'Receive Money',
            description: desc,
            reference: bankRef,
            currency: bt.CurrencyCode || 'GBP',
            debit: Math.round(debit * 100) / 100,
            credit: Math.round(credit * 100) / 100,
            gross: Math.round(gross * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            amount: Math.round((credit || debit) * 100) / 100,
            lineItems: [
              {
                desc: desc,
                account: `${targetAccCode} - ${resolvedAccountName}`,
                taxRate: tax > 0 ? 'Tax Applied' : 'Zero Rated',
                amountGbp: net
              }
            ],
            rawInvoice: {
              id: bt.BankTransactionID || `bank-${bIdx + 1}`,
              number: bankRef,
              reference: bankRef,
              customer: cName || resolvedAccountName,
              contactName: cName || resolvedAccountName,
              date: formattedDate,
              dueDate: formattedDate,
              paymentDate: formattedDate,
              fullyPaidOnDate: formattedDate,
              desc: desc,
              amount: gross,
              subTotal: net,
              totalTax: tax,
              amountPaid: gross,
              amountDue: 0,
              status: 'Reconciled',
              lineItems: [
                {
                  desc: desc,
                  account: `${targetAccCode} - ${resolvedAccountName}`,
                  taxRate: tax > 0 ? 'Tax Applied' : 'Zero Rated',
                  amountGbp: net
                }
              ]
            }
          });
        }
      });
    }

    // Process Manual Journals for target account
    if (Array.isArray(cachedManualJournals) && cachedManualJournals.length > 0) {
      cachedManualJournals.forEach((mj: any, mjIdx: number) => {
        if (mj.Status && mj.Status.toUpperCase() !== 'POSTED') return;
        const rawDate = parseToUtcTimestamp(mj.Date || mj.DateUTC || mj.UpdatedDateUTC);
        if (!rawDate || rawDate < startTs || rawDate > endTs) return;

        (mj.JournalLines || []).forEach((line: any, lineIdx: number) => {
          const lineAccCode = (line.AccountCode || '').toString();
          if (lineAccCode === targetAccCode) {
            const lineAmt = parseFloat(line.LineAmount !== undefined ? line.LineAmount : 0);
            if (lineAmt === 0) return;

            const isDebit = lineAmt > 0;
            const absVal = Math.round(Math.abs(lineAmt) * 100) / 100;
            const debit = isDebit ? absVal : 0;
            const credit = isDebit ? 0 : absVal;

            const dObj = new Date(rawDate);
            const formattedDate = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

            let desc = line.Description || mj.Narration || 'Manual Journal';
            if (mj.Narration && desc !== mj.Narration && !desc.startsWith(mj.Narration)) {
              desc = `${mj.Narration} - ${desc}`;
            }

            const refStr = mj.JournalNumber ? `#${mj.JournalNumber}` : (mj.ManualJournalID ? `#${mj.ManualJournalID.slice(0, 5)}` : 'Manual Journal');
            const lineTax = Math.abs(parseFloat(line.TaxAmount || line.tax_amount || 0));
            const lineGross = Math.round((absVal + lineTax) * 100) / 100;

            rawTransactionsList.push({
              id: `pg-mj-${mj.ManualJournalID || mjIdx}-${lineIdx}`,
              rawDate,
              date: formattedDate,
              source: 'Manual Journal',
              description: desc,
              reference: refStr,
              currency: 'GBP',
              debit,
              credit,
              gross: lineGross,
              tax: lineTax,
              amount: absVal,
              lineItems: [
                {
                  desc: desc,
                  account: `${targetAccCode} - ${resolvedAccountName}`,
                  taxRate: lineTax > 0 ? 'Tax Applied' : 'No VAT',
                  amountGbp: absVal
                }
              ],
              rawInvoice: {
                id: mj.ManualJournalID || `mj-${mjIdx}`,
                number: refStr,
                reference: refStr,
                customer: resolvedAccountName,
                contactName: resolvedAccountName,
                date: formattedDate,
                dueDate: formattedDate,
                paymentDate: formattedDate,
                desc: desc,
                amount: absVal,
                subTotal: absVal,
                totalTax: lineTax,
                amountPaid: absVal,
                amountDue: 0,
                status: 'Posted',
                lineItems: [
                  {
                    desc: desc,
                    account: `${targetAccCode} - ${resolvedAccountName}`,
                    taxRate: lineTax > 0 ? 'Tax Applied' : 'No VAT',
                    amountGbp: absVal
                  }
                ]
              }
            });
          }
        });
      });
    }

    // Sort chronologically by timestamp
    rawTransactionsList.sort((a, b) => a.rawDate - b.rawDate);

    // Compute running balance
    let runningBal = 0;
    let totDebit = 0;
    let totCredit = 0;

    const transactions: LedgerTransaction[] = rawTransactionsList.map(t => {
      totDebit += t.debit;
      totCredit += t.credit;
      runningBal = isExpenseAccount 
        ? Math.round((runningBal + t.debit - t.credit) * 100) / 100
        : Math.round((runningBal + t.credit - t.debit) * 100) / 100;
      return {
        id: t.id,
        date: t.date,
        source: t.source,
        description: t.description,
        reference: t.reference,
        invoiceNumber: t.invoiceNumber || t.rawInvoice?.number || t.rawInvoice?.InvoiceNumber || t.reference,
        invoiceId: t.invoiceId || t.rawInvoice?.id || t.rawInvoice?.InvoiceID || '',
        currency: t.currency,
        debit: t.debit,
        credit: t.credit,
        gross: t.gross,
        tax: t.tax,
        amount: t.amount,
        runningBalance: Math.round(runningBal * 100) / 100,
        lineItems: t.lineItems,
        rawInvoice: t.rawInvoice
      };
    });

    if (transactions.length > 0) {
      return {
        accountName: resolvedAccountName,
        accountCode: targetAccCode,
        sourceAccountId,
        fromDate: fromDateStr,
        toDate: toDateStr,
        totalValue: isExpenseAccount
          ? Math.round((totDebit - totCredit) * 100) / 100
          : Math.round((totCredit - totDebit) * 100) / 100,
        totalDebit: Math.round(totDebit * 100) / 100,
        totalCredit: Math.round(totCredit * 100) / 100,
        transactionCount: transactions.length,
        transactions,
        dataCoverage: 'DATA_COMPLETE'
      };
    }
  } catch (err) {
    console.error("Error reading PostgreSQL invoices in dynamic ledger-engine:", err);
  }

  // If local DB line-item queries returned 0 transactions, invoke XeroAccountTransactionsService
  try {
    const xeroServiceResult = await XeroAccountTransactionsService.fetchAccountTransactions(
      tenantId,
      sourceAccountId,
      targetAccCode,
      resolvedAccountName,
      cleanFrom,
      cleanTo,
      targetValue
    );

    if (xeroServiceResult && xeroServiceResult.transactions && xeroServiceResult.transactions.length > 0) {
      let runningBal = 0;
      let totDebit = 0;
      let totCredit = 0;

      const transactions: LedgerTransaction[] = xeroServiceResult.transactions.map((t, idx) => {
        totDebit += t.debit;
        totCredit += t.credit;
        runningBal = isExpenseAccount 
          ? Math.round((runningBal + t.debit - t.credit) * 100) / 100
          : Math.round((runningBal + t.credit - t.debit) * 100) / 100;

        return {
          id: t.sourceTransactionId || `xero-acc-txn-${idx + 1}`,
          date: t.date,
          source: t.transactionType || 'Account Transaction',
          description: t.description || t.accountName,
          reference: t.reference || '',
          currency: t.currency || 'GBP',
          debit: t.debit,
          credit: t.credit,
          gross: t.gross,
          tax: t.tax,
          amount: Math.round((t.credit || t.debit) * 100) / 100,
          runningBalance: Math.round(t.runningBalance !== undefined && !isNaN(t.runningBalance) && t.runningBalance !== 0 ? t.runningBalance : runningBal * 100) / 100,
          lineItems: [
            {
              desc: t.description,
              account: `${t.accountCode || targetAccCode} - ${t.accountName || resolvedAccountName}`,
              taxRate: (t.tax && t.tax > 0) ? 'Tax Applied' : 'Zero Rated',
              amountGbp: t.gross || (t.credit || t.debit)
            }
          ]
        };
      });

      return {
        accountName: resolvedAccountName || accountName,
        accountCode: targetAccCode || '400',
        sourceAccountId: xeroServiceResult.sourceAccountId || sourceAccountId,
        fromDate: fromDateStr,
        toDate: toDateStr,
        totalValue: xeroServiceResult.closingBalance || (isExpenseAccount ? Math.round((totDebit - totCredit) * 100) / 100 : Math.round((totCredit - totDebit) * 100) / 100),
        totalDebit: Math.round(totDebit * 100) / 100,
        totalCredit: Math.round(totCredit * 100) / 100,
        transactionCount: transactions.length,
        transactions,
        dataCoverage: 'DATA_COMPLETE'
      };
    }
  } catch (serviceErr: any) {
    console.error('Error in XeroAccountTransactionsService fallback:', serviceErr.message);
  }

  const isPartial = Math.abs(targetValue) > 0;

  return {
    accountName: resolvedAccountName || accountName,
    accountCode: targetAccCode || '400',
    sourceAccountId,
    fromDate: fromDateStr,
    toDate: toDateStr,
    totalValue: targetValue || 0,
    totalDebit: 0,
    totalCredit: 0,
    transactionCount: 0,
    transactions: [],
    dataCoverage: isPartial ? 'DATA_PARTIAL' : 'DATA_COMPLETE',
    warning: isPartial
      ? 'Account balance is available from the authoritative Xero report, but detailed source transactions are not available for this account and period.'
      : undefined
  };
}
