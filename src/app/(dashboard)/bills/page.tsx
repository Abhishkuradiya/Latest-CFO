"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { resolveBrandingTheme } from '@/lib/constants/brandingThemes';
import {
  CreditCard,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  BarChart3,
  User,
  ChevronRight,
  ChevronDown,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';

// Standardized Currency Formatter with Credit Note / Negative Balance Support
const formatAmountValue = (val: number | null | undefined, currencyStr?: string | null) => {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
  if (!currencyStr) return val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = currencyStr === 'USD' ? '$' : currencyStr === 'EUR' ? '€' : '£';
  if (val < 0) {
    return `(${sym}${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return `${sym}${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

// Stripe-style Initial Avatar
const StripeAvatar = ({ name }: { name: string }) => {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('') || 'VN';

  const colors = [
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-rose-100 text-rose-700 border-rose-200'
  ];
  const colorClass = colors[name.length % colors.length];

  return (
    <div className={cn("h-7 w-7 rounded-lg border font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs", colorClass)}>
      {initials}
    </div>
  );
};

// Dynamic SVG Sparkline Component driven by real monthly metrics
const DynamicSparkline = ({ data = [], color = '#2563eb' }: { data?: number[]; color?: string }) => {
  const cleanColor = color.replace('#', '');
  const width = 160;
  const height = 36;
  const padding = 8; // Top & bottom safety padding so stroke curve never flat-clips!

  if (data.length < 2) return null;
  const pointsList = data;
  const minVal = Math.min(...pointsList);
  const maxVal = Math.max(...pointsList);
  const range = maxVal - minVal || 1;

  const coords = pointsList.map((val, idx) => {
    const x = (idx / (pointsList.length - 1)) * width;
    const norm = (val - minVal) / range;
    const y = height - padding - norm * (height - 2 * padding);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  let pathD = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
  }

  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="w-full h-9 overflow-hidden rounded-b-xl">
      <svg className="w-full h-full block" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-dyn-${cleanColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#grad-dyn-${cleanColor})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

import XeroInvoiceViewerDrawer, { OpenInvoiceData } from '@/components/sales/XeroInvoiceViewerDrawer';

export default function AccountPayableDashboard() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  // Multi-window floating Xero Invoice/Bill viewer drawer state
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  const handleOpenBillModal = (inv: any, vendorName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const invId = inv.id || inv.InvoiceID || inv.billNumber || inv.invoiceNumber || inv.invoice_number || `bill-${Date.now()}`;
    const displayRef = inv.billNumber || inv.invoiceNumber || inv.InvoiceNumber || inv.reference || inv.Reference || 'Not available';

    const count = openInvoices.length;
    const startX = Math.min(80 + count * 35, typeof window !== 'undefined' ? window.innerWidth - 750 : 100);
    const startY = Math.min(60 + count * 35, typeof window !== 'undefined' ? window.innerHeight - 650 : 100);
    const winW = Math.min(800, typeof window !== 'undefined' ? window.innerWidth - 60 : 800);
    const winH = Math.min(700, typeof window !== 'undefined' ? window.innerHeight - 80 : 700);
    const maxZ = Math.max(...openInvoices.map(i => i.zIndex || 1000), 1000);

    const grossTotal = parseFloat(inv.total ?? inv.Total ?? inv.amount ?? inv.amountDue ?? 0);
    const subTotal = inv.subTotal !== undefined ? parseFloat(inv.subTotal) : (inv.SubTotal !== undefined ? parseFloat(inv.SubTotal) : (inv.sub_total !== undefined ? parseFloat(inv.sub_total) : grossTotal));
    const totalTax = inv.totalTax !== undefined ? parseFloat(inv.totalTax) : (inv.TotalTax !== undefined ? parseFloat(inv.TotalTax) : (inv.total_tax !== undefined ? parseFloat(inv.total_tax) : Math.max(0, grossTotal - subTotal)));

    const rawLineItems = inv.lineItems || inv.LineItems || inv.line_items || [];

    setOpenInvoices(prev => {
      const existing = prev.find(i => i.id === invId || i.refNumber === displayRef);
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, zIndex: maxZ + 1 } : i);
      }

      return [
        ...prev,
        {
          id: invId,
          refNumber: displayRef,
          contactName: vendorName || inv.vendorName || inv.contactName || inv.ContactName || (inv.Contact && inv.Contact.Name) || 'Not available',
          date: inv.date || inv.DateString || inv.Date || 'Not available',
          dueDate: inv.dueDate || inv.DueDateString || inv.DueDate || inv.date || 'Not available',
          paymentDate: inv.paymentDate || inv.date,
          desc: inv.reference || inv.Reference || inv.desc || `Bill ${displayRef}`,
          amount: grossTotal,
          subTotal: subTotal,
          totalTax: totalTax,
          amountPaid: parseFloat(inv.amountPaid ?? inv.AmountPaid ?? inv.amount_paid ?? 0),
          amountDue: parseFloat(inv.amountDue ?? inv.AmountDue ?? inv.amount_due ?? 0),
          status: inv.status || inv.Status || 'AUTHORISED',
          brandingTheme: resolveBrandingTheme(inv),
          lineItems: Array.isArray(rawLineItems) && rawLineItems.length > 0 ? rawLineItems.map((item: any) => ({
            desc: item.Description || item.description || item.desc || item.ItemCode || item.itemCode || `Line item for ${displayRef}`,
            Description: item.Description || item.description || item.desc || item.ItemCode || item.itemCode || `Line item for ${displayRef}`,
            account: item.AccountCode ? `${item.AccountCode} - ${item.AccountName || 'Not available'}` : (item.accountCode ? `${item.accountCode} - Not available` : (item.account || 'Not available')),
            AccountCode: item.AccountCode || item.accountCode || item.account_code || 'Not available',
            taxRate: item.TaxType || item.taxType || item.tax_type || item.taxRate || 'Not available',
            TaxType: item.TaxType || item.taxType || item.tax_type || 'Not available',
            amountGbp: parseFloat(item.LineAmount ?? item.lineAmount ?? item.line_amount ?? item.amountGbp ?? item.UnitAmount ?? item.unitAmount ?? grossTotal),
            LineAmount: item.LineAmount ?? item.lineAmount ?? item.line_amount,
            UnitAmount: item.UnitAmount ?? item.unitAmount ?? item.unit_amount,
            Quantity: item.Quantity ?? item.quantity,
            TaxAmount: item.TaxAmount ?? item.taxAmount ?? item.tax_amount
          })) : [],
          attachments: inv.attachments || inv.Attachments || [],
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

  const handleCloseInvoice = (id: string) => setOpenInvoices(prev => prev.filter(inv => inv.id !== id));
  const handleFocusInvoice = (id: string) => setOpenInvoices(prev => {
    const maxZ = Math.max(...prev.map(i => i.zIndex || 1000), 1000);
    return prev.map(inv => inv.id === id ? { ...inv, zIndex: maxZ + 1 } : inv);
  });
  const handleUpdateInvoice = (id: string, updates: Partial<OpenInvoiceData>) => setOpenInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));

  // Filter States
  const [asOnDate, setAsOnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'overdue' | 'ageing'>('overview');
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<string>('ALL');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Table Sorting State
  const [sortCol, setSortCol] = useState<'overdue' | 'total' | 'name' | 'pct'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Interactive Vendor Expansion State
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  // Overdue Card View Switcher (Vendors vs Bills)
  const [overdueView, setOverdueView] = useState<'vendors' | 'bills'>('vendors');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Fetch API Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/account-payable?as_on_date=${asOnDate}`);
      if (!res.ok) throw new Error('Failed to fetch Account Payable data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load payables summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asOnDate]);

  const formatAmount = (val: number | null | undefined) => {
    const formatted = formatAmountValue(val, data?.meta?.currency || null);
    return formatted === 'Not available' ? 'Not\u00a0available' : formatted;
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!data?.vendorSummary) return;
    const headers = ['Vendor Name', 'Total Bills', 'Total Payables', 'Current (Not Due)', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Overdue', '% Overdue'];
    const rows = data.vendorSummary.map((v: any) => [
      `"${v.vendorName}"`,
      v.totalBills,
      v.totalPayables.toFixed(2),
      v.currentNotDue.toFixed(2),
      v.days1to30.toFixed(2),
      v.days31to60.toFixed(2),
      v.days61to90.toFixed(2),
      v.days90Plus.toFixed(2),
      (v.days1to30 + v.days31to60 + v.days61to90 + v.days90Plus).toFixed(2),
      `${v.pctOverdue}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Account_Payable_Summary_${asOnDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported as CSV');
  };

  // Filter & Sort Vendor Summary
  const vendorList = data?.vendorSummary || [];
  const filteredVendors = useMemo(() => {
    let list = vendorList.filter((v: any) => {
      const matchesSearch = v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.bills.some((b: any) => b.billNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let matchesBucket = true;
      if (selectedBucketFilter === 'current') matchesBucket = Math.abs(v.currentNotDue) > 0.001;
      else if (selectedBucketFilter === '1-30') matchesBucket = Math.abs(v.days1to30) > 0.001;
      else if (selectedBucketFilter === '31-60') matchesBucket = Math.abs(v.days31to60) > 0.001;
      else if (selectedBucketFilter === '61-90') matchesBucket = Math.abs(v.days61to90) > 0.001;
      else if (selectedBucketFilter === '90+') matchesBucket = Math.abs(v.days90Plus) > 0.001;

      let matchesRisk = true;
      if (selectedRiskFilter === 'HIGH') matchesRisk = v.pctOverdue >= 40;
      else if (selectedRiskFilter === 'CRITICAL') matchesRisk = Math.abs(v.days90Plus) > 0.001;
      else if (selectedRiskFilter === 'LOW') matchesRisk = v.pctOverdue < 15;

      return matchesSearch && matchesBucket && matchesRisk;
    });

    return [...list].sort((a: any, b: any) => {
      const aOverdue = a.days1to30 + a.days31to60 + a.days61to90 + a.days90Plus;
      const bOverdue = b.days1to30 + b.days31to60 + b.days61to90 + b.days90Plus;

      let res = 0;
      if (sortCol === 'overdue') res = bOverdue - aOverdue;
      else if (sortCol === 'total') res = b.totalPayables - a.totalPayables;
      else if (sortCol === 'name') res = a.vendorName.localeCompare(b.vendorName);
      else if (sortCol === 'pct') res = b.pctOverdue - a.pctOverdue;

      return sortDir === 'desc' ? res : -res;
    });
  }, [vendorList, searchTerm, selectedBucketFilter, selectedRiskFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredVendors.length / pageSize) || 1;
  const paginatedVendors = filteredVendors.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Bills for Overdue Tab
  const overdueBillsList = useMemo(() => {
    if (!data?.allPayableBills) return [];
    return data.allPayableBills.filter((inv: any) => inv.daysOverdue > 0).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);
  }, [data]);

  // Key KPI Figures
  const hasPayableData = data?.meta?.dataAvailable === true;
  const totalPayablesVal = hasPayableData ? (data?.summary?.totalPayables?.amount ?? null) : null;
  const currentNotDueVal = hasPayableData ? (data?.summary?.currentNotDue?.amount ?? null) : null;
  const overdueTotalVal = hasPayableData
    ? (data?.summary?.days1to30?.amount ?? 0) + (data?.summary?.days31to60?.amount ?? 0) + (data?.summary?.days61to90?.amount ?? 0) + (data?.summary?.days90Plus?.amount ?? 0)
    : null;
  const highRiskVal = hasPayableData ? (data?.summary?.days90Plus?.amount ?? null) : null;
  const overdueCountVal = hasPayableData ? (data?.summary?.overdueBills?.count ?? null) : null;

  const totalPayablesTrend = useMemo(() => {
    const s = data?.trend?.series;
    if (!hasPayableData || !s || !Array.isArray(s.current)) return [];
    return s.current.map((v: number, i: number) => 
      v + (s.days1to30[i] || 0) + (s.days31to60[i] || 0) + (s.days61to90[i] || 0) + (s.days90Plus[i] || 0)
    );
  }, [data, hasPayableData]);

  const currentNotDueTrend = useMemo(() => {
    return hasPayableData && Array.isArray(data?.trend?.series?.current) ? data.trend.series.current : [];
  }, [data, hasPayableData]);

  const overdueTotalTrend = useMemo(() => {
    const s = data?.trend?.series;
    if (!hasPayableData || !s || !Array.isArray(s.days1to30)) return [];
    return s.days1to30.map((v: number, i: number) => 
      v + (s.days31to60[i] || 0) + (s.days61to90[i] || 0) + (s.days90Plus[i] || 0)
    );
  }, [data, hasPayableData]);

  const days90PlusTrend = useMemo(() => {
    return hasPayableData && Array.isArray(data?.trend?.series?.days90Plus) ? data.trend.series.days90Plus : [];
  }, [data, hasPayableData]);

  // ECharts Options: Ageing Donut Chart
  const doughnutOption = useMemo(() => {
    if (!hasPayableData) return {};
    const dist = data?.ageingDistribution || [];
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <b>{c}</b> ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        icon: 'circle',
        textStyle: { fontSize: 11, color: '#475569', fontWeight: 600 }
      },
      color: ['#2563eb', '#eab308', '#f97316', '#ef4444', '#991b1b'],
      series: [
        {
          name: 'Ageing Distribution',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold'
            }
          },
          data: dist.map((d: any) => ({
            name: d.label,
            value: d.amount
          }))
        }
      ]
    };
  }, [data, hasPayableData]);

  // ECharts Options: Payables Trend Line Chart
  const trendLineOption = useMemo(() => {
    if (!hasPayableData) return {};
    const trend = data?.trend || { labels: [], series: { current: [], days1to30: [], days31to60: [], days61to90: [], days90Plus: [] } };
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (value: number) => formatAmount(value)
      },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { fontSize: 10, color: '#64748b' }
      },
      grid: {
        top: '10%',
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trend.labels,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (val: number) => `£${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`
        },
      },
      series: [
        {
          name: 'Current',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#2563eb' },
          data: trend.series.current
        },
        {
          name: '1-30 Days',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#eab308' },
          data: trend.series.days1to30
        },
        {
          name: '31-60 Days',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#f97316' },
          data: trend.series.days31to60
        },
        {
          name: '61-90 Days',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#ef4444' },
          data: trend.series.days61to90
        },
        {
          name: '90+ Days',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#991b1b' },
          data: trend.series.days90Plus
        }
      ]
    };
  }, [data, hasPayableData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="text-xs font-extrabold text-slate-500 tracking-wide">Syncing Account Payable Ledger...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-full pb-12 select-none font-sans text-slate-800">
      
      {/* ========================================================================= */}
      {/* EXECUTIVE SEGMENTED TAB TOOLBAR & ACTION BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/80 pb-3 mb-2">
        {/* Left: Premium Segmented Pill Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 font-bold",
              activeTab === 'overview'
                ? "bg-white text-blue-600 font-extrabold shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 font-bold",
              activeTab === 'vendors'
                ? "bg-white text-blue-600 font-extrabold shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span>Vendor Ledger</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black",
              activeTab === 'vendors' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"
            )}>
              {filteredVendors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 font-bold",
              activeTab === 'overdue'
                ? "bg-white text-red-600 font-extrabold shadow-sm border border-red-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
            <span>Overdue Bills</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white shadow-2xs">
              {overdueCountVal ?? 'Not available'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ageing')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 font-bold",
              activeTab === 'ageing'
                ? "bg-white text-blue-600 font-extrabold shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Ageing Breakdown</span>
          </button>
        </div>

        {/* Right: Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* As On Date Selector (Formatted DD/MM/YYYY) */}
          <FormattedDatePicker
            value={asOnDate}
            onChange={setAsOnDate}
            label="As On:"
          />

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-blue-600", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-extrabold hover:bg-blue-700 transition cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 PRIMARY METRIC CARDS WITH DYNAMIC SPARK LINES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Payables */}
        <div 
          onClick={() => {
            setSelectedBucketFilter('ALL');
            setSelectedRiskFilter('ALL');
            setActiveTab('vendors');
            toast.info('Showing all payables');
          }}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
            selectedBucketFilter === 'ALL' ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200/80"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">TOTAL PAYABLES</span>
              <CreditCard className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {formatAmount(totalPayablesVal)}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Click to view all payables →</span>
          </div>
          <div className="mt-2 -mx-4 -mb-4">
            <DynamicSparkline data={totalPayablesTrend} color="#10b981" />
          </div>
        </div>

        {/* Card 2: Current (Not Due) */}
        <div 
          onClick={() => {
            setSelectedBucketFilter('current');
            setActiveTab('vendors');
            toast.info('Filtered: Current Not Due');
          }}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
            selectedBucketFilter === 'current' ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-200/80"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">CURRENT (NOT DUE)</span>
              <Clock className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {formatAmount(currentNotDueVal)}
            </div>
            <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                  {data?.summary?.currentNotDue?.pct ?? 'Not available'}{data?.summary?.currentNotDue?.pct == null ? '' : '%'} (Click to drill down) →
            </span>
          </div>
          <div className="mt-2 -mx-4 -mb-4">
            <DynamicSparkline data={currentNotDueTrend} color="#2563eb" />
          </div>
        </div>

        {/* Card 3: Total Overdue */}
        <div 
          onClick={() => {
            setActiveTab('overdue');
            toast.warning('Viewing overdue bills');
          }}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
            activeTab === 'overdue' ? "border-amber-500 ring-1 ring-amber-500/20" : "border-slate-200/80"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">TOTAL OVERDUE</span>
              <AlertTriangle className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {formatAmount(overdueTotalVal)}
            </div>
            <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                  {overdueCountVal ?? 'Not available'} Bills (Click to inspect) →
            </span>
          </div>
          <div className="mt-2 -mx-4 -mb-4">
            <DynamicSparkline data={overdueTotalTrend} color="#f59e0b" />
          </div>
        </div>

        {/* Card 4: 90+ Days Overdue */}
        <div 
          onClick={() => {
            setSelectedBucketFilter('90+');
            setActiveTab('ageing');
            toast.warning('Filtered: High Risk 90+ Days Overdue');
          }}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs hover:border-red-500 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
            selectedBucketFilter === '90+' ? "border-red-500 ring-1 ring-red-500/20" : "border-slate-200/80"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">90+ DAYS OVERDUE</span>
              <ShieldAlert className="h-4 w-4 text-red-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-extrabold text-red-600 mt-1.5 tracking-tight">
              {formatAmount(highRiskVal)}
            </div>
            <span className="text-[11px] text-red-600 font-semibold mt-1 block">
                  {data?.summary?.days90Plus?.pct ?? 'Not available'}{data?.summary?.days90Plus?.pct == null ? '' : '%'} (High Risk Drill-down) →
            </span>
          </div>
          <div className="mt-2 -mx-4 -mb-4">
            <DynamicSparkline data={days90PlusTrend} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5 EXECUTIVE AGEING DRILL-DOWN FILTER CARDS */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Ageing Portfolio Filter</span>
          </div>
          {selectedBucketFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedBucketFilter('ALL')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer flex items-center gap-1 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 shadow-2xs"
            >
              <span>Showing: <strong>{selectedBucketFilter}</strong></span>
              <span className="text-blue-600 font-black ml-1">✕ Reset Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {data?.ageingDistribution?.map((item: any) => {
            const isSelected = selectedBucketFilter === item.key;
            
            let themeStyles = "bg-blue-50/40 border-blue-200/80 text-blue-900 hover:bg-blue-50 hover:border-blue-300";
            let badgeBg = "bg-blue-100 text-blue-700 border-blue-200";
            let barColor = "bg-blue-600";
            let iconDot = "bg-blue-600";

            if (item.key === '1-30') {
              themeStyles = "bg-amber-50/40 border-amber-200/80 text-amber-900 hover:bg-amber-50 hover:border-amber-300";
              badgeBg = "bg-amber-100 text-amber-800 border-amber-200";
              barColor = "bg-amber-500";
              iconDot = "bg-amber-500";
            } else if (item.key === '31-60') {
              themeStyles = "bg-orange-50/40 border-orange-200/80 text-orange-900 hover:bg-orange-50 hover:border-orange-300";
              badgeBg = "bg-orange-100 text-orange-800 border-orange-200";
              barColor = "bg-orange-500";
              iconDot = "bg-orange-500";
            } else if (item.key === '61-90') {
              themeStyles = "bg-rose-50/40 border-rose-200/80 text-rose-900 hover:bg-rose-50 hover:border-rose-300";
              badgeBg = "bg-rose-100 text-rose-800 border-rose-200";
              barColor = "bg-rose-500";
              iconDot = "bg-rose-500";
            } else if (item.key === '90+') {
              themeStyles = "bg-red-50/50 border-red-250 text-red-950 hover:bg-red-50 hover:border-red-400";
              badgeBg = "bg-red-100 text-red-800 border-red-200 font-extrabold";
              barColor = "bg-red-600";
              iconDot = "bg-red-600";
            }

            return (
              <div 
                key={item.key}
                onClick={() => {
                  setSelectedBucketFilter(isSelected ? 'ALL' : item.key);
                  setActiveTab('vendors');
                  toast.info(`Filter updated: ${item.label}`);
                }}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 shadow-2xs group select-none",
                  themeStyles,
                  isSelected
                    ? "ring-2 ring-blue-600 border-blue-600 shadow-md scale-[1.02] bg-white"
                    : ""
                )}
              >
                {/* Header: Dot + Label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs", iconDot)} />
                    <span className="text-xs font-black tracking-tight truncate">
                      {item.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-600 text-white shadow-2xs">
                      Active
                    </span>
                  )}
                </div>

                {/* Amount */}
                <div className="text-base font-black text-slate-900 tracking-tight">
                  {formatAmount(hasPayableData ? item.amount : null).split(' ')[0]}
                </div>

                {/* Bottom Row: Percentage Badge + Proportion Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className={cn("px-1.5 py-0.2 rounded border text-[9.5px]", badgeBg)}>
                        {item.pct == null ? 'Not available' : `${item.pct}% Share`}
                    </span>
                    <span className="text-slate-400 text-[9.5px]">Filter →</span>
                  </div>

                  <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                      style={{ width: `${Math.max(parseFloat(item.pct || '0'), 3)}%` }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT 1: OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* Ageing Distribution (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2">
                  <h3 className="text-sm font-extrabold text-slate-900">Ageing Distribution</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Click slice to filter</span>
                </div>
                <div className="h-[260px] w-full">
                  <ReactECharts option={doughnutOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('ageing')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer pt-2 border-t border-slate-100"
              >
                View Ageing Breakdown →
              </button>
            </div>

            {/* Payables Trend (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-extrabold text-slate-900">Payables Trend</h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Last 6 Months
                  </span>
                </div>
                
                <div className="h-[320px] w-full flex-1">
                  <ReactECharts option={trendLineOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            </div>

            {/* Top Payables Accounts & Bills Dual Card (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between h-full">
              <div className="flex flex-col h-full justify-between">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  {/* Segmented Control Header: Vendors vs Bills */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold">
                    <button
                      onClick={() => setOverdueView('vendors')}
                      className={cn(
                        "px-2.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1",
                        overdueView === 'vendors' ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <User className="h-3 w-3" />
                      <span>Top Vendors</span>
                    </button>
                    <button
                      onClick={() => setOverdueView('bills')}
                      className={cn(
                        "px-2.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1",
                        overdueView === 'bills' ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <FileText className="h-3 w-3" />
                      <span>Top Bills</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => setActiveTab(overdueView === 'bills' ? 'overdue' : 'vendors')}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                  >
                    View All <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-between space-y-1.5">
                  {overdueView === 'vendors' ? (
                    data?.topOverdueVendors?.length > 0 ? (
                      data.topOverdueVendors.map((vendor: any) => (
                        <div 
                          key={vendor.vendorName}
                          onClick={() => {
                            setExpandedVendor(vendor.vendorName);
                            setActiveTab('vendors');
                            toast.info(`Drilled down to vendor: ${vendor.vendorName}`);
                          }}
                          className="relative overflow-hidden p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 transition cursor-pointer flex items-center justify-between gap-2 group bg-white shadow-2xs"
                        >
                          {/* Full Card Embedded Translucent Progress Fill */}
                          <div 
                            className={cn(
                              "absolute left-0 top-0 bottom-0 transition-all duration-500 pointer-events-none opacity-15",
                              vendor.pctOverdue >= 80 ? "bg-red-500" : vendor.pctOverdue >= 30 ? "bg-amber-500" : "bg-emerald-500"
                            )} 
                            style={{ width: `${Math.max(vendor.pctOverdue, 0)}%` }} 
                          />

                          {/* Left Colored Accent Bar */}
                          <div 
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                              vendor.pctOverdue >= 80 ? "bg-red-500" : vendor.pctOverdue >= 30 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                          />

                          <div className="relative z-10 flex items-center gap-2 min-w-0 pl-1.5">
                            <StripeAvatar name={vendor.vendorName} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-extrabold text-slate-900 truncate">{vendor.vendorName}</div>
                              <div className="text-[9.5px] text-slate-500 truncate">
                                {vendor.totalBills} {vendor.totalBills === 1 ? 'Bill' : 'Bills'} • {vendor.overdueCount > 0 ? <span className="font-bold text-red-600">{formatAmount(vendor.overdueAmount).split(' ')[0]} Overdue</span> : <span className="font-semibold text-emerald-600">All Current</span>}
                              </div>
                            </div>
                          </div>

                          <div className="relative z-10 text-right shrink-0">
                            <div className="text-[11px] font-black text-slate-900">
                              {formatAmount(vendor.totalPayables).split(' ')[0]}
                            </div>
                            <span className={cn(
                              "text-[8.5px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5",
                              vendor.pctOverdue >= 80 ? "bg-red-50 text-red-700 border-red-200" : vendor.pctOverdue >= 30 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              {vendor.pctOverdue}% Risk
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">No top vendors</div>
                    )
                  ) : (
                    data?.topOverdueBills?.length > 0 ? (
                      data.topOverdueBills.map((inv: any) => (
                        <div 
                          key={inv.id}
                          onClick={(e) => handleOpenBillModal(inv, inv.vendorName, e)}
                          className="p-2.5 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <StripeAvatar name={inv.vendorName} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-extrabold text-blue-600 hover:underline truncate">{inv.billNumber}</div>
                              <div className="text-[9.5px] text-slate-500 truncate">{inv.vendorName}</div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-extrabold text-red-600">
                              {formatAmount(inv.amountDue).split(' ')[0]}
                            </div>
                            <span className="text-[8.5px] font-bold text-red-500 bg-red-50 px-1 py-0.2 rounded border border-red-100 inline-block mt-0.5">
                              {inv.daysOverdue} days
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">No overdue bills</div>
                    )
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Vendor Summary Overview Table (Drill-Down Container) */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Vendor Summary Overview</h3>
                <p className="text-[11px] text-slate-400 font-medium">Click any vendor row to view detailed bill logs inline</p>
              </div>

              {/* Controls: Search & Risk Matrix */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-44"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold">
                  <button
                    onClick={() => setSelectedRiskFilter('ALL')}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      selectedRiskFilter === 'ALL' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    All Risk
                  </button>
                  <button
                    onClick={() => setSelectedRiskFilter('HIGH')}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      selectedRiskFilter === 'HIGH' ? "bg-amber-500 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    High Risk
                  </button>
                  <button
                    onClick={() => setSelectedRiskFilter('CRITICAL')}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      selectedRiskFilter === 'CRITICAL' ? "bg-red-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    90+ Critical
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th 
                      onClick={() => { setSortCol('name'); setSortDir(sortCol === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}
                      className="py-2 px-3 cursor-pointer hover:text-slate-700 select-none"
                    >
                      VENDOR {sortCol === 'name' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th className="py-2 px-3 text-center">BILLS</th>
                    <th 
                      onClick={() => { setSortCol('total'); setSortDir(sortCol === 'total' && sortDir === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2 px-3 text-right cursor-pointer hover:text-slate-700 select-none"
                    >
                      TOTAL PAYABLES {sortCol === 'total' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th className="py-2 px-3 text-right">CURRENT</th>
                    <th className="py-2 px-3 text-right">1 - 30 DAYS</th>
                    <th className="py-2 px-3 text-right">31 - 60 DAYS</th>
                    <th className="py-2 px-3 text-right">61 - 90 DAYS</th>
                    <th className="py-2 px-3 text-right">90+ DAYS</th>
                    <th 
                      onClick={() => { setSortCol('overdue'); setSortDir(sortCol === 'overdue' && sortDir === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2 px-3 text-right text-red-600 cursor-pointer hover:text-red-800 select-none font-black"
                    >
                      TOTAL OVERDUE {sortCol === 'overdue' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th 
                      onClick={() => { setSortCol('pct'); setSortDir(sortCol === 'pct' && sortDir === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2 px-3 text-right cursor-pointer hover:text-slate-700 select-none"
                    >
                      % OVERDUE {sortCol === 'pct' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                  {paginatedVendors.map((vendor: any, i: number) => {
                    const totalOverdueVal = vendor.days1to30 + vendor.days31to60 + vendor.days61to90 + vendor.days90Plus;
                    const isExpanded = expandedVendor === vendor.vendorName;
                    return (
                      <React.Fragment key={i}>
                        <tr 
                          onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendorName)}
                          className={cn(
                            "hover:bg-slate-50 transition cursor-pointer",
                            isExpanded && "bg-blue-50/40"
                          )}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                            <ChevronRight className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isExpanded && "rotate-90 text-blue-600")} />
                            <StripeAvatar name={vendor.vendorName} />
                            <span className="truncate max-w-[200px]">{vendor.vendorName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-600">{vendor.totalBills}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                            {formatAmount(vendor.totalPayables).split(' ')[0]}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {Math.abs(vendor.currentNotDue) > 0.001 ? formatAmount(vendor.currentNotDue).split(' ')[0] : '—'}
                          </td>
                          <td className={cn("py-2.5 px-3 text-right font-semibold", vendor.days1to30 < 0 ? "text-emerald-600 font-bold" : "text-amber-600")}>
                            {Math.abs(vendor.days1to30) > 0.001 ? formatAmount(vendor.days1to30).split(' ')[0] : '—'}
                          </td>
                          <td className={cn("py-2.5 px-3 text-right font-semibold", vendor.days31to60 < 0 ? "text-emerald-600 font-bold" : "text-orange-600")}>
                            {Math.abs(vendor.days31to60) > 0.001 ? formatAmount(vendor.days31to60).split(' ')[0] : '—'}
                          </td>
                          <td className={cn("py-2.5 px-3 text-right font-semibold", vendor.days61to90 < 0 ? "text-emerald-600 font-bold" : "text-red-500")}>
                            {Math.abs(vendor.days61to90) > 0.001 ? formatAmount(vendor.days61to90).split(' ')[0] : '—'}
                          </td>
                          <td className={cn("py-2.5 px-3 text-right font-bold", vendor.days90Plus < 0 ? "text-emerald-600" : "text-red-700")}>
                            {Math.abs(vendor.days90Plus) > 0.001 ? formatAmount(vendor.days90Plus).split(' ')[0] : '—'}
                          </td>
                          <td className={cn("py-2.5 px-3 text-right font-black", totalOverdueVal < 0 ? "text-emerald-600" : "text-red-600")}>
                            {totalOverdueVal !== null && Math.abs(totalOverdueVal) > 0.001 ? formatAmount(totalOverdueVal).split(' ')[0] : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold border",
                              vendor.pctOverdue >= 50 ? "bg-red-50 text-red-700 border-red-200" :
                              vendor.pctOverdue >= 20 ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {vendor.pctOverdue}%
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Vendor Bill Log Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-y border-blue-100">
                            <td colSpan={10} className="p-3 pl-10">
                              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-800">
                                    Bills Log for {vendor.vendorName} ({vendor.bills?.length || 0})
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Click bill to view details</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px]">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-[9.5px] font-bold text-slate-400 uppercase">
                                        <th className="py-1.5 px-2">BILL #</th>
                                        <th className="py-1.5 px-2">BILL DATE</th>
                                        <th className="py-1.5 px-2">DUE DATE</th>
                                        <th className="py-1.5 px-2">STATUS</th>
                                        <th className="py-1.5 px-2 text-right">AMOUNT DUE</th>
                                        <th className="py-1.5 px-2 text-right">OVERDUE DAYS</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {vendor.bills?.map((b: any, bIdx: number) => (
                                        <tr key={bIdx} className="hover:bg-slate-50">
                                          <td className="py-1.5 px-2">
                                            <button
                                              onClick={(e) => handleOpenBillModal(b, vendor.vendorName, e)}
                                              className="font-extrabold text-blue-600 hover:underline cursor-pointer text-left"
                                              title="Click to view tax invoice/bill drawer modal"
                                            >
                                              {b.billNumber}
                                            </button>
                                          </td>
                                          <td className="py-1.5 px-2 text-slate-600">{formatToDDMMYYYY(b.date)}</td>
                                          <td className="py-1.5 px-2 text-slate-600">{formatToDDMMYYYY(b.dueDate)}</td>
                                          <td className="py-1.5 px-2">
                                            <span className={cn(
                                              "px-1.5 py-0.2 rounded text-[9px] font-bold border",
                                              b.daysOverdue > 0 ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200"
                                            )}>
                                              {b.status}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-right font-black text-slate-900">{formatAmount(b.amountDue).split(' ')[0]}</td>
                                          <td className="py-1.5 px-2 text-right font-bold text-red-600">
                                            {b.daysOverdue > 0 ? `${b.daysOverdue} days` : 'Current'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
              <span>Showing {paginatedVendors.length} of {filteredVendors.length} vendors</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-bold">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 2: VENDOR LEDGER TAB */}
      {/* ========================================================================= */}
      {activeTab === 'vendors' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Vendor Payables Ledger</h3>
              <p className="text-xs text-slate-400 font-medium">Consolidated view of all vendor payables and outstanding bill balances</p>
            </div>
            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              Total Vendors: {filteredVendors.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10.5px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="py-2.5 px-3">VENDOR NAME</th>
                  <th className="py-2.5 px-3 text-center">BILLS</th>
                  <th className="py-2.5 px-3 text-right">TOTAL PAYABLES</th>
                  <th className="py-2.5 px-3 text-right">CURRENT</th>
                  <th className="py-2.5 px-3 text-right">1-30 DAYS</th>
                  <th className="py-2.5 px-3 text-right">31-60 DAYS</th>
                  <th className="py-2.5 px-3 text-right">61-90 DAYS</th>
                  <th className="py-2.5 px-3 text-right">90+ DAYS</th>
                  <th className="py-2.5 px-3 text-right text-red-600">OVERDUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map((v: any, i: number) => {
                  const ov = v.days1to30 + v.days31to60 + v.days61to90 + v.days90Plus;
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                        <StripeAvatar name={v.vendorName} />
                        <span>{v.vendorName}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-600">{v.totalBills}</td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">{formatAmount(v.totalPayables).split(' ')[0]}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{v.currentNotDue > 0 ? formatAmount(v.currentNotDue).split(' ')[0] : '—'}</td>
                      <td className="py-3 px-3 text-right text-amber-600 font-semibold">{v.days1to30 > 0 ? formatAmount(v.days1to30).split(' ')[0] : '—'}</td>
                      <td className="py-3 px-3 text-right text-orange-600 font-semibold">{v.days31to60 > 0 ? formatAmount(v.days31to60).split(' ')[0] : '—'}</td>
                      <td className="py-3 px-3 text-right text-red-500 font-semibold">{v.days61to90 > 0 ? formatAmount(v.days61to90).split(' ')[0] : '—'}</td>
                      <td className="py-3 px-3 text-right text-red-700 font-bold">{v.days90Plus > 0 ? formatAmount(v.days90Plus).split(' ')[0] : '—'}</td>
                      <td className="py-3 px-3 text-right font-black text-red-600">{ov > 0 ? formatAmount(ov).split(' ')[0] : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 3: OVERDUE BILLS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Overdue Vendor Bills Log</h3>
              <p className="text-xs text-slate-400 font-medium">All unpaid vendor bills past their due date requiring payment settlement</p>
            </div>
            <span className="text-xs font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
              Overdue Count: {overdueBillsList.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10.5px] font-black text-slate-400 uppercase bg-slate-50/50">
                  <th className="py-2.5 px-3">BILL #</th>
                  <th className="py-2.5 px-3">VENDOR NAME</th>
                  <th className="py-2.5 px-3">BILL DATE</th>
                  <th className="py-2.5 px-3">DUE DATE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3 text-right">AMOUNT DUE</th>
                  <th className="py-2.5 px-3 text-right">DAYS OVERDUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdueBillsList.map((inv: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <button
                        onClick={(e) => handleOpenBillModal(inv, inv.vendorName, e)}
                        className="font-extrabold text-blue-600 hover:underline cursor-pointer text-left"
                        title="Click to view tax invoice/bill drawer modal"
                      >
                        {inv.billNumber}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{inv.vendorName}</td>
                    <td className="py-3 px-3 text-slate-600">{formatToDDMMYYYY(inv.date)}</td>
                    <td className="py-3 px-3 text-slate-600">{formatToDDMMYYYY(inv.dueDate)}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">{formatAmount(inv.amountDue).split(' ')[0]}</td>
                    <td className="py-3 px-3 text-right font-bold text-red-600">{inv.daysOverdue} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 4: AGEING BREAKDOWN TAB */}
      {/* ========================================================================= */}
      {activeTab === 'ageing' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Comprehensive Payables Ageing Analysis</h3>
            <p className="text-xs text-slate-400 font-medium">Detailed breakdown of vendor payables portfolio across 30, 60, and 90+ day ageing buckets</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">Portfolio Risk Distribution</h4>
              <div className="h-[280px]">
                <ReactECharts option={doughnutOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">Payables Ageing Summary Table</h4>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase">
                      <th className="py-2">BUCKET</th>
                      <th className="py-2 text-right">AMOUNT DUE</th>
                      <th className="py-2 text-right">% OF TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 font-semibold">
                    {data?.ageingDistribution?.map((d: any) => (
                      <tr key={d.key}>
                        <td className="py-2.5 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-slate-800">{d.label}</span>
                        </td>
                        <td className="py-2.5 text-right font-black text-slate-900">{formatAmount(d.amount).split(' ')[0]}</td>
                        <td className="py-2.5 text-right text-slate-600">{d.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-window Xero Bill & Invoice Viewer Drawer Manager */}
      <XeroInvoiceViewerDrawer
        invoices={openInvoices}
        onCloseInvoice={handleCloseInvoice}
        onFocusInvoice={handleFocusInvoice}
        onUpdateInvoice={handleUpdateInvoice}
      />

    </div>
  );
}
