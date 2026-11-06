import { db } from '@/lib/db';
import { ProfitAndLossService } from './ProfitAndLossService';
import { BalanceSheetParser } from './BalanceSheetParser';
import { CanonicalMetricEngine, CanonicalCFOEngineResult } from './CanonicalMetricEngine';

export type ReconciliationDifferenceReason =
  | 'MATCH'
  | 'PARTIAL_TRANSACTION_SOURCE'
  | 'UNMAPPED_ACCOUNT'
  | 'CREDIT_NOTE_TIMING'
  | 'REPORT_PERIOD_DIFFERENCE'
  | 'ROUNDING'
  | 'TAX_TREATMENT'
  | 'CURRENCY_CONVERSION'
  | 'SOURCE_DATA_MISSING'
  | 'TRUE_UNEXPECTED_DIFFERENCE';

export interface MetricReconciliationItem {
  metricKey: string;
  metricLabel: string;
  legacyValue: number | null;
  canonicalValue: number | null;
  absoluteDifference: number;
  percentageDifference: number;
  status: 'MATCH' | 'EXPECTED_DIFFERENCE' | 'UNEXPECTED_DIFFERENCE' | 'INCOMPLETE' | 'NOT_AVAILABLE' | 'NOT_COMPARABLE';
  differenceReason: ReconciliationDifferenceReason;
  notes?: string;
}

export interface CFOReconciliationResult {
  tenantId: number;
  generatedAt: string;
  period: {
    fromDate: string;
    toDate: string;
  };
  overallStatus: 'MATCH' | 'MISMATCH' | 'INCOMPLETE';
  reconciliationItems: MetricReconciliationItem[];
  canonicalResult: CanonicalCFOEngineResult;
  legacySummary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingProfit: number;
    ebitda: number | null;
    netProfit: number;
    totalCash: number;
  };
  mappingSummary: {
    totalAccounts: number;
    confirmedCount: number;
    customOverrideCount: number;
    suggestedCount: number;
    unmappedCount: number;
  };
}

export class CFOReconciliationService {
  /**
   * Compares Legacy CFO engine output vs Canonical CFO engine output for a given tenant and period.
   */
  static async reconcileTenantMetrics(
    tenantId: number,
    fromDateStr?: string,
    toDateStr?: string
  ): Promise<CFOReconciliationResult> {
    const cleanFrom = fromDateStr || '2020-01-01';
    const cleanTo = toDateStr || '2030-12-31';

    // 1. Calculate Canonical Metrics
    const canonicalResult = await CanonicalMetricEngine.calculateMetrics(tenantId, cleanFrom, cleanTo);

    // 2. Fetch Legacy Metrics from Xero Report Cache / Legacy Parsers
    let legacySummary = {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
      ebitda: null as number | null,
      netProfit: 0,
      totalCash: 0,
      accountsReceivable: 0,
      accountsPayable: 0
    };

    try {
      const pnlReport = await db.getReport(tenantId, 'ProfitAndLoss');
      if (pnlReport) {
        const rawPnl = typeof pnlReport === 'string' ? JSON.parse(pnlReport) : (pnlReport.raw_data || pnlReport);
        const parsedPnl = ProfitAndLossService.parseReport(rawPnl);
        legacySummary.revenue = parsedPnl.revenue;
        legacySummary.cogs = parsedPnl.cogs;
        legacySummary.grossProfit = parsedPnl.grossProfit;
        legacySummary.operatingExpenses = parsedPnl.operatingExpenses;
        legacySummary.operatingProfit = parsedPnl.operatingProfit;
        legacySummary.ebitda = parsedPnl.ebitda;
        legacySummary.netProfit = parsedPnl.netProfit;
      }
    } catch (e) { }

    try {
      const bsReport = await db.getReport(tenantId, 'BalanceSheet');
      if (bsReport) {
        const rawBs = typeof bsReport === 'string' ? JSON.parse(bsReport) : (bsReport.raw_data || bsReport);
        if (rawBs && rawBs.Rows) {
          legacySummary.totalCash = BalanceSheetParser.findTotalCash(rawBs.Rows) || 0;
        }
      }
    } catch (e) { }

    // Fallback if legacy P&L report cache is empty: compute legacy values directly from DB invoices using legacy logic
    if (legacySummary.revenue === 0 && legacySummary.cogs === 0) {
      const dbInvoices = await db.getInvoices(tenantId);
      if (dbInvoices && Array.isArray(dbInvoices)) {
        for (const inv of dbInvoices) {
          const status = (inv.Status || inv.status || '').toUpperCase();
          if (status === 'VOIDED' || status === 'DELETED' || status === 'DRAFT') continue;

          const isACCREC = (inv.Type || inv.type || '').toUpperCase() === 'ACCREC';
          const total = parseFloat(inv.Total || inv.total || inv.SubTotal || 0);

          if (isACCREC) {
            legacySummary.revenue += total;
          } else {
            legacySummary.cogs += total;
          }
        }
        legacySummary.grossProfit = legacySummary.revenue - legacySummary.cogs;
        legacySummary.operatingProfit = legacySummary.grossProfit - legacySummary.operatingExpenses;
        legacySummary.netProfit = legacySummary.operatingProfit;
      }
    }

    // Compare metrics with explicit difference classification
    const compareItem = (
      key: string,
      label: string,
      legacyVal: number | null,
      canonicalVal: number | null
    ): MetricReconciliationItem => {
      if (legacyVal === null || canonicalVal === null) {
        return {
          metricKey: key,
          metricLabel: label,
          legacyValue: legacyVal,
          canonicalValue: canonicalVal,
          absoluteDifference: 0,
          percentageDifference: 0,
          status: 'NOT_AVAILABLE',
          differenceReason: 'SOURCE_DATA_MISSING',
          notes: 'Calculation is NOT_AVAILABLE due to missing required adjustment data.'
        };
      }

      const absDiff = Math.round(Math.abs(legacyVal - canonicalVal) * 100) / 100;
      const pctDiff = legacyVal !== 0 
        ? Math.round((absDiff / Math.abs(legacyVal)) * 100 * 100) / 100 
        : (canonicalVal !== 0 ? 100 : 0);

      let itemStatus: 'MATCH' | 'EXPECTED_DIFFERENCE' | 'UNEXPECTED_DIFFERENCE' | 'INCOMPLETE' | 'NOT_AVAILABLE' | 'NOT_COMPARABLE' = 'MATCH';
      let diffReason: ReconciliationDifferenceReason = 'MATCH';
      let notes = 'Calculations match cleanly.';

      if (canonicalResult.calculationStatus === 'PARTIAL_MAPPING') {
        itemStatus = 'INCOMPLETE';
        diffReason = 'UNMAPPED_ACCOUNT';
        notes = 'Canonical calculation contains unmapped/unconfirmed account(s).';
      } else if (absDiff >= 0.01) {
        if (absDiff < 1.00) {
          itemStatus = 'EXPECTED_DIFFERENCE';
          diffReason = 'ROUNDING';
          notes = `Minor rounding difference of £${absDiff}.`;
        } else if (canonicalResult.dataCoverageStatus === 'DATA_PARTIAL') {
          itemStatus = 'EXPECTED_DIFFERENCE';
          diffReason = 'PARTIAL_TRANSACTION_SOURCE';
          notes = `Difference of £${absDiff} (${pctDiff}%). Due to transaction dataset coverage (invoices/bills) vs full Xero P&L report.`;
        } else {
          itemStatus = 'UNEXPECTED_DIFFERENCE';
          diffReason = 'TRUE_UNEXPECTED_DIFFERENCE';
          notes = `Unexplained calculation difference of £${absDiff} (${pctDiff}%) between canonical calculation and report cache.`;
        }
      }

      return {
        metricKey: key,
        metricLabel: label,
        legacyValue: Math.round(legacyVal * 100) / 100,
        canonicalValue: Math.round(canonicalVal * 100) / 100,
        absoluteDifference: absDiff,
        percentageDifference: pctDiff,
        status: itemStatus,
        differenceReason: diffReason,
        notes
      };
    };

    const items: MetricReconciliationItem[] = [
      compareItem('revenue', 'Revenue', legacySummary.revenue, canonicalResult.metrics.revenue.value),
      compareItem('costOfSales', 'Cost of Sales (COGS)', legacySummary.cogs, canonicalResult.metrics.costOfSales.value),
      compareItem('grossProfit', 'Gross Profit', legacySummary.grossProfit, canonicalResult.metrics.grossProfit.value),
      compareItem('grossMarginPct', 'Gross Margin %', legacySummary.revenue > 0 ? (legacySummary.grossProfit / legacySummary.revenue) * 100 : 0, canonicalResult.metrics.grossMarginPct.value),
      compareItem('operatingExpenses', 'Operating Expenses', legacySummary.operatingExpenses, canonicalResult.metrics.operatingExpenses.value),
      compareItem('operatingProfit', 'Operating Profit', legacySummary.operatingProfit, canonicalResult.metrics.operatingProfit.value),
      compareItem('ebitda', 'EBITDA', legacySummary.ebitda, canonicalResult.metrics.ebitda.value),
      compareItem('netProfit', 'Net Profit', legacySummary.netProfit, canonicalResult.metrics.netProfit.value),
      compareItem('cashBalance', 'Cash Balance', legacySummary.totalCash, canonicalResult.metrics.cashBalance.value),
      compareItem('accountsReceivable', 'Accounts Receivable', legacySummary.accountsReceivable, canonicalResult.metrics.accountsReceivable.value),
      compareItem('accountsPayable', 'Accounts Payable', legacySummary.accountsPayable, canonicalResult.metrics.accountsPayable.value)
    ];

    const hasMismatches = items.some(i => i.status === 'UNEXPECTED_DIFFERENCE');
    const hasIncomplete = items.some(i => i.status === 'INCOMPLETE');

    const overallStatus: 'MATCH' | 'MISMATCH' | 'INCOMPLETE' = hasIncomplete 
      ? 'INCOMPLETE' 
      : (hasMismatches ? 'MISMATCH' : 'MATCH');

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      period: { fromDate: cleanFrom, toDate: cleanTo },
      overallStatus,
      reconciliationItems: items,
      canonicalResult,
      legacySummary: {
        revenue: Math.round(legacySummary.revenue * 100) / 100,
        cogs: Math.round(legacySummary.cogs * 100) / 100,
        grossProfit: Math.round(legacySummary.grossProfit * 100) / 100,
        operatingExpenses: Math.round(legacySummary.operatingExpenses * 100) / 100,
        operatingProfit: Math.round(legacySummary.operatingProfit * 100) / 100,
        ebitda: legacySummary.ebitda !== null ? Math.round(legacySummary.ebitda * 100) / 100 : null,
        netProfit: Math.round(legacySummary.netProfit * 100) / 100,
        totalCash: Math.round(legacySummary.totalCash * 100) / 100
      },
      mappingSummary: canonicalResult.mappingSummary
    };
  }
}
