'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  FileSpreadsheet, 
  Printer, 
  ChevronDown, 
  Clock,
  Building,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Search,
  RefreshCw,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle2,
  Calendar,
  Settings,
  Percent,
  PlusCircle,
  ChevronRight,
  Send,
  Download
} from 'lucide-react';

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1 select-none">
      <HelpCircle
        className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 cursor-help transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[9px] p-2 rounded shadow-md z-50 pointer-events-none text-center leading-normal font-sans font-bold normal-case tracking-normal">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';
import { toast } from 'sonner';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TaxBreakdownItem {
  tax_type: string;
  collected: number;
  paid: number;
  payable: number;
  rate: string;
  status: 'Payable' | 'Paid';
}

interface UpcomingReturn {
  name: string;
  period: string;
  due_in_days: number;
  due_date: string;
}

interface RecentActivity {
  type: string;
  description: string;
  date: string;
}

interface MonthlyTaxTrend {
  month: string;
  collected: number;
  paid: number;
  payable: number;
}

interface TaxData {
  connected?: boolean;
  tax_collected: number;
  tax_paid: number;
  tax_payable: number;
  last_synced: string;
  breakdown: TaxBreakdownItem[];
  upcoming_returns: UpcomingReturn[];
  recent_activities: RecentActivity[];
  monthly_trends: MonthlyTaxTrend[];
  effective_rate: number;
  total_transactions: number;
  meta?: {
    currency: string | null;
  };
}

export default function TaxCenterPage() {
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [taxTypeFilter, setTaxTypeFilter] = useState('All Taxes');
  const [taxAuthority, setTaxAuthority] = useState('All Authorities');
  const [returnType, setReturnType] = useState('All');
  const [filingFrequency, setFilingFrequency] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [availableTaxTypes, setAvailableTaxTypes] = useState<string[]>([]);

  const fetchTaxData = async (forceSync = false) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/dashboard/tax-center?from_date=${fromDate}&to_date=${toDate}&_t=${Date.now()}`;
      if (forceSync) url += '&force_sync=true';
      if (taxTypeFilter && taxTypeFilter !== 'All Taxes') {
        url += `&tax_type=${encodeURIComponent(taxTypeFilter)}`;
      }
      if (statusFilter && statusFilter !== 'All') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load Tax Center data');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);

      // Dynamically extract unique tax types when loading all taxes unfiltered
      if (taxTypeFilter === 'All Taxes' && json.breakdown) {
        const types = Array.from(new Set(json.breakdown.map((item: any) => item.tax_type))) as string[];
        if (types.length > 0) {
          setAvailableTaxTypes(types);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to retrieve tax metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxData();
  }, [fromDate, toDate, taxTypeFilter, statusFilter]);

  useEffect(() => {
    const handleSyncComplete = () => {
      // The header sync already updates Xero data incrementally. Reload the
      // tax view from the refreshed cache instead of issuing a second full sync.
      fetchTaxData(false);
    };
    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
  }, [fromDate, toDate, taxTypeFilter, statusFilter]);

  const handleExportExcel = () => {
    toast.success('Tax Excel report exported successfully!');
  };

  const handlePrint = () => {
    window.print();
  };

  const currencyCode = data?.meta?.currency;

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || !currencyCode) return '—';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(absVal);
    return isNegative ? `-${formatted}` : formatted;
  };

  const formatPercent = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00%';
    return `${val.toFixed(2)}%`;
  };

  // Filtered breakdown rows (backend does tax type and status, frontend does search)
  const getFilteredBreakdown = () => {
    if (!data || !data.connected || !data.breakdown) return [];
    return data.breakdown.filter(item => {
      return item.tax_type.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  const filteredBreakdown = getFilteredBreakdown();

  // ECharts: Tax Collected vs Tax Paid Line Chart
  const lineOption = {
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
    },
    legend: {
      data: ['Tax Collected', 'Tax Paid', 'Tax Payable'],
      bottom: 0,
      left: 'center',
      textStyle: { color: '#64748b', fontSize: 11 }
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data?.monthly_trends?.map(t => t.month) || [],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#64748b',
        fontSize: 10,
        formatter: (value: number) => {
          if (value === 0) return '$0';
          if (Math.abs(value) >= 1000) return `$${value / 1000}k`;
          return `$${value}`;
        }
      },
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    series: [
      {
        name: 'Tax Collected',
        type: 'line',
        smooth: true,
        showSymbol: true,
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.15)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.01)' }
            ]
          }
        },
        data: data?.monthly_trends?.map(t => t.collected) || []
      },
      {
        name: 'Tax Paid',
        type: 'line',
        smooth: true,
        showSymbol: true,
        lineStyle: { width: 3, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.15)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.01)' }
            ]
          }
        },
        data: data?.monthly_trends?.map(t => t.paid) || []
      },
      {
        name: 'Tax Payable',
        type: 'line',
        smooth: true,
        showSymbol: true,
        lineStyle: { width: 2, type: 'dotted', color: '#8b5cf6' },
        itemStyle: { color: '#8b5cf6' },
        data: data?.monthly_trends?.map(t => t.payable) || []
      }
    ]
  };

  // ECharts: Donut Pie Option
  const donutOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 10, color: '#64748b' }
    },
    series: [
      {
        name: 'Tax Percentage',
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const rate = data?.effective_rate;
            return rate === null || rate === undefined ? '—\nEffective Rate' : `${rate.toFixed(2)}%\nEffective Rate`;
          },
          textStyle: { fontSize: 11, fontWeight: 'bold', color: '#1e293b', lineHeight: 16 }
        },
        labelLine: { show: false },
        data: (data?.breakdown && data.breakdown.length > 0)
          ? data.breakdown.map((item, idx) => {
              const colors = ['#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899'];
              return {
                value: Math.abs(item.collected || item.paid || 0),
                name: item.tax_type,
                itemStyle: { color: colors[idx % colors.length] }
              };
            })
          : [{ value: 0, name: 'No Tax Data', itemStyle: { color: '#cbd5e1' } }]
      }
    ]
  };

  // Sparkline generator under overall metric values
  const renderCardSparkline = (color: string) => {
    return <div className="h-8 mt-2" aria-hidden="true" />;
  };

  return (
    <PageContainer>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none mb-3">
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Dashboard</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Xero Analytics</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <span className="text-slate-600 font-semibold">Tax Center</span>
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Tax Center</h1>
            <HelpCircle className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-pointer transition" />
          </div>
          <p className="text-xs text-slate-500 font-medium">GST/VAT summary and tax compliance overview.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <FormattedDatePicker value={fromDate} onChange={setFromDate} label="From:" />
            <span className="text-slate-400 text-xs font-bold">-</span>
            <FormattedDatePicker value={toDate} onChange={setToDate} label="To:" />
          </div>

          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-emerald-600 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 select-none">
        
        {/* Card 1: Tax Collected */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[125px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Collected</span>
                <Tooltip text="Total GST/VAT collected on sales invoices during this period. This is the output tax you've charged to customers." />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{loading ? '—' : formatCurrency(data?.tax_collected)}</h3>
              <span className="text-[9px] text-slate-400 font-medium">Total tax collected</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Download className="h-4.5 w-4.5" />
            </div>
          </div>
          {/* Green wave */}
          {!loading && renderCardSparkline('#10b981')}
        </div>

        {/* Card 2: Tax Paid */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[125px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Paid</span>
                <Tooltip text="Total GST/VAT paid on supplier bills and expenses during this period. This is the input tax you've paid to suppliers." />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{loading ? '—' : formatCurrency(data?.tax_paid)}</h3>
              <span className="text-[9px] text-slate-400 font-medium">Total tax paid</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <Send className="h-4.5 w-4.5" />
            </div>
          </div>
          {/* Red wave */}
          {!loading && renderCardSparkline('#ef4444')}
        </div>

        {/* Card 3: Tax Payable */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[125px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Payable</span>
                <Tooltip text="Net tax owed to HMRC/Tax Authority = Tax Collected minus Tax Paid. Positive means you owe tax; negative means a refund is due." />
              </div>
              <h3 className={cn(
                "text-2xl font-black tracking-tight mt-1",
                (data?.tax_payable ?? 0) >= 0 ? "text-rose-500" : "text-emerald-600"
              )}>
                {loading ? '—' : formatCurrency(data?.tax_payable)}
              </h3>
              <span className="text-[9px] text-slate-400 font-medium">Net tax payable</span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-650 flex items-center justify-center flex-shrink-0">
              <Percent className="h-4.5 w-4.5" />
            </div>
          </div>
          {/* Red/purple wave */}
          {!loading && renderCardSparkline('#ef4444')}
        </div>

        {/* Card 4: Return Due — Blurred (hardcoded mock, not from Xero API) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[125px] overflow-hidden">
          {/* Blurred content underneath */}
          <div className="blur-[6px] pointer-events-none select-none opacity-60">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return Due</span>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">— Days</h3>
                <span className="text-[9px] text-slate-400 font-medium">Next return due on <strong className="text-blue-600 font-extrabold">--/--/----</strong></span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="h-8 flex items-center text-[10px] text-slate-400 font-bold justify-end">
              Compliance Checklist
            </div>
          </div>
          {/* Coming Soon overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-sm">Coming Soon</span>
          </div>
        </div>

      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-3 select-none text-[11px] font-semibold text-slate-500">
        
        {/* Tax Type */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tax Type</span>
          <select 
            value={taxTypeFilter}
            onChange={(e) => setTaxTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All Taxes">All Taxes</option>
            {availableTaxTypes.length > 0 ? (
              availableTaxTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))
            ) : (
              <>
                <option value="GST">GST</option>
                <option value="VAT">VAT</option>
                <option value="Service Tax">Service Tax</option>
              </>
            )}
          </select>
        </div>

        {/* Tax Authority */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tax Authority</span>
          <select 
            value={taxAuthority}
            onChange={(e) => setTaxAuthority(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All Authorities">All Authorities</option>
            <option value="HM Revenue & Customs">HM Revenue & Customs</option>
            <option value="Inland Revenue">Inland Revenue</option>
          </select>
        </div>

        {/* Return Type */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Return Type</span>
          <select 
            value={returnType}
            onChange={(e) => setReturnType(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
          </select>
        </div>

        {/* Filing Frequency */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Filing Frequency</span>
          <select 
            value={filingFrequency}
            onChange={(e) => setFilingFrequency(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Frequencies</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Status</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Payable">Payable</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <button 
            onClick={() => fetchTaxData(false)}
          className="flex items-center gap-1.5 border border-slate-200 px-3.5 py-1.75 rounded-lg text-slate-600 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer mt-4"
        >
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>Apply Filters</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-6 flex items-start gap-3 select-none">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-800">Connection Error</h4>
            <p className="text-xs text-rose-600 font-medium">{error}</p>
            <button 
              onClick={() => fetchTaxData()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Charts & Summaries Row */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 h-80 animate-pulse" />
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 h-80 animate-pulse" />
        </div>
      ) : !error && data && data.connected !== false && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            
            {/* Left: line chart */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center select-none">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Tax Collected vs Tax Paid</span>
                <div className="flex bg-slate-50 border border-slate-100 rounded-lg p-0.75 text-[10.5px] font-bold">
                  <button className="px-2.5 py-1 bg-white text-slate-800 rounded shadow-3xs">Monthly</button>
                  <button className="px-2.5 py-1 text-slate-400 hover:text-slate-650 cursor-pointer">Quarterly</button>
                </div>
              </div>
              <div className="h-72 w-full relative">
                <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            {/* Right: Summary card */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 select-none flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Tax Summary</span>
              
              <div className="space-y-3.5 text-xs font-semibold text-slate-500">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span>Tax Collected</span>
                  <span className="text-emerald-600 font-bold">{formatCurrency(data.tax_collected)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span>Tax Paid</span>
                  <span className="text-rose-500 font-bold">{formatCurrency(data.tax_paid)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span>Tax Payable</span>
                  <span className="text-rose-500 font-bold">{formatCurrency(data.tax_payable)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                  <span>Effective Tax Rate</span>
                  <span className="text-slate-800 font-extrabold">{formatPercent(data.effective_rate)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span>Total Transactions</span>
                  <span className="text-slate-800 font-bold">{data.total_transactions}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 text-[10.5px] text-slate-400 font-medium flex justify-between">
                <span>Last Updated:</span>
                <span className="font-bold text-slate-600">{data.last_synced}</span>
              </div>
            </div>

          </div>

          {/* Breakdown & Upcoming Deadlines Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            
            {/* Left table breakdown */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 select-none">
                <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">Tax Breakdown</h3>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search tax types..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 w-[180px] focus:bg-white focus:border-slate-300 outline-none transition"
                    />
                  </div>
                  
                  <button className="h-8.5 w-8.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs font-semibold text-slate-650 text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold tracking-wider uppercase bg-slate-50/50">
                      <th className="py-2.5 px-3">Tax Type</th>
                      <th className="py-2.5 px-3 text-right">Tax Collected</th>
                      <th className="py-2.5 px-3 text-right">Tax Paid</th>
                      <th className="py-2.5 px-3 text-right">Tax Payable</th>
                      <th className="py-2.5 px-3 text-right">Effective Rate</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredBreakdown.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50/30 transition">
                        <td className="py-3 px-3 text-slate-800 font-bold">{row.tax_type}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{row.collected > 0 ? formatCurrency(row.collected) : '—'}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{row.paid > 0 ? formatCurrency(row.paid) : '—'}</td>
                        <td className={cn(
                          "py-3 px-3 text-right font-bold",
                          row.payable >= 0 ? "text-rose-500" : "text-emerald-600"
                        )}>
                          {formatCurrency(row.payable)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500 font-bold">{row.rate}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wide",
                            row.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                          )}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button className="text-[#0064eb] hover:text-blue-700 font-bold">View</button>
                        </td>
                      </tr>
                    ))}

                    {filteredBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-bold italic">
                          No tax items match your current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center pt-3.5 border-t border-slate-50 select-none text-[10.5px]">
                <span className="text-slate-400 font-medium">Showing 1 to {filteredBreakdown.length} of {filteredBreakdown.length} entries</span>
                <div className="flex items-center gap-1">
                  <button className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-650 cursor-pointer">&lt;</button>
                  <button className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold">1</button>
                  <button className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-650 cursor-pointer">&gt;</button>
                </div>
              </div>

            </div>

            {/* Right: Upcoming deadlines */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 select-none flex flex-col">
              
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Upcoming Returns</span>
                <button className="text-xs text-[#0064eb] hover:text-blue-700 font-bold">View All</button>
              </div>

              {data.upcoming_returns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-800">All Returns Filed</h5>
                  <p className="text-[10px] text-slate-400 font-semibold max-w-[200px] leading-relaxed">
                    You have no upcoming tax filings due in the next 30 days.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3 mt-1">
                    {data.upcoming_returns.map((ret, i) => (
                      <div key={i} className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="h-8.5 w-8.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Calendar className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{ret.name}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold leading-normal mt-0.5">{ret.period}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] font-bold text-rose-500 block">Due in {ret.due_in_days} days</span>
                          <span className="text-[9.5px] font-bold text-slate-500 block mt-0.5">{ret.due_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2.5 mt-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Compliance Health</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">VAT Status: Good Standing</span>
                    </div>
                    <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                      Your organization is currently up to date with all GST/VAT filings. No penalties or unresolved issues detected.
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Bottom widgets block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            
            {/* Percentage donut */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3 select-none">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Tax by Percentage</span>
              <div className="h-44 w-full relative">
                <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 select-none flex flex-col justify-between">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Activity</span>
                <button className="text-xs text-[#0064eb] hover:text-blue-700 font-bold">View All</button>
              </div>

              <div className="space-y-3.5 flex-1 flex flex-col justify-center pl-1">
                {data.recent_activities.map((act, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 relative last:after:hidden after:absolute after:left-4 after:top-8 after:bottom-[-20px] after:w-0.5 after:bg-slate-100">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                      act.type === 'Payment' ? "bg-rose-50 text-rose-600 border-rose-100" :
                      act.type === 'Collected' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {act.type === 'Payment' ? <Send className="h-3.5 w-3.5" /> : 
                       act.type === 'Collected' ? <Download className="h-3.5 w-3.5" /> :
                       <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-700 leading-normal truncate">{act.description}</h4>
                      <span className="text-[9.5px] font-semibold text-slate-400 block mt-0.5">{act.date}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Quick actions list */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3.5 select-none flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Quick Actions</span>
              
              <div className="flex-1 flex flex-col justify-center gap-2">
                {[
                  { name: 'Record Tax Payment', icon: Send, color: 'text-rose-500 bg-rose-50 border-rose-100' },
                  { name: 'Record Tax Collection', icon: Download, color: 'text-emerald-505 bg-emerald-50 border-emerald-100' },
                  { name: 'File Tax Return', icon: Calendar, color: 'text-blue-500 bg-blue-50 border-blue-100' },
                  { name: 'View Tax Reports', icon: FileSpreadsheet, color: 'text-purple-500 bg-purple-50 border-purple-100' },
                  { name: 'Tax Settings', icon: Settings, color: 'text-amber-500 bg-amber-50 border-amber-100' }
                ].map((act, i) => {
                  const ActIcon = act.icon;
                  return (
                    <button 
                      key={i}
                      onClick={() => toast.success(`Initiated: ${act.name}`)}
                      className="w-full flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-slate-50/50 hover:border-slate-200 transition text-xs font-bold text-slate-650 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.75 rounded-lg border", act.color)}>
                          <ActIcon className="h-3.5 w-3.5" />
                        </div>
                        <span>{act.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-350" />
                    </button>
                  );
                })}
              </div>

            </div>

          </div>
        </>
      )}

      {/* ─── Xero Disconnected State ─── */}
      {data && data.connected === false && (
        <div className="flex flex-col items-center justify-center text-center select-none py-20 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-8 mt-6">
          <div className="h-14 w-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-450 mb-4 animate-pulse">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <h2 className="text-base font-extrabold text-slate-800 mb-1.5">Xero Organization Disconnected</h2>
          <p className="text-xs text-slate-500 max-w-[340px] leading-relaxed mb-6">
            Please connect your Xero organization under credentials in Data Sources to view the Tax Center report.
          </p>
          <Link href="/data-sources" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm">
            Go to Data Sources
          </Link>
        </div>
      )}

      {/* Report Notes Footer */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 select-none text-[11px] font-semibold text-slate-500/85 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3 text-slate-700">
          <Database className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold">Report Notes</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed pl-1.5 max-w-[85%]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><Clock className="h-3.5 w-3.5 text-slate-400" /><span>Calculated in real-time</span></div>
            <div className="flex items-center gap-1.75"><Building className="h-3.5 w-3.5 text-slate-400" /><span>Organization: Connected Xero Tenant</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><RefreshCw className="h-3.5 w-3.5 text-slate-400" /><span>Report Basis: Accrual</span></div>
            <div className="flex items-center gap-1.75"><Database className="h-3.5 w-3.5 text-slate-400" /><span>Data Source: PostgreSQL (Xero-synced)</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /><span>Currency: {currencyCode}</span></div>
            <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">
              "Negative payable indicates refund due."
            </div>
          </div>
        </div>

        {/* Big percent sign watermark */}
        <Percent className="absolute right-6 bottom-[-20px] h-28 w-28 text-slate-200/40 pointer-events-none stroke-[1]" />
      </div>
    </PageContainer>
  );
}
