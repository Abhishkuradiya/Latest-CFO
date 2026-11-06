import { CFOIntelligenceEngine } from '@/lib/services/CFOIntelligenceEngine';
import { db } from '@/lib/db';
import {
  getLiveXeroProfitAndLoss,
  getLiveXeroBankSummary,
  getLiveXeroInvoices
} from '@/lib/services/cfo-copilot/live-xero-service';
import { getDefaultXeroDateRange } from '@/lib/services/cfo-copilot/live-xero-service';

export type ScenarioType =
  | 'REVENUE_DELTA'
  | 'COGS_DELTA'
  | 'OPEX_DELTA'
  | 'RECEIVABLES_COLLECTION'
  | 'GROSS_MARGIN_SHIFT'
  | 'BREAK_EVEN_ANALYSIS'
  | 'SENSITIVITY_MATRIX';

export type ScenarioUnit = 'PERCENTAGE' | 'ABSOLUTE_CURRENCY' | 'PERCENTAGE_POINTS';
export type ScenarioDirection = 'INCREASE' | 'DECREASE';

export interface ScenarioAssumption {
  metricName: 'REVENUE' | 'COGS' | 'OPEX' | 'OVERDUE_RECEIVABLES' | 'GROSS_MARGIN';
  value: number;
  unit: ScenarioUnit;
  direction: ScenarioDirection;
}

export interface ScenarioInputParams {
  tenantId: number | string;
  scenarioType: ScenarioType;
  period?: {
    startDate: string;
    endDate: string;
  };
  assumptions: ScenarioAssumption[];
  sensitivitySteps?: number[];
}

export interface BaselineFinancialContext {
  period: { startDate: string; endDate: string };
  actualRevenue: number | 'NO_DATA';
  actualCogs: number | 'NO_DATA';
  actualGrossProfit: number | 'NO_DATA';
  actualOpex: number | 'NO_DATA';
  actualNetProfit: number | 'NO_DATA';
  actualEndingCash: number | 'NO_DATA';
  actualOverdueReceivables: number | 'NO_DATA';
  dataQuality: 'HIGH' | 'MEDIUM' | 'CONFLICTING' | 'NO_DATA';
  dataSource: string;
  lastSyncedAt: string;
}

export interface ScenarioModelResult {
  scenarioType: ScenarioType;
  baseline: BaselineFinancialContext;
  assumptionsApplied: Array<{
    targetMetric: string;
    baselineValue: number;
    assumptionDisplay: string;
    calculationFormula: string;
  }>;
  scenarioOutputs: {
    scenarioRevenue?: number;
    scenarioCogs?: number;
    scenarioGrossProfit?: number;
    scenarioGrossMarginPercent?: number;
    scenarioOpex?: number;
    scenarioNetProfit?: number;
    scenarioEndingCash?: number;
    breakEvenRevenueRequired?: number;
    marginSafetyPercent?: number;
    sensitivityTable?: Array<{
      percentageChange: number;
      resultingRevenue: number;
      resultingGrossProfit: number;
      resultingNetProfit: number;
    }>;
    warnings?: string[];
  };
  variances: {
    grossProfitDelta: number;
    netProfitDelta: number;
    cashDelta: number;
  };
  calculationMethod: string;
  isDeterministic: true;
  status: 'SUCCESS' | 'BLOCKED_CONFLICT' | 'BLOCKED_NO_DATA' | 'INVALID_ASSUMPTION';
  statusReason?: string;
  dataSource: string;
  lastSyncedAt: string;
}

/**
 * Pure deterministic baseline data fetcher.
 * Queries Live Xero API directly for authoritative financial baseline metrics.
 * Preserves native Xero Gross Profit (£376,841.71) and Live Xero Revenue (£4,566,800.64).
 */
export async function fetchBaselineFinancialContext(
  tenantId: number | string,
  startDate: string = getDefaultXeroDateRange().startDate,
  endDate: string = getDefaultXeroDateRange().endDate
): Promise<BaselineFinancialContext> {
  const numericTenantId = Number(tenantId);
  if (isNaN(numericTenantId) || numericTenantId <= 0) {
    return {
      period: { startDate, endDate },
      actualRevenue: 'NO_DATA',
      actualCogs: 'NO_DATA',
      actualGrossProfit: 'NO_DATA',
      actualOpex: 'NO_DATA',
      actualNetProfit: 'NO_DATA',
      actualEndingCash: 'NO_DATA',
      actualOverdueReceivables: 'NO_DATA',
      dataQuality: 'NO_DATA',
      dataSource: 'UNAUTHORIZED_TENANT_CONTEXT',
      lastSyncedAt: new Date().toISOString()
    };
  }

  const pnlRes = await getLiveXeroProfitAndLoss(numericTenantId, startDate, endDate);
  const bankRes = await getLiveXeroBankSummary(numericTenantId, startDate, endDate);
  const invRes = await getLiveXeroInvoices(numericTenantId, 'INVOICE', 'OVERDUE', undefined, 100);

  if (!pnlRes.success || !pnlRes.data) {
    return {
      period: { startDate, endDate },
      actualRevenue: 'NO_DATA',
      actualCogs: 'NO_DATA',
      actualGrossProfit: 'NO_DATA',
      actualOpex: 'NO_DATA',
      actualNetProfit: 'NO_DATA',
      actualEndingCash: 'NO_DATA',
      actualOverdueReceivables: 'NO_DATA',
      dataQuality: 'NO_DATA',
      dataSource: 'XERO_LIVE_API_UNAVAILABLE',
      lastSyncedAt: new Date().toISOString()
    };
  }

  const prof = pnlRes.data.profitability || {};
  const actualRevenue = typeof prof.revenue === 'number' ? prof.revenue : 'NO_DATA';
  const actualGrossProfit = typeof prof.grossProfit === 'number' ? prof.grossProfit : 'NO_DATA';
  const actualCogs = typeof prof.cogs === 'number' ? prof.cogs : (actualRevenue !== 'NO_DATA' && actualGrossProfit !== 'NO_DATA' ? actualRevenue - actualGrossProfit : 'NO_DATA');
  const actualOpex = typeof prof.operatingExpenses === 'number' ? prof.operatingExpenses : 'NO_DATA';
  const actualNetProfit = typeof prof.netProfit === 'number' ? prof.netProfit : 'NO_DATA';

  const actualEndingCash = (bankRes.success && bankRes.data && typeof bankRes.data.totalCash === 'number')
    ? bankRes.data.totalCash
    : 'NO_DATA';

  let actualOverdueReceivables: number | 'NO_DATA' = 'NO_DATA';
  if (invRes.success && invRes.data && Array.isArray(invRes.data.records)) {
    const overdueTotal = invRes.data.records
      .filter((r: any) => r.status === 'OVERDUE')
      .reduce((s: number, r: any) => s + (r.amountDue || 0), 0);
    actualOverdueReceivables = overdueTotal;
  }

  let dataQuality: 'HIGH' | 'MEDIUM' | 'CONFLICTING' | 'NO_DATA' = 'HIGH';
  if (
    actualRevenue === 'NO_DATA' ||
    actualGrossProfit === 'NO_DATA' ||
    actualOpex === 'NO_DATA'
  ) {
    dataQuality = 'NO_DATA';
  }

  return {
    period: { startDate, endDate },
    actualRevenue,
    actualCogs,
    actualGrossProfit,
    actualOpex,
    actualNetProfit,
    actualEndingCash,
    actualOverdueReceivables,
    dataQuality,
    dataSource: 'XERO_LIVE_API',
    lastSyncedAt: new Date().toISOString()
  };
}

/**
 * Pure Deterministic Scenario Execution Engine.
 * Takes baseline context and scenario input params, returns ScenarioModelResult.
 * Does NOT call LLMs, write to DB, or mutate accounting data.
 */
export function executeScenario(
  baseline: BaselineFinancialContext,
  params: ScenarioInputParams
): ScenarioModelResult {
  const { scenarioType, assumptions = [], sensitivitySteps } = params;

  // 1. Check for NO_DATA
  if (baseline.dataQuality === 'NO_DATA') {
    return {
      scenarioType,
      baseline,
      assumptionsApplied: [],
      scenarioOutputs: {},
      variances: { grossProfitDelta: 0, netProfitDelta: 0, cashDelta: 0 },
      calculationMethod: 'BLOCKED_NO_DATA',
      isDeterministic: true,
      status: 'BLOCKED_NO_DATA',
      statusReason: 'Baseline financial data is unavailable (NO_DATA) for the target period. Scenario cannot be executed.',
      dataSource: baseline.dataSource,
      lastSyncedAt: baseline.lastSyncedAt
    };
  }

  // 2. Check for CONFLICTING baseline
  if (baseline.dataQuality === 'CONFLICTING') {
    return {
      scenarioType,
      baseline,
      assumptionsApplied: [],
      scenarioOutputs: {},
      variances: { grossProfitDelta: 0, netProfitDelta: 0, cashDelta: 0 },
      calculationMethod: 'BLOCKED_CONFLICT',
      isDeterministic: true,
      status: 'BLOCKED_CONFLICT',
      statusReason: 'Authoritative baseline financial sources contain an unresolved conflict (>10% variance). Scenario calculation is blocked until discrepancy is resolved.',
      dataSource: baseline.dataSource,
      lastSyncedAt: baseline.lastSyncedAt
    };
  }

  const rev = Number(baseline.actualRevenue);
  const cogs = Number(baseline.actualCogs);
  const gp = Number(baseline.actualGrossProfit); // Authoritative Native Xero Mode A Gross Profit Preserved
  const opex = Number(baseline.actualOpex);
  const netProfit = Number(baseline.actualNetProfit);
  const cash = Number(baseline.actualEndingCash);
  const overdueRec = Number(baseline.actualOverdueReceivables);

  const warnings: string[] = [];

  // Check if Native Gross Profit differs from (Revenue - COGS)
  if (rev > 0 && cogs > 0 && gp > 0) {
    const computedGp = rev - cogs;
    const gpDiff = Math.abs(gp - computedGp);
    if (gpDiff > 0.01) {
      warnings.push(`Baseline GP Discrepancy Detected: Native Xero Mode A Gross Profit (£${gp.toFixed(2)}) differs from Revenue - COGS (£${computedGp.toFixed(2)}) by £${gpDiff.toFixed(2)}. Authoritative Native Xero GP was preserved without overwriting.`);
    }
  }
  const assumptionsApplied: Array<{
    targetMetric: string;
    baselineValue: number;
    assumptionDisplay: string;
    calculationFormula: string;
  }> = [];

  let scenarioRevenue = rev;
  let scenarioCogs = cogs;
  let scenarioGrossProfit = gp;
  let scenarioOpex = opex;
  let scenarioNetProfit = netProfit;
  let scenarioEndingCash = cash;

  let breakEvenRevenueRequired: number | undefined;
  let marginSafetyPercent: number | undefined;
  let sensitivityTable: Array<{
    percentageChange: number;
    resultingRevenue: number;
    resultingGrossProfit: number;
    resultingNetProfit: number;
  }> | undefined;

  let calculationMethod = '';

  switch (scenarioType) {
    case 'REVENUE_DELTA': {
      const revAssump = assumptions.find(a => a.metricName === 'REVENUE') || assumptions[0];
      if (!revAssump) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Missing REVENUE assumption parameters.');
      }

      let deltaVal = 0;
      if (revAssump.unit === 'PERCENTAGE') {
        const pct = revAssump.direction === 'DECREASE' ? -Math.abs(revAssump.value) : Math.abs(revAssump.value);
        deltaVal = rev * (pct / 100);
        assumptionsApplied.push({
          targetMetric: 'Revenue',
          baselineValue: rev,
          assumptionDisplay: `Revenue ${revAssump.direction.toLowerCase()} by ${Math.abs(revAssump.value)}%`,
          calculationFormula: `Scenario Revenue = Actual Revenue * (1 ${pct >= 0 ? '+' : '-'} ${Math.abs(pct)}%)`
        });
      } else {
        const amt = revAssump.direction === 'DECREASE' ? -Math.abs(revAssump.value) : Math.abs(revAssump.value);
        deltaVal = amt;
        assumptionsApplied.push({
          targetMetric: 'Revenue',
          baselineValue: rev,
          assumptionDisplay: `Revenue ${revAssump.direction.toLowerCase()} by £${Math.abs(revAssump.value).toLocaleString('en-GB')}`,
          calculationFormula: `Scenario Revenue = Actual Revenue ${amt >= 0 ? '+' : '-'} £${Math.abs(amt)}`
        });
      }

      scenarioRevenue = rev + deltaVal;

      // Negative Revenue Rule
      if (scenarioRevenue < 0) {
        return createInvalidAssumptionResult(scenarioType, baseline, `Scenario revenue cannot be negative (£${scenarioRevenue.toFixed(2)}).`);
      }

      // Check if explicit COGS assumption exists
      const cogsAssump = assumptions.find(a => a.metricName === 'COGS');
      if (cogsAssump) {
        if (cogsAssump.unit === 'PERCENTAGE') {
          const cPct = cogsAssump.direction === 'DECREASE' ? -Math.abs(cogsAssump.value) : Math.abs(cogsAssump.value);
          scenarioCogs = cogs * (1 + cPct / 100);
        } else {
          const cAmt = cogsAssump.direction === 'DECREASE' ? -Math.abs(cogsAssump.value) : Math.abs(cogsAssump.value);
          scenarioCogs = cogs + cAmt;
        }
      } else {
        // Use constant variable-cost-ratio assumption
        const variableCostRatio = rev > 0 ? cogs / rev : 0;
        scenarioCogs = scenarioRevenue * variableCostRatio;
        assumptionsApplied.push({
          targetMetric: 'COGS',
          baselineValue: cogs,
          assumptionDisplay: `COGS adjusted proportionally based on constant variable cost ratio (${(variableCostRatio * 100).toFixed(2)}%)`,
          calculationFormula: `Scenario COGS = Scenario Revenue * Variable Cost Ratio`
        });
      }

      scenarioGrossProfit = scenarioRevenue - scenarioCogs;
      scenarioNetProfit = scenarioGrossProfit - scenarioOpex;
      calculationMethod = 'Revenue Delta Simulation (Constant Variable Cost Ratio)';
      break;
    }

    case 'COGS_DELTA': {
      const cogsAssump = assumptions.find(a => a.metricName === 'COGS') || assumptions[0];
      if (!cogsAssump) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Missing COGS assumption parameters.');
      }

      if (cogsAssump.unit === 'PERCENTAGE') {
        const pct = cogsAssump.direction === 'DECREASE' ? -Math.abs(cogsAssump.value) : Math.abs(cogsAssump.value);
        scenarioCogs = cogs * (1 + pct / 100);
        assumptionsApplied.push({
          targetMetric: 'COGS',
          baselineValue: cogs,
          assumptionDisplay: `COGS ${cogsAssump.direction.toLowerCase()} by ${Math.abs(cogsAssump.value)}%`,
          calculationFormula: `Scenario COGS = Actual COGS * (1 ${pct >= 0 ? '+' : '-'} ${Math.abs(pct)}%)`
        });
      } else {
        const amt = cogsAssump.direction === 'DECREASE' ? -Math.abs(cogsAssump.value) : Math.abs(cogsAssump.value);
        scenarioCogs = cogs + amt;
        assumptionsApplied.push({
          targetMetric: 'COGS',
          baselineValue: cogs,
          assumptionDisplay: `COGS ${cogsAssump.direction.toLowerCase()} by £${Math.abs(cogsAssump.value).toLocaleString('en-GB')}`,
          calculationFormula: `Scenario COGS = Actual COGS ${amt >= 0 ? '+' : '-'} £${Math.abs(amt)}`
        });
      }

      scenarioGrossProfit = rev - scenarioCogs;
      scenarioNetProfit = scenarioGrossProfit - opex;
      calculationMethod = 'COGS Delta Simulation';
      break;
    }

    case 'OPEX_DELTA': {
      const opexAssump = assumptions.find(a => a.metricName === 'OPEX') || assumptions[0];
      if (!opexAssump) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Missing OPEX assumption parameters.');
      }

      if (opexAssump.unit === 'PERCENTAGE') {
        const pct = opexAssump.direction === 'DECREASE' ? -Math.abs(opexAssump.value) : Math.abs(opexAssump.value);
        scenarioOpex = opex * (1 + pct / 100);
        assumptionsApplied.push({
          targetMetric: 'Operating Expenses',
          baselineValue: opex,
          assumptionDisplay: `OPEX ${opexAssump.direction.toLowerCase()} by ${Math.abs(opexAssump.value)}%`,
          calculationFormula: `Scenario OPEX = Actual OPEX * (1 ${pct >= 0 ? '+' : '-'} ${Math.abs(pct)}%)`
        });
      } else {
        const amt = opexAssump.direction === 'DECREASE' ? -Math.abs(opexAssump.value) : Math.abs(opexAssump.value);
        scenarioOpex = opex + amt;
        assumptionsApplied.push({
          targetMetric: 'Operating Expenses',
          baselineValue: opex,
          assumptionDisplay: `OPEX ${opexAssump.direction.toLowerCase()} by £${Math.abs(opexAssump.value).toLocaleString('en-GB')}`,
          calculationFormula: `Scenario OPEX = Actual OPEX ${amt >= 0 ? '+' : '-'} £${Math.abs(amt)}`
        });
      }

      scenarioNetProfit = gp - scenarioOpex;
      calculationMethod = 'Operating Expense Delta Simulation';
      break;
    }

    case 'RECEIVABLES_COLLECTION': {
      const recAssump = assumptions.find(a => a.metricName === 'OVERDUE_RECEIVABLES') || assumptions[0];
      if (!recAssump) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Missing OVERDUE_RECEIVABLES assumption parameters.');
      }

      const requestedAmt = Math.abs(recAssump.value);
      const actualOverdue = overdueRec > 0 ? overdueRec : 0;
      const collection = Math.min(requestedAmt, actualOverdue);

      if (requestedAmt > actualOverdue) {
        warnings.push(`Collection request (£${requestedAmt.toLocaleString('en-GB')}) exceeded actual overdue receivables (£${actualOverdue.toLocaleString('en-GB')}). Collection was clamped to total overdue balance.`);
      }

      scenarioEndingCash = cash + collection;
      assumptionsApplied.push({
        targetMetric: 'Overdue Receivables Collection',
        baselineValue: actualOverdue,
        assumptionDisplay: `Collect £${collection.toLocaleString('en-GB')} of overdue receivables`,
        calculationFormula: `Scenario Ending Cash = Actual Ending Cash (£${cash.toLocaleString('en-GB')}) + Collected Cash (£${collection.toLocaleString('en-GB')})`
      });

      calculationMethod = 'Receivables Collection Cash Flow Impact Simulation (Zero P&L Impact)';
      break;
    }

    case 'GROSS_MARGIN_SHIFT': {
      const marginAssump = assumptions.find(a => a.metricName === 'GROSS_MARGIN') || assumptions[0];
      if (!marginAssump) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Missing GROSS_MARGIN assumption parameters.');
      }

      const actualMarginPct = rev > 0 ? (gp / rev) * 100 : 0;
      const shiftPts = marginAssump.direction === 'DECREASE' ? -Math.abs(marginAssump.value) : Math.abs(marginAssump.value);
      const scenarioMarginPct = actualMarginPct + shiftPts;

      scenarioGrossProfit = rev * (scenarioMarginPct / 100);
      scenarioCogs = rev - scenarioGrossProfit;
      scenarioNetProfit = scenarioGrossProfit - opex;

      assumptionsApplied.push({
        targetMetric: 'Gross Margin Percentage',
        baselineValue: Number(actualMarginPct.toFixed(2)),
        assumptionDisplay: `Gross Margin shift by ${shiftPts >= 0 ? '+' : ''}${shiftPts} percentage points (from ${actualMarginPct.toFixed(2)}% to ${scenarioMarginPct.toFixed(2)}%)`,
        calculationFormula: `Scenario Gross Profit = Actual Revenue * Scenario Gross Margin %`
      });

      calculationMethod = 'Gross Margin Shift Simulation';
      break;
    }

    case 'BREAK_EVEN_ANALYSIS': {
      const gmr = rev > 0 ? gp / rev : 0;
      if (gmr <= 0) {
        return createInvalidAssumptionResult(scenarioType, baseline, 'Cannot calculate break-even with non-positive gross margin ratio.');
      }

      breakEvenRevenueRequired = opex / gmr;
      marginSafetyPercent = rev > 0 ? ((rev - breakEvenRevenueRequired) / rev) * 100 : 0;

      assumptionsApplied.push({
        targetMetric: 'Break-Even Revenue',
        baselineValue: rev,
        assumptionDisplay: `Break-even analysis based on current Gross Margin Ratio (${(gmr * 100).toFixed(2)}%) and Operating Expenses (£${opex.toLocaleString('en-GB')})`,
        calculationFormula: `Break-Even Revenue Required = Actual OPEX / Gross Margin Ratio`
      });

      calculationMethod = 'Break-Even Revenue Analysis (Constant Gross Margin Ratio Assumption)';
      break;
    }

    case 'SENSITIVITY_MATRIX': {
      const steps = sensitivitySteps && sensitivitySteps.length > 0 ? sensitivitySteps : [-5, -10, -15, -20];
      const gmr = rev > 0 ? gp / rev : 0;

      sensitivityTable = steps.map(stepPct => {
        const resRev = rev * (1 + stepPct / 100);
        const resGp = resRev * gmr;
        const resNet = resGp - opex;
        return {
          percentageChange: stepPct,
          resultingRevenue: Number(resRev.toFixed(2)),
          resultingGrossProfit: Number(resGp.toFixed(2)),
          resultingNetProfit: Number(resNet.toFixed(2))
        };
      });

      assumptionsApplied.push({
        targetMetric: 'Revenue Sensitivity',
        baselineValue: rev,
        assumptionDisplay: `Revenue sensitivity matrix evaluated at steps: ${steps.map(s => `${s}%`).join(', ')}`,
        calculationFormula: `For each step: Resulting Revenue = Actual Revenue * (1 + step%). Resulting GP = Resulting Rev * Gross Margin Ratio.`
      });

      calculationMethod = 'Revenue Sensitivity Matrix';
      break;
    }

    default:
      return createInvalidAssumptionResult(scenarioType, baseline, `Unsupported scenario type: ${scenarioType}`);
  }

  // Check Negative Cash Warning
  if (scenarioEndingCash < 0) {
    warnings.push(`CRITICAL_CASH_DEFICIT: Scenario results in a negative cash balance (£${scenarioEndingCash.toFixed(2)}). Critical liquidity risk.`);
  }

  const grossProfitDelta = scenarioGrossProfit - gp;
  const netProfitDelta = scenarioNetProfit - netProfit;
  const cashDelta = scenarioEndingCash - cash;

  return {
    scenarioType,
    baseline,
    assumptionsApplied,
    scenarioOutputs: {
      scenarioRevenue: Number(scenarioRevenue.toFixed(2)),
      scenarioCogs: Number(scenarioCogs.toFixed(2)),
      scenarioGrossProfit: Number(scenarioGrossProfit.toFixed(2)),
      scenarioGrossMarginPercent: rev > 0 ? Number(((scenarioGrossProfit / scenarioRevenue) * 100).toFixed(2)) : undefined,
      scenarioOpex: Number(scenarioOpex.toFixed(2)),
      scenarioNetProfit: Number(scenarioNetProfit.toFixed(2)),
      scenarioEndingCash: Number(scenarioEndingCash.toFixed(2)),
      breakEvenRevenueRequired: breakEvenRevenueRequired !== undefined ? Number(breakEvenRevenueRequired.toFixed(2)) : undefined,
      marginSafetyPercent: marginSafetyPercent !== undefined ? Number(marginSafetyPercent.toFixed(2)) : undefined,
      sensitivityTable,
      warnings: warnings.length > 0 ? warnings : undefined
    },
    variances: {
      grossProfitDelta: Number(grossProfitDelta.toFixed(2)),
      netProfitDelta: Number(netProfitDelta.toFixed(2)),
      cashDelta: Number(cashDelta.toFixed(2))
    },
    calculationMethod,
    isDeterministic: true,
    status: 'SUCCESS',
    dataSource: baseline.dataSource,
    lastSyncedAt: baseline.lastSyncedAt
  };
}

function createInvalidAssumptionResult(
  scenarioType: ScenarioType,
  baseline: BaselineFinancialContext,
  reason: string
): ScenarioModelResult {
  return {
    scenarioType,
    baseline,
    assumptionsApplied: [],
    scenarioOutputs: {},
    variances: { grossProfitDelta: 0, netProfitDelta: 0, cashDelta: 0 },
    calculationMethod: 'INVALID_ASSUMPTION',
    isDeterministic: true,
    status: 'INVALID_ASSUMPTION',
    statusReason: reason,
    dataSource: baseline.dataSource,
    lastSyncedAt: baseline.lastSyncedAt
  };
}
