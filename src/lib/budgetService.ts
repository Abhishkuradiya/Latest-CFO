import { db } from './db';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from './xero';
import { ProfitAndLossService } from './services/ProfitAndLossService';
import { getOrFetchManagementReport } from './managementAccountsStorage';

export interface BudgetVsActualCategory {
  category: string;
  budget: number | null;
  actual: number | null;
  variance: number | null;
  variance_pct: number | null;
}

export interface BudgetVsActualSummary {
  budget_ytd: number | null;
  actual_ytd: number | null;
  variance: number | null;
  variance_pct: number | null;
  last_synced: string;
  categories: BudgetVsActualCategory[];
  monthly_trends: {
    month: string;
    budget: number;
    actual: number;
    variance: number;
  }[];
  data_available?: boolean;
}

export const XeroBudgetService = {
  /**
   * Helper to fetch the list of budgets from the Xero Accounting API.
   */
  fetchBudgetsList: async (accessToken: string, xeroTenantId: string, retriesLeft = 3): Promise<any[]> => {
    const url = 'https://api.xero.com/api.xro/2.0/Budgets';
    
    // Throttle to naturally pace concurrent requests
    await new Promise(resolve => setTimeout(resolve, 150));

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': xeroTenantId,
        'Accept': 'application/json'
      }
    });

    if (res.status === 429 && retriesLeft > 0) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2') * 1000;
      console.warn(`[Xero Budgets API] Rate limit (429) hit. Waiting ${retryAfter}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return XeroBudgetService.fetchBudgetsList(accessToken, xeroTenantId, retriesLeft - 1);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Xero Budgets list API error (Status ${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.Budgets || [];
  },

  /**
   * Helper to fetch individual budget details (including BudgetLines and Balances) from the Xero API.
   */
  fetchSingleBudget: async (accessToken: string, xeroTenantId: string, budgetId: string, startDateStr: string, endDateStr: string): Promise<any | null> => {
    const queryParams = new URLSearchParams({
      DateFrom: startDateStr,
      DateTo: endDateStr
    }).toString();

    const url = `https://api.xero.com/api.xro/2.0/Budgets/${budgetId}?${queryParams}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': xeroTenantId,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Xero Single Budget API error: ${errText}`);
    }

    const data = await res.json();
    return data.Budgets && data.Budgets[0] ? data.Budgets[0] : null;
  },

  /**
   * Fetch and calculate Budget vs Actual.
   * Leverages 10 minutes cache (600 seconds).
   */
  getBudgetVsActual: async (tenantId: number, startDate: Date, endDate: Date, forceSync = false): Promise<BudgetVsActualSummary> => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-01`;
    // Set DateTo to the end of the selected month
    const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
    const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(lastDayOfMonth)}`;

    const cacheKey = `BudgetVsActual_${startDateStr}_${endDateStr}`;

    if (!forceSync) {
      const cached = await db.getBudgetsCache(tenantId, cacheKey);
      if (cached && cached.categories && cached.monthly_trends && cached.variance_pct !== undefined) {
        return cached;
      }
    }

    // 1. Get Xero token
    const tokenInfo = await getXeroAccessToken(tenantId);
    let plSummary = {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      otherIncome: 0,
      otherExpenses: 0,
      netProfit: 0
    };
    let actualAvailable = false;
    let budgetAvailable = false;

    // 2. Fetch actual revenue from P&L report for same period
    try {
      const pnlCacheKey = `ProfitAndLoss_${startDateStr}_${endDateStr}`;
      const plReport = tokenInfo
        ? await getOrFetchManagementReport(
            tenantId,
            pnlCacheKey,
            () => fetchXeroReport(
              tokenInfo.accessToken,
              tokenInfo.xeroTenantId,
              'ProfitAndLoss',
              `fromDate=${startDateStr}&toDate=${endDateStr}`,
            ),
          )
        : null;

      if (plReport) {
        plSummary = ProfitAndLossService.parseReport(plReport);
        actualAvailable = true;
      }
    } catch (e) {
      console.error('Failed to retrieve P&L actual revenue for budget comparison:', e);
    }

    // Initialize category budgets
    const categoryBudgets: Record<string, number> = {
      'Income': 0,
      'Cost of Goods Sold': 0,
      'Operating Expenses': 0,
      'Other Income': 0,
      'Other Expenses': 0
    };

    // 3. Fetch budgets from Xero API if connected
    if (tokenInfo) {
      try {
        const budgets = await getOrFetchManagementReport(
          tenantId,
          'Budgets_metadata',
          () => XeroBudgetService.fetchBudgetsList(tokenInfo.accessToken, tokenInfo.xeroTenantId),
        ) as any[] | null;
        
        // Find overall budget
        const availableBudgets = budgets ?? [];
        const overallBudget = availableBudgets.find(b => b.Type === 'OVERALL') || availableBudgets[0];

        if (overallBudget && overallBudget.BudgetID) {
          const budgetDetails = await getOrFetchManagementReport(
            tenantId,
            `Budget_${overallBudget.BudgetID}_${startDateStr}_${endDateStr}`,
            () => XeroBudgetService.fetchSingleBudget(
              tokenInfo.accessToken,
              tokenInfo.xeroTenantId,
              overallBudget.BudgetID,
              startDateStr,
              endDateStr,
            ),
          ) as any;

          if (budgetDetails && Array.isArray(budgetDetails.BudgetLines)) {
            budgetAvailable = true;
            // Get tenant accounts to map to categories
            const accounts = await getOrFetchManagementReport(
              tenantId,
              'Accounts_metadata',
              () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Accounts'),
            ) as any[] | null;
            const accountCategoryMap = new Map<string, string>();
            const accountCodeCategoryMap = new Map<string, string>();

            for (const acc of accounts ?? []) {
              const type = (acc.Type || acc.type || '').toUpperCase();
              const accClass = (acc.Class || acc.class || '').toUpperCase();
              const code = acc.Code || acc.code || '';
              const id = acc.AccountID || acc.accountId || '';

              let category = 'Operating Expenses'; // default
              
              if (type === 'REVENUE' || type === 'SALES' || accClass === 'REVENUE') {
                category = 'Income';
              } else if (type === 'COGS' || type === 'DIRECTCOSTS') {
                category = 'Cost of Goods Sold';
              } else if (type === 'OTHERINCOME') {
                category = 'Other Income';
              } else if (type === 'OTHEREXPENSE') {
                category = 'Other Expenses';
              } else if (type === 'EXPENSE' || type === 'OVERHEADS' || type === 'DEPRECIAT' || accClass === 'EXPENSE') {
                category = 'Operating Expenses';
              } else {
                continue; // Skip balance sheet accounts
              }

              if (id) accountCategoryMap.set(id, category);
              if (code) accountCodeCategoryMap.set(code, category);
            }

            // Sum up the budget lines for accounts
            for (const line of budgetDetails.BudgetLines) {
              const category = accountCategoryMap.get(line.AccountID) || accountCodeCategoryMap.get(line.AccountCode);
              
              if (category && Array.isArray(line.Balances)) {
                for (const bal of line.Balances) {
                  if (bal.Period) {
                    const [year, month] = bal.Period.split('-').map(Number);
                    const balDate = new Date(year, month - 1, 1);
                    const startLimit = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                    const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

                    if (balDate >= startLimit && balDate <= endLimit) {
                      const amount = parseFloat(bal.Amount) || parseFloat(bal.UnitAmount) || 0;
                      categoryBudgets[category] += amount;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Gracefully handled budget sync error:', err);
      }
    }

    // 4. Build Category details array with variance math
    const categories: BudgetVsActualCategory[] = [];
    const catKeys = ['Income', 'Cost of Goods Sold', 'Operating Expenses', 'Other Income', 'Other Expenses'];
    
    // Map plSummary fields
    const actualMap: Record<string, number> = {
      'Income': plSummary.revenue,
      'Cost of Goods Sold': plSummary.cogs,
      'Operating Expenses': plSummary.operatingExpenses,
      'Other Income': plSummary.otherIncome,
      'Other Expenses': plSummary.otherExpenses
    };

    let totalBudget = 0;
    let totalActual = 0;

    for (const key of catKeys) {
      const budget = budgetAvailable ? parseFloat((categoryBudgets[key] || 0).toFixed(2)) : null;
      const actual = actualAvailable ? parseFloat((actualMap[key] || 0).toFixed(2)) : null;
      
      // Standard accounting variance: Income is actual - budget, Expenses are budget - actual
      const isIncome = key === 'Income' || key === 'Other Income';
      const variance = budget === null || actual === null ? null : isIncome
        ? parseFloat((actual - budget).toFixed(2))
        : parseFloat((budget - actual).toFixed(2));
      
      let variance_pct = 0;
      if (variance !== null && budget !== null && budget !== 0) {
        variance_pct = parseFloat(((variance / budget) * 100).toFixed(2));
      } else if (variance !== null && actual !== null && actual !== 0) {
        variance_pct = 0.00; // Zero budget means 0% target comparison
      }

      categories.push({
        category: key,
        budget,
        actual,
        variance,
        variance_pct: variance === null ? null : variance_pct
      });

      // Sum totals
      if (isIncome) {
        totalBudget += budget ?? 0;
        totalActual += actual ?? 0;
      } else {
        totalBudget -= budget ?? 0;
        totalActual -= actual ?? 0;
      }
    }

    // Add Total category row
    // Net profit/loss: favorable variance when actual is higher than budget
    const totalVariance = !budgetAvailable || !actualAvailable ? null : parseFloat((totalActual - totalBudget).toFixed(2));
    let totalVariancePct = 0;
    if (totalVariance !== null && totalBudget !== 0) {
      totalVariancePct = parseFloat(((totalVariance / totalBudget) * 100).toFixed(2));
    } else if (totalVariance !== null && totalActual !== 0) {
      totalVariancePct = 0.00;
    }

    categories.push({
      category: 'Total',
      budget: budgetAvailable ? parseFloat(totalBudget.toFixed(2)) : null,
      actual: actualAvailable ? parseFloat(totalActual.toFixed(2)) : null,
      variance: totalVariance,
      variance_pct: totalVariance === null ? null : totalVariancePct
    });

    // 5. Generate Monthly trends dynamically (last 5 months)
    const monthly_trends: { month: string; budget: number; actual: number; variance: number }[] = [];
    // Do not manufacture monthly values from an aggregate. The Xero P&L response
    // used here is period-level data, so an absent monthly source must remain empty.

    const credentials = await db.getCredentials(tenantId, 'xero');
    const lastSynced = credentials?.last_synced_at
      ? new Date(credentials.last_synced_at).toISOString().replace('T', ' ').substring(0, 16)
      : '';

    const overallBudgetYtd = parseFloat((categoryBudgets['Income'] + categoryBudgets['Other Income']).toFixed(2));
    const overallActualYtd = plSummary.revenue;
    // Favorable income variance is actual - budget
    const overallVariance = parseFloat((overallActualYtd - overallBudgetYtd).toFixed(2));
    let overallVariancePct = 0;

    if (overallBudgetYtd !== 0) {
      overallVariancePct = parseFloat(((overallVariance / overallBudgetYtd) * 100).toFixed(2));
    } else if (overallActualYtd !== 0) {
      overallVariancePct = 0.00;
    }

    const summary: BudgetVsActualSummary = {
      budget_ytd: budgetAvailable ? overallBudgetYtd : null,
      actual_ytd: actualAvailable ? overallActualYtd : null,
      variance: budgetAvailable && actualAvailable ? overallVariance : null,
      variance_pct: budgetAvailable && actualAvailable ? overallVariancePct : null,
      last_synced: lastSynced,
      categories,
      monthly_trends,
      data_available: actualAvailable || budgetAvailable,
    };

    // Cache summary for 10 minutes (600 seconds)
    await db.saveBudgetsCache(tenantId, cacheKey, summary, 600);

    return summary;
  }
};
