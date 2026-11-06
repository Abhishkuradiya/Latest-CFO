import { db } from '../db';
import { CanonicalMetricEngine } from './CanonicalMetricEngine';

export function extractMetricNumber(metric: any): number | null {
  if (metric === null || metric === undefined) return null;
  if (typeof metric === 'number') return metric;
  if (typeof metric === 'object') {
    if (typeof metric.value === 'number') return metric.value;
    if (metric.value === null || metric.value === undefined) return null;
  }
  return null;
}

export interface DerivedMetric<T = number | null> {
  value: T;
  sourceMetrics: string[];

  formula: string;
  period: { startDate: string; endDate: string };
  currency: string;
  dataCoverage: string;
  mappingCoverage: string;
  confidence: number;
  status?: 'AVAILABLE' | 'NOT_AVAILABLE';
  reason?: string;
}

export type CFOInsightType =
  | 'PROFITABILITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'CASH_FLOW'
  | 'WORKING_CAPITAL'
  | 'AR'
  | 'AP'
  | 'MARGIN'
  | 'GROWTH'
  | 'RISK'
  | 'ANOMALY'
  | 'DATA_QUALITY';

export type CFOSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CFOInsightTraceability {
  metric: string;
  accountingSource: string;
  reportOrLedger: string;
  period: string;
  tenantId: string;
  value: string | number | null;
}

export interface CFOInsight {
  id: string;
  tenantId: string;
  period: { startDate: string; endDate: string };
  metric: string;
  insightType: CFOInsightType;
  severity: CFOSeverity;
  title: string;
  summary: string;
  description?: string;
  value: number | null;
  comparisonValue: number | null;
  delta: number | null;
  deltaPct: number | null;
  currency: string;
  sourceMetrics: string[];
  calculationSource: string;
  dataCoverage: string;
  confidence: number;
  warnings: string[];
  traceability: CFOInsightTraceability;
  createdAt?: string;
}

export interface CFOAlert {
  id: string;
  tenantId: string;
  type: string;
  severity: CFOSeverity;
  title: string;
  message: string;
  metric: string;
  value: number | null;
  threshold: number;
  period: { startDate: string; endDate: string };
  source: string;
  traceability: CFOInsightTraceability;
  dataCoverage?: string;
  reason?: string;
}

export interface PeriodComparison {
  metric: string;
  currentValue: number | null;
  comparisonValue: number | null;
  delta: number | null;
  deltaPct: number | null;
  direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
  comparisonPeriod: { startDate: string; endDate: string } | null;
  comparisonType: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' | 'CUSTOM';
}

export interface ExpenseItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  currentAmount: number;
  previousAmount: number;
  absoluteChange: number;
  percentageChange: number;
  percentOfRevenue: number;
}

export interface ExpenseIntelligence {
  topExpenseAccounts: ExpenseItem[];
  fastestGrowingExpenseAccounts: ExpenseItem[];
  largestExpenseChanges: ExpenseItem[];
}

export interface RevenueDimensionItem {
  dimension: string;
  key: string;
  label: string;
  revenue: number;
  percentageOfTotal: number;
}

export interface RevenueIntelligence {
  byChannel: RevenueDimensionItem[];
  byTrackingCategory: RevenueDimensionItem[];
  byProduct: RevenueDimensionItem[];
  byCustomer: RevenueDimensionItem[];
  byPeriod: Array<{ period: string; revenue: number }>;
}

export interface CashFlowIntelligence {
  operatingCashFlow: DerivedMetric<number | null>;
  investingCashFlow: DerivedMetric<number | null>;
  financingCashFlow: DerivedMetric<number | null>;
  netCashChange: DerivedMetric<number | null>;
}

export interface WorkingCapitalIntelligence {
  ar: DerivedMetric<number | null>;
  ap: DerivedMetric<number | null>;
  workingCapital: DerivedMetric<number | null>;
  standardWorkingCapital?: DerivedMetric<number | null>;
  liquidWorkingCapital?: DerivedMetric<number | null>;
  arChange: DerivedMetric<number | null>;
  apChange: DerivedMetric<number | null>;
  dso: DerivedMetric<number | null>;
  dpo: DerivedMetric<number | null>;
}

export interface CFOThresholdConfig {
  marginCompressionThreshold: number;
  revenueDeclineThreshold: number;
  opexIncreaseThreshold: number;
  arIncreaseThreshold: number;
  cashDeclineThreshold: number;
  isDefault: boolean;
}

export interface CFOIntelligenceResult {
  tenantId: string;
  period: { startDate: string; endDate: string };
  currency: string;
  calculationSource: string;
  dataCoverage: string;
  mappingCoverage: string;
  warnings: string[];
  metrics: Record<string, DerivedMetric>;
  profitability: Record<string, DerivedMetric>;
  periodComparison: Record<string, PeriodComparison>;
  expenses: ExpenseIntelligence;
  revenue: RevenueIntelligence;
  cashFlow: CashFlowIntelligence;
  workingCapital: WorkingCapitalIntelligence;
  alerts: CFOAlert[];
  insights: CFOInsight[];
  thresholds: CFOThresholdConfig;
  traceability: CFOInsightTraceability;
}

export class CFOIntelligenceEngine {
  /**
   * Main entry point to generate full deterministic CFO intelligence.
   */
  static async getIntelligence(
    tenantId: string,
    startDate: string,
    endDate: string,
    prevStartDate?: string,
    prevEndDate?: string
  ): Promise<CFOIntelligenceResult> {
    const currentFinancials = await CanonicalMetricEngine.calculateFinancials(tenantId, startDate, endDate);

    let hasPrevData = true;
    if (!prevStartDate || !prevEndDate) {
      const currStart = new Date(startDate);
      const currEnd = new Date(endDate);
      const durationMs = currEnd.getTime() - currStart.getTime();
      const prevEnd = new Date(currStart.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      prevStartDate = prevStart.toISOString().split('T')[0];
      prevEndDate = prevEnd.toISOString().split('T')[0];
    }

    let prevFinancials: any = null;
    try {
      prevFinancials = await CanonicalMetricEngine.calculateFinancials(tenantId, prevStartDate, prevEndDate);
    } catch (e) {
      hasPrevData = false;
    }

    const thresholds: CFOThresholdConfig = await db.getTenantCFOThresholds(tenantId);

    const currency = currentFinancials.currency || 'GBP';
    const dataCoverage = currentFinancials.dataCoverageStatus || 'DATA_COMPLETE';
    const mappingCoverage = `${currentFinancials.mappingCoveragePct}%`;
    const calculationSource = currentFinancials.sourceMode || 'MODE_A';
    const warnings: string[] = [];

    if (dataCoverage !== 'DATA_COMPLETE') {
      warnings.push(`Source data coverage is ${dataCoverage}. Some metrics may return NOT_AVAILABLE.`);
    }

    // 1. Profitability Intelligence
    const profitability = this.calculateProfitability(
      currentFinancials,
      prevFinancials,
      { startDate, endDate },
      currency,
      hasPrevData
    );

    // 2. Period Comparisons
    const periodComparison = this.calculatePeriodComparisons(
      currentFinancials,
      prevFinancials,
      prevStartDate && prevEndDate ? { startDate: prevStartDate, endDate: prevEndDate } : undefined
    );

    const revNumber = extractMetricNumber(currentFinancials.metrics.revenue) || 0;

    // 3. Expense Intelligence
    const expenses = await this.calculateExpenseIntelligence(
      tenantId,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      revNumber
    );

    // 4. Revenue Intelligence
    const revenue = await this.calculateRevenueIntelligence(tenantId, startDate, endDate);

    // 5. Cash Flow Intelligence
    const cashFlow = await this.calculateCashFlowIntelligence(tenantId, startDate, endDate, currentFinancials);

    // 6. Working Capital Intelligence
    const workingCapital = this.calculateWorkingCapitalIntelligence(
      tenantId,
      startDate,
      endDate,
      currentFinancials,
      prevFinancials
    );

    // 7. CFO Alert Engine & Insights
    const { alerts, insights } = this.generateAlertsAndInsights(
      tenantId,
      { startDate, endDate },
      currentFinancials,
      prevFinancials,
      profitability,
      workingCapital,
      thresholds
    );

    // Consolidated metrics dictionary for easy consumer access
    const metrics: Record<string, DerivedMetric> = {
      ...profitability,
      cash: {
        value: extractMetricNumber(currentFinancials.metrics.cashBalance) ?? extractMetricNumber(currentFinancials.metrics.cash),
        sourceMetrics: ['cashBalance'],
        formula: 'Balance Sheet Total Cash',
        period: { startDate, endDate },
        currency,
        dataCoverage,
        mappingCoverage,
        confidence: 1.0
      },
      accountsReceivable: workingCapital.ar,
      accountsPayable: workingCapital.ap,
      workingCapital: workingCapital.workingCapital,
      standardWorkingCapital: workingCapital.standardWorkingCapital || workingCapital.workingCapital,
      liquidWorkingCapital: workingCapital.liquidWorkingCapital || workingCapital.workingCapital,
      dso: workingCapital.dso,
      dpo: workingCapital.dpo
    };

    const traceability: CFOInsightTraceability = {
      metric: 'CFOIntelligenceSummary',
      accountingSource: calculationSource,
      reportOrLedger: 'Xero Report / Canonical Metric Engine',
      period: `${startDate} -> ${endDate}`,
      tenantId: String(tenantId),
      value: `Revenue: ${currency} ${profitability.revenue.value || 0}`
    };

    return {
      tenantId: String(tenantId),
      period: { startDate, endDate },
      currency,
      calculationSource,
      dataCoverage,
      mappingCoverage,
      warnings,
      metrics,
      profitability,
      periodComparison,
      expenses,
      revenue,
      cashFlow,
      workingCapital,
      alerts,
      insights,
      thresholds,
      traceability
    };
  }

  private static calculateProfitability(
    current: any,
    prev: any,
    period: { startDate: string; endDate: string },
    currency: string,
    hasPrevData: boolean
  ): Record<string, DerivedMetric> {
    const m = current.metrics || {};
    const pM = prev ? (prev.metrics || {}) : null;

    const rev = extractMetricNumber(m.revenue);
    const prevRev = pM ? extractMetricNumber(pM.revenue) : null;
    const cogs = extractMetricNumber(m.cogs ?? m.costOfSales);

    let revGrowth: number | null = null;
    if (rev !== null && prevRev !== null && prevRev !== 0) {
      revGrowth = ((rev - prevRev) / Math.abs(prevRev)) * 100;
    }

    const gp = extractMetricNumber(m.grossProfit) ?? (rev !== null && cogs !== null ? rev - cogs : null);
    const grossMarginPct = rev !== null && rev > 0 && gp !== null ? (gp / rev) * 100 : null;

    const opex = extractMetricNumber(m.operatingExpenses);
    const opexPct = rev !== null && rev > 0 && opex !== null ? (opex / rev) * 100 : null;

    const opProfit = extractMetricNumber(m.operatingProfit) ?? (gp !== null && opex !== null ? gp - opex : null);
    const opMarginPct = rev !== null && rev > 0 && opProfit !== null ? (opProfit / rev) * 100 : null;

    const netProfit = extractMetricNumber(m.netProfit);
    const netMarginPct = rev !== null && rev > 0 && netProfit !== null ? (netProfit / rev) * 100 : null;

    const ebitda = extractMetricNumber(m.ebitda);
    const ebitdaMarginPct = ebitda !== null && rev !== null && rev > 0 ? (ebitda / rev) * 100 : null;

    const baseMeta = {
      period,
      currency,
      dataCoverage: current.dataCoverageStatus || 'DATA_COMPLETE',
      mappingCoverage: `${current.mappingCoveragePct}%`,
      confidence: (current.mappingCoveragePct || 100) >= 90 ? 1.0 : 0.8
    };

    return {
      revenue: { value: rev, sourceMetrics: ['revenue'], formula: 'SUM(Revenue Account Lines)', ...baseMeta },
      revenueGrowthPct: { value: revGrowth, sourceMetrics: ['revenue', 'prevRevenue'], formula: '((CurrentRev - PrevRev) / ABS(PrevRev)) * 100', ...baseMeta },
      grossProfit: { value: gp, sourceMetrics: ['revenue', 'cogs'], formula: 'Revenue - COGS', ...baseMeta },
      grossMarginPct: { value: grossMarginPct, sourceMetrics: ['grossProfit', 'revenue'], formula: '(GrossProfit / Revenue) * 100', ...baseMeta },
      operatingExpenses: { value: opex, sourceMetrics: ['operatingExpenses'], formula: 'SUM(Operating Expense Lines)', ...baseMeta },
      operatingExpensePct: { value: opexPct, sourceMetrics: ['operatingExpenses', 'revenue'], formula: '(OperatingExpenses / Revenue) * 100', ...baseMeta },
      operatingProfit: { value: opProfit, sourceMetrics: ['grossProfit', 'operatingExpenses'], formula: 'GrossProfit - OperatingExpenses', ...baseMeta },
      operatingMarginPct: { value: opMarginPct, sourceMetrics: ['operatingProfit', 'revenue'], formula: '(OperatingProfit / Revenue) * 100', ...baseMeta },
      netProfit: { value: netProfit, sourceMetrics: ['operatingProfit', 'otherIncome', 'otherExpenses', 'interest', 'tax'], formula: 'OperatingProfit + OtherIncome - OtherExpenses - Interest - Tax', ...baseMeta },
      netMarginPct: { value: netMarginPct, sourceMetrics: ['netProfit', 'revenue'], formula: '(NetProfit / Revenue) * 100', ...baseMeta },
      ebitda: ebitda !== null
        ? { value: ebitda, sourceMetrics: ['operatingProfit', 'depreciation', 'amortization'], formula: 'OperatingProfit + Depreciation + Amortization', ...baseMeta, status: 'AVAILABLE' }
        : { value: null, sourceMetrics: [], formula: 'N/A', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Depreciation and Amortization breakdown not isolated in source data' },
      ebitdaMarginPct: ebitdaMarginPct !== null
        ? { value: ebitdaMarginPct, sourceMetrics: ['ebitda', 'revenue'], formula: '(EBITDA / Revenue) * 100', ...baseMeta, status: 'AVAILABLE' }
        : { value: null, sourceMetrics: [], formula: 'N/A', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'EBITDA is unavailable' }
    };
  }

  private static calculatePeriodComparisons(
    current: any,
    prev: any,
    prevPeriod?: { startDate: string; endDate: string }
  ): Record<string, PeriodComparison> {
    const keys = ['revenue', 'grossProfit', 'operatingExpenses', 'operatingProfit', 'netProfit', 'cash', 'accountsReceivable', 'accountsPayable'];
    const res: Record<string, PeriodComparison> = {};

    for (const key of keys) {
      const curVal = extractMetricNumber(current?.metrics?.[key]);
      const prevVal = extractMetricNumber(prev?.metrics?.[key]);

      let absDiff: number | null = null;
      let pctDiff: number | null = null;
      let dir: 'INCREASED' | 'DECREASED' | 'UNCHANGED' = 'UNCHANGED';

      if (curVal !== null && prevVal !== null) {
        absDiff = curVal - prevVal;
        pctDiff = prevVal !== 0 ? (absDiff / Math.abs(prevVal)) * 100 : (absDiff !== 0 ? 100 : 0);
        dir = curVal > prevVal ? 'INCREASED' : (curVal < prevVal ? 'DECREASED' : 'UNCHANGED');
      }

      res[key] = {
        metric: key,
        currentValue: curVal,
        comparisonValue: prevVal,
        delta: absDiff,
        deltaPct: pctDiff,
        direction: dir,
        comparisonPeriod: prevPeriod || null,
        comparisonType: 'PREVIOUS_PERIOD'
      };
    }

    return res;
  }

  private static async calculateExpenseIntelligence(
    tenantId: string,
    startDate: string,
    endDate: string,
    prevStartDate: string,
    prevEndDate: string,
    totalRevenue: number
  ): Promise<ExpenseIntelligence> {
    const accounts = await db.getAccounts(tenantId);
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE' || a.type === 'OVERHEAD' || a.type === 'DIRECT_COSTS');

    const items: ExpenseItem[] = [];

    for (const acc of expenseAccounts) {
      const curBal = Math.abs(await db.getCanonicalAccountBalance(tenantId, acc.account_id, startDate, endDate));
      const prevBal = Math.abs(await db.getCanonicalAccountBalance(tenantId, acc.account_id, prevStartDate, prevEndDate));
      const absDiff = curBal - prevBal;
      const pctDiff = prevBal !== 0 ? (absDiff / prevBal) * 100 : (curBal !== 0 ? 100 : 0);
      const pctRev = totalRevenue !== 0 ? (curBal / totalRevenue) * 100 : 0;

      items.push({
        accountId: acc.account_id,
        accountCode: acc.code || '',
        accountName: acc.name || '',
        currentAmount: curBal,
        previousAmount: prevBal,
        absoluteChange: absDiff,
        percentageChange: pctDiff,
        percentOfRevenue: pctRev
      });
    }

    const topExpenseAccounts = [...items].sort((a, b) => b.currentAmount - a.currentAmount).slice(0, 5);
    const fastestGrowingExpenseAccounts = [...items].filter(i => i.previousAmount > 0).sort((a, b) => b.percentageChange - a.percentageChange).slice(0, 5);
    const largestExpenseChanges = [...items].sort((a, b) => Math.abs(b.absoluteChange) - Math.abs(a.absoluteChange)).slice(0, 5);

    return {
      topExpenseAccounts,
      fastestGrowingExpenseAccounts,
      largestExpenseChanges
    };
  }

  private static async calculateRevenueIntelligence(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<RevenueIntelligence> {
    const tid = parseInt(tenantId) || 1;
    const invoices = await db.getInvoices(tid);

    const periodRevenues: Record<string, number> = {};
    const customerRevenues: Record<string, { name: string; total: number }> = {};
    const productRevenues: Record<string, { label: string; total: number }> = {};
    let totalRevenue = 0;

    for (const inv of invoices) {
      const invType = (inv.Type || inv.type || '').toUpperCase();
      if (invType !== 'ACCREC') continue;

      const invDate = inv.Date || inv.date || inv.invoice_date;
      if (startDate && invDate && new Date(invDate) < new Date(startDate)) continue;
      if (endDate && invDate && new Date(invDate) > new Date(endDate)) continue;

      const amt = Number(inv.Total !== undefined ? inv.Total : (inv.total !== undefined ? inv.total : inv.amount || 0));
      totalRevenue += amt;

      const periodKey = invDate ? String(invDate).substring(0, 7) : 'Unknown';
      periodRevenues[periodKey] = (periodRevenues[periodKey] || 0) + amt;

      const custName = inv.ContactName || inv.contactName || inv.Contact?.Name || inv.contact_id || 'Unknown Customer';
      const custId = inv.contact_id || custName;
      if (!customerRevenues[custId]) customerRevenues[custId] = { name: custName, total: 0 };
      customerRevenues[custId].total += amt;

      const lines = inv.line_items || inv.lineItems || [];
      for (const line of lines) {
        const itemKey = line.item_code || line.description || 'General Service';
        if (!productRevenues[itemKey]) productRevenues[itemKey] = { label: itemKey, total: 0 };
        productRevenues[itemKey].total += Number(line.line_amount || line.lineAmount || line.amount || 0);
      }
    }

    const byCustomer: RevenueDimensionItem[] = Object.entries(customerRevenues)
      .map(([key, val]) => ({
        dimension: 'CUSTOMER',
        key,
        label: val.name,
        revenue: val.total,
        percentageOfTotal: totalRevenue !== 0 ? (val.total / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const byProduct: RevenueDimensionItem[] = Object.entries(productRevenues)
      .map(([key, val]) => ({
        dimension: 'PRODUCT',
        key,
        label: val.label,
        revenue: val.total,
        percentageOfTotal: totalRevenue !== 0 ? (val.total / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const byPeriod = Object.entries(periodRevenues)
      .map(([period, revenue]) => ({ period, revenue }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      byChannel: [], // Explicit DATA_NOT_AVAILABLE / empty per instructions (no channel tracking)
      byTrackingCategory: [],
      byProduct,
      byCustomer,
      byPeriod
    };
  }

  private static async calculateCashFlowIntelligence(
    tenantId: string,
    startDate: string,
    endDate: string,
    currentFinancials: any
  ): Promise<CashFlowIntelligence> {
    const tid = parseInt(tenantId) || 1;
    const bankTxns = await db.getReport(tid, 'BankTransactions');
    const baseMeta = {
      period: { startDate, endDate },
      currency: currentFinancials.currency || 'GBP',
      dataCoverage: currentFinancials.dataCoverageStatus || 'DATA_COMPLETE',
      mappingCoverage: `${currentFinancials.mappingCoveragePct}%`,
      confidence: 0.9
    };

    if (!bankTxns || !Array.isArray(bankTxns) || bankTxns.length === 0) {
      return {
        operatingCashFlow: { value: null, sourceMetrics: [], formula: 'Direct Bank Movement', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Bank transactions report unavailable for period' },
        investingCashFlow: { value: null, sourceMetrics: [], formula: 'Fixed Asset Cash Movement', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Investing transactions breakdown unavailable' },
        financingCashFlow: { value: null, sourceMetrics: [], formula: 'Equity/Debt Cash Movement', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Financing transactions breakdown unavailable' },
        netCashChange: { value: null, sourceMetrics: [], formula: 'EndingCash - StartingCash', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Insufficient source cash flow data' }
      };
    }

    let operatingCash = 0;
    let investingCash = 0;
    let financingCash = 0;

    for (const tx of bankTxns) {
      if (startDate && tx.date && new Date(tx.date) < new Date(startDate)) continue;
      if (endDate && tx.date && new Date(tx.date) > new Date(endDate)) continue;

      const amt = Number(tx.total || tx.amount || 0);
      const isReceive = tx.type === 'RECEIVE' || tx.type === 'RECEIVE-OVERPAYMENT' || tx.type === 'RECEIVE-PREPAYMENT';
      const netAmt = isReceive ? amt : -amt;

      const accType = tx.accountType || 'OPERATING';
      if (accType === 'INVESTING') investingCash += netAmt;
      else if (accType === 'FINANCING') financingCash += netAmt;
      else operatingCash += netAmt;
    }

    const netCash = operatingCash + investingCash + financingCash;

    return {
      operatingCashFlow: { value: operatingCash, sourceMetrics: ['bank_transactions'], formula: 'SUM(Operating Bank Movements)', ...baseMeta, status: 'AVAILABLE' },
      investingCashFlow: { value: investingCash, sourceMetrics: ['bank_transactions'], formula: 'SUM(Investing Bank Movements)', ...baseMeta, status: 'AVAILABLE' },
      financingCashFlow: { value: financingCash, sourceMetrics: ['bank_transactions'], formula: 'SUM(Financing Bank Movements)', ...baseMeta, status: 'AVAILABLE' },
      netCashChange: { value: netCash, sourceMetrics: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow'], formula: 'Operating + Investing + Financing', ...baseMeta, status: 'AVAILABLE' }
    };
  }

  private static calculateWorkingCapitalIntelligence(
    tenantId: string,
    startDate: string,
    endDate: string,
    current: any,
    prev: any
  ): WorkingCapitalIntelligence {
    const m = current.metrics;
    const pM = prev ? prev.metrics : null;

    const ar = m.accountsReceivable ?? null;
    const ap = m.accountsPayable ?? null;
    const prevAR = pM ? (pM.accountsReceivable ?? null) : null;
    const prevAP = pM ? (pM.accountsPayable ?? null) : null;

    const cash = m.cash ?? 0;
    const liquidCurrentAssets = (ar ?? 0) + cash;
    const liquidCurrentLiabilities = ap ?? 0;
    const liquidWcVal = liquidCurrentAssets - liquidCurrentLiabilities;

    const rev = m.revenue ?? 0;
    const cogs = m.cogs ?? 0;

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const daysInPeriod = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    const avgAR = prevAR !== null && ar !== null ? (ar + prevAR) / 2 : ar;
    const avgAP = prevAP !== null && ap !== null ? (ap + prevAP) / 2 : ap;

    const dsoVal = avgAR !== null && rev > 0 ? (avgAR / rev) * daysInPeriod : null;
    const dpoVal = avgAP !== null && cogs > 0 ? (avgAP / cogs) * daysInPeriod : null;

    const arChange = ar !== null && prevAR !== null ? ar - prevAR : null;
    const apChange = ap !== null && prevAP !== null ? ap - prevAP : null;

    const baseMeta = {
      period: { startDate, endDate },
      currency: current.currency || 'GBP',
      dataCoverage: current.dataCoverageStatus || 'DATA_COMPLETE',
      mappingCoverage: `${current.mappingCoveragePct}%`,
      confidence: 1.0
    };

    return {
      ar: { value: ar, sourceMetrics: ['accountsReceivable'], formula: 'AccountsReceivable Balance', ...baseMeta },
      ap: { value: ap, sourceMetrics: ['accountsPayable'], formula: 'AccountsPayable Balance', ...baseMeta },
      workingCapital: { value: liquidWcVal, sourceMetrics: ['cash', 'accountsReceivable', 'accountsPayable'], formula: 'Cash + AccountsReceivable - AccountsPayable', ...baseMeta },
      standardWorkingCapital: { value: current.metrics.currentAssets && current.metrics.currentLiabilities ? current.metrics.currentAssets - current.metrics.currentLiabilities : null, sourceMetrics: ['currentAssets', 'currentLiabilities'], formula: 'CurrentAssets - CurrentLiabilities', ...baseMeta },
      liquidWorkingCapital: { value: liquidWcVal, sourceMetrics: ['cash', 'accountsReceivable', 'accountsPayable'], formula: 'Cash + AccountsReceivable - AccountsPayable', ...baseMeta },
      arChange: { value: arChange, sourceMetrics: ['currentAR', 'prevAR'], formula: 'CurrentAR - PrevAR', ...baseMeta },
      apChange: { value: apChange, sourceMetrics: ['currentAP', 'prevAP'], formula: 'CurrentAP - PrevAP', ...baseMeta },
      dso: dsoVal !== null
        ? { value: Math.round(dsoVal * 10) / 10, sourceMetrics: ['accountsReceivable', 'prevAccountsReceivable', 'revenue'], formula: '(AverageAR / Revenue) * DaysInPeriod', ...baseMeta, status: 'AVAILABLE' }
        : { value: null, sourceMetrics: [], formula: '(AverageAR / Revenue) * DaysInPeriod', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'Revenue is 0 or AR unavailable for DSO calculation' },
      dpo: dpoVal !== null
        ? { value: Math.round(dpoVal * 10) / 10, sourceMetrics: ['accountsPayable', 'prevAccountsPayable', 'cogs'], formula: '(AverageAP / COGS) * DaysInPeriod', ...baseMeta, status: 'AVAILABLE' }
        : { value: null, sourceMetrics: [], formula: '(AverageAP / COGS) * DaysInPeriod', ...baseMeta, status: 'NOT_AVAILABLE', reason: 'COGS is 0 or AP unavailable for DPO calculation' }
    };
  }

  private static generateAlertsAndInsights(
    tenantId: string,
    period: { startDate: string; endDate: string },
    current: any,
    prev: any,
    profitability: Record<string, DerivedMetric>,
    workingCapital: WorkingCapitalIntelligence,
    thresholds: CFOThresholdConfig
  ): { alerts: CFOAlert[]; insights: CFOInsight[] } {
    const rawAlerts: CFOAlert[] = [];
    const rawInsights: CFOInsight[] = [];
    const now = new Date().toISOString();

    const m = current.metrics;
    const pM = prev ? prev.metrics : null;
    const sourceMode = current.sourceMode || 'MODE_A';
    const periodStr = `${period.startDate} -> ${period.endDate}`;

    const makeTraceability = (metricName: string, val: string | number | null): CFOInsightTraceability => ({
      metric: metricName,
      accountingSource: sourceMode,
      reportOrLedger: 'Xero Report / Canonical Engine',
      period: periodStr,
      tenantId: String(tenantId),
      value: val
    });

    // 1. NEGATIVE OPERATING PROFIT
    const opProf = profitability.operatingProfit.value;
    if (opProf !== null && opProf < 0) {
      const trace = makeTraceability('operatingProfit', opProf);
      rawAlerts.push({
        id: `alert-nop-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        type: 'NEGATIVE_OPERATING_PROFIT',
        severity: 'HIGH',
        title: 'Negative Operating Profit',
        message: `Operating profit is negative (£${opProf.toLocaleString()}) for the target period.`,
        metric: 'operatingProfit',
        value: opProf,
        threshold: 0,
        period,
        source: sourceMode,
        traceability: trace,
        dataCoverage: current.dataCoverageStatus,
        reason: `Operating expenses exceed gross profit by £${Math.abs(opProf).toLocaleString()}.`
      });

      rawInsights.push({
        id: `insight-nop-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        period,
        metric: 'operatingProfit',
        insightType: 'PROFITABILITY',
        severity: 'HIGH',
        title: 'Negative Operating Profit Detected',
        summary: `Operating profit is in negative territory (£${opProf.toLocaleString()}).`,
        description: `Operating expenses exceed gross profit by £${Math.abs(opProf).toLocaleString()} in period ${periodStr}.`,
        value: opProf,
        comparisonValue: pM ? pM.operatingProfit : null,
        delta: pM && pM.operatingProfit !== null ? opProf - pM.operatingProfit : null,
        deltaPct: pM && pM.operatingProfit ? ((opProf - pM.operatingProfit) / Math.abs(pM.operatingProfit)) * 100 : null,
        currency: current.currency || 'GBP',
        sourceMetrics: ['grossProfit', 'operatingExpenses'],
        calculationSource: sourceMode,
        dataCoverage: current.dataCoverageStatus,
        confidence: 1.0,
        warnings: [],
        traceability: trace,
        createdAt: now
      });
    }

    // 2. NEGATIVE NET PROFIT
    const netProf = profitability.netProfit.value;
    if (netProf !== null && netProf < 0) {
      const trace = makeTraceability('netProfit', netProf);
      rawAlerts.push({
        id: `alert-nnp-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        type: 'NEGATIVE_NET_PROFIT',
        severity: 'HIGH',
        title: 'Negative Net Profit',
        message: `Net profit is negative (£${netProf.toLocaleString()}) for the period.`,
        metric: 'netProfit',
        value: netProf,
        threshold: 0,
        period,
        source: sourceMode,
        traceability: trace,
        dataCoverage: current.dataCoverageStatus
      });

      rawInsights.push({
        id: `insight-nnp-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        period,
        metric: 'netProfit',
        insightType: 'PROFITABILITY',
        severity: 'HIGH',
        title: 'Net Profit Deficit',
        summary: `Net profit returned a deficit of £${Math.abs(netProf).toLocaleString()}.`,
        value: netProf,
        comparisonValue: pM ? pM.netProfit : null,
        delta: pM && pM.netProfit !== null ? netProf - pM.netProfit : null,
        deltaPct: pM && pM.netProfit ? ((netProf - pM.netProfit) / Math.abs(pM.netProfit)) * 100 : null,
        currency: current.currency || 'GBP',
        sourceMetrics: ['operatingProfit', 'otherIncome', 'otherExpenses'],
        calculationSource: sourceMode,
        dataCoverage: current.dataCoverageStatus,
        confidence: 1.0,
        warnings: [],
        traceability: trace,
        createdAt: now
      });
    }

    // 3. MARGIN COMPRESSION
    const curGM = profitability.grossMarginPct.value;
    const prevGM = pM && pM.revenue > 0 ? ((pM.grossProfit ?? 0) / pM.revenue) * 100 : null;
    if (curGM !== null && prevGM !== null) {
      const gmCompression = prevGM - curGM;
      if (gmCompression >= thresholds.marginCompressionThreshold) {
        const trace = makeTraceability('grossMarginPct', curGM);
        rawAlerts.push({
          id: `alert-mc-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          type: 'MARGIN_COMPRESSION',
          severity: gmCompression >= 10 ? 'HIGH' : 'MEDIUM',
          title: 'Gross Margin Compression',
          message: `Gross margin compressed by ${gmCompression.toFixed(1)}% (from ${prevGM.toFixed(1)}% to ${curGM.toFixed(1)}%).`,
          metric: 'grossMarginPct',
          value: curGM,
          threshold: thresholds.marginCompressionThreshold,
          period,
          source: sourceMode,
          traceability: trace,
          dataCoverage: current.dataCoverageStatus
        });

        rawInsights.push({
          id: `insight-mc-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          period,
          metric: 'grossMarginPct',
          insightType: 'MARGIN',
          severity: gmCompression >= 10 ? 'HIGH' : 'MEDIUM',
          title: 'Gross Margin Compression Detected',
          summary: `Gross margin decreased by ${gmCompression.toFixed(1)}% compared to previous period.`,
          value: curGM,
          comparisonValue: prevGM,
          delta: curGM - prevGM,
          deltaPct: -gmCompression,
          currency: current.currency || 'GBP',
          sourceMetrics: ['grossProfit', 'revenue'],
          calculationSource: sourceMode,
          dataCoverage: current.dataCoverageStatus,
          confidence: 0.95,
          warnings: [],
          traceability: trace,
          createdAt: now
        });
      }
    }

    // 4. REVENUE DECLINE
    const rev = profitability.revenue.value;
    const prevRev = pM ? pM.revenue : null;
    if (rev !== null && prevRev !== null && rev < prevRev && prevRev > 0) {
      const revDeclinePct = Math.abs(((rev - prevRev) / prevRev) * 100);
      if (revDeclinePct >= thresholds.revenueDeclineThreshold) {
        const trace = makeTraceability('revenue', rev);
        rawAlerts.push({
          id: `alert-rd-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          type: 'REVENUE_DECLINE',
          severity: revDeclinePct >= 15 ? 'CRITICAL' : 'HIGH',
          title: 'Revenue Decline Warning',
          message: `Revenue declined by ${revDeclinePct.toFixed(1)}% compared to previous period.`,
          metric: 'revenue',
          value: rev,
          threshold: thresholds.revenueDeclineThreshold,
          period,
          source: sourceMode,
          traceability: trace,
          dataCoverage: current.dataCoverageStatus
        });

        rawInsights.push({
          id: `insight-rd-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          period,
          metric: 'revenue',
          insightType: 'REVENUE',
          severity: revDeclinePct >= 15 ? 'CRITICAL' : 'HIGH',
          title: 'Revenue Decline Identified',
          summary: `Revenue decreased by ${revDeclinePct.toFixed(1)}% compared to previous period.`,
          value: rev,
          comparisonValue: prevRev,
          delta: rev - prevRev,
          deltaPct: -revDeclinePct,
          currency: current.currency || 'GBP',
          sourceMetrics: ['revenue'],
          calculationSource: sourceMode,
          dataCoverage: current.dataCoverageStatus,
          confidence: 0.95,
          warnings: [],
          traceability: trace,
          createdAt: now
        });
      }
    }

    // 5. OPEX SPIKE
    const curOpex = m.operatingExpenses;
    const prevOpex = pM ? pM.operatingExpenses : null;
    if (curOpex !== null && prevOpex !== null && prevOpex > 0) {
      const opexIncreasePct = ((curOpex - prevOpex) / prevOpex) * 100;
      if (opexIncreasePct >= thresholds.opexIncreaseThreshold) {
        const trace = makeTraceability('operatingExpenses', curOpex);
        rawAlerts.push({
          id: `alert-opex-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          type: 'OPEX_SPIKE',
          severity: opexIncreasePct >= 20 ? 'HIGH' : 'MEDIUM',
          title: 'Operating Expense Spike',
          message: `Operating expenses increased by ${opexIncreasePct.toFixed(1)}%, exceeding threshold of ${thresholds.opexIncreaseThreshold}%.`,
          metric: 'operatingExpenses',
          value: curOpex,
          threshold: thresholds.opexIncreaseThreshold,
          period,
          source: sourceMode,
          traceability: trace,
          dataCoverage: current.dataCoverageStatus
        });

        rawInsights.push({
          id: `insight-opex-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          period,
          metric: 'operatingExpenses',
          insightType: 'EXPENSE',
          severity: opexIncreasePct >= 20 ? 'HIGH' : 'MEDIUM',
          title: 'Operating Expense Spike Detected',
          summary: `Operating expenses increased by ${opexIncreasePct.toFixed(1)}%.`,
          value: curOpex,
          comparisonValue: prevOpex,
          delta: curOpex - prevOpex,
          deltaPct: opexIncreasePct,
          currency: current.currency || 'GBP',
          sourceMetrics: ['operatingExpenses'],
          calculationSource: sourceMode,
          dataCoverage: current.dataCoverageStatus,
          confidence: 0.95,
          warnings: [],
          traceability: trace,
          createdAt: now
        });
      }
    }

    // 6. AR INCREASE / AR GROWTH
    const arVal = workingCapital.ar.value;
    const prevARVal = pM ? pM.accountsReceivable : null;
    if (arVal !== null && prevARVal !== null && prevARVal > 0) {
      const arIncreasePct = ((arVal - prevARVal) / prevARVal) * 100;
      if (arIncreasePct >= thresholds.arIncreaseThreshold) {
        const trace = makeTraceability('accountsReceivable', arVal);
        rawAlerts.push({
          id: `alert-ar-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          type: 'AR_INCREASE',
          severity: 'MEDIUM',
          title: 'Accounts Receivable Expansion',
          message: `Accounts receivable expanded by ${arIncreasePct.toFixed(1)}%, exceeding threshold of ${thresholds.arIncreaseThreshold}%.`,
          metric: 'accountsReceivable',
          value: arVal,
          threshold: thresholds.arIncreaseThreshold,
          period,
          source: sourceMode,
          traceability: trace,
          dataCoverage: current.dataCoverageStatus
        });

        rawInsights.push({
          id: `insight-ar-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          period,
          metric: 'accountsReceivable',
          insightType: 'AR',
          severity: 'MEDIUM',
          title: 'AR Increase Observed',
          summary: `Accounts receivable grew by ${arIncreasePct.toFixed(1)}% to £${arVal.toLocaleString()}.`,
          value: arVal,
          comparisonValue: prevARVal,
          delta: arVal - prevARVal,
          deltaPct: arIncreasePct,
          currency: current.currency || 'GBP',
          sourceMetrics: ['accountsReceivable'],
          calculationSource: sourceMode,
          dataCoverage: current.dataCoverageStatus,
          confidence: 0.95,
          warnings: [],
          traceability: trace,
          createdAt: now
        });
      }
    }

    // 7. AP INCREASE
    const apVal = workingCapital.ap.value;
    const prevAPVal = pM ? pM.accountsPayable : null;
    if (apVal !== null && prevAPVal !== null && prevAPVal > 0) {
      const apIncreasePct = ((apVal - prevAPVal) / prevAPVal) * 100;
      if (apIncreasePct >= 15) {
        const trace = makeTraceability('accountsPayable', apVal);
        rawAlerts.push({
          id: `alert-ap-${tenantId}-${period.startDate}`,
          tenantId: String(tenantId),
          type: 'AP_INCREASE',
          severity: 'MEDIUM',
          title: 'Accounts Payable Increase',
          message: `Accounts payable increased by ${apIncreasePct.toFixed(1)}% to £${apVal.toLocaleString()}.`,
          metric: 'accountsPayable',
          value: apVal,
          threshold: 15,
          period,
          source: sourceMode,
          traceability: trace,
          dataCoverage: current.dataCoverageStatus
        });
      }
    }

    // 8. EBITDA UNAVAILABLE
    if (profitability.ebitda.status === 'NOT_AVAILABLE' || profitability.ebitda.value === null) {
      const trace = makeTraceability('ebitda', null);
      rawAlerts.push({
        id: `alert-ebitda-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        type: 'EBITDA_UNAVAILABLE',
        severity: 'LOW',
        title: 'EBITDA Unavailable',
        message: 'EBITDA is unavailable due to unsegregated depreciation/amortization accounts in source data.',
        metric: 'ebitda',
        value: null,
        threshold: 0,
        period,
        source: sourceMode,
        traceability: trace,
        dataCoverage: current.dataCoverageStatus
      });

      rawInsights.push({
        id: `insight-ebitda-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        period,
        metric: 'ebitda',
        insightType: 'DATA_QUALITY',
        severity: 'LOW',
        title: 'EBITDA Unsegregated Warning',
        summary: 'EBITDA calculation paused because Depreciation and Amortization are not explicitly mapped.',
        value: null,
        comparisonValue: null,
        delta: null,
        deltaPct: null,
        currency: current.currency || 'GBP',
        sourceMetrics: [],
        calculationSource: sourceMode,
        dataCoverage: current.dataCoverageStatus,
        confidence: 0.5,
        warnings: ['Depreciation/Amortization accounts require review.'],
        traceability: trace,
        createdAt: now
      });
    }

    // 9. DATA QUALITY WARNING
    if (current.dataCoverageStatus !== 'DATA_COMPLETE' || current.mappingCoveragePct < 100) {
      const trace = makeTraceability('dataCoverageStatus', current.dataCoverageStatus);
      rawAlerts.push({
        id: `alert-dq-${tenantId}-${period.startDate}`,
        tenantId: String(tenantId),
        type: 'DATA_QUALITY_WARNING',
        severity: 'MEDIUM',
        title: 'Data Coverage Warning',
        message: `Data coverage status is ${current.dataCoverageStatus} with ${current.mappingCoveragePct}% account mapping coverage.`,
        metric: 'dataCoverageStatus',
        value: null,
        threshold: 100,
        period,
        source: sourceMode,
        traceability: trace,
        dataCoverage: current.dataCoverageStatus
      });
    }

    // Deduplicate Alerts by (type + metric + tenantId + startDate + endDate)
    const seenAlerts = new Set<string>();
    const alerts: CFOAlert[] = [];
    for (const a of rawAlerts) {
      const key = `${a.type}_${a.metric}_${a.tenantId}_${a.period.startDate}_${a.period.endDate}`;
      if (!seenAlerts.has(key)) {
        seenAlerts.add(key);
        alerts.push(a);
      }
    }

    // Deduplicate Insights by (insightType + metric + tenantId + startDate + endDate)
    const seenInsights = new Set<string>();
    const insights: CFOInsight[] = [];
    for (const i of rawInsights) {
      const key = `${i.insightType}_${i.metric}_${i.tenantId}_${i.period.startDate}_${i.period.endDate}`;
      if (!seenInsights.has(key)) {
        seenInsights.add(key);
        insights.push(i);
      }
    }

    return { alerts, insights };
  }
}
