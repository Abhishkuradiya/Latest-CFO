"use client";

import React, { useState, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  PieChart,
  BarChart3,
  Layers,
  Scale,
  Clock,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MetricTraceabilityDrawer, TraceabilityMetric } from './MetricTraceabilityDrawer';

interface CfoExecutiveDashboardProps {
  initialTenantId?: string;
}

export function CfoExecutiveDashboard({ initialTenantId }: CfoExecutiveDashboardProps) {
  const [tenantId, setTenantId] = useState<string>(initialTenantId || '');
  const initialEndDate = new Date();
  const initialStartDate = new Date(initialEndDate.getFullYear(), 0, 1);
  const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState<string>(toDateInput(initialStartDate));
  const [endDate, setEndDate] = useState<string>(toDateInput(initialEndDate));
  const [periodPreset, setPeriodPreset] = useState<string>(`YTD_${new Date().getFullYear()}`);
  const [compareEnabled, setCompareEnabled] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [selectedTraceMetric, setSelectedTraceMetric] = useState<TraceabilityMetric | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/cfo/intelligence', window.location.origin);
      if (tenantId) url.searchParams.set('tenantId', tenantId);
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to load CFO intelligence data (${res.status})`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }

      setData(json);
    } catch (err: any) {
      console.error('CFO Intelligence fetch error:', err);
      setError(err.message || 'Unable to connect to CFO Intelligence API');
      toast.error('Failed to load CFO Intelligence', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate, tenantId]);

  const handlePeriodPresetChange = (preset: string) => {
    setPeriodPreset(preset);
    const year = new Date().getFullYear();
    if (preset === `Q2_${year}`) {
      setStartDate(`${year}-04-01`);
      setEndDate(`${year}-09-30`);
    } else if (preset === `Q1_${year}`) {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-03-31`);
    } else if (preset === `YTD_${year}`) {
      setStartDate(`${year}-01-01`);
      setEndDate(toDateInput(new Date()));
    }
  };

  const currency = data?.currency || '';
  const symbol = currency === 'GBP' ? '£' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : currency ? `${currency} ` : ''));

  const formatCurr = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'N/A';
    if (!currency) return 'N/A';
    return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'N/A';
    return `${val.toFixed(2)}%`;
  };

  const prof = data?.profitability || {};
  const wc = data?.workingCapital || {};
  const cf = data?.cashFlow || {};
  const alerts = data?.alerts || [];
  const periodComp = data?.periodComparison || {};

  // ECharts Waterfall / Revenue Trend Ref
  const waterfallChartRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!waterfallChartRef.current || !data) return;

    const chartInstance = echarts.init(waterfallChartRef.current);

    const rev = prof.revenue?.value || 0;
    const cogs = prof.costOfSales?.value ?? (prof.cogs?.value ?? (prof.grossProfit?.value ? rev - prof.grossProfit.value : 0));
    const gp = prof.grossProfit?.value || 0;
    const opex = prof.operatingExpenses?.value ?? (prof.opex?.value || 0);
    const opProfit = prof.operatingProfit?.value || 0;
    const netProfit = prof.netProfit?.value || 0;

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<div class="font-sans font-bold text-xs">${item.name}</div><div class="text-xs">${symbol}${Math.abs(item.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>`;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: ['Revenue', 'COGS', 'Gross Profit', 'OPEX', 'Operating Profit', 'Net Profit'],
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#475569', fontSize: 11, fontWeight: 'bold' }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: { color: '#64748b', fontSize: 10 }
      },
      series: [
        {
          name: 'Amount',
          type: 'bar',
          barWidth: '40%',
          data: [
            { value: rev, itemStyle: { color: '#2563eb' } },
            { value: -cogs, itemStyle: { color: '#ef4444' } },
            { value: gp, itemStyle: { color: '#10b981' } },
            { value: -opex, itemStyle: { color: '#f59e0b' } },
            { value: opProfit, itemStyle: { color: '#059669' } },
            { value: netProfit, itemStyle: { color: '#0284c7' } }
          ],
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => `${symbol}${Math.round(Math.abs(p.value)).toLocaleString()}`,
            fontSize: 10,
            fontWeight: 'bold',
            color: '#334155'
          }
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
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-8 font-sans">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">CFO Intelligence Command Center</h1>
              <p className="text-xs text-slate-500 font-medium">Executive financial overview & real-time decision engine</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-700">
            <button
              onClick={() => handlePeriodPresetChange(`Q2_${new Date().getFullYear()}`)}
              className={cn('px-3 py-1.5 rounded-lg transition-all', periodPreset === `Q2_${new Date().getFullYear()}` ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900')}
            >
              Q2 {new Date().getFullYear()} (Apr - Sep)
            </button>
            <button
              onClick={() => handlePeriodPresetChange(`Q1_${new Date().getFullYear()}`)}
              className={cn('px-3 py-1.5 rounded-lg transition-all', periodPreset === `Q1_${new Date().getFullYear()}` ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900')}
            >
              Q1 {new Date().getFullYear()}
            </button>
            <button
              onClick={() => handlePeriodPresetChange(`YTD_${new Date().getFullYear()}`)}
              className={cn('px-3 py-1.5 rounded-lg transition-all', periodPreset === `YTD_${new Date().getFullYear()}` ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900')}
            >
              YTD {new Date().getFullYear()}
            </button>
          </div>

          {/* Date Picker Inputs */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center disabled:opacity-50"
            title="Refresh Financial Data"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 2. DATA TRUST INTEGRITY BAR */}
      {data && (
        <div className="bg-white px-6 py-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-600">Data Coverage:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                {data.dataCoverage || 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Mapping Coverage:</span>
              <span className="font-bold text-slate-900">{data.mappingCoverage || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Reconciliation:</span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{data.reconciliationStatus || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>Base Currency: <strong className="text-slate-800 font-bold">{currency}</strong></span>
            <span>•</span>
            <span>Last Synced: <strong className="text-slate-800">{data.lastSynced || 'N/A'}</strong></span>
          </div>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-slate-200/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            CFO Intelligence Connection Error
          </div>
          <p className="text-xs text-red-700">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-2 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* MAIN DASHBOARD CONTENT */}
      {data && (
        <>
          {/* 3. EXECUTIVE KPI ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* 1. Revenue Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Revenue</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Revenue', value: prof.revenue?.value, period: `${startDate} to ${endDate}`, currency, formula: prof.revenue?.formula, dataCoverage: prof.revenue?.dataCoverage, mappingCoverage: prof.revenue?.mappingCoverage, warnings: prof.revenue?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                  title="View Calculation Traceability"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurr(prof.revenue?.value)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> {prof.revenue?.comparison ?? 'N/A'} vs ledger
                </span>
                <span className="text-slate-400">{prof.revenue?.confidence || 'N/A'} confidence</span>
              </div>
            </div>

            {/* 2. Gross Profit Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Gross Profit</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Gross Profit', value: prof.grossProfit?.value, period: `${startDate} to ${endDate}`, currency, formula: 'Revenue - COGS', dataCoverage: prof.grossProfit?.dataCoverage, mappingCoverage: prof.grossProfit?.mappingCoverage, warnings: prof.grossProfit?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                {formatCurr(prof.grossProfit?.value)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-semibold">Margin: {formatPct(prof.grossMarginPct?.value ?? prof.grossMargin?.value)}</span>
                <span className="text-slate-400">{prof.grossProfit?.confidence || 'N/A'}</span>
              </div>
            </div>

            {/* 3. Gross Margin Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Gross Margin</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Gross Margin', value: prof.grossMarginPct?.value ?? prof.grossMargin?.value, period: `${startDate} to ${endDate}`, currency, formula: '(GrossProfit / Revenue) * 100', dataCoverage: prof.grossMarginPct?.dataCoverage, mappingCoverage: prof.grossMarginPct?.mappingCoverage, warnings: prof.grossMarginPct?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-blue-600 tracking-tight">
                {formatPct(prof.grossMarginPct?.value ?? prof.grossMargin?.value)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-semibold">Gross Profit: {formatCurr(prof.grossProfit?.value)}</span>
                <span className="text-emerald-600 font-bold">{prof.grossMarginPct?.confidence || 'N/A'}</span>
              </div>
            </div>

            {/* 4. Operating Profit Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Operating Profit</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Operating Profit', value: prof.operatingProfit?.value, period: `${startDate} to ${endDate}`, currency, formula: 'GrossProfit - OPEX', dataCoverage: prof.operatingProfit?.dataCoverage, mappingCoverage: prof.operatingProfit?.mappingCoverage, warnings: prof.operatingProfit?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {formatCurr(prof.operatingProfit?.value)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-semibold">OPEX: {formatCurr(prof.operatingExpenses?.value ?? prof.opex?.value)}</span>
                <span className="text-slate-400">{prof.operatingProfit?.confidence || 'N/A'}</span>
              </div>
            </div>

            {/* 5. Net Profit Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Net Profit</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Net Profit', value: prof.netProfit?.value, period: `${startDate} to ${endDate}`, currency, formula: 'OperatingProfit + OtherIncome - OtherExpenses - Interest - Tax', dataCoverage: prof.netProfit?.dataCoverage, mappingCoverage: prof.netProfit?.mappingCoverage, warnings: prof.netProfit?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-indigo-600 tracking-tight">
                {formatCurr(prof.netProfit?.value)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-semibold">Margin: {formatPct(prof.netMarginPct?.value ?? prof.netMargin?.value)}</span>
                <span className="text-slate-400">{prof.netProfit?.confidence || 'N/A'}</span>
              </div>
            </div>

            {/* 6. Cash Balance Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Cash Balance</span>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Cash Balance', value: data?.metrics?.cash?.value ?? wc.cash?.value, period: `${startDate} to ${endDate}`, currency, formula: 'Sum of Bank GL Accounts', dataCoverage: data?.metrics?.cash?.dataCoverage, mappingCoverage: data?.metrics?.cash?.mappingCoverage, warnings: data?.metrics?.cash?.warnings })}
                  className="text-slate-400 group-hover:text-blue-600 transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                {formatCurr(data?.metrics?.cash?.value ?? wc.cash?.value ?? wc.cash)}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-semibold">Working Cap: {formatCurr(wc.workingCapital?.value ?? data?.metrics?.workingCapital?.value)}</span>
                <span className="text-emerald-600 font-bold">{data?.metrics?.cash?.confidence || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* 4. PROFITABILITY BRIDGE & MARGIN ANALYSIS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Financial Waterfall / Bridge */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Profitability Waterfall Bridge</h3>
                  <p className="text-xs text-slate-500">Revenue down to Net Profit canonical decomposition</p>
                </div>
                <button
                  onClick={() => setSelectedTraceMetric({ name: 'Profitability Waterfall', value: prof.netProfit?.value, period: `${startDate} to ${endDate}`, currency, formula: 'Revenue - COGS - OPEX = Net Profit', dataCoverage: prof.netProfit?.dataCoverage, mappingCoverage: prof.netProfit?.mappingCoverage })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  View calculation <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Waterfall Chart Container */}
              <div ref={waterfallChartRef} className="w-full h-72" />
            </div>

            {/* Margin Analysis Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Margin Breakdown</h3>
                <p className="text-xs text-slate-500">Canonical CFO percentage metrics</p>
              </div>

              <div className="space-y-4">
                {/* Gross Margin */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Gross Margin</span>
                    <span className="text-slate-900 font-bold">{formatPct(prof.grossMargin?.value)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, prof.grossMargin?.value || 0)}%` }} />
                  </div>
                </div>

                {/* Operating Margin */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Operating Margin</span>
                    <span className="text-slate-900 font-bold">{formatPct(prof.operatingMargin?.value)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, prof.operatingMargin?.value || 0)}%` }} />
                  </div>
                </div>

                {/* Net Margin */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Net Margin</span>
                    <span className="text-slate-900 font-bold">{formatPct(prof.netMargin?.value)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, prof.netMargin?.value || 0)}%` }} />
                  </div>
                </div>

                {/* EBITDA Margin */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">EBITDA Margin</span>
                    <span className="text-slate-500 italic font-medium">
                      {prof.ebitda?.status === 'NOT_AVAILABLE' ? 'EBITDA unavailable' : formatPct(prof.ebitdaMarginPct?.value)}
                    </span>
                  </div>
                  {prof.ebitda?.status === 'NOT_AVAILABLE' && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                      Depreciation & Amortization accounts not isolated in source GL.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. CASH, LIQUIDITY & WORKING CAPITAL SNAPSHOT */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Cash & Liquidity Snapshot</h3>
                <p className="text-xs text-slate-500">Working capital cycle, DSO, and DPO metrics</p>
              </div>
              <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span>Working Capital: <strong className="text-slate-900 text-sm font-bold">{formatCurr(wc.workingCapital?.value)}</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* AR Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>Accounts Receivable (AR)</span>
                  <span className="text-[10px] text-slate-400">Subledger</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCurr(wc.ar?.value)}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Money owed to business</span>
                  <span className="font-bold text-blue-700">DSO: {wc.dso?.value == null ? 'N/A' : `${wc.dso.value} days`}</span>
                </div>
              </div>

              {/* AP Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>Accounts Payable (AP)</span>
                  <span className="text-[10px] text-slate-400">Subledger</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCurr(wc.ap?.value)}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Money owed by business</span>
                  <span className="font-bold text-amber-700">DPO: {wc.dpo?.value == null ? 'N/A' : `${wc.dpo.value} days`}</span>
                </div>
              </div>

              {/* Cash Flow Operating */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>Operating Cash Flow</span>
                  <span className="text-[10px] text-slate-400">Direct Bank</span>
                </div>
                <div className="text-xl font-extrabold text-emerald-700">
                  {formatCurr(cf.operatingCashFlow?.value)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Net cash from operating activities
                </div>
              </div>

              {/* Cash Balance */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                  <span>Total Liquid Cash</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xl font-extrabold text-emerald-900">
                  {formatCurr(wc.cash?.value ?? wc.cash)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Reconciled against Xero Bank Accounts
                </div>
              </div>
            </div>
          </div>

          {/* 6. CFO ALERTS SECTION ("ATTENTION REQUIRED") */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Attention Required</h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {alerts.length} {alerts.length === 1 ? 'Alert' : 'Alerts'} Triggered
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Nothing requiring attention</h4>
                <p className="text-xs text-slate-500">All key financial indicators and mapping thresholds are within healthy parameters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((alert: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">{alert.type}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{alert.reason}</p>
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60 flex items-center justify-between">
                      <span>Metric: {alert.metric}</span>
                      <button
                        onClick={() => setSelectedTraceMetric({ name: alert.metric, value: alert.currentValue, period: `${startDate} to ${endDate}`, currency, warnings: [alert.reason] })}
                        className="text-amber-800 hover:underline font-bold flex items-center gap-0.5"
                      >
                        Inspect <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* METRIC TRACEABILITY DRAWER */}
      <MetricTraceabilityDrawer
        isOpen={!!selectedTraceMetric}
        onClose={() => setSelectedTraceMetric(null)}
        metric={selectedTraceMetric}
      />
    </div>
  );
}
