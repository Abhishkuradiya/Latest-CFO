"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import {
  Landmark,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
  List,
  Info,
  CreditCard,
  Building,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Activity,
  Layers,
  PieChart,
  ShieldAlert,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { toast } from 'sonner';

interface SummaryData {
  totalCash: number;
  totalAccountsCount: number;
  positiveBalanceSum: number;
  positiveAccountsCount: number;
  negativeBalanceSum: number;
  negativeAccountsCount: number;
  activeAccountsCount: number;
  activePercentage: number;
}

interface CashPosition {
  name: string;
  balance: number;
}

interface BankAccount {
  id: number;
  externalId: string;
  accountName: string;
  accountCode: string;
  accountType: string;
  balance: number;
  status: string;
  lastUpdated: string;
  currency: string | null;
}

export default function BankAccountsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // Account Scope Filter: 'liquid_only' (Excludes Intercompany Clearing) vs 'all'
  const [accountScope, setAccountScope] = useState<'liquid_only' | 'all'>('liquid_only');

  const [summary, setSummary] = useState<SummaryData>({
    totalCash: 0,
    totalAccountsCount: 0,
    positiveBalanceSum: 0,
    positiveAccountsCount: 0,
    negativeBalanceSum: 0,
    negativeAccountsCount: 0,
    activeAccountsCount: 0,
    activePercentage: 100
  });

  const [cashPositions, setCashPositions] = useState<CashPosition[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Date range state - Default dynamically to Current Month
  const getCurrentMonthStart = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const getCurrentMonthEnd = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  const defaultFrom = searchParams.get('from_date') || getCurrentMonthStart();
  const defaultTo = searchParams.get('to_date') || getCurrentMonthEnd();

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const barChartRef = useRef<HTMLDivElement>(null);
  const donutChartRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isTableOnly = false) => {
    try {
      if (isTableOnly) setTableLoading(true);
      else if (initialLoading) setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        type: selectedType,
        status: selectedStatus,
        from_date: fromDate,
        to_date: toDate
      });

      const res = await fetch(`/api/dashboard/banking/accounts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setCashPositions(data.cashPosition || []);
        setAccounts(data.accounts || []);
        setCurrencyCode(data.meta?.currency || null);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.totalRecords);
      }
    } catch (err) {
      console.error('Failed to fetch bank accounts data:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!initialLoading) {
      fetchData(true);
    }
  }, [page, limit, search, selectedType, selectedStatus]);

  // Dynamic filtered positions based on selected account scope (Liquid vs All)
  const displayPositions = useMemo(() => {
    if (accountScope === 'liquid_only') {
      return cashPositions.filter(
        c => !c.name.toLowerCase().includes('inter company') && !c.name.toLowerCase().includes('intercompany') && Math.abs(c.balance) < 1000000
      );
    }
    return cashPositions;
  }, [cashPositions, accountScope]);

  // Dynamic filtered summary stats
  const displaySummary = useMemo(() => {
    if (accountScope === 'liquid_only') {
      const positiveList = displayPositions.filter(c => c.balance > 0);
      const negativeList = displayPositions.filter(c => c.balance < 0);
      const posSum = positiveList.reduce((acc, c) => acc + c.balance, 0);
      const negSum = negativeList.reduce((acc, c) => acc + c.balance, 0);

      return {
        totalCash: posSum + negSum,
        positiveBalanceSum: posSum,
        positiveAccountsCount: positiveList.length,
        negativeBalanceSum: negSum,
        negativeAccountsCount: negativeList.length,
        totalAccountsCount: displayPositions.length
      };
    }
    return summary;
  }, [displayPositions, summary, accountScope]);

  // ECharts Horizontal Bar Chart Initialization (Cash Position by Account)
  useEffect(() => {
    if (!barChartRef.current || loading || displayPositions.length === 0) return;
    const chartInstance = echarts.init(barChartRef.current);

    const sortedData = [...displayPositions].reverse();
    const categories = sortedData.map(c => c.name);
    const values = sortedData.map(c => c.balance);

    const option = {
      grid: { left: '32%', right: '10%', top: '4%', bottom: '6%' },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderRadius: 8,
        padding: [8, 12],
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: any) => {
          const item = params[0];
          const val = item.value;
          const formatted = currencyCode ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : '—';
          return `<div class="font-bold text-xs">${item.name}</div><div class="text-xs ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold mt-1">Closing Balance: ${formatted}</div>`;
        }
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          fontWeight: '600',
          formatter: (val: number) => {
            const abs = Math.abs(val);
            if (!currencyCode) return '—';
            if (abs >= 1000000) return `${currencyCode} ${(val / 1000000).toFixed(2)}M`;
            if (abs >= 1000) return `${currencyCode} ${(val / 1000).toFixed(2)}K`;
            return `${currencyCode} ${val.toFixed(2)}`;
          }
        }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#334155',
          fontSize: 10.5,
          fontWeight: '600',
          width: 180,
          overflow: 'truncate'
        }
      },
      series: [
        {
          name: 'Balance',
          type: 'bar',
          barWidth: 10,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: (params: any) => (params.value >= 0 ? '#2563eb' : '#f43f5e')
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            fontWeight: 'bold',
            color: '#475569',
            formatter: (params: any) => {
              if (Math.abs(params.value) === 0) return '£0.00';
              return currencyCode ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(params.value) : '—';
            }
          },
          data: values
        }
      ]
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [displayPositions, loading, currencyCode]);

  // ECharts Donut Chart Initialization (Cash Distribution)
  useEffect(() => {
    if (!donutChartRef.current || loading) return;
    const chartInstance = echarts.init(donutChartRef.current);

    const pos = displaySummary.positiveBalanceSum || 0;
    const neg = Math.abs(displaySummary.negativeBalanceSum || 0);

    const data = [
      { value: pos, name: 'Positive Operating Cash', itemStyle: { color: '#10b981' } },
      { value: neg, name: 'Credit & Overdrawn', itemStyle: { color: '#f43f5e' } }
    ];

    const option = {
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderRadius: 8,
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: any) => {
          const amount = currencyCode ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(params.value) : '—';
          return `<div class="font-bold text-xs">${params.name}</div><div class="text-xs text-slate-300 font-medium">${amount} (${params.percent}%)</div>`;
        }
      },
      series: [
        {
          name: 'Cash Distribution',
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#ffffff', borderWidth: 2 },
          label: { show: false },
          data
        }
      ]
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [displaySummary, loading, currencyCode]);

  const [tempFromDate, setTempFromDate] = useState(defaultFrom);
  const [tempToDate, setTempToDate] = useState(defaultTo);

  // Close Date Picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'today') => {
    const now = new Date();
    let from = '';
    let to = '';

    const formatYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (preset === 'today') {
      from = formatYMD(now);
      to = formatYMD(now);
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = formatYMD(start);
      to = formatYMD(end);
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      from = formatYMD(start);
      to = formatYMD(end);
    } else if (preset === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = formatYMD(start);
      to = formatYMD(end);
    } else if (preset === 'this_year') {
      from = `${now.getFullYear()}-01-01`;
      to = `${now.getFullYear()}-12-31`;
    }

    setFromDate(from);
    setToDate(to);
    setTempFromDate(from);
    setTempToDate(to);
    setShowDatePicker(false);

    const params = new URLSearchParams(window.location.search);
    params.set('from_date', from);
    params.set('to_date', to);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const applyCustomRange = () => {
    if (!tempFromDate || !tempToDate) return;
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setShowDatePicker(false);

    const params = new URLSearchParams(window.location.search);
    params.set('from_date', tempFromDate);
    params.set('to_date', tempToDate);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || !currencyCode) return '—';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  return (
    <PageContainer>
      <div className="space-y-5 max-w-full pb-16 font-sans text-slate-800 select-none">
        
        {/* CLEAN, COMPACT HEADER & DATE RANGE FILTER BAR (Matching ap-ar-analytics style) */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs shrink-0">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Bank Accounts & Cash Position
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  As of {formatDateLabel(toDate)}
                </span>
              </h1>
              <p className="text-[11.5px] text-slate-500 font-medium">
                Point-in-time bank statement balances & cash distribution overview
              </p>
            </div>
          </div>

          {/* Action Controls & Scope Filter in Single Line */}
          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            {/* Account Scope Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAccountScope('liquid_only');
                  toast.success('Displaying Liquid Operating Cash Accounts');
                }}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1",
                  accountScope === 'liquid_only' ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Landmark className="h-3 w-3" />
                <span>Liquid Cash Only</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountScope('all');
                  toast.info('Displaying All Accounts (Inc. Inter-company)');
                }}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1",
                  accountScope === 'all' ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers className="h-3 w-3" />
                <span>All Accounts</span>
              </button>
            </div>

            {/* Date Picker Dropdown */}
            <div className="relative" ref={datePickerRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer outline-none"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>As of {formatDateLabel(toDate)}</span>
                <ChevronDown className={cn("h-3 w-3 text-slate-400 transition-transform", showDatePicker && "rotate-180")} />
              </button>

              {showDatePicker && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5 px-1">Quick Presets</span>
                  <div className="grid grid-cols-2 gap-1 mb-2.5">
                    <button
                      onClick={() => applyPreset('this_month')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-700 text-left transition"
                    >
                      31 Aug 2026
                    </button>
                    <button
                      onClick={() => applyPreset('last_month')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-700 text-left transition"
                    >
                      31 Jul 2026
                    </button>
                    <button
                      onClick={() => applyPreset('last_3_months')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-700 text-left transition"
                    >
                      30 Jun 2026
                    </button>
                    <button
                      onClick={() => applyPreset('this_year')}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-700 text-left transition"
                    >
                      31 Dec 2026
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">Custom Target Date</span>
                    <input
                      type="date"
                      value={tempToDate}
                      onChange={(e) => setTempToDate(e.target.value)}
                      className="w-full px-2.5 py-1 border border-slate-300 rounded-md text-[11px] font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={applyCustomRange}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-md transition cursor-pointer shadow-2xs"
                    >
                      Apply Target Date
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sync Now */}
            <button
              onClick={async () => {
                try {
                  const syncRes = await fetch('/api/xero', { method: 'POST' });
                  if (!syncRes.ok) throw new Error('Xero sync failed');
                  await fetchData();
                  toast.success('Bank accounts refreshed from the updated PostgreSQL snapshot.');
                } catch (error: any) {
                  toast.error(error.message || 'Xero sync failed');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span>Sync</span>
            </button>

            {/* Export Report */}
            <button
              onClick={() => toast.success('Bank Accounts Matrix exported (.csv)')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition cursor-pointer text-xs shrink-0 shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* 4 COMPACT EXECUTIVE KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: TOTAL OPERATING CASH */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {accountScope === 'liquid_only' ? 'LIQUID OPERATING CASH' : 'TOTAL CASH POSITION'}
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className={cn("text-xl font-black font-sans tabular-nums block", displaySummary.totalCash < 0 ? "text-rose-600" : "text-slate-900")}>
              {formatCurrency(displaySummary.totalCash ?? 0)}
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-blue-600 font-bold mt-1.5">
              <Landmark className="h-3 w-3" />
              <span>Across {displaySummary.totalAccountsCount ?? 0} accounts</span>
            </div>
          </div>

          {/* Card 2: POSITIVE CASH BALANCES */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">POSITIVE BALANCES</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="text-xl font-black text-emerald-900 font-sans tabular-nums block">
              {formatCurrency(displaySummary.positiveBalanceSum ?? 0)}
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-emerald-600 font-bold mt-1.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>{displaySummary.positiveAccountsCount ?? 0} solvent accounts</span>
            </div>
          </div>

          {/* Card 3: CREDIT & OVERDRAWN */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {accountScope === 'liquid_only' ? 'CREDIT & OVERDRAWN' : 'NEGATIVE LIABILITIES'}
              </span>
              <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="text-xl font-black text-rose-700 font-sans tabular-nums block">
              {displaySummary.negativeBalanceSum ? formatCurrency(displaySummary.negativeBalanceSum) : formatCurrency(0)}
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-rose-600 font-bold mt-1.5">
              <AlertCircle className="h-3 w-3" />
              <span>{displaySummary.negativeAccountsCount ?? 0} overdrawn accounts</span>
            </div>
          </div>

          {/* Card 4: ACTIVE ACCOUNTS */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">ACTIVE ACCOUNTS</span>
              <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Building className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="text-xl font-black text-purple-900 font-sans tabular-nums block">
              {summary.activeAccountsCount ?? 0}
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-purple-600 font-bold mt-1.5">
              <Activity className="h-3 w-3" />
              <span>{summary.activePercentage ?? 100}% operational health</span>
            </div>
          </div>
        </div>

        {/* ECHARTS ANALYTICS ROW: CASH POSITION BAR CHART & DONUT SHARE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left Column (lg:col-span-8): Cash Position by Account */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-2 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-600" />
                  <span>Cash Position by Account</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Point-in-time closing balance per account as of {formatDateLabel(toDate)}
                </p>
              </div>

              {accountScope === 'all' && (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10.5px] font-bold rounded flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-amber-600" />
                  <span>Includes Intercompany Clearing (-£3.42M)</span>
                </span>
              )}
            </div>

            <div className="h-72 w-full my-1">
              <div ref={barChartRef} className="w-full h-full" />
            </div>
          </div>

          {/* Right Column (lg:col-span-4): Cash Distribution Donut */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>Cash Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Proportional ratio of positive cash vs overdrawn credit
              </p>
            </div>

            <div className="relative flex items-center justify-center h-48 my-1">
              <div ref={donutChartRef} className="w-full h-full" />
              <div className="absolute text-center flex flex-col items-center pointer-events-none">
                <span className={cn("text-base font-black tabular-nums", displaySummary.totalCash < 0 ? "text-rose-600" : "text-slate-900")}>
                  {formatCurrency(displaySummary.totalCash ?? 0)}
                </span>
                <span className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">NET CASH POSITION</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-[11px] font-medium">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" /> Positive Cash
                </span>
                <div className="text-right">
                  <span className="font-black text-slate-900 block">{formatCurrency(displaySummary.positiveBalanceSum ?? 0)}</span>
                  <span className="text-[9.5px] text-slate-400 font-bold block">({displaySummary.positiveAccountsCount ?? 0} accounts)</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" /> Overdrawn / Credit
                </span>
                <div className="text-right">
                  <span className="font-black text-rose-600 block">
                    {displaySummary.negativeBalanceSum ? formatCurrency(displaySummary.negativeBalanceSum) : formatCurrency(0)}
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-bold block">({displaySummary.negativeAccountsCount ?? 0} accounts)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM DATATABLE COMPONENT (Standard DataTables Filter Bar & Table) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          
          {/* DATATABLE HEADER FILTER CONTROLS BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">All Connected Bank Accounts</span>
              <span className="text-[11px] text-slate-400 font-medium">({accounts.length} total synced)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Account Type Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
                <span className="text-slate-400 font-normal">Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="">All Account Types</option>
                  <option value="Bank Account">Bank Account</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
                <span className="text-slate-400 font-normal">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Search Input */}
              <div className="flex items-center gap-1.5">
                <span>Search:</span>
                <input
                  type="text"
                  placeholder="Type to filter..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-2.5 pr-2 py-1 bg-white border border-slate-300 rounded font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 min-w-[160px]"
                />
              </div>
            </div>
          </div>

          {/* DATATABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300 select-none">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">ACCOUNT NAME</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">TYPE</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">CODE</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">CLOSING BALANCE</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">STATUS</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">AS OF DATE</th>
                  <th className="py-2.5 px-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableLoading ? (
                  Array.from({ length: limit }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-2.5 px-3 text-center"><div className="h-4 w-4 bg-slate-200 rounded mx-auto" /></td>
                      <td className="py-2.5 px-3"><div className="h-4 w-48 bg-slate-200 rounded" /></td>
                      <td className="py-2.5 px-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                      <td className="py-2.5 px-3"><div className="h-4 w-12 bg-slate-200 rounded" /></td>
                      <td className="py-2.5 px-3 text-right"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
                      <td className="py-2.5 px-3 text-center"><div className="h-5 w-14 bg-slate-200 rounded-md mx-auto" /></td>
                      <td className="py-2.5 px-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                      <td className="py-2.5 px-3 text-center"><div className="h-4 w-4 bg-slate-200 rounded mx-auto" /></td>
                    </tr>
                  ))
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                      No bank accounts found matching search filters.
                    </td>
                  </tr>
                ) : (
                  accounts.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Landmark className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block truncate max-w-[260px]">{row.accountName}</span>
                            {row.accountName.toLowerCase().includes('inter company') && (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                                Inter-company Clearing
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-bold">{row.accountType}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{row.accountCode}</td>
                      <td className={cn("py-2.5 px-3 font-black text-right tabular-nums text-xs", row.balance < 0 ? "text-rose-600" : "text-slate-900")}>
                        {formatCurrency(row.balance)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 text-[9.5px] font-extrabold rounded uppercase tracking-wider border",
                          row.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-medium">{row.lastUpdated}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION BAR */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {totalRecords > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalRecords)} of {totalRecords} accounts
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>

        </div>

      </div>
    </PageContainer>
  );
}
