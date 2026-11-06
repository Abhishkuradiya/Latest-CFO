'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';
import { 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown,
  RefreshCw, 
  DollarSign, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowDownLeft,
  HelpCircle, 
  Landmark, 
  CheckCircle2, 
  CreditCard,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  Activity,
  Layers3,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { generateCashFlowExcelReport } from '@/lib/excel/cash-flow-export';

interface CFHistoryItem {
  month: string;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

interface CFForecastItem {
  week: string;
  openingCash: number;
  expectedIn: number;
  expectedOut: number;
  netChange: number;
  closingCash: number;
  status: string;
}

interface CFCategoryItem {
  category: string;
  amount: number;
  pct: number;
  color: string;
}

interface CFData {
  connected: boolean;
  summary: {
    operating: number;
    operatingChange: number;
    operatingReceipts: number;
    operatingPayments: number;
    investing: number;
    investingChange: number;
    investingReceipts: number;
    investingPayments: number;
    financing: number;
    financingChange: number;
    financingReceipts: number;
    financingPayments: number;
    cashIn: number;
    cashOut: number;
    cashInCount: number;
    cashOutCount: number;
    beginningCash: number;
    endingCash: number;
    change: number;
    changePercentage: number;
  };
  receivables?: {
    total: number;
    overdue: number;
  };
  payables?: {
    total: number;
    overdue: number;
  };
  forecast?: CFForecastItem[];
  inflowBreakdown?: CFCategoryItem[];
  outflowBreakdown?: CFCategoryItem[];
  history: CFHistoryItem[];
  bankAccounts?: {
    name: string;
    opening: number;
    cashIn: number;
    cashOut: number;
    closing: number;
  }[];
  meta: {
    currency: string;
    dataAvailable?: boolean;
    calculatedAt: string;
  };
}

function Tooltip({ text }: { text: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1 select-none">
      <HelpCircle
        className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 cursor-help transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2.5 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-lg shadow-xl z-50 pointer-events-none text-left leading-normal font-sans font-medium border border-slate-800">
          <div className="space-y-1">{text}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

export default function CashFlowPage() {
  const getDefaultFrom = () => {
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getDefaultTo = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Temporary date picker states (unapplied until user clicks Apply)
  const [tempFromDate, setTempFromDate] = useState<string>(getDefaultFrom);
  const [tempToDate, setTempToDate] = useState<string>(getDefaultTo);

  // Active applied date states for API fetching
  const [appliedFromDate, setAppliedFromDate] = useState<string>(getDefaultFrom);
  const [appliedToDate, setAppliedToDate] = useState<string>(getDefaultTo);

  const [data, setData] = useState<CFData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const fetchCashFlow = async (fromVal?: string, toVal?: string) => {
    const activeFrom = fromVal || appliedFromDate;
    const activeTo = toVal || appliedToDate;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/reports/cash-flow?fromDate=${activeFrom}&toDate=${activeTo}`);
      if (!res.ok) {
        throw new Error('Failed to load Cash Flow Statement');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load Cash Flow Statement');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDates = () => {
    setAppliedFromDate(tempFromDate);
    setAppliedToDate(tempToDate);
    fetchCashFlow(tempFromDate, tempToDate);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setIsExportingExcel(true);
    try {
      let rawEvents: any[] = [];
      try {
        const res = await fetch(`/api/dashboard/cash-flow?fromDate=${appliedFromDate}&toDate=${appliedToDate}`);
        if (res.ok) {
          const json = await res.json();
          if (json.events && Array.isArray(json.events)) {
            rawEvents = json.events;
          }
        }
      } catch (err) {
        console.warn('Could not fetch itemized events for Excel export, fallback to breakdown data:', err);
      }

      await generateCashFlowExcelReport(data, appliedFromDate, appliedToDate, rawEvents);
    } catch (err) {
      console.error('Excel Export error:', err);
      alert('Failed to generate Excel report. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  useEffect(() => {
    fetchCashFlow(appliedFromDate, appliedToDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyCode = data?.meta?.currency || null;
  const getCurrencySymbol = (code: string | null) => {
    if (!code) return '';
    try {
      const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
      return parts.find(p => p.type === 'currency')?.value || '';
    } catch {
      return code === 'GBP' ? '£' : (code === 'EUR' ? '€' : (code === 'INR' ? '₹' : '$'));
    }
  };
  const currencySymbol = getCurrencySymbol(currencyCode);

  const formatAmount = (val: number | null | undefined, compact = false) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
    const prefix = val < 0 ? '-' : '';
    const absVal = Math.abs(val);

    if (compact && absVal >= 1000) {
      if (absVal >= 1000000) {
        return `${prefix}${currencySymbol}${(absVal / 1000000).toFixed(2)}M`;
      }
      return `${prefix}${currencySymbol}${(absVal / 1000).toFixed(1)}K`;
    }

    return `${prefix}${currencySymbol}${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencyCode ? ` ${currencyCode}` : ''}`;
  };

  // ECharts Configs for Cash Flow Trend Chart
  const cashFlowOverviewOption = {
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 11 },
      formatter: (params: any) => {
        let title = params[0]?.axisValue || '';
        let html = `<div style="font-weight:700;margin-bottom:4px;">${title}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;justify-content:between;gap:12px;font-size:11px;">
            <span>${p.marker} ${p.seriesName}:</span>
            <span style="font-weight:700;">${currencySymbol}${p.value.toLocaleString()}</span>
          </div>`;
        });
        return html;
      }
    },
    legend: { show: false },
    grid: { left: '2%', right: '3%', bottom: '2%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data?.history?.map(h => h.month) || [],
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 10, fontWeight: 550 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { 
        color: '#94a3b8', 
        fontSize: 10,
        formatter: (v: number) => {
          const absV = Math.abs(v);
          const sign = v < 0 ? '-' : '';
          if (absV >= 1000000) return `${sign}${currencySymbol}${(absV / 1000000).toFixed(1)}M`;
          if (absV >= 1000) return `${sign}${currencySymbol}${(absV / 1000).toFixed(0)}K`;
          return `${sign}${currencySymbol}${absV}`;
        }
      }
    },
    series: [
      {
        name: 'Cash In',
        type: 'bar',
        barWidth: '18%',
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        data: data?.history ? data.history.map(h => h.cashIn) : [0, 0, 0, 0, 0]
      },
      {
        name: 'Cash Out',
        type: 'bar',
        barWidth: '18%',
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        data: data?.history ? data.history.map(h => h.cashOut) : [0, 0, 0, 0, 0]
      },
      {
        name: 'Net Cash Flow',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#0064eb', borderWidth: 2 },
        lineStyle: { width: 2.5 },
        symbol: 'circle',
        symbolSize: 7,
        data: data?.history ? data.history.map(h => h.netCashFlow) : [0, 0, 0, 0, 0]
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
        <span className="text-slate-600 font-semibold">CFO Cash Flow Intelligence</span>
      </div>

      {/* ─── Header Section ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Cash Flow Intelligence</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-200/60 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> CFO Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Real-time liquidity, cash inflow/outflow breakdown, & 13-week rolling forecast.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <FormattedDatePicker value={tempFromDate} onChange={setTempFromDate} label="From:" />
            <span className="text-slate-400 text-xs font-bold">-</span>
            <FormattedDatePicker value={tempToDate} onChange={setTempToDate} label="To:" />
            <button
              onClick={handleApplyDates}
              disabled={loading}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer outline-none shadow-2xs",
                (tempFromDate !== appliedFromDate || tempToDate !== appliedToDate)
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              title="Apply selected date range to report"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply</span>
            </button>
          </div>

          <button 
            onClick={() => fetchCashFlow(appliedFromDate, appliedToDate)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
            title="Reload report data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
            <span>Sync Live</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50/30 text-xs font-bold text-red-600 transition cursor-pointer shadow-2xs">
            <FileText className="h-3.5 w-3.5" />
            <span>PDF Report</span>
          </button>
          <button 
            onClick={handleExportExcel}
            disabled={isExportingExcel || !data}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/30 text-xs font-bold text-emerald-600 transition cursor-pointer shadow-2xs",
              (isExportingExcel || !data) && "opacity-60 cursor-not-allowed"
            )}
            title="Export multi-sheet executive Excel dashboard report"
          >
            <FileSpreadsheet className={cn("h-3.5 w-3.5", isExportingExcel && "animate-spin")} />
            <span>{isExportingExcel ? 'Exporting...' : 'Excel'}</span>
          </button>
        </div>
      </div>

      {/* ─── Error State ─── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-800">Unable to load Cash Flow data</h4>
              <p className="text-[11px] text-rose-600 font-medium">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => fetchCashFlow(appliedFromDate, appliedToDate)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Skeleton Loading State ─── */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-28" />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 h-64" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 h-96" />
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 h-96" />
          </div>
        </div>
      )}

      {/* ─── Disconnected State ─── */}
      {!loading && !error && data && data.connected === false && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 shadow-2xs flex flex-col items-center justify-center text-center select-none space-y-4">
          <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Landmark className="h-6 w-6 stroke-[1.5]" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-base font-extrabold text-slate-800">Xero Disconnected</h3>
            <p className="text-xs text-slate-500 font-medium">
              Please connect your Xero organization to analyze real-time Cash Flow Intelligence and liquid bank balances.
            </p>
          </div>
          <Link
            href="/data-sources"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            Connect Xero Organization
          </Link>
        </div>
      )}

      {/* ─── Main CFO Dashboard Content ─── */}
      {!loading && !error && data && data.connected !== false && data.meta?.dataAvailable && (
        <div className="space-y-6">

          {/* 1. TOP 6 CFO KPI CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 select-none">
            {/* CARD 1: Total Cash */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-0.5">
                  TOTAL CASH (ACTUAL)
                  <Tooltip text="Actual total liquid bank balance remaining in all connected bank accounts as of the period end date." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Landmark className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className="text-[20px] font-extrabold text-slate-800 leading-tight tracking-tight select-all">
                  {formatAmount(data.summary?.endingCash, true)}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Actual Liquid Bank Balance</p>
              </div>
              <div className="text-[9.5px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Closing Bank Balance
              </div>
            </div>

            {/* CARD 2: Cash In */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-0.5">
                  Cash In
                  <Tooltip text="Total cash received in bank accounts during the selected date range, including customer payments, bank deposits, prepayments & refunds." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className="text-[20px] font-extrabold text-emerald-600 leading-tight tracking-tight select-all">
                  {formatAmount(data.summary?.cashIn, true)}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{data.summary?.cashInCount || 0} Inflow Txns</p>
              </div>
              <div className="text-[9.5px] font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> Collections & Receipts
              </div>
            </div>

            {/* CARD 3: Cash Out */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-0.5">
                  Cash Out
                  <Tooltip text="Total cash spent or paid out from bank accounts during the selected date range, including vendor bill payments, expenses & payroll." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className="text-[20px] font-extrabold text-rose-600 leading-tight tracking-tight select-all">
                  {formatAmount(data.summary?.cashOut, true)}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{data.summary?.cashOutCount || 0} Outflow Txns</p>
              </div>
              <div className="text-[9.5px] font-bold text-rose-500 flex items-center gap-0.5">
                <TrendingDown className="h-3 w-3" /> Bills & Expenses
              </div>
            </div>

            {/* CARD 4: Net Cash Flow */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-0.5">
                  NET CASH MOVEMENT
                  <Tooltip text="Net cash movement/change during selected period only (Cash In minus Cash Out). This is period movement, NOT your total bank balance." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Activity className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className={cn(
                  "text-[20px] font-extrabold leading-tight tracking-tight select-all",
                  (data.summary?.change || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatAmount(data.summary?.change, true)}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Period Movement (In − Out)</p>
              </div>
              <div className={cn(
                "text-[9.5px] font-bold flex items-center gap-0.5",
                (data.summary?.changePercentage || 0) >= 0 ? "text-emerald-600" : "text-rose-500"
              )}>
                {(data.summary?.changePercentage || 0) >= 0 ? `↑ ${data.summary?.changePercentage}%` : `↓ ${Math.abs(data.summary?.changePercentage || 0)}%`} Net Movement
              </div>
            </div>

            {/* CARD 5: Accounts Receivable */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center">
                  Receivables
                  <Tooltip text="Total outstanding unpaid sales invoices (ACCREC) owed by customers. Overdue amount shows invoices past their due date." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className="text-[20px] font-extrabold text-slate-800 leading-tight tracking-tight select-all">
                  {formatAmount(data.receivables?.total, true)}
                </h3>
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{formatAmount(data.receivables?.overdue, true)} Overdue</p>
              </div>
              <div className="text-[9.5px] font-bold text-slate-400">
                Expected Inflow Source
              </div>
            </div>

            {/* CARD 6: Accounts Payable */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center">
                  Payables
                  <Tooltip text="Total outstanding unpaid vendor bills (ACCPAY) owed to suppliers. Overdue amount shows bills past their due date." />
                </span>
                <div className="h-7 w-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <Layers3 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="my-1">
                <h3 className="text-[20px] font-extrabold text-slate-800 leading-tight tracking-tight select-all">
                  {formatAmount(data.payables?.total, true)}
                </h3>
                <p className="text-[10px] text-purple-600 font-semibold mt-0.5">{formatAmount(data.payables?.overdue, true)} Overdue</p>
              </div>
            </div>
          </div>

          {/* 3. MULTI-DIMENSIONAL CHARTS & CATEGORY BREAKDOWN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
            {/* Left 8 Columns: Main Cash Flow Trend Line/Bar Chart */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-[13.5px] font-bold text-slate-800">Cash Flow Trend & Velocity</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Monthly Cash In vs Cash Out with Net Cash Flow curve.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Cash In</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Cash Out</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Net Flow</span>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ReactECharts option={cashFlowOverviewOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            {/* Right 4 Columns: Inflow & Outflow Category Breakdown */}
            <div className="lg:col-span-4 space-y-6">
              {/* Cash Inflow Category Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                    Cash Inflow Sources
                  </h3>
                  <span className="text-[10px] font-extrabold text-emerald-600">{formatAmount(data.summary?.cashIn || 0, true)}</span>
                </div>

                <div className="space-y-3">
                  {(data.inflowBreakdown || []).map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-semibold">
                        <span className="text-slate-700">{item.category}</span>
                        <span className="text-slate-800 font-bold">{formatAmount(item.amount, true)} ({item.pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cash Outflow Category Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4 text-rose-600" />
                    Cash Outflow Sources
                  </h3>
                  <span className="text-[10px] font-extrabold text-rose-600">{formatAmount(data.summary?.cashOut || 0, true)}</span>
                </div>

                <div className="space-y-3">
                  {(data.outflowBreakdown || []).map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-semibold">
                        <span className="text-slate-700">{item.category}</span>
                        <span className="text-slate-800 font-bold">{formatAmount(item.amount, true)} ({item.pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>




          {/* 5. BANK ACCOUNTS LIQUIDITY BREAKDOWN TABLE */}
          {data.bankAccounts && data.bankAccounts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs select-none">
              <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[13.5px] font-bold text-slate-800">Bank Accounts Liquidity Breakdown</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Opening and closing balances per connected bank account.</p>
                </div>
                <Link href="/banking/accounts" className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1">
                  <span>View All Feeds</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Bank Account Name</th>
                      <th className="py-2.5 px-3">Opening Balance</th>
                      <th className="py-2.5 px-3 text-emerald-600">+ Cash In</th>
                      <th className="py-2.5 px-3 text-rose-600">- Cash Out</th>
                      <th className="py-2.5 px-3 text-right">Closing Balance</th>
                      <th className="py-2.5 px-3 text-right">Net Movement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bankAccounts.map((acc, idx) => {
                      const netMovement = acc.cashIn - acc.cashOut;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                            <Landmark className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            {acc.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-semibold">{formatAmount(acc.opening)}</td>
                          <td className="py-3 px-3 text-emerald-600 font-extrabold">+{formatAmount(acc.cashIn)}</td>
                          <td className="py-3 px-3 text-rose-600 font-extrabold">-{formatAmount(acc.cashOut)}</td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900 select-all">{formatAmount(acc.closing)}</td>
                          <td className={cn("py-3 px-3 text-right font-bold", netMovement >= 0 ? "text-emerald-600" : "text-rose-500")}>
                            {netMovement >= 0 ? `+${formatAmount(netMovement)}` : formatAmount(netMovement)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </PageContainer>
  );
}
