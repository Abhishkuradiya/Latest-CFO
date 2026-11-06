'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactECharts from 'echarts-for-react';
import { useSearchParams } from 'next/navigation';
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';
import { 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  ChevronDown, 
  SlidersHorizontal,
  Scale, 
  TrendingUp, 
  ShieldCheck, 
  RefreshCw, 
  Share2, 
  Star,
  Database,
  BookOpen,
  Clock,
  Building,
  HelpCircle,
  MoreVertical,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';

interface BSItem {
  name: string;
  value: number;
}

interface BSData {
  connected: boolean;
  available?: boolean;
  summary: {
    assets: number;
    liabilities: number;
    equity: number;
    isBalanced: boolean | null;
    difference: number | null;
  } | null;
  assets: {
    current: BSItem[];
    nonCurrent: BSItem[];
  };
  liabilities: {
    current: BSItem[];
    nonCurrent: BSItem[];
  };
  equity: BSItem[];
  equityTrend?: { label: string; value: number | null }[];
  meta: {
    currency: string | null;
    calculatedAt: string;
  };
}

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

export default function BalanceSheetPage() {
  const searchParams = useSearchParams();
  const defaultDate = searchParams.get('to_date') || (() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0 = Jan, 11 = Dec
    // Last financial year ended on March 31st of previous year if current month is Jan-Mar, else current year
    const lastFYYear = currentMonth < 3 ? currentYear - 1 : currentYear;
    return `${lastFYYear}-03-31`;
  })();
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [data, setData] = useState<BSData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalanceSheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/reports/balance-sheet?date=${selectedDate}`);
      if (!res.ok) {
        throw new Error('Failed to load Balance Sheet');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load Balance Sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSheet();
  }, [selectedDate]);

  const currencyCode = data?.meta?.currency || null;
  const getCurrencySymbol = (code: string | null | undefined) => {
    if (!code) return '';
    try {
      const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
      return parts.find(p => p.type === 'currency')?.value || '';
    } catch {
      return code === 'GBP' ? '£' : (code === 'EUR' ? '€' : (code === 'INR' ? '₹' : '$'));
    }
  };
  const currencySymbol = getCurrencySymbol(currencyCode);

  const formatAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
    return currencyCode
      ? `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`
      : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ECharts Configurations
  const getAssetsPieData = () => {
    if (!data || !data.connected || !data.assets) return [];
    const list: any[] = [];
    data.assets.current.forEach(item => {
      if (item.value > 0) list.push({ value: item.value, name: item.name });
    });
    data.assets.nonCurrent.forEach(item => {
      if (item.value > 0) list.push({ value: item.value, name: item.name });
    });
    return list;
  };

  const getLiabilitiesPieData = () => {
    if (!data || !data.connected || !data.liabilities) return [];
    const list: any[] = [];
    data.liabilities.current.forEach(item => {
      if (item.value > 0) list.push({ value: item.value, name: item.name });
    });
    data.liabilities.nonCurrent.forEach(item => {
      if (item.value > 0) list.push({ value: item.value, name: item.name });
    });
    return list;
  };

  const assetsPieOption = {
    tooltip: { 
      trigger: 'item', 
      formatter: (params: any) => {
        if (params.name.includes('No Assets')) return 'No Assets';
        return `${params.name}: ${formatAmount(params.value)} (${params.percent}%)`;
      }
    },
    legend: { show: false },
    series: [
      {
        name: 'Assets',
        type: 'pie',
        radius: ['60%', '80%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.summary?.assets;
            return sum === null || sum === undefined ? 'Not available' : `${currencySymbol}${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTotal Assets`;
          },
          textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: getAssetsPieData()
      }
    ]
  };

  const liabilitiesPieOption = {
    tooltip: { 
      trigger: 'item', 
      formatter: (params: any) => {
        if (params.name.includes('No Liabilities')) return 'No Liabilities';
        return `${params.name}: ${formatAmount(params.value)} (${params.percent}%)`;
      }
    },
    legend: { show: false },
    series: [
      {
        name: 'Liabilities',
        type: 'pie',
        radius: ['60%', '80%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.summary?.liabilities;
            return sum === null || sum === undefined ? 'Not available' : `${currencySymbol}${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTotal Liabilities`;
          },
          textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: getLiabilitiesPieData()
      }
    ]
  };

  const getEquityTrendData = () => {
    if (!data || !data.equityTrend || data.equityTrend.length === 0) return { categories: [], values: [] };
    return {
      categories: data.equityTrend.map(item => item.label),
      values: data.equityTrend.map(item => item.value)
    };
  };

  const trendData = getEquityTrendData();

  const equityTrendOption = {
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.categories,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 }
    },
    series: [
      {
        name: 'Equity',
        type: 'line',
        data: trendData.values,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6
      }
    ]
  };

  return (
    <PageContainer>
      {/* ─── Breadcrumbs ─── */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none mb-3">
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Dashboard</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/reports" className="hover:text-slate-600 text-slate-400 transition">Accounting</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/reports" className="hover:text-slate-600 text-slate-400 transition">Reports</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <span className="text-slate-600 font-semibold">Balance Sheet</span>
      </div>

      {/* ─── Header Section ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Balance Sheet</h1>
            <HelpCircle className="h-4 w-4 text-slate-350 hover:text-slate-500 cursor-pointer transition" />
          </div>
          <p className="text-xs text-slate-500 font-medium">View your company's financial position at a specific point in time.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FormattedDatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            label="As at:"
          />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50/20 text-xs font-bold text-red-600 transition cursor-pointer">
            <FileText className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50/20 text-xs font-bold text-emerald-600 transition cursor-pointer">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-3 select-none text-[11px] font-semibold text-slate-500">
        <div className="flex flex-col gap-1 min-w-[110px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Currency</span>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-slate-50">
            <span>{currencyCode}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[110px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Report Basis</span>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-slate-50">
            <span>Accrual</span>
          </div>
        </div>

        <button 
          onClick={fetchBalanceSheet}
          className="flex items-center gap-1.5 border border-slate-200 px-3.5 py-1.75 rounded-lg text-slate-600 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer mt-4"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reload Report</span>
        </button>
      </div>

      {/* ─── Error Handling ─── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-3 select-none">
          <AlertCircle className="h-5 w-5 text-red-550 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-red-800">Unable to load Balance Sheet</h4>
            <p className="text-xs text-red-650 font-medium">{error}</p>
            <button 
              onClick={fetchBalanceSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Skeleton Loading State ─── */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 animate-pulse space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-2/3" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 h-96 animate-pulse" />
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 h-96 animate-pulse" />
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 h-96 animate-pulse" />
          </div>
        </div>
      )}

      {/* ─── Main Dynamic View ─── */}
      {!loading && !error && data && data.connected !== false && data.summary && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 select-none">
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all duration-350 ease-out hover:translate-y-2 relative z-10 hover:z-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Assets</span>
                  <Tooltip text="Total assets owned by the business, including cash at bank, accounts receivable (debtors), inventory (finished goods), loans, and fixed machinery/equipment - VAT Included." />
                </div>
                <div className="h-6 w-6 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/50"><Scale className="h-3.5 w-3.5" /></div>
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{formatAmount(data.summary.assets)}</h3>
              <span className="text-[9.5px] font-bold text-slate-400 block mt-1">100% of total assets</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all duration-350 ease-out hover:translate-y-2 relative z-10 hover:z-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Liabilities</span>
                  <Tooltip text="Total obligations owed to external parties, including accounts payable (creditors), corporation tax, director loans, wages, VAT payable, and accruals - VAT Included." />
                </div>
                <div className="h-6 w-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/50"><Scale className="h-3.5 w-3.5 rotate-180" /></div>
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{formatAmount(data.summary.liabilities)}</h3>
              <span className="text-[9.5px] font-bold text-slate-400 block mt-1">
                {data.summary.assets > 0 ? `${Math.round((data.summary.liabilities / data.summary.assets) * 100)}% of total assets` : '0%'}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all duration-350 ease-out hover:translate-y-2 relative z-10 hover:z-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Equity</span>
                  <Tooltip text="Total net worth belonging to shareholders, including Current Year Earnings, Share Capital, and Retained Earnings." />
                </div>
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100/50"><TrendingUp className="h-3.5 w-3.5" /></div>
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{formatAmount(data.summary.equity)}</h3>
              <span className="text-[9.5px] font-bold text-slate-400 block mt-1">
                {data.summary.assets > 0 ? `${Math.round((data.summary.equity / data.summary.assets) * 100)}% of total assets` : '0%'}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all duration-350 ease-out hover:translate-y-2 relative z-10 hover:z-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance Status</span>
                  <Tooltip text="Verifies that Net Assets (Assets - Liabilities) equals Total Capital & Reserves (Equity) to ensure a perfectly balanced ledger." />
                </div>
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-605 flex items-center justify-center border border-emerald-100/50"><ShieldCheck className="h-3.5 w-3.5" /></div>
              </div>
              <h3 className={cn("text-xl font-extrabold tracking-tight", data.summary.isBalanced ? "text-emerald-600" : "text-amber-500")}>
                {data.summary.isBalanced ? 'Balanced' : 'Unbalanced'}
              </h3>
              <span className="text-[9.5px] font-bold text-slate-400 block mt-1">Net Assets = Total Equity</span>
            </div>
          </div>

          {/* Empty State Banner */}
          {data.summary.assets === 0 && data.summary.liabilities === 0 && (
            <div className="bg-slate-50 border border-dashed border-slate-250/70 rounded-xl p-12 text-center select-none mb-6">
              <Scale className="h-8 w-8 text-slate-350 mx-auto mb-3 animate-bounce" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">No Balance Sheet Available</h4>
              <p className="text-xs text-slate-400 font-medium">Verify your Xero organization parameters or sync coordinates.</p>
            </div>
          )}

          {/* Tables & Panels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Column 1: Assets details */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">Assets</h3>
                <button className="text-slate-400 hover:text-slate-600"><MoreVertical className="h-4 w-4" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Current Assets</span>
                  <div className="space-y-1.75 pl-2 text-xs font-semibold text-slate-600">
                    {data.assets.current.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-850">{formatAmount(item.value)}</span>
                      </div>
                    ))}
                    {data.assets.current.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block italic">No current assets accounts</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold text-blue-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 mt-1">
                    <span>Total Current Assets</span>
                    <span>{formatAmount(data.assets.current.reduce((sum, item) => sum + item.value, 0))}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Non Current Assets</span>
                  <div className="space-y-1.75 pl-2 text-xs font-semibold text-slate-600">
                    {data.assets.nonCurrent.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-850">{formatAmount(item.value)}</span>
                      </div>
                    ))}
                    {data.assets.nonCurrent.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block italic">No non-current assets accounts</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold text-blue-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 mt-1">
                    <span>Total Non Current Assets</span>
                    <span>{formatAmount(data.assets.nonCurrent.reduce((sum, item) => sum + item.value, 0))}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200">
                  <div className="flex justify-between text-sm font-extrabold text-slate-805 border-y-2 border-slate-900 py-3 uppercase tracking-wide">
                    <span>Total Assets</span>
                    <span>{formatAmount(data.summary.assets)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Liabilities & Equity details */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 tracking-wider uppercase">Liabilities & Equity</h3>
                <button className="text-slate-400 hover:text-slate-600"><MoreVertical className="h-4 w-4" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Current Liabilities</span>
                  <div className="space-y-1.75 pl-2 text-xs font-semibold text-slate-600">
                    {data.liabilities.current.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-850">{formatAmount(item.value)}</span>
                      </div>
                    ))}
                    {data.liabilities.current.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block italic">No current liabilities accounts</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold text-amber-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 mt-1">
                    <span>Total Current Liabilities</span>
                    <span>{formatAmount(data.liabilities.current.reduce((sum, item) => sum + item.value, 0))}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Long Term Liabilities</span>
                  <div className="space-y-1.75 pl-2 text-xs font-semibold text-slate-600">
                    {data.liabilities.nonCurrent.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-850">{formatAmount(item.value)}</span>
                      </div>
                    ))}
                    {data.liabilities.nonCurrent.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block italic">No long-term liabilities accounts</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold text-amber-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 mt-1">
                    <span>Total Long Term Liabilities</span>
                    <span>{formatAmount(data.liabilities.nonCurrent.reduce((sum, item) => sum + item.value, 0))}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Equity</span>
                  <div className="space-y-1.75 pl-2 text-xs font-semibold text-slate-600">
                    {data.equity.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span className="text-slate-850">{formatAmount(item.value)}</span>
                      </div>
                    ))}
                    {data.equity.length === 0 && (
                      <span className="text-[10px] text-slate-400 font-bold block italic">No equity accounts</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50 mt-1">
                    <span>Total Equity</span>
                    <span>{formatAmount(data.summary.equity)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/50 mt-1">
                    <span>Net Assets (Assets - Liabilities)</span>
                    <span className="text-slate-900 font-extrabold">{formatAmount(data.summary.assets - data.summary.liabilities)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-805 border-y-2 border-slate-900 py-3 uppercase tracking-wide">
                    <span>Total Capital & Reserves (Equity)</span>
                    <span>{formatAmount(data.summary.equity)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Quick Actions & Verification widget */}
            <div className="lg:col-span-3 space-y-5">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4.5 shadow-sm space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</h4>
                <div className="grid grid-cols-1 gap-2 text-xs font-semibold">
                  <button className="flex items-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>Export PDF Report</span>
                  </button>
                  <button className="flex items-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                    <span>Export Excel Report</span>
                  </button>
                  <button className="flex items-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <Printer className="h-3.5 w-3.5 text-slate-400" />
                    <span>Print Report</span>
                  </button>
                  <button 
                    onClick={fetchBalanceSheet}
                    className="flex items-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>

              {/* Verification Widget */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3.5 select-none">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Balance Verification</h4>
                
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.75 border text-xs font-bold rounded-lg justify-center w-full",
                  data.summary.isBalanced 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                    : "bg-amber-50 border-amber-100 text-amber-700"
                )}>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{data.summary.isBalanced ? 'Balance Verified' : 'Imbalance Detected'}</span>
                </div>

                <div className="space-y-2 text-xs font-semibold text-slate-500 pt-1">
                  <div className="flex justify-between"><span>Total Assets</span><span className="text-slate-805">{formatAmount(data.summary.assets)}</span></div>
                  <div className="flex justify-between"><span>Total Liabilities</span><span className="text-slate-805">{formatAmount(data.summary.liabilities)}</span></div>
                  <div className="border-t border-slate-100/60 my-1" />
                  <div className="flex justify-between font-bold text-slate-700"><span>Net Assets</span><span className="text-slate-805">{formatAmount(data.summary.assets - data.summary.liabilities)}</span></div>
                  <div className="flex justify-between"><span>Total Equity</span><span className="text-slate-850 font-bold">{formatAmount(data.summary.equity)}</span></div>
                  <div className="border-t border-slate-100/60 my-1" />
                  <div className="flex justify-between font-bold text-slate-705">
                    <span>Difference</span>
                    <span className={data.summary.isBalanced ? "text-emerald-600" : "text-amber-500"}>
                      {formatAmount(data.summary.difference)}
                    </span>
                  </div>
                </div>

                <div className={cn(
                  "text-[10px] font-bold text-center py-2 rounded-lg border",
                  data.summary.isBalanced 
                    ? "text-emerald-600 bg-emerald-50/30 border-emerald-100/40" 
                    : "text-amber-500 bg-amber-50/30 border-amber-100/40"
                )}>
                  {data.summary.isBalanced ? '✓ Your balance sheet is in balance.' : '⚠️ Balance sheet mismatch details flagged.'}
                </div>
              </div>
            </div>
          </div>

          {/* ECharts Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6 select-none">
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Assets Composition</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={assetsPieOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Liabilities Composition</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={liabilitiesPieOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Equity Trend (Last 6 Months)</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={equityTrendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
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
            Please connect your Xero organization under credentials in Data Sources to compile and view your Balance Sheet report.
          </p>
          <Link href="/data-sources" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm">
            Go to Data Sources
          </Link>
        </div>
      )}

      {/* ─── Footer Notes Section ─── */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 select-none text-[11px] font-semibold text-slate-500/85">
        <div className="flex items-center gap-2 mb-3 text-slate-700">
          <BookOpen className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold">Report Notes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed pl-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><Clock className="h-3.5 w-3.5 text-slate-400" /><span>Generated automatically from Xero</span></div>
            <div className="flex items-center gap-1.75"><Building className="h-3.5 w-3.5 text-slate-400" /><span>Organization: Connected Organization</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" /><span>Report Basis: Accrual</span></div>
            <div className="flex items-center gap-1.75"><Database className="h-3.5 w-3.5 text-slate-400" /><span>Data Source: Xero Accounting API</span></div>
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <div className="flex items-center gap-1.75"><CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /><span>Currency: {currencyCode}</span></div>
            <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">
              "This report reflects your company's financial position at the selected date."
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
