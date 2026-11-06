import { db } from '@/lib/db';
import { fetchXeroReport, fetchXeroResourcePaginated, getXeroAccessToken } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { ProfitAndLossService } from '@/lib/services/ProfitAndLossService';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';

export type KpiMetric = {
  key: string; label: string; value: number | null; unit: string;
  previous: number | null; change: number | null; status: string;
  formula: string; source: string;
  calculation?: { inputs: { label: string; value: number; unit: 'currency' | 'number' | 'days' }[] } | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const abs = (v: number | null) => v === null ? null : Math.abs(v);
const ratio = (a: number | null, b: number | null): number | null => a !== null && b !== null && Math.abs(b) > 0.000001 ? a / b : null;
const pct = (a: number | null, b: number | null): number | null => { const r = ratio(a, b); return r === null ? null : r * 100; };

function periodDates(period: string, from?: string | null, to?: string | null, fyEndMonth?: number, fyEndDay?: number) {
  const today = new Date();
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
  let start: Date;
  let label: string;
  if (from && to) { start = new Date(`${from}T00:00:00.000Z`); label = 'Custom date range'; }
  else if (period === 'this_month') { start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); label = 'This Month'; }
  else if (period === 'quarter') { const qStart = Math.floor(end.getUTCMonth() / 3) * 3; start = new Date(Date.UTC(end.getUTCFullYear(), qStart, 1)); label = 'This Quarter'; }
  else if (period === 'ytd') {
    const fyMonth = Math.max(1, Math.min(12, fyEndMonth || 1)) - 1;
    const fyDay = Math.max(1, Math.min(31, fyEndDay || 1));
    const candidate = new Date(Date.UTC(end.getUTCFullYear(), fyMonth, fyDay));
    start = candidate <= end ? candidate : new Date(Date.UTC(end.getUTCFullYear() - 1, fyMonth, fyDay));
    label = 'Year to Date';
  } else { start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 1)); label = 'Trailing 12 Months'; }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  return { start, end, previousStart, previousEnd, days, label };
}

async function reportForPeriod(tenantId: number, token: { accessToken: string; xeroTenantId: string } | null, name: string, start: Date, end: Date) {
  const key = name === 'BalanceSheet' ? `BalanceSheet_${iso(end)}` : `${name}_${iso(start)}_${iso(end)}`;
  const cached = await db.getPostgresReport(tenantId, key);
  if (cached !== null) return cached;
  if (!token) return null;
  return getOrFetchManagementReport(tenantId, key, () => fetchXeroReport(token.accessToken, token.xeroTenantId, name, name === 'BalanceSheet' ? `date=${iso(end)}` : `fromDate=${iso(start)}&toDate=${iso(end)}`));
}

function statementValues(pnl: any, bs: any) {
  const p = pnl ? ProfitAndLossService.parseReport(pnl) : null;
  const rows = Array.isArray(bs?.Rows) ? bs.Rows : null;
  const b = rows ? {
    assets: abs(BalanceSheetParser.findTotalAssets(rows)), liabilities: abs(BalanceSheetParser.findTotalLiabilities(rows)), equity: abs(BalanceSheetParser.findTotalEquity(rows)),
    currentAssets: abs(BalanceSheetParser.findCurrentAssets(rows)), currentLiabilities: abs(BalanceSheetParser.findCurrentLiabilities(rows)), cash: abs(BalanceSheetParser.findTotalCash(rows)), ar: abs(BalanceSheetParser.findTotalAR(rows)), ap: abs(BalanceSheetParser.findTotalAP(rows)),
    inventory: abs(BalanceSheetParser.findSummary(rows, 'inventory')), fixedAssets: abs(BalanceSheetParser.findSummary(rows, 'fixed assets')),
    debt: abs(BalanceSheetParser.findSummary(rows, 'loans')) ?? abs(BalanceSheetParser.findSummary(rows, 'borrowings')) ?? abs(BalanceSheetParser.findSummary(rows, 'bank loan'))
  } : null;
  return { p, b };
}

function metric(key: string, label: string, value: number | null, unit: string, previous: number | null, formula: string, source: string): KpiMetric {
  const change = value !== null && previous !== null ? value - previous : null;
  const status = value === null ? 'Unavailable' : change === null ? 'Previous unavailable' : Math.abs(change) < 0.000001 ? 'Stable' : change > 0 ? 'Improved' : 'Declined';
  return { key, label, value, unit, previous, change, status, formula, source };
}

export async function getKpiScorecard(tenantId: number, period: string, from?: string | null, to?: string | null) {
  const token = await getXeroAccessToken(tenantId);
  const org = await db.getPostgresReport(tenantId, 'Organisation').catch(() => null) as any;
  const dates = periodDates(period, from, to, num(org?.FinancialYearEndMonth) ?? undefined, num(org?.FinancialYearEndDay) ?? undefined);
  const [currentPnl, previousPnl, currentBs, openingBs, previousBs, invoicesReport, accountsReport, inventory] = await Promise.all([
    reportForPeriod(tenantId, token, 'ProfitAndLoss', dates.start, dates.end),
    reportForPeriod(tenantId, token, 'ProfitAndLoss', dates.previousStart, dates.previousEnd),
    reportForPeriod(tenantId, token, 'BalanceSheet', dates.start, dates.end),
    reportForPeriod(tenantId, token, 'BalanceSheet', dates.start, dates.start),
    reportForPeriod(tenantId, token, 'BalanceSheet', dates.previousStart, dates.previousEnd),
    db.getPostgresReport(tenantId, 'Invoices').catch(() => null),
    db.getPostgresReport(tenantId, 'Accounts_metadata').catch(() => null),
    db.getInventoryItems(tenantId).catch(() => [])
  ]);
  const current = statementValues(currentPnl, currentBs); const previous = statementValues(previousPnl, previousBs); const opening = statementValues(null, openingBs);
  const invoices = Array.isArray(invoicesReport) ? invoicesReport : [];
  const purchases = invoices.filter(i => String(i.Type || i.type).toUpperCase() === 'ACCPAY' && ['PAID', 'AUTHORISED'].includes(String(i.Status || i.status).toUpperCase()) && i.Date && new Date(i.Date) >= dates.start && new Date(i.Date) <= dates.end).reduce((s, i) => s + (num(i.Total || i.total) || 0), 0);
  const avg = (a: number | null, b: number | null) => a !== null && b !== null ? (a + b) / 2 : a;
  const avgAssets = avg(current.b?.assets ?? null, opening.b?.assets ?? null); const avgEquity = avg(current.b?.equity ?? null, opening.b?.equity ?? null); const avgAr = avg(current.b?.ar ?? null, opening.b?.ar ?? null); const avgAp = avg(current.b?.ap ?? null, opening.b?.ap ?? null); const avgInventory = avg(current.b?.inventory ?? null, opening.b?.inventory ?? null);
  const revenue = current.p?.revenue ?? null; const cogs = current.p?.cogs ?? null; const ebit = current.p?.operatingProfit ?? null; const netProfit = current.p?.netProfit ?? null; const ebitda = current.p?.ebitda ?? null;
  const prevRevenue = previous.p?.revenue ?? null; const days = dates.days;
  const dso = ratio(avgAr, revenue) === null ? null : (avgAr! / revenue!) * days; const dpo = ratio(avgAp, purchases || cogs) === null ? null : (avgAp! / (purchases || cogs)!) * days; const dio = ratio(avgInventory, cogs) === null ? null : (avgInventory! / cogs!) * days;
  const metrics: KpiMetric[] = [
    metric('dso', 'Debtor Days (DSO)', dso, 'days', previous.b?.ar !== null && previous.p?.revenue ? (previous.b!.ar! / previous.p!.revenue!) * days : null, 'Average trade receivables / credit sales × days; DSO (Days Sales Outstanding)', 'Xero Balance Sheet + Profit & Loss'),
    metric('dpo', 'Creditor Days (DPO)', dpo, 'days', previous.b?.ap !== null && previous.p?.cogs ? (previous.b!.ap! / previous.p!.cogs!) * days : null, 'Average trade payables / credit purchases × days; DPO (Days Payable Outstanding)', 'Xero Balance Sheet + ACCPAY invoices'),
    metric('dio', 'Inventory Days (DIO)', dio, 'days', previous.b?.inventory !== null && previous.p?.cogs ? (previous.b!.inventory! / previous.p!.cogs!) * days : null, 'Average inventory / cost of sales × days; DIO (Days Inventory Outstanding)', 'Xero Balance Sheet + Profit & Loss'),
    metric('ccc', 'Cash Conversion Cycle', dso !== null && dio !== null && dpo !== null ? dso + dio - dpo : null, 'days', null, 'CCC (Cash Conversion Cycle) = DSO (Days Sales Outstanding) + DIO (Days Inventory Outstanding) − DPO (Days Payable Outstanding)', 'Derived from working-capital metrics'),
    metric('currentRatio', 'Current Ratio', ratio(current.b?.currentAssets ?? null, current.b?.currentLiabilities ?? null), 'x', ratio(previous.b?.currentAssets ?? null, previous.b?.currentLiabilities ?? null), 'Current assets / current liabilities', 'Xero Balance Sheet'),
    metric('quickRatio', 'Quick Ratio', ratio(current.b?.currentAssets != null && current.b?.inventory != null ? current.b.currentAssets - current.b.inventory : null, current.b?.currentLiabilities ?? null), 'x', ratio(previous.b?.currentAssets != null && previous.b?.inventory != null ? previous.b.currentAssets - previous.b.inventory : null, previous.b?.currentLiabilities ?? null), '(Current assets − inventory) / current liabilities', 'Xero Balance Sheet'),
    metric('interestCoverage', 'Interest Coverage', ratio(ebit, abs(current.p?.interest ?? null)), 'x', ratio(previous.p?.operatingProfit ?? null, abs(previous.p?.interest ?? null)), 'EBIT (Earnings Before Interest and Tax) / interest expense', 'Xero Profit & Loss'),
    metric('debtToEquity', 'Debt-to-Equity', ratio(current.b?.debt ?? null, current.b?.equity ?? null), 'x', ratio(previous.b?.debt ?? null, previous.b?.equity ?? null), 'Interest-bearing debt / shareholders’ equity', 'Xero Balance Sheet debt classifications'),
    metric('netDebt', 'Net Debt', current.b?.debt != null && current.b?.cash != null ? current.b.debt - current.b.cash : null, 'currency', previous.b?.debt != null && previous.b?.cash != null ? previous.b.debt - previous.b.cash : null, 'Interest-bearing debt − cash', 'Xero Balance Sheet'),
    metric('netDebtEbitda', 'Net Debt / EBITDA', current.b?.debt != null && current.b?.cash != null ? ratio(current.b.debt - current.b.cash, ebitda) : null, 'x', null, 'Net debt / EBITDA (Earnings Before Interest, Tax, Depreciation and Amortisation)', 'Xero Balance Sheet + Profit & Loss'),
    metric('equityRatio', 'Equity Ratio', ratio(current.b?.equity ?? null, current.b?.assets ?? null), 'x', ratio(previous.b?.equity ?? null, previous.b?.assets ?? null), 'Shareholders’ equity / total assets', 'Xero Balance Sheet'),
    metric('assetTurnover', 'Asset Turnover', ratio(revenue, avgAssets), 'x', null, 'Revenue / average total assets', 'Xero Profit & Loss + Balance Sheet'),
    metric('fixedAssetTurnover', 'Fixed Asset Turnover', ratio(revenue, avg(current.b?.fixedAssets ?? null, opening.b?.fixedAssets ?? null)), 'x', null, 'Revenue / average fixed assets', 'Xero Profit & Loss + Balance Sheet'),
    metric('opexRatio', 'Operating Expense Ratio', ratio(current.p?.operatingExpenses ?? null, revenue), 'x', ratio(previous.p?.operatingExpenses ?? null, prevRevenue), 'Operating expenses / revenue', 'Xero Profit & Loss'),
    metric('workingCapitalTurnover', 'Working Capital Turnover', ratio(revenue, current.b?.currentAssets != null && current.b?.currentLiabilities != null ? current.b.currentAssets - current.b.currentLiabilities : null), 'x', null, 'Revenue / working capital', 'Xero Profit & Loss + Balance Sheet'),
    metric('operatingCashFlowRatio', 'Operating Cash Flow Ratio', null, 'x', null, 'Operating cash flow / current liabilities', 'Unavailable: operating cash flow classification is not present in the cached Xero data'),
    metric('cashFlowMargin', 'Cash Flow Margin', null, '%', null, 'Operating cash flow / revenue × 100', 'Unavailable: operating cash flow classification is not present in the cached Xero data'),
    metric('cashConversionRatio', 'Cash Conversion Ratio', null, 'x', null, 'Operating cash flow / EBITDA', 'Unavailable: operating cash flow classification is not present in the cached Xero data'),
    metric('freeCashFlow', 'Free Cash Flow', null, 'currency', null, 'Operating cash flow − capital expenditure', 'Unavailable: operating cash flow and capital expenditure classifications are not available'),
    metric('cashFlowToDebt', 'Cash Flow to Debt', null, 'x', null, 'Operating cash flow / interest-bearing debt', 'Unavailable: operating cash flow classification is not present in the cached Xero data'),
    metric('dscr', 'Debt Service Coverage Ratio', null, 'x', null, 'Cash available for debt service / total debt service', 'Unavailable: debt-service cash flow data is not available'),
    metric('roce', 'Return on Capital Employed (ROCE)', pct(ebit, current.b?.assets != null && current.b?.currentLiabilities != null ? current.b.assets - current.b.currentLiabilities : null), '%', null, 'ROCE (Return on Capital Employed) = EBIT (Earnings Before Interest and Tax) / capital employed × 100', 'Xero Profit & Loss + Balance Sheet'),
    metric('roe', 'Return on Equity (ROE)', pct(netProfit, avgEquity), '%', pct(previous.p?.netProfit ?? null, previous.b?.equity ?? null), 'ROE (Return on Equity) = net profit / average equity × 100', 'Xero Profit & Loss + Balance Sheet'),
    metric('roic', 'Return on Invested Capital (ROIC)', null, '%', null, 'ROIC (Return on Invested Capital) = NOPAT (Net Operating Profit After Tax) / invested capital × 100', 'Unavailable: tax-adjusted operating profit and invested-capital classifications are not available'),
  ];
  const actual = (value: number | null | undefined) => value ?? Number.NaN;
  const calculationInputs: Record<string, KpiMetric['calculation']> = {
    dso: { inputs: [{ label: 'Average trade receivables', value: actual(avgAr), unit: 'currency' }, { label: 'Credit sales', value: actual(revenue), unit: 'currency' }, { label: 'Days in selected period', value: days, unit: 'days' }] },
    dpo: { inputs: [{ label: 'Average trade payables', value: actual(avgAp), unit: 'currency' }, { label: 'Credit purchases / cost of sales', value: actual(purchases || cogs), unit: 'currency' }, { label: 'Days in selected period', value: days, unit: 'days' }] },
    dio: { inputs: [{ label: 'Average inventory', value: actual(avgInventory), unit: 'currency' }, { label: 'Cost of sales', value: actual(cogs), unit: 'currency' }, { label: 'Days in selected period', value: days, unit: 'days' }] },
    ccc: { inputs: [{ label: 'Debtor days (DSO)', value: actual(dso), unit: 'days' }, { label: 'Inventory days (DIO)', value: actual(dio), unit: 'days' }, { label: 'Creditor days (DPO)', value: actual(dpo), unit: 'days' }] },
    currentRatio: { inputs: [{ label: 'Current assets', value: actual(current.b?.currentAssets), unit: 'currency' }, { label: 'Current liabilities', value: actual(current.b?.currentLiabilities), unit: 'currency' }] },
    quickRatio: { inputs: [{ label: 'Current assets less inventory', value: actual(current.b?.currentAssets) - actual(current.b?.inventory), unit: 'currency' }, { label: 'Current liabilities', value: actual(current.b?.currentLiabilities), unit: 'currency' }] },
    interestCoverage: { inputs: [{ label: 'Operating profit (EBIT)', value: actual(ebit), unit: 'currency' }, { label: 'Interest expense', value: actual(abs(current.p?.interest ?? null)), unit: 'currency' }] },
    debtToEquity: { inputs: [{ label: 'Interest-bearing debt', value: actual(current.b?.debt), unit: 'currency' }, { label: 'Shareholders’ equity', value: actual(current.b?.equity), unit: 'currency' }] },
    netDebt: { inputs: [{ label: 'Interest-bearing debt', value: actual(current.b?.debt), unit: 'currency' }, { label: 'Cash', value: actual(current.b?.cash), unit: 'currency' }] },
    netDebtEbitda: { inputs: [{ label: 'Net debt', value: actual(current.b?.debt) - actual(current.b?.cash), unit: 'currency' }, { label: 'EBITDA', value: actual(ebitda), unit: 'currency' }] },
    equityRatio: { inputs: [{ label: 'Shareholders’ equity', value: actual(current.b?.equity), unit: 'currency' }, { label: 'Total assets', value: actual(current.b?.assets), unit: 'currency' }] },
    assetTurnover: { inputs: [{ label: 'Revenue', value: actual(revenue), unit: 'currency' }, { label: 'Average total assets', value: actual(avgAssets), unit: 'currency' }] },
    fixedAssetTurnover: { inputs: [{ label: 'Revenue', value: actual(revenue), unit: 'currency' }, { label: 'Average fixed assets', value: actual(avg(current.b?.fixedAssets ?? null, opening.b?.fixedAssets ?? null)), unit: 'currency' }] },
    opexRatio: { inputs: [{ label: 'Operating expenses', value: actual(current.p?.operatingExpenses), unit: 'currency' }, { label: 'Revenue', value: actual(revenue), unit: 'currency' }] },
    workingCapitalTurnover: { inputs: [{ label: 'Revenue', value: actual(revenue), unit: 'currency' }, { label: 'Working capital (current assets less current liabilities)', value: actual(current.b?.currentAssets) - actual(current.b?.currentLiabilities), unit: 'currency' }] },
    roce: { inputs: [{ label: 'Operating profit (EBIT)', value: actual(ebit), unit: 'currency' }, { label: 'Capital employed', value: actual(current.b?.assets) - actual(current.b?.currentLiabilities), unit: 'currency' }] },
    roe: { inputs: [{ label: 'Net profit', value: actual(netProfit), unit: 'currency' }, { label: 'Average shareholders’ equity', value: actual(avgEquity), unit: 'currency' }] },
  };
  for (const item of metrics) {
    const calculation = calculationInputs[item.key];
    item.calculation = item.value !== null && calculation?.inputs?.every(input => Number.isFinite(input.value)) ? calculation : null;
  }
  const available = metrics.filter(m => m.value !== null).length;
  const status = (items: KpiMetric[]) => items.some(i => i.value !== null) ? `${items.filter(i => i.value !== null).length} available` : 'Data unavailable';
  return { period: { code: period, label: dates.label, startDate: iso(dates.start), endDate: iso(dates.end), previousStartDate: iso(dates.previousStart), previousEndDate: iso(dates.previousEnd) }, metrics, summary: { overall: status(metrics), liquidity: status(metrics.filter(m => ['currentRatio', 'quickRatio', 'interestCoverage'].includes(m.key))), workingCapital: status(metrics.filter(m => ['dso', 'dpo', 'dio', 'ccc'].includes(m.key))), risk: status(metrics.filter(m => ['debtToEquity', 'netDebtEbitda', 'equityRatio'].includes(m.key))) }, dataQuality: { availableMetrics: available, totalMetrics: metrics.length, currency: org?.BaseCurrency || org?.CurrencyCode || 'Not available', source: token ? 'PostgreSQL cache with Xero fallback for missing dated reports' : 'PostgreSQL cache' } };
}
