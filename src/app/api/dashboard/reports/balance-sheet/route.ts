import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from '@/lib/xero';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Helper to parse Xero Balance Sheet rows into categorized assets, liabilities, and equity
function parseBalanceSheet(report: any) {
  const assets = { current: [] as any[], nonCurrent: [] as any[], unclassified: [] as any[] };
  const liabilities = { current: [] as any[], nonCurrent: [] as any[], unclassified: [] as any[] };
  const equity = [] as any[];
  const unclassified = [] as any[];

  if (!report || !report.Rows) {
    return { assets, liabilities, equity, unclassified, currency: null as string | null };
  }

  // Parse currency from report titles
  let currency: string | null = null;
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

  const isTotalRow = (row: any): boolean => {
    if (!row || !row.Cells || row.Cells.length === 0) return false;
    const val = (row.Cells[0].Value || '').toLowerCase();
    return val.includes('total') || val.includes('net assets') || val.includes('net current assets');
  };

  const traverse = (rows: any[], parentSection: string = '') => {
    for (const item of rows) {
      if (item.RowType === 'Section' && item.Title) {
        traverse(item.Rows || [], item.Title.toLowerCase());
      } else if (item.RowType === 'Row' && item.Cells && item.Cells.length >= 2) {
        const name = (item.Cells[0].Value || '').trim();
        if (!name || isTotalRow(item)) continue;
        const value = getRowValue(item);

        const section = parentSection;
        if (
          section.includes('current asset') ||
          section.includes('cash and bank') ||
          section.includes('bank accounts') ||
          section.includes('receivables') ||
          section.includes('prepayments') ||
          section.includes('inventory')
        ) {
          assets.current.push({ name, value });
        } else if (
          section.includes('fixed asset') ||
          section.includes('non-current asset') ||
          section.includes('property, plant') ||
          section.includes('depreciation') ||
          section.includes('equipment')
        ) {
          assets.nonCurrent.push({ name, value });
        } else if (
          section.includes('current liabilit') ||
          section.includes('payables') ||
          section.includes('tax')
        ) {
          liabilities.current.push({ name, value });
        } else if (
          section.includes('long term') ||
          section.includes('non-current liabilit') ||
          section.includes('loan')
        ) {
          liabilities.nonCurrent.push({ name, value });
        } else if (
          section.includes('equity') ||
          section.includes('capital') ||
          section.includes('reserve') ||
          section.includes('retained earnings')
        ) {
          equity.push({ name, value });
        } else if (/\bbank accounts?\b|\bcash at bank\b/i.test(name)) {
          // Xero's balance-sheet labels explicitly identify a bank account; retain it
          // as a current asset even when the report omits a parent section label.
          assets.current.push({ name, value });
        } else if (section.includes('asset')) {
          assets.unclassified.push({ name, value });
        } else if (section.includes('liabilit')) {
          liabilities.unclassified.push({ name, value });
        } else if (section.includes('equity') || section.includes('capital') || section.includes('reserve') || section.includes('retained earnings')) {
          equity.push({ name, value });
        } else {
          unclassified.push({ name, value });
        }
      } else if (item.Rows) {
        traverse(item.Rows, parentSection);
      }
    }
  };

  traverse(report.Rows);

  return { assets, liabilities, equity, unclassified, currency };
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({ connected: false });
    }

    // Determine target date (default to today)
    let date = dateStr;
    if (!date) {
      const now = new Date();
      date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    if (!isValidIsoDate(date)) {
      return NextResponse.json({ error: 'Provide a valid balance-sheet date.' }, { status: 400 });
    }

    const getStoredReport = async (key: string, fetchFromXero: () => Promise<unknown | null>) => {
      return getOrFetchManagementReport(tenantId, key, fetchFromXero);
    };
    const cacheKey = `BalanceSheet_${date}`;
    let report = null;
    try {
      report = await getStoredReport(cacheKey, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${date}`));
    } catch (error) {
      console.error('Failed to load Balance Sheet from PostgreSQL/Xero:', error);
      throw error;
    }

    let org = null;
    try {
      org = await getStoredReport('Organisation', async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null);
    } catch (error) {
      console.error('Failed to load Organisation details from PostgreSQL/Xero:', error);
      throw error;
    }
    const orgCurrency = org?.BaseCurrency || null;

    if (!report) {
      return NextResponse.json({ 
        connected: true,
        available: false,
        sourceSummary: { assets: null, liabilities: null, equity: null, difference: null, isBalanced: null, reconciliation: 'unavailable', workingCapital: null },
        summary: null,
        assets: { current: [], nonCurrent: [], unclassified: [] },
        liabilities: { current: [], nonCurrent: [], unclassified: [] },
        equity: [],
        unclassified: [],
        meta: { currency: orgCurrency, calculatedAt: new Date().toISOString() }
      });
    }

    const parsed = parseBalanceSheet(report);
    let finalCurrency = parsed.currency;
    const hasExplicitCurrency = report?.ReportTitles?.some((t: string) => 
      t.toLowerCase().includes('currency:') || t.toLowerCase().includes('amounts in')
    );
    if (!hasExplicitCurrency && orgCurrency) finalCurrency = orgCurrency;

    // Grouped detail is useful for display, but only source-reported Xero totals
    // can establish a balance-sheet reconciliation. Tolerance is 0.05 currency units.
    const currentAssetsSum = parsed.assets.current.reduce((sum, item) => sum + item.value, 0);
    const nonCurrentAssetsSum = parsed.assets.nonCurrent.reduce((sum, item) => sum + item.value, 0);
    const assetsSum = currentAssetsSum + nonCurrentAssetsSum;

    const currentLiabilitiesSum = parsed.liabilities.current.reduce((sum, item) => sum + item.value, 0);
    const nonCurrentLiabilitiesSum = parsed.liabilities.nonCurrent.reduce((sum, item) => sum + item.value, 0);
    const liabilitiesSum = currentLiabilitiesSum + nonCurrentLiabilitiesSum;

    const equitySum = parsed.equity.reduce((sum, item) => sum + item.value, 0);

    const sourceAssets = BalanceSheetParser.findTotalAssets(report.Rows);
    const sourceLiabilities = BalanceSheetParser.findTotalLiabilities(report.Rows);
    const sourceEquity = BalanceSheetParser.findTotalEquity(report.Rows);
    const sourceTotalsAvailable = sourceAssets !== null && sourceLiabilities !== null && sourceEquity !== null;
    const difference = sourceTotalsAvailable ? sourceAssets - (sourceLiabilities + sourceEquity) : null;
    const isBalanced = difference === null ? null : Math.abs(difference) <= 0.05;
    const currentAssets = BalanceSheetParser.findCurrentAssets(report.Rows);
    const currentLiabilities = BalanceSheetParser.findCurrentLiabilities(report.Rows);
    const cashSummary = [
      'total cash at bank and in hand', 'total cash and bank', 'total cash',
      'total bank accounts', 'total bank balances', 'cash and bank'
    ].map((label) => BalanceSheetParser.findSummary(report.Rows, label)).find((value) => value !== null) ?? null;
    const bankAccountRows = parsed.assets.current.filter((line) => /\bbank accounts?\b|\bcash at bank\b/i.test(line.name));
    const cashBalance = cashSummary ?? (bankAccountRows.length ? bankAccountRows.reduce((total, line) => total + line.value, 0) : null);
    const receivablesBalance = BalanceSheetParser.findTotalAR(report.Rows);
    const payablesBalance = BalanceSheetParser.findTotalAP(report.Rows);

    // Calculate last 6 months ending on the selected date for Equity Trend
    const targetDate = new Date(date);
    const monthsRange: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthsRange.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label
      });
    }

    const equityTrend: { label: string; value: number | null }[] = [];
    for (const m of monthsRange) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDayOfMonth = new Date(m.year, m.month + 1, 0).getDate();
      const mDateStr = `${m.year}-${pad(m.month + 1)}-${pad(lastDayOfMonth)}`;
      
      const mBsCacheKey = `BalanceSheet_${mDateStr}`;
      let mBsReport = null;
      try {
        mBsReport = await getStoredReport(mBsCacheKey, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${mDateStr}`));
      } catch (error) {
        console.error(`Failed to fetch dynamic BalanceSheet for trend point ${mDateStr}:`, error);
        throw error;
      }
      
      const mEquity = mBsReport ? BalanceSheetParser.findTotalEquity(mBsReport.Rows) : null;
      equityTrend.push({
        label: m.label,
        value: mEquity === null ? null : parseFloat(mEquity.toFixed(2))
      });
    }

    return NextResponse.json({
      connected: true,
      available: true,
      summary: {
        assets: sourceAssets ?? assetsSum,
        liabilities: sourceLiabilities ?? liabilitiesSum,
        equity: sourceEquity ?? equitySum,
        isBalanced,
        difference: difference === null ? null : Math.round(difference * 100) / 100
      },
      balanceSummary: {
        assets: sourceAssets,
        liabilities: sourceLiabilities,
        equity: sourceEquity,
        isBalanced,
        difference: difference === null ? null : Math.round(difference * 100) / 100,
        reconciliation: difference === null ? 'unavailable' : isBalanced ? 'balanced' : 'unbalanced'
      },
      sourceSummary: {
        assets: sourceAssets,
        liabilities: sourceLiabilities,
        equity: sourceEquity,
        difference: difference === null ? null : Math.round(difference * 100) / 100,
        isBalanced,
        reconciliation: difference === null ? 'unavailable' : isBalanced ? 'balanced' : 'unbalanced',
        workingCapital: {
          cash: cashBalance,
          receivables: receivablesBalance,
          payables: payablesBalance,
          currentAssets,
          currentLiabilities,
          netWorkingCapital: currentAssets !== null && currentLiabilities !== null ? currentAssets - currentLiabilities : null,
          currentRatio: currentAssets !== null && currentLiabilities !== null && currentLiabilities !== 0 ? currentAssets / currentLiabilities : null,
          receivablesToPayables: receivablesBalance !== null && payablesBalance !== null && payablesBalance !== 0 ? receivablesBalance / payablesBalance : null,
          cashToPayables: cashBalance !== null && payablesBalance !== null && payablesBalance !== 0 ? cashBalance / payablesBalance : null
        }
      },
      assets: parsed.assets,
      liabilities: parsed.liabilities,
      equity: parsed.equity,
      unclassified: parsed.unclassified,
      equityTrend,
      meta: {
        currency: finalCurrency,
        calculatedAt: new Date().toISOString(),
        asOfDate: date,
        organizationName: org?.Name || org?.LegalName || org?.OrganisationName || null
      }
    });

  } catch (err: any) {
    console.error('Balance Sheet report API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
