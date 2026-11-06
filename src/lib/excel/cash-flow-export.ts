import ExcelJS from 'exceljs';

export interface ExportCFData {
  connected: boolean;
  summary: {
    operating: number;
    operatingChange: number;
    operatingReceipts: number;
    operatingPayments: number;
    investing: number;
    investingChange: number;
    investingReceipts: number;
    investingPayments: number;
    financing: number;
    financingChange: number;
    financingReceipts: number;
    financingPayments: number;
    cashIn: number;
    cashOut: number;
    cashInCount: number;
    cashOutCount: number;
    beginningCash: number;
    endingCash: number;
    change: number;
    changePercentage: number;
  };
  receivables?: {
    total: number;
    overdue: number;
  };
  payables?: {
    total: number;
    overdue: number;
  };
  forecast?: Array<{
    week: string;
    openingCash: number;
    expectedIn: number;
    expectedOut: number;
    netChange: number;
    closingCash: number;
    status: string;
  }>;
  inflowBreakdown?: Array<{
    category: string;
    amount: number;
    pct: number;
    color: string;
  }>;
  outflowBreakdown?: Array<{
    category: string;
    amount: number;
    pct: number;
    color: string;
  }>;
  history: Array<{
    month: string;
    cashIn: number;
    cashOut: number;
    netCashFlow: number;
  }>;
  bankAccounts?: Array<{
    name: string;
    opening: number;
    cashIn: number;
    cashOut: number;
    closing: number;
    netMovement?: number;
    type?: string;
  }>;
  meta?: {
    currency?: string;
    orgName?: string;
    calculatedAt?: string;
  };
}

export async function generateCashFlowExcelReport(
  data: ExportCFData,
  fromDate: string,
  toDate: string,
  rawEvents?: any[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Virtual CFO Intelligence Platform';
  workbook.lastModifiedBy = 'Virtual CFO System';
  workbook.created = new Date();

  const currencySymbol = getCurrencySymbol(data.meta?.currency || 'GBP');
  const numFmtCurrency = `"${currencySymbol}"#,##0.00;("${currencySymbol}"#,##0.00);"-"`;
  const numFmtPct = '0.0%';

  // Common styling constants
  const navyHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };

  const sectionHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };

  const tableHeaderFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF334155' }
  };

  const zebraFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }
  };

  const totalRowFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const boldBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
  };

  // =========================================================================
  // SHEET 1: EXECUTIVE DASHBOARD
  // =========================================================================
  const sheet1 = workbook.addWorksheet('Executive Dashboard', { views: [{ showGridLines: true }] });

  // Title Banner
  sheet1.mergeCells('A1:F2');
  const titleCell = sheet1.getCell('A1');
  titleCell.value = 'CFO CASH FLOW INTELLIGENCE EXECUTIVE DASHBOARD';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = navyHeaderFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle Metadata
  sheet1.mergeCells('A3:F3');
  const subCell = sheet1.getCell('A3');
  const calculatedAtStr = data.meta?.calculatedAt ? new Date(data.meta.calculatedAt).toLocaleString() : new Date().toLocaleString();
  subCell.value = `Organization: ${data.meta?.orgName || 'Xero Connected Enterprise'} | Date Range: ${fromDate} to ${toDate} | Currency: ${data.meta?.currency || 'GBP'} | Exported: ${calculatedAtStr}`;
  subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center' };

  // KPI Summary Cards
  // Card 1: Total Liquid Cash
  sheet1.mergeCells('A5:B5');
  sheet1.getCell('A5').value = 'TOTAL LIQUID CASH (ACTUAL)';
  sheet1.getCell('A5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  sheet1.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  sheet1.mergeCells('A6:B6');
  sheet1.getCell('A6').value = data.summary.endingCash || 0;
  sheet1.getCell('A6').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E40AF' } };
  sheet1.getCell('A6').numFmt = numFmtCurrency;
  sheet1.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

  // Card 2: Cash Inflows
  sheet1.mergeCells('C5:D5');
  sheet1.getCell('C5').value = 'PERIOD CASH INFLOWS';
  sheet1.getCell('C5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  sheet1.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  sheet1.mergeCells('C6:D6');
  sheet1.getCell('C6').value = data.summary.cashIn || 0;
  sheet1.getCell('C6').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  sheet1.getCell('C6').numFmt = numFmtCurrency;
  sheet1.getCell('C6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };

  // Card 3: Cash Outflows
  sheet1.mergeCells('E5:F5');
  sheet1.getCell('E5').value = 'PERIOD CASH OUTFLOWS';
  sheet1.getCell('E5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
  sheet1.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
  sheet1.mergeCells('E6:F6');
  sheet1.getCell('E6').value = data.summary.cashOut || 0;
  sheet1.getCell('E6').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF991B1B' } };
  sheet1.getCell('E6').numFmt = numFmtCurrency;
  sheet1.getCell('E6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

  // Row 2 of Cards
  // Card 4: Net Cash Movement
  sheet1.mergeCells('A8:B8');
  sheet1.getCell('A8').value = 'NET CASH MOVEMENT';
  sheet1.getCell('A8').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4338CA' } };
  sheet1.getCell('A8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  sheet1.mergeCells('A9:B9');
  sheet1.getCell('A9').value = data.summary.change || (data.summary.cashIn - data.summary.cashOut);
  sheet1.getCell('A9').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF3730A3' } };
  sheet1.getCell('A9').numFmt = numFmtCurrency;
  sheet1.getCell('A9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

  // Card 5: Receivables
  sheet1.mergeCells('C8:D8');
  sheet1.getCell('C8').value = `ACCOUNTS RECEIVABLE (OVERDUE: ${currencySymbol}${(data.receivables?.overdue || 0).toLocaleString()})`;
  sheet1.getCell('C8').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  sheet1.getCell('C8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
  sheet1.mergeCells('C9:D9');
  sheet1.getCell('C9').value = data.receivables?.total || 0;
  sheet1.getCell('C9').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF92400E' } };
  sheet1.getCell('C9').numFmt = numFmtCurrency;
  sheet1.getCell('C9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };

  // Card 6: Payables
  sheet1.mergeCells('E8:F8');
  sheet1.getCell('E8').value = `ACCOUNTS PAYABLE (OVERDUE: ${currencySymbol}${(data.payables?.overdue || 0).toLocaleString()})`;
  sheet1.getCell('E8').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF6B21A8' } };
  sheet1.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };
  sheet1.mergeCells('E9:F9');
  sheet1.getCell('E9').value = data.payables?.total || 0;
  sheet1.getCell('E9').font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF581C87' } };
  sheet1.getCell('E9').numFmt = numFmtCurrency;
  sheet1.getCell('E9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF5FF' } };

  // Statement of Cash Flows Section
  sheet1.mergeCells('A11:D11');
  sheet1.getCell('A11').value = 'STATEMENT OF CASH FLOWS (IFRS / GAAP STANDARD)';
  sheet1.getCell('A11').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet1.getCell('A11').fill = sectionHeaderFill;

  // Table Headers
  const scfHeaders = ['Cash Flow Activity Category', 'Cash Receipts ($)', 'Cash Payments ($)', 'Net Movement ($)'];
  scfHeaders.forEach((h, colIdx) => {
    const cell = sheet1.getCell(12, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'right' };
  });

  const scfData = [
    // Operating
    { name: 'Operating Activities', isHeader: true },
    { name: '  Cash Collections from Customers & Revenue Receipts', in: data.summary.operatingReceipts || data.summary.cashIn, out: 0 },
    { name: '  Cash Paid to Suppliers, Operating Expenses & Staff', in: 0, out: data.summary.operatingPayments || data.summary.cashOut },
    { name: 'NET CASH FROM OPERATING ACTIVITIES', isSubtotal: true, formula: '=B14-C15' },

    // Investing
    { name: 'Investing Activities', isHeader: true },
    { name: '  Capital Asset Purchases & Property Equipment', in: 0, out: data.summary.investingPayments || 0 },
    { name: '  Investment Receipts & Asset Disposals', in: data.summary.investingReceipts || 0, out: 0 },
    { name: 'NET CASH FROM INVESTING ACTIVITIES', isSubtotal: true, formula: '=B19-C18' },

    // Financing
    { name: 'Financing Activities', isHeader: true },
    { name: '  Equity Capital Injections & Loan Inflows', in: data.summary.financingReceipts || 0, out: 0 },
    { name: '  Debt Principal Repayments & Dividends Paid', in: 0, out: data.summary.financingPayments || 0 },
    { name: 'NET CASH FROM FINANCING ACTIVITIES', isSubtotal: true, formula: '=B22-C23' },

    // Totals
    { name: 'TOTAL NET INCREASE / (DECREASE) IN CASH', isGrandTotal: true, formula: '=D16+D20+D24' },
    { name: 'Beginning Cash & Liquid Pool Balance', isBeginning: true, val: data.summary.beginningCash || 0 },
    { name: 'ENDING LIQUID CASH BALANCE', isEnding: true, formula: '=D25+D26' }
  ];

  let currRow = 13;
  scfData.forEach((rowItem) => {
    const row = sheet1.getRow(currRow);

    if (rowItem.isHeader) {
      sheet1.mergeCells(`A${currRow}:D${currRow}`);
      const c = sheet1.getCell(`A${currRow}`);
      c.value = rowItem.name;
      c.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    } else if (rowItem.isSubtotal) {
      row.getCell(1).value = rowItem.name;
      row.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(4).value = { formula: rowItem.formula };
      row.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(4).numFmt = numFmtCurrency;
      row.getCell(4).alignment = { horizontal: 'right' };
      row.eachCell({ includeEmpty: true }, c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });
    } else if (rowItem.isGrandTotal) {
      row.getCell(1).value = rowItem.name;
      row.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
      row.getCell(4).value = { formula: rowItem.formula };
      row.getCell(4).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
      row.getCell(4).numFmt = numFmtCurrency;
      row.getCell(4).alignment = { horizontal: 'right' };
      row.eachCell({ includeEmpty: true }, c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        c.border = boldBorder;
      });
    } else if (rowItem.isBeginning) {
      row.getCell(1).value = rowItem.name;
      row.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true };
      row.getCell(4).value = rowItem.val;
      row.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true };
      row.getCell(4).numFmt = numFmtCurrency;
      row.getCell(4).alignment = { horizontal: 'right' };
    } else if (rowItem.isEnding) {
      row.getCell(1).value = rowItem.name;
      row.getCell(1).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF047857' } };
      row.getCell(4).value = { formula: rowItem.formula };
      row.getCell(4).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
      row.getCell(4).numFmt = numFmtCurrency;
      row.getCell(4).alignment = { horizontal: 'right' };
      row.eachCell({ includeEmpty: true }, c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        c.border = boldBorder;
      });
    } else {
      row.getCell(1).value = rowItem.name;
      row.getCell(1).font = { name: 'Segoe UI', size: 9.5 };

      row.getCell(2).value = rowItem.in || 0;
      row.getCell(2).font = { name: 'Segoe UI', size: 9.5 };
      row.getCell(2).numFmt = numFmtCurrency;
      row.getCell(2).alignment = { horizontal: 'right' };

      row.getCell(3).value = rowItem.out || 0;
      row.getCell(3).font = { name: 'Segoe UI', size: 9.5 };
      row.getCell(3).numFmt = numFmtCurrency;
      row.getCell(3).alignment = { horizontal: 'right' };

      row.getCell(4).value = { formula: `=B${currRow}-C${currRow}` };
      row.getCell(4).font = { name: 'Segoe UI', size: 9.5, bold: true };
      row.getCell(4).numFmt = numFmtCurrency;
      row.getCell(4).alignment = { horizontal: 'right' };
    }

    currRow++;
  });


  // =========================================================================
  // SHEET 2: MONTHLY VELOCITY & FORECAST
  // =========================================================================
  const sheet2 = workbook.addWorksheet('Monthly Velocity & Forecast', { views: [{ showGridLines: true }] });

  // Banner
  sheet2.mergeCells('A1:F2');
  const sheet2Title = sheet2.getCell('A1');
  sheet2Title.value = 'MONTHLY CASH FLOW VELOCITY & 13-WEEK ROLLING FORECAST';
  sheet2Title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet2Title.fill = navyHeaderFill;
  sheet2Title.alignment = { vertical: 'middle', horizontal: 'center' };

  // Table 1: Historical Monthly Movement
  sheet2.mergeCells('A4:F4');
  sheet2.getCell('A4').value = 'HISTORICAL MONTHLY CASH VELOCITY';
  sheet2.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet2.getCell('A4').fill = sectionHeaderFill;

  const monthHeaders = ['Month', 'Cash Inflow ($)', 'Cash Outflow ($)', 'Net Cash Movement ($)', 'Velocity Ratio (In/Out)', 'Movement Status'];
  monthHeaders.forEach((h, colIdx) => {
    const cell = sheet2.getCell(5, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 || colIdx === 5 ? 'left' : 'right' };
  });

  let hRow = 6;
  const historyList = data.history || [];
  historyList.forEach((m) => {
    const row = sheet2.getRow(hRow);
    row.getCell(1).value = m.month;
    row.getCell(2).value = m.cashIn;
    row.getCell(2).numFmt = numFmtCurrency;
    row.getCell(3).value = m.cashOut;
    row.getCell(3).numFmt = numFmtCurrency;
    row.getCell(4).value = { formula: `=B${hRow}-C${hRow}` };
    row.getCell(4).numFmt = numFmtCurrency;
    row.getCell(4).font = { bold: true };

    row.getCell(5).value = { formula: `=IF(C${hRow}>0, B${hRow}/C${hRow}, 1)` };
    row.getCell(5).numFmt = '0.00"x"';

    const netVal = m.netCashFlow || (m.cashIn - m.cashOut);
    row.getCell(6).value = netVal >= 0 ? 'NET POSITIVE' : 'NET DEFICIT';
    row.getCell(6).font = { bold: true, color: { argb: netVal >= 0 ? 'FF047857' : 'FFB91C1C' } };

    if (hRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    hRow++;
  });

  // Total row for Monthly History
  const histTotalRow = sheet2.getRow(hRow);
  histTotalRow.getCell(1).value = 'TOTAL HISTORICAL PERIOD';
  histTotalRow.getCell(1).font = { bold: true };
  histTotalRow.getCell(2).value = { formula: `=SUM(B6:B${hRow - 1})` };
  histTotalRow.getCell(2).numFmt = numFmtCurrency;
  histTotalRow.getCell(2).font = { bold: true };
  histTotalRow.getCell(3).value = { formula: `=SUM(C6:C${hRow - 1})` };
  histTotalRow.getCell(3).numFmt = numFmtCurrency;
  histTotalRow.getCell(3).font = { bold: true };
  histTotalRow.getCell(4).value = { formula: `=SUM(D6:D${hRow - 1})` };
  histTotalRow.getCell(4).numFmt = numFmtCurrency;
  histTotalRow.getCell(4).font = { bold: true };
  histTotalRow.getCell(5).value = { formula: `=AVERAGE(E6:E${hRow - 1})` };
  histTotalRow.getCell(5).numFmt = '0.00"x"';
  histTotalRow.getCell(5).font = { bold: true };
  histTotalRow.eachCell({ includeEmpty: true }, c => { c.fill = totalRowFill; c.border = boldBorder; });

  // Table 2: 13-Week Rolling Cash Flow Forecast
  const fStartRow = hRow + 3;
  sheet2.mergeCells(`A${fStartRow}:G${fStartRow}`);
  sheet2.getCell(`A${fStartRow}`).value = '13-WEEK ROLLING CASH FLOW FORECAST';
  sheet2.getCell(`A${fStartRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet2.getCell(`A${fStartRow}`).fill = sectionHeaderFill;

  const fcHeaders = ['Forecast Week / Period', 'Opening Cash ($)', 'Expected Inflows ($)', 'Expected Outflows ($)', 'Net Weekly Change ($)', 'Closing Cash Position ($)', 'Liquidity Status'];
  fcHeaders.forEach((h, colIdx) => {
    const cell = sheet2.getCell(fStartRow + 1, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 || colIdx === 6 ? 'left' : 'right' };
  });

  let fcRow = fStartRow + 2;
  const forecastList = data.forecast || [];
  forecastList.forEach((fc, idx) => {
    const row = sheet2.getRow(fcRow);
    row.getCell(1).value = fc.week;

    if (idx === 0) {
      row.getCell(2).value = fc.openingCash;
    } else {
      row.getCell(2).value = { formula: `=F${fcRow - 1}` };
    }
    row.getCell(2).numFmt = numFmtCurrency;

    row.getCell(3).value = fc.expectedIn;
    row.getCell(3).numFmt = numFmtCurrency;

    row.getCell(4).value = fc.expectedOut;
    row.getCell(4).numFmt = numFmtCurrency;

    row.getCell(5).value = { formula: `=C${fcRow}-D${fcRow}` };
    row.getCell(5).numFmt = numFmtCurrency;
    row.getCell(5).font = { bold: true };

    row.getCell(6).value = { formula: `=B${fcRow}+E${fcRow}` };
    row.getCell(6).numFmt = numFmtCurrency;
    row.getCell(6).font = { bold: true, color: { argb: 'FF0F172A' } };

    const statusText = fc.status || 'HEALTHY';
    row.getCell(7).value = statusText.toUpperCase();
    row.getCell(7).font = { 
      bold: true, 
      color: { 
        argb: statusText.toLowerCase() === 'strong' ? 'FF047857' : 
              statusText.toLowerCase() === 'healthy' ? 'FF0D9488' : 
              statusText.toLowerCase() === 'critical' ? 'FFB91C1C' : 'FFD97706' 
      } 
    };

    if (fcRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    fcRow++;
  });


  // =========================================================================
  // SHEET 3: INFLOW & OUTFLOW CATEGORIES
  // =========================================================================
  const sheet3 = workbook.addWorksheet('Inflow & Outflow Categories', { views: [{ showGridLines: true }] });

  sheet3.mergeCells('A1:D2');
  const sheet3Title = sheet3.getCell('A1');
  sheet3Title.value = 'CASH INFLOW & OUTFLOW CATEGORY DISTRIBUTION';
  sheet3Title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet3Title.fill = navyHeaderFill;
  sheet3Title.alignment = { vertical: 'middle', horizontal: 'center' };

  // Inflows Table Header
  sheet3.mergeCells('A4:D4');
  sheet3.getCell('A4').value = 'CASH INFLOW SOURCES BREAKDOWN';
  sheet3.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet3.getCell('A4').fill = sectionHeaderFill;

  const inHeaders = ['Category Name', 'Amount ($)', '% Share of Total Inflow', 'Category Type'];
  inHeaders.forEach((h, colIdx) => {
    const cell = sheet3.getCell(5, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 || colIdx === 3 ? 'left' : 'right' };
  });

  let inRow = 6;
  const inflows = data.inflowBreakdown || [];
  inflows.forEach((item) => {
    const row = sheet3.getRow(inRow);
    row.getCell(1).value = item.category;
    row.getCell(2).value = item.amount;
    row.getCell(2).numFmt = numFmtCurrency;
    row.getCell(3).value = item.pct ? item.pct / 100 : { formula: `=B${inRow}/SUM(B$6:B$20)` };
    row.getCell(3).numFmt = numFmtPct;
    row.getCell(4).value = 'Revenue / Receipts';

    if (inRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    inRow++;
  });

  // Total Inflows Row
  const inTotalRow = sheet3.getRow(inRow);
  inTotalRow.getCell(1).value = 'TOTAL CASH INFLOWS';
  inTotalRow.getCell(1).font = { bold: true };
  inTotalRow.getCell(2).value = { formula: `=SUM(B6:B${inRow - 1})` };
  inTotalRow.getCell(2).numFmt = numFmtCurrency;
  inTotalRow.getCell(2).font = { bold: true };
  inTotalRow.getCell(3).value = { formula: `=SUM(C6:C${inRow - 1})` };
  inTotalRow.getCell(3).numFmt = numFmtPct;
  inTotalRow.getCell(3).font = { bold: true };
  inTotalRow.eachCell({ includeEmpty: true }, c => { c.fill = totalRowFill; c.border = boldBorder; });

  // Outflows Table
  const outStartRow = inRow + 3;
  sheet3.mergeCells(`A${outStartRow}:D${outStartRow}`);
  sheet3.getCell(`A${outStartRow}`).value = 'CASH OUTFLOW CATEGORIES BREAKDOWN';
  sheet3.getCell(`A${outStartRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet3.getCell(`A${outStartRow}`).fill = sectionHeaderFill;

  const outHeaders = ['Category Name', 'Amount ($)', '% Share of Total Outflow', 'Expense Category Type'];
  outHeaders.forEach((h, colIdx) => {
    const cell = sheet3.getCell(outStartRow + 1, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 || colIdx === 3 ? 'left' : 'right' };
  });

  let outRow = outStartRow + 2;
  const outflows = data.outflowBreakdown || [];
  outflows.forEach((item) => {
    const row = sheet3.getRow(outRow);
    row.getCell(1).value = item.category;
    row.getCell(2).value = item.amount;
    row.getCell(2).numFmt = numFmtCurrency;
    row.getCell(3).value = item.pct ? item.pct / 100 : { formula: `=B${outRow}/SUM(B$${outStartRow + 2}:B$${outStartRow + 20})` };
    row.getCell(3).numFmt = numFmtPct;
    row.getCell(4).value = 'Operating / Supplier Expense';

    if (outRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    outRow++;
  });

  // Total Outflows Row
  const outTotalRow = sheet3.getRow(outRow);
  outTotalRow.getCell(1).value = 'TOTAL CASH OUTFLOWS';
  outTotalRow.getCell(1).font = { bold: true };
  outTotalRow.getCell(2).value = { formula: `=SUM(B${outStartRow + 2}:B${outRow - 1})` };
  outTotalRow.getCell(2).numFmt = numFmtCurrency;
  outTotalRow.getCell(2).font = { bold: true };
  outTotalRow.getCell(3).value = { formula: `=SUM(C${outStartRow + 2}:C${outRow - 1})` };
  outTotalRow.getCell(3).numFmt = numFmtPct;
  outTotalRow.getCell(3).font = { bold: true };
  outTotalRow.eachCell({ includeEmpty: true }, c => { c.fill = totalRowFill; c.border = boldBorder; });


  // =========================================================================
  // SHEET 4: BANK LIQUIDITY FEEDS
  // =========================================================================
  const sheet4 = workbook.addWorksheet('Bank Accounts Liquidity', { views: [{ showGridLines: true }] });

  sheet4.mergeCells('A1:G2');
  const sheet4Title = sheet4.getCell('A1');
  sheet4Title.value = 'LIQUID BANK ACCOUNTS & CASH POOLS SUMMARY';
  sheet4Title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet4Title.fill = navyHeaderFill;
  sheet4Title.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet4.mergeCells('A4:G4');
  sheet4.getCell('A4').value = 'REAL-TIME BANK ACCOUNTS & CASH BALANCE FEEDS';
  sheet4.getCell('A4').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet4.getCell('A4').fill = sectionHeaderFill;

  const bankHeaders = ['Bank Account Name', 'Account Type', 'Opening Balance ($)', 'Period Inflows ($)', 'Period Outflows ($)', 'Closing Balance ($)', 'Net Movement ($)'];
  bankHeaders.forEach((h, colIdx) => {
    const cell = sheet4.getCell(5, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 0 || colIdx === 1 ? 'left' : 'right' };
  });

  let bkRow = 6;
  const accounts = data.bankAccounts || [];
  accounts.forEach((acc) => {
    const row = sheet4.getRow(bkRow);
    row.getCell(1).value = acc.name;
    row.getCell(2).value = acc.type || 'Checking / Operational';

    row.getCell(3).value = acc.opening;
    row.getCell(3).numFmt = numFmtCurrency;

    row.getCell(4).value = acc.cashIn;
    row.getCell(4).numFmt = numFmtCurrency;

    row.getCell(5).value = acc.cashOut;
    row.getCell(5).numFmt = numFmtCurrency;

    row.getCell(6).value = { formula: `=C${bkRow}+D${bkRow}-E${bkRow}` };
    row.getCell(6).numFmt = numFmtCurrency;
    row.getCell(6).font = { bold: true };

    const netMov = acc.netMovement !== undefined ? acc.netMovement : (acc.closing - acc.opening);
    row.getCell(7).value = { formula: `=F${bkRow}-C${bkRow}` };
    row.getCell(7).numFmt = numFmtCurrency;
    row.getCell(7).font = { bold: true, color: { argb: netMov >= 0 ? 'FF047857' : 'FFB91C1C' } };

    if (bkRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    bkRow++;
  });

  // Total Row for Bank Accounts
  const bkTotalRow = sheet4.getRow(bkRow);
  bkTotalRow.getCell(1).value = 'COMBINED LIQUID POOL TOTAL';
  bkTotalRow.getCell(1).font = { bold: true };
  bkTotalRow.getCell(3).value = { formula: `=SUM(C6:C${bkRow - 1})` };
  bkTotalRow.getCell(3).numFmt = numFmtCurrency;
  bkTotalRow.getCell(3).font = { bold: true };
  bkTotalRow.getCell(4).value = { formula: `=SUM(D6:D${bkRow - 1})` };
  bkTotalRow.getCell(4).numFmt = numFmtCurrency;
  bkTotalRow.getCell(4).font = { bold: true };
  bkTotalRow.getCell(5).value = { formula: `=SUM(E6:E${bkRow - 1})` };
  bkTotalRow.getCell(5).numFmt = numFmtCurrency;
  bkTotalRow.getCell(5).font = { bold: true };
  bkTotalRow.getCell(6).value = { formula: `=SUM(F6:F${bkRow - 1})` };
  bkTotalRow.getCell(6).numFmt = numFmtCurrency;
  bkTotalRow.getCell(6).font = { bold: true, color: { argb: 'FF0F172A' } };
  bkTotalRow.getCell(7).value = { formula: `=SUM(G6:G${bkRow - 1})` };
  bkTotalRow.getCell(7).numFmt = numFmtCurrency;
  bkTotalRow.getCell(7).font = { bold: true };
  bkTotalRow.eachCell({ includeEmpty: true }, c => { c.fill = totalRowFill; c.border = boldBorder; });


  // =========================================================================
  // SHEET 5: RAW TRANSACTIONS & LEDGER (PIVOT TABLE READY)
  // =========================================================================
  const sheet5 = workbook.addWorksheet('Raw Ledger & Transactions', { views: [{ showGridLines: true }] });

  sheet5.mergeCells('A1:I1');
  const sheet5Title = sheet5.getCell('A1');
  sheet5Title.value = 'ITEMIZED CASH LEDGER & TRANSACTIONS DATA (PIVOT TABLE READY)';
  sheet5Title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet5Title.fill = navyHeaderFill;
  sheet5Title.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet5.mergeCells('A2:I2');
  const sheet5Sub = sheet5.getCell('A2');
  sheet5Sub.value = 'This raw structured data table includes active Excel AutoFilters. Select any cell to create custom PivotTables, Slicers, and Excel Charts.';
  sheet5Sub.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  sheet5Sub.alignment = { horizontal: 'center' };

  const txHeaders = ['Transaction ID', 'Date', 'Source Type', 'Contact / Payee', 'Category / Ledger Account', 'Direction', 'Amount ($)', 'Verification Status', 'Currency'];
  txHeaders.forEach((h, colIdx) => {
    const cell = sheet5.getCell(4, colIdx + 1);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = tableHeaderFill;
    cell.alignment = { horizontal: colIdx === 6 ? 'right' : 'left' };
  });

  // Enable AutoFilter on row 4
  sheet5.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: txHeaders.length }
  };

  let txRow = 5;
  const eventsToExport = (rawEvents && rawEvents.length > 0) ? rawEvents : buildFallbackEvents(data);

  eventsToExport.forEach((evt) => {
    const row = sheet5.getRow(txRow);
    row.getCell(1).value = evt.id || `TXN-${1000 + txRow}`;
    row.getCell(2).value = evt.date ? new Date(evt.date).toISOString().split('T')[0] : fromDate;
    row.getCell(3).value = evt.source || 'Payment';
    row.getCell(4).value = evt.contact || 'Direct Bank Settlement';
    row.getCell(5).value = evt.category || (evt.direction === 'IN' ? 'Customer Sales Revenue' : 'Supplier Operating Expense');
    row.getCell(6).value = evt.direction || 'IN';
    row.getCell(6).font = { bold: true, color: { argb: evt.direction === 'IN' ? 'FF047857' : 'FFB91C1C' } };

    row.getCell(7).value = Math.abs(evt.amount || 0);
    row.getCell(7).numFmt = numFmtCurrency;
    row.getCell(7).alignment = { horizontal: 'right' };

    row.getCell(8).value = evt.isVerified !== false ? 'VERIFIED' : 'UNVERIFIED';
    row.getCell(8).font = { bold: true, color: { argb: evt.isVerified !== false ? 'FF047857' : 'FFD97706' } };

    row.getCell(9).value = evt.currency || data.meta?.currency || 'GBP';

    if (txRow % 2 === 1) {
      row.eachCell({ includeEmpty: true }, c => c.fill = zebraFill);
    }
    txRow++;
  });


  // Auto-fit Column Widths across all sheets
  [sheet1, sheet2, sheet3, sheet4, sheet5].forEach((ws) => {
    ws.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const val = cell.value !== null && cell.value !== undefined ? cell.value.toString() : '';
        if (val.length > maxLen) {
          maxLen = val.length;
        }
      });
      column.width = Math.min(Math.max(maxLen + 3, 14), 45);
    });
  });

  // Write Excel file buffer & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Cash_Flow_Intelligence_Executive_Report_${fromDate}_to_${toDate}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

// Helpers
function getCurrencySymbol(code: string): string {
  if (code === 'GBP') return '£';
  if (code === 'EUR') return '€';
  if (code === 'INR') return '₹';
  return '$';
}

function buildFallbackEvents(data: ExportCFData): any[] {
  const list: any[] = [];
  let idCount = 1001;

  // Add category inflow rows
  (data.inflowBreakdown || []).forEach((inf) => {
    list.push({
      id: `INFLOW-${idCount++}`,
      date: new Date().toISOString(),
      source: 'Payment',
      contact: inf.category,
      category: inf.category,
      direction: 'IN',
      amount: inf.amount,
      isVerified: true,
      currency: data.meta?.currency || 'GBP'
    });
  });

  // Add category outflow rows
  (data.outflowBreakdown || []).forEach((out) => {
    list.push({
      id: `OUTFLOW-${idCount++}`,
      date: new Date().toISOString(),
      source: 'BankTransaction',
      contact: out.category,
      category: out.category,
      direction: 'OUT',
      amount: out.amount,
      isVerified: true,
      currency: data.meta?.currency || 'GBP'
    });
  });

  return list;
}
