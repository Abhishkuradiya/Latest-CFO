import { db } from './db';
import { getXeroAccessToken, fetchXeroResource } from './xero';
import { TaxSyncService } from './services/TaxSyncService';

export interface TaxBreakdownItem {
  tax_type: string;
  collected: number;
  paid: number;
  payable: number;
  rate: string;
  status: 'Payable' | 'Paid';
}

export interface UpcomingReturn {
  name: string;
  period: string;
  due_in_days: number;
  due_date: string;
}

export interface RecentActivity {
  type: string;
  description: string;
  date: string;
}

export interface MonthlyTaxTrend {
  month: string;
  collected: number;
  paid: number;
  payable: number;
}

export interface TaxSummaryMetrics {
  tax_collected: number;
  tax_paid: number;
  tax_payable: number;
  last_synced: string;
  breakdown: TaxBreakdownItem[];
  upcoming_returns: UpcomingReturn[];
  recent_activities: RecentActivity[];
  monthly_trends: MonthlyTaxTrend[];
  effective_rate: number;
  total_transactions: number;
}

export const XeroTaxService = {
  /**
   * Fetch and calculate Tax Center metrics based on real tax_transactions table.
   * Leverages 10 minutes cache (600 seconds).
   */
  getTaxSummary: async (
    tenantId: number,
    startDate: Date,
    endDate: Date,
    forceSync = false,
    filters?: { taxType?: string; status?: string }
  ): Promise<TaxSummaryMetrics> => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-01`;
    const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
    const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(lastDayOfMonth)}`;

    let cacheKey = `TaxSummaryDetails_${startDateStr}_${endDateStr}`;
    if (filters?.taxType) cacheKey += `_t_${filters.taxType}`;
    if (filters?.status) cacheKey += `_s_${filters.status}`;

    if (!forceSync) {
      const cached = await db.getTaxCache(tenantId, cacheKey);
      if (cached && cached.breakdown && cached.monthly_trends) {
        return cached;
      }
    }

    // 1. Get raw normalized tax transactions from db.getTaxTransactions
    let taxTxns = await db.getTaxTransactions(tenantId, startDate, endDate, filters);

    // Dynamic Self-Healing Auto-Hydration fallback if table is empty
    if (taxTxns.length === 0) {
      try {
        const tokenInfo = await getXeroAccessToken(tenantId);
        if (tokenInfo) {
          console.log(`[Tax AutoSync] Tax transactions empty for tenant ${tenantId}. Checking and hydrating...`);
          
          let taxRates = await db.getReport(tenantId, 'TaxRates');
          if (!taxRates || taxRates.length === 0) {
            taxRates = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'TaxRates');
            if (taxRates) await db.saveReport(tenantId, 'TaxRates', taxRates);
          }

          let invoices = await db.getReport(tenantId, 'Invoices');
          if (!invoices || invoices.length === 0) {
            invoices = await fetchXeroResource(
              tokenInfo.accessToken,
              tokenInfo.xeroTenantId,
              'Invoices',
              'where=Status=="PAID" OR Status=="AUTHORISED" OR Status=="DRAFT"'
            );
            if (invoices) await db.saveReport(tenantId, 'Invoices', invoices);
          }

          let creditNotes = await db.getReport(tenantId, 'CreditNotes');
          if (!creditNotes || creditNotes.length === 0) {
            creditNotes = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'CreditNotes');
            if (creditNotes) await db.saveReport(tenantId, 'CreditNotes', creditNotes);
          }

          await TaxSyncService.syncTaxTransactions(tenantId);
          
          taxTxns = await db.getTaxTransactions(tenantId, startDate, endDate, filters);
          console.log(`[Tax AutoSync] Hydration complete. Synced ${taxTxns.length} tax transactions.`);
        }
      } catch (err: any) {
        console.error('[Tax AutoSync] Fallback hydration failed:', err.message);
      }
    }

    // 2. Aggregate counts & amounts
    let taxCollected = 0;
    let taxPaid = 0;
    let taxableSales = 0;
    const breakdownMap: Record<string, { collected: number; paid: number; rate: string; taxableCollected: number; taxablePaid: number }> = {};

    for (const txn of taxTxns) {
      const taxAmt = parseFloat(txn.tax_amount) || 0;
      const taxableAmt = parseFloat(txn.taxable_amount) || 0;
      const isCreditNote = txn.transaction_type === 'CREDITNOTE';
      const factor = isCreditNote ? -1 : 1;

      const netTax = taxAmt * factor;
      const netTaxable = taxableAmt * factor;

      if (txn.direction === 'OUTPUT') {
        taxCollected += netTax;
        taxableSales += netTaxable;
      } else if (txn.direction === 'INPUT') {
        taxPaid += netTax;
      }

      // Group by tax type for breakdown
      const typeKey = txn.tax_type;
      if (!breakdownMap[typeKey]) {
        breakdownMap[typeKey] = {
          collected: 0,
          paid: 0,
          rate: txn.tax_rate_percent ? `${parseFloat(txn.tax_rate_percent).toFixed(2)}%` : '-',
          taxableCollected: 0,
          taxablePaid: 0
        };
      }
      if (txn.direction === 'OUTPUT') {
        breakdownMap[typeKey].collected += netTax;
        breakdownMap[typeKey].taxableCollected += netTaxable;
      } else if (txn.direction === 'INPUT') {
        breakdownMap[typeKey].paid += netTax;
        breakdownMap[typeKey].taxablePaid += netTaxable;
      }
    }

    const breakdown: TaxBreakdownItem[] = [];
    for (const [taxType, vals] of Object.entries(breakdownMap)) {
      const collected = parseFloat(vals.collected.toFixed(2));
      const paid = parseFloat(vals.paid.toFixed(2));
      const payable = parseFloat((collected - paid).toFixed(2));
      breakdown.push({
        tax_type: taxType,
        collected,
        paid,
        payable,
        rate: vals.rate,
        status: payable >= 0 ? 'Payable' : 'Paid'
      });
    }

    // Clamped net tax payable
    const netPayable = taxCollected - taxPaid;
    const taxPayable = netPayable >= 0 ? parseFloat(netPayable.toFixed(2)) : 0;

    // Filing dates are not available in the tax transaction data. Do not invent
    // country-specific deadlines; leave this section empty until a filing source
    // is persisted from Xero or a connected compliance provider.
    const upcoming_returns: UpcomingReturn[] = [];

    // 4. Recent activities - build from actual tax transactions
    const recent_activities: RecentActivity[] = [];
    const uniqueTxns = Array.from(new Set(taxTxns.map(t => t.xero_transaction_id))).slice(0, 5);
    for (const txnId of uniqueTxns) {
      const match = taxTxns.find(t => t.xero_transaction_id === txnId);
      if (!match) continue;
      const isCredit = match.transaction_type === 'CREDITNOTE';
      const desc = isCredit
        ? `Credit Note CN-${match.xero_transaction_id.substring(0, 4)}: Adjusting $${Math.abs(parseFloat(match.tax_amount)).toFixed(2)}`
        : `${match.direction === 'OUTPUT' ? 'Collected' : 'Paid'} tax on invoice: ${match.contact_name || 'Contact'}`;
      recent_activities.push({
        type: isCredit ? 'Filing' : (match.direction === 'OUTPUT' ? 'Collected' : 'Payment'),
        description: desc,
        date: new Date(match.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      });
    }

    // 5. Monthly trends - group by month
    const monthly_trends: MonthlyTaxTrend[] = [];
    const trendMonths: string[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= endLimit) {
      trendMonths.push(cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const monthName of trendMonths) {
      let collected = 0;
      let paid = 0;
      for (const txn of taxTxns) {
        const txnMonth = new Date(txn.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (txnMonth === monthName) {
          const factor = txn.transaction_type === 'CREDITNOTE' ? -1 : 1;
          const netTax = parseFloat(txn.tax_amount) * factor;
          if (txn.direction === 'OUTPUT') {
            collected += netTax;
          } else if (txn.direction === 'INPUT') {
            paid += netTax;
          }
        }
      }
      monthly_trends.push({
        month: monthName,
        collected: parseFloat(collected.toFixed(2)),
        paid: parseFloat(paid.toFixed(2)),
        payable: parseFloat((collected - paid).toFixed(2))
      });
    }

    // 6. Compute overall effective tax rate
    const effectiveRate = taxableSales > 0 ? parseFloat(((taxCollected / taxableSales) * 100).toFixed(2)) : 0;

    // Count real unique transactions
    const totalTransactions = uniqueTxns.length;

    const credentials = await db.getCredentials(tenantId, 'xero');
    const lastSynced = credentials?.last_synced_at
      ? new Date(credentials.last_synced_at).toISOString().replace('T', ' ').substring(0, 16)
      : '';

    const summary: TaxSummaryMetrics = {
      tax_collected: parseFloat(taxCollected.toFixed(2)),
      tax_paid: parseFloat(taxPaid.toFixed(2)),
      tax_payable: taxPayable,
      last_synced: lastSynced,
      breakdown,
      upcoming_returns,
      recent_activities,
      monthly_trends,
      effective_rate: effectiveRate,
      total_transactions: totalTransactions
    };

    // Cache summary for 10 minutes (600 seconds)
    await db.saveTaxCache(tenantId, cacheKey, summary, 600);

    return summary;
  }
};
