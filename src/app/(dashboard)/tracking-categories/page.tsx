"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import {
  Grid,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  FileText,
  Download,
  Share2,
  HelpCircle,
  Sparkles,
  Sliders,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TrackingOption {
  id: string;
  name: string;
  description: string | null;
  status: string;
  usedInCount: number | null;
  lastTransaction: string | null;
}

interface TrackingCategory {
  id: string;
  name: string;
  status: string;
  createdOn: string;
  optionsCount: number;
  options: TrackingOption[];
}

interface SummaryData {
  configuredCategories: number;
  trackingOptions: number;
  activeCategories: number;
  inactiveCategories: number;
}

export default function TrackingCategoriesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedOptionFilter, setSelectedOptionFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [summary, setSummary] = useState<SummaryData>({
    configuredCategories: 0,
    trackingOptions: 0,
    activeCategories: 0,
    inactiveCategories: 0
  });

  const [categories, setCategories] = useState<TrackingCategory[]>([]);

  // Date Range state
  const defaultFrom = searchParams.get('from_date') || '2026-08-03';
  const defaultTo = searchParams.get('to_date') || '2026-08-03';

  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [tempFromDate, setTempFromDate] = useState<string>(defaultFrom);
  const [tempToDate, setTempToDate] = useState<string>(defaultTo);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const donutChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

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

  const fetchData = async () => {
    try {
      if (initialLoading) setLoading(true);
      const res = await fetch('/api/dashboard/tracking-categories');
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary);
        setCategories(json.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch tracking categories:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentCategory = categories[0];
  const allOptions = currentCategory?.options || [];

  const filteredOptions = allOptions.filter(opt => {
    const matchesSearch = opt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (opt.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedOptionFilter === 'ALL' || opt.name.toUpperCase() === selectedOptionFilter.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  // ECharts Donut Chart Initialization (Tracking Options Distribution)
  useEffect(() => {
    if (!donutChartRef.current || loading || allOptions.length === 0) return;
    const chartInstance = echarts.init(donutChartRef.current);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

    const option = {
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#1e293b', fontSize: 12, fontFamily: 'var(--font-sans), sans-serif' },
        extraCssText: 'z-index: 99999; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); border-radius: 8px;'
      },
      series: [
        {
          name: 'Tracking Options',
          type: 'pie',
          radius: ['62%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6
          },
          data: allOptions.map((opt, i) => ({
            value: 1,
            name: opt.name,
            itemStyle: { color: colors[i % colors.length] }
          }))
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
  }, [allOptions, loading]);

  // ECharts Bar Chart Initialization (Options Usage & Status)
  useEffect(() => {
    if (!barChartRef.current || loading || allOptions.length === 0) return;
    const chartInstance = echarts.init(barChartRef.current);

    const option = {
      grid: {
        left: '2%',
        right: '2%',
        top: '16%',
        bottom: '16%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#ffffff', fontSize: 12, fontFamily: 'var(--font-sans), sans-serif' },
        extraCssText: 'z-index: 99999; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2); border-radius: 10px;',
        formatter: (params: any) => {
          const item = params[0];
          return `<div class="flex items-center gap-2 font-bold text-xs"><span class="h-2 w-2 rounded-full bg-[#00b7e2]"></span><span>${item.name}</span></div><div class="text-[11px] text-slate-300 font-medium mt-1">Used in <b class="text-white font-bold">${item.value}</b> financial reports</div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: allOptions.map(o => o.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700', interval: 0, rotate: 0 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [
        {
          name: 'Reports Usage',
          type: 'bar',
          barWidth: '38%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#00b7e2' },
              { offset: 1, color: '#2563eb' }
            ])
          },
          data: allOptions.map(o => o.usedInCount)
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
  }, [allOptions, loading]);

  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_3_months' | 'this_year') => {
    let from = '2026-08-01';
    let to = '2026-08-31';

    if (preset === 'this_month') {
      from = '2026-08-01';
      to = '2026-08-31';
    } else if (preset === 'last_month') {
      from = '2026-07-01';
      to = '2026-07-31';
    } else if (preset === 'last_3_months') {
      from = '2026-06-01';
      to = '2026-08-31';
    } else if (preset === 'this_year') {
      from = '2026-01-01';
      to = '2026-12-31';
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

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="space-y-6 max-w-full pb-10 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
            <Link href="/overview" className="hover:text-slate-700 transition">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-700 font-bold">Tracking Categories</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tracking Categories</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full uppercase tracking-wider">
              Active ({summary.activeCategories})
            </span>
          </div>
          <p className="text-[12px] text-slate-500 font-medium mt-0.5">
            Define, manage and analyze tracking dimensions to categorize and measure your business performance.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Page-Level Date Picker Dropdown */}
          <div className="relative shrink-0" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-2xs text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer outline-none"
            >
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>{formatDateLabel(fromDate)} – {formatDateLabel(toDate)}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", showDatePicker && "rotate-180")} />
            </button>

            {/* Dropdown Menu */}
            {showDatePicker && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2 px-1">Quick Select</span>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  <button
                    onClick={() => applyPreset('this_month')}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => applyPreset('last_month')}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition"
                  >
                    Last Month
                  </button>
                  <button
                    onClick={() => applyPreset('last_3_months')}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition"
                  >
                    Last 3 Months
                  </button>
                  <button
                    onClick={() => applyPreset('this_year')}
                    className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition"
                  >
                    This Year
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">Custom Range</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-400 block mb-1">From Date</label>
                      <input
                        type="date"
                        value={tempFromDate}
                        onChange={(e) => setTempFromDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-400 block mb-1">To Date</label>
                      <input
                        type="date"
                        value={tempToDate}
                        onChange={(e) => setTempToDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={applyCustomRange}
                    className="w-full py-2 mt-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11.5px] rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    Apply Date Range
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => toast.info('New Category modal feature active!')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0064eb] hover:bg-blue-700 text-white font-bold text-[11.5px] rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Tracking Category</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {initialLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4 animate-pulse">
              <div className="h-11 w-11 rounded-xl bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-slate-200/80 rounded" />
                <div className="h-6 w-12 bg-slate-200 rounded" />
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Card 1: Configured Categories */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                  <Grid className="h-5.5 w-5.5 stroke-[1.8]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Configured Categories</span>
                  <span className="text-2xl font-black text-slate-900 mt-0.5 block">{summary.configuredCategories}</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Total tracking categories</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </div>

            {/* Card 2: Tracking Options */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                  <Layers className="h-5.5 w-5.5 stroke-[1.8]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tracking Options</span>
                  <span className="text-2xl font-black text-slate-900 mt-0.5 block">{summary.trackingOptions}</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Total tracking options</span>
                </div>
              </div>
            </div>

            {/* Card 3: Active */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                  <CheckCircle2 className="h-5.5 w-5.5 stroke-[1.8]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active</span>
                  <span className="text-2xl font-black text-slate-900 mt-0.5 block">{summary.activeCategories}</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Active categories</span>
                </div>
              </div>
            </div>

            {/* Card 4: Inactive */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                  <AlertCircle className="h-5.5 w-5.5 stroke-[1.8]" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Inactive</span>
                  <span className="text-2xl font-black text-slate-900 mt-0.5 block">{summary.inactiveCategories}</span>
                  <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">Inactive categories</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Middle Section: Tracking Overview (Full Width 12 Columns for Wide Chart) */}
      <div className="w-full bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between min-h-[340px]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-[14px] font-bold text-slate-800">Tracking Overview & Intelligence</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
              7 Active Options
            </span>
          </div>
        </div>

        {initialLoading ? (
          <div className="h-64 w-full animate-pulse bg-slate-50 rounded-lg mt-3" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4 items-center">
            {/* Tracking Options Distribution (Donut Chart - lg:col-span-5) */}
            <div className="lg:col-span-5 border-r border-slate-100 pr-4">
              <h4 className="text-[12px] font-bold text-slate-700 mb-3">Tracking Options Distribution</h4>
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center h-48 w-48 shrink-0">
                  <div ref={donutChartRef} className="w-full h-full" />
                  <div className="absolute text-center flex flex-col items-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 leading-none">{summary.trackingOptions}</span>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase mt-0.5 leading-none">Total Options</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-[11px]">
                  {allOptions.map((opt, i) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
                    return (
                      <div key={opt.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="font-bold text-slate-700 truncate max-w-[110px]">{opt.name}</span>
                        </div>
                        <span className="font-semibold text-slate-500 text-[10.5px]">1 (14.29%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Options Usage Frequency Bar Chart (lg:col-span-7 - WIDE SPACE) */}
            <div className="lg:col-span-7 pl-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-[12px] font-bold text-slate-700">Options Report Frequency Usage</h4>
                  <p className="text-[10.5px] text-slate-400 font-medium">Distribution of tracking options across financial reports</p>
                </div>
                <select className="px-2.5 py-1 text-[10.5px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none">
                  <option>All Time</option>
                  <option>This Period</option>
                </select>
              </div>
              <div className="h-52 w-full">
                <div ref={barChartRef} className="w-full h-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Configured Dimensions & Quick Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Configured Dimensions Data Table (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-[13.5px] font-bold text-slate-800">Configured Dimensions</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Created on 12 May 2024</p>
            </div>
          </div>

          {/* Dimension Header Pill Box */}
          {currentCategory && (
            <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px] font-extrabold text-slate-900">{currentCategory.name}</span>
                <span className="px-2 py-0.5 text-[9.5px] font-extrabold bg-emerald-100 text-emerald-700 rounded-md uppercase tracking-wider">
                  {currentCategory.status}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium mb-3">{currentCategory.optionsCount} Tracking Options</p>

              {/* Option Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSelectedOptionFilter('ALL')}
                  className={cn(
                    "px-3 py-1 text-[10.5px] font-extrabold rounded-md uppercase tracking-wider transition cursor-pointer",
                    selectedOptionFilter === 'ALL'
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  All Options
                </button>
                {allOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOptionFilter(selectedOptionFilter === opt.name ? 'ALL' : opt.name)}
                    className={cn(
                      "px-3 py-1 text-[10.5px] font-extrabold rounded-md uppercase tracking-wider transition cursor-pointer",
                      selectedOptionFilter.toUpperCase() === opt.name.toUpperCase()
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">OPTION NAME</th>
                  <th className="py-3 px-4">DESCRIPTION</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">USED IN</th>
                  <th className="py-3 px-4">LAST TRANSACTION</th>
                  <th className="py-3 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-24 rounded-md shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-36 rounded-md shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-5 w-16 rounded-md shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-20 rounded-md shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-24 rounded-md shimmer-effect" /></td>
                      <td className="py-3.5 px-4 text-center"><div className="h-4 w-4 rounded-md shimmer-effect mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredOptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No tracking options found in PostgreSQL.
                    </td>
                  </tr>
                ) : (
                  filteredOptions.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">{row.name}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{row.description}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 text-[9.5px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded uppercase tracking-wider">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600">{row.usedInCount} Reports</td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">{row.lastTransaction}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition cursor-pointer">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11.5px] bg-slate-50/40">
            <span className="text-slate-500 font-semibold">
              Showing 1 to {filteredOptions.length} of {allOptions.length} options
            </span>
            <div className="flex items-center gap-1">
              <button disabled className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <button className="h-7 w-7 flex items-center justify-center rounded border border-blue-600 bg-blue-600 text-white font-bold text-[11px]">
                1
              </button>
              <button disabled className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Insights & About Tracking Categories (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Quick Insights Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <h4 className="text-[12.5px] font-bold text-slate-800 mb-3">Quick Insights</h4>
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Most Used Option</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">GENERAL</span>
              <span className="text-[10.5px] text-slate-500 font-semibold mt-1 block">Used in 24 reports</span>
              <div className="mt-3 flex items-center justify-between border-t border-emerald-100/80 pt-2.5">
                <span className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1">
                  View Reports <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>

          {/* About Tracking Categories Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <h3 className="text-[13.5px] font-bold text-slate-800 border-b border-slate-100 pb-3">About Tracking Categories</h3>
            <p className="text-[11.5px] text-slate-500 font-medium mt-3 leading-relaxed">
              Tracking categories help you analyze your financial data using custom dimensions.
            </p>

            <div className="space-y-3 mt-4">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-blue-50/50 border border-blue-100/60">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h5 className="text-[12px] font-bold text-slate-800">Organize Better</h5>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">Group and categorize transactions for clear visibility.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50/50 border border-amber-100/60">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <PieChart className="h-4 w-4" />
                </div>
                <div>
                  <h5 className="text-[12px] font-bold text-slate-800">Analyze Smarter</h5>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">Unlock deeper insights across reports and dashboards.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-purple-50/50 border border-purple-100/60">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h5 className="text-[12px] font-bold text-slate-800">Flexible & Scalable</h5>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">Create categories that grow with your business.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
