import type { jsPDF } from 'jspdf';
import { FORECAST_COVER_BASE64 } from './cover-images';

export interface ForecastPdfOptions {
  orgName: string;
  currency: string;
  periodLabel: string;
  periodCode: string;
  fromDate: string;
  toDate: string;
  scenario: 'average' | 'best' | 'worst';
  scenarioLabel: string;
  currentRevMultiplier: number;
  currentCostMultiplier: number;
  scenarioMatrix: Array<{
    key: string;
    label: string;
    description?: string;
    desc?: string;
    projRev: number;
    projCost?: number;
    projCosts?: number;
    projProfit: number;
    marginPct: number;
    deltaProfit?: number;
    delta?: number;
  }>;
  multiMetricComparison: {
    worst: { revenue: number; grossProfit: number; ebitda: number; netProfit: number; closingCash: number; workingCapital: number };
    base: { revenue: number; grossProfit: number; ebitda: number; netProfit: number; closingCash: number; workingCapital: number };
    best: { revenue: number; grossProfit: number; ebitda: number; netProfit: number; closingCash: number; workingCapital: number };
  };
  sensitivityControls: {
    revGrowthPct: number;
    costInflationPct: number;
    collectionDays: number;
    wageInflationPct: number;
  };
  kpiCards: Array<{
    title: string;
    value: string;
    badge?: string;
    badgeType?: 'favorable' | 'unfavorable' | 'neutral';
    detail: string;
  }>;
  monthlyFinancialSchedule: Array<{
    month: string;
    actual: number;
    forecast: number;
    budget: number;
    variance: number;
  }>;
  scheduleTotals: {
    actual: number;
    forecast: number;
    budget: number;
    variance: number;
  };
  lineItemProjections: Array<{
    category: string;
    actual: number;
    projectedAnnual: number;
    delta: number;
    type?: string;
  }>;
}

export async function exportForecastPdf(options: ForecastPdfOptions): Promise<void> {
  const { default: JsPdf } = await import('jspdf');
  const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 11.35; // 10px less left and right (14mm - 2.65mm)
  const contentWidth = pageWidth - margin * 2; // 187.3mm
  const totalPages = 3;

  const symbol = options.currency === 'GBP' ? '£' : options.currency === 'EUR' ? '€' : '$';

  const fmtMoney = (val: number): string => {
    const isNeg = val < 0;
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNeg ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  };

  const fmtMoneyWithSign = (val: number): string => {
    const formatted = Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val > 0) return `+${symbol}${formatted}`;
    if (val < 0) return `-${symbol}${formatted}`;
    return `${symbol}${formatted}`;
  };

  const drawPageFooter = (pageNum: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Virtual CFO Predictive Engine · ${options.orgName || 'Financial Reporting'} · Baseline: ${options.periodLabel} · Currency: ${options.currency}`,
      margin,
      pageHeight - 6,
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  // =========================================================================
  // PAGE 1: COVER PAGE (User-Provided High-Res Cover Artwork)
  // =========================================================================
  try {
    doc.addImage(FORECAST_COVER_BASE64, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  } catch (err) {
    console.error('Failed to render forecast cover image:', err);
  }

  // Cover Executive Metadata Card at bottom
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, pageHeight - 24, contentWidth, 14, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, pageHeight - 24, contentWidth, 14, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(options.orgName || 'Virtual CFO Client', margin + 4, pageHeight - 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Active Scenario: ${options.scenarioLabel}  |  Baseline: ${options.periodLabel}`, margin + 4, pageHeight - 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199);
  doc.text(`Reporting Window: ${options.fromDate} to ${options.toDate}`, margin + contentWidth - 4, pageHeight - 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Currency: ${options.currency} (${symbol})  |  Generated: ${new Date().toLocaleDateString('en-GB')}`, margin + contentWidth - 4, pageHeight - 11, { align: 'right' });

  // =========================================================================
  // PAGE 2: HEADER, CONTROLS, 3 SCENARIO CARDS & MULTI-METRIC COMPARISON
  // =========================================================================
  doc.addPage();

  // 1. Executive Top Header (Matching UI) - Top margin around 100px less
  let y = 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Navy 900
  doc.text('Financial Forecast & Scenario Cockpit', margin, y + 4);

  // Status Badge: Xero connected
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.roundedRect(margin + 104, y - 0.5, 27, 5.5, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 104, y - 0.5, 27, 5.5, 2, 2, 'S');

  doc.setFillColor(16, 185, 129); // Green dot
  doc.circle(margin + 107.5, y + 2.2, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(4, 120, 87);
  doc.text('Xero connected', margin + 110, y + 3.2);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Forward 12-month predictive modeling, cash trajectory simulation, and sensitivity stress testing.',
    margin,
    y + 10,
  );

  y += 14;

  // 2. Control Bar (Matching UI)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, 13, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentWidth, 13, 2, 2, 'S');

  // Baseline Period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Baseline Period:', margin + 4, y + 5);

  doc.setFillColor(15, 23, 42); // Active black pill
  doc.roundedRect(margin + 26, y + 2, 24, 4.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(options.periodLabel, margin + 28, y + 5.2);

  // Scenario
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Scenario:', margin + 55, y + 5);

  const activeScBg = options.scenario === 'best' ? [5, 150, 105] : options.scenario === 'worst' ? [225, 29, 72] : [15, 23, 42];
  doc.setFillColor(activeScBg[0], activeScBg[1], activeScBg[2]);
  doc.roundedRect(margin + 68, y + 2, 25, 4.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(options.scenario === 'best' ? 'Best Case' : options.scenario === 'worst' ? 'Worst Case' : 'Average Case', margin + 70, y + 5.2);

  // Multipliers
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Target Multipliers: Rev ${options.currentRevMultiplier.toFixed(2)}x · Cost ${options.currentCostMultiplier.toFixed(2)}x`,
    margin + 98,
    y + 5,
  );

  // Reporting Dates
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Dates: ${options.fromDate} to ${options.toDate}  |  Org: ${options.orgName || 'Virtual CFO'} (${options.currency})`,
    margin + 4,
    y + 10.5,
  );

  y += 16;

  // 3. Scenario Sensitivity Modeling (3 Cards from the User's Screen)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Scenario sensitivity modeling', margin, y);

  doc.setFillColor(240, 249, 255); // Sky 50
  doc.roundedRect(margin + 48, y - 3, 26, 4.5, 1.5, 1.5, 'F');
  doc.setDrawColor(186, 230, 253); // Sky 200
  doc.roundedRect(margin + 48, y - 3, 26, 4.5, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(2, 132, 199);
  doc.text(`Active: ${options.scenarioLabel}`, margin + 50, y + 0.3);

  y += 4;

  const cardGap = 3;
  const cardW = (contentWidth - cardGap * 2) / 3; // ~58.6mm
  const cardH = 37;

  options.scenarioMatrix.forEach((sc, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    const isCurrent = options.scenario === sc.key;

    // Card background & border
    if (isCurrent) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
      doc.setDrawColor(2, 132, 199); // Sky blue border
      doc.setLineWidth(0.45);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'S');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'S');
    }

    // Card Header & Pill
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const titleColor = sc.key === 'worst' ? [225, 29, 72] : sc.key === 'best' ? [5, 150, 105] : [15, 23, 42];
    doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
    doc.text(sc.label, cx + 3.5, y + 5);

    // Pill on right
    doc.setFillColor(isCurrent ? 224 : 241, isCurrent ? 242 : 245, isCurrent ? 254 : 249);
    doc.roundedRect(cx + cardW - 14, y + 2, 11, 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(isCurrent ? 3 : 100, isCurrent ? 105 : 116, isCurrent ? 161 : 139);
    doc.text(isCurrent ? 'Active' : 'Select', cx + cardW - 12.5, y + 4.8);

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    const descText = sc.description || sc.desc || '';
    const descLines = doc.splitTextToSize(descText, cardW - 7);
    doc.text(descLines, cx + 3.5, y + 9);

    // Row 1: Projected Rev | Operating Costs
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text('Projected Rev (12M):', cx + 3.5, y + 21);
    doc.text('Operating Costs:', cx + cardW / 2 + 1, y + 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fmtMoney(sc.projRev), cx + 3.5, y + 25);
    const costVal = sc.projCost ?? sc.projCosts ?? 0;
    doc.text(fmtMoney(costVal), cx + cardW / 2 + 1, y + 25);

    // Row 2: Projected Profit | Margin & Delta
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text('Projected Profit:', cx + 3.5, y + 30);
    doc.text('Margin & Delta:', cx + cardW / 2 + 1, y + 30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const profitColor = sc.projProfit >= 0 ? [5, 150, 105] : [225, 29, 72];
    doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
    doc.text(fmtMoney(sc.projProfit), cx + 3.5, y + 34);

    const deltaVal = sc.deltaProfit ?? sc.delta ?? 0;
    const deltaSign = deltaVal >= 0 ? '+' : '';
    doc.text(`${sc.marginPct.toFixed(1)}% (${deltaSign}${fmtMoney(deltaVal)})`, cx + cardW / 2 + 1, y + 34);
  });

  y += cardH + 5;

  // 4. Custom Sensitivity Assumptions Strip (Image 2 UI)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('Selected sensitivity assumptions:', margin + 4, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199);
  doc.text(
    `Revenue: ${options.sensitivityControls.revGrowthPct >= 0 ? '+' : ''}${options.sensitivityControls.revGrowthPct}%  ·  Costs: +${options.sensitivityControls.costInflationPct}%  ·  Collection: ${options.sensitivityControls.collectionDays} days  ·  Wages: +${options.sensitivityControls.wageInflationPct}%`,
    margin + 44,
    y + 4.5,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Dynamic forward simulation matrix strictly driven by active Xero historical actuals for ${options.periodLabel}.`,
    margin + 4,
    y + 9,
  );

  y += 16;

  // 5. Multi-Metric Scenario Comparison Table (Image 3 & 7 UI)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Multi-Metric Scenario Comparison', margin, y + 4);

  // Live Xero Baseline badge on right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Live Xero Baseline:', margin + contentWidth - 48, y + 4);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + contentWidth - 27, y, 27, 5, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + contentWidth - 27, y, 27, 5, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${options.periodLabel} (Actual)`, margin + contentWidth - 25, y + 3.5);

  y += 7;

  // Table header
  const thY = y;
  doc.setFillColor(15, 23, 42); // Navy 900
  doc.rect(margin, thY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Financial metric', margin + 3.5, thY + 4.8);
  doc.text('Worst (-15% / +10%)', margin + 78, thY + 4.8, { align: 'right' });
  doc.text('Base (Active)', margin + 128, thY + 4.8, { align: 'right' });
  doc.text('Best (+15% / -5%)', margin + contentWidth - 3.5, thY + 4.8, { align: 'right' });

  y += 7;

  const mmRows = [
    { label: 'Revenue', sub: 'Total operational sales & service income', worst: options.multiMetricComparison.worst.revenue, base: options.multiMetricComparison.base.revenue, best: options.multiMetricComparison.best.revenue },
    { label: 'Gross Profit', sub: 'Revenue less cost of goods & direct supplies', worst: options.multiMetricComparison.worst.grossProfit, base: options.multiMetricComparison.base.grossProfit, best: options.multiMetricComparison.best.grossProfit },
    { label: 'EBITDA', sub: 'Operating earnings before interest, tax & D&A', worst: options.multiMetricComparison.worst.ebitda, base: options.multiMetricComparison.base.ebitda, best: options.multiMetricComparison.best.ebitda },
    { label: 'Net Profit', sub: 'Comprehensive bottom-line profit / loss', worst: options.multiMetricComparison.worst.netProfit, base: options.multiMetricComparison.base.netProfit, best: options.multiMetricComparison.best.netProfit },
    { label: 'Closing Cash', sub: 'Projected simulated bank liquidity balance', worst: options.multiMetricComparison.worst.closingCash, base: options.multiMetricComparison.base.closingCash, best: options.multiMetricComparison.best.closingCash },
    { label: 'Working Capital', sub: 'Projected net operating liquidity (Current Assets − Liabilities)', worst: options.multiMetricComparison.worst.workingCapital, base: options.multiMetricComparison.base.workingCapital, best: options.multiMetricComparison.best.workingCapital },
  ];

  mmRows.forEach((r, idx) => {
    const rY = y;
    const rH = 10;

    // Zebra
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rY, contentWidth, rH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, rY + rH, margin + contentWidth, rY + rH);

    // Label & subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(r.label, margin + 3.5, rY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(r.sub, margin + 3.5, rY + 8);

    // Worst
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(r.worst < 0 ? 225 : 51, r.worst < 0 ? 29 : 65, r.worst < 0 ? 72 : 85);
    doc.text(fmtMoney(r.worst), margin + 78, rY + 6, { align: 'right' });

    // Base (Active highlighted)
    doc.setFillColor(240, 249, 255);
    doc.rect(margin + 88, rY + 1, 44, rH - 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(fmtMoney(r.base), margin + 128, rY + 6, { align: 'right' });

    // Best
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text(fmtMoney(r.best), margin + contentWidth - 3.5, rY + 6, { align: 'right' });

    y += rH;
  });

  drawPageFooter(2);

  // =========================================================================
  // PAGE 3: 6 KPI CARDS, 12-MONTH FINANCIAL SCHEDULE & LINE ITEMS
  // =========================================================================
  doc.addPage();
  y = margin;

  // Page 2 Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Forecast Outputs & Projected Liquidity Runway', margin, y + 4);

  y += 7;

  // 6 KPI Metric Cards in 2x3 or 1x6
  const kpiCols = 3;
  const kpiW = (contentWidth - (kpiCols - 1) * 3) / kpiCols;
  const kpiH = 17;

  options.kpiCards.forEach((kpi, idx) => {
    const colIdx = idx % kpiCols;
    const rowIdx = Math.floor(idx / kpiCols);
    const kx = margin + colIdx * (kpiW + 3);
    const ky = y + rowIdx * (kpiH + 3);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(kx, ky, kpiW, kpiH, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(kx, ky, kpiW, kpiH, 1.5, 1.5, 'S');

    // Accent line on left
    const accentColor = kpi.badgeType === 'favorable' ? [16, 185, 129] : kpi.badgeType === 'unfavorable' ? [225, 29, 72] : [2, 132, 199];
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(kx, ky, 1.5, kpiH, 'F');

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, kx + 3.5, ky + 4.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, kx + 3.5, ky + 10.5);

    // Detail / Baseline
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.detail, kx + 3.5, ky + 14.5);
  });

  y += 2 * (kpiH + 3) + 4;

  // Monthly Financial Table (Image 8 UI: Month | Actual | Forecast | Budget | Variance)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Monthly Financial Table (Actual, Forecast, Budget and Variance)', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('12-month financial schedule with live Xero actuals, predictive forecast, budget plan, and monthly variance.', margin, y + 8.5);

  y += 11;

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentWidth, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('Month', margin + 3.5, y + 4.5);
  doc.text('Actual', margin + 65, y + 4.5, { align: 'right' });
  doc.text('Forecast', margin + 105, y + 4.5, { align: 'right' });
  doc.text('Budget', margin + 145, y + 4.5, { align: 'right' });
  doc.text('Variance', margin + contentWidth - 3.5, y + 4.5, { align: 'right' });

  y += 6.5;

  // 12 Months Rows
  options.monthlyFinancialSchedule.forEach((m, idx) => {
    const rowH = 6;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowH, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(m.month, margin + 3.5, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(fmtMoney(m.actual), margin + 65, y + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(fmtMoney(m.forecast), margin + 105, y + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(fmtMoney(m.budget), margin + 145, y + 4.2, { align: 'right' });

    // Variance in pill
    const isVarPos = m.variance >= 0;
    doc.setFillColor(isVarPos ? 236 : 254, isVarPos ? 253 : 242, isVarPos ? 245 : 242);
    doc.roundedRect(margin + contentWidth - 28, y + 1, 26, 4.2, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(isVarPos ? 4 : 190, isVarPos ? 120 : 18, isVarPos ? 87 : 60);
    doc.text(fmtMoneyWithSign(m.variance), margin + contentWidth - 15, y + 3.9, { align: 'center' });

    y += rowH;
  });

  // Schedule Totals Row (Full Year FY 2026)
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  doc.line(margin, y + 7, margin + contentWidth, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Full Year (FY 2026)', margin + 3.5, y + 4.8);
  doc.text(fmtMoney(options.scheduleTotals.actual), margin + 65, y + 4.8, { align: 'right' });
  doc.setTextColor(2, 132, 199);
  doc.text(fmtMoney(options.scheduleTotals.forecast), margin + 105, y + 4.8, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(fmtMoney(options.scheduleTotals.budget), margin + 145, y + 4.8, { align: 'right' });

  const totVarPos = options.scheduleTotals.variance >= 0;
  doc.setTextColor(totVarPos ? 4 : 190, totVarPos ? 120 : 18, totVarPos ? 87 : 60);
  doc.text(fmtMoneyWithSign(options.scheduleTotals.variance), margin + contentWidth - 3.5, y + 4.8, { align: 'right' });

  y += 11;

  // Line-Item Projection Schedule Summary
  if (options.lineItemProjections.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Line-Item Nominal Projections (Top Operational Drivers)', margin, y + 3);

    y += 5;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, 5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nominal Category', margin + 3, y + 3.5);
    doc.text('Historical Baseline', margin + 85, y + 3.5, { align: 'right' });
    doc.text('Projected Annual', margin + 135, y + 3.5, { align: 'right' });
    doc.text('Forward Delta', margin + contentWidth - 3.5, y + 3.5, { align: 'right' });

    y += 5;

    const topItems = options.lineItemProjections.slice(0, 6);
    topItems.forEach((item, idx) => {
      const rowH = 4.8;
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.category, margin + 3, y + 3.5);
      doc.text(fmtMoney(item.actual), margin + 85, y + 3.5, { align: 'right' });
      doc.text(fmtMoney(item.projectedAnnual), margin + 135, y + 3.5, { align: 'right' });

      const dPos = item.delta >= 0;
      doc.setTextColor(dPos ? 4 : 190, dPos ? 120 : 18, dPos ? 87 : 60);
      doc.text(fmtMoneyWithSign(item.delta), margin + contentWidth - 3.5, y + 3.5, { align: 'right' });

      y += rowH;
    });
  }

  drawPageFooter(3);

  // Save the PDF
  const downloadFileName = `Virtual_CFO_Forecast_${options.periodCode || 'TTM'}_${options.fromDate}_to_${options.toDate}.pdf`;
  doc.save(downloadFileName);
}
