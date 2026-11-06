"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Layers,
  BarChart2,
  ShieldCheck,
  ArrowRight,
  Receipt,
  PlusCircle,
  MinusCircle,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';

import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface PnlLineItem {
  name: string;
  amount: number;
  type: 'turnover' | 'cogs' | 'expense' | 'otherIncome';
  accountId?: string;
}

interface NetProfitBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  salesData?: any;
  formatAmount: (val: number) => string;
  prevNetProfit?: number;
}

export default function NetProfitBreakdownPanel({
  isOpen,
  onClose,
  salesData = null,
  formatAmount,
  prevNetProfit
}: NetProfitBreakdownPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Accordion Section States
  const [isTurnoverOpen, setIsTurnoverOpen] = useState(false);
  const [isCogsOpen, setIsCogsOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(true);
  const [isOtherIncomeOpen, setIsOtherIncomeOpen] = useState(false);

  // Level 2 Drilldown State
  const [selectedItemForTransactions, setSelectedItemForTransactions] = useState<{ name: string; amount: number } | null>(null);

  // ESC Key Listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !selectedItemForTransactions) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedItemForTransactions, onClose]);

  // Derive P&L Data strictly from PostgreSQL / salesData
  const turnoverStreams: PnlLineItem[] = useMemo(() => {
    const raw = salesData?.turnoverStreams || salesData?.pnlAccounts?.turnoverStreams;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((s: any) => ({
        name: s.name || s.account_name || 'Revenue Stream',
        amount: s.revenue || s.amount || 0,
        type: 'turnover' as const,
        accountId: s.accountId
      }));
    }
    return [];
  }, [salesData]);

  const cogsItems: PnlLineItem[] = useMemo(() => {
    const raw = salesData?.cogsStreams || salesData?.pnlAccounts?.cogsStreams;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((c: any) => ({
        name: c.name || 'Direct Cost',
        amount: c.amount || c.revenue || 0,
        type: 'cogs' as const,
        accountId: c.accountId
      }));
    }
    return [];
  }, [salesData]);

  const expenseItems: PnlLineItem[] = useMemo(() => {
    const raw = salesData?.expenseStreams || salesData?.pnlAccounts?.expenseStreams;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((e: any) => ({
        name: e.name || 'Operating Expense',
        amount: e.amount || e.revenue || 0,
        type: 'expense' as const,
        accountId: e.accountId
      }));
    }
    return [];
  }, [salesData]);

  const otherIncomeItems: PnlLineItem[] = useMemo(() => {
    const raw = salesData?.otherIncomeStreams || salesData?.pnlAccounts?.otherIncomeStreams;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map((o: any) => ({
        name: o.name || 'Other Income Stream',
        amount: o.amount || o.revenue || 0,
        type: 'otherIncome' as const,
        accountId: o.accountId
      }));
    }
    return [];
  }, [salesData]);

  // High-level Financial Summary Numbers
  const totalTurnover = useMemo(() => {
    if (salesData?.salesSnapshot?.totalRevenue?.value !== undefined) {
      return salesData.salesSnapshot.totalRevenue.value;
    }
    return turnoverStreams.reduce((acc, curr) => acc + curr.amount, 0);
  }, [salesData, turnoverStreams]);

  const totalCogs = useMemo(() => {
    if (salesData?.salesSnapshot?.cogs?.value !== undefined) {
      return salesData.salesSnapshot.cogs.value;
    }
    return cogsItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [salesData, cogsItems]);

  const grossProfit = useMemo(() => {
    if (salesData?.salesSnapshot?.grossProfit?.value !== undefined) {
      return salesData.salesSnapshot.grossProfit.value;
    }
    return totalTurnover - totalCogs;
  }, [salesData, totalTurnover, totalCogs]);

  const totalExpenses = useMemo(() => {
    if (salesData?.salesSnapshot?.expenses?.value !== undefined) {
      return salesData.salesSnapshot.expenses.value;
    }
    return expenseItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [salesData, expenseItems]);

  const totalOtherIncome = useMemo(() => {
    if (salesData?.salesSnapshot?.otherIncome?.value !== undefined) {
      return salesData.salesSnapshot.otherIncome.value;
    }
    return otherIncomeItems.reduce((acc, curr) => acc + curr.amount, 0);
  }, [salesData, otherIncomeItems]);

  const netProfit = useMemo(() => {
    if (salesData?.salesSnapshot?.netProfit?.value !== undefined) {
      return salesData.salesSnapshot.netProfit.value;
    }
    return (grossProfit + totalOtherIncome) - totalExpenses;
  }, [salesData, grossProfit, totalOtherIncome, totalExpenses]);

  const netProfitMarginPct = useMemo(() => {
    return totalTurnover > 0 ? (netProfit / totalTurnover) * 100 : 0;
  }, [netProfit, totalTurnover]);

  const grossMarginPct = useMemo(() => {
    return totalTurnover > 0 ? (grossProfit / totalTurnover) * 100 : 0;
  }, [grossProfit, totalTurnover]);

  const opexRatioPct = useMemo(() => {
    return totalTurnover > 0 ? (totalExpenses / totalTurnover) * 100 : 0;
  }, [totalExpenses, totalTurnover]);

  const displayPrevNetProfit = prevNetProfit !== undefined && prevNetProfit !== null
    ? prevNetProfit
    : (salesData?.salesSnapshot?.netProfit?.prevValue ?? salesData?.executiveRow4?.grossProfitAnalysis?.prevGrossProfit ?? 0);

  // Derived period labels for clear date range visualization
  const formattedCurrentPeriodLabel = useMemo(() => {
    if (salesData?.meta?.fromDate && salesData?.meta?.toDate) {
      const d1 = new Date(salesData.meta.fromDate);
      const d2 = new Date(salesData.meta.toDate);
      const f1 = d1.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      const f2 = d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      return `${f1} – ${f2}`;
    }
    return "01 Apr 2026 – 30 Sep 2026";
  }, [salesData]);

  const formattedPreviousPeriodLabel = useMemo(() => {
    if (salesData?.meta?.prevPeriodLabel) {
      return salesData.meta.prevPeriodLabel.replace(/^vs\s*/i, '');
    }
    return "01 Oct 2025 – 31 Mar 2026";
  }, [salesData]);

  // Filtered Expense Items
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenseItems;
    const q = searchQuery.toLowerCase().trim();
    return expenseItems.filter(item => item.name.toLowerCase().includes(q));
  }, [searchQuery, expenseItems]);

  const filteredTurnover = useMemo(() => {
    if (!searchQuery.trim()) return turnoverStreams;
    const q = searchQuery.toLowerCase().trim();
    return turnoverStreams.filter(item => item.name.toLowerCase().includes(q));
  }, [searchQuery, turnoverStreams]);

  const filteredCogs = useMemo(() => {
    if (!searchQuery.trim()) return cogsItems;
    const q = searchQuery.toLowerCase().trim();
    return cogsItems.filter(item => item.name.toLowerCase().includes(q));
  }, [searchQuery, cogsItems]);

  // Top Expense Drivers impacting Bottom Line
  const topExpenseDrivers = useMemo(() => {
    const sorted = [...expenseItems]
      .filter(i => i.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return sorted.slice(0, 5).map(item => ({
      ...item,
      pct: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0
    }));
  }, [expenseItems, totalExpenses]);

  const toggleExpandAll = () => {
    if (isTurnoverOpen || isCogsOpen || isExpensesOpen || isOtherIncomeOpen) {
      setIsTurnoverOpen(false);
      setIsCogsOpen(false);
      setIsExpensesOpen(false);
      setIsOtherIncomeOpen(false);
    } else {
      setIsTurnoverOpen(true);
      setIsCogsOpen(true);
      setIsExpensesOpen(true);
      setIsOtherIncomeOpen(true);
    }
  };

  const handleCopy = () => {
    try {
      let text = "=== NET PROFIT (BOTTOM LINE) BREAKDOWN ===\n";
      text += `Total Turnover:\t${totalTurnover.toFixed(2)}\n`;
      text += `(-) Cost of Goods Sold:\t${totalCogs.toFixed(2)}\n`;
      text += `(=) Gross Profit:\t${grossProfit.toFixed(2)} (${grossMarginPct.toFixed(2)}%)\n`;
      text += `(-) Operating Expenses:\t${totalExpenses.toFixed(2)}\n`;
      if (totalOtherIncome > 0) text += `(+) Other Income:\t${totalOtherIncome.toFixed(2)}\n`;
      text += `\n(=) NET PROFIT (BOTTOM LINE):\t${netProfit.toFixed(2)} (${netProfitMarginPct.toFixed(2)}% Net Margin)\n`;

      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Net Profit breakdown copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Category,Line Item Name,Amount (£),Impact Type"];
      const rowsTurnover = turnoverStreams.map(s => `"Turnover","${s.name}",${s.amount},"Revenue (+)"`);
      const rowsCogs = cogsItems.map(c => `"Cost of Sales","${c.name}",${c.amount},"Direct COGS (-)"`);
      const rowsExpenses = expenseItems.map(e => `"Operating Expense","${e.name}",${e.amount},"Overhead (-)"`);
      const rowsOther = otherIncomeItems.map(o => `"Other Income","${o.name}",${o.amount},"Income (+)"`);
      const summaryRows = [
        `"Summary","Total Turnover",${totalTurnover},"Revenue"`,
        `"Summary","Gross Profit",${grossProfit},"Gross Profit"`,
        `"Summary","Total Operating Expenses",${totalExpenses},"Expenses"`,
        `"Summary","Net Profit (Bottom Line)",${netProfit},"Net Profit"`
      ];

      const csvContent = "data:text/csv;charset=utf-8," + [
        headers,
        ...rowsTurnover,
        ...rowsCogs,
        ...rowsExpenses,
        ...rowsOther,
        ...summaryRows
      ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Net_Profit_Bottom_Line_${new Date().toISOString().slice(0, 10)}.csv`);
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Slide-Over Drawer */}
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
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Net Profit (Bottom Line) Breakdown
                    </h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      netProfit >= 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}>
                      {netProfitMarginPct.toFixed(1)}% Net Margin
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Final Profit & Loss bottom line: Gross Profit minus Operating Expenses plus Other Income
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
                <div className="grid grid-cols-4 gap-2.5">
                  <div className="bg-white border border-slate-200/90 rounded-xl p-2 text-center shadow-3xs">
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Turnover</div>
                    <div className="text-xs font-extrabold text-slate-800 mt-0.5 font-sans tracking-tight">
                      {formatAmount(totalTurnover)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2 text-center shadow-3xs">
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</div>
                    <div className="text-xs font-extrabold text-blue-700 mt-0.5 font-sans tracking-tight">
                      {formatAmount(grossProfit)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2 text-center shadow-3xs">
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Operating Expenses</div>
                    <div className="text-xs font-extrabold text-purple-700 mt-0.5 font-sans tracking-tight">
                      {formatAmount(totalExpenses)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2 text-center shadow-3xs">
                    <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</div>
                    <div className={`text-xs font-black mt-0.5 font-sans tracking-tight ${
                      netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {netProfit < 0 ? `(${formatAmount(Math.abs(netProfit))})` : formatAmount(netProfit)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Banner */}
              <div className="bg-emerald-50/80 border-b border-emerald-100/80 px-6 py-2 flex items-center justify-between gap-2 text-xs text-emerald-900 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-700">💡 Tip:</span>
                  <span>Click any blue amount in Operating Expenses or Turnover to view detailed Xero Account Transactions.</span>
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
                    <span>{isTurnoverOpen || isCogsOpen || isExpensesOpen ? 'Collapse All' : 'Expand All'}</span>
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
                {/* VISUAL ANALYTICS DASHBOARD */}
                {/* ========================================================================= */}
                <div className="space-y-4">
                  {/* GRAPH 0: NET PROFIT COMPARISON CARD */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Net Profit Bottom Line Comparison
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Comparing</span>
                          <span className="font-extrabold text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2 py-0.5 rounded text-[10px]">{formattedCurrentPeriodLabel}</span>
                          <span>vs</span>
                          <span className="font-extrabold text-blue-300 bg-blue-950/80 border border-blue-700/80 px-2 py-0.5 rounded text-[10px]">{formattedPreviousPeriodLabel}</span>
                        </p>
                      </div>

                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                        netProfit >= displayPrevNetProfit
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                          : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                      }`}>
                        <span>{netProfit >= displayPrevNetProfit ? '+' : ''}{formatAmount(netProfit - displayPrevNetProfit)} Variance</span>
                      </div>
                    </div>

                    {/* Bars */}
                    <div className="space-y-3 bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                      {/* Current Period */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <span>Current Net Profit: <span className="font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-2 py-0.5 rounded text-[10px]">{formattedCurrentPeriodLabel}</span></span>
                          </span>
                          <span className={`font-sans text-sm font-extrabold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {netProfit < 0 ? `(${formatAmount(Math.abs(netProfit))})` : formatAmount(netProfit)}
                          </span>
                        </div>
                        <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 shadow-sm ${
                              netProfit >= 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-rose-500'
                            }`}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Previous Period */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            <span>Previous Net Profit: <span className="font-bold text-blue-300 bg-blue-950/80 border border-blue-700/80 px-2 py-0.5 rounded text-[10px]">{formattedPreviousPeriodLabel}</span></span>
                          </span>
                          <span className="text-blue-300 font-sans text-xs font-bold">{formatAmount(displayPrevNetProfit)}</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, Math.max(10, (displayPrevNetProfit / (Math.abs(netProfit) || 1)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GRAPH 1: FULL P&L WATERFALL & TOP OPERATING EXPENSE DRIVERS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* WIDGET 1: FULL P&L STEP-BY-STEP WATERFALL BRIDGE */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">P&L Bottom Line Bridge</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Full Reconciliation</span>
                      </div>

                      <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                        {/* Step 1: Turnover */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">1. Gross Turnover</span>
                          <span className="font-extrabold text-emerald-700 font-sans">{formatAmount(totalTurnover)}</span>
                        </div>

                        {/* Step 2: Direct COGS */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">2. (-) Direct COGS</span>
                          <span className="font-extrabold text-rose-600 font-sans">({formatAmount(totalCogs)})</span>
                        </div>

                        {/* Step 3: Equals Gross Profit */}
                        <div className="flex items-center justify-between text-xs bg-blue-50/70 p-1.5 rounded-md">
                          <span className="font-bold text-blue-900">3. (=) Gross Profit</span>
                          <span className="font-extrabold text-blue-700 font-sans">{formatAmount(grossProfit)}</span>
                        </div>

                        {/* Step 4: Operating Expenses */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">4. (-) Operating Expenses</span>
                          <span className="font-extrabold text-purple-700 font-sans">({formatAmount(totalExpenses)})</span>
                        </div>

                        {/* Step 5: Other Income */}
                        {totalOtherIncome > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-600">5. (+) Other Income</span>
                            <span className="font-extrabold text-emerald-600 font-sans">+{formatAmount(totalOtherIncome)}</span>
                          </div>
                        )}

                        {/* Step 6: Equals Net Profit */}
                        <div className={`pt-2.5 border-t border-slate-100 rounded-xl p-2.5 border flex items-center justify-between mt-1 ${
                          netProfit >= 0
                            ? 'bg-emerald-50/80 border-emerald-200/80'
                            : 'bg-rose-50/80 border-rose-200/80'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                            <span className={`text-xs font-black ${netProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>(=) NET PROFIT (BOTTOM LINE)</span>
                          </div>
                          <span className={`text-sm font-black font-sans ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {netProfit < 0 ? `(${formatAmount(Math.abs(netProfit))})` : formatAmount(netProfit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* WIDGET 2: TOP OPERATING EXPENSE DRIVERS */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2 gap-2">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider truncate">Top Operating Overheads</span>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200/80 whitespace-nowrap shrink-0">OpEx Impact</span>
                      </div>

                      <div className="space-y-2 mt-1">
                        {topExpenseDrivers.length === 0 ? (
                          <div className="py-6 text-center text-slate-400 text-xs italic">
                            No operating expense breakdown items found
                          </div>
                        ) : (
                          topExpenseDrivers.map((driver, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-700 truncate max-w-[140px]" title={driver.name}>
                                  {driver.name}
                                </span>
                                <span className="font-bold text-slate-800 font-sans">
                                  {formatAmount(driver.amount)} <span className="text-[9.5px] text-slate-400 font-normal">({driver.pct.toFixed(1)}%)</span>
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${driver.pct}%` }}
                                  className={`h-full rounded-full ${
                                    idx === 0 ? 'bg-purple-600' : idx === 1 ? 'bg-indigo-500' : idx === 2 ? 'bg-blue-500' : 'bg-pink-500'
                                  }`}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* STRUCTURED P&L ACCORDION SECTIONS */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-2">
                  {/* SECTION 1: OPERATING EXPENSES ACCORDION (PRIMARY DRILLDOWN FOR BOTTOM LINE) */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <button
                      type="button"
                      onClick={() => setIsExpensesOpen(!isExpensesOpen)}
                      className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-100/90 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isExpensesOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        <span className="uppercase tracking-wider text-[11px] text-purple-800 font-extrabold">OPERATING & OVERHEAD EXPENSES (OPEX)</span>
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
                          {filteredExpenses.length} items
                        </span>
                      </div>
                      <span className="font-extrabold text-purple-700 font-sans text-sm">
                        {formatAmount(totalExpenses)}
                      </span>
                    </button>

                    {isExpensesOpen && (
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                          {filteredExpenses.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-6 px-6 text-center text-slate-400 italic">
                                No matching operating expense items
                              </td>
                            </tr>
                          ) : (
                            filteredExpenses.map((item, idx) => (
                              <tr
                                key={idx}
                                className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-purple-50/40`}
                              >
                                <td className="py-3 px-6 font-semibold text-slate-800 pl-9">
                                  {item.name}
                                </td>
                                <td className="py-3 px-6 text-right font-extrabold font-sans tracking-tight">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedItemForTransactions({ name: item.name, amount: item.amount })}
                                    className="text-blue-600 hover:text-blue-800 font-bold no-underline cursor-pointer px-2 py-1 rounded hover:bg-blue-100/70 transition-colors"
                                    title={`Click to view Xero Account Transactions for ${item.name}`}
                                  >
                                    {formatAmount(item.amount)}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* SECTION 2: TURNOVER ACCORDION */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <button
                      type="button"
                      onClick={() => setIsTurnoverOpen(!isTurnoverOpen)}
                      className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-100/90 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isTurnoverOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        <span className="uppercase tracking-wider text-[11px] text-emerald-800 font-extrabold">TURNOVER (REVENUE STREAMS)</span>
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
                                    onClick={() => setSelectedItemForTransactions({ name: stream.name, amount: stream.amount })}
                                    className="text-blue-600 hover:text-blue-800 font-bold no-underline cursor-pointer px-2 py-1 rounded hover:bg-blue-100/70 transition-colors"
                                    title={`Click to view Xero Account Transactions for ${stream.name}`}
                                  >
                                    {formatAmount(stream.amount)}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* SECTION 3: DIRECT COST OF SALES (COGS) ACCORDION */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                    <button
                      type="button"
                      onClick={() => setIsCogsOpen(!isCogsOpen)}
                      className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-100/90 hover:bg-slate-200/70 font-bold text-xs text-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCogsOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                        <span className="uppercase tracking-wider text-[11px] text-rose-800 font-extrabold">DIRECT COST OF SALES (COGS)</span>
                        <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200">
                          {filteredCogs.length} items
                        </span>
                      </div>
                      <span className="font-extrabold text-rose-700 font-sans text-sm">
                        {formatAmount(totalCogs)}
                      </span>
                    </button>

                    {isCogsOpen && (
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                          {filteredCogs.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-6 px-6 text-center text-slate-400 italic">
                                No matching Cost of Sales items
                              </td>
                            </tr>
                          ) : (
                            filteredCogs.map((item, idx) => (
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
                                    onClick={() => setSelectedItemForTransactions({ name: item.name, amount: item.amount })}
                                    className="text-blue-600 hover:text-blue-800 font-bold no-underline cursor-pointer px-2 py-1 rounded hover:bg-blue-100/70 transition-colors"
                                    title={`Click to view Xero Account Transactions for ${item.name}`}
                                  >
                                    {formatAmount(item.amount)}
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

              {/* Drawer Fixed Footer */}
              <div className="border-t-2 border-slate-300 bg-slate-900 text-white px-6 py-4 shrink-0 flex items-center justify-between font-bold text-xs select-none">
                <div className="flex flex-col">
                  <span className="uppercase tracking-wider text-[11px] text-emerald-400 font-extrabold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    NET PROFIT (BOTTOM LINE)
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Gross Profit ({formatAmount(grossProfit)}) − OpEx ({formatAmount(totalExpenses)})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                    netProfit >= 0
                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/80'
                      : 'text-rose-300 bg-rose-950/80 border-rose-700/80'
                  }`}>
                    {netProfitMarginPct.toFixed(2)}% Net Margin
                  </span>
                  <span className={`font-black font-sans text-lg ${netProfit >= 0 ? 'text-white' : 'text-rose-300'}`}>
                    {netProfit < 0 ? `(${formatAmount(Math.abs(netProfit))})` : formatAmount(netProfit)}
                  </span>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Level 2 Drilldown: Xero Account Transactions Schedule Drawer */}
      <AccountTransactionsDrawer
        isOpen={!!selectedItemForTransactions}
        onClose={() => setSelectedItemForTransactions(null)}
        onBack={() => setSelectedItemForTransactions(null)}
        streamName={selectedItemForTransactions?.name || ''}
        totalRevenue={selectedItemForTransactions?.amount || 0}
        salesData={salesData}
      />
    </>
  );
}
