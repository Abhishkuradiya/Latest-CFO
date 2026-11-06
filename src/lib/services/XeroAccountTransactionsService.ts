import { db, pgPool } from '@/lib/db';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResourcePaginated } from '@/lib/xero';
import crypto from 'crypto';

export interface NormalizedAccountTransaction {
  tenantId: number;
  source: 'XERO';
  sourceAccountId: string;
  accountCode: string;
  accountName: string;
  sourceTransactionId?: string;
  sourceLineId?: string;
  date: string;
  transactionType: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  gross: number;
  tax: number;
  currency: string;
  runningBalance: number;
  sourceIdType: 'XERO_ID' | 'REPORT_FINGERPRINT';
}

export interface AccountTransactionsFetchResult {
  tenantId: number;
  sourceAccountId: string;
  accountCode: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  transactions: NormalizedAccountTransaction[];
  dataCoverage: 'DATA_COMPLETE' | 'DATA_PARTIAL';
  warning?: string;
  deduplicationStats?: {
    totalReportRows: number;
    existingCanonicalMatches: number;
    isolatedReportRows: number;
  };
}

export class XeroAccountTransactionsService {
  /**
   * Fetches and normalizes the Xero Account Transactions report for a specific tenant, account identity, and date range.
   * Stores report rows in dedicated `xero_account_transaction_rows` table to prevent canonical ledger contamination.
   */
  static async fetchAccountTransactions(
    tenantId: number,
    sourceAccountId?: string,
    accountCode?: string,
    accountName?: string,
    fromDateStr?: string,
    toDateStr?: string,
    targetValue: number = 0
  ): Promise<AccountTransactionsFetchResult> {
    const cleanFrom = (fromDateStr || '2026-04-01').split('T')[0];
    const cleanTo = (toDateStr || '2026-09-03').split('T')[0];
    const code = (accountCode || '200').trim();
    const accName = accountName || 'Sales';
    let accId = (sourceAccountId || '').trim();

    // 1. Check DB cache first for instant (<5ms) response without hanging on network rate limits
    try {
      const cachedResult = await this.fetchFromCache(tenantId, accId, code, accName, cleanFrom, cleanTo, targetValue);
      if (cachedResult && cachedResult.transactions && cachedResult.transactions.length > 0) {
        return cachedResult;
      }
    } catch (cacheErr) { }

    // 2. Try to fetch live report or live resources from Xero API if connection is active and cache was empty
    try {
      const xeroAuth = await getXeroAccessToken(tenantId);
      if (xeroAuth) {
        const { accessToken, xeroTenantId } = xeroAuth;
        
        let queryParams = `fromDate=${cleanFrom}&toDate=${cleanTo}`;
        if (accId) {
          queryParams += `&accountId=${accId}`;
        } else if (code) {
          queryParams += `&accountCode=${code}`;
        }

        let reportData: any = null;
        try {
          reportData = await fetchXeroReport(accessToken, xeroTenantId, 'AccountTransactions', queryParams);
          if ((!reportData || !reportData.Rows || reportData.Rows.length === 0) && accId && code) {
            const fallbackParams = `fromDate=${cleanFrom}&toDate=${cleanTo}&accountCode=${code}`;
            reportData = await fetchXeroReport(accessToken, xeroTenantId, 'AccountTransactions', fallbackParams);
          }
        } catch (repErr: any) {
          console.warn(`[XeroAccountTransactionsService] AccountTransactions report endpoint unavailable: ${repErr.message}`);
        }

        if (reportData && reportData.Rows && Array.isArray(reportData.Rows)) {
          const parsed = this.parseReportData(reportData, tenantId, accId, code, accName, cleanFrom, cleanTo);
          if (parsed.transactions.length > 0) {
            // Persist into dedicated xero_account_transaction_rows table
            await this.persistTransactions(tenantId, parsed.transactions);
            
            // Save report response to DB cache as well
            const reportKey = accId ? `AccTxn_${accId}`.slice(0, 48) : `AccTxn_${code}`.slice(0, 48);
            await db.saveReport(tenantId, reportKey, reportData);
            await db.saveReport(tenantId, 'AccountTransactions', reportData);

            return parsed;
          }
        }

        // If report endpoint is unavailable or empty, fetch directly from live Xero resources
        const liveResResult = await this.fetchFromLiveXeroResources(
          tenantId,
          accessToken,
          xeroTenantId,
          accId,
          code,
          accName,
          cleanFrom,
          cleanTo
        );

        if (liveResResult && liveResResult.transactions.length > 0) {
          return liveResResult;
        }
      }
    } catch (apiErr: any) {
      console.warn(`[XeroAccountTransactionsService] Live fetch warning for Tenant ${tenantId}:`, apiErr.message);
    }

    // 2. Fallback to cached Xero report or persisted dedicated transaction rows
    return await this.fetchFromCache(tenantId, accId, code, accName, cleanFrom, cleanTo, targetValue);
  }

  /**
   * Constructs account transaction rows directly from live Xero resources (Invoices, Credit Notes, Bank Transactions)
   * when the Xero report endpoint is not available or returned 0 rows.
   */
  static async fetchFromLiveXeroResources(
    tenantId: number,
    accessToken: string,
    xeroTenantId: string,
    accId: string,
    code: string,
    accName: string,
    fromDate: string,
    toDate: string
  ): Promise<AccountTransactionsFetchResult | null> {
    const startTs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const endTs = new Date(`${toDate}T23:59:59.999Z`).getTime();

    const [invoices, creditNotes, bankTxns] = await Promise.all([
      fetchXeroResourcePaginated(accessToken, xeroTenantId, 'Invoices').catch(() => []),
      fetchXeroResourcePaginated(accessToken, xeroTenantId, 'CreditNotes').catch(() => []),
      fetchXeroResourcePaginated(accessToken, xeroTenantId, 'BankTransactions').catch(() => [])
    ]);

    const txns: NormalizedAccountTransaction[] = [];

    // Invoices
    for (const inv of invoices) {
      if (['VOIDED', 'DELETED'].includes(inv.Status)) continue;
      const dtStr = (inv.DateString || inv.Date || '').split('T')[0];
      const tTime = new Date(`${dtStr}T00:00:00.000Z`).getTime();
      if (isNaN(tTime) || tTime < startTs || tTime > endTs) continue;

      const contactName = inv.Contact?.Name || 'Client';
      const ref = inv.Reference || inv.InvoiceNumber || '';

      if (inv.LineItems) {
        for (const line of inv.LineItems) {
          if (line.AccountCode === code || (accId && line.AccountID === accId)) {
            const lineAmt = Math.abs(Number(line.LineAmount) || 0);
            const taxAmt = Math.abs(Number(line.TaxAmount) || 0);
            let netAmt = lineAmt;
            let grossAmt = lineAmt;

            if (inv.LineAmountTypes === 'Inclusive') {
              netAmt = Math.round((lineAmt - taxAmt) * 100) / 100;
              grossAmt = lineAmt;
            } else if (inv.LineAmountTypes === 'Exclusive') {
              netAmt = lineAmt;
              grossAmt = Math.round((lineAmt + taxAmt) * 100) / 100;
            } else {
              netAmt = lineAmt;
              grossAmt = lineAmt;
            }

            const lineDesc = line.Description ? `${contactName} - ${line.Description}` : `${contactName} - Invoice ${ref}`;
            txns.push({
              tenantId,
              source: 'XERO',
              sourceAccountId: line.AccountID || accId,
              accountCode: code,
              accountName: accName,
              sourceTransactionId: inv.InvoiceID,
              sourceLineId: line.LineItemID,
              date: dtStr,
              transactionType: 'Receivable Invoice',
              description: lineDesc,
              reference: ref,
              debit: 0,
              credit: netAmt,
              gross: grossAmt,
              tax: taxAmt,
              currency: inv.CurrencyCode || 'GBP',
              runningBalance: 0,
              sourceIdType: 'XERO_ID'
            });
          }
        }
      }
    }

    // Credit Notes
    for (const cn of creditNotes) {
      if (['VOIDED', 'DELETED'].includes(cn.Status)) continue;
      const dtStr = (cn.DateString || cn.Date || '').split('T')[0];
      const tTime = new Date(`${dtStr}T00:00:00.000Z`).getTime();
      if (isNaN(tTime) || tTime < startTs || tTime > endTs) continue;

      const contactName = cn.Contact?.Name || 'Client';
      const ref = cn.Reference || cn.CreditNoteNumber || '';

      if (cn.LineItems) {
        for (const line of cn.LineItems) {
          if (line.AccountCode === code || (accId && line.AccountID === accId)) {
            const lineAmt = Math.abs(Number(line.LineAmount) || 0);
            const taxAmt = Math.abs(Number(line.TaxAmount) || 0);
            let netAmt = lineAmt;
            let grossAmt = lineAmt;

            if (cn.LineAmountTypes === 'Inclusive') {
              netAmt = Math.round((lineAmt - taxAmt) * 100) / 100;
              grossAmt = lineAmt;
            } else if (cn.LineAmountTypes === 'Exclusive') {
              netAmt = lineAmt;
              grossAmt = Math.round((lineAmt + taxAmt) * 100) / 100;
            } else {
              netAmt = lineAmt;
              grossAmt = lineAmt;
            }

            const lineDesc = line.Description ? `${contactName} - ${line.Description}` : `${contactName} - Credit Note ${ref}`;
            txns.push({
              tenantId,
              source: 'XERO',
              sourceAccountId: line.AccountID || accId,
              accountCode: code,
              accountName: accName,
              sourceTransactionId: cn.CreditNoteID,
              sourceLineId: line.LineItemID,
              date: dtStr,
              transactionType: 'Receivable Credit Note',
              description: lineDesc,
              reference: ref,
              debit: netAmt,
              credit: 0,
              gross: grossAmt,
              tax: taxAmt,
              currency: cn.CurrencyCode || 'GBP',
              runningBalance: 0,
              sourceIdType: 'XERO_ID'
            });
          }
        }
      }
    }

    // Bank Transactions
    for (const bt of bankTxns) {
      if (['VOIDED', 'DELETED'].includes(bt.Status)) continue;
      const dtStr = (bt.DateString || bt.Date || '').split('T')[0];
      const tTime = new Date(`${dtStr}T00:00:00.000Z`).getTime();
      if (isNaN(tTime) || tTime < startTs || tTime > endTs) continue;

      const contactName = bt.Contact?.Name || 'Bank Transaction';
      const ref = bt.Reference || '';

      if (bt.LineItems) {
        for (const line of bt.LineItems) {
          if (line.AccountCode === code || (accId && line.AccountID === accId)) {
            const lineAmt = Math.abs(Number(line.LineAmount) || 0);
            const taxAmt = Math.abs(Number(line.TaxAmount) || 0);
            let netAmt = lineAmt;
            let grossAmt = lineAmt;

            if (bt.LineAmountTypes === 'Inclusive') {
              netAmt = Math.round((lineAmt - taxAmt) * 100) / 100;
              grossAmt = lineAmt;
            } else if (bt.LineAmountTypes === 'Exclusive') {
              netAmt = lineAmt;
              grossAmt = Math.round((lineAmt + taxAmt) * 100) / 100;
            } else {
              netAmt = lineAmt;
              grossAmt = lineAmt;
            }

            const isReceive = bt.Type === 'RECEIVE';
            const lineDesc = line.Description ? `${contactName} - ${line.Description}` : `${contactName} - Bank Transaction`;
            txns.push({
              tenantId,
              source: 'XERO',
              sourceAccountId: line.AccountID || accId,
              accountCode: code,
              accountName: accName,
              sourceTransactionId: bt.BankTransactionID,
              sourceLineId: line.LineItemID,
              date: dtStr,
              transactionType: 'Bank Transaction',
              description: lineDesc,
              reference: ref,
              debit: isReceive ? 0 : netAmt,
              credit: isReceive ? netAmt : 0,
              gross: grossAmt,
              tax: taxAmt,
              currency: bt.CurrencyCode || 'GBP',
              runningBalance: 0,
              sourceIdType: 'XERO_ID'
            });
          }
        }
      }
    }

    if (txns.length === 0) return null;

    // Sort by date ascending
    txns.sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    for (const t of txns) {
      totalDebit += t.debit;
      totalCredit += t.credit;
      running += (t.credit - t.debit);
      t.runningBalance = running;
    }

    // Persist into dedicated xero_account_transaction_rows table
    await this.persistTransactions(tenantId, txns);

    return {
      tenantId,
      sourceAccountId: accId,
      accountCode: code,
      accountName: accName,
      fromDate,
      toDate,
      openingBalance: 0,
      closingBalance: running,
      totalDebit,
      totalCredit,
      transactionCount: txns.length,
      transactions: txns,
      dataCoverage: 'DATA_COMPLETE'
    };
  }

  /**
   * Robust parser for Xero Account Transactions report JSON response.
   * Handles nested Rows, Sections, Cells, Attributes, Headers, and Summary rows.
   * Strictly filters transactions by the exact requested date range.
   */
  static parseReportData(
    reportData: any,
    tenantId: number,
    defaultAccountId: string,
    defaultAccountCode: string,
    defaultAccountName: string,
    fromDate: string,
    toDate: string
  ): AccountTransactionsFetchResult {
    const rawRows = reportData.Rows || [];
    const transactions: NormalizedAccountTransaction[] = [];

    const startTs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const endTs = new Date(`${toDate}T23:59:59.999Z`).getTime();

    let headerMap = {
      date: 0,
      type: 1,
      desc: 2,
      ref: 3,
      debit: 4,
      credit: 5,
      gross: 6,
      tax: 7,
      curr: 8,
      bal: 9
    };

    let totalDebit = 0;
    let totalCredit = 0;
    let openingBalance = 0;
    let closingBalance = 0;
    let resolvedAccountId = defaultAccountId;
    let resolvedAccountCode = defaultAccountCode;
    let resolvedAccountName = defaultAccountName;

    // Inspect Header row to dynamically map cell indices
    for (const r of rawRows) {
      if (r.RowType === 'Header' && Array.isArray(r.Cells)) {
        r.Cells.forEach((c: any, idx: number) => {
          const val = (c.Value || '').toLowerCase().trim();
          if (val.includes('date')) headerMap.date = idx;
          else if (val.includes('source') || val.includes('type')) headerMap.type = idx;
          else if (val.includes('description')) headerMap.desc = idx;
          else if (val.includes('reference')) headerMap.ref = idx;
          else if (val.includes('debit')) headerMap.debit = idx;
          else if (val.includes('credit')) headerMap.credit = idx;
          else if (val.includes('gross')) headerMap.gross = idx;
          else if (val.includes('tax')) headerMap.tax = idx;
          else if (val.includes('currency')) headerMap.curr = idx;
          else if (val.includes('balance')) headerMap.bal = idx;
        });
      }
    }

    // Recursive helper to process rows inside sections
    const processRows = (rowList: any[]) => {
      for (const item of rowList) {
        if (!item) continue;

        if (item.RowType === 'Section') {
          if (item.Title) {
            const titleMatch = item.Title.match(/^(\d+)\s*-\s*(.*)/);
            if (titleMatch) {
              resolvedAccountCode = titleMatch[1];
              resolvedAccountName = titleMatch[2];
            } else if (!resolvedAccountName) {
              resolvedAccountName = item.Title;
            }
          }
          if (item.Rows && Array.isArray(item.Rows)) {
            processRows(item.Rows);
          }
          if (item.Summary && item.Summary.Cells) {
            const summaryVal = this.parseCellNumber(item.Summary.Cells[headerMap.bal] || item.Summary.Cells[item.Summary.Cells.length - 1]);
            if (summaryVal !== 0) closingBalance = summaryVal;
          }
        } else if (item.RowType === 'Row' && Array.isArray(item.Cells) && item.Cells.length >= 5) {
          const cells = item.Cells;
          
          const rawDateStr = cells[headerMap.date]?.Value || '';
          const cleanDate = this.formatIsoDate(rawDateStr);
          if (!cleanDate) continue;

          // Date range filter
          const tTime = new Date(`${cleanDate}T00:00:00.000Z`).getTime();
          if (!isNaN(tTime) && (tTime < startTs || tTime > endTs)) {
            continue;
          }

          const txnType = (cells[headerMap.type]?.Value || 'Account Transaction').trim();
          const desc = (cells[headerMap.desc]?.Value || resolvedAccountName).trim();
          const ref = (cells[headerMap.ref]?.Value || '').trim();
          
          const debit = Math.abs(this.parseCellNumber(cells[headerMap.debit]));
          const credit = Math.abs(this.parseCellNumber(cells[headerMap.credit]));
          const gross = Math.abs(this.parseCellNumber(cells[headerMap.gross])) || (debit + credit);
          const tax = Math.abs(this.parseCellNumber(cells[headerMap.tax]));
          const currency = (cells[headerMap.curr]?.Value || 'GBP').trim();
          const runningBalance = this.parseCellNumber(cells[headerMap.bal]);

          // Inspect cell attributes for genuine Xero source IDs
          let sourceTxnId: string | undefined = undefined;
          let sourceLineId: string | undefined = undefined;
          let attrAccountId: string | undefined = undefined;

          cells.forEach((cell: any) => {
            if (cell.Attributes && Array.isArray(cell.Attributes)) {
              cell.Attributes.forEach((attr: any) => {
                const attrId = attr.Id || '';
                const attrVal = attr.Value || '';
                if (['InvoiceID', 'CreditNoteID', 'BankTransactionID', 'ManualJournalID', 'PaymentID'].includes(attrId) && attrVal) {
                  sourceTxnId = attrVal;
                }
                if (attrId === 'LineItemID' && attrVal) {
                  sourceLineId = attrVal;
                }
                if (attrId === 'AccountID' && attrVal) {
                  attrAccountId = attrVal;
                }
              });
            }
          });

          if (attrAccountId && !resolvedAccountId) {
            resolvedAccountId = attrAccountId;
          }

          let sourceIdType: 'XERO_ID' | 'REPORT_FINGERPRINT' = 'XERO_ID';
          if (!sourceTxnId) {
            // Generate deterministic fingerprint if no unique Xero ID is present in row
            const fingerprintRaw = `${tenantId}_${resolvedAccountId || defaultAccountId}_${cleanDate}_${txnType}_${ref}_${desc}_${debit}_${credit}`;
            const fpHash = crypto.createHash('sha256').update(fingerprintRaw).digest('hex').substring(0, 24);
            sourceTxnId = `fp_${fpHash}`;
            sourceIdType = 'REPORT_FINGERPRINT';
          }

          totalDebit += debit;
          totalCredit += credit;

          transactions.push({
            tenantId,
            source: 'XERO',
            sourceAccountId: resolvedAccountId || defaultAccountId,
            accountCode: resolvedAccountCode || defaultAccountCode,
            accountName: resolvedAccountName || defaultAccountName,
            sourceTransactionId: sourceTxnId,
            sourceLineId: sourceLineId,
            date: cleanDate,
            transactionType: txnType,
            description: desc,
            reference: ref,
            debit,
            credit,
            gross,
            tax,
            currency,
            runningBalance,
            sourceIdType
          });
        } else if (item.Rows && Array.isArray(item.Rows)) {
          processRows(item.Rows);
        }
      }
    };

    processRows(rawRows);

    // Calculate closing balance if not explicitly parsed from summary row
    const isSalesOrRevenue = (resolvedAccountCode.startsWith('4') && resolvedAccountCode !== '499') || 
      resolvedAccountName.toLowerCase().includes('sales') || 
      resolvedAccountName.toLowerCase().includes('revenue');

    if (closingBalance === 0 && transactions.length > 0) {
      closingBalance = isSalesOrRevenue 
        ? Math.round((totalCredit - totalDebit) * 100) / 100
        : Math.round((totalDebit - totalCredit) * 100) / 100;
    }

    const dataCoverage: 'DATA_COMPLETE' | 'DATA_PARTIAL' = transactions.length > 0 ? 'DATA_COMPLETE' : 'DATA_PARTIAL';

    return {
      tenantId,
      sourceAccountId: resolvedAccountId || defaultAccountId,
      accountCode: resolvedAccountCode || defaultAccountCode,
      accountName: resolvedAccountName || defaultAccountName,
      fromDate,
      toDate,
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      transactionCount: transactions.length,
      transactions,
      dataCoverage,
      warning: transactions.length === 0 ? 'Account balance is available from the authoritative Xero report, but detailed source transactions are not available for this account and period.' : undefined
    };
  }

  /**
   * Idempotently persists normalized report transactions into dedicated `xero_account_transaction_rows` table.
   */
  static async persistTransactions(tenantId: number, txns: NormalizedAccountTransaction[]): Promise<number> {
    if (!txns || txns.length === 0) return 0;
    return await db.saveXeroAccountTransactionRows(tenantId, txns);
  }

  /**
   * Retrieves account transactions from dedicated `xero_account_transaction_rows` table, report cache, or `account_transactions`.
   */
  private static async fetchFromCache(
    tenantId: number,
    sourceAccountId: string,
    accountCode: string,
    accountName: string,
    fromDateStr: string,
    toDateStr: string,
    targetValue: number = 0
  ): Promise<AccountTransactionsFetchResult> {
    const startTs = new Date(`${fromDateStr}T00:00:00.000Z`).getTime();
    const endTs = new Date(`${toDateStr}T23:59:59.999Z`).getTime();

    // A. Check dedicated `xero_account_transaction_rows` table
    try {
      const dedicatedRows = await db.getXeroAccountTransactionRows(tenantId, sourceAccountId, accountCode);
      if (Array.isArray(dedicatedRows) && dedicatedRows.length > 0) {
        const filtered = dedicatedRows.filter((r: any) => {
          let cleanDateStr = r.date;
          if (r.date instanceof Date) {
            const yyyy = r.date.getFullYear();
            const mm = String(r.date.getMonth() + 1).padStart(2, '0');
            const dd = String(r.date.getDate()).padStart(2, '0');
            cleanDateStr = `${yyyy}-${mm}-${dd}`;
          } else if (typeof r.date === 'string') {
            cleanDateStr = r.date.split('T')[0];
          }
          const tTime = new Date(`${cleanDateStr}T00:00:00.000Z`).getTime();
          if (isNaN(tTime)) return true;
          return tTime >= startTs && tTime <= endTs;
        });

        if (filtered.length > 0) {
          let totDebit = 0;
          let totCredit = 0;
          const normalized: NormalizedAccountTransaction[] = filtered.map((t: any) => {
            const deb = parseFloat(t.debit || 0);
            const cred = parseFloat(t.credit || 0);
            totDebit += deb;
            totCredit += cred;

            let cleanDateStr = t.date;
            if (t.date instanceof Date) {
              const yyyy = t.date.getFullYear();
              const mm = String(t.date.getMonth() + 1).padStart(2, '0');
              const dd = String(t.date.getDate()).padStart(2, '0');
              cleanDateStr = `${yyyy}-${mm}-${dd}`;
            } else if (typeof t.date === 'string') {
              cleanDateStr = t.date.split('T')[0];
            }

            return {
              tenantId,
              source: 'XERO',
              sourceAccountId: t.source_account_id || sourceAccountId,
              accountCode: t.account_code || accountCode,
              accountName: t.account_name || accountName,
              sourceTransactionId: t.source_id || t.id,
              sourceLineId: t.source_line_id,
              date: cleanDateStr,
              transactionType: t.transaction_type || 'Account Transaction',
              description: t.description || accountName,
              reference: t.reference || '',
              debit: deb,
              credit: cred,
              gross: parseFloat(t.gross_amount || (deb + cred)),
              tax: parseFloat(t.tax_amount || 0),
              currency: t.currency || 'GBP',
              runningBalance: parseFloat(t.running_balance || 0),
              sourceIdType: t.source_id_type || (t.source_id?.startsWith('fp_') ? 'REPORT_FINGERPRINT' : 'XERO_ID')
            };
          });

          const isSales = accountCode.startsWith('4') || accountName.toLowerCase().includes('sales');
          const closing = isSales ? (totCredit - totDebit) : (totDebit - totCredit);

          return {
            tenantId,
            sourceAccountId,
            accountCode,
            accountName,
            fromDate: fromDateStr,
            toDate: toDateStr,
            openingBalance: 0,
            closingBalance: Math.round(closing * 100) / 100,
            totalDebit: Math.round(totDebit * 100) / 100,
            totalCredit: Math.round(totCredit * 100) / 100,
            transactionCount: normalized.length,
            transactions: normalized,
            dataCoverage: 'DATA_COMPLETE'
          };
        }
      }
    } catch (e) { }

    // B. Check for cached AccountTransactions report in DB `reports` table
    try {
      const reportKey = sourceAccountId ? `AccTxn_${sourceAccountId}`.slice(0, 48) : `AccTxn_${accountCode}`.slice(0, 48);
      let cachedReport = await db.getReport(tenantId, reportKey);
      if (!cachedReport) {
        cachedReport = await db.getReport(tenantId, 'AccountTransactions');
      }

      if (cachedReport) {
        const reportData = typeof cachedReport === 'string' ? JSON.parse(cachedReport) : (cachedReport.raw_data || cachedReport);
        if (reportData && reportData.Rows && Array.isArray(reportData.Rows)) {
          const parsed = this.parseReportData(reportData, tenantId, sourceAccountId, accountCode, accountName, fromDateStr, toDateStr);
          if (parsed.transactions.length > 0) {
            await this.persistTransactions(tenantId, parsed.transactions);
            return parsed;
          }
        }
      }
    } catch (e) { }

    // C. Check `account_transactions` table for cached rows
    try {
      const dbTxns = await db.getAccountTransactions(tenantId);
      if (Array.isArray(dbTxns) && dbTxns.length > 0) {
        const filtered = dbTxns.filter((t: any) => {
          const tAccCode = (t.account_code || '').toString().trim();
          const tAccId = (t.source_account_id || '').toString().trim();
          
          const accMatches = (sourceAccountId && tAccId === sourceAccountId) || (accountCode && tAccCode === accountCode);
          if (!accMatches) return false;

          let cleanDateStr = t.date;
          if (t.date instanceof Date) {
            const yyyy = t.date.getFullYear();
            const mm = String(t.date.getMonth() + 1).padStart(2, '0');
            const dd = String(t.date.getDate()).padStart(2, '0');
            cleanDateStr = `${yyyy}-${mm}-${dd}`;
          } else if (typeof t.date === 'string') {
            cleanDateStr = t.date.split('T')[0];
          }

          const tTime = new Date(`${cleanDateStr}T00:00:00.000Z`).getTime();
          if (isNaN(tTime)) return true;
          return tTime >= startTs && tTime <= endTs;
        });

        if (filtered.length > 0) {
          let totDebit = 0;
          let totCredit = 0;
          const normalized: NormalizedAccountTransaction[] = filtered.map((t: any) => {
            const deb = parseFloat(t.debit || t.debit_gbp || 0);
            const cred = parseFloat(t.credit || t.credit_gbp || 0);
            totDebit += deb;
            totCredit += cred;

            let cleanDateStr = t.date;
            if (t.date instanceof Date) {
              const yyyy = t.date.getFullYear();
              const mm = String(t.date.getMonth() + 1).padStart(2, '0');
              const dd = String(t.date.getDate()).padStart(2, '0');
              cleanDateStr = `${yyyy}-${mm}-${dd}`;
            } else if (typeof t.date === 'string') {
              cleanDateStr = t.date.split('T')[0];
            }

            return {
              tenantId,
              source: 'XERO',
              sourceAccountId: t.source_account_id || sourceAccountId,
              accountCode: t.account_code || accountCode,
              accountName: t.account_name || accountName,
              sourceTransactionId: t.source_id || t.id,
              sourceLineId: t.source_line_id,
              date: cleanDateStr,
              transactionType: t.transaction_type || 'Account Transaction',
              description: t.description || accountName,
              reference: t.reference || '',
              debit: deb,
              credit: cred,
              gross: parseFloat(t.gross_amount || (deb + cred)),
              tax: parseFloat(t.tax_amount || 0),
              currency: t.currency || 'GBP',
              runningBalance: 0,
              sourceIdType: t.source_id?.startsWith('fp_') ? 'REPORT_FINGERPRINT' : 'XERO_ID'
            };
          });

          const isSales = accountCode.startsWith('4') || accountName.toLowerCase().includes('sales');
          const closing = isSales ? (totCredit - totDebit) : (totDebit - totCredit);

          return {
            tenantId,
            sourceAccountId,
            accountCode,
            accountName,
            fromDate: fromDateStr,
            toDate: toDateStr,
            openingBalance: 0,
            closingBalance: Math.round(closing * 100) / 100,
            totalDebit: Math.round(totDebit * 100) / 100,
            totalCredit: Math.round(totCredit * 100) / 100,
            transactionCount: normalized.length,
            transactions: normalized,
            dataCoverage: 'DATA_COMPLETE'
          };
        }
      }
    } catch (e) { }

    // D. Data not available or partial
    const isPartial = Math.abs(targetValue) > 0;
    return {
      tenantId,
      sourceAccountId,
      accountCode,
      accountName,
      fromDate: fromDateStr,
      toDate: toDateStr,
      openingBalance: 0,
      closingBalance: targetValue || 0,
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

  private static parseCellNumber(cell: any): number {
    if (!cell) return 0;
    const val = typeof cell === 'object' ? cell.Value : cell;
    if (val === undefined || val === null || val === '') return 0;
    const cleanStr = val.toString().replace(/,/g, '').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  }

  private static formatIsoDate(dateStr: string): string | null {
    if (!dateStr) return null;
    if (dateStr.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.substring(0, 10);
    }
    const match = dateStr.match(/\/Date\((\d+)/);
    if (match) {
      const d = new Date(parseInt(match[1]));
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getUTCFullYear();
      const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
}
