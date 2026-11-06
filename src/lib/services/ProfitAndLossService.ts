import { XeroReportParser } from './XeroReportParser';

export interface ProfitAndLossSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  otherIncome: number;
  otherExpenses: number;
  depreciation: number | null;
  amortization: number | null;
  interest: number | null;
  tax: number | null;
  ebitda: number | null;
  netProfit: number;
}

export class ProfitAndLossService {
  /**
   * Parses the nested Rows grid of a Profit and Loss report
   * and returns structured financial metrics.
   */
  static parseReport(report: any): ProfitAndLossSummary {
    const result: ProfitAndLossSummary = {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      operatingProfit: 0,
      otherIncome: 0,
      otherExpenses: 0,
      depreciation: null,
      amortization: null,
      interest: null,
      tax: null,
      ebitda: null,
      netProfit: 0
    };

    if (!report || !report.Rows || !Array.isArray(report.Rows)) return result;

    const rows = report.Rows;

    // 1. Extract Revenue (Total Trading Income or Sales summary rows)
    const revenueVal = XeroReportParser.findRowValue(rows, [
      'total turnover',
      'turnover',
      'total trading income',
      'total revenue',
      'total income',
      'revenue',
      'sales'
    ]);
    result.revenue = revenueVal !== null ? revenueVal : 0;

    // 2. Extract Cost of Goods Sold (COGS)
    const cogsVal = XeroReportParser.findRowValue(rows, [
      'total cost of sales',
      'total cost of goods sold',
      'cost of goods sold',
      'total direct costs',
      'direct costs'
    ]);
    result.cogs = cogsVal !== null ? cogsVal : 0;

    // 3. Extract Gross Profit
    const gpVal = XeroReportParser.findRowValue(rows, ['gross profit']);
    result.grossProfit = gpVal !== null ? gpVal : (result.revenue - result.cogs);

    // 4. Extract Operating Expenses
    const expensesVal = XeroReportParser.findRowValue(rows, [
      'total operating expenses',
      'total administrative costs',
      'total overheads',
      'total expenses',
      'operating expenses',
      'administrative costs',
      'overheads'
    ]);
    result.operatingExpenses = expensesVal !== null ? expensesVal : 0;

    // 5. Operating Profit (EBIT)
    const opVal = XeroReportParser.findRowValue(rows, [
      'operating profit',
      'net operating income',
      'profit from operations',
      'operating profit / (loss)'
    ]);
    result.operatingProfit = opVal !== null ? opVal : (result.grossProfit - result.operatingExpenses);

    // 6. Extract Other Income
    const otherIncomeVal = XeroReportParser.findRowValue(rows, [
      'total other income',
      'other income'
    ]);
    result.otherIncome = otherIncomeVal !== null ? otherIncomeVal : 0;

    // 7. Extract Other Expenses
    const otherExpensesVal = XeroReportParser.findRowValue(rows, [
      'total other expenses',
      'other expenses'
    ]);
    result.otherExpenses = otherExpensesVal !== null ? otherExpensesVal : 0;

    // 8. Extract Depreciation & Amortization if explicitly present
    const depVal = XeroReportParser.findRowValue(rows, [
      'total depreciation',
      'depreciation',
      'depreciation and amortisation',
      'depreciation and amortization'
    ]);
    result.depreciation = depVal;

    const amortVal = XeroReportParser.findRowValue(rows, [
      'total amortisation',
      'total amortization',
      'amortisation',
      'amortization'
    ]);
    result.amortization = amortVal;

    // 9. Extract Interest & Tax if explicitly present
    const interestVal = XeroReportParser.findRowValue(rows, [
      'total interest expense',
      'interest expense',
      'interest paid',
      'finance costs'
    ]);
    result.interest = interestVal;

    const taxVal = XeroReportParser.findRowValue(rows, [
      'taxation',
      'income tax',
      'corporation tax',
      'tax expense'
    ]);
    result.tax = taxVal;

    // EBITDA calculation: Only calculated when depreciation or amortization data is available
    if (result.depreciation !== null || result.amortization !== null) {
      result.ebitda = result.operatingProfit + (result.depreciation || 0) + (result.amortization || 0);
    } else {
      result.ebitda = null;
    }

    // 10. Extract Net Profit (prefer authoritative Xero P&L row, fallback to full P&L formula)
    const npVal = XeroReportParser.findRowValue(rows, [
      'net profit',
      'net profit / loss',
      'net income',
      'profit after taxation',
      'profit for the year'
    ]);
    result.netProfit = npVal !== null ? npVal : ((result.grossProfit + result.otherIncome) - (result.operatingExpenses + result.otherExpenses));

    return result;
  }

  /**
   * Parses multi-period P&L report headers & rows to extract month-by-month revenue.
   * Returns map of "YYYY-MM" -> revenue number.
   */
  static parseMultiPeriodRevenue(report: any): Record<string, number> {
    const monthRevenueMap: Record<string, number> = {};
    if (!report || !report.Rows || !Array.isArray(report.Rows)) return monthRevenueMap;

    const headerRow = report.Rows.find((row: any) => row.RowType === 'Header');
    if (!headerRow || !headerRow.Cells) return monthRevenueMap;

    const colIndexToMonthKey: Record<number, string> = {};
    headerRow.Cells.forEach((cell: any, idx: number) => {
      if (idx === 0 || !cell.Value) return;
      const d = new Date(cell.Value);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        colIndexToMonthKey[idx] = `${y}-${m}`;
      }
    });

    const findSummaryRowCells = (rows: any[]): any[] | null => {
      for (const row of rows) {
        if (row.RowType === 'SummaryRow' || row.RowType === 'Row') {
          const firstCell = (row.Cells?.[0]?.Value || '').toLowerCase().trim();
          if (['total turnover', 'turnover', 'total trading income', 'total revenue', 'total income', 'revenue', 'sales', 'gross sales'].includes(firstCell)) {
            return row.Cells;
          }
        }
        if (row.Rows && Array.isArray(row.Rows)) {
          const subRes = findSummaryRowCells(row.Rows);
          if (subRes) return subRes;
        }
      }
      return null;
    };

    const revenueCells = findSummaryRowCells(report.Rows);
    if (revenueCells) {
      revenueCells.forEach((cell: any, idx: number) => {
        const monthKey = colIndexToMonthKey[idx];
        if (monthKey && cell.Value !== undefined) {
          const val = parseFloat(String(cell.Value).replace(/,/g, ''));
          if (!isNaN(val)) {
            monthRevenueMap[monthKey] = val;
          }
        }
      });
    }

    return monthRevenueMap;
  }
}
