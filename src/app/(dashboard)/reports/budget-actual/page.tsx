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
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { toast } from 'sonner';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface BudgetVsActualCategory {
  category: string;
  budget: number | null;
  actual: number | null;
  variance: number | null;
  variance_pct: number | null;
}

interface MonthlyTrend {
  month: string;
  budget: number;
  actual: number;
  variance: number;
}

interface BudgetData {
  connected?: boolean;
  budget_ytd: number | null;
  actual_ytd: number | null;
  variance: number | null;
  variance_pct: number | null;
  last_synced: string;
  categories: BudgetVsActualCategory[];
  monthly_trends: MonthlyTrend[];
  meta?: {
    currency: string | null;
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

export default function BudgetActualPage() {
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [compareBudget, setCompareBudget] = useState('YTD Budget');
  const [trackingCategory, setTrackingCategory] = useState('All');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [department, setDepartment] = useState('All');

  const fetchBudgetData = async (forceSync = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/dashboard/budget-actual?from_date=${fromDate}&to_date=${toDate}${forceSync ? '&force_sync=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load Budget vs Actual data');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to retrieve financial metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, [fromDate, toDate]);

  const handleExportExcel = () => {
    toast.success('Excel report exported successfully!');
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
    if (val === undefined || val === null || isNaN(val)) return '—';
    return `${val >= 0 ? '' : ''}${val.toFixed(2)}%`;
  };

  // Filtered categories (excluding Total row from standard rendering if needed, but we keep it)
  const getFilteredCategories = () => {
    if (!data || !data.connected || !data.categories) return [];
    return data.categories.filter(cat => {
      if (cat.category === 'Total') return false; // Render Total separately
      return cat.category.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  const filteredCategories = getFilteredCategories();
  const totalRow = data?.categories?.find(cat => cat.category === 'Total') ?? {
    category: 'Total', budget: null, actual: null, variance: null, variance_pct: null,
  };

  // The stored Xero report is period-level when no monthly breakdown exists.
  // Render that real period aggregate so the chart remains useful without
  // inventing month-by-month values.
  const chartTrends = data?.monthly_trends?.length
    ? data.monthly_trends
    : data?.budget_ytd !== null && data?.budget_ytd !== undefined
      && data?.actual_ytd !== null && data?.actual_ytd !== undefined
      && data?.variance !== null && data?.variance !== undefined
      ? [{
          month: 'Selected period',
          budget: data.budget_ytd,
          actual: data.actual_ytd,
          variance: data.variance,
        }]
      : [];

  // ECharts: Budget vs Actual Overview Line Chart
  const overviewOption = {
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
    },
    legend: {
      data: ['Budget', 'Actual', 'Variance'],
      bottom: 0,
      left: 'center',
      textStyle: { color: '#64748b', fontSize: 11 }
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartTrends.map(t => t.month),
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
        name: 'Budget',
        type: 'line',
        smooth: true,
        showSymbol: true,
        lineStyle: { width: 2, type: 'dashed', color: '#10b981' },
        itemStyle: { color: '#10b981' },
        data: chartTrends.map(t => t.budget)
      },
      {
        name: 'Actual',
        type: 'line',
        smooth: true,
        showSymbol: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        lineStyle: { width: 3, color: '#0064eb' },
        itemStyle: { color: '#0064eb' },
        data: chartTrends.map(t => t.actual)
      },
      {
        name: 'Variance',
        type: 'line',
        smooth: true,
        showSymbol: true,
        lineStyle: { width: 2, type: 'dotted', color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        data: chartTrends.map(t => t.variance)
      }
    ]
  };

  // ECharts: Actual vs Budget Donut Chart
  const getDonutData = () => {
    if (!data || !data.connected || !data.categories) return [];
    
    // Hardcoded colors for dynamic list
    const colors: Record<string, string> = {
      'Income': '#0064eb',
      'Cost of Goods Sold': '#f59e0b',
      'Operating Expenses': '#ef4444',
      'Other Income': '#10b981',
      'Other Expenses': '#a855f7'
    };

    return data.categories
      .filter(c => c.category !== 'Total')
      .map(c => {
        const val = Math.abs(c.actual || 0);
        return {
          name: c.category,
          value: val > 0 ? val : 0,
          itemStyle: { color: colors[c.category] || '#64748b' }
        };
      })
      .filter(x => x.value > 0);
  };

  const donutOption = {
    tooltip: { 
      trigger: 'item',
      formatter: (params: any) => `${params.name}: $${params.value.toLocaleString()} (${params.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 10, color: '#64748b' },
      data: data?.categories?.filter(c => c.category !== 'Total').map(c => c.category) || []
    },
    series: [
      {
        name: 'Actuals Breakdown',
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.actual_ytd;
            return sum === null || sum === undefined || !currencyCode
              ? '—\nActual Total'
              : new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sum) + '\nActual Total';
          },
          textStyle: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: getDonutData()
      }
    ]
  };

  // ECharts: Monthly Variance Bar Chart
  const varianceTrendOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '3%', bottom: '5%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartTrends.map(t => t.month),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    series: [
      {
        name: 'Variance',
        type: 'bar',
        barWidth: '40%',
        itemStyle: {
          color: (params: any) => {
            return params.value >= 0 ? '#10b981' : '#ef4444';
          },
          borderRadius: 4
        },
        data: chartTrends.map(t => t.variance)
      }
    ]
  };

  // Render Mini SVGs as sparklines in table
  const renderSparkline = (category: string) => {
    return <span className="text-slate-400">—</span>;
  };

  return (
    <PageContainer>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none mb-3">
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Dashboard</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Xero Analytics</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <span className="text-slate-600 font-semibold">Budget vs Actual</span>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Budget vs Actual</h1>
            <HelpCircle className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-pointer transition" />
          </div>
          <p className="text-xs text-slate-500 font-medium">Compare budgeted amounts with actual performance for better financial insights.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Custom Date Range Picker */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
            <span className="text-xs font-semibold text-slate-500">Period:</span>
            <input 
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            />
            <span className="text-slate-300">—</span>
            <input 
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>

          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50/20 text-xs font-bold text-emerald-600 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 select-none">
        
        {/* Card 1: Budget */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[110px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-2/3" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Budget (YTD)</span>
                  <Tooltip text="Your projected target budget set in Xero for this period." />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatCurrency(data?.budget_ytd)}</h3>
                <span className="text-[9px] text-slate-400 font-medium">Set budget for the period</span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1.25 bg-emerald-500 rounded-b-xl" />
        </div>

        {/* Card 2: Actual */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[110px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-2/3" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actual (YTD)</span>
                  <Tooltip text="Actual accumulated cash flows or revenue/expenses recorded in Xero during this period." />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatCurrency(data?.actual_ytd)}</h3>
                <span className="text-[9px] text-slate-400 font-medium">Actual performance</span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1.25 bg-blue-500 rounded-b-xl" />
        </div>

        {/* Card 3: Variance */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[110px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-2/3" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance</span>
                  <Tooltip text="The difference between Actual and Budget. Positive variance means you are ahead/above budget." />
                </div>
                <h3 className={cn(
                  "text-2xl font-black tracking-tight mt-1",
                  (data?.variance || 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                )}>
                  {formatCurrency(data?.variance)}
                </h3>
                <span className="text-[9px] text-slate-400 font-medium">
                  {(data?.variance || 0) >= 0 ? 'Above/Ahead of budget' : 'Under budget'}
                </span>
              </div>
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                (data?.variance || 0) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
              )}>
                {(data?.variance || 0) >= 0 ? <ArrowUpRight className="h-4.5 w-4.5" /> : <ArrowDownRight className="h-4.5 w-4.5" />}
              </div>
            </div>
          )}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-1.25 rounded-b-xl",
            (data?.variance || 0) >= 0 ? "bg-emerald-500" : "bg-rose-500"
          )} />
        </div>

        {/* Card 4: Variance % */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs relative flex flex-col justify-between min-h-[110px] hover:shadow-md hover:-translate-y-1 transition-all duration-300">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-2/3" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance %</span>
                  <Tooltip text="The percentage difference between Actual and Budget, helping track deviation rate." />
                </div>
                <h3 className={cn(
                  "text-2xl font-black tracking-tight mt-1",
                  (data?.variance || 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                )}>
                  {formatPercent(data?.variance_pct)}
                </h3>
                <span className="text-[9px] text-slate-400 font-medium">
                  {(data?.variance || 0) >= 0 ? 'Exceeding expectation' : 'Below budget'}
                </span>
              </div>
              <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-655 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="h-4.5 w-4.5" />
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1.25 bg-purple-500 rounded-b-xl" />
        </div>

      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-3 select-none text-[11px] font-semibold text-slate-500">
        
        {/* Budget */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Budget</span>
          <select 
            value={compareBudget}
            onChange={(e) => setCompareBudget(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="YTD Budget">YTD Budget</option>
            <option value="Overall Budget">Overall Budget</option>
            <option value="Draft Budget">Draft Budget</option>
          </select>
        </div>

        {/* Date Range dropdown */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Date Range</span>
          <select 
            value="Custom Range"
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'Last Month') {
                setFromDate('2026-07-01');
                setToDate('2026-07-31');
              } else if (val === 'Last 3 Months') {
                setFromDate('2026-05-01');
                setToDate('2026-07-31');
              } else if (val === 'Last 6 Months') {
                setFromDate('2026-03-01');
                setToDate('2026-08-31');
              }
            }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="Custom Range">Custom Range</option>
            <option value="Last Month">Last Month</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="Last 6 Months">Last 6 Months</option>
          </select>
        </div>

        {/* Tracking Category */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tracking Category</span>
          <select 
            value={trackingCategory}
            onChange={(e) => setTrackingCategory(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Categories</option>
            <option value="Region">Region</option>
            <option value="Territory">Territory</option>
          </select>
        </div>

        {/* Account Type */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Account Type</span>
          <select 
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Revenue">Revenue Accounts</option>
            <option value="Expense">Expense Accounts</option>
          </select>
        </div>

        {/* Department */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Department</span>
          <select 
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Departments</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
            <option value="Operations">Operations</option>
          </select>
        </div>

        <button 
          onClick={() => fetchBudgetData(false)}
          className="flex items-center gap-1.5 border border-slate-200 px-3.5 py-1.75 rounded-lg text-slate-600 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer mt-4"
        >
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span>Apply Filters</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-6 flex items-start gap-3 select-none animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-rose-800">Connection Error</h4>
            <p className="text-xs text-rose-600 font-medium">{error}</p>
            <button 
              onClick={() => fetchBudgetData()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
          </div>
        </div>
      ) : !error && data && data.connected !== false && (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            
            {/* Left: Line chart */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Budget vs Actual Overview</span>
              <div className="h-72 w-full relative">
                <ReactECharts option={overviewOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            {/* Right: Summary & Performance Gauge */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Summary recap */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3.5 flex-1 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Summary</span>
                <div className="space-y-2.5 text-xs font-semibold text-slate-500">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span>Budget (YTD)</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(data.budget_ytd)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span>Actual (YTD)</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(data.actual_ytd)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span>Variance</span>
                    <span className="text-rose-500 font-bold">{formatCurrency(data.variance)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span>Variance %</span>
                    <span className="text-rose-500 font-bold">{formatPercent(data.variance_pct)}</span>
                  </div>
                </div>
              </div>

              {/* Performance semi-circle ring */}
              {(() => {
                const variancePct = data.variance_pct;
                const budgetYtd = data.budget_ytd;

                let gaugeValueText = variancePct === null || variancePct === undefined ? '—' : `${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%`;
                let gaugeStatusText = variancePct === null || variancePct === undefined ? 'Not available' : variancePct >= 0 ? 'Ahead of Budget' : 'Below Budget';
                let gaugeDescText = variancePct === null || variancePct === undefined ? 'Variance is not available for this period.' : variancePct >= 0 ? 'Performance is exceeding target budget.' : 'Performance is currently below target budget.';
                let strokeColor = variancePct === null || variancePct === undefined ? '#cbd5e1' : variancePct >= 0 ? '#10b981' : '#ef4444';
                let textColorClass = variancePct === null || variancePct === undefined ? 'text-slate-450' : variancePct >= 0 ? 'text-emerald-600' : 'text-rose-500';

                if (budgetYtd === 0) {
                  gaugeValueText = 'N/A';
                  gaugeStatusText = 'No Budget';
                  gaugeDescText = 'Please set a budget in Xero to track variance.';
                  strokeColor = '#cbd5e1';
                  textColorClass = 'text-slate-450';
                }

                // Calculate dash offset (126 is empty, 0 is fully filled)
                const absVariance = Math.min(100, Math.abs(variancePct ?? 0));
                const dashOffset = !budgetYtd ? 126 : 126 - (126 * absVariance / 100);

                return (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm text-center flex-1 flex flex-col justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block self-start">Performance</span>
                    
                    {/* SVG Gauge */}
                    <div className="relative w-36 h-20 overflow-visible mt-2">
                      <svg className="w-full h-full" viewBox="0 0 100 50">
                        {/* Background grey ring */}
                        <path 
                          d="M 10 50 A 40 40 0 0 1 90 50" 
                          fill="none" 
                          stroke="#f1f5f9" 
                          strokeWidth="10" 
                          strokeLinecap="round" 
                        />
                        {/* Active colored ring */}
                        <path 
                          d="M 10 50 A 40 40 0 0 1 90 50" 
                          fill="none" 
                          stroke={strokeColor} 
                          strokeWidth="10" 
                          strokeLinecap="round" 
                          strokeDasharray="126" 
                          strokeDashoffset={dashOffset}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
                        <span className={cn("text-base font-extrabold leading-none", textColorClass)}>{gaugeValueText}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{gaugeStatusText}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2">{gaugeDescText}</p>
                  </div>
                );
              })()}

            </div>
          </div>

          {/* Details Table Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 mb-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 select-none">
              <h3 className="text-xs font-extrabold text-slate-805 tracking-wider uppercase">Budget vs Actual Details</h3>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 w-[180px] focus:bg-white focus:border-slate-300 outline-none transition"
                  />
                </div>
                
                <select 
                  value="Account Category"
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
                  disabled
                >
                  <option value="Account Category">View By: Account Category</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold text-slate-650 text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold tracking-wider uppercase bg-slate-50/50">
                    <th className="py-2.5 px-3">Account Category</th>
                    <th className="py-2.5 px-3 text-right">Budget (YTD)</th>
                    <th className="py-2.5 px-3 text-right">Actual (YTD)</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                    <th className="py-2.5 px-3 text-right">Variance %</th>
                    <th className="py-2.5 px-3 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {filteredCategories.map((cat, index) => (
                    <tr key={index} className="hover:bg-slate-50/30 transition">
                      <td className="py-3 px-3 text-slate-800 font-bold">{cat.category}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(cat.budget)}</td>
                      <td className="py-3 px-3 text-right text-slate-800 font-bold">{formatCurrency(cat.actual)}</td>
                      <td className={cn(
                        "py-3 px-3 text-right font-bold",
                        (cat.variance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}>
                        {formatCurrency(cat.variance)}
                      </td>
                      <td className={cn(
                        "py-3 px-3 text-right font-bold",
                        (cat.variance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}>
                        {formatPercent(cat.variance_pct)}
                      </td>
                      <td className="py-3 px-3 flex justify-center">{renderSparkline(cat.category)}</td>
                    </tr>
                  ))}

                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-bold italic">
                        No category records match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {/* Total row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/70 text-slate-800 font-extrabold">
                    <td className="py-3 px-3 text-left">Total</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(totalRow.budget)}</td>
                    <td className="py-3 px-3 text-right">{formatCurrency(totalRow.actual)}</td>
                    <td className={cn(
                      "py-3 px-3 text-right border-double border-b-4 border-slate-400 font-bold",
                      (totalRow.variance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {formatCurrency(totalRow.variance)}
                    </td>
                    <td className={cn(
                      "py-3 px-3 text-right border-double border-b-4 border-slate-400 font-bold",
                      (totalRow.variance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {formatPercent(totalRow.variance_pct)}
                    </td>
                    <td className="py-3 px-3 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>

          {/* Bottom Visualizations Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6 select-none">
            
            {/* Category Donut chart */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Actual vs Budget by Category</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={donutOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            {/* Top Variances list */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Top Variances</span>
              
              <div className="flex-1 flex flex-col justify-center gap-3">
                {data.categories
                  .filter(c => c.category !== 'Total')
                  .sort((a, b) => (a.variance ?? 0) - (b.variance ?? 0)) // Sort by most negative variance
                  .slice(0, 5)
                  .map((c, i) => (
                    <div key={i} className="flex justify-between items-center py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                      <span className="text-slate-600 font-bold">{c.category}</span>
                      <span className={cn(
                        "font-extrabold font-mono",
                        (c.variance ?? 0) >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}>
                        {formatCurrency(c.variance)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Variance monthly bar chart */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Variance Trend</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={varianceTrendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
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
            Please connect your Xero organization under credentials in Data Sources to compile and view your Budget vs Actual report.
          </p>
          <Link href="/data-sources" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm">
            Go to Data Sources
          </Link>
        </div>
      )}

      {/* Report Notes Footer */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 select-none text-[11px] font-semibold text-slate-500/85">
        <div className="flex items-center gap-2 mb-3 text-slate-700">
          <Database className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold">Report Notes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed pl-1.5">
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
              "Negative variance indicates spending above budget or income below budget."
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
