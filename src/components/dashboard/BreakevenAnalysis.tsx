'use client';

import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakevenProps {
  data: any;
  fmt: (val: number | null | undefined) => string;
}

export function BreakevenAnalysis({ data, fmt }: BreakevenProps) {
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [hoveredRevenue, setHoveredRevenue] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);

  const currencySymbol = data?.currency
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: data.currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value || '$'
    : '$';

  const fmtCompact = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${currencySymbol}${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${currencySymbol}${Math.round(val / 1_000)}K`;
    return `${currencySymbol}${Math.round(val)}`;
  };

  const beRevenue = Number(data?.breakeven?.revenue ?? data?.revenue ?? 0);
  const beTotalCosts = Number(
    data?.breakeven?.totalCosts ?? ((data?.cogs || 0) + (data?.operatingExpenses || 0)),
  );
  const beFixedCosts = Number(data?.breakeven?.fixedCosts ?? (data?.operatingExpenses || 0));
  const beVariableCosts = Number(data?.breakeven?.variableCosts ?? (data?.cogs || 0));
  const beVariableCostRatio = beRevenue > 0 ? beVariableCosts / beRevenue : 0;
  const beBreakEvenSales =
    data?.breakeven?.breakEvenSales != null
      ? Number(data.breakeven.breakEvenSales)
      : beRevenue > beVariableCosts && beRevenue - beVariableCosts > 0
        ? beFixedCosts / ((beRevenue - beVariableCosts) / beRevenue)
        : null;
  const beMarginOfSafety = beBreakEvenSales != null ? beRevenue - beBreakEvenSales : null;
  const beMarginOfSafetyPct =
    beRevenue > 0 && beMarginOfSafety != null ? (beMarginOfSafety / beRevenue) * 100 : null;

  // Active hover simulation vs actual
  const activeRev = hoveredRevenue !== null ? hoveredRevenue : beRevenue;
  const activeCosts =
    hoveredRevenue !== null ? beFixedCosts + beVariableCostRatio * hoveredRevenue : beTotalCosts;
  const activeProfit = activeRev - activeCosts;

  // Chart geometry
  const svgW = 860;
  const svgH = 460;
  const padL = 75;
  const padR = 85;
  const padT = 65;
  const padB = 45;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const rawMax = Math.max(beRevenue, beBreakEvenSales || 0, beTotalCosts, 1000);
  const magnitude = Math.pow(10, Math.max(1, Math.floor(Math.log10(rawMax * 1.35))));
  const niceStep = Math.max(100, Math.ceil((rawMax * 1.35) / (8 * magnitude)) * magnitude);
  const chartMax = niceStep * 8;
  const tickSteps = Array.from({ length: 9 }, (_, i) => i * niceStep);

  const xSvg = (val: number) => padL + (Math.max(0, val) / chartMax) * plotW;
  const ySvg = (val: number) => padT + plotH - (Math.max(0, val) / chartMax) * plotH;
  const lineSteps = Array.from({ length: 11 }, (_, i) => (chartMax / 10) * i);

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratio = (clientX - (padL / svgW) * rect.width) / ((plotW / svgW) * rect.width);
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const revVal = Math.round(clampedRatio * chartMax);
    setHoveredRevenue(revVal);
  };

  return (
    <>
      <section
        aria-labelledby="profitability-breakeven-title"
        className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs"
      >
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Chart Area */}
          <div className="flex-1 w-full min-w-0 relative">
            {/* Interactive Floating Stat Table (Top-Left overlay matching reference image) */}
            <div className="absolute top-3 left-4 z-10 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-center min-w-[80px]">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Revenue
                  </p>
                  <p className="text-xs font-bold text-slate-800 tabular-nums">
                    {fmt(activeRev)}
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-black text-white shadow-xs leading-none">
                    -
                  </span>
                </div>
                <div className="text-center min-w-[80px]">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Costs
                  </p>
                  <p className="text-xs font-bold text-slate-800 tabular-nums">
                    {fmt(activeCosts)}
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 border border-slate-300 text-[11px] font-black text-slate-700 shadow-xs leading-none">
                    =
                  </span>
                </div>
                <div className="text-center min-w-[85px]">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Operating Profit
                  </p>
                  <p
                    className={cn(
                      'text-xs font-bold tabular-nums',
                      activeProfit >= 0 ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {activeProfit < 0 ? `-${fmt(Math.abs(activeProfit))}` : fmt(activeProfit)}
                  </p>
                </div>
              </div>
            </div>

            {/* SVG Breakeven Chart */}
            <div className="w-full overflow-x-auto select-none">
              <svg
                ref={chartRef}
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-auto cursor-crosshair min-w-[650px]"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setHoveredRevenue(null)}
              >
                {/* Background Grid & Axis Ticks */}
                {tickSteps.map((tick) => (
                  <g key={`grid-${tick}`}>
                    {/* Horizontal grid line */}
                    <line
                      x1={padL}
                      y1={ySvg(tick)}
                      x2={padL + plotW}
                      y2={ySvg(tick)}
                      stroke="#f1f5f9"
                      strokeWidth="1.2"
                    />
                    {/* Vertical grid line */}
                    <line
                      x1={xSvg(tick)}
                      y1={padT}
                      x2={xSvg(tick)}
                      y2={padT + plotH}
                      stroke="#f1f5f9"
                      strokeWidth="1.2"
                    />
                    {/* Y-axis label */}
                    <text
                      x={padL - 8}
                      y={ySvg(tick) + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-medium"
                    >
                      {fmtCompact(tick)}
                    </text>
                  </g>
                ))}

                {/* Shaded Loss Area (Triangle where Total Costs > Revenue up to Breakeven point) */}
                {beBreakEvenSales != null && beBreakEvenSales > 0 && beBreakEvenSales <= chartMax && (
                  <polygon
                    points={`${xSvg(0)},${ySvg(beFixedCosts)} ${xSvg(beBreakEvenSales)},${ySvg(beBreakEvenSales)} ${xSvg(0)},${ySvg(0)}`}
                    fill="rgba(244, 63, 94, 0.22)"
                  />
                )}

                {/* Shaded Profit Area (Triangle beyond Breakeven point) */}
                {beBreakEvenSales != null && beBreakEvenSales > 0 && beBreakEvenSales <= chartMax && (
                  <polygon
                    points={`${xSvg(beBreakEvenSales)},${ySvg(beBreakEvenSales)} ${xSvg(chartMax)},${ySvg(chartMax)} ${xSvg(chartMax)},${ySvg(beFixedCosts + beVariableCostRatio * chartMax)}`}
                    fill="rgba(34, 197, 94, 0.08)"
                  />
                )}

                {/* Fixed Costs Line (Dark Charcoal horizontal line) */}
                <line
                  x1={xSvg(0)}
                  y1={ySvg(beFixedCosts)}
                  x2={xSvg(chartMax)}
                  y2={ySvg(beFixedCosts)}
                  stroke="#292524"
                  strokeWidth="2"
                />
                {lineSteps.map((step) => (
                  <circle
                    key={`fc-dot-${step}`}
                    cx={xSvg(step)}
                    cy={ySvg(beFixedCosts)}
                    r="3.5"
                    fill="#292524"
                  />
                ))}

                {/* Total Costs Line (Red line starting at Fixed Costs) */}
                <line
                  x1={xSvg(0)}
                  y1={ySvg(beFixedCosts)}
                  x2={xSvg(chartMax)}
                  y2={ySvg(beFixedCosts + beVariableCostRatio * chartMax)}
                  stroke="#dc2626"
                  strokeWidth="2.5"
                />
                {lineSteps.map((step) => (
                  <circle
                    key={`tc-dot-${step}`}
                    cx={xSvg(step)}
                    cy={ySvg(beFixedCosts + beVariableCostRatio * step)}
                    r="3.5"
                    fill="#dc2626"
                  />
                ))}

                {/* Revenue Line (Green line from 0,0) */}
                <line
                  x1={xSvg(0)}
                  y1={ySvg(0)}
                  x2={xSvg(chartMax)}
                  y2={ySvg(chartMax)}
                  stroke="#84cc16"
                  strokeWidth="2.5"
                />
                {lineSteps.map((step) => (
                  <circle
                    key={`rev-dot-${step}`}
                    cx={xSvg(step)}
                    cy={ySvg(step)}
                    r="3.5"
                    fill="#84cc16"
                  />
                ))}

                {/* Breakeven Point Intersection Indicator */}
                {beBreakEvenSales != null && beBreakEvenSales > 0 && beBreakEvenSales <= chartMax && (
                  <g>
                    <circle
                      cx={xSvg(beBreakEvenSales)}
                      cy={ySvg(beBreakEvenSales)}
                      r="8"
                      fill="#ffffff"
                      stroke="#1e293b"
                      strokeWidth="3"
                    />
                    <circle
                      cx={xSvg(beBreakEvenSales)}
                      cy={ySvg(beBreakEvenSales)}
                      r="3"
                      fill="#1e293b"
                    />
                  </g>
                )}

                {/* Active Hover Crosshair & Indicators */}
                {hoveredRevenue !== null && (
                  <g>
                    {/* Vertical guideline */}
                    <line
                      x1={xSvg(activeRev)}
                      y1={padT}
                      x2={xSvg(activeRev)}
                      y2={padT + plotH}
                      stroke="#0f172a"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    {/* Horizontal guideline */}
                    <line
                      x1={padL}
                      y1={ySvg(activeRev)}
                      x2={padL + plotW}
                      y2={ySvg(activeRev)}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    {/* Point on Revenue line */}
                    <circle
                      cx={xSvg(activeRev)}
                      cy={ySvg(activeRev)}
                      r="6.5"
                      fill="#84cc16"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    {/* Point on Total Costs line */}
                    <circle
                      cx={xSvg(activeRev)}
                      cy={ySvg(activeCosts)}
                      r="6.5"
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                  </g>
                )}

                {/* Pill Badges matching reference screenshot */}
                {/* REVENUE Pill Badge */}
                <g
                  transform={`translate(${Math.min(xSvg(chartMax * 0.95), padL + plotW - 75)}, ${Math.max(ySvg(chartMax * 0.95) - 18, padT + 5)})`}
                >
                  <rect width="68" height="22" rx="11" fill="#8cb861" />
                  <text
                    x="34"
                    y="14"
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[10px] font-bold tracking-wider"
                  >
                    REVENUE
                  </text>
                </g>

                {/* VARIABLE COSTS Pill Badge */}
                <g
                  transform={`translate(${Math.min(xSvg(chartMax * 0.82), padL + plotW - 110)}, ${ySvg(beFixedCosts + beVariableCostRatio * (chartMax * 0.82)) - 14})`}
                >
                  <rect width="102" height="22" rx="11" fill="#dc2626" />
                  <text
                    x="51"
                    y="14"
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[10px] font-bold tracking-wider"
                  >
                    VARIABLE COSTS
                  </text>
                </g>

                {/* FIXED COSTS Pill Badge */}
                <g
                  transform={`translate(${Math.min(xSvg(chartMax * 0.84), padL + plotW - 90)}, ${ySvg(beFixedCosts) + 14})`}
                >
                  <rect width="84" height="22" rx="11" fill="#292524" />
                  <text
                    x="42"
                    y="14"
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[10px] font-bold tracking-wider"
                  >
                    FIXED COSTS
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Right Summary Sidebar matching reference screenshot */}
          <div className="w-full lg:w-72 shrink-0 space-y-4 pt-1">
            <h2 id="profitability-breakeven-title" className="text-xl font-bold tracking-tight text-slate-800">
              Breakeven
            </h2>

            {/* REVENUE */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#84cc16]">
                  <span className="h-1 w-1 rounded-full bg-[#84cc16]" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Revenue
                </span>
              </div>
              <p className="text-[22px] font-bold tabular-nums text-slate-900 tracking-tight leading-tight">
                {fmt(beRevenue)}
              </p>
              <button
                type="button"
                onClick={() => setShowRevenueModal(true)}
                className="text-[11px] font-medium text-emerald-600 underline decoration-dotted underline-offset-2 hover:text-emerald-700 cursor-pointer transition block"
              >
                Top ten Revenue accounts
              </button>
            </div>

            {/* TOTAL COSTS */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-rose-500">
                  <span className="h-1 w-1 rounded-full bg-rose-500" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Costs
                </span>
              </div>
              <p className="text-[22px] font-bold tabular-nums text-slate-900 tracking-tight leading-tight">
                {fmt(beTotalCosts)}
              </p>
              <button
                type="button"
                onClick={() => setShowCostModal(true)}
                className="text-[11px] font-medium text-emerald-600 underline decoration-dotted underline-offset-2 hover:text-emerald-700 cursor-pointer transition block"
              >
                Top ten Expense and COS accounts
              </button>
            </div>

            {/* BREAKEVEN POINT */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-slate-700">
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Breakeven Point
                </span>
              </div>
              <p className="text-[22px] font-bold tabular-nums text-slate-900 tracking-tight leading-tight">
                {beBreakEvenSales != null ? fmt(beBreakEvenSales) : 'N/A'}
              </p>
            </div>

            {/* MARGIN OF SAFETY */}
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Margin of Safety
              </p>
              <p className="text-[22px] font-bold tabular-nums text-slate-900 tracking-tight leading-tight">
                {beMarginOfSafety != null ? fmt(beMarginOfSafety) : 'N/A'}
              </p>
              {beMarginOfSafetyPct != null && (
                <p className="text-[11px] text-slate-400 font-medium">
                  {beMarginOfSafetyPct >= 0 ? '+' : ''}
                  {beMarginOfSafetyPct.toFixed(1)}% of Revenue
                </p>
              )}
            </div>

            {/* VARIABLE COSTS */}
            <div className="space-y-0.5 pt-0.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span className="h-0.5 w-2 bg-rose-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span className="h-0.5 w-2 bg-rose-500" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Variable Costs
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {fmt(beVariableCostRatio)} per {currencySymbol}1 of Revenue
              </p>
            </div>

            {/* FIXED COSTS */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <span className="h-0.5 w-2 bg-slate-700" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                  <span className="h-0.5 w-2 bg-slate-700" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Fixed Costs
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {fmt(beFixedCosts)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modal: Top ten Revenue accounts */}
      {showRevenueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Top Revenue Accounts</h3>
                <p className="text-xs text-slate-500">Ranked by actual turnover recorded in Xero</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRevenueModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2">Account / Customer</th>
                    <th className="pb-2 text-right">Actual</th>
                    <th className="pb-2 text-right">% of Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(data?.breakeven?.topRevenueAccounts || []).map((row: any, idx: number) => {
                    const pct = beRevenue > 0 ? (row.actual / beRevenue) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 font-semibold text-slate-800">{row.account}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-slate-900">
                          {fmt(row.actual)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  {(!data?.breakeven?.topRevenueAccounts ||
                    data.breakeven.topRevenueAccounts.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        No revenue account records available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRevenueModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Top ten Expense and COS accounts */}
      {showCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Top Expense &amp; Cost of Sales Accounts
                </h3>
                <p className="text-xs text-slate-500">
                  Ranked by actual expense and direct costs from Xero
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCostModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2">Account</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Actual</th>
                    <th className="pb-2 text-right">% of Costs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(
                    data?.breakeven?.topCostAccounts ||
                    data?.expenseAnalysis?.slice(0, 10) ||
                    []
                  ).map((row: any, idx: number) => {
                    const pct = beTotalCosts > 0 ? (row.actual / beTotalCosts) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 font-semibold text-slate-800">{row.account}</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">
                          {row.accountType === 'DIRECTCOSTS'
                            ? 'Cost of Sales'
                            : 'Operating Expense'}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-slate-900">
                          {fmt(row.actual)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  {!data?.breakeven?.topCostAccounts && !data?.expenseAnalysis?.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No expense account records available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCostModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

