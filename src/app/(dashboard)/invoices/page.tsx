"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts';
import { resolveBrandingTheme } from '@/lib/constants/brandingThemes';
import {
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  ShieldAlert,
  BarChart3,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Download,
  ArrowRight,
  Zap,
  Calculator,
  Percent,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FormattedDatePicker, formatToDDMMYYYY } from '@/components/ui/formatted-date-picker';
import XeroInvoiceViewerDrawer, { OpenInvoiceData } from '@/components/sales/XeroInvoiceViewerDrawer';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

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

// Avatar Initials Generator
function StripeAvatar({ name }: { name: string }) {
  const getInitials = (n: string) => {
    if (!n) return 'CU';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(name);
  const styles = [
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200'
  ];
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const avatarStyle = styles[charCodeSum % styles.length];

  return (
    <div className={cn("h-7 w-7 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0", avatarStyle)}>
      {initials}
    </div>
  );
}

export default function ConsistentAccountReceivablePage() {
  const [asOnDate, setAsOnDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  // Navigation & Interactive Filter States
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'overdue' | 'ageing'>('overview');
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<string>('ALL');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Customer Summary Table Sorting State
  const [sortCol, setSortCol] = useState<'overdue' | 'total' | 'name' | 'pct'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Interactive Customer Expansion State
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // Overdue Card View Switcher (Customers vs Invoices)
  const [overdueView, setOverdueView] = useState<'customers' | 'invoices'>('customers');

  // Cash Acceleration Simulator Slider (0 - 100%)
  const [targetCollectionPct, setTargetCollectionPct] = useState<number>(40);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Multi-window floating Xero Invoice viewer modal state
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceData[]>([]);

  const handleOpenInvoiceModal = (inv: any, customerName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const invId = inv.id || inv.InvoiceID || inv.invoiceNumber || inv.invoice_number || `inv-${Date.now()}`;
    const displayRef = inv.invoiceNumber || inv.InvoiceNumber || inv.reference || inv.Reference || 'INV-001';

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
          contactName: customerName || inv.contactName || inv.ContactName || (inv.Contact && inv.Contact.Name) || 'Customer',
          date: inv.date || inv.DateString || inv.Date || new Date().toISOString(),
          dueDate: inv.dueDate || inv.DueDateString || inv.DueDate || inv.date || new Date().toISOString(),
          paymentDate: inv.paymentDate || inv.date,
          desc: inv.reference || inv.Reference || inv.desc || `Invoice ${displayRef}`,
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
            account: item.AccountCode ? `${item.AccountCode} - ${item.AccountName || 'Sales'}` : (item.accountCode ? `${item.accountCode} - Sales` : (item.account || '410 Sales')),
            AccountCode: item.AccountCode || item.accountCode || item.account_code || '410',
            taxRate: item.TaxType || item.taxType || item.tax_type || item.taxRate || 'Tax on Income (20%)',
            TaxType: item.TaxType || item.taxType || item.tax_type || 'OUTPUT2',
            amountGbp: parseFloat(item.LineAmount ?? item.lineAmount ?? item.line_amount ?? item.amountGbp ?? item.UnitAmount ?? item.unitAmount ?? grossTotal),
            LineAmount: item.LineAmount ?? item.lineAmount ?? item.line_amount,
            UnitAmount: item.UnitAmount ?? item.unitAmount ?? item.unit_amount,
            Quantity: item.Quantity ?? item.quantity,
            TaxAmount: item.TaxAmount ?? item.taxAmount ?? item.tax_amount
          })) : [
            {
              desc: `Invoice ${displayRef} - ${customerName || inv.contactName || 'Customer Services'}`,
              account: '410 Sales',
              taxRate: 'Tax on Income (20%)',
              amountGbp: grossTotal
            }
          ],
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

  const handleCloseInvoice = (id: string) => {
    setOpenInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const handleFocusInvoice = (id: string) => {
    setOpenInvoices(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex || 1000), 1000);
      return prev.map(inv => inv.id === id ? { ...inv, zIndex: maxZ + 1 } : inv);
    });
  };

  const handleUpdateInvoice = (id: string, updates: Partial<OpenInvoiceData>) => {
    setOpenInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  // Fetch Live Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/account-receivable?as_on_date=${asOnDate}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      toast.error('Unable to load Account Receivable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asOnDate]);

  const currencyCode = data?.meta?.currency || null;
  const hasReceivableData = data?.meta?.dataAvailable === true;
  const formatAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
    return currencyCode
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
      : new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // ECharts Configurations
  const ageingDonutOption = useMemo(() => {
    if (!data?.ageingDistribution || !hasReceivableData) return {};
    const items = data.ageingDistribution;
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
        formatter: (params: any) => {
          const val = currencyCode
            ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(params.value)
            : new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(params.value);
          return `<div class="p-1"><div class="font-bold text-xs text-slate-300">${params.name} (Click to Filter)</div><div class="text-sm font-black text-blue-400 mt-0.5">${val} (${params.percent}%)</div></div>`;
        }
      },
      legend: { show: false },
      series: [
        {
          name: 'Ageing Distribution',
          type: 'pie',
          radius: ['62%', '84%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#ffffff', borderWidth: 2 },
          label: { show: false },
          data: items.map((item: any) => ({
            value: item.amount,
            name: item.label,
            itemStyle: { 
              color: item.color,
              opacity: selectedBucketFilter === 'ALL' || selectedBucketFilter === item.key ? 1 : 0.35 
            }
          }))
        }
      ]
    };
  }, [data, currencyCode, selectedBucketFilter]);

  // Full Height Receivables Trend ECharts Config
  const trendLineOption = useMemo(() => {
    if (!data?.trend || !hasReceivableData) return {};
    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#ffffff', fontSize: 11 },
        valueFormatter: (value: number) => formatAmount(value)
      },
      legend: {
        bottom: '2%',
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        textStyle: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
        data: ['Current', '1 - 30 Days', '31 - 60 Days', '61 - 90 Days', '90+ Days']
      },
      grid: { left: '3%', right: '3%', top: '6%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.trend.labels,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 'bold' }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 10.5, formatter: (val: number) => `£${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}` }
      },
      series: [
        { name: 'Current', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#2563eb' }, itemStyle: { color: '#2563eb' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(37, 99, 235, 0.12)' }, { offset: 1, color: 'rgba(37, 99, 235, 0.0)' }]) }, data: data.trend.series.current },
        { name: '1 - 30 Days', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#eab308' }, itemStyle: { color: '#eab308' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(234, 179, 8, 0.12)' }, { offset: 1, color: 'rgba(234, 179, 8, 0.0)' }]) }, data: data.trend.series.days1to30 },
        { name: '31 - 60 Days', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#f97316' }, itemStyle: { color: '#f97316' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(249, 115, 22, 0.12)' }, { offset: 1, color: 'rgba(249, 115, 22, 0.0)' }]) }, data: data.trend.series.days31to60 },
        { name: '61 - 90 Days', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#ef4444' }, itemStyle: { color: '#ef4444' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(239, 68, 68, 0.12)' }, { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }]) }, data: data.trend.series.days61to90 },
        { name: '90+ Days', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 2.5, color: '#991b1b' }, itemStyle: { color: '#991b1b' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(153, 27, 27, 0.12)' }, { offset: 1, color: 'rgba(153, 27, 27, 0.0)' }]) }, data: data.trend.series.days90Plus }
      ]
    };
  }, [data, hasReceivableData, currencyCode]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!data?.allReceivableInvoices) return;
    const items = data.allReceivableInvoices;
    const csvHeader = ['Invoice Number', 'Customer Name', 'Date', 'Due Date', 'Total Amount', 'Amount Due', 'Days Overdue', 'Ageing Bucket'].join(',');
    const csvRows = items.map((inv: any) => [
      `"${inv.invoiceNumber}"`,
      `"${inv.contactName}"`,
      `"${inv.date ? inv.date.split('T')[0] : ''}"`,
      `"${inv.dueDate ? inv.dueDate.split('T')[0] : ''}"`,
      inv.total,
      inv.amountDue,
      inv.daysOverdue,
      `"${inv.ageingBucket}"`
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [csvHeader, ...csvRows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Account_Receivable_Report_${asOnDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported as CSV');
  };

  // Filter & Sort Customer Summary
  const customerList = data?.customerSummary || [];
  const filteredCustomers = useMemo(() => {
    let list = customerList.filter((c: any) => {
      const matchesSearch = c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.invoices.some((inv: any) => inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let matchesBucket = true;
      if (selectedBucketFilter === 'current') matchesBucket = Math.abs(c.currentNotDue) > 0.001;
      else if (selectedBucketFilter === '1-30') matchesBucket = Math.abs(c.days1to30) > 0.001;
      else if (selectedBucketFilter === '31-60') matchesBucket = Math.abs(c.days31to60) > 0.001;
      else if (selectedBucketFilter === '61-90') matchesBucket = Math.abs(c.days61to90) > 0.001;
      else if (selectedBucketFilter === '90+') matchesBucket = Math.abs(c.days90Plus) > 0.001;

      let matchesRisk = true;
      if (selectedRiskFilter === 'HIGH') matchesRisk = c.pctOverdue >= 40;
      else if (selectedRiskFilter === 'CRITICAL') matchesRisk = Math.abs(c.days90Plus) > 0.001;
      else if (selectedRiskFilter === 'LOW') matchesRisk = c.pctOverdue < 15;

      return matchesSearch && matchesBucket && matchesRisk;
    });

    return [...list].sort((a: any, b: any) => {
      const aOverdue = a.days1to30 + a.days31to60 + a.days61to90 + a.days90Plus;
      const bOverdue = b.days1to30 + b.days31to60 + b.days61to90 + b.days90Plus;

      let res = 0;
      if (sortCol === 'overdue') res = bOverdue - aOverdue;
      else if (sortCol === 'total') res = b.totalReceivables - a.totalReceivables;
      else if (sortCol === 'name') res = a.customerName.localeCompare(b.customerName);
      else if (sortCol === 'pct') res = b.pctOverdue - a.pctOverdue;

      return sortDir === 'desc' ? res : -res;
    });
  }, [customerList, searchTerm, selectedBucketFilter, selectedRiskFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Invoices for Ageing Tab
  const ageingBucketInvoices = useMemo(() => {
    if (!data?.allReceivableInvoices) return [];
    if (selectedBucketFilter === 'ALL') return data.allReceivableInvoices;
    return data.allReceivableInvoices.filter((inv: any) => inv.ageingBucket === selectedBucketFilter);
  }, [data, selectedBucketFilter]);

  // Invoices for Overdue Tab
  const overdueInvoicesList = useMemo(() => {
    if (!data?.allReceivableInvoices) return [];
    return data.allReceivableInvoices.filter((inv: any) => inv.daysOverdue > 0).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);
  }, [data]);

  // Key KPI Figures & Dynamic Trend Series for 4 KPI Cards
  const totalReceivablesVal = hasReceivableData ? (data?.summary?.totalReceivables?.amount ?? null) : null;
  const currentNotDueVal = hasReceivableData ? (data?.summary?.currentNotDue?.amount ?? null) : null;
  const overdueTotalVal = hasReceivableData
    ? (data?.summary?.days1to30?.amount ?? 0) + (data?.summary?.days31to60?.amount ?? 0) + (data?.summary?.days61to90?.amount ?? 0) + (data?.summary?.days90Plus?.amount ?? 0)
    : null;
  const highRiskVal = hasReceivableData ? (data?.summary?.days90Plus?.amount ?? null) : null;
  const overdueCountVal = hasReceivableData ? (data?.summary?.overdueInvoices?.count ?? null) : null;

  const totalReceivablesTrend = useMemo(() => {
    const s = data?.trend?.series;
    if (!hasReceivableData || !s || !Array.isArray(s.current)) return [];
    return s.current.map((v: number, i: number) => 
      v + (s.days1to30[i] || 0) + (s.days31to60[i] || 0) + (s.days61to90[i] || 0) + (s.days90Plus[i] || 0)
    );
  }, [data, hasReceivableData]);

  const currentNotDueTrend = useMemo(() => {
    return hasReceivableData && Array.isArray(data?.trend?.series?.current) ? data.trend.series.current : [];
  }, [data, hasReceivableData]);

  const overdueTotalTrend = useMemo(() => {
    const s = data?.trend?.series;
    if (!hasReceivableData || !s || !Array.isArray(s.days1to30)) return [];
    return s.days1to30.map((v: number, i: number) => 
      v + (s.days31to60[i] || 0) + (s.days61to90[i] || 0) + (s.days90Plus[i] || 0)
    );
  }, [data, hasReceivableData]);

  const days90PlusTrend = useMemo(() => {
    return hasReceivableData && Array.isArray(data?.trend?.series?.days90Plus) ? data.trend.series.days90Plus : [];
  }, [data, hasReceivableData]);

  // Cash Acceleration Simulator Math
  const simulatedCashUnlocked = overdueTotalVal === null ? null : overdueTotalVal * (targetCollectionPct / 100);
  const simulatedRunwayBoostDays = simulatedCashUnlocked === null || !totalReceivablesVal
    ? null
    : Math.round((simulatedCashUnlocked / totalReceivablesVal) * 45);

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
            onClick={() => setActiveTab('customers')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 font-bold",
              activeTab === 'customers'
                ? "bg-white text-blue-600 font-extrabold shadow-sm border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            )}
          >
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span>Customer Ledger</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black",
              activeTab === 'customers' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"
            )}>
              {filteredCustomers.length}
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
            <span>Overdue Invoices</span>
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
      {/* 4 PRIMARY METRIC CARDS WITH DYNAMIC SPARK LINES & SHIMMER EFFECTS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[
              { label: 'TOTAL RECEIVABLES', accent: 'bg-emerald-500' },
              { label: 'CURRENT (NOT DUE)', accent: 'bg-blue-500' },
              { label: 'TOTAL OVERDUE', accent: 'bg-amber-500' },
              { label: '90+ DAYS OVERDUE', accent: 'bg-red-500' }
            ].map((sk, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3 relative overflow-hidden">
                <div className={cn("absolute top-0 left-0 right-0 h-1 opacity-70", sk.accent)} />
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 rounded-md shimmer-effect" />
                  <div className="h-4 w-4 rounded-full shimmer-effect" />
                </div>
                <div className="h-8 w-36 rounded-md shimmer-effect mt-1" />
                <div className="h-3 w-40 rounded-md shimmer-effect" />
                <div className="h-9 w-full rounded-b-xl shimmer-effect mt-2" />
                {/* Shimmer sweep line overlay */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-200/40 to-transparent animate-card-shimmer pointer-events-none" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Card 1: Total Receivables */}
            <div 
              onClick={() => {
                setSelectedBucketFilter('ALL');
                setSelectedRiskFilter('ALL');
                setActiveTab('customers');
                toast.info('Showing all receivables');
              }}
              className={cn(
                "bg-white rounded-xl border p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
                selectedBucketFilter === 'ALL' ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200/80"
              )}
            >
              {/* Animated Light Sweep Shimmer Overlay */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-emerald-100/60 to-transparent animate-card-shimmer pointer-events-none" />

              <div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">TOTAL RECEIVABLES</span>
                  <CreditCard className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                  {formatAmount(totalReceivablesVal)}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Click to view all receivables →</span>
              </div>
              <div className="mt-2 -mx-4 -mb-4">
                <DynamicSparkline data={totalReceivablesTrend} color="#10b981" />
              </div>
            </div>

            {/* Card 2: Current (Not Due) */}
            <div 
              onClick={() => {
                setSelectedBucketFilter('current');
                setActiveTab('customers');
                toast.info('Filtered: Current (Not Due) Receivables');
              }}
              className={cn(
                "bg-white rounded-xl border p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
                selectedBucketFilter === 'current' ? "border-blue-500 ring-1 ring-blue-500/20" : "border-slate-200/80"
              )}
            >
              {/* Animated Light Sweep Shimmer Overlay */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-blue-100/60 to-transparent animate-card-shimmer pointer-events-none" />

              <div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">CURRENT (NOT DUE)</span>
                  <Calendar className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                  {formatAmount(currentNotDueVal)}
                </div>
                <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                  {data?.summary?.currentNotDue?.pct ?? 'Not available'}{data?.summary?.currentNotDue?.pct === null || data?.summary?.currentNotDue?.pct === undefined ? '' : '%'} (Click to drill down) →
                </span>
              </div>
              <div className="mt-2 -mx-4 -mb-4">
                <DynamicSparkline data={currentNotDueTrend} color="#2563eb" />
              </div>
            </div>

            {/* Card 3: Overdue Balance */}
            <div 
              onClick={() => {
                setSelectedBucketFilter('ALL');
                setActiveTab('overdue');
                toast.info('Filtered: All Overdue Invoices');
              }}
              className={cn(
                "bg-white rounded-xl border p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between group overflow-hidden relative",
                activeTab === 'overdue' ? "border-amber-500 ring-1 ring-amber-500/20" : "border-slate-200/80"
              )}
            >
              {/* Animated Light Sweep Shimmer Overlay */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-100/60 to-transparent animate-card-shimmer pointer-events-none" />

              <div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">TOTAL OVERDUE</span>
                  <Clock className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                  {formatAmount(overdueTotalVal)}
                </div>
                <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                  {overdueCountVal ?? 'Not available'} Invoices (Click to inspect) →
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
              {/* Animated Light Sweep Shimmer Overlay */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-rose-100/60 to-transparent animate-card-shimmer pointer-events-none" />

              <div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">90+ DAYS OVERDUE</span>
                  <ShieldAlert className="h-4 w-4 text-red-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-extrabold text-red-600 mt-1.5 tracking-tight">
                  {formatAmount(highRiskVal)}
                </div>
                <span className="text-[11px] text-red-600 font-semibold mt-1 block">
                  {data?.summary?.days90Plus?.pct ?? 'Not available'}{data?.summary?.days90Plus?.pct === null || data?.summary?.days90Plus?.pct === undefined ? '' : '%'} (High Risk Drill-down) →
                </span>
              </div>
              <div className="mt-2 -mx-4 -mb-4">
                <DynamicSparkline data={days90PlusTrend} color="#ef4444" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5 EXECUTIVE AGEING DRILL-DOWN FILTER CARDS WITH SHIMMER */}
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
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-2.5 shadow-2xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-20 rounded-md shimmer-effect" />
                    <div className="h-2.5 w-2.5 rounded-full shimmer-effect" />
                  </div>
                  <div className="h-5 w-24 rounded-md shimmer-effect" />
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-14 rounded-md shimmer-effect" />
                      <div className="h-2 w-8 rounded-md shimmer-effect" />
                    </div>
                    <div className="h-1.5 w-full rounded-full shimmer-effect" />
                  </div>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-200/40 to-transparent animate-card-shimmer pointer-events-none" />
                </div>
              ))}
            </>
          ) : (
            data?.ageingDistribution?.map((item: any) => {
              const isSelected = selectedBucketFilter === item.key;
              
              // Tailored theme styling per bucket
              let themeStyles = "bg-blue-50/40 border-blue-200/80 text-blue-900 hover:bg-blue-50 hover:border-blue-300";
              let badgeBg = "bg-blue-100 text-blue-700 border-blue-200";
              let barColor = "bg-blue-600";
              let iconDot = "bg-blue-600";
              let shimmerSweep = "via-blue-200/40";

              if (item.key === '1-30') {
                themeStyles = "bg-amber-50/40 border-amber-200/80 text-amber-900 hover:bg-amber-50 hover:border-amber-300";
                badgeBg = "bg-amber-100 text-amber-800 border-amber-200";
                barColor = "bg-amber-500";
                iconDot = "bg-amber-500";
                shimmerSweep = "via-amber-200/40";
              } else if (item.key === '31-60') {
                themeStyles = "bg-orange-50/40 border-orange-200/80 text-orange-900 hover:bg-orange-50 hover:border-orange-300";
                badgeBg = "bg-orange-100 text-orange-800 border-orange-200";
                barColor = "bg-orange-500";
                iconDot = "bg-orange-500";
                shimmerSweep = "via-orange-200/40";
              } else if (item.key === '61-90') {
                themeStyles = "bg-rose-50/40 border-rose-200/80 text-rose-900 hover:bg-rose-50 hover:border-rose-300";
                badgeBg = "bg-rose-100 text-rose-800 border-rose-200";
                barColor = "bg-rose-500";
                iconDot = "bg-rose-500";
                shimmerSweep = "via-rose-200/40";
              } else if (item.key === '90+') {
                themeStyles = "bg-red-50/50 border-red-250 text-red-950 hover:bg-red-50 hover:border-red-400";
                badgeBg = "bg-red-100 text-red-800 border-red-200 font-extrabold";
                barColor = "bg-red-600";
                iconDot = "bg-red-600";
                shimmerSweep = "via-red-200/40";
              }

              return (
                <div 
                  key={item.key}
                  onClick={() => {
                    setSelectedBucketFilter(isSelected ? 'ALL' : item.key);
                    setActiveTab('customers');
                    toast.info(`Filter updated: ${item.label}`);
                  }}
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 shadow-2xs group select-none relative overflow-hidden",
                    themeStyles,
                    isSelected
                      ? "ring-2 ring-blue-600 border-blue-600 shadow-md scale-[1.02] bg-white"
                      : ""
                  )}
                >
                  {/* Animated Light Sweep Shimmer Overlay */}
                  <div className={cn("absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent animate-card-shimmer pointer-events-none", shimmerSweep)} />

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
                    {formatAmount(item.amount).split(' ')[0]}
                  </div>

                  {/* Bottom Row: Percentage Badge + Proportion Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className={cn("px-1.5 py-0.2 rounded border text-[9.5px]", badgeBg)}>
                        {item.pct}% Share
                      </span>
                      <span className="text-slate-400 text-[9.5px]">Filter →</span>
                    </div>

                    <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden relative">
                      <div 
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${Math.max(parseFloat(item.pct || '0'), 3)}%` }} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENT 1: OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Donut Distribution (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-slate-900">Ageing Distribution</h3>
                  <span className="text-[10px] font-bold text-slate-400">Click slice to filter</span>
                </div>
                
                <div className="relative h-48 w-full flex items-center justify-center">
                  <ReactECharts 
                    option={ageingDonutOption} 
                    style={{ height: '100%', width: '100%' }}
                    onEvents={{
                      click: (params: any) => {
                        const found = data?.ageingDistribution?.find((x: any) => x.label === params.name);
                        if (found) {
                          setSelectedBucketFilter(found.key);
                          setActiveTab('customers');
                          toast.info(`Drilling down into ${found.label}`);
                        }
                      }
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-extrabold text-slate-900">
                      {formatAmount(totalReceivablesVal).split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase">Total Receivables</span>
                  </div>
                </div>

                {/* Ageing List */}
                <div className="space-y-1 mt-2 text-[11.5px]">
                  {data?.ageingDistribution?.map((item: any) => (
                    <div 
                      key={item.key}
                      onClick={() => {
                        setSelectedBucketFilter(item.key);
                        setActiveTab('customers');
                      }}
                      className={cn(
                        "flex items-center justify-between py-1 px-2 rounded-lg transition cursor-pointer",
                        selectedBucketFilter === item.key ? "bg-blue-50 font-bold" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-700">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{formatAmount(item.amount).split(' ')[0]}</span>
                        <span className="text-slate-400 font-semibold text-[10px]">({item.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setActiveTab('ageing')}
                className="mt-3 text-[11.5px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 border-t border-slate-100 pt-2.5 cursor-pointer"
              >
                <span>View Ageing Breakdown</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Receivables Trend (5 cols) - FULL EXPANDED GRAPH */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-extrabold text-slate-900">Receivables Trend</h3>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Last 6 Months
                  </span>
                </div>
                
                <div className="h-[320px] w-full flex-1">
                  <ReactECharts option={trendLineOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            </div>

            {/* Top Overdue Accounts & Invoices Dual Card (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between h-full">
              <div className="flex flex-col h-full justify-between">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  {/* Segmented Control Header: Customers vs Invoices */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold">
                    <button
                      onClick={() => setOverdueView('customers')}
                      className={cn(
                        "px-2.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1",
                        overdueView === 'customers' ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <User className="h-3 w-3" />
                      <span>Top Customers</span>
                    </button>
                    <button
                      onClick={() => setOverdueView('invoices')}
                      className={cn(
                        "px-2.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1",
                        overdueView === 'invoices' ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      <FileText className="h-3 w-3" />
                      <span>Top Invoices</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => setActiveTab(overdueView === 'invoices' ? 'overdue' : 'customers')}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                  >
                    View All <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-between space-y-1.5">
                  {overdueView === 'customers' ? (
                    data?.topOverdueCustomers?.length > 0 ? (
                      data.topOverdueCustomers.map((cust: any) => (
                        <div 
                          key={cust.customerName}
                          onClick={() => {
                            setExpandedCustomer(cust.customerName);
                            setActiveTab('customers');
                            toast.info(`Drilled down to customer: ${cust.customerName}`);
                          }}
                          className="relative overflow-hidden p-2.5 rounded-lg border border-slate-200/80 hover:border-slate-300 transition cursor-pointer flex items-center justify-between gap-2 group bg-white shadow-2xs"
                        >
                          {/* Full Card Embedded Translucent Progress Fill */}
                          <div 
                            className={cn(
                              "absolute left-0 top-0 bottom-0 transition-all duration-500 pointer-events-none opacity-15",
                              cust.pctOverdue >= 80 ? "bg-red-500" : cust.pctOverdue >= 30 ? "bg-amber-500" : "bg-emerald-500"
                            )} 
                            style={{ width: `${Math.max(cust.pctOverdue, 0)}%` }} 
                          />

                          {/* Left Colored Accent Bar */}
                          <div 
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                              cust.pctOverdue >= 80 ? "bg-red-500" : cust.pctOverdue >= 30 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                          />

                          <div className="relative z-10 flex items-center gap-2 min-w-0 pl-1.5">
                            <StripeAvatar name={cust.customerName} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-extrabold text-slate-900 truncate">{cust.customerName}</div>
                              <div className="text-[9.5px] text-slate-500 truncate">
                                {cust.totalInvoices} {cust.totalInvoices === 1 ? 'Invoice' : 'Invoices'} • {cust.overdueCount > 0 ? <span className="font-bold text-red-600">{formatAmount(cust.overdueAmount).split(' ')[0]} Overdue</span> : <span className="font-semibold text-emerald-600">All Current</span>}
                              </div>
                            </div>
                          </div>

                          <div className="relative z-10 text-right shrink-0">
                            <div className="text-[11px] font-black text-slate-900">
                              {formatAmount(cust.totalReceivables).split(' ')[0]}
                            </div>
                            <span className={cn(
                              "text-[8.5px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5",
                              cust.pctOverdue >= 80 ? "bg-red-50 text-red-700 border-red-200" : cust.pctOverdue >= 30 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              {cust.pctOverdue}% Risk
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">No top customers</div>
                    )
                  ) : (
                    data?.topOverdueInvoices?.length > 0 ? (
                      data.topOverdueInvoices.map((inv: any) => (
                        <div 
                          key={inv.id}
                          onClick={() => {
                            setExpandedCustomer(inv.contactName);
                            setActiveTab('customers');
                            toast.info(`Drilled down to customer: ${inv.contactName}`);
                          }}
                          className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <StripeAvatar name={inv.contactName} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-slate-900 truncate">{inv.invoiceNumber}</div>
                              <div className="text-[9.5px] text-slate-500 truncate">{inv.contactName}</div>
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
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">No overdue invoices</div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Overview Table Preview */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Customer Summary Overview</h3>
              <button 
                onClick={() => setActiveTab('customers')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                View All Customers <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th 
                      onClick={() => { setSortCol('name'); setSortDir(sortCol === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}
                      className="py-2 px-3 cursor-pointer hover:text-slate-700 select-none"
                    >
                      CUSTOMER {sortCol === 'name' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                    <th className="py-2 px-3 text-center">INVOICES</th>
                    <th 
                      onClick={() => { setSortCol('total'); setSortDir(sortCol === 'total' && sortDir === 'desc' ? 'asc' : 'desc'); }}
                      className="py-2 px-3 text-right cursor-pointer hover:text-slate-700 select-none"
                    >
                      TOTAL RECEIVABLES {sortCol === 'total' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
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
                  {paginatedCustomers.map((cust: any, i: number) => {
                    const totalOverdueVal = cust.days1to30 + cust.days31to60 + cust.days61to90 + cust.days90Plus;
                    return (
                      <tr 
                        key={i} 
                        onClick={() => {
                          setExpandedCustomer(cust.customerName);
                          setActiveTab('customers');
                        }}
                        className="hover:bg-slate-50 transition cursor-pointer"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <StripeAvatar name={cust.customerName} />
                            <span className="font-bold text-blue-600 hover:underline">{cust.customerName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{cust.totalInvoices}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{formatAmount(cust.totalReceivables).split(' ')[0]}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">{cust.currentNotDue > 0 ? formatAmount(cust.currentNotDue).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-600">{cust.days1to30 > 0 ? formatAmount(cust.days1to30).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-orange-600">{cust.days31to60 > 0 ? formatAmount(cust.days31to60).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-600">{cust.days61to90 > 0 ? formatAmount(cust.days61to90).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-red-700">{cust.days90Plus > 0 ? formatAmount(cust.days90Plus).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-red-600">
                          {totalOverdueVal > 0 ? formatAmount(totalOverdueVal).split(' ')[0] : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{cust.pctOverdue}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 2: CUSTOMER SUMMARY TAB */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Customer Receivables Ledger</h3>
              <p className="text-xs text-slate-500 font-medium">Click on any row to open interactive financial drill-down &amp; collection triggers.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-[10.5px] font-bold">
                <button 
                  onClick={() => setSelectedRiskFilter('ALL')}
                  className={cn("px-2 py-0.5 rounded cursor-pointer", selectedRiskFilter === 'ALL' ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600")}
                >
                  All Risk
                </button>
                <button 
                  onClick={() => setSelectedRiskFilter('HIGH')}
                  className={cn("px-2 py-0.5 rounded cursor-pointer", selectedRiskFilter === 'HIGH' ? "bg-amber-500 text-white shadow-2xs font-extrabold" : "text-amber-700")}
                >
                  High Risk
                </button>
                <button 
                  onClick={() => setSelectedRiskFilter('CRITICAL')}
                  className={cn("px-2 py-0.5 rounded cursor-pointer", selectedRiskFilter === 'CRITICAL' ? "bg-red-600 text-white shadow-2xs font-extrabold" : "text-red-700")}
                >
                  90+ Critical
                </button>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2 px-3">CUSTOMER</th>
                  <th className="py-2 px-3 text-center">INVOICES</th>
                  <th className="py-2 px-3 text-right">TOTAL RECEIVABLES</th>
                  <th className="py-2 px-3 text-right">CURRENT</th>
                  <th className="py-2 px-3 text-right">1 - 30 DAYS</th>
                  <th className="py-2 px-3 text-right">31 - 60 DAYS</th>
                  <th className="py-2 px-3 text-right">61 - 90 DAYS</th>
                  <th className="py-2 px-3 text-right">90+ DAYS</th>
                  <th className="py-2 px-3 text-center">OVERDUE</th>
                  <th className="py-2 px-3 text-right">% OVERDUE</th>
                  <th className="py-2 px-3 text-center">DRILL DOWN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {paginatedCustomers.map((cust: any, i: number) => {
                  const isExpanded = expandedCustomer === cust.customerName;
                  return (
                    <React.Fragment key={i}>
                      <tr 
                        onClick={() => setExpandedCustomer(isExpanded ? null : cust.customerName)}
                        className={cn("hover:bg-slate-50 transition cursor-pointer", isExpanded && "bg-blue-50/40")}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <StripeAvatar name={cust.customerName} />
                            <span className="font-bold text-slate-900">{cust.customerName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{cust.totalInvoices}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">{formatAmount(cust.totalReceivables).split(' ')[0]}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-600">{Math.abs(cust.currentNotDue) > 0.001 ? formatAmount(cust.currentNotDue).split(' ')[0] : '—'}</td>
                        <td className={cn("py-2.5 px-3 text-right font-medium", cust.days1to30 < 0 ? "text-emerald-600 font-bold" : "text-amber-600")}>{Math.abs(cust.days1to30) > 0.001 ? formatAmount(cust.days1to30).split(' ')[0] : '—'}</td>
                        <td className={cn("py-2.5 px-3 text-right font-medium", cust.days31to60 < 0 ? "text-emerald-600 font-bold" : "text-orange-600")}>{Math.abs(cust.days31to60) > 0.001 ? formatAmount(cust.days31to60).split(' ')[0] : '—'}</td>
                        <td className={cn("py-2.5 px-3 text-right font-medium", cust.days61to90 < 0 ? "text-emerald-600 font-bold" : "text-rose-600")}>{Math.abs(cust.days61to90) > 0.001 ? formatAmount(cust.days61to90).split(' ')[0] : '—'}</td>
                        <td className={cn("py-2.5 px-3 text-right font-extrabold", cust.days90Plus < 0 ? "text-emerald-600 font-bold" : "text-red-700")}>{Math.abs(cust.days90Plus) > 0.001 ? formatAmount(cust.days90Plus).split(' ')[0] : '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            cust.overdueCount > 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-100 text-slate-500"
                          )}>
                            {cust.overdueCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{cust.pctOverdue}%</td>
                        <td className="py-2.5 px-3 text-center">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-blue-600 inline" /> : <ChevronDown className="h-4 w-4 text-slate-400 inline" />}
                        </td>
                      </tr>

                      {/* INLINE EXPANDED CUSTOMER CARD */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={11} className="p-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <StripeAvatar name={cust.customerName} />
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-900">{cust.customerName} Ledger Breakdown</h4>
                                    <span className="text-[10.5px] font-semibold text-slate-500">
                                      Total Exposure: {formatAmount(cust.totalReceivables)} • {cust.totalInvoices} Invoices
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="divide-y divide-slate-100 text-xs border border-slate-100 rounded-lg overflow-hidden">
                                  {cust.invoices?.map((inv: any) => (
                                    <div key={inv.id} className="p-2.5 bg-white hover:bg-slate-50/80 transition flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={(e) => handleOpenInvoiceModal(inv, cust.customerName, e)}
                                          className="font-extrabold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                          title="Click to view tax invoice modal"
                                        >
                                          {inv.invoiceNumber}
                                        </button>
                                        <span className="text-slate-500">Date: {inv.date ? formatToDDMMYYYY(inv.date) : '—'}</span>
                                        <span className="text-slate-500">Due: {inv.dueDate ? formatToDDMMYYYY(inv.dueDate) : '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className={cn(
                                          "px-2 py-0.5 text-[9.5px] font-bold rounded",
                                          inv.daysOverdue > 0 ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600"
                                        )}>
                                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : 'Current'}
                                        </span>
                                        <span className="font-black text-slate-900">{formatAmount(inv.amountDue)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
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

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs font-medium text-slate-500">
            <div>
              Showing {paginatedCustomers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredCustomers.length)} of {filteredCustomers.length} accounts
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-bold text-slate-800">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB CONTENT 3: OVERDUE INVOICES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overdue' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">All Overdue Invoices</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Total Overdue: <span className="text-red-600 font-bold">{formatAmount(overdueTotalVal)}</span> across {overdueInvoicesList.length} invoices.</p>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Export Overdue List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2 px-3">INVOICE #</th>
                  <th className="py-2 px-3">CUSTOMER</th>
                  <th className="py-2 px-3">DUE DATE</th>
                  <th className="py-2 px-3 text-right">TOTAL AMOUNT</th>
                  <th className="py-2 px-3 text-right">AMOUNT DUE</th>
                  <th className="py-2 px-3 text-center">DAYS OVERDUE</th>
                  <th className="py-2 px-3 text-center">AGEING BUCKET</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {overdueInvoicesList.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3">
                      <button
                        onClick={(e) => handleOpenInvoiceModal(inv, inv.contactName, e)}
                        className="font-extrabold text-blue-600 hover:underline cursor-pointer text-left"
                        title="Click to view tax invoice modal"
                      >
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{inv.contactName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{inv.dueDate ? formatToDDMMYYYY(inv.dueDate) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">{formatAmount(inv.total)}</td>
                    <td className="py-2.5 px-3 text-right font-black text-red-600">{formatAmount(inv.amountDue)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 font-bold rounded text-[10px] border border-red-100">
                        {inv.daysOverdue} days
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 uppercase">{inv.ageingBucket}</td>
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
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Ageing Bucket Analysis</h3>
              <p className="text-xs text-slate-500 font-medium">Filter receivables by specific ageing buckets.</p>
            </div>

            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
              {['ALL', 'current', '1-30', '31-60', '61-90', '90+'].map(b => (
                <button
                  key={b}
                  onClick={() => setSelectedBucketFilter(b)}
                  className={cn(
                    "px-2.5 py-0.5 rounded text-xs font-bold uppercase transition cursor-pointer",
                    selectedBucketFilter === b ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2 px-3">INVOICE #</th>
                  <th className="py-2 px-3">CUSTOMER</th>
                  <th className="py-2 px-3">DATE</th>
                  <th className="py-2 px-3">DUE DATE</th>
                  <th className="py-2 px-3 text-right">TOTAL</th>
                  <th className="py-2 px-3 text-right">AMOUNT DUE</th>
                  <th className="py-2 px-3 text-center">OVERDUE DAYS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px]">
                {ageingBucketInvoices.length > 0 ? (
                  ageingBucketInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3">
                        <button
                          onClick={(e) => handleOpenInvoiceModal(inv, inv.contactName, e)}
                          className="font-extrabold text-blue-600 hover:underline cursor-pointer text-left"
                          title="Click to view tax invoice modal"
                        >
                          {inv.invoiceNumber}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{inv.contactName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inv.date ? formatToDDMMYYYY(inv.date) : '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{inv.dueDate ? formatToDDMMYYYY(inv.dueDate) : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">{formatAmount(inv.total)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatAmount(inv.amountDue)}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{inv.daysOverdue} days</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">No invoices in {selectedBucketFilter} ageing bucket</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Multi-window Xero Invoice Viewer Modal Manager */}
      <XeroInvoiceViewerDrawer
        invoices={openInvoices}
        onCloseInvoice={handleCloseInvoice}
        onFocusInvoice={handleFocusInvoice}
        onUpdateInvoice={handleUpdateInvoice}
      />

    </div>
  );
}
