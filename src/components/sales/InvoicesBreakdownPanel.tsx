"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Download, FileText, Eye, ArrowUpDown, CheckCircle2, Clock, AlertTriangle, ChevronDown, Filter, Sparkles, PieChart, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import XeroInvoiceViewerDrawer, { OpenInvoiceData } from './XeroInvoiceViewerDrawer';

export interface InvoiceItem {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate: string;
  subTotal?: number;
  totalTax?: number;
  amount: number;
  amountDue: number;
  amountPaid: number;
  status: string;
  rawStatus: string;
  statusColor: string;
  reference?: string;
  currencyCode?: string;
}

interface InvoicesBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceItem[];
  currencySymbol?: string;
  dateLabel?: string;
}

export default function InvoicesBreakdownPanel({
  isOpen,
  onClose,
  invoices = [],
  currencySymbol = '£',
  dateLabel = ''
}: InvoicesBreakdownPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'AUTHORISED' | 'OVERDUE' | 'DRAFT'>('ALL');
  const [activeCard, setActiveCard] = useState<'ALL' | 'OUTSTANDING' | 'COLLECTED' | 'AVG'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');

  // Multi-instance Level 3 Floating Windows State
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  // Clean date label for subtitle
  const formattedPeriodSub = useMemo(() => {
    if (dateLabel) {
      const cleaned = dateLabel.replace(/^(vs\s*)+/i, '');
      return `For the period ${cleaned}`;
    }
    if (invoices.length > 0) {
      const dates = invoices.map(i => i.date).filter(Boolean).sort();
      if (dates.length > 0) {
        return `For the period ${dates[0]} to ${dates[dates.length - 1]}`;
      }
    }
    return 'For the selected financial period';
  }, [dateLabel, invoices]);

  // Open Level 3 Floating Invoice Window
  const handleOpenLevel3Invoice = (inv: InvoiceItem) => {
    setOpenInvoices(prev => {
      const existing = prev.find(item => item.refNumber === inv.number || item.id.includes(inv.number));
      if (existing) {
        const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
        toast.info(`Invoice ${inv.number} brought to front!`);
        return prev.map(item => (item.refNumber === inv.number || item.id === existing.id) ? { ...item, zIndex: maxZ + 1, isMinimized: false, isHighlighted: true } : item);
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
          id: `${inv.number}-${Date.now()}`,
          refNumber: inv.number,
          contactName: inv.customer,
          date: inv.date,
          dueDate: inv.dueDate,
          desc: `${inv.customer} - ${inv.reference || 'Sales Invoice'}`,
          amount: inv.amount,
          subTotal: inv.subTotal !== undefined ? inv.subTotal : Math.round((inv.amount / 1.2) * 100) / 100,
          totalTax: inv.totalTax !== undefined ? inv.totalTax : Math.round((inv.amount - (inv.amount / 1.2)) * 100) / 100,
          amountPaid: inv.amountPaid !== undefined ? inv.amountPaid : inv.amount,
          amountDue: inv.amountDue !== undefined ? inv.amountDue : 0,
          status: inv.status || 'Authorised',
          lineItems: (inv as any).lineItems,
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
    setOpenInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const handleFocusInvoice = (id: string) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      return prev.map(inv => inv.id === id ? { ...inv, zIndex: maxZ + 1, isMinimized: false } : inv);
    });
  };

  const handleUpdateInvoice = (id: string, updates: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  const handleOpenPaymentDoc = (doc: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex), 1000);
      const winW = typeof window !== 'undefined' ? Math.min(820, window.innerWidth - 60) : 820;
      const winH = typeof window !== 'undefined' ? Math.min(520, window.innerHeight - 180) : 520;
      const offset = (prev.length % 5) * 35;
      const startX = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerWidth - winW) / 2) + offset) : 90;
      const startY = typeof window !== 'undefined' ? Math.max(30, Math.round((window.innerHeight - winH) / 2 - 30) + offset) : 50;

      return [
        ...prev,
        {
          id: doc.id || `pay-${Date.now()}`,
          refNumber: doc.refNumber || 'Receive Money',
          contactName: doc.contactName || 'Client',
          date: doc.date || '01 Apr 2026',
          dueDate: doc.dueDate || doc.date || '01 Apr 2026',
          paymentDate: doc.paymentDate || doc.date || '01 Apr 2026',
          desc: doc.desc || 'Payment Document',
          amount: doc.amount || 0,
          subTotal: doc.subTotal || doc.amount || 0,
          totalTax: 0,
          amountPaid: doc.amount || 0,
          amountDue: 0,
          status: doc.status || 'Reconciled',
          accountName: doc.accountName || '100 - Starling Business Account',
          lineItems: doc.lineItems || [],
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

  // Calculate Metrics Summary
  const summaryMetrics = useMemo(() => {
    let totalCount = invoices.length;
    let totalInvoiced = 0;
    let totalOutstanding = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let authorisedCount = 0;
    let overdueCount = 0;
    let draftCount = 0;

    invoices.forEach(inv => {
      totalInvoiced += inv.amount;
      totalOutstanding += inv.amountDue;
      totalPaid += inv.amountPaid;

      if (inv.status === 'Paid') paidCount++;
      else if (inv.status === 'Overdue') overdueCount++;
      else if (inv.status === 'Draft' || inv.status === 'Submitted') draftCount++;
      else authorisedCount++;
    });

    const paidPct = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
    const unpaidPct = totalInvoiced > 0 ? (totalOutstanding / totalInvoiced) * 100 : 0;

    return {
      totalCount,
      totalInvoiced,
      totalOutstanding,
      totalPaid,
      paidCount,
      authorisedCount,
      overdueCount,
      draftCount,
      paidPct,
      unpaidPct,
      avgInvoiceValue: totalCount > 0 ? totalInvoiced / totalCount : 0
    };
  }, [invoices]);

  // Card Click Handler - Interactive Filter Drilldown
  const handleCardClick = (cardType: 'ALL' | 'OUTSTANDING' | 'COLLECTED' | 'AVG') => {
    setActiveCard(cardType);
    if (cardType === 'ALL') {
      setStatusFilter('ALL');
      toast.success("Showing All Sales Invoices");
    } else if (cardType === 'OUTSTANDING') {
      setStatusFilter('AUTHORISED');
      toast.info("Filtered to Outstanding AR Invoices");
    } else if (cardType === 'COLLECTED') {
      setStatusFilter('PAID');
      toast.success("Filtered to Fully Paid Invoices");
    } else if (cardType === 'AVG') {
      setSortBy('AMOUNT_DESC');
      toast.info("Sorted by Highest Amount First");
    }
  };

  // Filtered & Sorted Invoices List
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Status Filter matching official Xero ACCREC statuses
      if (statusFilter === 'PAID' && inv.status !== 'Paid') return false;
      if (statusFilter === 'AUTHORISED' && (inv.status !== 'Authorised' && inv.status !== 'Unpaid' && inv.status !== 'Overdue')) return false;
      if (statusFilter === 'OVERDUE' && inv.status !== 'Overdue') return false;
      if (statusFilter === 'DRAFT' && (inv.status !== 'Draft' && inv.status !== 'Submitted')) return false;

      // Search Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNum = inv.number.toLowerCase().includes(query);
        const matchCust = inv.customer.toLowerCase().includes(query);
        const matchRef = (inv.reference || '').toLowerCase().includes(query);
        return matchNum || matchCust || matchRef;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.amount - a.amount;
      if (sortBy === 'AMOUNT_ASC') return a.amount - b.amount;
      return 0;
    });
  }, [invoices, statusFilter, searchTerm, sortBy]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      toast.error("No invoices available to export");
      return;
    }

    const headers = ["Invoice Number", "Customer Name", "Invoice Date", "Due Date", "Xero Status", "Net Amount (Excl Tax)", "Tax Amount (VAT)", "Total Amount (Incl Tax)", "Amount Due", "Amount Paid", "Reference"];
    const rows = filteredInvoices.map(inv => {
      const sub = inv.subTotal ?? (inv.amount / 1.2);
      const tax = inv.totalTax ?? (inv.amount - sub);
      return [
        `"${inv.number}"`,
        `"${inv.customer}"`,
        `"${inv.date}"`,
        `"${inv.dueDate}"`,
        `"${inv.status}"`,
        sub.toFixed(2),
        tax.toFixed(2),
        inv.amount.toFixed(2),
        inv.amountDue.toFixed(2),
        inv.amountPaid.toFixed(2),
        `"${inv.reference || ''}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sales_Invoices_Breakdown_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredInvoices.length} invoices to CSV`);
  };

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key="invoices-modal-wrapper" className="fixed inset-0 z-[150] overflow-hidden flex justify-end bg-slate-950/30 backdrop-blur-xs">
          {/* Backdrop click to close */}
          <motion.div
            key="invoices-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Slide-Over Panel Container - FULL SCREEN WIDTH WITH SMOOTH SPRING EXIT */}
          <motion.div
            key="invoices-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="relative w-screen max-w-none bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
          >
            {/* 1. AUTHENTIC CLEAN XERO HEADER BAR */}
            <div className="bg-white border-b border-slate-200/90 px-8 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-full bg-slate-100/80 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer shadow-3xs"
                  title="Close Panel"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Sales Invoices Breakdown</h1>
                    <span className="bg-cyan-50 text-cyan-700 text-xs font-bold px-3 py-0.5 rounded-full border border-cyan-200/80">
                      {summaryMetrics.totalCount} Invoices
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                    <span className="font-semibold text-slate-700">Organization</span>
                    <span>|</span>
                    <span>{formattedPeriodSub}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Close Panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* MAIN SCROLLABLE CONTENT WITH CUSTOM SLIM SCROLLBAR */}
            <div className="flex-1 overflow-y-auto custom-slim-scrollbar p-8 space-y-6 bg-slate-50/40">

              {/* 2. INTERACTIVE FILTER KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Sales Invoiced Card */}
                <div
                  onClick={() => handleCardClick('ALL')}
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all cursor-pointer group relative overflow-hidden ${
                    activeCard === 'ALL'
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                      : 'border-slate-200/90 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total Sales Invoiced</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{formatMoney(summaryMetrics.totalInvoiced)}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-medium text-slate-500">Across {summaryMetrics.totalCount} invoices</span>
                    {activeCard === 'ALL' && (
                      <span className="text-[10px] font-extrabold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-md">
                        Active View
                      </span>
                    )}
                  </div>
                </div>

                {/* Outstanding AR Card */}
                <div
                  onClick={() => handleCardClick('OUTSTANDING')}
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all cursor-pointer group relative overflow-hidden ${
                    activeCard === 'OUTSTANDING'
                      ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
                      : 'border-amber-200/90 hover:border-amber-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">Outstanding AR</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-600 tracking-tight">{formatMoney(summaryMetrics.totalOutstanding)}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-semibold text-amber-700">{summaryMetrics.authorisedCount + summaryMetrics.overdueCount} Unpaid/Overdue</span>
                    {activeCard === 'OUTSTANDING' && (
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        Click Filter
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Collected Card */}
                <div
                  onClick={() => handleCardClick('COLLECTED')}
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all cursor-pointer group relative overflow-hidden ${
                    activeCard === 'COLLECTED'
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-emerald-200/90 hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">Total Collected</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 tracking-tight">{formatMoney(summaryMetrics.totalPaid)}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-semibold text-emerald-700">{summaryMetrics.paidCount} Fully paid</span>
                    {activeCard === 'COLLECTED' && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        Click Filter
                      </span>
                    )}
                  </div>
                </div>

                {/* Avg Invoice Value Card */}
                <div
                  onClick={() => handleCardClick('AVG')}
                  className={`bg-white rounded-xl border p-4 shadow-2xs transition-all cursor-pointer group relative overflow-hidden ${
                    activeCard === 'AVG'
                      ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-50/20'
                      : 'border-slate-200/90 hover:border-cyan-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Avg Invoice Value</span>
                    <div className="h-7 w-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{formatMoney(summaryMetrics.avgInvoiceValue)}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] font-medium text-slate-500">Mean order value</span>
                    {activeCard === 'AVG' && (
                      <span className="text-[10px] font-extrabold text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded-md">
                        Sorted High
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. CFO ANALYTICS VISUAL ROW: COLLECTION PROGRESS & AR STATUS BREAKDOWN */}
              <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Collection Efficiency & Receivable Distribution</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Paid: {summaryMetrics.paidPct.toFixed(1)}% ({formatMoney(summaryMetrics.totalPaid)})
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span>
                      Unpaid: {summaryMetrics.unpaidPct.toFixed(1)}% ({formatMoney(summaryMetrics.totalOutstanding)})
                    </span>
                  </div>
                </div>

                {/* Segmented Distribution Bar */}
                <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                  <div
                    style={{ width: `${summaryMetrics.paidPct}%` }}
                    className="bg-emerald-500 h-full rounded-l-full transition-all duration-500 shadow-2xs"
                    title={`Paid: ${summaryMetrics.paidPct.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${summaryMetrics.unpaidPct}%` }}
                    className="bg-amber-500 h-full rounded-r-full transition-all duration-500 shadow-2xs"
                    title={`Unpaid: ${summaryMetrics.unpaidPct.toFixed(1)}%`}
                  />
                </div>
              </div>

              {/* 4. SEARCH & OFFICIAL XERO STATUS FILTER TOOLBAR */}
              <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search Invoice # or Customer..."
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400 font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Status Filter Pills & Sorting */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  {/* Status Pills */}
                  <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
                    <button
                      onClick={() => { setStatusFilter('ALL'); setActiveCard('ALL'); }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        statusFilter === 'ALL'
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({summaryMetrics.totalCount})
                    </button>
                    <button
                      onClick={() => { setStatusFilter('PAID'); setActiveCard('COLLECTED'); }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        statusFilter === 'PAID'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Paid ({summaryMetrics.paidCount})
                    </button>
                    <button
                      onClick={() => { setStatusFilter('AUTHORISED'); setActiveCard('OUTSTANDING'); }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        statusFilter === 'AUTHORISED'
                          ? 'bg-white text-amber-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Authorised ({summaryMetrics.authorisedCount})
                    </button>
                    <button
                      onClick={() => { setStatusFilter('OVERDUE'); setActiveCard('OUTSTANDING'); }}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        statusFilter === 'OVERDUE'
                          ? 'bg-white text-rose-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Overdue ({summaryMetrics.overdueCount})
                    </button>
                    {summaryMetrics.draftCount > 0 && (
                      <button
                        onClick={() => setStatusFilter('DRAFT')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          statusFilter === 'DRAFT'
                            ? 'bg-white text-slate-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Draft ({summaryMetrics.draftCount})
                      </button>
                    )}
                  </div>

                  {/* Sort Selector */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="DATE_DESC">Newest Date</option>
                    <option value="AMOUNT_DESC">Amount (High to Low)</option>
                    <option value="AMOUNT_ASC">Amount (Low to High)</option>
                  </select>
                </div>
              </div>

              {/* 5. AUTHENTIC PURE WHITE XERO DATA TABLE (MATCHING USER SCREENSHOT 1) */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto custom-slim-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-3 font-extrabold">
                          <div className="flex items-center gap-1">
                            <span>INVOICE #</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-3 font-extrabold">
                          <div className="flex items-center gap-1">
                            <span>CUSTOMER NAME</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-3 font-extrabold">
                          <div className="flex items-center gap-1">
                            <span>DATE</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-3 font-extrabold">
                          <div className="flex items-center gap-1">
                            <span>DUE DATE</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-3 font-extrabold">
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
                            <span>AMOUNT DUE</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </div>
                        </th>
                        <th className="py-3.5 px-3 text-center font-extrabold">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-14 text-center text-slate-400">
                            <FileText className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-slate-700 text-sm">No Invoices Match Filter</p>
                            <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or status filter.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv, idx) => {
                          const netVal = inv.subTotal ?? (inv.amount / 1.2);
                          const taxVal = inv.totalTax ?? (inv.amount - netVal);
                          return (
                            <tr
                              key={inv.id || idx}
                              onClick={() => handleOpenLevel3Invoice(inv)}
                              className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                            >
                              {/* Invoice Number - Blue Link Styling matching Xero */}
                              <td className="py-3.5 px-3">
                                <span className="font-extrabold text-blue-600 group-hover:underline flex items-center gap-1">
                                  {inv.number}
                                </span>
                                {inv.reference && (
                                  <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[130px]">
                                    Ref: {inv.reference}
                                  </span>
                                )}
                              </td>

                              {/* Customer Name */}
                              <td className="py-3.5 px-3 font-bold text-slate-800">
                                <span className="truncate max-w-[180px] block">{inv.customer}</span>
                              </td>

                              {/* Dates */}
                              <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">{inv.date}</td>
                              <td className="py-3.5 px-3 text-slate-500 font-medium whitespace-nowrap">{inv.dueDate}</td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${inv.statusColor}`}>
                                  {inv.status === 'Paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  {inv.status === 'Overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                  {(inv.status === 'Authorised' || inv.status === 'Unpaid') && <Clock className="h-3 w-3 mr-1" />}
                                  {inv.status}
                                </span>
                              </td>

                              {/* Net Subtotal */}
                              <td className="py-3.5 px-3 text-right font-bold text-slate-700 font-sans whitespace-nowrap">
                                {formatMoney(netVal)}
                              </td>

                              {/* Tax Amount */}
                              <td className="py-3.5 px-3 text-right font-semibold text-slate-500 font-sans whitespace-nowrap">
                                {formatMoney(taxVal)}
                              </td>

                              {/* Total Amount (Incl Tax) */}
                              <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 font-sans whitespace-nowrap">
                                {formatMoney(inv.amount)}
                              </td>

                              {/* Amount Due */}
                              <td className="py-3.5 px-3 text-right font-extrabold font-sans whitespace-nowrap">
                                {inv.amountDue > 0 ? (
                                  <span className={inv.status === 'Overdue' ? 'text-rose-600' : 'text-amber-600'}>
                                    {formatMoney(inv.amountDue)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">£0.00</span>
                                )}
                              </td>

                              {/* Action Button */}
                              <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleOpenLevel3Invoice(inv)}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-colors cursor-pointer shadow-3xs"
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
                      {filteredInvoices.length > 0 && (
                        <tr className="bg-slate-50/90 font-black text-slate-900 border-t-2 border-slate-200">
                          <td colSpan={5} className="py-3.5 px-3 text-slate-800 uppercase tracking-wider text-xs">
                            TOTAL SALES INVOICES ({filteredInvoices.length} ITEMS)
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-xs text-slate-800 font-sans">
                            {formatMoney(filteredInvoices.reduce((acc, i) => acc + (i.subTotal ?? (i.amount / 1.2)), 0))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-xs text-slate-700 font-sans">
                            {formatMoney(filteredInvoices.reduce((acc, i) => acc + (i.totalTax ?? (i.amount - (i.subTotal ?? (i.amount / 1.2)))), 0))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-xs text-slate-900 font-sans">
                            {formatMoney(filteredInvoices.reduce((acc, i) => acc + i.amount, 0))}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-xs text-amber-600 font-sans">
                            {formatMoney(filteredInvoices.reduce((acc, i) => acc + i.amountDue, 0))}
                          </td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* AUTHENTIC XERO FOOTER BAR */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Showing {filteredInvoices.length} of {invoices.length} entries</span>
                  <span className="font-semibold text-slate-700">Official Xero Sales Invoices Report</span>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}

      {/* 5. LEVEL 3 FLOATING INVOICE WINDOWS */}
      <XeroInvoiceViewerDrawer
        invoices={openInvoices}
        onCloseInvoice={handleCloseInvoice}
        onFocusInvoice={handleFocusInvoice}
        onUpdateInvoice={handleUpdateInvoice}
        onOpenPayment={handleOpenPaymentDoc}
      />
    </AnimatePresence>
  );
}
