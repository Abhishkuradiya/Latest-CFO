"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Download, Clock, AlertTriangle, CheckCircle2, FileText, ArrowUpDown, Filter, Eye, ShieldAlert, TrendingUp, Users, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import XeroInvoiceViewerDrawer, { OpenInvoiceData } from './XeroInvoiceViewerDrawer';

export interface ARInvoiceItem {
  id: string;
  number: string;
  customer: string;
  date: string;
  dueDate: string;
  overdueDays: number;
  amount: number;
  amountDue: number;
  amountPaid: number;
  status: string;
  agingBucket: 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS';
  statusColor: string;
  reference?: string;
  currencyCode?: string;
  subTotal?: number;
  totalTax?: number;
  lineItems?: any[];
}

interface AccountReceivableBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  invoices?: ARInvoiceItem[];
  totalAR?: number;
  currentDso?: number;
  currencySymbol?: string;
  dateLabel?: string;
}

export default function AccountReceivableBreakdownPanel({
  isOpen,
  onClose,
  invoices = [],
  totalAR = 0,
  currentDso = 42,
  currencySymbol = '£',
  dateLabel = ''
}: AccountReceivableBreakdownPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState<'ALL' | 'CURRENT' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS'>('ALL');
  const [sortBy, setSortBy] = useState<'OVERDUE_DESC' | 'AMOUNT_DESC' | 'DATE_DESC'>('OVERDUE_DESC');

  // Multi-instance Level 3 Floating Windows State
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  // Clean date label for subtitle
  const formattedPeriodSub = useMemo(() => {
    if (!dateLabel) return 'As on 30 September 2026';
    const cleaned = dateLabel.replace(/^(vs\s*)+/i, '');
    return `As on ${cleaned}`;
  }, [dateLabel]);

  // Open Level 3 Floating Invoice Window
  const handleOpenLevel3Invoice = (inv: ARInvoiceItem) => {
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
          desc: `${inv.customer} - ${inv.reference || 'Accounts Receivable Invoice'}`,
          amount: inv.amount,
          subTotal: inv.subTotal !== undefined ? inv.subTotal : Math.round((inv.amount / 1.2) * 100) / 100,
          totalTax: inv.totalTax !== undefined ? inv.totalTax : Math.round((inv.amount - (inv.amount / 1.2)) * 100) / 100,
          amountPaid: inv.amountPaid !== undefined ? inv.amountPaid : 0,
          amountDue: inv.amountDue !== undefined ? inv.amountDue : inv.amount,
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

  // Generate Default Dynamic Invoices if list is empty
  const arInvoicesList: ARInvoiceItem[] = useMemo(() => {
    if (invoices && invoices.length > 0) return invoices;

    return [
      { id: "inv-1", number: "INV-GO-2026-00095", customer: "Clarity Pharma", date: "04 Sep 2026", dueDate: "11 Sep 2026", overdueDays: 75, amount: 28260.00, amountDue: 28260.00, amountPaid: 0, status: "Overdue", agingBucket: "DAYS_61_90", statusColor: "bg-rose-50 text-rose-700 border-rose-200", reference: "PHARMA-AUG-01" },
      { id: "inv-2", number: "INV-GO-2026-00096", customer: "Laxmico Ltd", date: "04 Sep 2026", dueDate: "11 Sep 2026", overdueDays: 68, amount: 14850.00, amountDue: 14850.00, amountPaid: 0, status: "Overdue", agingBucket: "DAYS_61_90", statusColor: "bg-rose-50 text-rose-700 border-rose-200", reference: "LAX-INV-99" },
      { id: "inv-3", number: "INV-0150", customer: "Groupon UK", date: "31 Aug 2026", dueDate: "31 Aug 2026", overdueDays: 45, amount: 3267.50, amountDue: 3267.50, amountPaid: 0, status: "Overdue", agingBucket: "DAYS_31_60", statusColor: "bg-amber-50 text-amber-700 border-amber-200", reference: "GRP-OCT-12" },
      { id: "inv-4", number: "INV-GO-2026-00091", customer: "LAWTON PHARMACY CONSULTANTS", date: "28 Aug 2026", dueDate: "04 Sep 2026", overdueDays: 92, amount: 948.00, amountDue: 948.00, amountPaid: 0, status: "Overdue", agingBucket: "DAYS_90_PLUS", statusColor: "bg-rose-50 text-rose-700 border-rose-200", reference: "LPT-0091" },
      { id: "inv-5", number: "INV-GO-2026-00092", customer: "LV Global Ltd", date: "28 Aug 2026", dueDate: "04 Sep 2026", overdueDays: 95, amount: 1005.60, amountDue: 1005.60, amountPaid: 0, status: "Overdue", agingBucket: "DAYS_90_PLUS", statusColor: "bg-rose-50 text-rose-700 border-rose-200", reference: "LVG-2608" },
      { id: "inv-6", number: "INV-GO-2026-00093", customer: "Clarity Pharma", date: "28 Aug 2026", dueDate: "04 Sep 2026", overdueDays: 14, amount: 5580.00, amountDue: 5580.00, amountPaid: 0, status: "Authorised", agingBucket: "CURRENT", statusColor: "bg-blue-50 text-blue-700 border-blue-200", reference: "PHARMA-AUG-02" },
      { id: "inv-7", number: "INV-GO-2026-00088", customer: "Med Supply Ltd", date: "15 Aug 2026", dueDate: "22 Aug 2026", overdueDays: 12, amount: 18600.00, amountDue: 18600.00, amountPaid: 0, status: "Authorised", agingBucket: "CURRENT", statusColor: "bg-blue-50 text-blue-700 border-blue-200", reference: "MED-9921" },
      { id: "inv-8", number: "INV-GO-2026-00085", customer: "Berkeley Care LTD", date: "10 Aug 2026", dueDate: "17 Aug 2026", overdueDays: 28, amount: 11250.00, amountDue: 11250.00, amountPaid: 0, status: "Authorised", agingBucket: "CURRENT", statusColor: "bg-blue-50 text-blue-700 border-blue-200", reference: "BERK-care" }
    ];
  }, [invoices]);

  // Aging Summary Calculation
  const agingMetrics = useMemo(() => {
    let currentVal = 0;
    let days31_60Val = 0;
    let days61_90Val = 0;
    let days90PlusVal = 0;
    let sumTotalAR = 0;

    arInvoicesList.forEach(inv => {
      sumTotalAR += inv.amountDue;
      if (inv.overdueDays > 90 || inv.agingBucket === 'DAYS_90_PLUS') days90PlusVal += inv.amountDue;
      else if (inv.overdueDays > 60 || inv.agingBucket === 'DAYS_61_90') days61_90Val += inv.amountDue;
      else if (inv.overdueDays > 30 || inv.agingBucket === 'DAYS_31_60') days31_60Val += inv.amountDue;
      else currentVal += inv.amountDue;
    });

    const calcTotal = sumTotalAR || totalAR || 1;
    return {
      totalAR: calcTotal,
      currentVal,
      currentPct: (currentVal / calcTotal) * 100,
      days31_60Val,
      days31_60Pct: (days31_60Val / calcTotal) * 100,
      days61_90Val,
      days61_90Pct: (days61_90Val / calcTotal) * 100,
      days90PlusVal,
      days90PlusPct: (days90PlusVal / calcTotal) * 100,
      overdueRiskVal: days61_90Val + days90PlusVal
    };
  }, [arInvoicesList, totalAR]);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return arInvoicesList.filter(inv => {
      if (agingFilter === 'CURRENT' && inv.overdueDays > 30) return false;
      if (agingFilter === 'DAYS_31_60' && (inv.overdueDays <= 30 || inv.overdueDays > 60)) return false;
      if (agingFilter === 'DAYS_61_90' && (inv.overdueDays <= 60 || inv.overdueDays > 90)) return false;
      if (agingFilter === 'DAYS_90_PLUS' && inv.overdueDays <= 90) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return inv.number.toLowerCase().includes(query) || inv.customer.toLowerCase().includes(query) || (inv.reference || '').toLowerCase().includes(query);
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'OVERDUE_DESC') return b.overdueDays - a.overdueDays;
      if (sortBy === 'AMOUNT_DESC') return b.amountDue - a.amountDue;
      return 0;
    });
  }, [arInvoicesList, agingFilter, searchTerm, sortBy]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      toast.error("No receivable invoices available to export");
      return;
    }

    const headers = ["Invoice Number", "Customer Name", "Invoice Date", "Due Date", "Days Overdue", "Amount Due", "Status", "Reference"];
    const rows = filteredInvoices.map(inv => [
      `"${inv.number}"`,
      `"${inv.customer}"`,
      `"${inv.date}"`,
      `"${inv.dueDate}"`,
      inv.overdueDays,
      inv.amountDue.toFixed(2),
      `"${inv.status}"`,
      `"${inv.reference || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Accounts_Receivable_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredInvoices.length} receivable entries to CSV`);
  };

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div key="ar-modal-wrapper" className="fixed inset-0 z-[150] overflow-hidden flex justify-end bg-slate-950/30 backdrop-blur-xs">
          {/* Backdrop click to close */}
          <motion.div
            key="ar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Slide-Over Panel Container - FULL SCREEN WIDTH WITH SMOOTH SPRING EXIT */}
          <motion.div
            key="ar-drawer"
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
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">Accounts Receivable & Aging Intelligence</h1>
                    <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-0.5 rounded-full border border-indigo-200/80">
                      CFO Debtor Ledger
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

            {/* MAIN SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto custom-slim-scrollbar p-8 space-y-6 bg-slate-50/40">

              {/* 2. TOP EXECUTIVE AR SUMMARY METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Outstanding AR */}
                <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider">Total Accounts Receivable</span>
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-indigo-900 tracking-tight">{formatMoney(agingMetrics.totalAR)}</div>
                  <div className="text-[11px] font-medium text-indigo-700/80 mt-1">
                    Across {arInvoicesList.length} outstanding customer invoices
                  </div>
                </div>

                {/* Days Sales Outstanding (DSO) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">DSO (Collection Speed)</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">{currentDso} Days</div>
                  <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                    Target: 30 Days (8.4 days collection gap)
                  </div>
                </div>

                {/* Overdue Risk AR (60+ Days) */}
                <div className="bg-white rounded-xl border border-rose-200 bg-gradient-to-b from-rose-50/20 to-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">Critical Overdue (60+ Days)</span>
                    <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-rose-700 tracking-tight">{formatMoney(agingMetrics.overdueRiskVal)}</div>
                  <div className="text-[11px] font-semibold text-rose-800 mt-1">
                    Requires immediate collection intervention
                  </div>
                </div>

                {/* Current AR (Within Terms) */}
                <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">Current AR (0 - 30 Days)</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 tracking-tight">{formatMoney(agingMetrics.currentVal)}</div>
                  <div className="text-[11px] font-semibold text-emerald-800 mt-1">
                    {agingMetrics.currentPct.toFixed(1)}% within standard payment terms
                  </div>
                </div>
              </div>

              {/* 3. INTERACTIVE VISUAL RECEIVABLE AGING SCHEDULE MATRIX */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Receivable Aging Buckets & Risk Proportions</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Click any bucket card to filter table below</span>
                </div>

                {/* Multi-Segment Aging Progress Bar */}
                <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                  <div
                    style={{ width: `${agingMetrics.currentPct}%` }}
                    className="bg-blue-500 h-full rounded-l-full transition-all duration-500 shadow-2xs"
                    title={`Current: ${formatMoney(agingMetrics.currentVal)}`}
                  />
                  <div
                    style={{ width: `${agingMetrics.days31_60Pct}%` }}
                    className="bg-amber-500 h-full transition-all duration-500 shadow-2xs"
                    title={`31-60 Days: ${formatMoney(agingMetrics.days31_60Val)}`}
                  />
                  <div
                    style={{ width: `${agingMetrics.days61_90Pct}%` }}
                    className="bg-orange-500 h-full transition-all duration-500 shadow-2xs"
                    title={`61-90 Days: ${formatMoney(agingMetrics.days61_90Val)}`}
                  />
                  <div
                    style={{ width: `${agingMetrics.days90PlusPct}%` }}
                    className="bg-rose-600 h-full rounded-r-full transition-all duration-500 shadow-2xs"
                    title={`90+ Days: ${formatMoney(agingMetrics.days90PlusVal)}`}
                  />
                </div>

                {/* Interactive Aging Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  {/* Current (0-30 Days) */}
                  <div
                    onClick={() => { setAgingFilter('CURRENT'); toast.info("Filtered to Current 0-30 Days AR"); }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      agingFilter === 'CURRENT' ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20' : 'bg-slate-50/60 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-blue-700">
                      <span>Current (0-30 Days)</span>
                      <span className="bg-blue-100 px-2 py-0.5 rounded text-[10px]">{agingMetrics.currentPct.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(agingMetrics.currentVal)}</div>
                  </div>

                  {/* 31 - 60 Days */}
                  <div
                    onClick={() => { setAgingFilter('DAYS_31_60'); toast.info("Filtered to 31-60 Days Overdue AR"); }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      agingFilter === 'DAYS_31_60' ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20' : 'bg-slate-50/60 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-amber-700">
                      <span>31 - 60 Days</span>
                      <span className="bg-amber-100 px-2 py-0.5 rounded text-[10px]">{agingMetrics.days31_60Pct.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(agingMetrics.days31_60Val)}</div>
                  </div>

                  {/* 61 - 90 Days */}
                  <div
                    onClick={() => { setAgingFilter('DAYS_61_90'); toast.info("Filtered to 61-90 Days Overdue AR"); }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      agingFilter === 'DAYS_61_90' ? 'bg-orange-50/70 border-orange-500 ring-2 ring-orange-500/20' : 'bg-slate-50/60 border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-orange-700">
                      <span>61 - 90 Days</span>
                      <span className="bg-orange-100 px-2 py-0.5 rounded text-[10px]">{agingMetrics.days61_90Pct.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(agingMetrics.days61_90Val)}</div>
                  </div>

                  {/* 90+ Days (Critical) */}
                  <div
                    onClick={() => { setAgingFilter('DAYS_90_PLUS'); toast.info("Filtered to 90+ Days Critical Overdue AR"); }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      agingFilter === 'DAYS_90_PLUS' ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20' : 'bg-slate-50/60 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                      <span>90+ Days (Bad Debt Risk)</span>
                      <span className="bg-rose-100 px-2 py-0.5 rounded text-[10px]">{agingMetrics.days90PlusPct.toFixed(1)}%</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-1">{formatMoney(agingMetrics.days90PlusVal)}</div>
                  </div>
                </div>
              </div>

              {/* 4. SEARCH & AGING TOOLBAR */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Customer or Invoice #..."
                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder:text-slate-400 font-medium"
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

                {/* Aging Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
                    <button
                      onClick={() => setAgingFilter('ALL')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        agingFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All AR ({arInvoicesList.length})
                    </button>
                    <button
                      onClick={() => setAgingFilter('CURRENT')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        agingFilter === 'CURRENT' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Current (0-30)
                    </button>
                    <button
                      onClick={() => setAgingFilter('DAYS_31_60')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        agingFilter === 'DAYS_31_60' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      31-60 Days
                    </button>
                    <button
                      onClick={() => setAgingFilter('DAYS_61_90')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        agingFilter === 'DAYS_61_90' ? 'bg-white text-orange-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      61-90 Days
                    </button>
                    <button
                      onClick={() => setAgingFilter('DAYS_90_PLUS')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        agingFilter === 'DAYS_90_PLUS' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      90+ Days
                    </button>
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="OVERDUE_DESC">Most Overdue First</option>
                    <option value="AMOUNT_DESC">Highest Balance First</option>
                  </select>
                </div>
              </div>

              {/* 5. AUTHENTIC XERO RECEIVABLES TABLE */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto custom-slim-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4 font-extrabold">INVOICE #</th>
                        <th className="py-3.5 px-4 font-extrabold">CUSTOMER NAME</th>
                        <th className="py-3.5 px-4 font-extrabold">DATE</th>
                        <th className="py-3.5 px-4 font-extrabold">DUE DATE</th>
                        <th className="py-3.5 px-4 font-extrabold">DAYS OVERDUE</th>
                        <th className="py-3.5 px-4 text-right font-extrabold">AMOUNT DUE</th>
                        <th className="py-3.5 px-4 font-extrabold">STATUS</th>
                        <th className="py-3.5 px-4 text-center font-extrabold">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-14 text-center text-slate-400">
                            <FileText className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                            <p className="font-bold text-slate-700 text-sm">No Receivables Match Filter</p>
                            <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or aging bucket selection.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.map((inv, idx) => (
                          <tr
                            key={inv.id || idx}
                            onClick={() => handleOpenLevel3Invoice(inv)}
                            className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                          >
                            {/* Invoice Number */}
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-blue-600 group-hover:underline flex items-center gap-1">
                                {inv.number}
                              </span>
                              {inv.reference && (
                                <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[130px]">
                                  Ref: {inv.reference}
                                </span>
                              )}
                            </td>

                            {/* Customer */}
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              <span className="truncate max-w-[210px] block">{inv.customer}</span>
                            </td>

                            {/* Dates */}
                            <td className="py-3.5 px-4 text-slate-600 font-medium">{inv.date}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-medium">{inv.dueDate}</td>

                            {/* Overdue Days */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                                inv.overdueDays > 60 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                inv.overdueDays > 30 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {inv.overdueDays > 0 ? `${inv.overdueDays} Days` : 'On Time'}
                              </span>
                            </td>

                            {/* Amount Due */}
                            <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                              {formatMoney(inv.amountDue)}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${inv.statusColor}`}>
                                {inv.status}
                              </span>
                            </td>

                            {/* Action Button */}
                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenLevel3Invoice(inv)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-md transition-colors cursor-pointer shadow-3xs"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}

                      {/* SUMMARY TOTAL ROW */}
                      {filteredInvoices.length > 0 && (
                        <tr className="bg-slate-50/90 font-black text-slate-900 border-t-2 border-slate-200">
                          <td colSpan={5} className="py-3.5 px-4 text-slate-800 uppercase tracking-wider text-xs">
                            TOTAL OUTSTANDING RECEIVABLES ({filteredInvoices.length} ITEMS)
                          </td>
                          <td className="py-3.5 px-4 text-right font-extrabold text-sm text-indigo-700">
                            {formatMoney(filteredInvoices.reduce((acc, i) => acc + i.amountDue, 0))}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER BAR */}
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Showing {filteredInvoices.length} of {arInvoicesList.length} receivables</span>
                  <span className="font-semibold text-slate-700">Official Xero Accounts Receivable Schedule</span>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}

      {/* 6. LEVEL 3 FLOATING INVOICE WINDOWS */}
      <XeroInvoiceViewerDrawer
        invoices={openInvoices}
        onCloseInvoice={handleCloseInvoice}
        onFocusInvoice={handleFocusInvoice}
        onUpdateInvoice={handleUpdateInvoice}
      />
    </AnimatePresence>
  );
}
