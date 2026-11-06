"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Download,
  Copy,
  Check,
  Users,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  DollarSign,
  PieChart,
  ArrowRight,
  ChevronDown,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerConcentrationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  salesData?: any;
  formatAmount: (val: number) => string;
}

export default function CustomerConcentrationPanel({
  isOpen,
  onClose,
  salesData = null,
  formatAmount
}: CustomerConcentrationPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // ESC Key Listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract real PostgreSQL metrics
  const totalRevenue = salesData?.salesSnapshot?.totalRevenue?.value || salesData?.snapshot?.totalRevenue?.value || 0;
  const topCustomers = useMemo(() => salesData?.topCustomers || [], [salesData]);
  const conc = salesData?.executiveRow4?.customerConcentration || {};

  const top5Pct = conc.top5ContributionPct !== undefined
    ? conc.top5ContributionPct
    : (topCustomers.length > 0 && totalRevenue > 0
        ? (topCustomers.slice(0, 5).reduce((acc: number, c: any) => acc + c.revenue, 0) / totalRevenue) * 100
        : 0);

  const largestPct = conc.largestContributionPct !== undefined
    ? conc.largestContributionPct
    : (topCustomers.length > 0 && totalRevenue > 0
        ? (topCustomers[0].revenue / totalRevenue) * 100
        : 0);

  const riskLevel = conc.riskLevel || (top5Pct > 80 ? 'High Risk' : top5Pct > 50 ? 'Medium Risk' : 'Low Risk');

  const top5TotalRevenue = useMemo(() => {
    return topCustomers.slice(0, 5).reduce((acc: number, c: any) => acc + c.revenue, 0);
  }, [topCustomers]);

  const largestCustomerName = topCustomers[0]?.name || 'Top Customer';
  const largestCustomerRev = topCustomers[0]?.revenue || 0;

  // Compute Cumulative Pareto Distribution
  const customersWithPareto = useMemo(() => {
    let cumulative = 0;
    return topCustomers.map((cust: any) => {
      const share = totalRevenue > 0 ? (cust.revenue / totalRevenue) * 100 : 0;
      cumulative += share;
      let customerRiskTag = 'Healthy';
      if (share >= 30) customerRiskTag = 'Critical Dependency';
      else if (share >= 15) customerRiskTag = 'High Impact';
      else if (share >= 5) customerRiskTag = 'Moderate';

      return {
        ...cust,
        sharePct: Number(share.toFixed(1)),
        cumulativePct: Number(Math.min(100, cumulative).toFixed(1)),
        riskTag: customerRiskTag
      };
    });
  }, [topCustomers, totalRevenue]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customersWithPareto;
    const q = searchQuery.toLowerCase().trim();
    return customersWithPareto.filter((c: any) => c.name.toLowerCase().includes(q));
  }, [customersWithPareto, searchQuery]);

  // Export & Copy Handlers
  const handleCopy = () => {
    try {
      const text = customersWithPareto.map((c: any) => `${c.name}\t${c.revenue}\t${c.sharePct}%\t${c.cumulativePct}%`).join('\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Customer concentration report copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Rank,Customer Name,Revenue (£),Share (%),Cumulative Share (%),AR (£),Risk Level"];
      const rows = customersWithPareto.map((c: any, idx: number) =>
        `${idx + 1},"${c.name}",${c.revenue},${c.sharePct}%,${c.cumulativePct}%,${c.ar || 0},"${c.riskTag}"`
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Customer_Concentration_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Exported CSV successfully");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          
          {/* Semi-transparent Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sleek Right Slide-Over Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-4xl bg-slate-50 dark:bg-slate-950 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-sans"
          >

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shrink-0 shadow-xs">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/20 dark:from-amber-500/20 dark:to-orange-500/30 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                      Customer Concentration & Risk Analysis
                    </h2>
                    <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${
                      riskLevel === 'High Risk'
                        ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/80'
                        : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80'
                    }`}>
                      {riskLevel} ({top5Pct.toFixed(1)}% Top 5)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    Pareto 80/20 distribution, single-customer exposure & revenue vulnerability audit across registered accounts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
                  <span>{copied ? 'Copied' : 'Copy Breakdown'}</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  <span>CSV Export</span>
                </button>

                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 text-slate-500 dark:text-slate-400 transition cursor-pointer font-bold text-xs ml-2"
                  aria-label="Close modal"
                >
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">ESC</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* TOP 4 KPI METRICS GRID - FULL WIDTH 4 COLS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 px-8 py-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shrink-0">
              
              {/* CARD 1: TOP 5 CONCENTRATION */}
              <div className="bg-amber-50/60 dark:bg-slate-950/60 border border-amber-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Top 5 Concentration</span>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
                    {top5Pct.toFixed(1)}%
                  </span>
                  <span className="text-xs font-extrabold text-amber-700 font-sans">{formatAmount(top5TotalRevenue)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, top5Pct)}%` }} />
                </div>
              </div>

              {/* CARD 2: LARGEST CUSTOMER */}
              <div className="bg-blue-50/60 dark:bg-slate-950/60 border border-blue-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Largest Client Share</span>
                  <ShieldAlert className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
                    {largestPct.toFixed(1)}%
                  </span>
                  <span className="text-xs font-extrabold text-blue-700 font-sans">{formatAmount(largestCustomerRev)}</span>
                </div>
                <p className="text-[10.5px] font-extrabold text-slate-500 truncate mt-1.5" title={largestCustomerName}>
                  {largestCustomerName}
                </p>
              </div>

              {/* CARD 3: TOTAL ACTIVE CUSTOMERS */}
              <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Customer Base</span>
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
                  {topCustomers.length} Clients
                </div>
                <p className="text-[10.5px] font-medium text-slate-400 mt-1.5">
                  Generating {formatAmount(totalRevenue)} total
                </p>
              </div>

              {/* CARD 4: EXPOSURE RISK SCORE */}
              <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Dependency Risk Level</span>
                  <Sparkles className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
                  {top5Pct > 80 ? 'CRITICAL' : top5Pct > 50 ? 'MODERATE' : 'HEALTHY'}
                </div>
                <p className="text-[10.5px] font-semibold text-slate-500 mt-1.5">
                  {top5Pct > 80 ? 'High reliance on top 5 accounts' : 'Well diversified revenue base'}
                </p>
              </div>

            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto custom-table-scrollbar p-6 space-y-6">

              {/* PARETO DISTRIBUTION & INSIGHTS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT 7 COLS: PARETO 80/20 CUMULATIVE CONCENTRATION BAR CHART */}
                <div className="lg:col-span-7 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Pareto Cumulative Revenue Concentration (80/20 Rule)
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Cumulative % of revenue driven by top client accounts
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      Pareto Analysis
                    </span>
                  </div>

                  {/* PARETO BARS LIST */}
                  <div className="space-y-3 font-sans pt-1">
                    {customersWithPareto.slice(0, 5).map((cust: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                            #{idx + 1} {cust.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white">{formatAmount(cust.revenue)}</span>
                            <span className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                              {cust.sharePct}% share
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              (Cum: {cust.cumulativePct}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-blue-600' : 'bg-emerald-500'}`}
                            style={{ width: `${cust.sharePct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT 5 COLS: EXECUTIVE RISK & ADVISORY BOX */}
                <div className="lg:col-span-5 bg-amber-50/50 dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>CFO Risk Assessment & Recommendations</span>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="bg-white dark:bg-slate-950 p-3 rounded-2xl border border-amber-200/60 dark:border-slate-800 space-y-1">
                      <div className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>High Client Dependency Warning</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                        Top 5 clients generate <strong className="text-slate-900 dark:text-white font-sans">{top5Pct.toFixed(1)}%</strong> of total turnover (<strong className="font-sans text-amber-700">{formatAmount(top5TotalRevenue)}</strong>).
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-950 p-3 rounded-2xl border border-amber-200/60 dark:border-slate-800 space-y-1">
                      <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-blue-600" />
                        <span>Largest Customer Exposure</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">{largestCustomerName}</strong> accounts for <strong className="font-sans font-bold text-blue-600">{largestPct.toFixed(1)}%</strong> of revenue. Diversification recommended.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* DETAILED CUSTOMERS AUDIT TABLE */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      Customer Concentration Audit Schedule
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      PostgreSQL registered customer accounts ranked by revenue & concentration impact
                    </p>
                  </div>

                  <div className="relative w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customer name"
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4"># Rank</th>
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4 text-right">Revenue (£)</th>
                        <th className="py-3 px-4 text-right">% Share</th>
                        <th className="py-3 px-4 text-right">Cumulative %</th>
                        <th className="py-3 px-4 text-right">Growth (%)</th>
                        <th className="py-3 px-4 text-right">AR (£)</th>
                        <th className="py-3 px-4 text-center">Risk Tag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                            No customer records found in PostgreSQL database
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((cust: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">{cust.name}</td>
                            <td className="py-3.5 px-4 text-right font-black font-sans">{formatAmount(cust.revenue)}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-700 dark:text-slate-300">{cust.sharePct}%</td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-400 font-sans">{cust.cumulativePct}%</td>
                            <td className="py-3.5 px-4 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded font-black text-[10.5px] ${
                                cust.growth >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {cust.growth >= 0 ? `+${cust.growth}%` : `${cust.growth}%`}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold font-sans text-amber-600">
                              {formatAmount(cust.ar || 0)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                cust.riskTag === 'Critical Dependency'
                                  ? 'bg-rose-100 text-rose-800'
                                  : cust.riskTag === 'High Impact'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {cust.riskTag}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
