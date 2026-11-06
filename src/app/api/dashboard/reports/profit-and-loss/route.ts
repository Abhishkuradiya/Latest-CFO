import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseProfitAndLoss(report: any) {
  const income = { operating: [] as any[], other: [] as any[] };
  const cogs = [] as any[];
  const expenses = { operating: [] as any[], other: [] as any[] };
  let currency: string | null = null;

  if (!report || !report.Rows) {
    return { income, cogs, expenses, currency };
  }

  // Parse currency from titles
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
    return val.includes('total') || val.includes('gross profit') || val.includes('net profit');
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
        if (section.includes('operating income') || section.includes('revenue') || section.includes('income') || section.includes('trading income')) {
          if (section.includes('other income')) {
            income.other.push({ name, value });
          } else {
            income.operating.push({ name, value });
          }
        } else if (section.includes('cost of sales') || section.includes('cogs') || section.includes('cost of goods sold') || section.includes('direct costs')) {
          cogs.push({ name, value });
        } else if (section.includes('expense') || section.includes('depreciation') || section.includes('operating expenses') || section.includes('administrative') || section.includes('overhead') || section.includes('costs')) {
          if (section.includes('other expense') || section.includes('interest expense') || section.includes('tax')) {
            expenses.other.push({ name, value });
          } else {
            expenses.operating.push({ name, value });
          }
        } else {
          // General fallback based on name keywords if section is vague
          const nameLower = name.toLowerCase();
          if (nameLower.includes('sales') || nameLower.includes('revenue') || nameLower.includes('interest income')) {
            income.operating.push({ name, value });
          } else if (nameLower.includes('purchases') || nameLower.includes('cogs') || nameLower.includes('cost of sales')) {
            cogs.push({ name, value });
          } else if (nameLower.includes('expense') || nameLower.includes('rent') || nameLower.includes('salary')) {
            expenses.operating.push({ name, value });
          } else {
            expenses.operating.push({ name, value });
          }
        }
      } else if (item.Rows) {
        traverse(item.Rows, parentSection);
      }
    }
  };

  traverse(report.Rows);

  return { income, cogs, expenses, currency };
}

function hasUsablePnlAccountRows(report: any): boolean {
  const visit = (rows: any[]): boolean => rows.some((item) => {
    if (item?.RowType === 'Section') return visit(item.Rows || []);
    if (item?.RowType !== 'Row' || !Array.isArray(item.Cells) || item.Cells.length < 2) return false;
    const label = String(item.Cells[0]?.Value || '').trim().toLowerCase();
    const raw = String(item.Cells[1]?.Value ?? '').trim();
    return Boolean(label && !/(^|\b)(total|gross profit|net profit)(\b|$)/i.test(label) && raw !== '' && Number.isFinite(Number(raw.replace(/,/g, ''))));
  });
  return Boolean(Array.isArray(report?.Rows) && visit(report.Rows));
}

function findPnlSummaryValue(report: any, labels: string[]): number | null {
  const expected = new Set(labels.map((label) => label.trim().toLowerCase()));
  const parseAmount = (raw: unknown): number | null => {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    const text = String(raw).trim();
    const parenthesized = /^\(.*\)$/.test(text);
    const numeric = text.replace(/[^0-9,().-]/g, '').replace(/,/g, '');
    const amount = Number(numeric);
    return Number.isFinite(amount) ? (parenthesized ? -Math.abs(amount) : amount) : null;
  };
  const visit = (rows: any[]): number | null => {
    for (const item of rows || []) {
      if (item?.RowType === 'Row' || item?.RowType === 'SummaryRow') {
        const label = String(item.Cells?.[0]?.Value || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (expected.has(label)) {
          const value = parseAmount(item.Cells?.[1]?.Value);
          if (value !== null) return value;
        }
      }
      if (Array.isArray(item?.Rows)) {
        const value = visit(item.Rows);
        if (value !== null) return value;
      }
    }
    return null;
  };
  return visit(report?.Rows || []);
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({ connected: false });
    }

    // Set default dates if not provided (defaulting to the current financial year or last 6 months)
    let start = fromDate;
    let end = toDate;
    if (!start || !end) {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      
      start = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } else {
      if (!isValidIsoDate(start) || !isValidIsoDate(end) || start > end) {
        return NextResponse.json({ error: 'Provide a valid date range with fromDate on or before toDate.' }, { status: 400 });
      }
      // Match the UI's maximum selectable interval instead of silently changing it.
      const dStart = new Date(start);
      const dEnd = new Date(end);
      const diffDays = Math.ceil((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 364) return NextResponse.json({ error: 'The reporting period cannot exceed 365 days.' }, { status: 400 });
    }

    const getStoredReport = async (key: string, fetchFromXero: () => Promise<unknown | null>) => {
      return getOrFetchManagementReport(tenantId, key, fetchFromXero);
    };
    const cacheKey = `ProfitAndLoss_${start}_${end}`;
    let report = null;
    try {
      report = await getStoredReport(cacheKey, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${start}&toDate=${end}`));
    } catch (error) {
      console.error('Failed to load Profit & Loss from PostgreSQL/Xero:', error);
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

    // If report is completely missing, return clean zero structured layout
    if (!report) {
      return NextResponse.json({
        connected: true,
        available: false,
        summary: null,
        income: { operating: [], other: [] },
        expenses: { operating: [], other: [] },
        trends: [],
        meta: { currency: orgCurrency, calculatedAt: new Date().toISOString() }
      });
    }

    const parsed = parseProfitAndLoss(report);
    let finalCurrency = parsed.currency;
    const hasExplicitCurrency = report?.ReportTitles?.some((t: string) => 
      t.toLowerCase().includes('currency:') || t.toLowerCase().includes('amounts in')
    );
    if (!hasExplicitCurrency && orgCurrency) finalCurrency = orgCurrency;

    // Compute sums dynamically
    const operatingIncomeSum = parsed.income.operating.reduce((sum, item) => sum + item.value, 0);
    const otherIncomeSum = parsed.income.other.reduce((sum, item) => sum + item.value, 0);
    const totalIncome = operatingIncomeSum + otherIncomeSum;

    // Direct Cost of Sales (COGS)
    const cogsSum = parsed.cogs.reduce((sum, item) => sum + item.value, 0);

    const grossProfit = operatingIncomeSum - cogsSum;

    const operatingExpensesSum = parsed.expenses.operating.reduce((sum, item) => sum + item.value, 0);
    const otherExpensesSum = parsed.expenses.other.reduce((sum, item) => sum + item.value, 0);
    const totalExpenses = operatingExpensesSum + otherExpensesSum;

    const netProfit = (grossProfit + otherIncomeSum) - totalExpenses;

    const profitMargin = totalIncome !== 0 ? (netProfit / totalIncome) * 100 : null;
    const grossProfitMargin = operatingIncomeSum !== 0 ? (grossProfit / operatingIncomeSum) * 100 : null;

    // Generate monthly trend
    const trends = [];
    // Get list of months in the range
    const monthsList: { year: number; month: number; label: string; start: string; end: string }[] = [];
    const parsedStart = new Date(`${start}T00:00:00Z`);
    const parsedEnd = new Date(`${end}T00:00:00Z`);
    const curr = new Date(Date.UTC(parsedStart.getUTCFullYear(), parsedStart.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth(), 1));
    
    // At most 13 calendar buckets can intersect a valid 365-day inclusive range.
    while (curr <= endMonth && monthsList.length < 13) {
      monthsList.push({
        year: curr.getUTCFullYear(),
        month: curr.getUTCMonth(),
        label: curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        start: curr.toISOString().slice(0, 10),
        end: new Date(Date.UTC(curr.getUTCFullYear(), curr.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
      });
      curr.setUTCMonth(curr.getUTCMonth() + 1);
    }

    for (const m of monthsList) {
      const mStart = m.start < start ? start : m.start;
      const mEnd = m.end > end ? end : m.end;
      const mCacheKey = `ProfitAndLoss_${mStart}_${mEnd}`;
      
      let mReport = null;
      try {
        mReport = await getStoredReport(mCacheKey, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${mStart}&toDate=${mEnd}`));
      } catch (error) {
        console.error(`Failed to fetch P&L for trend month ${mStart}:`, error);
        throw error;
      }
      
      const monthParsed = mReport ? parseProfitAndLoss(mReport) : null;
      const hasAccountDetail = Boolean(monthParsed && hasUsablePnlAccountRows(mReport) && (monthParsed.income.operating.length || monthParsed.income.other.length || monthParsed.cogs.length || monthParsed.expenses.operating.length || monthParsed.expenses.other.length));
      const sourceRevenue = mReport ? findPnlSummaryValue(mReport, ['total turnover', 'turnover', 'total trading income', 'total revenue', 'total income', 'revenue']) : null;
      const sourceOperatingExpenses = mReport ? findPnlSummaryValue(mReport, ['total operating expenses', 'total administrative costs', 'total overheads', 'operating expenses']) : null;
      const sourceTotalExpenses = mReport ? findPnlSummaryValue(mReport, ['total expenses']) : null;
      const sourceCogs = mReport ? findPnlSummaryValue(mReport, ['total cost of sales', 'total cost of goods sold', 'cost of goods sold', 'total direct costs', 'direct costs']) : null;
      const sourceGrossProfit = mReport ? findPnlSummaryValue(mReport, ['gross profit', 'gross profit / loss']) : null;
      const sourceNetProfit = mReport ? findPnlSummaryValue(mReport, ['net profit', 'net profit / loss', 'net income', 'profit for the year']) : null;
      const sourceExpenseTotal = sourceTotalExpenses ?? (sourceOperatingExpenses !== null && sourceCogs !== null ? sourceOperatingExpenses + sourceCogs : sourceOperatingExpenses);
      const monthHasDetail = Boolean(hasAccountDetail || (sourceRevenue !== null && sourceExpenseTotal !== null && sourceNetProfit !== null));
      const monthRevenue = hasAccountDetail && monthParsed ? monthParsed.income.operating.reduce((sum, item) => sum + item.value, 0) + monthParsed.income.other.reduce((sum, item) => sum + item.value, 0) : sourceRevenue;
      const monthExpenses = hasAccountDetail && monthParsed ? monthParsed.cogs.reduce((sum, item) => sum + item.value, 0) + monthParsed.expenses.operating.reduce((sum, item) => sum + item.value, 0) + monthParsed.expenses.other.reduce((sum, item) => sum + item.value, 0) : sourceExpenseTotal;
      const monthNet = hasAccountDetail && monthParsed ? monthParsed.income.operating.reduce((sum, item) => sum + item.value, 0) - monthParsed.cogs.reduce((sum, item) => sum + item.value, 0) + monthParsed.income.other.reduce((sum, item) => sum + item.value, 0) - monthParsed.expenses.operating.reduce((sum, item) => sum + item.value, 0) - monthParsed.expenses.other.reduce((sum, item) => sum + item.value, 0) : sourceNetProfit;
      const monthGrossProfit = hasAccountDetail && monthParsed
        ? monthParsed.income.operating.reduce((sum, item) => sum + item.value, 0) - monthParsed.cogs.reduce((sum, item) => sum + item.value, 0)
        : sourceGrossProfit;
      
      trends.push({
        month: m.label,
        available: monthHasDetail,
        revenue: monthHasDetail ? monthRevenue : null,
        expenses: monthHasDetail ? monthExpenses : null,
        grossProfit: monthHasDetail ? monthGrossProfit : null,
        netProfit: monthNet,
        reason: monthHasDetail ? null : (mReport ? 'Xero returned no usable P&L account detail for this month.' : 'No monthly Xero report was returned.')
      });
    }

    return NextResponse.json({
      connected: true,
      available: hasUsablePnlAccountRows(report),
      summary: {
        revenue: totalIncome,
        turnover: operatingIncomeSum,
        otherIncome: otherIncomeSum,
        cogs: cogsSum,
        expenses: operatingExpensesSum + otherExpensesSum,
        totalExpenses: cogsSum + operatingExpensesSum + otherExpensesSum,
        grossProfit,
        netProfit,
        profitMargin: profitMargin === null ? null : Math.round(profitMargin * 10) / 10,
        grossProfitMargin: grossProfitMargin === null ? null : Math.round(grossProfitMargin * 10) / 10
      },
      income: parsed.income,
      cogs: parsed.cogs,
      expenses: parsed.expenses,
      trends,
      meta: {
        currency: finalCurrency,
        calculatedAt: new Date().toISOString(),
        fromDate: start,
        toDate: end,
        organizationName: org?.Name || org?.LegalName || org?.OrganisationName || null
      }
    });

  } catch (err: any) {
    console.error('Profit and Loss API handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
