"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Download, Copy, Check, BarChart2, Layers } from 'lucide-react';
import { toast } from 'sonner';

import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface SalesStreamItem {
  name: string;
  revenue: number;
  code?: string;
}

interface TurnoverDrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  totalRevenue: number;
  salesData?: any;
  formatAmount: (val: number) => string;
}

export default function TurnoverDrawerPanel({
  isOpen,
  onClose,
  title = "Turnover Breakdown",
  totalRevenue,
  salesData = null,
  formatAmount
}: TurnoverDrawerPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesCount, setEntriesCount] = useState<number>(10);
  const [copied, setCopied] = useState(false);
  const [selectedStreamForTransactions, setSelectedStreamForTransactions] = useState<SalesStreamItem | null>(null);

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

  // Derive turnover streams strictly from salesData
  const activeStreams: SalesStreamItem[] = useMemo(() => {
    if (salesData?.turnoverStreams && Array.isArray(salesData.turnoverStreams) && salesData.turnoverStreams.length > 0) {
      return salesData.turnoverStreams.map((s: any) => ({
        name: s.name || s.account_name || 'Turnover Account',
        revenue: s.revenue || s.amount || 0,
        code: s.code || s.account_code || s.accountCode || ''
      }));
    }
    return [];
  }, [salesData]);

  const computedTotal = useMemo(() => {
    return activeStreams.reduce((acc, curr) => acc + curr.revenue, 0) || totalRevenue || 0;
  }, [activeStreams, totalRevenue]);

  // Compute Streams with Percentage Share
  const streamsWithPct = useMemo(() => {
    return activeStreams.map(s => ({
      ...s,
      pct: computedTotal > 0 ? (s.revenue / computedTotal) * 100 : 0
    }));
  }, [activeStreams, computedTotal]);

  const topStream = useMemo(() => {
    if (streamsWithPct.length === 0) return null;
    return [...streamsWithPct].sort((a, b) => b.revenue - a.revenue)[0];
  }, [streamsWithPct]);

  const filteredStreams = useMemo(() => {
    if (!searchQuery.trim()) return streamsWithPct;
    const q = searchQuery.toLowerCase().trim();
    return streamsWithPct.filter(s => s.name.toLowerCase().includes(q));
  }, [streamsWithPct, searchQuery]);

  const displayedStreams = useMemo(() => {
    return filteredStreams.slice(0, entriesCount);
  }, [filteredStreams, entriesCount]);

  const handleCopy = () => {
    try {
      const text = activeStreams.map(s => `${s.name}\t${s.revenue}`).join('\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Turnover breakdown copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Stream Name,Revenue Amount (£),Share (%)"];
      const rows = streamsWithPct.map(s => `"${s.name}",${s.revenue},${s.pct.toFixed(2)}%`);
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Turnover_Breakdown_${new Date().toISOString().slice(0, 10)}.csv`);
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
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            {/* Semi-transparent Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Ultra Smooth Slide-Over Drawer - Full Screen Width */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-xl bg-slate-50 dark:bg-slate-950 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-sans"
            >

              {/* Drawer Header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {title}
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {activeStreams.length} Active Streams
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recognized revenue breakdown by sales channel
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
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5 font-sans tracking-tight">
                      {formatAmount(computedTotal)}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 text-center shadow-3xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channels</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5 font-sans tracking-tight">
                      {activeStreams.length} Streams
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 text-center shadow-3xs flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Channel</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5 font-sans tracking-tight truncate flex items-center justify-center gap-1">
                      <span className="truncate">{topStream ? topStream.name : '-'}</span>
                      {topStream && (
                        <span className="text-[9.5px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 shrink-0">
                          {topStream.pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Banner */}
              <div className="bg-blue-50/80 border-b border-blue-100/80 px-6 py-2 flex items-center gap-2 text-xs text-blue-900 shrink-0">
                <span className="font-semibold text-blue-700">💡 Tip:</span>
                <span>Click any blue revenue amount to view detailed Xero Account Transactions schedule.</span>
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

                  <div className="flex items-center gap-1.5 ml-1 text-slate-500 font-medium">
                    <span>Show</span>
                    <select
                      value={entriesCount}
                      onChange={(e) => setEntriesCount(Number(e.target.value))}
                      className="h-8 px-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer text-xs"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                    </select>
                    <span>entries</span>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by account"
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-slate-400 transition"
                  />
                </div>
              </div>

              {/* Main Content Area (Scrollable) */}
              <div className="flex-1 overflow-y-auto custom-table-scrollbar p-6 space-y-5">

                {/* VISUAL ANALYTICS CARD: PROPORTIONAL REVENUE DISTRIBUTION BAR */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Revenue Channel Distribution</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                      Channel Share
                    </span>
                  </div>

                  {/* Segmented Revenue Progress Bar */}
                  <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                    {streamsWithPct.map((stream, idx) => (
                      <div
                        key={idx}
                        style={{ width: `${stream.pct}%` }}
                        className={`h-full transition-all duration-700 ${
                          idx === 0 ? 'bg-blue-600 rounded-l-full' :
                          idx === 1 ? 'bg-emerald-500' :
                          idx === 2 ? 'bg-amber-500' :
                          idx === 3 ? 'bg-purple-500' :
                          idx === 4 ? 'bg-cyan-500' : 'bg-slate-400'
                        }`}
                        title={`${stream.name}: ${stream.pct.toFixed(1)}%`}
                      />
                    ))}
                  </div>

                  {/* Top Legend Chips */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-600 pt-1">
                    {streamsWithPct.slice(0, 3).map((stream, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <span>{stream.name}: <strong className="text-slate-800 font-sans">{stream.pct.toFixed(1)}%</strong></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* REVENUE STREAMS TABLE */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-6">ACCOUNT / STREAM NAME</th>
                        <th className="py-3 px-6 text-center">SHARE (%)</th>
                        <th className="py-3 px-6 text-right">REVENUE AMOUNT (£)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                      {displayedStreams.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">
                            No matching turnover streams found
                          </td>
                        </tr>
                      ) : (
                        displayedStreams.map((stream, idx) => (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } hover:bg-blue-50/60`}
                          >
                            <td 
                              onClick={() => setSelectedStreamForTransactions(stream)}
                              className="py-3.5 px-6 font-semibold text-slate-800 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                              title={`Click to view Xero Account Transactions for ${stream.name}`}
                            >
                              <span className="hover:underline">{stream.name}</span>
                              {idx === 0 && (
                                <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                  Top Stream
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <span className="inline-block text-[10.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                {stream.pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right font-extrabold font-sans tracking-tight">
                              <button
                                type="button"
                                onClick={() => setSelectedStreamForTransactions(stream)}
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
                </div>

              </div>

              {/* Drawer Fixed Footer */}
              <div className="border-t-2 border-slate-300 bg-slate-900 text-white px-6 py-4 shrink-0 flex items-center justify-between font-bold text-xs select-none">
                <div className="flex flex-col">
                  <span className="uppercase tracking-wider text-[11px] text-blue-400 font-extrabold">
                    TOTAL REVENUE
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    Sum across {activeStreams.length} active turnover channels
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-black font-sans text-lg text-white">
                    {formatAmount(computedTotal)}
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
        streamName={selectedStreamForTransactions ? (selectedStreamForTransactions.code ? `${selectedStreamForTransactions.code} - ${selectedStreamForTransactions.name}` : selectedStreamForTransactions.name) : ''}
        totalRevenue={selectedStreamForTransactions?.revenue || 0}
        salesData={salesData}
      />
    </>
  );
}
