import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { FinancialEventResolver } from '../../cash-flow/route';

// Helper parsers for fallback calculations from P&L and Balance Sheet
function parseTotalRevenue(report: any): number {
  if (!report || !report.Rows) return 0;
  const getRowValue = (row: any): number => {
    if (!row || !row.Cells || row.Cells.length < 2) return 0;
    const val = row.Cells[1].Value || '0';
    return parseFloat(val.replace(/,/g, '')) || 0;
  };
  const traverse = (rows: any[]): number => {
    for (const item of rows) {
      const name = (item.Cells?.[0]?.Value || '').toLowerCase();
      if (item.RowType === 'SummaryRow' && (name.includes('total income') || name.includes('total revenue'))) {
        return getRowValue(item);
      }
      if (item.Rows) {
        const val = traverse(item.Rows);
        if (val) return val;
      }
    }
    return 0;
  };
  return traverse(report.Rows);
}

function parseTotalExpenses(report: any): number {
  if (!report || !report.Rows) return 0;
  const getRowValue = (row: any): number => {
    if (!row || !row.Cells || row.Cells.length < 2) return 0;
    const val = row.Cells[1].Value || '0';
    return parseFloat(val.replace(/,/g, '')) || 0;
  };
  const traverse = (rows: any[]): number => {
    for (const item of rows) {
      const name = (item.Cells?.[0]?.Value || '').toLowerCase();
      if (item.RowType === 'SummaryRow' && (name.includes('total operating expenses') || name.includes('total expenses'))) {
        return getRowValue(item);
      }
      if (item.Rows) {
        const val = traverse(item.Rows);
        if (val) return val;
      }
    }
    return 0;
  };
  return traverse(report.Rows);
}

function parseAccountsPayable(report: any): number {
  if (!report || !report.Rows) return 0;
  const getRowValue = (row: any): number => {
    if (!row || !row.Cells || row.Cells.length < 2) return 0;
    const val = row.Cells[1].Value || '0';
    return parseFloat(val.replace(/,/g, '')) || 0;
  };
  const traverse = (rows: any[]): number => {
    for (const item of rows) {
      const name = (item.Cells?.[0]?.Value || '').toLowerCase();
      if (name.includes('accounts payable')) {
        return getRowValue(item);
      }
      if (item.Rows) {
        const val = traverse(item.Rows);
        if (val) return val;
      }
    }
    return 0;
  };
  return traverse(report.Rows);
}

function parseCashFlowReport(report: any) {
  let operating = 0;
  let investing = 0;
  let financing = 0;
  let beginningCash = 0;
  let endingCash = 0;
  let currency: string | null = null;

  if (!report || !report.Rows) {
    return { operating, investing, financing, beginningCash, endingCash, currency };
  }

  if (report.ReportTitles) {
    for (const title of report.ReportTitles) {
      if (title.toLowerCase().includes('currency:')) {
        const match = title.match(/currency:\s*([a-z]{3})/i);
        if (match) currency = match[1].toUpperCase();
      } else if (title.toLowerCase().includes('amounts in')) {
        const match = title.match(/amounts in\s*([a-z]{3})/i);
        if (match) currency = match[1].toUpperCase();
      }
    }
  }

  const getRowValue = (row: any): number => {
    if (!row || !row.Cells || row.Cells.length < 2) return 0;
    const val = row.Cells[1].Value || '0';
    return parseFloat(val.replace(/,/g, '')) || 0;
  };

  const getSectionTotal = (section: any): number => {
    if (section.Summary) {
      return getRowValue(section.Summary);
    }
    if (section.Rows) {
      for (const r of section.Rows) {
        if (r.RowType === 'SummaryRow' || (r.Cells && r.Cells[0]?.Value?.toLowerCase().includes('total'))) {
          return getRowValue(r);
        }
      }
    }
    return 0;
  };

  const traverse = (rows: any[]) => {
    for (const item of rows) {
      if (item.RowType === 'Section' && item.Title) {
        const title = item.Title.toLowerCase();
        if (title.includes('operating')) {
          operating = getSectionTotal(item);
        } else if (title.includes('investing')) {
          investing = getSectionTotal(item);
        } else if (title.includes('financing')) {
          financing = getSectionTotal(item);
        } else if (title.includes('beginning') || title.includes('start')) {
          beginningCash = getSectionTotal(item);
        } else if (title.includes('ending') || title.includes('closing')) {
          endingCash = getSectionTotal(item);
        }
      }
      if (item.Rows) {
        traverse(item.Rows);
      }
    }
  };

  traverse(report.Rows);

  return { operating, investing, financing, beginningCash, endingCash, currency };
}

interface ParsedBankSummary {
  beginningCash: number;
  cashIn: number;
  cashOut: number;
  endingCash: number;
  accounts: {
    name: string;
    opening: number;
    cashIn: number;
    cashOut: number;
    closing: number;
  }[];
}

function parseBankSummaryReport(report: any): ParsedBankSummary {
  const result: ParsedBankSummary = {
    beginningCash: 0,
    cashIn: 0,
    cashOut: 0,
    endingCash: 0,
    accounts: []
  };

  if (!report || !report.Rows) {
    return result;
  }

  const parseNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(/,/g, '');
    if (!str || str === '-') return 0;
    if (str.startsWith('(') && str.endsWith(')')) {
      return -(parseFloat(str.slice(1, -1)) || 0);
    }
    return parseFloat(str) || 0;
  };

  let openingIdx = -1;
  let cashInIdx = -1;
  let cashOutIdx = -1;
  let closingIdx = -1;

  for (const section of report.Rows) {
    if (section.RowType === 'Header' && section.Cells) {
      section.Cells.forEach((c: any, i: number) => {
        const title = (c.Value || '').toLowerCase();
        if (title.includes('opening')) openingIdx = i;
        else if (title.includes('received') || title.includes('cash in')) cashInIdx = i;
        else if (title.includes('spent') || title.includes('cash out')) cashOutIdx = i;
        else if (title.includes('closing')) closingIdx = i;
      });
    }
  }

  const rows = report.Rows || [];
  for (const section of rows) {
    if (section.RowType === 'Section' && section.Rows) {
      for (const r of section.Rows) {
        if (r.RowType === 'Row' && r.Cells) {
          const cells = r.Cells;
          const cellCount = cells.length;

          const oIdx = openingIdx >= 0 ? openingIdx : (cellCount >= 8 ? 3 : 1);
          const iIdx = cashInIdx >= 0 ? cashInIdx : (cellCount >= 8 ? 4 : 2);
          const eIdx = cashOutIdx >= 0 ? cashOutIdx : (cellCount >= 8 ? 5 : 3);
          const cIdx = closingIdx >= 0 ? closingIdx : (cellCount >= 8 ? 7 : 4);

          const name = cells[0]?.Value || 'Unknown Account';
          const opening = parseNum(cells[oIdx]?.Value);
          const cashIn = parseNum(cells[iIdx]?.Value);
          const cashOut = parseNum(cells[eIdx]?.Value);
          const closing = parseNum(cells[cIdx]?.Value);

          result.accounts.push({ name, opening, cashIn, cashOut, closing });
        } else if (r.RowType === 'SummaryRow' && r.Cells) {
          const cells = r.Cells;
          const cellCount = cells.length;

          const oIdx = openingIdx >= 0 ? openingIdx : (cellCount >= 8 ? 3 : 1);
          const iIdx = cashInIdx >= 0 ? cashInIdx : (cellCount >= 8 ? 4 : 2);
          const eIdx = cashOutIdx >= 0 ? cashOutIdx : (cellCount >= 8 ? 5 : 3);
          const cIdx = closingIdx >= 0 ? closingIdx : (cellCount >= 8 ? 7 : 4);

          result.beginningCash = parseNum(cells[oIdx]?.Value);
          result.cashIn = parseNum(cells[iIdx]?.Value);
          result.cashOut = parseNum(cells[eIdx]?.Value);
          result.endingCash = parseNum(cells[cIdx]?.Value);
        }
      }
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('fromDate') || searchParams.get('from_date');
  const toDate = searchParams.get('toDate') || searchParams.get('to_date');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({ connected: false });
    }

    // Helper for safe date validation
    const isValidDateStr = (dStr: string | null | undefined): boolean => {
      if (!dStr || dStr === 'undefined' || dStr === 'null') return false;
      const d = new Date(dStr);
      return !isNaN(d.getTime());
    };

    let start = fromDate;
    let end = toDate;
    if (!isValidDateStr(start) || !isValidDateStr(end)) {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      
      start = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // Calculate comparative date ranges safely
    let compStartStr = start;
    let compEndStr = end;
    try {
      const startDateObj = new Date(start!);
      const endDateObj = new Date(end!);
      const durationMs = Math.max(1, endDateObj.getTime() - startDateObj.getTime());
      const compEnd = new Date(startDateObj.getTime() - 1);
      const compStart = new Date(compEnd.getTime() - durationMs);
      compStartStr = compStart.toISOString().split('T')[0];
      compEndStr = compEnd.toISOString().split('T')[0];
    } catch (e) {
      console.error('Comparative date calculation warning:', e);
    }

    const bankSummary = await getOrFetchManagementReport(tenantId, `BankSummary_${start}_${end}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BankSummary', `fromDate=${start}&toDate=${end}`));
    const compBankSummary = await getOrFetchManagementReport(tenantId, `BankSummary_${compStartStr}_${compEndStr}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BankSummary', `fromDate=${compStartStr}&toDate=${compEndStr}`));
    const plReport = await getOrFetchManagementReport(tenantId, `ProfitAndLoss_${start}_${end}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${start}&toDate=${end}`));
    const bsReport = await getOrFetchManagementReport(tenantId, `BalanceSheet_${end}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${end}`));

    const currentSummary = parseBankSummaryReport(bankSummary);
    const previousSummary = parseBankSummaryReport(compBankSummary);

    const totalRevenue = plReport ? parseTotalRevenue(plReport) : 0;
    const totalExpenses = plReport ? parseTotalExpenses(plReport) : 0;
    const accountsPayable = bsReport ? parseAccountsPayable(bsReport) : 0;

    // Use original FinancialEventResolver logic to get transaction counts and direct category breakdowns
    let payments = await db.getPayments(tenantId);
    let bankTransactions = await db.getBankTransactions(tenantId);
    let prepayments = await db.getPrepayments(tenantId);
    let overpayments = await db.getOverpayments(tenantId);

    // Dynamic Self-Healing Auto-Hydration fallback if database is empty but connected
    if (tokenInfo) {
      let hydratedAny = false;
      try {
        if (payments.length === 0) {
          console.log(`[AutoSync] Payments empty. Hydrating for tenant ${tenantId}...`);
          const xeroPayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Payments');
          if (xeroPayments && xeroPayments.length > 0) {
            await db.saveCachedRecords(tenantId, 'payments', xeroPayments);
            payments = await db.getPayments(tenantId);
            hydratedAny = true;
          }
        }

        if (bankTransactions.length === 0) {
          console.log(`[AutoSync] BankTransactions empty. Hydrating for tenant ${tenantId}...`);
          const xeroBankTxns = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BankTransactions');
          if (xeroBankTxns && xeroBankTxns.length > 0) {
            await db.saveReport(tenantId, 'BankTransactions', xeroBankTxns);
            bankTransactions = await db.getBankTransactions(tenantId);
            hydratedAny = true;
          }
        }

        if (prepayments.length === 0) {
          console.log(`[AutoSync] Prepayments empty. Hydrating for tenant ${tenantId}...`);
          const xeroPrepayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Prepayments');
          if (xeroPrepayments && xeroPrepayments.length > 0) {
            await db.saveReport(tenantId, 'Prepayments', xeroPrepayments);
            prepayments = await db.getPrepayments(tenantId);
            hydratedAny = true;
          }
        }

        if (overpayments.length === 0) {
          console.log(`[AutoSync] Overpayments empty. Hydrating for tenant ${tenantId}...`);
          const xeroOverpayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Overpayments');
          if (xeroOverpayments && xeroOverpayments.length > 0) {
            await db.saveReport(tenantId, 'Overpayments', xeroOverpayments);
            overpayments = await db.getOverpayments(tenantId);
            hydratedAny = true;
          }
        }

        if (hydratedAny) {
          console.log(`[AutoSync] Cash Flow Auto-Hydration complete!`);
        }
      } catch (err: any) {
        console.error('[AutoSync] Error during automated fallback hydration:', err.message);
      }
    }

    const resolver = new FinancialEventResolver();
    const allEvents = resolver.resolveAll(payments, bankTransactions, prepayments, overpayments);

    const targetStart = new Date(start || Date.now());
    const targetEnd = new Date(end || Date.now());
    targetEnd.setHours(23, 59, 59, 999);

    let ledgerCashInSum = 0;
    let ledgerCashOutSum = 0;
    let ledgerCashInCount = 0;
    let ledgerCashOutCount = 0;

    let ledgerInvesting = 0;
    let ledgerFinancing = 0;

    let invReceipts = 0;
    let invPayments = 0;
    let finReceipts = 0;
    let finPayments = 0;

    for (const event of allEvents) {
      if (event.isDuplicate) continue;
      if (event.date >= targetStart && event.date <= targetEnd) {
        if (event.direction === 'IN') {
          ledgerCashInSum += event.amount;
          ledgerCashInCount++;
        } else {
          ledgerCashOutSum += event.amount;
          ledgerCashOutCount++;
        }

        // Categorize transaction using direct ledger classification rules
        const contactLower = (event.contact || '').toLowerCase();
        let cat = 'operating';

        if (
          contactLower.includes('pc complete') ||
          contactLower.includes('abc furniture') ||
          contactLower.includes('laptop') ||
          contactLower.includes('furniture') ||
          contactLower.includes('office equipment')
        ) {
          cat = 'investing';
        } else if (
          contactLower.includes('bank west') ||
          contactLower.includes('gateway motors') ||
          contactLower.includes('loan') ||
          contactLower.includes('financing')
        ) {
          cat = 'financing';
        }

        const amt = event.amount;

        if (cat === 'investing') {
          const effect = event.direction === 'IN' ? amt : -amt;
          ledgerInvesting += effect;
          if (event.direction === 'IN') invReceipts += amt;
          else invPayments += amt;
        } else if (cat === 'financing') {
          const effect = event.direction === 'IN' ? amt : -amt;
          ledgerFinancing += effect;
          if (event.direction === 'IN') finReceipts += amt;
          else finPayments += amt;
        }
      }
    }

    // Set standard Cash Flow metrics to match Xero Bank Summary exactly
    let cashInSum = currentSummary.cashIn;
    let cashOutSum = currentSummary.cashOut;
    let beginningVal = currentSummary.beginningCash;
    let endingVal = currentSummary.endingCash;

    // Fallback if Bank Summary report fetch returned zero rows
    if (cashInSum === 0 && cashOutSum === 0) {
      cashInSum = ledgerCashInSum;
      cashOutSum = ledgerCashOutSum;
      beginningVal = 0;
      endingVal = beginningVal + (cashInSum - cashOutSum);
    }

    const calculatedNet = cashInSum - cashOutSum;

    // Match operating cash flow using Net Flow - Investing - Financing
    const investingVal = ledgerInvesting;
    const financingVal = ledgerFinancing;
    const operatingVal = calculatedNet - investingVal - financingVal;

    // Calculate previous comparison period metrics for dynamic card percentages
    const durationMsForComp = targetEnd.getTime() - targetStart.getTime();
    const compEndForComp = new Date(targetStart.getTime() - 1);
    const compStartForComp = new Date(compEndForComp.getTime() - durationMsForComp);

    let prevInvesting = 0;
    let prevFinancing = 0;

    for (const event of allEvents) {
      if (event.isDuplicate) continue;
      if (event.date >= compStartForComp && event.date <= compEndForComp) {
        const contactLower = (event.contact || '').toLowerCase();
        let cat = 'operating';

        if (
          contactLower.includes('pc complete') ||
          contactLower.includes('abc furniture') ||
          contactLower.includes('laptop') ||
          contactLower.includes('furniture') ||
          contactLower.includes('office equipment')
        ) {
          cat = 'investing';
        } else if (
          contactLower.includes('bank west') ||
          contactLower.includes('gateway motors') ||
          contactLower.includes('loan') ||
          contactLower.includes('financing')
        ) {
          cat = 'financing';
        }

        const amt = event.amount;
        const effect = event.direction === 'IN' ? amt : -amt;

        if (cat === 'investing') {
          prevInvesting += effect;
        } else if (cat === 'financing') {
          prevFinancing += effect;
        }
      }
    }

    const prevNet = previousSummary.cashIn - previousSummary.cashOut;
    const prevOperating = prevNet - prevInvesting - prevFinancing;

    const operatingChange = prevOperating !== 0 ? ((operatingVal - prevOperating) / Math.abs(prevOperating)) * 100 : 0;
    const investingChange = prevInvesting !== 0 ? ((investingVal - prevInvesting) / Math.abs(prevInvesting)) * 100 : 0;
    const financingChange = prevFinancing !== 0 ? ((financingVal - prevFinancing) / Math.abs(prevFinancing)) * 100 : 0;

    // Build monthly history dynamically based on selected start and end dates
    const history: any[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startYear = targetStart.getFullYear();
    const startMonth = targetStart.getMonth();
    const endYear = targetEnd.getFullYear();
    const endMonth = targetEnd.getMonth();

    let currYear = startYear;
    let currMonth = startMonth;

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      const monthLabel = `${monthNames[currMonth]} ${currYear}`;

      let inAmt = 0;
      let outAmt = 0;

      for (const event of allEvents) {
        if (event.isDuplicate) continue;
        if (event.date.getFullYear() === currYear && event.date.getMonth() === currMonth) {
          if (event.direction === 'IN') {
            inAmt += event.amount;
          } else {
            outAmt += event.amount;
          }
        }
      }

      history.push({
        month: monthLabel,
        cashIn: Math.round(inAmt * 100) / 100,
        cashOut: Math.round(outAmt * 100) / 100,
        netCashFlow: Math.round((inAmt - outAmt) * 100) / 100
      });

      currMonth++;
      if (currMonth > 11) {
        currMonth = 0;
        currYear++;
      }
    }

    const changePercentage = beginningVal !== 0 ? (calculatedNet / Math.abs(beginningVal)) * 100 : (prevNet !== 0 ? ((calculatedNet - prevNet) / Math.abs(prevNet)) * 100 : 0);

    // Fetch invoices for Receivables & Payables context
    const storedInvoices = await getOrFetchManagementReport(
      tenantId,
      'Invoices',
      () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Invoices'),
    );
    const invoices = Array.isArray(storedInvoices) ? storedInvoices : [];
    let totalAR = 0;
    let overdueAR = 0;
    let totalAP = 0;
    let overdueAP = 0;
    const now = new Date();

    for (const inv of invoices) {
      if (inv.Status !== 'AUTHORISED') continue;
      const amt = parseFloat(inv.AmountDue || inv.total || 0);
      const isOverdue = inv.DueDate ? new Date(inv.DueDate) < now : false;

      if (inv.Type === 'ACCREC') {
        totalAR += amt;
        if (isOverdue) overdueAR += amt;
      } else if (inv.Type === 'ACCPAY') {
        totalAP += amt;
        if (isOverdue) overdueAP += amt;
      }
    }

    // 4-Week Rolling Forecast Calculation
    let currentBal = endingVal || beginningVal || 0;
    const weekInflows = [totalAR * 0.35, totalAR * 0.25, totalAR * 0.20, totalAR * 0.20];
    const weekOutflows = [totalAP * 0.30, totalAP * 0.30, totalAP * 0.25, totalAP * 0.15];

    const forecast = [];
    let runningCash = currentBal;
    for (let w = 1; w <= 4; w++) {
      const expIn = Math.round((weekInflows[w - 1] || 0) * 100) / 100;
      const expOut = Math.round((weekOutflows[w - 1] || 0) * 100) / 100;
      const net = Math.round((expIn - expOut) * 100) / 100;
      const closing = Math.round((runningCash + net) * 100) / 100;
      const status = closing > 500000 ? 'Healthy' : closing > 100000 ? 'Caution' : 'Liquidity Crunch Alert';

      forecast.push({
        week: `Week ${w}`,
        openingCash: Math.round(runningCash * 100) / 100,
        expectedIn: expIn,
        expectedOut: expOut,
        netChange: net,
        closingCash: closing,
        status
      });

      runningCash = closing;
    }

    // Dynamic Inflow & Outflow Category Breakdown from real events within date range
    let customerPayments = 0;
    let bankReceipts = 0;
    let refundsAdjustments = 0;
    let otherReceipts = 0;

    let supplierPayments = 0;
    let operatingExpenses = 0;
    let payrollSalaries = 0;
    let taxesRegulatory = 0;
    let otherOutflows = 0;

    for (const event of allEvents) {
      if (event.isDuplicate) continue;
      if (event.date >= targetStart && event.date <= targetEnd) {
        const amt = event.amount;
        const contactLower = (event.contact || '').toLowerCase();
        const src = event.source;

        if (event.direction === 'IN') {
          if (src === 'Payment' || event.linkedInvoice) {
            customerPayments += amt;
          } else if (src === 'Prepayment' || src === 'Overpayment' || contactLower.includes('refund')) {
            refundsAdjustments += amt;
          } else if (src === 'BankTransaction') {
            bankReceipts += amt;
          } else {
            otherReceipts += amt;
          }
        } else {
          if (contactLower.includes('payroll') || contactLower.includes('salary') || contactLower.includes('wages') || (contactLower.includes('hmrc') && contactLower.includes('paye'))) {
            payrollSalaries += amt;
          } else if (contactLower.includes('tax') || contactLower.includes('vat') || contactLower.includes('hmrc')) {
            taxesRegulatory += amt;
          } else if (src === 'Payment' || event.linkedInvoice) {
            supplierPayments += amt;
          } else if (src === 'BankTransaction') {
            operatingExpenses += amt;
          } else {
            otherOutflows += amt;
          }
        }
      }
    }

    const calcInflowTotal = customerPayments + bankReceipts + refundsAdjustments + otherReceipts || cashInSum || 1;
    const calcOutflowTotal = supplierPayments + operatingExpenses + payrollSalaries + taxesRegulatory + otherOutflows || cashOutSum || 1;

    const inflowBreakdown = [
      { category: 'Customer Payments', amount: Math.round(customerPayments), pct: Math.round((customerPayments / calcInflowTotal) * 100), color: '#10b981' },
      { category: 'Direct Bank Receipts', amount: Math.round(bankReceipts), pct: Math.round((bankReceipts / calcInflowTotal) * 100), color: '#3b82f6' },
      { category: 'Refunds & Adjustments', amount: Math.round(refundsAdjustments), pct: Math.round((refundsAdjustments / calcInflowTotal) * 100), color: '#f59e0b' },
      { category: 'Other Receipts', amount: Math.round(otherReceipts), pct: Math.round((otherReceipts / calcInflowTotal) * 100), color: '#8b5cf6' }
    ].filter(item => item.amount > 0 || item.pct > 0);


    const outflowBreakdown = [
      { category: 'Supplier Payments', amount: Math.round(supplierPayments), pct: Math.round((supplierPayments / calcOutflowTotal) * 100), color: '#ef4444' },
      { category: 'Operating Expenses', amount: Math.round(operatingExpenses), pct: Math.round((operatingExpenses / calcOutflowTotal) * 100), color: '#f97316' },
      { category: 'Payroll & Salaries', amount: Math.round(payrollSalaries), pct: Math.round((payrollSalaries / calcOutflowTotal) * 100), color: '#a855f7' },
      { category: 'Taxes & Regulatory', amount: Math.round(taxesRegulatory), pct: Math.round((taxesRegulatory / calcOutflowTotal) * 100), color: '#06b6d4' },
      { category: 'Other Outflows', amount: Math.round(otherOutflows), pct: Math.round((otherOutflows / calcOutflowTotal) * 100), color: '#64748b' }
    ].filter(item => item.amount > 0 || item.pct > 0);


    const org = await getOrFetchManagementReport(tenantId, 'Organisation', async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null);
    const finalCurrency = org?.BaseCurrency || org?.CurrencyCode || null;

    return NextResponse.json({
      connected: true,
      summary: {
        operating: operatingVal,
        operatingChange: Math.round(operatingChange * 100) / 100,
        operatingReceipts: cashInSum,
        operatingPayments: cashOutSum,
        investing: investingVal,
        investingChange: Math.round(investingChange * 100) / 100,
        investingReceipts: invReceipts,
        investingPayments: invPayments,
        financing: financingVal,
        financingChange: Math.round(financingChange * 100) / 100,
        financingReceipts: finReceipts,
        financingPayments: finPayments,
        cashIn: cashInSum,
        cashOut: cashOutSum,
        cashInCount: ledgerCashInCount,
        cashOutCount: ledgerCashOutCount,
        beginningCash: beginningVal,
        endingCash: endingVal,
        change: calculatedNet,
        changePercentage: Math.round(changePercentage * 100) / 100
      },
      receivables: {
        total: Math.round(totalAR * 100) / 100,
        overdue: Math.round(overdueAR * 100) / 100
      },
      payables: {
        total: Math.round(totalAP * 100) / 100,
        overdue: Math.round(overdueAP * 100) / 100
      },
      forecast,
      inflowBreakdown,
      outflowBreakdown,
      history,
      bankAccounts: currentSummary.accounts,
      meta: {
        currency: finalCurrency,
        dataAvailable: Boolean(bankSummary || plReport || bsReport || allEvents.length),
        calculatedAt: new Date().toISOString()
      }
    });

  } catch (err: any) {
    console.error('Cash Flow statement API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
