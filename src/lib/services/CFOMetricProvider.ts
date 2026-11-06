import { db } from '@/lib/db';
import { CanonicalMetricEngine, DataCoverageStatus, MappingCoverageStatus } from './CanonicalMetricEngine';
import { CFOReconciliationService, CFOReconciliationResult, ReconciliationDifferenceReason } from './CFOReconciliationService';
import { ProfitAndLossService } from './ProfitAndLossService';
import { BalanceSheetParser } from './BalanceSheetParser';

export type CFOCalculationSource = 'CANONICAL' | 'LEGACY' | 'INCOMPLETE' | 'SHADOW';
export type CFOMappingStatus = 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED' | 'NOT_AVAILABLE';
export type CFOConfidence = 'AUTHORISED' | 'AUTHORITATIVE' | 'INCOMPLETE' | 'FALLBACK' | 'NOT_AVAILABLE';
export type CFOEngineMode = 'LEGACY' | 'SHADOW' | 'CANONICAL';

/**
 * Standardized single CFO Metric Contract across all dashboard endpoints
 */
export interface StandardCFOMetricContract {
  value: number | null;
  status: 'COMPLETE' | 'PARTIAL_MAPPING' | 'UNMAPPED_ACCOUNTS' | 'NOT_AVAILABLE' | 'INCOMPLETE';
  calculationSource: CFOCalculationSource;
  dataCoverage: DataCoverageStatus;
  mappingCoverage: MappingCoverageStatus;
  mappingStatus?: MappingCoverageStatus;
  reconciliationStatus?: 'MATCH' | 'EXPECTED_DIFFERENCE' | 'UNEXPECTED_DIFFERENCE' | 'INCOMPLETE' | 'NOT_AVAILABLE' | 'NOT_COMPARABLE';
  differenceReason?: ReconciliationDifferenceReason;
  confidence: CFOConfidence;
  warnings: string[];
  unmappedAccountsCount?: number;
  period?: { fromDate: string; toDate: string };
  currency?: string;
}

export interface CFOMetricGroupResponse {
  tenantId: number;
  period: {
    fromDate: string;
    toDate: string;
  };
  currency: string;
  calculationSource: CFOCalculationSource;
  mappingStatus: CFOMappingStatus;
  dataCoverageStatus: DataCoverageStatus;
  mappingCoverageStatus: MappingCoverageStatus;
  engineMode: CFOEngineMode;
  metrics: {
    revenue: StandardCFOMetricContract;
    costOfSales: StandardCFOMetricContract;
    grossProfit: StandardCFOMetricContract;
    grossMarginPct: StandardCFOMetricContract;
    operatingExpenses: StandardCFOMetricContract;
    operatingProfit: StandardCFOMetricContract;
    ebitda: StandardCFOMetricContract;
    netProfit: StandardCFOMetricContract;
    cashBalance: StandardCFOMetricContract;
    accountsReceivable: StandardCFOMetricContract;
    accountsPayable: StandardCFOMetricContract;
  };
  mappingSummary: {
    totalAccounts: number;
    confirmedCount: number;
    customOverrideCount: number;
    suggestedCount: number;
    unmappedCount: number;
  };
  reconciliation?: CFOReconciliationResult;
}

export interface CFOMetricProvider {
  getMetrics(tenantId: number, fromDateStr?: string, toDateStr?: string): Promise<CFOMetricGroupResponse>;
}

export class LegacyCFOMetricProvider implements CFOMetricProvider {
  async getMetrics(tenantId: number, fromDateStr?: string, toDateStr?: string): Promise<CFOMetricGroupResponse> {
    const today = new Date();
    const cleanFrom = fromDateStr || `${today.getFullYear()}-01-01`;
    const cleanTo = toDateStr || today.toISOString().slice(0, 10);

    let totalRevenue = 0;
    let cogs = 0;
    let grossProfit = 0;
    let opex = 0;
    let operatingProfit = 0;
    let netProfit = 0;
    let ebitdaVal: number | null = null;
    let hasEbitdaData = false;
    let cash = 0;
    let ar = 0;
    let ap = 0;

    try {
      const pnlReport = await db.getReport(tenantId, 'ProfitAndLoss');
      if (pnlReport) {
        const rawPnl = typeof pnlReport === 'string' ? JSON.parse(pnlReport) : (pnlReport.raw_data || pnlReport);
        const parsed = ProfitAndLossService.parseReport(rawPnl);
        totalRevenue = parsed.revenue;
        cogs = parsed.cogs;
        grossProfit = parsed.grossProfit;
        opex = parsed.operatingExpenses;
        operatingProfit = parsed.operatingProfit;
        netProfit = parsed.netProfit;
        if (parsed.ebitda !== null) {
          ebitdaVal = parsed.ebitda;
          hasEbitdaData = true;
        }
      }
    } catch (e) { }

    try {
      const bsReport = await db.getReport(tenantId, 'BalanceSheet');
      if (bsReport) {
        const rawBs = typeof bsReport === 'string' ? JSON.parse(bsReport) : (bsReport.raw_data || bsReport);
        if (rawBs && rawBs.Rows) {
          cash = BalanceSheetParser.findTotalCash(rawBs.Rows) || 0;
        }
      }
    } catch (e) { }

    let invoiceFallbackUsed = false;
    if (totalRevenue === 0 && cogs === 0) {
      invoiceFallbackUsed = true;
      const invoices = await db.getInvoices(tenantId);
      for (const inv of invoices) {
        const status = (inv.Status || inv.status || '').toUpperCase();
        if (status === 'VOIDED' || status === 'DELETED') continue;

        const isACCREC = (inv.Type || inv.type || '').toUpperCase() === 'ACCREC';
        const total = parseFloat(inv.Total || inv.total || 0);
        const due = parseFloat(inv.AmountDue || inv.amount_due || 0);

        if (isACCREC) {
          totalRevenue += total;
          if (due > 0) ar += due;
        } else {
          opex += total;
          if (due > 0) ap += due;
        }
      }
      // Invoice totals do not contain a reliable COGS or P&L expense split.
      // Keep those metrics unavailable instead of estimating them with a ratio.
      cogs = 0;
      grossProfit = 0;
      operatingProfit = 0;
      netProfit = 0;
    } else if (operatingProfit === 0 && (grossProfit !== 0 || opex !== 0)) {
      operatingProfit = grossProfit - opex;
    }

    const grossMarginPct = totalRevenue > 0 ? Math.round(((grossProfit / totalRevenue) * 100) * 100) / 100 : 0;

    const wrapLegacyItem = (
      val: number | null,
      customStatus?: CFOMappingStatus,
      customConfidence?: CFOConfidence,
      customWarnings?: string[]
    ): StandardCFOMetricContract => ({
      value: val,
      status: 'COMPLETE',
      calculationSource: 'LEGACY',
      dataCoverage: 'DATA_PARTIAL',
      mappingCoverage: 'UNMAPPED',
      reconciliationStatus: 'EXPECTED_DIFFERENCE',
      differenceReason: 'PARTIAL_TRANSACTION_SOURCE',
      confidence: customConfidence || 'FALLBACK',
      warnings: customWarnings || ['Only cached transaction totals were available; statement metrics require a Xero P&L report.'],
      period: { fromDate: cleanFrom, toDate: cleanTo },
      currency: 'GBP'
    });

    return {
      tenantId,
      period: { fromDate: cleanFrom, toDate: cleanTo },
      currency: 'GBP',
      calculationSource: 'LEGACY',
      mappingStatus: 'UNMAPPED',
      dataCoverageStatus: 'DATA_PARTIAL',
      mappingCoverageStatus: 'UNMAPPED',
      engineMode: 'LEGACY',
      metrics: {
        revenue: wrapLegacyItem(totalRevenue),
        costOfSales: wrapLegacyItem(invoiceFallbackUsed ? null : cogs),
        grossProfit: wrapLegacyItem(invoiceFallbackUsed ? null : grossProfit),
        grossMarginPct: wrapLegacyItem(invoiceFallbackUsed ? null : grossMarginPct),
        operatingExpenses: wrapLegacyItem(opex),
        operatingProfit: wrapLegacyItem(invoiceFallbackUsed ? null : operatingProfit),
        ebitda: wrapLegacyItem(
          ebitdaVal,
          hasEbitdaData ? 'UNMAPPED' : 'NOT_AVAILABLE',
          hasEbitdaData ? 'FALLBACK' : 'NOT_AVAILABLE',
          hasEbitdaData
            ? ['Calculated using legacy fallback engine']
            : ['EBITDA cannot be calculated reliably from the currently mapped accounting data.']
        ),
        netProfit: wrapLegacyItem(invoiceFallbackUsed ? null : netProfit),
        cashBalance: wrapLegacyItem(cash),
        accountsReceivable: wrapLegacyItem(ar),
        accountsPayable: wrapLegacyItem(ap)
      },
      mappingSummary: {
        totalAccounts: 0,
        confirmedCount: 0,
        customOverrideCount: 0,
        suggestedCount: 0,
        unmappedCount: 0
      }
    };
  }
}

export class CanonicalCFOMetricProvider implements CFOMetricProvider {
  async getMetrics(tenantId: number, fromDateStr?: string, toDateStr?: string): Promise<CFOMetricGroupResponse> {
    const canonicalResult = await CanonicalMetricEngine.calculateMetrics(tenantId, fromDateStr, toDateStr);

    const isPartial = canonicalResult.calculationStatus === 'PARTIAL_MAPPING';

    const wrapCanonicalItem = (valObj: any): StandardCFOMetricContract => {
      const isNullVal = valObj.value === null;
      const isItemIncomplete = isPartial || valObj.status === 'PARTIAL_MAPPING' || valObj.mappingStatus === 'PARTIAL_MAPPING' || valObj.status === 'INCOMPLETE';
      
      let mapStatus: CFOMappingStatus = isNullVal ? 'NOT_AVAILABLE' : (isItemIncomplete ? 'PARTIAL_MAPPING' : (valObj.mappingStatus || 'COMPLETE'));
      let conf: CFOConfidence = isNullVal ? 'NOT_AVAILABLE' : (isItemIncomplete ? 'INCOMPLETE' : (valObj.confidence || 'AUTHORITATIVE'));

      if (isNullVal || valObj.status === 'NOT_AVAILABLE') {
        mapStatus = 'NOT_AVAILABLE';
        conf = 'INCOMPLETE';
      }

      let warnings: string[] = [];
      if (valObj.warnings && Array.isArray(valObj.warnings)) {
        warnings = [...valObj.warnings];
      }
      
      if (isItemIncomplete || isNullVal || valObj.status === 'NOT_AVAILABLE' || mapStatus === 'PARTIAL_MAPPING') {
        if (!warnings.some(w => w.includes('/settings?tab=mappings'))) {
          warnings.push(`Account mapping requires review (${valObj.unmappedAccountsCount || canonicalResult.mappingSummary.suggestedCount || 0} account(s) pending user confirmation in Settings → Account Mappings [/settings?tab=mappings])`);
        }
      }

      return {
        value: valObj.value,
        status: isNullVal ? 'NOT_AVAILABLE' : (isItemIncomplete ? 'PARTIAL_MAPPING' : 'COMPLETE'),
        calculationSource: 'CANONICAL',
        dataCoverage: valObj.dataCoverage || 'DATA_PARTIAL',
        mappingStatus: mapStatus,
        mappingCoverage: mapStatus,
        reconciliationStatus: isNullVal ? 'NOT_AVAILABLE' : (isItemIncomplete ? 'INCOMPLETE' : 'MATCH'),
        differenceReason: isNullVal ? 'SOURCE_DATA_MISSING' : (isItemIncomplete ? 'UNMAPPED_ACCOUNT' : 'MATCH'),
        confidence: conf,
        warnings,
        unmappedAccountsCount: valObj.unmappedAccountsCount || 0,
        period: canonicalResult.period,
        currency: 'GBP'
      };
    };

    return {
      tenantId,
      period: canonicalResult.period,
      currency: 'GBP',
      calculationSource: isPartial ? 'INCOMPLETE' : 'CANONICAL',
      mappingStatus: isPartial ? 'PARTIAL_MAPPING' : 'COMPLETE',
      dataCoverageStatus: canonicalResult.dataCoverageStatus,
      mappingCoverageStatus: canonicalResult.mappingCoverageStatus,
      engineMode: 'CANONICAL',
      metrics: {
        revenue: wrapCanonicalItem(canonicalResult.metrics.revenue),
        costOfSales: wrapCanonicalItem(canonicalResult.metrics.costOfSales),
        grossProfit: wrapCanonicalItem(canonicalResult.metrics.grossProfit),
        grossMarginPct: wrapCanonicalItem(canonicalResult.metrics.grossMarginPct),
        operatingExpenses: wrapCanonicalItem(canonicalResult.metrics.operatingExpenses),
        operatingProfit: wrapCanonicalItem(canonicalResult.metrics.operatingProfit),
        ebitda: wrapCanonicalItem(canonicalResult.metrics.ebitda),
        netProfit: wrapCanonicalItem(canonicalResult.metrics.netProfit),
        cashBalance: wrapCanonicalItem(canonicalResult.metrics.cashBalance),
        accountsReceivable: wrapCanonicalItem(canonicalResult.metrics.accountsReceivable),
        accountsPayable: wrapCanonicalItem(canonicalResult.metrics.accountsPayable)
      },
      mappingSummary: canonicalResult.mappingSummary
    };
  }
}

export class CFOMetricProviderFactory {
  static async getTenantMode(tenantId: number): Promise<CFOEngineMode> {
    return (await db.getTenantEngineMode(tenantId)) || 'LEGACY';
  }

  static async setTenantMode(tenantId: number, mode: CFOEngineMode): Promise<void> {
    await db.saveTenantEngineMode(tenantId, mode);
  }

  static async getMetricsForTenant(tenantId: number, fromDateStr?: string, toDateStr?: string): Promise<CFOMetricGroupResponse> {
    const configuredMode = await this.getTenantMode(tenantId);

    if (configuredMode === 'CANONICAL') {
      const canonicalProvider = new CanonicalCFOMetricProvider();
      return await canonicalProvider.getMetrics(tenantId, fromDateStr, toDateStr);
    }

    if (configuredMode === 'SHADOW') {
      const legacyProvider = new LegacyCFOMetricProvider();
      const legacyRes = await legacyProvider.getMetrics(tenantId, fromDateStr, toDateStr);
      const reconciliation = await CFOReconciliationService.reconcileTenantMetrics(tenantId, fromDateStr, toDateStr);

      return {
        ...legacyRes,
        calculationSource: 'SHADOW',
        engineMode: 'SHADOW',
        reconciliation
      };
    }

    // Default: LEGACY mode
    const legacyProvider = new LegacyCFOMetricProvider();
    return await legacyProvider.getMetrics(tenantId, fromDateStr, toDateStr);
  }

  static async getProvider(tenantId: number, overrideMode?: CFOEngineMode): Promise<CFOMetricGroupResponse> {
    if (overrideMode) {
      if (overrideMode === 'CANONICAL') return new CanonicalCFOMetricProvider().getMetrics(tenantId);
      if (overrideMode === 'LEGACY') return new LegacyCFOMetricProvider().getMetrics(tenantId);
    }
    return this.getMetricsForTenant(tenantId);
  }
}
