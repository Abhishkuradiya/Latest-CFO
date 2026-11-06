"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Download, Copy, Check, ChevronDown, ChevronUp, TrendingUp, TrendingDown, DollarSign, PieChart, Layers, BarChart2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface FinancialLineItem {
  name: string;
  revenue: number;
  type: 'turnover' | 'costOfSales';
  code?: string;
}

interface GrossProfitBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  formatAmount: (val: number) => string;
  salesData?: any;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
  prevGrossProfit?: number;
}

export default function GrossProfitBreakdownPanel({
  isOpen,
  onClose,
  formatAmount,
  salesData = null,
  currentPeriodLabel = "Selected Period",
  previousPeriodLabel = "Previous Period",
  prevGrossProfit
}: GrossProfitBreakdownPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Collapse sections by default as requested by user
  const [isTurnoverOpen, setIsTurnoverOpen] = useState(false);
  const [isCostOfSalesOpen, setIsCostOfSalesOpen] = useState(false);
  
  // Level 2 Drilldown State
  const [selectedStreamForTransactions, setSelectedStreamForTransactions] = useState<{ name: string; revenue: number } | null>(null);

  // ESC Key Listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !selectedStreamForTransactions) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedStreamForTransactions, onClose]);

  // Financial Data strictly derived from PostgreSQL / Xero P&L Report
  const turnoverStreams: FinancialLineItem[] = useMemo(() => {
    const rawTurnover = salesData?.turnoverStreams || salesData?.pnlAccounts?.turnoverStreams;
    if (rawTurnover && Array.isArray(rawTurnover) && rawTurnover.length > 0) {
      return rawTurnover.map((s: any) => ({
        name: s.name || s.account_name || 'Turnover Account',
        revenue: s.revenue || s.amount || 0,
        type: 'turnover' as const,
        code: s.accountId
      }));
    }
    return [];
  }, [salesData]);

  const costOfSalesItems: FinancialLineItem[] = useMemo(() => {
    const rawCogs = salesData?.cogsStreams || salesData?.pnlAccounts?.cogsStreams;
    if (rawCogs && Array.isArray(rawCogs) && rawCogs.length > 0) {
      return rawCogs.map((c: any) => ({
        name: c.name || 'Cost of Goods',
        revenue: c.amount || c.revenue || 0,
        type: 'costOfSales' as const,
        code: c.accountId
      }));
    }
    return [];
  }, [salesData]);

  // Computations
  const totalTurnover = useMemo(() => {
    if (salesData?.salesSnapshot?.totalRevenue?.value !== undefined) {
      return salesData.salesSnapshot.totalRevenue.value;
    }
    return turnoverStreams.reduce((acc, curr) => acc + curr.revenue, 0);
  }, [salesData, turnoverStreams]);

  const totalCostOfSales = useMemo(() => {
    if (salesData?.salesSnapshot?.cogs?.value !== undefined) {
      return salesData.salesSnapshot.cogs.value;
    }
    return costOfSalesItems.reduce((acc, curr) => acc + curr.revenue, 0);
  }, [salesData, costOfSalesItems]);

  const grossProfit = useMemo(() => {
    if (salesData?.salesSnapshot?.grossProfit?.value !== undefined) {
      return salesData.salesSnapshot.grossProfit.value;
    }
    return totalTurnover - totalCostOfSales;
  }, [salesData, totalTurnover, totalCostOfSales]);

  const grossMarginPct = useMemo(() => {
    return totalTurnover > 0 ? (grossProfit / totalTurnover) * 100 : 0;
  }, [grossProfit, totalTurnover]);

  const cosPctOfTurnover = useMemo(() => {
    return totalTurnover > 0 ? (totalCostOfSales / totalTurnover) * 100 : 0;
  }, [totalCostOfSales, totalTurnover]);

  const displayPrevGrossProfit = prevGrossProfit !== undefined && prevGrossProfit !== null
    ? prevGrossProfit
    : (salesData?.salesSnapshot?.grossProfit?.prevValue ?? salesData?.executiveRow4?.grossProfitAnalysis?.prevGrossProfit ?? 0);

  // Derived period labels for clear date range visualization
  const formattedCurrentPeriodLabel = useMemo(() => {
    if (salesData?.meta?.fromDate && salesData?.meta?.toDate) {
      const d1 = new Date(salesData.meta.fromDate);
      const d2 = new Date(salesData.meta.toDate);
      const f1 = d1.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      const f2 = d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      return `${f1} – ${f2}`;
    }
    if (currentPeriodLabel && currentPeriodLabel !== "Selected Period") return currentPeriodLabel;
    return "01 Apr 2026 – 30 Sep 2026";
  }, [currentPeriodLabel, salesData]);

  const formattedPreviousPeriodLabel = useMemo(() => {
    if (salesData?.meta?.prevPeriodLabel) {
      return salesData.meta.prevPeriodLabel.replace(/^vs\s*/i, '');
    }
    if (previousPeriodLabel && previousPeriodLabel !== "Previous Period") return previousPeriodLabel.replace(/^vs\s*/i, '');
    return "01 Oct 2025 – 31 Mar 2026";
  }, [previousPeriodLabel, salesData]);

  // Top 5 Cost Drivers for Visual Analytics Widget
  const topCostDrivers = useMemo(() => {
    const sorted = [...costOfSalesItems]
      .filter(i => i.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    
    return sorted.slice(0, 5).map(item => ({
      ...item,
      pct: totalCostOfSales > 0 ? (item.revenue / totalCostOfSales) * 100 : 0
    }));
  }, [costOfSalesItems, totalCostOfSales]);

  // Filtering
  const filteredTurnover = useMemo(() => {
    if (!searchQuery.trim()) return turnoverStreams;
    const q = searchQuery.toLowerCase().trim();
    return turnoverStreams.filter(item => item.name.toLowerCase().includes(q));
  }, [searchQuery, turnoverStreams]);

  const filteredCostOfSales = useMemo(() => {
    if (!searchQuery.trim()) return costOfSalesItems;
    const q = searchQuery.toLowerCase().trim();
    return costOfSalesItems.filter(item => item.name.toLowerCase().includes(q));
  }, [searchQuery, costOfSalesItems]);

  const toggleExpandAll = () => {
    if (isTurnoverOpen || isCostOfSalesOpen) {
      setIsTurnoverOpen(false);
      setIsCostOfSalesOpen(false);
    } else {
      setIsTurnoverOpen(true);
      setIsCostOfSalesOpen(true);
    }
  };

  const handleCopy = () => {
    try {
      let text = "--- TURNOVER STREAMS ---\n";
      text += turnoverStreams.map(s => `${s.name}\t${s.revenue.toFixed(2)}`).join('\n');
      text += `\nTotal Turnover:\t${totalTurnover.toFixed(2)}\n\n--- COST OF SALES ---\n`;
      text += costOfSalesItems.map(s => `${s.name}\t${s.revenue.toFixed(2)}`).join('\n');
      text += `\nTotal Cost of Sales:\t${totalCostOfSales.toFixed(2)}\n`;
      text += `\nGROSS PROFIT:\t${grossProfit.toFixed(2)} (${grossMarginPct.toFixed(2)}%)`;

      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Gross profit breakdown copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Category,Line Item Name,Amount (£)"];
      const rowsTurnover = turnoverStreams.map(s => `"Turnover","${s.name}",${s.revenue}`);
      const rowsTurnoverTotal = `"Turnover","Total Turnover",${totalTurnover}`;
      const rowsCOS = costOfSalesItems.map(s => `"Cost of Sales","${s.name}",${s.revenue}`);
      const rowsCOSTotal = `"Cost of Sales","Total Cost of Sales",${totalCostOfSales}`;
      const rowsGP = `"Gross Profit","Net Gross Profit",${grossProfit}`;

      const csvContent = "data:text/csv;charset=utf-8," + [
        headers,
        ...rowsTurnover,
        rowsTurnoverTotal,
        ...rowsCOS,
        rowsCOSTotal,
        rowsGP
      ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Gross_Profit_Breakdown_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Exported CSV successfully");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-40 flex justify-end overflow-hidden">
            {/* Semi-transparent Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Ultra Smooth Slide-Over Drawer - Full Screen Width */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-2xl bg-slate-50 dark:bg-slate-950 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-sans"
            >

              {/* Drawer Header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Gross Profit Breakdown
                    </h3>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200/80">
                      {grossMarginPct.toFixed(1)}% Margin
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recognized turnover minus direct Cost of Sales (COGS)
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer outline-none"
                  aria-label="Close drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* KPI Summary Banner */}
              <div className="px-6 py-3 border-b border-slate-200/80 bg-slate-50/60 shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 text-center shadow-3xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Turnover</div>
                    <div className="text-sm font-extrabold text-emerald-700 mt-0.5 font-sans tracking-tight">
                      {formatAmount(totalTurnover)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 text-center shadow-3xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost of Sales</div>
                    <div className="text-sm font-extrabold text-rose-700 mt-0.5 font-sans tracking-tight">
                      {formatAmount(totalCostOfSales)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 text-center shadow-3xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</div>
                    <div className="text-sm font-black text-blue-700 mt-0.5 font-sans tracking-tight">
                      {formatAmount(grossProfit)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Banner */}
              <div className="bg-blue-50/80 border-b border-blue-100/80 px-6 py-2 flex items-center justify-between gap-2 text-xs text-blue-900 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-700">💡 Tip:</span>
                  <span>Click any blue amount in Turnover or Cost of Sales to view detailed Xero Account Transactions.</span>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-200/90 bg-slate-50/50 text-xs text-slate-600 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>CSV Export</span>
                  </button>

                  <button
                    onClick={toggleExpandAll}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{isTurnoverOpen || isCostOfSalesOpen ? 'Collapse All' : 'Expand All'}</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by account name"
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {/* Main Content Area (Scrollable) */}
              <div className="flex-1 overflow-y-auto custom-table-scrollbar p-6 space-y-6">

                {/* ========================================================================= */}
                {/* VISUAL ANALYTICS DASHBOARD (RENDERED IN MIDDLE AREA WHEN SECTIONS ARE COLLAPSED) */}
                {/* ========================================================================= */}
                <div className="space-y-4">
                  {/* GRAPH 0: PERIOD COMPARISON BARS (CURRENT VS PREVIOUS GP) */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4.5 w-4.5 text-blue-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Gross Profit Period Comparison
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Comparing</span>
                          <span className="font-extrabold text-blue-300 bg-blue-950/80 border border-blue-700/80 px-2 py-0.5 rounded text-[10px]">{formattedCurrentPeriodLabel}</span>
                          <span>vs</span>
                          <span className="font-extrabold text-rose-300 bg-rose-950/80 border border-rose-700/80 px-2 py-0.5 rounded text-[10px]">{formattedPreviousPeriodLabel}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/40 text-blue-300 px-3 py-1 rounded-full text-xs font-black">
                        <span>{grossProfit >= displayPrevGrossProfit ? '+' : ''}{formatAmount(grossProfit - displayPrevGrossProfit)} Variance</span>
                      </div>
                    </div>

                    {/* Side-by-Side GP Comparison Bars */}
                    <div className="space-y-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                      {/* Current Period GP */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            <span>Current Gross Profit: <span className="font-bold text-blue-300 bg-blue-950/80 border border-blue-700/80 px-2 py-0.5 rounded text-[10px]">{formattedCurrentPeriodLabel}</span></span>
                          </span>
                          <span className="text-blue-400 font-sans text-sm font-extrabold">{formatAmount(grossProfit)}</span>
                        </div>
                        <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-1000 shadow-sm"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Previous Period GP */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                            <span>Previous Gross Profit: <span className="font-bold text-rose-300 bg-rose-950/80 border border-rose-700/80 px-2 py-0.5 rounded text-[10px]">{formattedPreviousPeriodLabel}</span></span>
                          </span>
                          <span className="text-rose-300 font-sans text-xs font-bold">{formatAmount(displayPrevGrossProfit)}</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, Math.max(10, (displayPrevGrossProfit / (grossProfit || 1)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GRAPH 1: TURNOVER VS COST OF SALES PROPORTIONAL RATIO BAR */}
                  <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Gross Margin Efficiency Breakdown</span>
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-600 font-sans">
                        {grossMarginPct.toFixed(1)}% Retained
                      </span>
                    </div>

                    {/* Proportional Segmented Progress Bar */}
                    <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                      <div
                        style={{ width: `${cosPctOfTurnover}%` }}
                        className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-l-full transition-all duration-700"
                        title={`Cost of Sales: ${cosPctOfTurnover.toFixed(1)}%`}
                      />
                      <div
                        style={{ width: `${grossMarginPct}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-r-full transition-all duration-700"
                        title={`Gross Profit Margin: ${grossMarginPct.toFixed(1)}%`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <span>Cost of Sales: <strong className="text-slate-800 font-sans">{cosPctOfTurnover.toFixed(1)}%</strong> ({formatAmount(totalCostOfSales)})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        <span>Net Gross Profit: <strong className="text-blue-600 font-sans">{grossMarginPct.toFixed(1)}%</strong> ({formatAmount(grossProfit)})</span>
                      </div>
                    </div>
                  </div>

                  {/* GRAPH 2 & 3: WATERFALL REVENUE BRIDGE & TOP COST DRIVERS DISTRIBUTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* WIDGET 1: WATERFALL P&L BRIDGE */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Gross Profit Bridge</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">P&L Waterfall</span>
                      </div>

                      <div className="space-y-3 flex-1 flex flex-col justify-center">
                        {/* Step 1: Turnover */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-semibold text-slate-700">Gross Turnover</span>
                            </div>
                            <span className="font-extrabold text-emerald-700 font-sans">{formatAmount(totalTurnover)}</span>
                          </div>
                          <div className="h-1.5 bg-emerald-100 rounded-full w-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-full rounded-full" />
                          </div>
                        </div>

                        {/* Step 2: Less COGS */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                              <span className="font-semibold text-slate-700">(-) Direct COGS</span>
                            </div>
                            <span className="font-extrabold text-rose-700 font-sans">({formatAmount(totalCostOfSales)})</span>
                          </div>
                          <div className="h-1.5 bg-rose-100 rounded-full w-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${cosPctOfTurnover}%` }} />
                          </div>
                        </div>

                        {/* Step 3: Equals Net GP */}
                        <div className="pt-2.5 border-t border-slate-100 bg-blue-50/60 rounded-xl p-2.5 border border-blue-100/80 flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
                            <span className="text-xs font-black text-blue-900">(=) Net Gross Profit</span>
                          </div>
                          <span className="text-sm font-black text-blue-700 font-sans">{formatAmount(grossProfit)}</span>
                        </div>
                      </div>
                    </div>

                    {/* WIDGET 2: TOP COST OF SALES DRIVERS */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2 gap-2">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider truncate">Top Expense Drivers</span>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/80 whitespace-nowrap shrink-0">COGS Impact</span>
                      </div>

                      <div className="space-y-2 mt-1">
                        {topCostDrivers.map((driver, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-700 truncate max-w-[140px]" title={driver.name}>
                                {driver.name}
                              </span>
                              <span className="font-bold text-slate-800 font-sans">
                                {formatAmount(driver.revenue)} <span className="text-[9.5px] text-slate-400 font-normal">({driver.pct.toFixed(1)}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${driver.pct}%` }}
                                className={`h-full rounded-full ${
                                  idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-purple-500' : idx === 2 ? 'bg-amber-500' : 'bg-cyan-500'
                                }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* STRUCTURED P&L ACCORDION SECTIONS */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-2">
                  {/* SECTION 1: TURNOVER ACCORDION */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <button
                      type="button"
                      onClick={() => setIsTurnoverOpen(!isTurnoverOpen)}
                      className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-100/90 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isTurnoverOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        <span className="uppercase tracking-wider text-[11px] text-emerald-800 font-extrabold">1. TURNOVER (REVENUE STREAMS)</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {filteredTurnover.length} streams
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-700 font-sans text-sm">
                        {formatAmount(totalTurnover)}
                      </span>
                    </button>

                    {isTurnoverOpen && (
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                          {filteredTurnover.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-6 px-6 text-center text-slate-400 italic">
                                No matching turnover streams
                              </td>
                            </tr>
                          ) : (
                            filteredTurnover.map((stream, idx) => (
                              <tr
                                key={idx}
                                className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/50`}
                              >
                                <td className="py-3 px-6 font-semibold text-slate-800 pl-9">
                                  {stream.name}
                                </td>
                                <td className="py-3 px-6 text-right font-extrabold font-sans tracking-tight">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStreamForTransactions({ name: stream.name, revenue: stream.revenue })}
                                    className="text-blue-600 hover:text-blue-800 font-bold no-underline cursor-pointer px-2 py-1 rounded hover:bg-blue-100/70 transition-colors"
                                    title={`Click to view Xero Account Transactions for ${stream.name}`}
                                  >
                                    {formatAmount(stream.revenue)}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* SECTION 2: COST OF SALES ACCORDION */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <button
                      type="button"
                      onClick={() => setIsCostOfSalesOpen(!isCostOfSalesOpen)}
                      className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-100/90 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCostOfSalesOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        <span className="uppercase tracking-wider text-[11px] text-rose-800 font-extrabold">2. COST OF SALES (DIRECT EXPENSES / COGS)</span>
                        <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200">
                          {filteredCostOfSales.length} items
                        </span>
                      </div>
                      <span className="font-extrabold text-rose-700 font-sans text-sm">
                        {formatAmount(totalCostOfSales)}
                      </span>
                    </button>

                    {isCostOfSalesOpen && (
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                          {filteredCostOfSales.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-6 px-6 text-center text-slate-400 italic">
                                No matching Cost of Sales items
                              </td>
                            </tr>
                          ) : (
                            filteredCostOfSales.map((item, idx) => (
                              <tr
                                key={idx}
                                className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-rose-50/40`}
                              >
                                <td className="py-3 px-6 font-semibold text-slate-800 pl-9">
                                  {item.name}
                                </td>
                                <td className="py-3 px-6 text-right font-extrabold font-sans tracking-tight">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStreamForTransactions({ name: item.name, revenue: item.revenue })}
                                    className="text-blue-600 hover:text-blue-800 font-bold no-underline cursor-pointer px-2 py-1 rounded hover:bg-blue-100/70 transition-colors"
                                    title={`Click to view Xero Account Transactions for ${item.name}`}
                                  >
                                    {item.revenue < 0 ? `(${formatAmount(Math.abs(item.revenue))})` : formatAmount(item.revenue)}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>

              {/* Drawer Fixed Footer (Static Summary Bar) */}
              <div className="border-t-2 border-slate-300 bg-slate-900 text-white px-6 py-4 shrink-0 flex items-center justify-between font-bold text-xs select-none">
                <div className="flex flex-col">
                  <span className="uppercase tracking-wider text-[11px] text-blue-400 font-extrabold">
                    NET GROSS PROFIT
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Turnover ({formatAmount(totalTurnover)}) - COGS ({formatAmount(totalCostOfSales)})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-blue-300 bg-blue-950/80 border border-blue-700/80 px-2.5 py-1 rounded-lg">
                    {grossMarginPct.toFixed(2)}% Margin
                  </span>
                  <span className="font-black font-sans text-lg text-white">
                    {formatAmount(grossProfit)}
                  </span>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2nd Level Drilldown: Xero Account Transactions Schedule Drawer */}
      <AccountTransactionsDrawer
        isOpen={!!selectedStreamForTransactions}
        onClose={() => setSelectedStreamForTransactions(null)}
        onBack={() => setSelectedStreamForTransactions(null)}
        streamName={selectedStreamForTransactions?.name || ''}
        totalRevenue={selectedStreamForTransactions?.revenue || 0}
      />
    </>
  );
}
