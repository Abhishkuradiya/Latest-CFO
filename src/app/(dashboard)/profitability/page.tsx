'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import {
  TrendingUp,
  PieChart,
  DollarSign,
  Layers,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  BriefcaseBusiness,
  FileSpreadsheet,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Percent,
  Coins,
  Activity,
  Send,
  Star,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BreakevenAnalysis } from '@/components/dashboard/BreakevenAnalysis';

type Period = 'ttm' | 'ytd' | 'quarter' | 'this_month' | 'custom';

const periods: { code: Period; label: string }[] = [
  { code: 'ttm', label: 'Trailing 12M' },
  { code: 'ytd', label: 'Year to date' },
  { code: 'quarter', label: 'This quarter' },
  { code: 'this_month', label: 'This month' },
  { code: 'custom', label: 'Custom' },
];

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ProfitabilityAnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('ttm');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customEndDate, setCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [appliedCustomStartDate, setAppliedCustomStartDate] = useState(() => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [appliedCustomEndDate, setAppliedCustomEndDate] = useState(() => toDateInputValue(new Date()));
  const [waterfallUnit, setWaterfallUnit] = useState<'amount' | 'pct'>('amount');
  const [trendTimeframe, setTrendTimeframe] = useState<'monthly' | 'quarterly' | 'yearly'>(
    'monthly',
  );
  const [cfoQuestion, setCfoQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState<string[]>([]);
  const [copilotChatId, setCopilotChatId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});

  const toggleDepartment = (deptName: string) => {
    setExpandedDepartments((prev) => ({
      ...prev,
      [deptName]: !prev[deptName],
    }));
  };

  const toggleProduct = (productName: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productName]: !prev[productName],
    }));
  };

  const toggleCustomer = (customerName: string) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [customerName]: !prev[customerName],
    }));
  };

  const [periodInfo, setPeriodInfo] = useState<any>(null);
  const [data, setData] = useState<any>({});
  const [comparisonData, setComparisonData] = useState<any>(null);

  const waterfallChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);

  const fetchProfitabilityData = useCallback(async (periodCode: string, fromDate?: string, toDate?: string) => {
    setIsLoading(true);
    setComparisonData(null);
    try {
      const params = new URLSearchParams({ period: periodCode });
      if (periodCode === 'custom') {
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
      }
      const res = await fetch(`/api/dashboard/cfo-intelligence?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        if (result.profitability?.available && result.connected) {
          setData({
            ...result.profitability,
            currency: result.currency || null,
          });
          setComparisonData(result.profitability.priorPeriod || null);
        } else {
          setData({ available: false, unavailableReason: result.profitability?.unavailableReason });
          setComparisonData(null);
          if (result.profitability?.unavailableReason)
            toast.info(result.profitability.unavailableReason);
        }
        if (result.periodInfo) {
          setPeriodInfo(result.periodInfo);
        }
      } else {
        const result = await res.json().catch(() => ({}));
        setData({
          available: false,
          unavailableReason: result.error || 'Xero profitability data is unavailable.',
        });
        toast.error(result.error || 'Xero profitability data is unavailable.');
      }
    } catch (err) {
      console.error('Failed to load profitability data:', err);
      setData({
        available: false,
        unavailableReason: 'Profitability data could not be loaded from the Xero report cache.',
      });
        setComparisonData(null);
      toast.error('Profitability data could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchProfitabilityData('ttm'), 0);
    return () => window.clearTimeout(timer);
  }, [fetchProfitabilityData]);

  const todayInputValue = toDateInputValue(new Date());
  const customDateRangeError =
    customStartDate > customEndDate
      ? 'Start date must be on or before the end date.'
      : customEndDate > todayInputValue
        ? 'End date cannot be in the future.'
        : '';

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === selectedPeriod && newPeriod !== 'custom') return;
    setSelectedPeriod(newPeriod);
    if (newPeriod === 'custom') {
      return;
    }
    setData({});
    void fetchProfitabilityData(newPeriod);
  };

  const applyCustomDateRange = () => {
    if (!customStartDate || !customEndDate || Boolean(customDateRangeError)) return;
    setData({});
    setAppliedCustomStartDate(customStartDate);
    setAppliedCustomEndDate(customEndDate);
    setSelectedPeriod('custom');
    void fetchProfitabilityData('custom', customStartDate, customEndDate);
  };

  // 1. ECharts Waterfall Chart
  useEffect(() => {
    if (
      !waterfallChartRef.current ||
      !data?.revenue ||
      data.cogs == null ||
      data.grossProfit == null ||
      data.operatingProfit == null ||
      data.profitBeforeTax == null ||
      data.netProfit == null ||
      data.operatingExpenses == null
    )
      return;
    const chart = echarts.init(waterfallChartRef.current);

    const isPct = waterfallUnit === 'pct';
    const rev = isPct ? 100 : data.revenue;
    const cogs = isPct ? (data.cogs / data.revenue) * 100 : data.cogs;
    const gp = isPct ? data.grossMarginPct : data.grossProfit;
    const opex = isPct ? (data.operatingExpenses / data.revenue) * 100 : data.operatingExpenses;
    const opProfit = isPct ? (data.operatingProfit / data.revenue) * 100 : data.operatingProfit;
    const otherItems = data.profitBeforeTax - data.operatingProfit;
    const taxMovement = data.netProfit - data.profitBeforeTax;
    const pbt = isPct ? (data.profitBeforeTax / data.revenue) * 100 : data.profitBeforeTax;
    const np = isPct ? data.netMarginPct : data.netProfit;

    const sym = data.currency === 'INR' ? '₹' : data.currency === 'USD' ? '$' : '£';
    const fmtVal = (val: number) => {
      if (isPct) return `${val.toFixed(1)}%`;
      return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const option = {
      textStyle: { fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif' },
      grid: { left: '3%', right: '4%', top: '15%', bottom: '8%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const tar = params[1] || params[0];
          return `${tar.name}: <strong>${fmtVal(tar.value)}</strong>`;
        },
      },
      xAxis: {
        type: 'category',
        data: [
          'Net Revenue',
          'Cost of\nSales',
          'Gross Profit',
          'Operating\nExpenses',
          'Operating\nProfit',
          'Other Income /\nExpenses',
          'Profit Before\nTax',
          'Tax Expense',
          'Net Profit',
        ],
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#475569', fontSize: 10, fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (val: number) => fmtVal(val),
        },
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          data: [0, rev - cogs, 0, gp - opex, 0, opProfit, 0, pbt, 0],
        },
        {
          name: 'Amount',
          type: 'bar',
          stack: 'Total',
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => fmtVal(p.value),
            color: '#1e293b',
            fontSize: 10,
            fontWeight: 'bold',
          },
          data: [
            { value: rev, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
            { value: -cogs, itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] } },
            { value: gp, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
            { value: -opex, itemStyle: { color: '#f43f5e', borderRadius: [4, 4, 0, 0] } },
            { value: opProfit, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
            {
              value: isPct ? (otherItems / data.revenue) * 100 : otherItems,
              itemStyle: {
                color: otherItems >= 0 ? '#10b981' : '#f43f5e',
                borderRadius: [4, 4, 0, 0],
              },
            },
            { value: pbt, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
            {
              value: isPct ? (taxMovement / data.revenue) * 100 : taxMovement,
              itemStyle: {
                color: taxMovement <= 0 ? '#f43f5e' : '#10b981',
                borderRadius: [4, 4, 0, 0],
              },
            },
            { value: np, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
          ],
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, waterfallUnit]);

  // 2. ECharts Profitability Trend Combo Chart
  useEffect(() => {
    if (!trendChartRef.current || !data) return;

    let chart = echarts.getInstanceByDom(trendChartRef.current);
    if (chart) {
      chart.dispose();
    }
    chart = echarts.init(trendChartRef.current);

    const sourceTrend = Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [];
    let trendData = sourceTrend;
    if (trendTimeframe !== 'monthly') {
      const groupSize = trendTimeframe === 'quarterly' ? 3 : 12;
      const groups = new Map<number, any[]>();
      for (const item of sourceTrend) {
        const group = Math.floor(item.monthIdx / groupSize);
        groups.set(group, [...(groups.get(group) || []), item]);
      }
      trendData = [...groups.entries()]
        .filter(([, items]) => items.length === groupSize)
        .map(([group, items]) => {
          const revenue = items.reduce((sum, item) => sum + item.revenue, 0);
          const grossProfit = items.reduce((sum, item) => sum + item.grossProfit, 0);
          return {
            month:
              trendTimeframe === 'quarterly' ? `Q${group + 1}` : String(new Date().getFullYear()),
            revenue,
            grossProfit,
            operatingProfit: items.every((item) => item.operatingProfit != null)
              ? items.reduce((sum, item) => sum + item.operatingProfit, 0)
              : null,
            ebitda: null,
            netProfit: items.every((item) => item.netProfit != null)
              ? items.reduce((sum, item) => sum + item.netProfit, 0)
              : null,
            grossMarginPct: revenue === 0 ? null : (grossProfit / revenue) * 100,
            operatingMarginPct:
              revenue === 0 || items.some((item) => item.operatingProfit == null)
                ? null
                : (items.reduce((sum, item) => sum + item.operatingProfit, 0) / revenue) * 100,
            netMarginPct:
              revenue === 0 || items.some((item) => item.netProfit == null)
                ? null
                : (items.reduce((sum, item) => sum + item.netProfit, 0) / revenue) * 100,
          };
        });
    }

    const months = trendData.map((d: any) => d.month);
    const revs = trendData.map((d: any) => d.revenue);
    const gps = trendData.map((d: any) => d.grossProfit);
    const ops = trendData.map((d: any) => d.operatingProfit ?? null);
    const ebitdas = trendData.map((d: any) => d.ebitda ?? null);
    const nps = trendData.map((d: any) => d.netProfit);
    const margins = trendData.map((d: any) => d.grossMarginPct ?? null);
    const operatingMargins = trendData.map((d: any) => d.operatingMarginPct ?? null);
    const netMargins = trendData.map((d: any) => d.netMarginPct ?? null);

    const sym = data.currency === 'INR' ? '₹' : data.currency === 'USD' ? '$' : '£';

    const fmtAxisLabel = (val: number) => {
      if (Math.abs(val) >= 1000000) return `${sym}${(val / 1000000).toFixed(1)}M`;
      if (Math.abs(val) >= 1000) return `${sym}${Math.round(val / 1000)}k`;
      return `${sym}${Math.round(val)}`;
    };

    const option = {
      textStyle: { fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif' },
      grid: { left: '3%', right: '5%', top: '15%', bottom: '8%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: any[]) => {
          let str = `<div style="font-weight:bold;margin-bottom:4px;">${params[0]?.name || ''}</div>`;
          params.forEach((p: any) => {
            const valStr =
              p.value == null
                ? 'N/A'
                : p.seriesName.includes('%')
                  ? `${Number(p.value).toFixed(2)}%`
                  : `${sym}${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            str += `<div style="display:flex;align-items:center;justify-between;gap:12px;font-size:11px;">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>${p.seriesName}:</span>
              <strong style="color:#fff">${valStr}</strong>
            </div>`;
          });
          return str;
        },
      },
      legend: {
        data: [
          'Revenue',
          'Gross Profit',
          'Operating Profit',
          'EBITDA',
          'Net Profit',
          'Gross Margin %',
          'Operating Margin %',
          'Net Margin %',
        ],
        right: '2%',
        top: '0%',
        textStyle: { color: '#475569', fontSize: 10, fontWeight: 600 },
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#475569', fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: `Amount (${sym})`,
          splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            formatter: (val: number) => fmtAxisLabel(val),
          },
        },
        {
          type: 'value',
          name: 'Margin %',
          splitLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
        },
      ],
      series: [
        {
          name: 'Revenue',
          type: 'bar',
          data: revs,
          itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Gross Profit',
          type: 'bar',
          data: gps,
          itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Operating Profit',
          type: 'bar',
          data: ops,
          itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'EBITDA',
          type: 'bar',
          data: ebitdas,
          itemStyle: { color: '#8b5cf6', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Net Profit',
          type: 'bar',
          data: nps,
          itemStyle: { color: '#6366f1', borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Gross Margin %',
          type: 'line',
          yAxisIndex: 1,
          data: margins,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#0d9488' },
          lineStyle: { width: 2.5, color: '#0d9488' },
        },
        {
          name: 'Operating Margin %',
          type: 'line',
          yAxisIndex: 1,
          data: operatingMargins,
          connectNulls: false,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2, color: '#f59e0b' },
        },
        {
          name: 'Net Margin %',
          type: 'line',
          yAxisIndex: 1,
          data: netMargins,
          connectNulls: false,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#ec4899' },
          lineStyle: { width: 2, color: '#ec4899' },
        },
      ],
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, trendTimeframe]);

  const fmt = (val: number | null | undefined) => {
    if (val == null || !Number.isFinite(Number(val))) return 'N/A';
    if (!data?.currency)
      return Number(val).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: data.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val));
  };

  const comparisonLabel = data?.comparisonLabel || (
    selectedPeriod === 'this_month'
      ? 'vs last month'
      : selectedPeriod === 'quarter'
        ? 'vs last quarter'
        : selectedPeriod === 'ytd'
          ? 'vs prior year to date'
          : selectedPeriod === 'custom'
            ? 'vs previous period'
          : 'vs previous 12 months'
  );

  const renderPeriodChange = (metric: string, inverse = false, percentagePoints = false) => {
    if (isLoading) {
      return <p className="mt-1 text-[10px] text-slate-400">Loading comparison…</p>;
    }
    const current = data[metric];
    const previous = comparisonData?.[metric];
    if (current == null || previous == null) {
      return <p className="mt-1 text-[11px] font-normal text-slate-400">N/A</p>;
    }
    const currentNum = Number(current);
    const previousNum = Number(previous);
    if (!Number.isFinite(currentNum) || !Number.isFinite(previousNum)) {
      return <p className="mt-1 text-[11px] font-normal text-slate-400">N/A</p>;
    }

    if (percentagePoints) {
      // Margin-based KPI calculations: Current Margin (%) - Previous Margin (%)
      const diffPp = currentNum - previousNum;
      if (Math.abs(diffPp) < 0.05) {
        return (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <span>0.0pp</span>
            <span className="font-normal text-slate-400">{comparisonLabel}</span>
          </p>
        );
      }
      const favorable = inverse ? diffPp < 0 : diffPp > 0;
      const Icon = diffPp > 0 ? ArrowUpRight : ArrowDownRight;
      const amount = `${Math.abs(diffPp).toFixed(1)}pp`;
      return (
        <p className={cn('mt-1 flex items-center gap-1 text-[11px] font-medium leading-none', favorable ? 'text-emerald-600' : 'text-rose-600')}>
          <Icon className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
          <span>{amount}</span>
          <span className="font-normal text-slate-400">{comparisonLabel}</span>
        </p>
      );
    }

    // Amount-based KPI calculations: ((Current - Previous) / ABS(Previous)) * 100
    if (previousNum === 0) {
      return <p className="mt-1 text-[11px] font-normal text-slate-400">N/A</p>;
    }

    const difference = currentNum - previousNum;
    if (Math.abs(difference) < 0.005) {
      return (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <span>0.0%</span>
          <span className="font-normal text-slate-400">{comparisonLabel}</span>
        </p>
      );
    }

    const pctChange = (difference / Math.abs(previousNum)) * 100;
    const favorable = inverse ? difference < 0 : difference > 0;
    const Icon = difference > 0 ? ArrowUpRight : ArrowDownRight;
    const amount = `${Math.abs(pctChange).toFixed(1)}%`;
    return (
      <p className={cn('mt-1 flex items-center gap-1 text-[11px] font-medium leading-none', favorable ? 'text-emerald-600' : 'text-rose-600')}>
        <Icon className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
        <span>{amount}</span>
        <span className="font-normal text-slate-400">{comparisonLabel}</span>
      </p>
    );
  };

  const kpiCards = [
    { title: 'Net Revenue', metric: 'revenue', icon: Coins, iconClass: 'bg-emerald-100 text-emerald-700' },
    { title: 'Cost of Sales', metric: 'cogs', icon: FileText, iconClass: 'bg-rose-100 text-rose-700', inverse: true },
    { title: 'Gross Profit', metric: 'grossProfit', icon: TrendingUp, iconClass: 'bg-blue-100 text-blue-700' },
    { title: 'Operating Expenses', metric: 'operatingExpenses', icon: BriefcaseBusiness, iconClass: 'bg-amber-100 text-amber-700', inverse: true },
    { title: 'Gross Margin', metric: 'grossMarginPct', icon: Percent, iconClass: 'bg-purple-100 text-purple-700', percentage: true, percentagePoints: true },
    { title: 'Operating Margin', metric: 'operatingMarginPct', icon: TrendingUp, iconClass: 'bg-teal-100 text-teal-700', percentage: true, percentagePoints: true },
    { title: 'EBITDA', metric: 'ebitda', icon: Layers, iconClass: 'bg-indigo-100 text-indigo-700' },
    { title: 'Operating Profit', metric: 'operatingProfit', icon: Sliders, iconClass: 'bg-orange-100 text-orange-700' },
    { title: 'Profit Before Tax', metric: 'profitBeforeTax', icon: DollarSign, iconClass: 'bg-sky-100 text-sky-700' },
    { title: 'Net Profit', metric: 'netProfit', icon: Activity, iconClass: 'bg-green-100 text-green-700' },
  ];

  const exportReport = async (format: 'xlsx' | 'pdf') => {
    if (!data.available) {
      toast.error('Load verified Xero profitability data before exporting.');
      return;
    }
    setExporting(format);
    try {
      const rows: Array<[string, string | number | null]> = [
        ['Organisation currency', data.currency || 'N/A'],
        ['Reporting period', periodInfo?.label || selectedPeriod],
        ['Last data source', periodInfo?.dataSource || 'Xero PostgreSQL report cache'],
        ['Net Revenue', data.revenue],
        ['Cost of Sales', data.cogs],
        ['Gross Profit', data.grossProfit],
        ['Gross Margin (%)', data.grossMarginPct],
        ['Operating Expenses', data.operatingExpenses],
        ['Operating Profit', data.operatingProfit],
        ['EBITDA', data.ebitda],
        ['Profit Before Tax', data.profitBeforeTax],
        ['Net Profit', data.netProfit],
        ['Net Margin (%)', data.netMarginPct],
      ];
      if (format === 'xlsx') {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Profitability');
        sheet.addRows([['Metric', 'Actual'], ...rows]);
        sheet.getColumn(1).width = 28;
        sheet.getColumn(2).width = 32;
        const expenses = workbook.addWorksheet('Expense Accounts');
        expenses.addRows([
          ['Xero account', 'Account type', 'Actual'],
          ...(data.expenseAnalysis || []).map((row: any) => [
            row.account,
            row.accountType,
            row.actual,
          ]),
        ]);
        const customerActivity = workbook.addWorksheet('Customer Invoices');
        customerActivity.addRows([
          ['Customer', 'Invoice activity', 'Direct costs', 'Profitability status'],
          ...(data.customerProfitability || []).map((row: any) => [
            row.customer,
            row.revenue,
            null,
            'N/A: attributable direct costs missing',
          ]),
        ]);
        const productRevenue = workbook.addWorksheet('Product Revenue');
        productRevenue.addRows([
          ['Product or service', 'Invoice line revenue', 'Gross profit', 'Margin'],
          ...(data.productProfitability || []).map((row: any) => [
            row.product,
            row.revenue,
            row.grossProfit,
            row.margin,
          ]),
        ]);
        const trackingRevenue = workbook.addWorksheet('Tracking Revenue');
        trackingRevenue.addRows([
          ['Tracking option', 'Invoice line revenue', 'Gross profit', 'Margin'],
          ...(data.departmentProfitability || []).map((row: any) => [
            row.department,
            row.revenue,
            row.grossProfit,
            row.margin,
          ]),
        ]);
        const trend = workbook.addWorksheet('Monthly Trend');
        trend.addRows([
          [
            'Period',
            'Revenue',
            'Gross profit',
            'Operating profit',
            'EBITDA',
            'Net profit',
            'Gross margin %',
            'Operating margin %',
            'Net margin %',
          ],
          ...(data.monthlyTrend || []).map((row: any) => [
            row.month,
            row.revenue,
            row.grossProfit,
            row.operatingProfit,
            row.ebitda,
            row.netProfit,
            row.grossMarginPct,
            row.operatingMarginPct,
            row.netMarginPct,
          ]),
        ]);
        const budget = workbook.addWorksheet('Budget vs Actual');
        budget.addRows([
          ['Category', 'Type', 'Budget', 'Actual'],
          ...(data.budgetVsActual || []).map((row: any) => [
            row.category,
            row.type,
            row.budget,
            row.actual,
          ]),
        ]);
        const output = await workbook.xlsx.writeBuffer();
        const url = URL.createObjectURL(
          new Blob([output], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        );
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `profitability-${selectedPeriod}.xlsx`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const { exportProfitabilityPdf } = await import('@/lib/exports/profitability-pdf');
        await exportProfitabilityPdf({
          orgName: periodInfo?.orgName || 'Virtual CFO Organization',
          currency: data.currency || 'USD',
          periodLabel: periodInfo?.label || selectedPeriod,
          dataSource: periodInfo?.dataSource || 'Xero Live Organization Ledger',
          selectedPeriod,
          data,
        });
      }
      toast.success(`${format.toUpperCase()} profitability report downloaded.`);
    } catch (error) {
      console.error('Profitability export failed:', error);
      toast.error(`Unable to export the ${format.toUpperCase()} report.`);
    } finally {
      setExporting(null);
    }
  };

  const handleAskCfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfoQuestion.trim()) return;
    if (!data.available) {
      toast.error(data.unavailableReason || 'Connect Xero and load verified financial data first.');
      return;
    }
    const q = cfoQuestion.trim();
    setCfoQuestion('');
    toast.loading('Analyzing profitability ledger data...', { id: 'ai-cfo' });
    void (async () => {
      try {
        const response = await fetch('/api/cfo/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${q}\nUse the selected profitability period ${periodInfo?.label ?? selectedPeriod}.`,
            chatId: copilotChatId,
          }),
        });
        if (!response.ok || !response.body) throw new Error('CFO AI is unavailable right now.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let answer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const event of events) {
            const line = event.split('\n').find((part) => part.startsWith('data: '));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6));
            if (payload.type === 'token') answer += payload.content || '';
            if (payload.type === 'done') setCopilotChatId(payload.chatId || null);
            if (payload.type === 'error')
              throw new Error(payload.error || 'CFO AI could not answer this question.');
          }
        }
        if (!answer.trim()) throw new Error('CFO AI returned no answer.');
        setAiAnswers((prev) => [answer, ...prev]);
        toast.success('CFO AI Analysis Generated!', { id: 'ai-cfo' });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'CFO AI could not answer this question.',
          { id: 'ai-cfo' },
        );
      }
    })();
  };

  return (
    <div className="w-full space-y-4 p-0 font-sans">
      {/* 1. Header Banner with SVG Background matching reference image */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
        {/* Official SVG Background Image */}
        <div
          className="absolute inset-0 bg-no-repeat bg-right bg-cover pointer-events-none opacity-95"
          style={{ backgroundImage: "url('/profitability-analysis-banner-bg.svg')" }}
        />

        <div className="space-y-1.5 relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>CFO Intelligence</span>
            <span>&gt;</span>
            <span className="text-[#00b7e2]">Profitability Analysis</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#00b7e2]/15 border border-[#00b7e2]/30 flex items-center justify-center text-[#00b7e2]">
              <PieChart className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
              Profitability Analysis
            </h1>
          </div>

          <p className="text-xs lg:text-sm text-slate-500 leading-relaxed font-medium">
            Understand where your business makes — and loses — money. Analyze revenue, costs,
            margins and profitability across customers, products, and departments.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void exportReport('xlsx')}
            disabled={!data.available || exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-xs px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>{exporting === 'xlsx' ? 'Exporting…' : 'Excel'}</span>
          </button>
          <button
            type="button"
            onClick={() => void exportReport('pdf')}
            disabled={!data.available || exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-xs px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
          >
            <FileText className="h-4 w-4 text-rose-600" />
            <span>{exporting === 'pdf' ? 'Exporting…' : 'PDF'}</span>
          </button>
        </div>
      </div>

      {/* Period Selection & Custom Date Range Bar */}
      <section
        aria-label="Profitability period controls"
        className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-[13px] font-semibold text-slate-600">Period:</span>
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1">
              {periods.map((option) => {
                const isActive = selectedPeriod === option.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => handlePeriodChange(option.code)}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer',
                      isActive
                        ? 'bg-[#0B1527] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {periodInfo?.startDate && periodInfo?.endDate && (
              <span className="text-[11px] text-slate-400 font-sans hidden md:inline-block">
                [{periodInfo.startDate} &rarr; {periodInfo.endDate}]
              </span>
            )}
          </div>

          {/* Custom Date Range Selector */}
          {selectedPeriod === 'custom' && (
            <div className="flex flex-wrap items-end gap-2" aria-label="Custom date range">
              <label className="grid gap-1 text-[10px] font-semibold text-slate-600">
                Start date
                <input
                  type="date"
                  aria-label="Custom range start date"
                  value={customStartDate}
                  max={customEndDate || todayInputValue}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold text-slate-600">
                End date
                <input
                  type="date"
                  aria-label="Custom range end date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  max={todayInputValue}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
                />
              </label>
              <button
                type="button"
                onClick={applyCustomDateRange}
                disabled={!customStartDate || !customEndDate || Boolean(customDateRangeError) || isLoading}
                className="h-8 rounded-lg bg-[#0B1527] px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                Apply
              </button>
              {customDateRangeError && (
                <span role="alert" className="basis-full text-[11px] text-rose-600 font-medium">
                  {customDateRangeError}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* KPI cards styled to match Budget & Variance. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const value = data[card.metric];
          return (
            <article key={card.metric} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-medium text-slate-600">{card.title}</p>
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', card.iconClass)}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                {isLoading ? '...' : value == null ? 'N/A' :  card.percentage ? `${Number(value).toFixed(2)}%` : fmt(value)}
              </p>
              {renderPeriodChange(card.metric, card.inverse, card.percentagePoints)}
            </article>
          );
        })}
      </div>
      {/* 3. Middle Row: Charts (Waterfall & Trend) matching reference image */}
      <div className="flex w-full flex-col gap-6">
        {/* Waterfall Chart Card */}
        <section
          aria-labelledby="profitability-waterfall-title"
          className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="profitability-waterfall-title" className="text-lg font-bold text-slate-900 tracking-tight">
                  Profitability Waterfall
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  From revenue to net profit - live Xero ledger calculation
                </p>
              </div>
              {/* Amount / % Selector Pills */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
                <button
                  onClick={() => setWaterfallUnit('amount')}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer',
                    waterfallUnit === 'amount'
                      ? 'bg-[#0070f3] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Amount
                </button>
                <button
                  onClick={() => setWaterfallUnit('pct')}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer',
                    waterfallUnit === 'pct'
                      ? 'bg-[#0070f3] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  % of Revenue
                </button>
              </div>
            </div>

            <div ref={waterfallChartRef} className="h-80 w-full" />
            {!isLoading &&
              (!data.available || data.operatingProfit == null || data.profitBeforeTax == null) && (
                <p className="text-xs text-slate-500">
                  N/A — verified Xero values required for each waterfall stage.
                </p>
              )}
          </div>
        </section>

        {/* Profitability Trend Combo Chart */}
        <section
          aria-labelledby="profitability-trend-title"
          className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 id="profitability-trend-title" className="text-lg font-bold text-slate-900 tracking-tight">
                  Profitability Trend
                </h2>
                <span title="Trailing monthly financial trend">
                  <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                </span>
              </div>
              {/* Monthly / Quarterly / Yearly Selector */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
                {(['monthly', 'quarterly', 'yearly'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTrendTimeframe(tf)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-lg capitalize transition cursor-pointer',
                      trendTimeframe === tf
                        ? 'bg-[#0070f3] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div ref={trendChartRef} className="h-80 w-full" />
            {!isLoading && (!data.monthlyTrend || data.monthlyTrend.length === 0) && (
              <p className="text-xs text-slate-500">
                N/A — no complete historical Xero periods were found.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 4. Breakeven Analysis */}
      <BreakevenAnalysis data={data} fmt={fmt} />

      <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Expense &amp; Cost Analysis</h2>
            <p className="text-xs text-slate-500">
              Actual Xero Profit and Loss accounts, classified by the organisation chart of
              accounts.
            </p>
          </div>
          <span className="text-xs text-slate-500">{periodInfo?.label || 'Selected period'}</span>
        </div>
        {data.expenseAnalysis?.length ? (
          <div className="overflow-x-auto custom-table-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Xero account</th>
                  <th className="pb-2">Account type</th>
                  <th className="pb-2 text-right">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px] font-medium">
                {data.expenseAnalysis.slice(0, 10).map((row: any) => (
                  <tr key={row.account}>
                    <td className="py-2.5 font-semibold text-slate-900">{row.account}</td>
                    <td className="py-2.5 text-slate-600">
                      {row.accountType === 'DIRECTCOSTS' ? 'Cost of Sales' : 'Operating Expense'}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-700">
                      {fmt(row.actual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            N/A — no expense account rows with matching Xero account classifications were
            found for this period.
          </p>
        )}
      </section>

      <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Budget vs Actual</h2>
          <p className="text-xs text-slate-500">
            Uses the existing VirtualCFO budget plan and Xero actuals for this period.
          </p>
        </div>
        {data.budgetVsActual?.length ? (
          <div className="overflow-x-auto custom-table-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Account / category</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Budget</th>
                  <th className="pb-2 text-right">Actual</th>
                  <th className="pb-2 text-right">Variance</th>
                  <th className="pb-2 text-right">Variance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px] font-medium">
                {data.budgetVsActual.map((row: any) => {
                  const variance = Number(row.actual) - Number(row.budget);
                  const favourable = row.type === 'expense' ? variance <= 0 : variance >= 0;
                  return (
                    <tr key={row.category}>
                      <td className="py-2.5 font-semibold text-slate-900">{row.category}</td>
                      <td className="py-2.5 text-slate-600">{row.type}</td>
                      <td className="py-2.5 text-right">{fmt(row.budget)}</td>
                      <td className="py-2.5 text-right">{fmt(row.actual)}</td>
                      <td
                        className={cn(
                          'py-2.5 text-right font-semibold',
                          favourable ? 'text-emerald-700' : 'text-rose-700',
                        )}
                      >
                        {fmt(variance)}
                      </td>
                      <td className="py-2.5 text-right">
                        {Number(row.budget) === 0
                          ? 'N/A'
                          : `${((variance / Number(row.budget)) * 100).toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            N/A — no non-zero saved budget values exist for this reporting period.
          </p>
        )}
      </section>

      {/* Lower analysis cards share one two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Table 1: Revenue by Customer */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col h-[460px]">
          <div className="border-b border-slate-100 pb-3 shrink-0">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Revenue by Customer</h2>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1 custom-table-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                  <th className="pb-2 w-8 bg-white">#</th>
                  <th className="pb-2 pr-3 min-w-[200px] bg-white">Customer</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[110px] bg-white">Invoice Activity</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[90px] bg-white">Direct Costs</th>
                  <th className="pb-2 text-right whitespace-nowrap min-w-[70px] bg-white">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px] font-medium">
                {(data.customerProfitability || []).slice(0, 10).map((row: any, idx: number) => {
                  const isExpanded = !!expandedCustomers[row.customer];
                  const customerInvoices = Array.isArray(row.invoices) ? row.invoices : [];
                  return (
                    <React.Fragment key={row.customer || idx}>
                      <tr className={cn("hover:bg-slate-50/80 transition", isExpanded && "bg-slate-50/70")}>
                        <td className="py-2.5 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900">
                          <button
                            type="button"
                            onClick={() => toggleCustomer(row.customer)}
                            className="group inline-flex items-center gap-2 text-left font-semibold text-slate-900 hover:text-[#0070f3] transition cursor-pointer"
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-2xs group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-[#0070f3] transition",
                                isExpanded && "border-blue-300 bg-blue-50 text-[#0070f3]"
                              )}
                              title={isExpanded ? "Collapse sub-entries" : "Expand sub-entries"}
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform duration-200",
                                  isExpanded ? "rotate-180" : "rotate-0"
                                )}
                              />
                            </span>
                            <span className="hover:underline">{row.customer}</span>
                            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {customerInvoices.length} {customerInvoices.length === 1 ? 'sub-entry' : 'sub-entries'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                          {fmt(row.revenue)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-500 whitespace-nowrap">
                          N/A
                        </td>
                        <td className="py-2.5 text-right font-semibold text-slate-500 whitespace-nowrap">
                          N/A
                        </td>
                      </tr>

                      {/* Dropdown describing sub-entries of CUSTOMER */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-3 px-3 sm:px-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    Sub-entries for {row.customer}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    ({customerInvoices.length} {customerInvoices.length === 1 ? 'record' : 'records'})
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-slate-900 tabular-nums">
                                  Total: {fmt(row.revenue)}
                                </span>
                              </div>

                              <div className="overflow-x-auto overflow-y-auto max-h-48 custom-table-scrollbar pb-1">
                                <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                                    <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                                      <th className="pb-1.5 pr-3 bg-white">Invoice # / Ref</th>
                                      <th className="pb-1.5 pr-3 bg-white">Date</th>
                                      <th className="pb-1.5 pr-3 bg-white">Description / Line Details</th>
                                      <th className="pb-1.5 pr-3 text-center bg-white">Status</th>
                                      <th className="pb-1.5 text-right bg-white">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-medium">
                                    {customerInvoices.length > 0 ? (
                                      customerInvoices.map((inv: any, iIdx: number) => {
                                      const invDateStr = inv.date
                                        ? (!isNaN(Date.parse(inv.date))
                                            ? new Date(inv.date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                              })
                                            : String(inv.date).slice(0, 10))
                                        : '—';
                                      return (
                                        <tr key={iIdx} className="hover:bg-slate-50/60">
                                          <td className="py-2 pr-3 font-semibold text-[#0070f3] whitespace-nowrap">
                                            {inv.invoiceNumber || `INV-${iIdx + 1}`}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                                            {invDateStr}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-700 max-w-xs truncate" title={inv.description}>
                                            {inv.description || 'Turnover billing item'}
                                          </td>
                                          <td className="py-2 pr-3 text-center whitespace-nowrap">
                                            <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                                              {inv.status || 'PAID'}
                                            </span>
                                          </td>
                                          <td className="py-2 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                            {fmt(inv.amount)}
                                          </td>
                                        </tr>
                                      );
                                    })
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-500 font-medium">
                                          N/A — No sub-entry invoices recorded in Xero for this customer in this period.
                                        </td>
                                      </tr>
                                    )}
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
                {(!data.customerProfitability || data.customerProfitability.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-slate-500">
                      No invoice activity for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Product / Service Profitability */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col h-[460px]">
          <div className="border-b border-slate-100 pb-3 shrink-0">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Product / Service Profitability</h2>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1 custom-table-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                  <th className="pb-2 w-8 bg-white">#</th>
                  <th className="pb-2 pr-3 min-w-[200px] bg-white">Product / Service</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[100px] bg-white">Revenue</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[90px] bg-white">Gross Profit</th>
                  <th className="pb-2 text-right whitespace-nowrap min-w-[70px] bg-white">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px] font-medium">
                {(data.productProfitability || []).slice(0, 10).map((row: any, idx: number) => {
                  const isExpanded = !!expandedProducts[row.product];
                  const productEntries = Array.isArray(row.subEntries) ? row.subEntries : [];
                  return (
                    <React.Fragment key={row.product || idx}>
                      <tr className={cn("hover:bg-slate-50/80 transition", isExpanded && "bg-slate-50/70")}>
                        <td className="py-2.5 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900 pr-3">
                          <button
                            type="button"
                            onClick={() => toggleProduct(row.product)}
                            className="group inline-flex items-center gap-2 text-left font-semibold text-slate-900 hover:text-[#0070f3] transition cursor-pointer"
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-2xs group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-[#0070f3] transition",
                                isExpanded && "border-blue-300 bg-blue-50 text-[#0070f3]"
                              )}
                              title={isExpanded ? "Collapse sub-entries" : "Expand sub-entries"}
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform duration-200",
                                  isExpanded ? "rotate-180" : "rotate-0"
                                )}
                              />
                            </span>
                            <span className="hover:underline">{row.product}</span>
                            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                              {productEntries.length} {productEntries.length === 1 ? 'sub-entry' : 'sub-entries'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                          {fmt(row.revenue)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-500 whitespace-nowrap">
                          {fmt(row.grossProfit)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 text-right font-semibold whitespace-nowrap',
                            row.margin == null
                              ? 'text-slate-500'
                              : row.margin >= 50
                                ? 'text-emerald-600'
                                : row.margin >= 30
                                  ? 'text-amber-600'
                                  : 'text-rose-600',
                          )}
                        >
                          {row.margin == null ? 'N/A' : `${row.margin}%`}
                        </td>
                      </tr>

                      {/* Dropdown describing sub-entries of Product / Service */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-3 px-3 sm:px-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    Sub-entries for {row.product}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    ({productEntries.length} {productEntries.length === 1 ? 'record' : 'records'})
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-slate-900 tabular-nums">
                                  Total: {fmt(row.revenue)}
                                </span>
                              </div>

                              <div className="overflow-x-auto overflow-y-auto max-h-48 custom-table-scrollbar pb-1">
                                <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                                    <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                                      <th className="pb-1.5 pr-3 bg-white">Customer</th>
                                      <th className="pb-1.5 pr-3 bg-white">Invoice #</th>
                                      <th className="pb-1.5 pr-3 bg-white">Date</th>
                                      <th className="pb-1.5 pr-3 text-center bg-white">Qty</th>
                                      <th className="pb-1.5 pr-3 text-right bg-white">Unit Price</th>
                                      <th className="pb-1.5 text-right bg-white">Line Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-medium">
                                    {productEntries.length > 0 ? (
                                      productEntries.map((entry: any, eIdx: number) => {
                                      const entryDateStr = entry.date
                                        ? (!isNaN(Date.parse(entry.date))
                                            ? new Date(entry.date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                              })
                                            : String(entry.date).slice(0, 10))
                                        : '—';
                                      return (
                                        <tr key={eIdx} className="hover:bg-slate-50/60">
                                          <td className="py-2 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                                            {entry.customer || 'Customer'}
                                          </td>
                                          <td className="py-2 pr-3 font-semibold text-[#0070f3] whitespace-nowrap">
                                            {entry.invoiceNumber || `INV-${eIdx + 1}`}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                                            {entryDateStr}
                                          </td>
                                          <td className="py-2 pr-3 text-center text-slate-700 whitespace-nowrap">
                                            {entry.quantity || 1}
                                          </td>
                                          <td className="py-2 pr-3 text-right text-slate-700 whitespace-nowrap tabular-nums">
                                            {fmt(entry.unitAmount)}
                                          </td>
                                          <td className="py-2 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                            {fmt(entry.amount)}
                                          </td>
                                        </tr>
                                      );
                                    })
                                    ) : (
                                      <tr>
                                        <td colSpan={6} className="py-4 text-center text-slate-500 font-medium">
                                          N/A — No sub-entry transactions recorded in Xero for this product in this period.
                                        </td>
                                      </tr>
                                    )}
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
                {(!data.productProfitability || data.productProfitability.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-slate-500">
                      Product level profitability is unavailable because attributable invoice line
                      costs are not in the stored data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3: Department / Tracking Profitability */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Department / Tracking Profitability</h2>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[220px] custom-table-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[550px]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                  <th className="pb-2 w-8 bg-white">#</th>
                  <th className="pb-2 pr-3 min-w-[160px] bg-white">Department</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[100px] bg-white">Revenue</th>
                  <th className="pb-2 text-right pr-4 whitespace-nowrap min-w-[90px] bg-white">Gross Profit</th>
                  <th className="pb-2 text-right whitespace-nowrap min-w-[70px] bg-white">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13px] font-medium">
                {(data.departmentProfitability || []).slice(0, 10).map((row: any, idx: number) => {
                  const isExpanded = !!expandedDepartments[row.department];
                  const deptEntries = Array.isArray(row.subEntries) ? row.subEntries : [];
                  return (
                    <React.Fragment key={row.department || idx}>
                      <tr className={cn("hover:bg-slate-50/80 transition", isExpanded && "bg-slate-50/70")}>
                        <td className="py-2.5 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900 pr-3">
                          <button
                            type="button"
                            onClick={() => toggleDepartment(row.department)}
                            className="group inline-flex items-center gap-2 text-left font-semibold text-slate-900 hover:text-[#0070f3] transition cursor-pointer"
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-2xs group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-[#0070f3] transition",
                                isExpanded && "border-blue-300 bg-blue-50 text-[#0070f3]"
                              )}
                              title={isExpanded ? "Collapse sub-entries" : "Expand sub-entries"}
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform duration-200",
                                  isExpanded ? "rotate-180" : "rotate-0"
                                )}
                              />
                            </span>
                            <span className="hover:underline">{row.department}</span>
                            <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                              {deptEntries.length} {deptEntries.length === 1 ? 'sub-entry' : 'sub-entries'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                          {fmt(row.revenue)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-slate-500 whitespace-nowrap">
                          {fmt(row.grossProfit)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 text-right font-semibold whitespace-nowrap',
                            row.margin == null
                              ? 'text-slate-500'
                              : row.margin >= 50
                                ? 'text-emerald-600'
                                : row.margin >= 30
                                  ? 'text-amber-600'
                                  : 'text-rose-600',
                          )}
                        >
                          {row.margin == null ? 'N/A' : `${row.margin}%`}
                        </td>
                      </tr>

                      {/* Dropdown describing sub-entries of Department */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="py-3 px-3 sm:px-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">
                                    Sub-entries for {row.department}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    ({deptEntries.length} {deptEntries.length === 1 ? 'record' : 'records'})
                                  </span>
                                </div>
                                <span className="text-xs font-bold text-slate-900 tabular-nums">
                                  Total: {fmt(row.revenue)}
                                </span>
                              </div>

                              <div className="overflow-x-auto overflow-y-auto max-h-48 custom-table-scrollbar pb-1">
                                <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                                  <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#f1f5f9]">
                                    <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white">
                                      <th className="pb-1.5 pr-3 bg-white">Customer</th>
                                      <th className="pb-1.5 pr-3 bg-white">Invoice #</th>
                                      <th className="pb-1.5 pr-3 bg-white">Date</th>
                                      <th className="pb-1.5 pr-3 bg-white">Description / Item</th>
                                      <th className="pb-1.5 text-right bg-white">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-medium">
                                    {deptEntries.length > 0 ? (
                                      deptEntries.map((entry: any, dIdx: number) => {
                                      const entryDateStr = entry.date
                                        ? (!isNaN(Date.parse(entry.date))
                                            ? new Date(entry.date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                              })
                                            : String(entry.date).slice(0, 10))
                                        : '—';
                                      return (
                                        <tr key={dIdx} className="hover:bg-slate-50/60">
                                          <td className="py-2 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                                            {entry.customer || 'Customer'}
                                          </td>
                                          <td className="py-2 pr-3 font-semibold text-[#0070f3] whitespace-nowrap">
                                            {entry.invoiceNumber || `INV-${dIdx + 1}`}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                                            {entryDateStr}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-700 max-w-xs truncate" title={entry.description}>
                                            {entry.description || 'Service line item'}
                                          </td>
                                          <td className="py-2 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                            {fmt(entry.amount)}
                                          </td>
                                        </tr>
                                      );
                                    })
                                    ) : (
                                      <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-500 font-medium">
                                          N/A — No sub-entry transactions recorded in Xero for this department in this period.
                                        </td>
                                      </tr>
                                    )}
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
                {(!data.departmentProfitability || data.departmentProfitability.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-5 text-center text-slate-500">
                      No department profitability is available because tracking category allocations
                      are not available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      {/* Margin, opportunity, and CFO AI cards continue in the same two-column grid. */}
        {/* Widget 1: Margin Distribution Progress Bars */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Margin Distribution</h2>
          {data.marginDistribution?.eligibleCount === 0 && (
            <p className="text-xs text-slate-500">
              No eligible records: customer-specific direct costs are not available from the stored
              Xero data.
            </p>
          )}

          <div className="space-y-3.5 text-xs">
            {/* High Margin */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">High Margin (&gt;50%)</span>
                <span className="text-slate-900 font-semibold">
                  {data.marginDistribution?.highMargin?.count ?? 'N/A'} ({data.marginDistribution?.highMargin?.pct == null ? 'N/A' : `${data.marginDistribution.highMargin.pct.toFixed(1)}%`})
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${data.marginDistribution?.highMargin?.pct ?? 0}%` }}
                />
              </div>
            </div>

            {/* Medium Margin */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">Medium Margin (20-50%)</span>
                <span className="text-slate-900 font-semibold">
                  {data.marginDistribution?.mediumMargin?.count ?? 'N/A'} ({data.marginDistribution?.mediumMargin?.pct == null ? 'N/A' : `${data.marginDistribution.mediumMargin.pct.toFixed(1)}%`})
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${data.marginDistribution?.mediumMargin?.pct ?? 0}%` }}
                />
              </div>
            </div>

            {/* Low Margin */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700">Low Margin (&lt;20%)</span>
                <span className="text-slate-900 font-semibold">
                  {data.marginDistribution?.lowMargin?.count ?? 'N/A'} ({data.marginDistribution?.lowMargin?.pct == null ? 'N/A' : `${data.marginDistribution.lowMargin.pct.toFixed(1)}%`})
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${data.marginDistribution?.lowMargin?.pct ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Widget 2: Top Profitability Opportunities (AI Generated) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Top Profitability Opportunities</h2>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-semibold rounded-md bg-purple-100 text-purple-800">
              AI Generated
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {(data.aiOpportunities || []).map((op: string, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition"
              >
                <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-900 font-semibold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <span className="text-slate-700 font-medium leading-tight">{op}</span>
              </div>
            ))}
            {(!data.aiOpportunities || data.aiOpportunities.length === 0) && (
              <p className="text-xs text-slate-500">
                N/A — no verified profitability insight is available for this period.
              </p>
            )}
          </div>
        </div>

        {/* Widget 3: Ask CFO AI Prompt Interface */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#0070f3]" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Ask CFO AI</h2>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Start a conversation with your financial data
            </p>

            {/* Quick prompt pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setCfoQuestion('Why did gross margin decline last month?')}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Why did gross margin decline?
              </button>
              <button
                onClick={() => setCfoQuestion('Which customers are least profitable?')}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Which customers are least profitable?
              </button>
            </div>

            {/* Answer Display */}
            {aiAnswers.length > 0 && (
              <div className="mt-2 p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-slate-800 space-y-1 font-medium max-h-24 overflow-y-auto">
                {aiAnswers.map((ans, aIdx) => (
                  <p key={aIdx} className="leading-snug">
                    {ans}
                  </p>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAskCfo} className="relative mt-2">
            <input
              type="text"
              placeholder="Ask anything about your profitability..."
              value={cfoQuestion}
              onChange={(e) => setCfoQuestion(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0070f3] text-slate-900 shadow-2xs"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 p-1.5 rounded-lg bg-[#0070f3] hover:bg-[#0060d0] text-white transition cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
