"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Download, Layers, Eye, Sparkles, Building2, Wallet, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface ExpenseAccountItem {
  name: string;
  amount: number;
  accountId?: string;
  category?: string;
}

interface ExpensesBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExpenseAccountItem[];
  totalExpenses?: number;
  currencySymbol?: string;
  dateLabel?: string;
  formatAmount: (val: number) => string;
}

export default function ExpensesBreakdownPanel({
  isOpen,
  onClose,
  expenses = [],
  totalExpenses = 0,
  currencySymbol = '£',
  dateLabel = '',
  formatAmount
}: ExpensesBreakdownPanelProps) {
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

  // Derive active expense items strictly from real P&L accounts list
  const activeExpenses: ExpenseAccountItem[] = useMemo(() => {
    if (expenses && expenses.length > 0) {
      return expenses.map(e => ({
        name: e.name || 'Expense Account',
        amount: Math.abs(e.amount || 0),
        accountId: e.accountId,
        category: e.category || 'Administrative Overhead'
      })).filter(e => e.amount > 0);
    }

    return [];
  }, [expenses]);

  const computedTotal = useMemo(() => {
    return activeExpenses.reduce((acc, curr) => acc + curr.amount, 0) || totalExpenses || 0;
  }, [activeExpenses, totalExpenses]);

  // Expenses sorted with percentage contribution
  const sortedExpenses = useMemo(() => {
    return activeExpenses.map(e => ({
      ...e,
      pct: computedTotal > 0 ? (e.amount / computedTotal) * 100 : 0
    })).filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
        if (sortBy === 'NAME_ASC') return a.name.localeCompare(b.name);
        return b.amount - a.amount;
      });
  }, [activeExpenses, computedTotal, searchTerm, sortBy]);

  // KPI Highlights
  const topExpense = useMemo(() => sortedExpenses[0] || null, [sortedExpenses]);
  const rentExpense = useMemo(() => activeExpenses.find(e => e.name.toLowerCase().includes('rent')) || null, [activeExpenses]);
  const locumExpense = useMemo(() => activeExpenses.find(e => e.name.toLowerCase().includes('locum') || e.name.toLowerCase().includes('contractor')) || null, [activeExpenses]);

  // Export CSV
  const handleExportCSV = () => {
    if (sortedExpenses.length === 0) {
      toast.error("No expense accounts to export!");
      return;
    }

    const headers = ["Account Name", "Category", "Amount", "% of Total"];
    const csvRows = sortedExpenses.map(e => [
      `"${e.name.replace(/"/g, '""')}"`,
      `"${e.category || 'Administrative Overhead'}"`,
      `"${e.amount.toFixed(2)}"`,
      `"${e.pct.toFixed(2)}%"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Operating_Expenses_Breakdown_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${sortedExpenses.length} expense accounts to CSV!`);
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
                        <Layers className="h-5 w-5 text-purple-600" />
                        Indirect & Operating Expenses Breakdown
                      </h2>
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full">
                        {activeExpenses.length} Administrative Accounts
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
                  {/* Total Operating Expenses */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">TOTAL OPERATING EXPENSES</span>
                      <Wallet className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                      {formatAmount(computedTotal)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Across {activeExpenses.length} P&L Accounts</span>
                      <span className="text-purple-600 font-bold bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">Official Xero P&L</span>
                    </div>
                  </div>

                  {/* Top Expense Stream */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">LARGEST OVERHEAD</span>
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                      {topExpense ? formatAmount(topExpense.amount) : formatAmount(0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="truncate max-w-[140px]">{topExpense?.name || 'No Data'}</span>
                      <span className="text-purple-600 font-bold">{topExpense ? `${topExpense.pct.toFixed(1)}%` : '0%'}</span>
                    </div>
                  </div>

                  {/* Rent Expense */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">PREMISES & RENT</span>
                      <Building2 className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {rentExpense ? formatAmount(rentExpense.amount) : formatAmount(0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Property Lease</span>
                      <span className="text-indigo-600 font-bold">{rentExpense && computedTotal > 0 ? `${((rentExpense.amount / computedTotal) * 100).toFixed(1)}%` : '0.0%'}</span>
                    </div>
                  </div>

                  {/* Locum & Contractors */}
                  <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">LOCUM & CONTRACTORS</span>
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {locumExpense ? formatAmount(locumExpense.amount) : formatAmount(0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Clinical Staffing</span>
                      <span className="text-amber-600 font-bold">{locumExpense && computedTotal > 0 ? `${((locumExpense.amount / computedTotal) * 100).toFixed(1)}%` : '0.0%'}</span>
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
                      placeholder="Search Expense Account..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
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
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                    >
                      <option value="AMOUNT_DESC">Highest Expense First</option>
                      <option value="AMOUNT_ASC">Lowest Expense First</option>
                      <option value="NAME_ASC">Account Name A-Z</option>
                    </select>
                  </div>
                </div>

                {/* 3. EXPENSES DATA TABLE */}
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
                            <span>% OF OVERHEADS</span>
                          </th>
                          <th className="py-3.5 px-4 text-center font-extrabold">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {sortedExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-14 text-center text-slate-400">
                              <Layers className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                              <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No Expense Accounts Found</p>
                              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query.</p>
                            </td>
                          </tr>
                        ) : (
                          sortedExpenses.map((exp, idx) => (
                            <tr
                              key={exp.accountId || idx}
                              onClick={() => setSelectedAccountForTransactions({ name: exp.name, amount: exp.amount })}
                              className="hover:bg-purple-50/30 dark:hover:bg-purple-950/30 transition-colors cursor-pointer group"
                            >
                              {/* Account Name */}
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                                <span className="group-hover:text-purple-600 transition-colors flex items-center gap-1.5">
                                  {exp.name}
                                </span>
                              </td>

                              {/* Category */}
                              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {exp.category || 'Administrative Overhead'}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-3.5 px-4 text-right font-extrabold text-purple-700 dark:text-purple-400 font-sans text-sm">
                                {formatAmount(exp.amount)}
                              </td>

                              {/* Percentage Progress Bar */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${Math.min(100, Math.max(2, exp.pct))}%` }}
                                      className="bg-purple-600 h-full rounded-full transition-all duration-300"
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 min-w-[38px] text-right font-sans">
                                    {exp.pct.toFixed(1)}%
                                  </span>
                                </div>
                              </td>

                              {/* Action Button */}
                              <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedAccountForTransactions({ name: exp.name, amount: exp.amount })}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-100 border border-purple-200/80 rounded-md transition-colors cursor-pointer shadow-3xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}

                        {/* SUMMARY TOTAL ROW */}
                        {sortedExpenses.length > 0 && (
                          <tr className="bg-slate-50/90 dark:bg-slate-800/80 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                            <td colSpan={2} className="py-3.5 px-4 text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">
                              TOTAL OPERATING EXPENSES ({sortedExpenses.length} ACCOUNTS)
                            </td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-sm text-purple-700 dark:text-purple-400 font-sans">
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
        />
      )}
    </>
  );
}
