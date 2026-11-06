import { db } from '../db';
import { CanonicalMetricEngine } from './CanonicalMetricEngine';

export interface VarianceItem {
  metric: string;
  canonicalValue: number | null;
  xeroValue: number | null;
  difference: number | null;
  differencePercent: number | null;
  status: 'MATCH' | 'MISMATCH' | 'DATA_NOT_AVAILABLE' | 'LIMITATION';
  differenceReason?: string;
}

export interface StatementReconciliation {
  period: { startDate: string; endDate: string };
  currency: string;
  metrics: Record<string, VarianceItem>;
}

export interface BalanceSheetReconciliation {
  period: { asOfDate: string };
  currency: string;
  metrics: Record<string, VarianceItem>;
}

export interface ARAPReconciliation {
  ar: {
    canonicalAR: number | null;
    xeroAgedReceivables: number | null;
    balanceSheetAR: number | null;
    difference: number | null;
    semanticNotes: string[];
  };
  ap: {
    canonicalAP: number | null;
    xeroAgedPayables: number | null;
    balanceSheetAP: number | null;
    difference: number | null;
    semanticNotes: string[];
  };
}

export interface TrialBalanceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  canonicalBalance: number;
  xeroTrialBalance: number;
  difference: number;
  mappingStatus: string;
}

export interface MappingImpactReport {
  totalAccounts: number;
  confirmed: number;
  customOverride: number;
  suggested: number;
  unmapped: number;
  archived: number;
  unmappedAccountsDetail: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    financialImpact: number;
    affectsPL: boolean;
    affectsBS: boolean;
    affectsCFOMetrics: boolean;
  }>;
}

export interface InventoryValidationReport {
  inventoryAssets: number | null;
  cogs: number | null;
  stockAdjustments: number | null;
  inventoryValuation: number | null;
  inventoryWriteOffs: number | null;
  valuationMethod: 'XERO_AUTHORITATIVE' | 'CANONICAL_RECONSTRUCTED';
  limitations: string[];
}

export interface TaxValidationReport {
  taxCollected: number | null;
  taxPaid: number | null;
  taxExpense: number | null;
  taxPayable: number | null;
  taxClearingAccounts: number | null;
  notes: string[];
}

export interface RealTenantValidationResult {
  tenantId: string;
  period: { startDate: string; endDate: string };
  pnLReconciliation: StatementReconciliation;
  balanceSheetReconciliation: BalanceSheetReconciliation;
  arApReconciliation: ARAPReconciliation;
  trialBalanceReconciliation: TrialBalanceItem[];
  accountMappingReport: MappingImpactReport;
  inventoryValidation: InventoryValidationReport;
  taxValidation: TaxValidationReport;
}

export class RealTenantAccountingValidation {
  /**
   * Run comprehensive accounting validation against real tenant data in DB.
   */
  static async validateTenant(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<RealTenantValidationResult> {
    const canonicalResult = await CanonicalMetricEngine.calculateFinancials(tenantId, startDate, endDate);
    const xeroPnL = await db.getXeroReport(tenantId, 'ProfitAndLoss', startDate, endDate);
    const xeroBS = await db.getXeroReport(tenantId, 'BalanceSheet', endDate, endDate);
    const xeroTB = await db.getXeroReport(tenantId, 'TrialBalance', endDate, endDate);
    const accounts = await db.getAccounts(tenantId);
    const mappings = await db.getTenantAccountMappings(tenantId);

    // 1. Core Financial Statements (P&L) Reconciliation
    const pnlMetrics = [
      'revenue', 'cogs', 'grossProfit', 'operatingExpenses', 'operatingProfit',
      'otherIncome', 'otherExpenses', 'interest', 'depreciation', 'amortization', 'tax', 'netProfit'
    ];

    const pnlRecMetrics: Record<string, VarianceItem> = {};
    for (const metric of pnlMetrics) {
      const canonicalVal = canonicalResult.metrics[metric] !== undefined ? canonicalResult.metrics[metric] : null;
      const xeroVal = xeroPnL ? xeroPnL[metric] ?? null : null;
      let diff: number | null = null;
      let diffPct: number | null = null;
      let status: VarianceItem['status'] = 'MATCH';
      let reason: string | undefined = undefined;

      if (canonicalVal !== null && xeroVal !== null) {
        diff = canonicalVal - xeroVal;
        diffPct = xeroVal !== 0 ? Math.abs(diff / xeroVal) * 100 : (diff === 0 ? 0 : 100);
        if (Math.abs(diff) > 0.01) {
          status = 'MISMATCH';
          reason = `Canonical ${canonicalVal} differs from Xero P&L ${xeroVal} by ${diff}`;
        }
      } else if (xeroVal === null && canonicalVal !== null) {
        status = 'DATA_NOT_AVAILABLE';
        reason = 'Xero P&L source report unavailable for exact period match';
      } else if (canonicalVal === null) {
        status = 'DATA_NOT_AVAILABLE';
        reason = 'Canonical engine return value is null';
      }

      pnlRecMetrics[metric] = {
        metric,
        canonicalValue: canonicalVal,
        xeroValue: xeroVal,
        difference: diff,
        differencePercent: diffPct,
        status,
        differenceReason: reason
      };
    }

    // 2. Balance Sheet Reconciliation
    const bsMetrics = ['cash', 'accountsReceivable', 'accountsPayable', 'totalAssets', 'totalLiabilities', 'equity'];
    const bsRecMetrics: Record<string, VarianceItem> = {};
    for (const metric of bsMetrics) {
      const canonicalVal = canonicalResult.metrics[metric] !== undefined ? canonicalResult.metrics[metric] : null;
      const xeroVal = xeroBS ? xeroBS[metric] ?? null : null;
      let diff: number | null = null;
      let diffPct: number | null = null;
      let status: VarianceItem['status'] = 'MATCH';
      let reason: string | undefined = undefined;

      if (canonicalVal !== null && xeroVal !== null) {
        diff = canonicalVal - xeroVal;
        diffPct = xeroVal !== 0 ? Math.abs(diff / xeroVal) * 100 : (diff === 0 ? 0 : 100);
        if (Math.abs(diff) > 0.01) {
          status = 'MISMATCH';
          reason = `Canonical ${canonicalVal} differs from Xero BS ${xeroVal} by ${diff}`;
        }
      } else {
        status = 'DATA_NOT_AVAILABLE';
        reason = 'Balance Sheet comparison data unavailable or partial';
      }

      bsRecMetrics[metric] = {
        metric,
        canonicalValue: canonicalVal,
        xeroValue: xeroVal,
        difference: diff,
        differencePercent: diffPct,
        status,
        differenceReason: reason
      };
    }

    // 3. AR/AP Reconciliation
    const agedAR = await db.getXeroReport(tenantId, 'AgedReceivables', startDate, endDate);
    const agedAP = await db.getXeroReport(tenantId, 'AgedPayables', startDate, endDate);

    const canonicalAR = canonicalResult.metrics.accountsReceivable ?? null;
    const xeroAgedAR = agedAR ? agedAR.total : null;
    const bsAR = xeroBS ? xeroBS.accountsReceivable ?? null : null;

    const canonicalAP = canonicalResult.metrics.accountsPayable ?? null;
    const xeroAgedAP = agedAP ? agedAP.total : null;
    const bsAP = xeroBS ? xeroBS.accountsPayable ?? null : null;

    const arApReconciliation: ARAPReconciliation = {
      ar: {
        canonicalAR,
        xeroAgedReceivables: xeroAgedAR,
        balanceSheetAR: bsAR,
        difference: canonicalAR !== null && bsAR !== null ? canonicalAR - bsAR : null,
        semanticNotes: [
          'Aged Receivables includes unapplied prepayments and overpayments which may differ from GL Balance Sheet AR.',
          'Canonical AR is derived from active outstanding invoice balances mapped to Accounts Receivable.'
        ]
      },
      ap: {
        canonicalAP,
        xeroAgedPayables: xeroAgedAP,
        balanceSheetAP: bsAP,
        difference: canonicalAP !== null && bsAP !== null ? canonicalAP - bsAP : null,
        semanticNotes: [
          'Aged Payables includes pending supplier credits and expense claims.',
          'Canonical AP is derived from active outstanding bill balances mapped to Accounts Payable.'
        ]
      }
    };

    // 4. Trial Balance Reconciliation
    const trialBalanceReconciliation: TrialBalanceItem[] = [];
    const tbAccounts = xeroTB ? xeroTB.accounts || [] : [];

    for (const acc of accounts) {
      const accId = acc.account_id || acc.source_account_id || acc.id;
      const accCode = acc.code || acc.account_code || acc.Code || '';
      const accName = acc.name || acc.account_name || acc.Name || '';

      const mapping = mappings.find(m => m.source_account_id === accId || m.account_code === accCode);
      const tbItem = tbAccounts.find((t: any) => t.accountId === accId || t.accountCode === accCode);
      const xeroBal = tbItem ? tbItem.balance ?? 0 : 0;
      const canonicalBal = await db.getCanonicalAccountBalance(tenantId, accId, startDate, endDate);

      trialBalanceReconciliation.push({
        accountId: accId,
        accountCode: accCode,
        accountName: accName,
        canonicalBalance: canonicalBal,
        xeroTrialBalance: xeroBal,
        difference: canonicalBal - xeroBal,
        mappingStatus: mapping ? (mapping.status || mapping.mapping_status || 'CONFIRMED') : 'UNMAPPED'
      });
    }

    // 5. Account Mapping Validation
    let confirmed = 0;
    let customOverride = 0;
    let suggested = 0;
    let unmapped = 0;
    let archived = 0;

    const unmappedDetails: MappingImpactReport['unmappedAccountsDetail'] = [];

    for (const acc of accounts) {
      const accId = acc.account_id || acc.source_account_id || acc.id;
      const accCode = acc.code || acc.account_code || acc.Code || '';
      const accName = acc.name || acc.account_name || acc.Name || '';
      const accType = acc.type || acc.financial_statement_category || '';

      if (acc.status === 'ARCHIVED') {
        archived++;
        continue;
      }
      const m = mappings.find(mp => mp.source_account_id === accId || mp.account_code === accCode);
      const mapStatus = m ? (m.status || m.mapping_status) : 'UNMAPPED';

      if (!m || mapStatus === 'UNMAPPED') {
        unmapped++;
        const balance = await db.getCanonicalAccountBalance(tenantId, accId, startDate, endDate);
        const affectsPL = ['REVENUE', 'EXPENSE', 'DIRECT_COSTS', 'OTHER_INCOME'].includes(accType);
        const affectsBS = ['CURRENT_ASSET', 'NON_CURRENT_ASSET', 'CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY', 'EQUITY'].includes(accType);
        unmappedDetails.push({
          accountId: accId,
          accountCode: accCode,
          accountName: accName,
          financialImpact: Math.abs(balance),
          affectsPL,
          affectsBS,
          affectsCFOMetrics: affectsPL || affectsBS
        });
      } else if (mapStatus === 'CONFIRMED') {
        confirmed++;
      } else if (mapStatus === 'CUSTOM_OVERRIDE') {
        customOverride++;
      } else if (mapStatus === 'SUGGESTED') {
        suggested++;
      }
    }

    const accountMappingReport: MappingImpactReport = {
      totalAccounts: accounts.length,
      confirmed,
      customOverride,
      suggested,
      unmapped,
      archived,
      unmappedAccountsDetail: unmappedDetails
    };

    // 6. Inventory Validation
    const inventoryValidation: InventoryValidationReport = {
      inventoryAssets: canonicalResult.metrics.inventoryAssets ?? null,
      cogs: canonicalResult.metrics.cogs ?? null,
      stockAdjustments: null,
      inventoryValuation: null,
      inventoryWriteOffs: null,
      valuationMethod: 'XERO_AUTHORITATIVE',
      limitations: [
        'FIFO/LIFO/Weighted-Average stock movement tracking cannot be fully reconstructed from invoice lines alone without full inventory item journals.',
        'Canonical engine relies on Xero authoritative inventory account balances and COGS mappings for financial reports.'
      ]
    };

    // 7. Tax Validation
    const taxValidation: TaxValidationReport = {
      taxCollected: canonicalResult.metrics.taxCollected ?? null,
      taxPaid: canonicalResult.metrics.taxPaid ?? null,
      taxExpense: canonicalResult.metrics.tax ?? null,
      taxPayable: canonicalResult.metrics.taxPayable ?? null,
      taxClearingAccounts: canonicalResult.metrics.taxClearing ?? null,
      notes: [
        'Tax Collected (Sales Tax) and Tax Paid (Input Tax) are Balance Sheet liability clearing account movements in Xero.',
        'Income Tax Expense is recorded separately in P&L. Tax clearing accounts are excluded from P&L operating expense calculations.'
      ]
    };

    return {
      tenantId,
      period: { startDate, endDate },
      pnLReconciliation: { period: { startDate, endDate }, currency: canonicalResult.currency, metrics: pnlRecMetrics },
      balanceSheetReconciliation: { period: { asOfDate: endDate }, currency: canonicalResult.currency, metrics: bsRecMetrics },
      arApReconciliation,
      trialBalanceReconciliation,
      accountMappingReport,
      inventoryValidation,
      taxValidation
    };
  }
}
