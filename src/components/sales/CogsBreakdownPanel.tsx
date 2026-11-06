"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Download, DollarSign, Eye, ShoppingCart, Truck, ChevronDown, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface CogsAccountItem {
  name: string;
  amount: number;
  accountId?: string;
  category?: string;
}

interface CogsBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cogsAccounts: CogsAccountItem[];
  totalCogs?: number;
  currencySymbol?: string;
  dateLabel?: string;
  salesData?: any;
  formatAmount: (val: number) => string;
}

export default function CogsBreakdownPanel({
  isOpen,
  onClose,
  cogsAccounts = [],
  totalCogs = 0,
  currencySymbol = '£',
  dateLabel = '',
  salesData = null,
  formatAmount
}: CogsBreakdownPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'AMOUNT_DESC' | 'AMOUNT_ASC' | 'NAME_ASC'>('AMOUNT_DESC');
  const [selectedAccountForTransactions, setSelectedAccountForTransactions] = useState<{ name: string; amount: number } | null>(null);

  // Formatted period subtitle
  const formattedPeriodSub = useMemo(() => {
    if (dateLabel) {
      const cleaned = dateLabel.replace(/^(vs\s*)+/i, '');
      return `For the period ${cleaned}`;
    }
    return 'For the selected financial period';
  }, [dateLabel]);

  // Derive active COGS accounts strictly from props
  const activeCogs: CogsAccountItem[] = useMemo(() => {
    if (cogsAccounts && cogsAccounts.length > 0) {
      return cogsAccounts.map(c => ({
        name: c.name || 'COGS Account',
        amount: c.amount || 0,
        accountId: c.accountId,
        category: c.name.toLowerCase().includes('stock') ? 'Inventory & Stock' : c.name.toLowerCase().includes('shipping') || c.name.toLowerCase().includes('courier') ? 'Logistics & Shipping' : (c.category || 'Direct Procurement')
      })).filter(c => c.amount !== 0);
    }

    return [];
  }, [cogsAccounts]);

  const computedTotal = useMemo(() => {
    return activeCogs.reduce((acc, curr) => acc + curr.amount, 0) || totalCogs || 0;
  }, [activeCogs, totalCogs]);

  // COGS sorted with percentage contribution
  const sortedCogs = useMemo(() => {
    return activeCogs.map(c => ({
      ...c,
      pct: computedTotal > 0 ? (c.amount / computedTotal) * 100 : 0
    })).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
        if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
        return b.amount - a.amount;
      });
  }, [activeCogs, computedTotal, searchTerm, sortBy]);

  // KPI Highlights
  const topProcurement = useMemo(() => sortedCogs.find(c => c.amount > 0) || null, [sortedCogs]);
  const merchandiseExpense = useMemo(() => activeCogs.find(c => c.name.toLowerCase().includes('cost of goods')) || null, [activeCogs]);
  const fbaExpense = useMemo(() => activeCogs.find(c => c.name.toLowerCase().includes('amazon fee')) || null, [activeCogs]);

  // Export CSV
  const handleExportCSV = () => {
    if (sortedCogs.length === 0) {
      toast.error("No COGS accounts to export!");
      return;
    }

    const headers = ["Account Name", "Category", "Amount", "% of Total COGS"];
    const csvRows = sortedCogs.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.category || 'Direct Procurement'}"`,
      `"${c.amount.toFixed(2)}"`,
      `"${c.pct.toFixed(2)}%"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cost_Of_Goods_Sold_Breakdown_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${sortedCogs.length} COGS accounts to CSV!`);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-md flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="w-full max-w-6xl bg-slate-50 dark:bg-slate-950 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
              {/* TOP NAVIGATION / HEADER */}
              <div className="px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors cursor-pointer"
                    title="Close Panel"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-amber-600" />
                        Cost of Goods Sold (COGS) Breakdown
                      </h2>
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full">
                        {activeCogs.length} Direct Procurement Accounts
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Organization | <span className="text-slate-700 dark:text-slate-300 font-semibold">{formattedPeriodSub}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-3xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* MAIN CONTENT AREA - SCROLLABLE */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* 1. TOP KPI SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total COGS */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">TOTAL COST OF SALES</span>
                      <DollarSign className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                      {formatAmount(computedTotal)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Across {activeCogs.length} Accounts</span>
                      <span className="text-amber-600 font-bold bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">Official Xero P&L</span>
                    </div>
                  </div>

                  {/* Top Procurement Account */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">LARGEST PROCUREMENT</span>
                      <ShoppingCart className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                      {topProcurement ? formatAmount(topProcurement.amount) : '£0.00'}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="truncate max-w-[140px]">{topProcurement?.name || 'Intercompany Purchases'}</span>
                      <span className="text-amber-600 font-bold">{topProcurement ? `${topProcurement.pct.toFixed(1)}%` : '0%'}</span>
                    </div>
                  </div>

                  {/* Direct Merchandise */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">DIRECT GOODS / MERCHANDISE</span>
                      <PackageCheck className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {merchandiseExpense ? formatAmount(merchandiseExpense.amount) : formatAmount(0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Inventory Procurement</span>
                      <span className="text-blue-600 font-bold">{merchandiseExpense && computedTotal > 0 ? `${((merchandiseExpense.amount / computedTotal) * 100).toFixed(1)}%` : '0.0%'}</span>
                    </div>
                  </div>

                  {/* Amazon FBA Fees */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">AMAZON FBA & FEES</span>
                      <Truck className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {fbaExpense ? formatAmount(fbaExpense.amount) : formatAmount(0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Marketplace Fulfillment</span>
                      <span className="text-rose-600 font-bold">{fbaExpense && computedTotal > 0 ? `${((fbaExpense.amount / computedTotal) * 100).toFixed(1)}%` : '0.0%'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. SEARCH & FILTERS BAR */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search COGS Account..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Sorting Dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                    >
                      <option value="AMOUNT_DESC">Highest Cost First</option>
                      <option value="AMOUNT_ASC">Lowest Cost First</option>
                      <option value="NAME_ASC">Account Name A-Z</option>
                    </select>
                  </div>
                </div>

                {/* 3. COGS DATA TABLE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <span>ACCOUNT NAME</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <span>CATEGORY</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-right font-extrabold">
                            <div className="flex items-center justify-end gap-1">
                              <span>AMOUNT ({currencySymbol})</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-center font-extrabold w-48">
                            <span>% OF COGS</span>
                          </th>
                          <th className="py-3.5 px-4 text-center font-extrabold">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {sortedCogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-slate-400">
                              <DollarSign className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                              <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No COGS Accounts Found</p>
                              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query.</p>
                            </td>
                          </tr>
                        ) : (
                          sortedCogs.map((cogs, idx) => (
                            <tr
                              key={cogs.accountId || idx}
                              onClick={() => setSelectedAccountForTransactions({ name: cogs.name, amount: cogs.amount })}
                              className="hover:bg-amber-50/30 dark:hover:bg-amber-950/30 transition-colors cursor-pointer group"
                            >
                              {/* Account Name */}
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                                <span className="group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                                  {cogs.name}
                                </span>
                              </td>

                              {/* Category */}
                              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {cogs.category || 'Direct Procurement'}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className={`py-3.5 px-4 text-right font-extrabold font-sans text-sm ${cogs.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {cogs.amount < 0 ? `(${formatAmount(Math.abs(cogs.amount))})` : formatAmount(cogs.amount)}
                              </td>

                              {/* Percentage Progress Bar */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${Math.min(100, Math.max(0, cogs.pct))}%` }}
                                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 min-w-[38px] text-right font-sans">
                                    {cogs.pct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>

                              {/* Action Button */}
                              <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedAccountForTransactions({ name: cogs.name, amount: cogs.amount })}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/80 rounded-md transition-colors cursor-pointer shadow-3xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}

                        {/* SUMMARY TOTAL ROW */}
                        {sortedCogs.length > 0 && (
                          <tr className="bg-slate-50/90 dark:bg-slate-800/80 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                            <td colSpan={2} className="py-3.5 px-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">
                              TOTAL COST OF SALES ({sortedCogs.length} ACCOUNTS)
                            </td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-sm text-amber-600 dark:text-amber-400 font-sans">
                              {formatAmount(computedTotal)}
                            </td>
                            <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">
                              100.0%
                            </td>
                            <td className="py-3.5 px-4"></td>
                          </tr>
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

      {/* LEVEL 3 TRANSACTIONS DRAWER */}
      {selectedAccountForTransactions && (
        <AccountTransactionsDrawer
          isOpen={!!selectedAccountForTransactions}
          onClose={() => setSelectedAccountForTransactions(null)}
          onBack={() => setSelectedAccountForTransactions(null)}
          streamName={selectedAccountForTransactions.name}
          totalRevenue={selectedAccountForTransactions.amount}
          dateLabel={dateLabel}
          salesData={salesData}
        />
      )}
    </>
  );
}
