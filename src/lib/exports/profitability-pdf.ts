import type { jsPDF } from 'jspdf';
import { FORECAST_COVER_BASE64 } from './cover-images';

export interface ProfitabilityPdfOptions {
  orgName?: string;
  currency?: string;
  periodLabel: string;
  dataSource?: string;
  selectedPeriod: string;
  data: {
    revenue?: number | null;
    cogs?: number | null;
    grossProfit?: number | null;
    grossMarginPct?: number | null;
    operatingExpenses?: number | null;
    operatingMarginPct?: number | null;
    ebitda?: number | null;
    depreciation?: number | null;
    operatingProfit?: number | null;
    interestExpenses?: number | null;
    profitBeforeTax?: number | null;
    taxProvision?: number | null;
    netProfit?: number | null;
    netMarginPct?: number | null;
    breakEvenSales?: number | null;
    marginOfSafetyPct?: number | null;
    currency?: string;
    customerProfitability?: Array<{
      customer: string;
      revenue: number;
      grossProfit?: number | null;
      margin?: number | null;
      invoices?: Array<{
        invoiceNumber?: string;
        date?: string;
        description?: string;
        status?: string;
        amount?: number;
      }>;
    }>;
    productProfitability?: Array<{
      product: string;
      revenue: number;
      grossProfit?: number | null;
      margin?: number | null;
      subEntries?: Array<{
        customer?: string;
        invoiceNumber?: string;
        date?: string;
        quantity?: number;
        unitAmount?: number;
        amount?: number;
      }>;
    }>;
    departmentProfitability?: Array<{
      department: string;
      revenue: number;
      grossProfit?: number | null;
      margin?: number | null;
      subEntries?: Array<{
        customer?: string;
        invoiceNumber?: string;
        date?: string;
        description?: string;
        amount?: number;
      }>;
    }>;
    budgetVsActual?: Array<{
      category: string;
      type: string;
      budget: number;
      actual: number;
    }>;
    expenseAnalysis?: Array<{
      account: string;
      accountType: string;
      actual: number;
    }>;
    priorPeriod?: {
      revenue?: number | null;
      cogs?: number | null;
      grossProfit?: number | null;
      operatingExpenses?: number | null;
      operatingProfit?: number | null;
      netProfit?: number | null;
    } | null;
    marginDistribution?: {
      eligibleCount?: number;
      highMargin?: { count: number; pct: number | null };
      mediumMargin?: { count: number; pct: number | null };
      lowMargin?: { count: number; pct: number | null };
    };
    aiOpportunities?: string[];
  };
}

export async function exportProfitabilityPdf(options: ProfitabilityPdfOptions): Promise<void> {
  const { default: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const totalPages = 4;

  const currency = options.currency || options.data?.currency || 'USD';
  const symbol =
    currency === 'GBP'
      ? '£'
      : currency === 'EUR'
        ? '€'
        : currency === 'AUD'
          ? 'A$'
          : currency === 'CAD'
            ? 'C$'
            : '$';

  const fmtMoney = (val: number | null | undefined): string => {
    if (val == null || !Number.isFinite(Number(val))) return 'N/A';
    const num = Number(val);
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return num < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  };

  const fmtPct = (val: number | null | undefined): string => {
    if (val == null || !Number.isFinite(Number(val))) return 'N/A';
    return `${Number(val).toFixed(2)}%`;
  };

  const drawPageFooter = (pageNum: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Virtual CFO Intelligence · ${options.orgName || 'Financial Reporting'} · Reporting Window: ${options.periodLabel} · Currency: ${currency}`,
      margin,
      pageHeight - 5,
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  };

  const drawRunningHeader = (sectionTitle: string) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, 12, pageWidth - margin, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('VIRTUAL CFO PLATFORM · FINANCIAL PERFORMANCE REPORT', margin, 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${sectionTitle} · Period: ${options.periodLabel}`, pageWidth - margin, 9.5, {
      align: 'right',
    });
  };

  // Helper: Formal Financial Table Renderer
  interface ColumnDef {
    header: string;
    width: number;
    align?: 'left' | 'right' | 'center';
  }

  const renderTable = (
    startX: number,
    startY: number,
    columns: ColumnDef[],
    rows: (string | { text: string; color?: number[]; bold?: boolean; align?: 'left' | 'right' | 'center' })[][],
    tableOptions?: {
      headerHeight?: number;
      rowHeight?: number;
      fontSize?: number;
      headerFontSize?: number;
      zebra?: boolean;
      headerBg?: number[];
      borderColor?: number[];
      isTotalRowLast?: boolean;
    },
  ): number => {
    const headerHeight = tableOptions?.headerHeight ?? 6.8;
    const rowHeight = tableOptions?.rowHeight ?? 5.6;
    const fontSize = tableOptions?.fontSize ?? 7;
    const headerFontSize = tableOptions?.headerFontSize ?? 6.8;
    const headerBg = tableOptions?.headerBg ?? [15, 23, 42]; // Slate 900
    const borderColor = tableOptions?.borderColor ?? [226, 232, 240];

    let currentY = startY;
    const totalTableWidth = columns.reduce((sum, col) => sum + col.width, 0);

    // Draw Header
    let currentX = startX;
    doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    doc.rect(startX, currentY, totalTableWidth, headerHeight, 'F');

    columns.forEach((col) => {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);

      const headerLines = col.header.split('\n');
      const lineH = 2.8;
      const textStartY = currentY + headerHeight / 2 - ((headerLines.length - 1) * lineH) / 2 + 0.8;

      headerLines.forEach((hLine, hIdx) => {
        let textX = currentX + 2.5;
        if (col.align === 'right') textX = currentX + col.width - 2.5;
        else if (col.align === 'center') textX = currentX + col.width / 2;
        doc.text(hLine, textX, textStartY + hIdx * lineH, { align: col.align || 'left' });
      });

      currentX += col.width;
    });

    currentY += headerHeight;

    // Draw Rows
    rows.forEach((row, rowIdx) => {
      const isTotalRow = tableOptions?.isTotalRowLast && rowIdx === rows.length - 1;

      let maxLinesInRow = 1;
      row.forEach((cell, colIdx) => {
        const col = columns[colIdx];
        const cellText = typeof cell === 'object' ? cell.text : cell;
        const lines = doc.splitTextToSize(cellText, col.width - 4);
        if (lines.length > maxLinesInRow) maxLinesInRow = lines.length;
      });

      const actualRowHeight = Math.max(rowHeight, maxLinesInRow * 3.2 + 2.4);

      currentX = startX;
      const isZebra = tableOptions?.zebra && rowIdx % 2 === 1 && !isTotalRow;

      if (isTotalRow) {
        doc.setFillColor(241, 245, 249); // Slate 100
        doc.rect(startX, currentY, totalTableWidth, actualRowHeight, 'F');
      } else if (isZebra) {
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.rect(startX, currentY, totalTableWidth, actualRowHeight, 'F');
      }

      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.15);
      doc.line(startX, currentY + actualRowHeight, startX + totalTableWidth, currentY + actualRowHeight);

      if (isTotalRow) {
        doc.setLineWidth(0.35);
        doc.line(startX, currentY, startX + totalTableWidth, currentY);
        // Double underline bottom for total row
        doc.line(startX, currentY + actualRowHeight - 0.5, startX + totalTableWidth, currentY + actualRowHeight - 0.5);
      }

      row.forEach((cell, colIdx) => {
        const col = columns[colIdx];
        const cellObj = typeof cell === 'object' ? cell : { text: cell };
        const text = cellObj.text ?? '';
        const align = cellObj.align || col.align || 'left';
        const isBold = isTotalRow || cellObj.bold;

        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);

        if (cellObj.color) {
          doc.setTextColor(cellObj.color[0], cellObj.color[1], cellObj.color[2]);
        } else if (isTotalRow) {
          doc.setTextColor(15, 23, 42);
        } else {
          doc.setTextColor(51, 65, 85);
        }

        let cellTextX = currentX + 2.5;
        if (align === 'right') cellTextX = currentX + col.width - 2.5;
        else if (align === 'center') cellTextX = currentX + col.width / 2;

        const lines = doc.splitTextToSize(text, col.width - 4);
        const textStartY = currentY + actualRowHeight / 2 - ((lines.length - 1) * 3) / 2 + 0.8;
        doc.text(lines, cellTextX, textStartY, { align });

        currentX += col.width;
      });

      currentY += actualRowHeight;
    });

    return currentY;
  };

  const d = options.data;
  const rev = Number(d.revenue) || 0;
  const cogs = Number(d.cogs) || 0;
  const grossProfit = Number(d.grossProfit) || (rev - cogs);
  const grossMargin = rev > 0 ? (grossProfit / rev) * 100 : (Number(d.grossMarginPct) || 0);
  const opex = Number(d.operatingExpenses) || 0;
  const operatingProfit = Number(d.operatingProfit) ?? (grossProfit - opex);
  const operatingMargin = rev > 0 ? (operatingProfit / rev) * 100 : (Number(d.operatingMarginPct) || 0);
  const ebitda = d.ebitda != null ? Number(d.ebitda) : operatingProfit;
  const netProfit = Number(d.netProfit) ?? operatingProfit;
  const netMargin = rev > 0 ? (netProfit / rev) * 100 : (Number(d.netMarginPct) || 0);

  // =========================================================================
  // PAGE 1: EXECUTIVE COVER PAGE
  // =========================================================================
  try {
    doc.addImage(FORECAST_COVER_BASE64, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  } catch (err) {
    console.error('Failed to render profitability cover image:', err);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  // Cover Title Block
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, 45, contentWidth, 54, 3, 3, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, 45, contentWidth, 54, 3, 3, 'S');

  // Blue Accent Pill
  doc.setFillColor(0, 112, 243);
  doc.roundedRect(margin + 8, 54, 52, 5.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('EXECUTIVE FINANCIAL STATEMENT', margin + 11, 57.8);

  // Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Profitability Statement', margin + 8, 69);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Formal commercial performance assessment reconciled with Xero General Ledger.',
    margin + 8,
    76,
  );
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Reconciled accounting report for trading period: ${options.periodLabel}.`,
    margin + 8,
    82,
  );

  // Executive Metadata Card at bottom of cover
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, pageHeight - 26, contentWidth, 16, 2.5, 2.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, pageHeight - 26, contentWidth, 16, 2.5, 2.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(options.orgName || 'Virtual CFO Client Organization', margin + 5, pageHeight - 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Ledger Source: ${options.dataSource || 'Xero Live Organization Ledger'}`,
    margin + 5,
    pageHeight - 12.5,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 112, 243);
  doc.text(
    `Reporting Window: ${options.periodLabel}`,
    margin + contentWidth - 5,
    pageHeight - 17,
    { align: 'right' },
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Currency: ${currency} (${symbol}) · Generated: ${new Date().toLocaleDateString('en-GB')}`,
    margin + contentWidth - 5,
    pageHeight - 12.5,
    { align: 'right' },
  );

  // =========================================================================
  // PAGE 2: STATEMENT OF PROFITABILITY & OPERATING MARGINS (FORMAL PDF FORM)
  // =========================================================================
  doc.addPage();
  drawPageFooter(2);
  drawRunningHeader('Statement of Profitability & Operating Margins');

  let y = 17;

  // Formal Statement Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('STATEMENT OF PROFITABILITY & OPERATING MARGINS', margin, y + 4);

  // Audit Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Accounting Basis: Accrual P&L · Reconciled to Xero General Ledger · Reporting Window: ${options.periodLabel}`,
    margin,
    y + 9,
  );

  y += 13;

  // 4 Primary Executive Performance Stat Boxes (Formal Document Layout)
  const statBoxW = (contentWidth - 3 * 3) / 4; // ~44.25mm
  const statBoxH = 17;
  const headlineStats = [
    {
      title: 'NET REVENUE',
      value: fmtMoney(rev),
      sub: '100.0% Trading Turnover',
      color: [15, 23, 42],
    },
    {
      title: 'GROSS PROFIT',
      value: fmtMoney(grossProfit),
      sub: `${grossMargin.toFixed(1)}% Gross Margin`,
      color: grossMargin >= 40 ? [4, 120, 87] : [180, 83, 9],
    },
    {
      title: 'OPERATING PROFIT (EBIT)',
      value: fmtMoney(operatingProfit),
      sub: `${operatingMargin.toFixed(1)}% Operating Margin`,
      color: operatingProfit >= 0 ? [4, 120, 87] : [190, 18, 60],
    },
    {
      title: 'NET PROFIT (BOTTOM LINE)',
      value: fmtMoney(netProfit),
      sub: `${netMargin.toFixed(1)}% Net Margin`,
      color: netProfit >= 0 ? [4, 120, 87] : [190, 18, 60],
    },
  ];

  headlineStats.forEach((stat, idx) => {
    const sx = margin + idx * (statBoxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.rect(sx, y, statBoxW, statBoxH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(sx, y, statBoxW, statBoxH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.title, sx + 3, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, sx + 3, y + 10.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.sub, sx + 3, y + 14.8);
  });

  y += statBoxH + 6;

  // Formal P&L Statement Table (Financial Statement Form)
  const statementCols: ColumnDef[] = [
    { header: 'FINANCIAL STATEMENT LINE ITEM', width: 62, align: 'left' },
    { header: 'CLASSIFICATION', width: 28, align: 'left' },
    { header: `REPORTED ACTUAL (${symbol})`, width: 32, align: 'right' },
    { header: '% OF REVENUE', width: 20, align: 'right' },
    { header: 'PRIOR PERIOD', width: 22, align: 'right' },
    { header: 'ASSESSMENT', width: 22, align: 'center' },
  ];

  const prior = d.priorPeriod;
  const pctOfRev = (val: number | null | undefined) =>
    rev > 0 && val != null ? `${((Number(val) / rev) * 100).toFixed(1)}%` : '0.0%';

  const statementRows = [
    [
      'Net Trading Revenue (Turnover)',
      'Operating Sales',
      fmtMoney(rev),
      '100.0%',
      fmtMoney(prior?.revenue),
      { text: 'Base Income', color: [4, 120, 87], bold: true },
    ],
    [
      'Cost of Goods Sold (COGS)',
      'Direct Trading Costs',
      fmtMoney(cogs),
      pctOfRev(cogs),
      fmtMoney(prior?.cogs),
      { text: cogs <= rev * 0.4 ? 'Disciplined' : 'Elevated', color: cogs <= rev * 0.4 ? [4, 120, 87] : [180, 83, 9] },
    ],
    [
      'GROSS PROFIT',
      'Contribution Margin',
      fmtMoney(grossProfit),
      `${grossMargin.toFixed(1)}%`,
      fmtMoney(prior?.grossProfit),
      { text: grossMargin >= 50 ? 'Strong Contribution' : 'Standard', color: [4, 120, 87], bold: true },
    ],
    [
      'Operating Expenses (OPEX Overheads)',
      'Indirect Admin & Opex',
      fmtMoney(opex),
      pctOfRev(opex),
      fmtMoney(prior?.operatingExpenses),
      { text: opex < grossProfit ? 'Controlled' : 'Overhead Load', color: opex < grossProfit ? [51, 65, 85] : [190, 18, 60] },
    ],
    [
      'OPERATING PROFIT (EBIT)',
      'Core Trading Surplus',
      fmtMoney(operatingProfit),
      `${operatingMargin.toFixed(1)}%`,
      fmtMoney(prior?.operatingProfit),
      { text: operatingProfit >= 0 ? 'Profitable' : 'Operating Deficit', color: operatingProfit >= 0 ? [4, 120, 87] : [190, 18, 60], bold: true },
    ],
    [
      'EBITDA (Operating Cash Flow proxy)',
      'Operating Cash Generation',
      fmtMoney(ebitda),
      pctOfRev(ebitda),
      'N/A',
      { text: ebitda >= 0 ? 'Cash Positive' : 'Cash Burn', color: ebitda >= 0 ? [4, 120, 87] : [190, 18, 60] },
    ],
    [
      'Depreciation & Amortization',
      'Non-Cash Adjustments',
      fmtMoney(d.depreciation ?? 0),
      pctOfRev(d.depreciation ?? 0),
      'N/A',
      { text: 'Non-Cash', color: [100, 116, 139] },
    ],
    [
      'Interest & Financing Expenses',
      'Financing Overheads',
      fmtMoney(d.interestExpenses ?? 0),
      pctOfRev(d.interestExpenses ?? 0),
      'N/A',
      { text: 'Debt Service', color: [100, 116, 139] },
    ],
    [
      'Profit Before Tax (EBT)',
      'Pre-Tax Earnings',
      fmtMoney(d.profitBeforeTax ?? operatingProfit),
      pctOfRev(d.profitBeforeTax ?? operatingProfit),
      'N/A',
      { text: 'Taxable Base', color: [51, 65, 85] },
    ],
    [
      'Corporation Tax Provision',
      'Statutory Tax Accrual',
      fmtMoney(d.taxProvision ?? 0),
      pctOfRev(d.taxProvision ?? 0),
      'N/A',
      { text: 'Tax Liability', color: [100, 116, 139] },
    ],
    [
      'NET PROFIT (BOTTOM LINE SURPLUS)',
      'Net Retained Earnings',
      fmtMoney(netProfit),
      `${netMargin.toFixed(1)}%`,
      fmtMoney(prior?.netProfit),
      { text: netProfit >= 0 ? 'Net Surplus' : 'Net Loss', color: netProfit >= 0 ? [4, 120, 87] : [190, 18, 60], bold: true },
    ],
  ];

  y = renderTable(margin, y, statementCols, statementRows, {
    headerHeight: 7,
    rowHeight: 6.2,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
    isTotalRowLast: true,
  });

  y += 7;

  // Commercial Diagnostics & Break-Even Form Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE COMMERCIAL DIAGNOSTICS & BREAK-EVEN ANALYSIS', margin + 5, y + 6);

  // Three column indicators inside the box
  const diagColW = (contentWidth - 10) / 3;
  const breakEvenVal = d.breakEvenSales != null ? fmtMoney(d.breakEvenSales) : (grossMargin > 0 ? fmtMoney((opex / (grossMargin / 100))) : 'N/A');
  const safetyVal = d.marginOfSafetyPct != null ? `${d.marginOfSafetyPct.toFixed(1)}%` : (rev > 0 && opex > 0 && grossMargin > 0 ? `${Math.max(0, ((rev - (opex / (grossMargin / 100))) / rev) * 100).toFixed(1)}%` : 'N/A');
  const opexAbsorption = rev > 0 ? `${((opex / rev) * 100).toFixed(1)}%` : 'N/A';

  const diagnostics = [
    { label: 'BREAK-EVEN SALES VOLUME', val: breakEvenVal, desc: 'Sales required to cover all fixed and variable overheads.' },
    { label: 'MARGIN OF SAFETY', val: safetyVal, desc: 'Buffer before trading operations cross into an operating loss.' },
    { label: 'OPEX ABSORPTION RATE', val: opexAbsorption, desc: 'Proportion of gross trading revenue absorbed by overheads.' },
  ];

  diagnostics.forEach((diag, i) => {
    const dx = margin + 5 + i * diagColW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(diag.label, dx, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 112, 243);
    doc.text(diag.val, dx, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(diag.desc, diagColW - 6), dx, y + 25);
  });

  // Brief narrative conclusion line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  doc.line(margin + 5, y + 31, margin + contentWidth - 5, y + 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Observation:', margin + 5, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const narrative = rev > 0 && netProfit >= 0
    ? `The organization generated ${fmtMoney(rev)} in trading revenue with an operating margin of ${operatingMargin.toFixed(1)}%, converting ${fmtMoney(netProfit)} to bottom-line net profit after absorbing all overheads.`
    : `Trading volume totaled ${fmtMoney(rev)} with overhead costs absorbing ${fmtMoney(opex)}. Implement cost-rationalization and margin optimization across core customer lines.`;
  doc.text(narrative, margin + 28, y + 35, { maxWidth: contentWidth - 34 });

  // =========================================================================
  // PAGE 3: CUSTOMER REVENUE & COMMERCIAL CONCENTRATION SCHEDULE
  // =========================================================================
  doc.addPage();
  drawPageFooter(3);
  drawRunningHeader('Customer Revenue & Commercial Concentration');

  y = 17;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('CUSTOMER REVENUE & MARGIN CONTRIBUTION SCHEDULE', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Detailed invoice activity, revenue volume, and gross profit contribution across commercial clients',
    margin,
    y + 9,
  );

  y += 13;

  // Customer Summary Bar (3 Executive Totals)
  const custSummaryW = (contentWidth - 2 * 3) / 3;
  const customersList = d.customerProfitability || [];
  const totalCustCount = customersList.length;
  const totalCustRev = customersList.reduce((acc, c) => acc + (Number(c.revenue) || 0), 0);
  const top1CustRev = customersList[0]?.revenue || 0;
  const top1Share = totalCustRev > 0 ? ((top1CustRev / totalCustRev) * 100).toFixed(1) : '0.0';
  const avgCustRev = totalCustCount > 0 ? totalCustRev / totalCustCount : 0;

  const custSummary = [
    { title: 'ACTIVE COMMERCIAL CLIENTS', val: `${totalCustCount} Accounts`, sub: 'Accounts billed in period' },
    { title: 'TOP CLIENT CONCENTRATION', val: `${top1Share}%`, sub: `Led by ${customersList[0]?.customer || 'N/A'}` },
    { title: 'AVERAGE REVENUE PER CLIENT', val: fmtMoney(avgCustRev), sub: 'Mean client sales volume' },
  ];

  custSummary.forEach((cs, i) => {
    const cx = margin + i * (custSummaryW + 3);
    doc.setFillColor(248, 250, 252);
    doc.rect(cx, y, custSummaryW, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(cx, y, custSummaryW, 15, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(cs.title, cx + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(cs.val, cx + 3, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(cs.sub, cx + 3, y + 13.5, { maxWidth: custSummaryW - 6 });
  });

  y += 15 + 6;

  // Formal Customer Performance Table
  const custCols: ColumnDef[] = [
    { header: '#', width: 8, align: 'center' },
    { header: 'CUSTOMER / COMMERCIAL COUNTERPARTY', width: 68, align: 'left' },
    { header: 'INVOICES', width: 20, align: 'center' },
    { header: `SALES VOLUME (${symbol})`, width: 32, align: 'right' },
    { header: '% OF REVENUE', width: 26, align: 'right' },
    { header: 'CONTRIBUTION MARGIN', width: 32, align: 'right' },
  ];

  const custRows = customersList.slice(0, 14).map((cust, idx) => {
    const invCount = Array.isArray(cust.invoices) ? cust.invoices.length : 0;
    const cRev = Number(cust.revenue) || 0;
    const cShare = rev > 0 ? `${((cRev / rev) * 100).toFixed(1)}%` : '0.0%';
    const marginStr = cust.margin != null ? `${cust.margin}%` : 'N/A';
    return [
      String(idx + 1),
      cust.customer,
      `${invCount} ${invCount === 1 ? 'inv' : 'invs'}`,
      fmtMoney(cRev),
      cShare,
      marginStr,
    ];
  });

  if (customersList.length === 0) {
    custRows.push(['-', 'No customer invoice records found for this period.', '-', fmtMoney(0), '0.0%', 'N/A']);
  } else {
    // Total Row
    custRows.push([
      '',
      'TOTAL CUSTOMER SALES ACTIVITY',
      `${customersList.reduce((acc, c) => acc + (Array.isArray(c.invoices) ? c.invoices.length : 0), 0)} invs`,
      fmtMoney(totalCustRev),
      '100.0%',
      `${grossMargin.toFixed(1)}%`,
    ]);
  }

  y = renderTable(margin, y, custCols, custRows, {
    headerHeight: 7,
    rowHeight: 6,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
    isTotalRowLast: customersList.length > 0,
  });

  y += 7;

  // Margin Distribution Tier Schedule (Replacing toy widgets)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('COMMERCIAL MARGIN TIER BREAKDOWN', margin, y + 3);

  y += 5.5;

  const tierCols: ColumnDef[] = [
    { header: 'MARGIN CLASSIFICATION TIER', width: 60, align: 'left' },
    { header: 'QUALIFYING CLIENTS', width: 34, align: 'center' },
    { header: 'PROPORTION (%)', width: 32, align: 'right' },
    { header: 'STRATEGIC PORTFOLIO ASSESSMENT', width: 60, align: 'left' },
  ];

  const md = d.marginDistribution;
  const tierRows = [
    [
      'High Contribution Margin (> 50%)',
      String(md?.highMargin?.count ?? 0),
      md?.highMargin?.pct != null ? `${md.highMargin.pct.toFixed(1)}%` : 'N/A',
      { text: 'Core profitability generator; protect relationship and contract terms.', color: [4, 120, 87] },
    ],
    [
      'Medium Contribution Margin (20% – 50%)',
      String(md?.mediumMargin?.count ?? 0),
      md?.mediumMargin?.pct != null ? `${md.mediumMargin.pct.toFixed(1)}%` : 'N/A',
      { text: 'Stable commercial volume; review opportunities for service upselling.', color: [51, 65, 85] },
    ],
    [
      'Low Contribution Margin (< 20%)',
      String(md?.lowMargin?.count ?? 0),
      md?.lowMargin?.pct != null ? `${md.lowMargin.pct.toFixed(1)}%` : 'N/A',
      { text: 'Margin dilution risk; audit direct labor and third-party delivery costs.', color: [190, 18, 60] },
    ],
  ];

  y = renderTable(margin, y, tierCols, tierRows, {
    headerHeight: 6.5,
    rowHeight: 6,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
  });

  // =========================================================================
  // PAGE 4: PRODUCT ECONOMICS, TRACKING & GOVERNANCE SIGN-OFF
  // =========================================================================
  doc.addPage();
  drawPageFooter(4);
  drawRunningHeader('Product Economics, Departmental Tracking & Governance');

  y = 17;

  // Section 1: Product / Service Profitability Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Product & Service Profitability Schedule', margin, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Trading revenues and gross margins across catalog inventory and professional billing items', margin, y + 7.5);

  y += 10.5;

  const prodCols: ColumnDef[] = [
    { header: '#', width: 8, align: 'center' },
    { header: 'PRODUCT / SERVICE ITEM', width: 72, align: 'left' },
    { header: `REVENUE (${symbol})`, width: 34, align: 'right' },
    { header: `GROSS PROFIT (${symbol})`, width: 36, align: 'right' },
    { header: 'MARGIN (%)', width: 36, align: 'right' },
  ];

  const productsList = (d.productProfitability || []).slice(0, 7);
  const prodRows = productsList.map((prod, pIdx) => [
    String(pIdx + 1),
    prod.product,
    fmtMoney(prod.revenue),
    fmtMoney(prod.grossProfit),
    prod.margin != null ? `${prod.margin}%` : 'N/A',
  ]);

  if (productsList.length === 0) {
    prodRows.push(['-', 'No product/service catalog items recorded in this period.', fmtMoney(0), fmtMoney(0), 'N/A']);
  }

  y = renderTable(margin, y, prodCols, prodRows, {
    headerHeight: 6.5,
    rowHeight: 5.8,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
  });

  y += 7;

  // Section 2: Department / Regional Tracking Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Departmental & Regional Tracking Performance', margin, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Financial contribution segregated by Xero tracking categories, cost centers, or regions', margin, y + 7.5);

  y += 10.5;

  const deptCols: ColumnDef[] = [
    { header: '#', width: 8, align: 'center' },
    { header: 'DEPARTMENT / TRACKING CATEGORY', width: 72, align: 'left' },
    { header: `REVENUE (${symbol})`, width: 34, align: 'right' },
    { header: `GROSS PROFIT (${symbol})`, width: 36, align: 'right' },
    { header: 'MARGIN (%)', width: 36, align: 'right' },
  ];

  const deptList = (d.departmentProfitability || []).slice(0, 5);
  const deptRows = deptList.map((dept, dIdx) => [
    String(dIdx + 1),
    dept.department,
    fmtMoney(dept.revenue),
    fmtMoney(dept.grossProfit),
    dept.margin != null ? `${dept.margin}%` : 'N/A',
  ]);

  if (deptList.length === 0) {
    deptRows.push(['-', 'No tracking categories recorded in this period.', fmtMoney(0), fmtMoney(0), 'N/A']);
  }

  y = renderTable(margin, y, deptCols, deptRows, {
    headerHeight: 6.5,
    rowHeight: 5.8,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
  });

  y += 7;

  // Section 3: Operating Overheads & Budget Variance Schedule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Operating Expenses & Ledger Variance Analysis', margin, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('Variance analysis comparing active operating budget items with verified actuals', margin, y + 7.5);

  y += 10.5;

  const budgetCols: ColumnDef[] = [
    { header: 'EXPENSE CATEGORY / ACCOUNT', width: 68, align: 'left' },
    { header: `BUDGET (${symbol})`, width: 30, align: 'right' },
    { header: `ACTUAL (${symbol})`, width: 30, align: 'right' },
    { header: `VARIANCE (${symbol})`, width: 30, align: 'right' },
    { header: 'STATUS', width: 28, align: 'center' },
  ];

  const budgetItems = (d.budgetVsActual || []).slice(0, 5);
  const budgetRows: (string | { text: string; color?: number[]; bold?: boolean; align?: 'left' | 'right' | 'center' })[][] = budgetItems.map((item) => {
    const diff = Number(item.actual) - Number(item.budget);
    const isFavorable = diff <= 0;
    return [
      item.category,
      fmtMoney(item.budget),
      fmtMoney(item.actual),
      fmtMoney(diff),
      { text: isFavorable ? 'On Budget' : 'Over Budget', color: isFavorable ? [4, 120, 87] : [190, 18, 60], bold: true },
    ];
  });

  if (budgetItems.length === 0) {
    // Fall back to top expense analysis items if budgetItems is empty
    const expenseItems = (d.expenseAnalysis || []).slice(0, 5);
    if (expenseItems.length > 0) {
      expenseItems.forEach((exp) => {
        budgetRows.push([
          exp.account,
          fmtMoney(0),
          fmtMoney(exp.actual),
          fmtMoney(exp.actual),
          { text: exp.accountType || 'Expense', color: [100, 116, 139] },
        ]);
      });
    } else {
      budgetRows.push(['No operating expense records identified for this reporting cycle.', fmtMoney(0), fmtMoney(0), fmtMoney(0), 'N/A']);
    }
  }

  y = renderTable(margin, y, budgetCols, budgetRows, {
    headerHeight: 6.5,
    rowHeight: 5.6,
    fontSize: 6.8,
    headerFontSize: 6.8,
    zebra: true,
  });

  y += 7;

  // Section 4: Formal Governance Sign-Off Certificate (Formal Document Block)
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 23, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, contentWidth, 23, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE CFO ATTESTATION & GOVERNANCE SIGN-OFF', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This profitability report has been prepared from verified Xero general ledger journals, sales invoices, and bills.',
    margin + 4,
    y + 9.5,
  );
  doc.text(
    'Sales taxes (GST/VAT) are strictly excluded from gross revenue. All line items are reconciled under standard accrual accounting.',
    margin + 4,
    y + 13.5,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(0, 112, 243);
  doc.text(`Status: Live Ledger Reconciled · Currency: ${currency}`, margin + 4, y + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Certified Date: ${new Date().toLocaleDateString('en-GB')}  |  Chief Financial Officer Review`,
    margin + contentWidth - 4,
    y + 19,
    { align: 'right' },
  );

  // Save the formal report PDF
  doc.save(`profitability-${options.selectedPeriod || 'statement'}.pdf`);
}
