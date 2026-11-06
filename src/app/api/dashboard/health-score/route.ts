import { NextRequest, NextResponse } from 'next/server';
import { db, parseXeroDate } from '@/lib/db';
import { getXeroAccessToken, fetchXeroReport } from '@/lib/xero';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';
import { getTenantIdFromSession } from '@/lib/auth';

/**
 * GET /api/dashboard/health-score
 * 
 * Computes a dynamic Business Health Score from real Xero financial data.
 * 
 * Metrics computed:
 *  - Profitability (Net Profit Margin)
 *  - Liquidity (Current Ratio: Current Assets / Current Liabilities)
 *  - Efficiency (Invoice Collection Rate)
 *  - Solvency (Working Capital health)
 *  - Growth (Revenue Growth %)
 */
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({
        connected: false,
        overallScore: 0,
        label: "N/A",
        description: "Please connect Xero to view your health score.",
        metrics: [
          { name: 'Profitability', score: 0, color: '#10b981' },
          { name: 'Liquidity', score: 0, color: '#0064eb' },
          { name: 'Efficiency', score: 0, color: '#f59e0b' },
          { name: 'Solvency', score: 0, color: '#ef4444' },
          { name: 'Growth', score: 0, color: '#10b981' },
        ],
        details: {
          profitMargin: 0,
          currentRatio: 0,
          collectionRate: 0,
          workingCapital: 0,
          revenueGrowth: 0,
          totalCash: 0,
          totalReceivable: 0,
          totalPayable: 0
        }
      });
    }
    const cachedInvoices = await db.getInvoices(tenantId);

    // ========================================
    // 1. Fetch Balance Sheet data
    // ========================================
    let totalCash = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;

    if (tokenInfo) {
      const { accessToken, xeroTenantId } = tokenInfo;
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const bsCacheKey = `BalanceSheet_${dateStr}`;

      let bsReport = await db.getReport(tenantId, bsCacheKey);
      if (!bsReport && req.nextUrl.searchParams.get('force_sync') === 'true') {
        try {
          bsReport = await fetchXeroReport(accessToken, xeroTenantId, 'BalanceSheet', `date=${dateStr}`);
          if (bsReport) {
            await db.saveReport(tenantId, bsCacheKey, bsReport);
          }
        } catch (err) {
          console.error('Health Score: Failed to fetch BalanceSheet');
        }
      }

      if (bsReport && bsReport.Rows) {
        totalCash = BalanceSheetParser.findTotalCash(bsReport.Rows) || 0;
        currentAssets = BalanceSheetParser.findCurrentAssets(bsReport.Rows) || totalCash;
        currentLiabilities = BalanceSheetParser.findCurrentLiabilities(bsReport.Rows) || 0;
      }
    }

    // ========================================
    // 2. Fetch P&L data from cached reports
    // ========================================
    let plRevenue = 0;
    let netProfit = 0;
    let expenses = 0;

    const plReport = await db.getReport(tenantId, 'ProfitAndLoss');
    if (plReport) {
      // Parse from cached P&L
      plRevenue = plReport.revenue || plReport.plRevenue || 0;
      netProfit = plReport.netProfit || 0;
      expenses = plReport.operatingExpenses || plReport.expenses || 0;
    }

    // ========================================
    // 3. Compute invoice metrics
    // ========================================
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let totalInvoices = 0;
    let paidInvoices = 0;
    let overdueInvoices = 0;
    let totalOverdueAmount = 0;
    let totalReceivable = 0;
    let totalPayable = 0;
    let totalOverdueBills = 0;
    let totalOverdueBillAmount = 0;

    // Revenue from last month (for growth comparison)
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;

    for (const inv of cachedInvoices) {
      const invDate = parseXeroDate(inv.Date);
      const dueDate = inv.DueDate ? parseXeroDate(inv.DueDate) : null;

      if (inv.Type === 'ACCREC') {
        totalInvoices++;

        if (inv.Status === 'PAID') {
          paidInvoices++;
        }

        if (inv.Status === 'AUTHORISED') {
          totalReceivable += inv.AmountDue || 0;

          if (dueDate && dueDate < now) {
            overdueInvoices++;
            totalOverdueAmount += inv.AmountDue || 0;
          }
        }

        // Revenue tracking by month
        if (invDate && (inv.Status === 'PAID' || inv.Status === 'AUTHORISED')) {
          if (invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear) {
            revenueThisMonth += inv.Total || 0;
          }
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
          if (invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear) {
            revenueLastMonth += inv.Total || 0;
          }
        }
      }

      if (inv.Type === 'ACCPAY') {
        if (inv.Status === 'AUTHORISED') {
          totalPayable += inv.AmountDue || 0;

          if (dueDate && dueDate < now) {
            totalOverdueBills++;
            totalOverdueBillAmount += inv.AmountDue || 0;
          }
        }
      }
    }

    // Use invoice-based revenue if P&L revenue is 0
    if (plRevenue === 0) {
      plRevenue = revenueThisMonth || 1; // Avoid division by zero
    }

    // ========================================
    // 4. Compute individual metric scores
    // ========================================

    // --- Profitability Score (0-100) ---
    // Net Profit Margin = (Net Profit / Revenue) * 100
    const profitMargin = plRevenue > 0 ? (netProfit / plRevenue) * 100 : 0;
    let profitabilityScore: number;
    if (profitMargin >= 20) profitabilityScore = 95;
    else if (profitMargin >= 15) profitabilityScore = 90;
    else if (profitMargin >= 10) profitabilityScore = 80;
    else if (profitMargin >= 5) profitabilityScore = 70;
    else if (profitMargin >= 0) profitabilityScore = 55;
    else if (profitMargin >= -10) profitabilityScore = 35;
    else profitabilityScore = 20;

    // --- Liquidity Score (0-100) ---
    // Current Ratio = Current Assets / Current Liabilities
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : (currentAssets > 0 ? 3 : 1);
    let liquidityScore: number;
    if (currentRatio >= 2.0) liquidityScore = 95;
    else if (currentRatio >= 1.5) liquidityScore = 85;
    else if (currentRatio >= 1.2) liquidityScore = 75;
    else if (currentRatio >= 1.0) liquidityScore = 60;
    else if (currentRatio >= 0.8) liquidityScore = 40;
    else liquidityScore = 25;

    // --- Efficiency Score (0-100) ---
    // Invoice Collection Rate = Paid / Total
    const collectionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 50;
    // Penalty for overdue invoices
    const overduePenalty = totalInvoices > 0 ? Math.min(30, (overdueInvoices / totalInvoices) * 60) : 0;
    let efficiencyScore = Math.round(Math.min(100, collectionRate - overduePenalty));
    efficiencyScore = Math.max(10, efficiencyScore);

    // --- Solvency Score (0-100) ---
    // Working Capital = Current Assets - Current Liabilities
    const workingCapital = currentAssets - currentLiabilities;
    let solvencyScore: number;
    if (workingCapital > 50000) solvencyScore = 95;
    else if (workingCapital > 20000) solvencyScore = 88;
    else if (workingCapital > 10000) solvencyScore = 80;
    else if (workingCapital > 0) solvencyScore = 65;
    else if (workingCapital > -5000) solvencyScore = 45;
    else solvencyScore = 25;

    // --- Growth Score (0-100) ---
    const revenueGrowth = revenueLastMonth > 0 
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
      : (revenueThisMonth > 0 ? 10 : 0);
    let growthScore: number;
    if (revenueGrowth >= 20) growthScore = 95;
    else if (revenueGrowth >= 10) growthScore = 90;
    else if (revenueGrowth >= 5) growthScore = 82;
    else if (revenueGrowth >= 0) growthScore = 70;
    else if (revenueGrowth >= -5) growthScore = 55;
    else if (revenueGrowth >= -15) growthScore = 40;
    else growthScore = 25;

    // ========================================
    // 5. Compute overall weighted score
    // ========================================
    const weights = {
      profitability: 0.25,
      liquidity: 0.20,
      efficiency: 0.20,
      solvency: 0.15,
      growth: 0.20
    };

    const overallScore = Math.round(
      profitabilityScore * weights.profitability +
      liquidityScore * weights.liquidity +
      efficiencyScore * weights.efficiency +
      solvencyScore * weights.solvency +
      growthScore * weights.growth
    );

    // Determine health label
    let label: string;
    let description: string;
    if (overallScore >= 85) {
      label = 'EXCELLENT';
      description = 'Your business is in great shape!';
    } else if (overallScore >= 70) {
      label = 'GOOD';
      description = 'Your business is performing well.';
    } else if (overallScore >= 55) {
      label = 'FAIR';
      description = 'Some areas need attention.';
    } else if (overallScore >= 40) {
      label = 'WARNING';
      description = 'Multiple financial areas need improvement.';
    } else {
      label = 'CRITICAL';
      description = 'Urgent financial attention required.';
    }

    return NextResponse.json({
      overallScore,
      label,
      description,
      metrics: [
        { name: 'Profitability', score: profitabilityScore, color: '#10b981' },
        { name: 'Liquidity', score: liquidityScore, color: '#0064eb' },
        { name: 'Efficiency', score: efficiencyScore, color: '#f59e0b' },
        { name: 'Solvency', score: solvencyScore, color: '#ef4444' },
        { name: 'Growth', score: growthScore, color: '#10b981' },
      ],
      details: {
        profitMargin: parseFloat(profitMargin.toFixed(1)),
        currentRatio: parseFloat(currentRatio.toFixed(2)),
        collectionRate: parseFloat(collectionRate.toFixed(1)),
        workingCapital: parseFloat(workingCapital.toFixed(2)),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        totalCash,
        totalReceivable,
        totalPayable,
        overdueInvoices,
        totalOverdueAmount,
        totalOverdueBills,
        totalOverdueBillAmount
      }
    });
  } catch (err: any) {
    console.error('Health Score API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
