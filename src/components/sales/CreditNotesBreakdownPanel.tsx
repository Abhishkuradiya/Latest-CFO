"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Download, FileText, Eye, CheckCircle2, Clock, AlertTriangle, ChevronDown, Filter, Sparkles, RefreshCw, FileMinus } from 'lucide-react';
import { toast } from 'sonner';
import XeroInvoiceViewerDrawer, { OpenInvoiceData } from './XeroInvoiceViewerDrawer';

export interface CreditNoteItem {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate?: string;
  subTotal?: number;
  totalTax?: number;
  amount: number;
  amountDue?: number;
  remainingCredit?: number;
  status: string;
  rawStatus?: string;
  statusColor?: string;
  reference?: string;
  currencyCode?: string;
  amountPaid?: number;
  lineItems?: any[];
}

interface CreditNotesBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  creditNotes: CreditNoteItem[];
  currencySymbol?: string;
  dateLabel?: string;
}

export default function CreditNotesBreakdownPanel({
  isOpen,
  onClose,
  creditNotes = [],
  currencySymbol = '£',
  dateLabel = ''
}: CreditNotesBreakdownPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'APPLIED' | 'DRAFT'>('ALL');
  const [activeCard, setActiveCard] = useState<'ALL' | 'ACTIVE' | 'APPLIED' | 'AVG'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');

  // Multi-instance Level 3 Floating Windows State
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  // Formatted period subtitle
  const formattedPeriodSub = useMemo(() => {
    if (dateLabel) {
      const cleaned = dateLabel.replace(/^(vs\s*)+/i, '');
      return `For the period ${cleaned}`;
    }
    if (creditNotes.length > 0) {
      const dates = creditNotes.map(c => c.date).filter(Boolean).sort();
      if (dates.length > 0) {
        return `For the period ${dates[0]} to ${dates[dates.length - 1]}`;
      }
    }
    return 'For the selected financial period';
  }, [dateLabel, creditNotes]);

  // Open Level 3 Floating Window for Credit Note
  const handleOpenLevel3CN = (cn: CreditNoteItem) => {
    setOpenInvoices(prev => {
      const existing = prev.find(item => item.refNumber === cn.number || item.id.includes(cn.number));
      if (existing) {
        const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
        toast.info(`Credit Note ${cn.number} brought to front!`);
        return prev.map(item => (item.refNumber === cn.number || item.id === existing.id) ? { ...item, zIndex: maxZ + 1, isMinimized: false, isHighlighted: true } : item);
      }

      const offset = (prev.length % 5) * 30;
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      const winW = typeof window !== 'undefined' ? Math.min(820, window.innerWidth - 60) : 820;
      const winH = typeof window !== 'undefined' ? Math.min(520, window.innerHeight - 180) : 520;
      const startX = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerWidth - winW) / 2) + offset) : 90;
      const startY = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerHeight - winH) / 2 - 30) + offset) : 50;

      return [
        ...prev,
        {
          id: `${cn.number}-${Date.now()}`,
          refNumber: cn.number,
          contactName: cn.customer,
          date: cn.date,
          dueDate: cn.dueDate,
          desc: `${cn.customer} - ${cn.reference || 'Credit Note & Return'}`,
          amount: cn.amount,
          subTotal: cn.subTotal !== undefined ? cn.subTotal : Math.round((cn.amount / 1.2) * 100) / 100,
          totalTax: cn.totalTax !== undefined ? cn.totalTax : Math.round((cn.amount - (cn.amount / 1.2)) * 100) / 100,
          amountPaid: cn.amountPaid !== undefined ? cn.amountPaid : cn.amount,
          amountDue: cn.amountDue !== undefined ? cn.amountDue : 0,
          status: cn.status || 'Applied',
          lineItems: (cn as any).lineItems,
          x: startX,
          y: startY,
          width: winW,
          height: winH,
          zIndex: maxZ + 1,
          isMinimized: false,
          isMaximized: false,
          isHighlighted: true
        }
      ];
    });
  };

  const handleCloseInvoice = (id: string) => {
    setOpenInvoices(prev => prev.filter(item => item.id !== id));
  };

  const handleFocusInvoice = (id: string) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      return prev.map(item => item.id === id ? { ...item, zIndex: maxZ + 1, isMinimized: false } : item);
    });
  };

  const handleUpdateInvoice = (id: string, updates: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // Helper currency formatter
  const formatMoney = (val: number) => {
    return `${currencySymbol}${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Summary Metrics
  const totalAmount = useMemo(() => creditNotes.reduce((acc, c) => acc + c.amount, 0), [creditNotes]);
  const activeRemainingTotal = useMemo(() => creditNotes.reduce((acc, c) => acc + (c.remainingCredit ?? c.amountDue ?? 0), 0), [creditNotes]);
  const appliedTotal = useMemo(() => Math.max(0, totalAmount - activeRemainingTotal), [totalAmount, activeRemainingTotal]);
  const avgValue = useMemo(() => creditNotes.length > 0 ? totalAmount / creditNotes.length : 0, [totalAmount, creditNotes]);

  const activeCount = useMemo(() => creditNotes.filter(c => (c.remainingCredit ?? c.amountDue ?? 0) > 0).length, [creditNotes]);
  const appliedCount = useMemo(() => creditNotes.filter(c => c.status === 'Applied' || (c.remainingCredit ?? c.amountDue ?? 0) === 0).length, [creditNotes]);
  const draftCount = useMemo(() => creditNotes.filter(c => c.status === 'Draft').length, [creditNotes]);

  // Filtering & Sorting
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      const matchSearch =
        cn.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cn.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cn.reference && cn.reference.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchStatus = true;
      if (statusFilter === 'ACTIVE') matchStatus = (cn.remainingCredit ?? cn.amountDue ?? 0) > 0;
      if (statusFilter === 'APPLIED') matchStatus = cn.status === 'Applied' || (cn.remainingCredit ?? cn.amountDue ?? 0) === 0;
      if (statusFilter === 'DRAFT') matchStatus = cn.status === 'Draft';

      let matchCard = true;
      if (activeCard === 'ACTIVE') matchCard = (cn.remainingCredit ?? cn.amountDue ?? 0) > 0;
      if (activeCard === 'APPLIED') matchCard = cn.status === 'Applied' || (cn.remainingCredit ?? cn.amountDue ?? 0) === 0;

      return matchSearch && matchStatus && matchCard;
    }).sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.amount - a.amount;
      if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
      const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const parts = dStr.split(' ');
        if (parts.length === 3) {
          const mIdx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec'].findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
          return new Date(parseInt(parts[2]), mIdx >= 0 ? mIdx % 12 : 0, parseInt(parts[0])).getTime();
        }
        return new Date(dStr).getTime() || 0;
      };
      if (sortBy === 'DATE_ASC') return parseDate(a.date) - parseDate(b.date);
      return parseDate(b.date) - parseDate(a.date);
    });
  }, [creditNotes, searchTerm, statusFilter, activeCard, sortBy]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredCreditNotes.length === 0) {
      toast.error("No credit notes to export!");
      return;
    }

    const headers = ["Credit Note #", "Reference", "Customer Name", "Date", "Status", "Net Excl Tax", "Tax VAT", "Total Amount", "Remaining Credit"];
    const csvRows = filteredCreditNotes.map(cn => [
      `"${cn.number}"`,
      `"${cn.reference || ''}"`,
      `"${cn.customer.replace(/"/g, '""')}"`,
      `"${cn.date}"`,
      `"${cn.status}"`,
      `"${(cn.subTotal ?? (cn.amount / 1.2)).toFixed(2)}"`,
      `"${(cn.totalTax ?? (cn.amount - (cn.subTotal ?? (cn.amount / 1.2)))).toFixed(2)}"`,
      `"${cn.amount.toFixed(2)}"`,
      `"${(cn.remainingCredit ?? cn.amountDue ?? 0).toFixed(2)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Credit_Notes_Breakdown_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filteredCreditNotes.length} credit notes to CSV!`);
  };

  if (!isOpen) return (
    <XeroInvoiceViewerDrawer
      invoices={openInvoices}
      onCloseInvoice={handleCloseInvoice}
      onFocusInvoice={handleFocusInvoice}
      onUpdateInvoice={handleUpdateInvoice}
    />
  );

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
                        <FileMinus className="h-5 w-5 text-rose-600" />
                        Credit Notes & Returns Breakdown
                      </h2>
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full">
                        {creditNotes.length} Credit Notes
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
                  {/* Total Credit Notes Card */}
                  <div
                    onClick={() => { setActiveCard('ALL'); setStatusFilter('ALL'); }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      activeCard === 'ALL'
                        ? 'bg-white dark:bg-slate-800 border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">TOTAL CREDIT NOTES</span>
                      <FileMinus className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                      {formatMoney(totalAmount)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Across {creditNotes.length} Credit Notes</span>
                      <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded">Active View</span>
                    </div>
                  </div>

                  {/* Active / Unapplied Credit Card */}
                  <div
                    onClick={() => { setActiveCard('ACTIVE'); setStatusFilter('ACTIVE'); }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      activeCard === 'ACTIVE'
                        ? 'bg-white dark:bg-slate-800 border-rose-500 ring-2 ring-rose-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">UNAPPLIED / ACTIVE CREDIT</span>
                      <Clock className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                      {formatMoney(activeRemainingTotal)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{activeCount} Active Credit Notes</span>
                      <span className="text-rose-600 font-bold">{totalAmount > 0 ? ((activeRemainingTotal / totalAmount) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>

                  {/* Applied / Refunded Credit Card */}
                  <div
                    onClick={() => { setActiveCard('APPLIED'); setStatusFilter('APPLIED'); }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      activeCard === 'APPLIED'
                        ? 'bg-white dark:bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">APPLIED / REFUNDED</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {formatMoney(appliedTotal)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{appliedCount} Fully Applied</span>
                      <span className="text-emerald-600 font-bold">{totalAmount > 0 ? ((appliedTotal / totalAmount) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>

                  {/* Avg Credit Note Value Card */}
                  <div
                    onClick={() => setActiveCard('AVG')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      activeCard === 'AVG'
                        ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">AVG CREDIT NOTE VALUE</span>
                      <Sparkles className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {formatMoney(avgValue)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Mean return value</span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold">{creditNotes.length} Items</span>
                    </div>
                  </div>
                </div>

                {/* 2. COLLECTION EFFICIENCY & RECEIVABLE DISTRIBUTION BAR */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-slate-500">
                      <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                      Credit Allocation & Status Distribution
                    </span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Applied: {totalAmount > 0 ? ((appliedTotal / totalAmount) * 100).toFixed(1) : 0}% ({formatMoney(appliedTotal)})
                      </span>
                      <span className="flex items-center gap-1 text-rose-600 font-semibold">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Active Credit: {totalAmount > 0 ? ((activeRemainingTotal / totalAmount) * 100).toFixed(1) : 0}% ({formatMoney(activeRemainingTotal)})
                      </span>
                    </div>
                  </div>

                  <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${totalAmount > 0 ? (appliedTotal / totalAmount) * 100 : 0}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500"
                      title={`Applied: ${formatMoney(appliedTotal)}`}
                    />
                    <div
                      style={{ width: `${totalAmount > 0 ? (activeRemainingTotal / totalAmount) * 100 : 0}%` }}
                      className="bg-rose-500 h-full transition-all duration-500"
                      title={`Active Credit: ${formatMoney(activeRemainingTotal)}`}
                    />
                  </div>
                </div>

                {/* 3. SEARCH & FILTERS BAR */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Credit Note # or Customer..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium"
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

                  {/* Status Tabs */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      All ({creditNotes.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ACTIVE')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'ACTIVE'
                          ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      Active Credit ({activeCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('APPLIED')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        statusFilter === 'APPLIED'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      Applied ({appliedCount})
                    </button>
                    {draftCount > 0 && (
                      <button
                        onClick={() => setStatusFilter('DRAFT')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          statusFilter === 'DRAFT'
                            ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        Draft ({draftCount})
                      </button>
                    )}
                  </div>

                  {/* Sorting Dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                    >
                      <option value="DATE_DESC">Newest Date</option>
                      <option value="DATE_ASC">Oldest Date</option>
                      <option value="AMOUNT_DESC">Highest Amount</option>
                      <option value="AMOUNT_ASC">Lowest Amount</option>
                    </select>
                  </div>
                </div>

                {/* 4. CREDIT NOTES DATA TABLE */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-3">
                            <div className="flex items-center gap-1">
                              <span>CREDIT NOTE #</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3">
                            <div className="flex items-center gap-1">
                              <span>CUSTOMER NAME</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3">
                            <div className="flex items-center gap-1">
                              <span>DATE</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3">
                            <div className="flex items-center gap-1">
                              <span>STATUS</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3 text-right font-extrabold">
                            <div className="flex items-center justify-end gap-1">
                              <span>NET (EXCL. TAX)</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3 text-right font-extrabold">
                            <div className="flex items-center justify-end gap-1">
                              <span>TAX (VAT)</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3 text-right font-extrabold">
                            <div className="flex items-center justify-end gap-1">
                              <span>TOTAL (INCL. TAX)</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-3 text-right font-extrabold">
                            <div className="flex items-center justify-end gap-1">
                              <span>REMAINING CREDIT</span>
                              <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-center font-extrabold">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {filteredCreditNotes.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-14 text-center text-slate-400">
                              <FileMinus className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                              <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No Credit Notes Match Filter</p>
                              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or status filter.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredCreditNotes.map((cn, idx) => {
                            const netVal = cn.subTotal ?? (cn.amount / 1.2);
                            const taxVal = cn.totalTax ?? (cn.amount - netVal);
                            const remVal = cn.remainingCredit ?? cn.amountDue ?? 0;

                            return (
                              <tr
                                key={cn.id || idx}
                                onClick={() => handleOpenLevel3CN(cn)}
                                className="hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-colors cursor-pointer group"
                              >
                                {/* Credit Note Number */}
                                <td className="py-3.5 px-3">
                                  <span className="font-extrabold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                                    {cn.number}
                                  </span>
                                  {cn.reference && (
                                    <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[130px]">
                                      Ref: {cn.reference}
                                    </span>
                                  )}
                                </td>

                                {/* Customer Name */}
                                <td className="py-3.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                                  <span className="truncate max-w-[180px] block">{cn.customer}</span>
                                </td>

                                {/* Date */}
                                <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">{cn.date}</td>

                                {/* Status Badge */}
                                <td className="py-3.5 px-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${cn.statusColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                    {cn.status === 'Applied' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {cn.status === 'Active Credit' && <Clock className="h-3 w-3 mr-1" />}
                                    {cn.status}
                                  </span>
                                </td>

                                {/* Net Subtotal */}
                                <td className="py-3.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300 font-sans whitespace-nowrap">
                                  {formatMoney(netVal)}
                                </td>

                                {/* Tax Amount */}
                                <td className="py-3.5 px-3 text-right font-semibold text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                                  {formatMoney(taxVal)}
                                </td>

                                {/* Total Amount */}
                                <td className="py-3.5 px-3 text-right font-extrabold text-rose-600 dark:text-rose-400 font-sans whitespace-nowrap">
                                  {formatMoney(cn.amount)}
                                </td>

                                {/* Remaining Credit */}
                                <td className="py-3.5 px-3 text-right font-extrabold font-sans whitespace-nowrap">
                                  {remVal > 0 ? (
                                    <span className="text-rose-600 dark:text-rose-400">{formatMoney(remVal)}</span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">£0.00</span>
                                  )}
                                </td>

                                {/* Action Button */}
                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenLevel3CN(cn)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 hover:bg-rose-100 border border-rose-200/80 rounded-md transition-colors cursor-pointer shadow-3xs"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {/* SUMMARY TOTAL ROW */}
                        {filteredCreditNotes.length > 0 && (
                          <tr className="bg-slate-50/90 dark:bg-slate-800/80 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                            <td colSpan={4} className="py-3.5 px-3 text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs">
                              TOTAL CREDIT NOTES ({filteredCreditNotes.length} ITEMS)
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-xs text-slate-800 dark:text-slate-200 font-sans">
                              {formatMoney(filteredCreditNotes.reduce((acc, c) => acc + (c.subTotal ?? (c.amount / 1.2)), 0))}
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-xs text-slate-700 dark:text-slate-300 font-sans">
                              {formatMoney(filteredCreditNotes.reduce((acc, c) => acc + (c.totalTax ?? (c.amount - (c.subTotal ?? (c.amount / 1.2)))), 0))}
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-xs text-rose-600 dark:text-rose-400 font-sans">
                              {formatMoney(filteredCreditNotes.reduce((acc, c) => acc + c.amount, 0))}
                            </td>
                            <td className="py-3.5 px-3 text-right font-extrabold text-xs text-rose-600 dark:text-rose-400 font-sans">
                              {formatMoney(filteredCreditNotes.reduce((acc, c) => acc + (c.remainingCredit ?? c.amountDue ?? 0), 0))}
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

      {/* RENDER MULTI-INSTANCE LEVEL 3 FLOATING WINDOWS FOR CREDIT NOTES */}
      <XeroInvoiceViewerDrawer
        invoices={openInvoices}
        onCloseInvoice={handleCloseInvoice}
        onFocusInvoice={handleFocusInvoice}
        onUpdateInvoice={handleUpdateInvoice}
      />
    </>
  );
}
