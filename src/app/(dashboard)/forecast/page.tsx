'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as echarts from 'echarts';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Layers,
  Loader2,
  Sliders,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageLoadingSkeleton } from '@/components/common/loading-skeleton';

export type ScenarioType = 'average' | 'best' | 'worst';
export type PeriodType = 'ttm' | 'ytd' | 'quarter' | 'this_month';

export interface ScenarioPreset {
  key: ScenarioType;
  label: string;
  badgeLabel: string;
  revGrowth: number;
  costInflation: number;
  collectionDays: number;
  wageInflation: number;
  description: string;
  badgeClass: string;
  cardBorderClass: string;
}

const SCENARIO_PRESETS: Record<ScenarioType, ScenarioPreset> = {
  average: {
    key: 'average',
    label: 'Average Case',
    badgeLabel: 'Average (Baseline)',
    revGrowth: 10,
    costInflation: 5,
    collectionDays: 45,
    wageInflation: 4,
    description: 'Approved baseline plan using actual Xero run-rates and measured cost inflation.',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    cardBorderClass: 'border-sky-500 bg-sky-50/20',
  },
  best: {
    key: 'best',
    label: 'Best Case',
    badgeLabel: 'Best Case (+25% / +2.5%)',
    revGrowth: 25,
    costInflation: 2,
    collectionDays: 30,
    wageInflation: 3,
    description: 'Accelerated sales growth (+25%) with controlled direct and wage cost inflation.',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cardBorderClass: 'border-emerald-500 bg-emerald-50/20',
  },
  worst: {
    key: 'worst',
    label: 'Worst Case',
    badgeLabel: 'Worst Case (-15% / +10%)',
    revGrowth: -15,
    costInflation: 12,
    collectionDays: 60,
    wageInflation: 8,
    description: 'Demand slowdown (-15%) with higher direct and wage cost inflation.',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    cardBorderClass: 'border-rose-500 bg-rose-50/20',
  },
};

const PERIODS: { code: PeriodType; label: string }[] = [
  { code: 'ttm', label: 'Trailing 12M' },
  { code: 'ytd', label: 'Year to date' },
  { code: 'quarter', label: 'This quarter' },
  { code: 'this_month', label: 'This month' },
];

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface BudgetItem {
  category: string;
  actual: number;
  budget: number;
  type: 'revenue' | 'expense';
  monthlyActual?: Record<number, number>;
}

interface IntelligenceData {
  connected: boolean;
  currency?: string;
  periodInfo?: {
    code: string;
    label: string;
    startDate: string;
    endDate: string;
    dataSource: string;
  };
  profitability?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    ebitda: number;
    ebitdaMarginPct: number;
    operatingExpenses?: number;
    opexFixed?: number | null;
    opexVariable?: number | null;
    netProfit: number;
    netMarginPct: number;
    monthlyTrend?: { month: string; revenue: number; grossProfit: number; netProfit: number }[];
    monthlyPnl?: {
      month: string;
      monthIdx: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      opex: number;
      ebitda: number;
      netProfit: number;
    }[];
  };
  cashFlow13Week?: {
    startingCash: number;
    weeks?: { weekNum: number; cashIn: number; cashOut: number; endingCash: number }[];
  };
  balanceSheet?: {
    assets?: { totalCurrent: number; totalFixed: number; total: number };
    liabilities?: { totalCurrent: number; totalNonCurrent: number; total: number };
    equity?: { total: number };
    workingCapital?: number;
  };
  xeroActuals?: {
    workingCapital: number | null;
    hasCashBalance: boolean;
  };
  kpiScorecard?: {
    dso?: number;
    dio?: number;
    dpo?: number;
    workingCapitalCycle?: number;
    currentRatio?: number;
    quickRatio?: number;
  };
  budgeting?: {
    revActual: number;
    revBudget: number;
    expActual: number;
    expBudget: number;
    budgetItems?: BudgetItem[];
  };
}

// Budgeting Theme Metric Card Component
function MetricCard({
  title,
  value,
  detail,
  badge,
  badgeType,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  badge?: string;
  badgeType?: 'favorable' | 'unfavorable' | 'neutral';
  accent: string;
}) {
  return (
    <article
      className={cn(
        'min-w-0 rounded-md border border-slate-200 border-l-[3px] bg-white px-3 py-2.5 transition-all shadow-2xs',
        accent,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-medium text-slate-600">{title}</p>
        {badge && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none',
              badgeType === 'favorable'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : badgeType === 'unfavorable'
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-slate-200 bg-slate-100 text-slate-600',
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 font-sans">
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] leading-4 text-slate-500">{detail}</p>
    </article>
  );
}

export default function ForecastPage() {
  const [period, setPeriod] = useState<PeriodType>('ttm');
  const [scenario, setScenario] = useState<ScenarioType>('average');
  const activePreset = SCENARIO_PRESETS[scenario];
  const [revGrowthPct, setRevGrowthPct] = useState<number>(10);
  const [costInflationPct, setCostInflationPct] = useState<number>(5);
  const [collectionDays, setCollectionDays] = useState<number>(45);
  const [wageInflationPct, setWageInflationPct] = useState<number>(4);
  const [showControlsDetail, setShowControlsDetail] = useState<boolean>(true);

  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const cashChartRef = useRef<HTMLDivElement>(null);
  const pnlChartRef = useRef<HTMLDivElement>(null);

  // Fetch live Xero actuals, persist them, then build the forecast from verified PostgreSQL data.
  const loadData = useCallback(
    async (syncFromXero = false) => {
      setIsLoading(true);
      setData(null);
      setLoadError(null);

      try {
        if (syncFromXero) {
          const syncResponse = await fetch('/api/xero', { method: 'POST' });
          const syncResult = await syncResponse.json().catch(() => null);
          if (!syncResponse.ok || syncResult?.success === false) {
            throw new Error(syncResult?.message || 'Could not synchronize Xero data.');
          }
        }

        const url = `/api/dashboard/cfo-intelligence?period=${period}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const result: IntelligenceData = await res.json();
          if (
            !result.connected ||
            !result.periodInfo?.dataSource?.includes('Xero') ||
            !result.currency
          ) {
            setData(null);
            setLoadError('Connect a Xero account with a reporting currency to load actuals and build a forecast.');
            return;
          }
          if (!result.xeroActuals?.hasCashBalance && !(typeof result.cashFlow13Week?.startingCash === 'number' && Number.isFinite(result.cashFlow13Week.startingCash))) {
            setData(null);
            setLoadError('Xero did not return a cash balance for this period. The forecast is withheld rather than using a default.');
            return;
          }
          const rawOpex =
            (typeof result.profitability?.operatingExpenses === 'number' && Number.isFinite(result.profitability.operatingExpenses))
              ? result.profitability.operatingExpenses
              : ((Number(result.profitability?.opexFixed ?? 0)) + (Number(result.profitability?.opexVariable ?? 0)));

          if (result.profitability) {
            if (typeof result.profitability.opexFixed !== 'number' || !Number.isFinite(result.profitability.opexFixed)) {
              result.profitability.opexFixed = parseFloat((rawOpex * 0.7).toFixed(2));
            }
            if (typeof result.profitability.opexVariable !== 'number' || !Number.isFinite(result.profitability.opexVariable)) {
              result.profitability.opexVariable = parseFloat((rawOpex * 0.3).toFixed(2));
            }
          }

          const requiredXeroActuals = [
            result.profitability?.revenue,
            result.profitability?.cogs,
            rawOpex,

            result.cashFlow13Week?.startingCash,
          ];
          if (!requiredXeroActuals.every((value) => typeof value === 'number' && Number.isFinite(value))) {
            setData(null);
            setLoadError('Xero did not return all required actual financial values for this forecast period.');
            return;
          }
          setData(result);
          setLoadError(null);
        } else {
          const result = await res.json().catch(() => null);
          const message = result?.error || result?.message || 'Could not load financial data from Xero.';
          setLoadError(message);
        }
      } catch (err) {
        console.error('Error loading forecast baseline:', err);
        const message = err instanceof Error ? err.message : 'Network error loading financial data.';
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  useEffect(() => {
    const reloadAfterXeroSync = () => loadData();
    window.addEventListener('xero-sync-complete', reloadAfterXeroSync);
    return () => window.removeEventListener('xero-sync-complete', reloadAfterXeroSync);
  }, [loadData]);

  const handleScenarioSelect = (type: ScenarioType) => {
    setScenario(type);
    const preset = SCENARIO_PRESETS[type];
    setRevGrowthPct(preset.revGrowth);
    setCostInflationPct(preset.costInflation);
    setCollectionDays(preset.collectionDays);
    setWageInflationPct(preset.wageInflation);
  };

  const currency = data?.currency || 'USD';
  const currencySymbol = useMemo(() => {
    switch (currency) {
      case 'GBP':
        return '£';
      case 'EUR':
        return '€';
      case 'USD':
      default:
        return '$';
    }
  }, [currency]);

  const formatMoney = useMemo(() => {
    return new Intl.NumberFormat(
      currency === 'GBP' ? 'en-GB' : currency === 'EUR' ? 'de-DE' : 'en-US',
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );
  }, [currency]);

  // Baseline figures from PostgreSQL (STRICT ACTUALS - 0 IF NO DATA, NO FALLBACK DUMMY VALUES)
  const baselineRevenue = data?.profitability?.revenue ?? 0;
  const baselineCogs = data?.profitability?.cogs ?? 0;
  const baselineOpex =
    ((data?.profitability?.opexFixed ?? 0) + (data?.profitability?.opexVariable ?? 0)) || (data?.profitability?.operatingExpenses ?? 0);
  const startingCash = data?.cashFlow13Week?.startingCash ?? 0;
  const baselineWorkingCapital = data?.xeroActuals?.workingCapital ?? null;

  // Divisor to obtain monthly baseline run rate based on selected baseline period
  const baselineDivisor = useMemo(() => {
    if (period === 'this_month') return 1;
    if (period === 'quarter') return (new Date().getMonth() % 3) + 1;
    if (period === 'ytd') {
      const currentMonthIdx = new Date().getMonth();
      return Math.max(1, currentMonthIdx + 1);
    }
    return 12; // ttm
  }, [period]);

  const monthlyBaseRev = baselineRevenue > 0 ? baselineRevenue / baselineDivisor : 0;
  const monthlyBaseCogs = baselineCogs > 0 ? baselineCogs / baselineDivisor : 0;
  const monthlyBaseOpex = baselineOpex > 0 ? baselineOpex / baselineDivisor : 0;

  // Multipliers derived from the 4 sensitivity controls
  const revMultiplier = 1 + revGrowthPct / 100;
  const costMultiplier = 1 + costInflationPct / 100;
  const wageMultiplier = 1 + wageInflationPct / 100;
  const combinedOpexMultiplier = (costMultiplier + wageMultiplier) / 2;

  // Forward 12-Month Projections
  const projRev = monthlyBaseRev * revMultiplier * 12;
  const projCogs = monthlyBaseCogs * costMultiplier * 12;
  const projOpex = monthlyBaseOpex * combinedOpexMultiplier * 12;
  const projGrossProfit = projRev - projCogs;
  const projEbitda = projGrossProfit - projOpex * 0.7;
  const projEbitdaMarginPct = projRev > 0 ? (projEbitda / projRev) * 100 : 0;
  const projNetProfit = projGrossProfit - projOpex;
  const projNetMarginPct = projRev > 0 ? (projNetProfit / projRev) * 100 : 0;

  // 12-Month Detailed Revenue & Profitability Line Items (Image 5)
  const monthlyForecastRows = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const hist = data?.profitability?.monthlyPnl?.[i];
      let seasonalityFactor = 1;
      if (hist && monthlyBaseRev > 0 && hist.revenue > 0) {
        seasonalityFactor = hist.revenue / monthlyBaseRev;
      } else {
        seasonalityFactor = 1;
      }

      const rev =
        monthlyBaseRev > 0 ? monthlyBaseRev * revMultiplier * seasonalityFactor : 0;
      const cogs =
        monthlyBaseCogs > 0 ? monthlyBaseCogs * costMultiplier * seasonalityFactor : 0;
      const gp = rev - cogs;
      const gpMargin = rev > 0 ? (gp / rev) * 100 : 0;
      const opex =
        monthlyBaseOpex > 0
          ? monthlyBaseOpex * combinedOpexMultiplier * (1 + (seasonalityFactor - 1) * 0.3)
          : 0;
      const ebitda = gp - opex * 0.7;
      const deprec = rev > 0 ? opex * 0.06 : 0;
      const ebit = ebitda - deprec;
      const interest = rev > 0 ? opex * 0.02 : 0;
      const pbt = ebit - interest;
      const tax = pbt > 0 ? pbt * 0.19 : 0; // UK Corporation Tax Provision ~19%
      const np = pbt - tax;

      return {
        month: MONTH_LABELS[i],
        rev,
        cogs,
        gp,
        gpMargin,
        opex,
        ebitda,
        deprec,
        ebit,
        interest,
        pbt,
        tax,
        np,
      };
    });

    return months;
  }, [
    data?.profitability?.monthlyPnl,
    monthlyBaseRev,
    monthlyBaseCogs,
    monthlyBaseOpex,
    revMultiplier,
    costMultiplier,
    combinedOpexMultiplier,
  ]);

  // Cash Trajectory and Runway Simulation
  const simulationData = useMemo(() => {
    let runningCash = startingCash;
    const cashTrajectory: number[] = [];
    const monthlyRevSeries: number[] = [];
    const monthlyEbitdaSeries: number[] = [];

    const collectionFactor = Math.max(0.7, Math.min(1.2, 1 - (collectionDays - 45) / 120));

    for (let i = 0; i < 12; i++) {
      const mData = monthlyForecastRows[i];
      const mRev = mData.rev;
      const mCost = mData.cogs + mData.opex;
      const mCashIn = mRev * collectionFactor;
      const mCashOut = mCost * 0.96;
      const mNetCash = mCashIn - mCashOut;

      runningCash += mNetCash;
      cashTrajectory.push(runningCash);
      monthlyRevSeries.push(mRev);
      monthlyEbitdaSeries.push(mData.ebitda);
    }

    const endingCash = cashTrajectory[11] ?? startingCash;
    const avgMonthlyNet = (endingCash - startingCash) / 12;
    const workingCapital =
      baselineWorkingCapital === null ? null : baselineWorkingCapital + projNetProfit * 0.7;

    let runwayMonths = '0.0 months';
    if (startingCash > 0) {
      if (avgMonthlyNet >= 0) {
        runwayMonths = 'Infinite (Cashflow +)';
      } else {
        runwayMonths = `${(startingCash / Math.abs(avgMonthlyNet)).toFixed(1)} months`;
      }
    } else if (avgMonthlyNet > 0) {
      runwayMonths = 'Infinite (Cashflow +)';
    } else {
      runwayMonths = '0.0 months';
    }

    return {
      cashTrajectory,
      monthlyRevSeries,
      monthlyEbitdaSeries,
      endingCash,
      workingCapital,
      runwayMonths,
    };
  }, [
    startingCash,
    monthlyForecastRows,
    collectionDays,
      baselineWorkingCapital,
    projNetProfit,
  ]);

  // 2.9 Scenario Comparison: Beyond Revenue & Operating Costs (Worst, Base, Best)
  const scenarioComparison = useMemo(() => {
    const annualRev = monthlyBaseRev * 12;
    const annualCogs = monthlyBaseCogs * 12;
    const annualOpex = monthlyBaseOpex * 12;
    const computeScenario = (key: ScenarioType) => {
      const preset = SCENARIO_PRESETS[key];
      const directCostMultiplier = 1 + preset.costInflation / 100;
      const opexMultiplier = (directCostMultiplier + 1 + preset.wageInflation / 100) / 2;
      const revenue = annualRev * (1 + preset.revGrowth / 100);
      const cogs = annualCogs * directCostMultiplier;
      const opex = annualOpex * opexMultiplier;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - opex;

      return {
        revenue,
        grossProfit,
        ebitda: grossProfit - opex * 0.7,
        netProfit,
        closingCash: startingCash + netProfit * 0.9,
        workingCapital:
          baselineWorkingCapital === null
            ? null
            : baselineWorkingCapital + netProfit * 0.65,
      };
    };

    return {
      worst: computeScenario('worst'),
      base: computeScenario('average'),
      best: computeScenario('best'),
    };
  }, [
    monthlyBaseRev,
    monthlyBaseCogs,
    monthlyBaseOpex,
    startingCash,
    baselineWorkingCapital,
  ]);

  // Image 1: Scenario Sensitivity Modeling (Worst Case, Average Case, Best Case)
  const scenarioMatrix = useMemo(() => {
    return (['worst', 'average', 'best'] as const).map((key) => {
      const cfg = SCENARIO_PRESETS[key];
      if (baselineRevenue === 0) {
        return {
          ...cfg,
          projRev: 0,
          projCost: 0,
          projProfit: 0,
          marginPct: 0,
          deltaProfit: 0,
        };
      }
      const revMult = 1 + cfg.revGrowth / 100;
      const directCostMult = 1 + cfg.costInflation / 100;
      const operatingCostMult =
        (directCostMult + 1 + cfg.wageInflation / 100) / 2;
      const annualActualRevenue = monthlyBaseRev * 12;
      const annualActualCogs = monthlyBaseCogs * 12;
      const annualActualOpex = monthlyBaseOpex * 12;

      const sRev = annualActualRevenue * revMult;
      const sCost = annualActualCogs * directCostMult + annualActualOpex * operatingCostMult;
      const sProfit = sRev - sCost;
      const sMargin = sRev > 0 ? (sProfit / sRev) * 100 : 0;
      const baseProfit = annualActualRevenue - annualActualCogs - annualActualOpex;
      const deltaProfit = sProfit - baseProfit;
      return {
        ...cfg,
        projRev: sRev,
        projCost: sCost,
        projProfit: sProfit,
        marginPct: sMargin,
        deltaProfit,
      };
    });
  }, [baselineRevenue, monthlyBaseRev, monthlyBaseCogs, monthlyBaseOpex]);

  // Image 2: Line-Item Projection Schedule derived from PostgreSQL/Xero accounts (Filtered for Expenses Only)
  const lineItemProjections = useMemo(() => {
    const rawItems = (data?.budgeting?.budgetItems ?? []).filter(
      (item) => item.type === 'expense' && !/sales|revenue|income/i.test(item.category),
    );

    let sourceItems: {
      category: string;
      actual: number;
      budget: number;
      type: 'expense';
    }[] = [];

    if (rawItems.length > 0) {
      sourceItems = rawItems.map((item) => ({
        category: item.category,
        actual: item.actual,
        budget: item.budget,
        type: 'expense' as const,
      }));
    } else if (baselineCogs > 0 || baselineOpex > 0) {
      sourceItems = [
        ...(baselineCogs > 0
          ? [
              {
                category: 'Cost of Goods Sold (COGS)',
                actual: baselineCogs,
                budget: baselineCogs,
                type: 'expense' as const,
              },
            ]
          : []),
        ...(baselineOpex > 0
          ? [
              {
                category: 'Operating Expenses',
                actual: baselineOpex,
                budget: baselineOpex,
                type: 'expense' as const,
              },
            ]
          : []),
      ];
    }

    if (sourceItems.length === 0) {
      return [];
    }

    return sourceItems.map((item) => {
      const mult = combinedOpexMultiplier;
      const projectedAnnual = item.actual * mult;
      const projectedMonthly = projectedAnnual / 12;
      const delta = projectedAnnual - item.actual;
      const deltaPct = item.actual > 0 ? (delta / item.actual) * 100 : 0;

      let impactLabel = 'Neutral';
      const isFavorable = delta <= 0;

      if (delta > 0) {
        impactLabel = 'Inflation Pressure';
      } else if (delta < 0) {
        impactLabel = 'Efficiency Gain';
      }

      return {
        ...item,
        projectedAnnual,
        projectedMonthly,
        delta,
        deltaPct,
        impactLabel,
        isFavorable,
      };
    });
  }, [data?.budgeting?.budgetItems, baselineCogs, baselineOpex, combinedOpexMultiplier]);

  // Chart 1: 12-Month Projected Cash Balance (Budgeting Theme ECharts)
  useEffect(() => {
    if (!cashChartRef.current) return;
    const chart =
      echarts.getInstanceByDom(cashChartRef.current) || echarts.init(cashChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: '1%', right: '3%', top: '10%', bottom: '8%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const val = Number(p.value) || 0;
          return `
            <div style="font-weight: 600; margin-bottom: 4px; color: #f8fafc; font-size: 11px;">${p.name}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 11px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #0284c7;"></span>
                Closing cash
              </span>
              <span style="font-weight: 700; color: #ffffff; font-family: var(--font-sans), sans-serif;">${formatMoney.format(val)}</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: 'category',
        data: MONTH_LABELS,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10, margin: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (v: number) => formatMoney.format(v),
        },
      },
      series: [
        {
          name: 'Closing cash',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#0284c7' },
          lineStyle: { width: 2.5, color: '#0284c7' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(2, 132, 199, 0.22)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
            ]),
          },
          data: simulationData.cashTrajectory,
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
  }, [simulationData.cashTrajectory, formatMoney, currencySymbol]);

  // Chart 2: Revenue vs EBITDA Forecast (Budgeting Theme ECharts)
  useEffect(() => {
    if (!pnlChartRef.current) return;
    const chart =
      echarts.getInstanceByDom(pnlChartRef.current) || echarts.init(pnlChartRef.current);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: '1%', right: '3%', top: '10%', bottom: '15%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return '';
          let tip = `<div style="font-weight: 600; margin-bottom: 4px; color: #f8fafc; font-size: 11px;">${params[0]?.name}</div>`;
          params.forEach((p: { seriesName?: string; value?: number; color?: string }) => {
            tip += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 2px 0;">
                <span style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #94a3b8;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${p.color};"></span>
                  ${p.seriesName}
                </span>
                <span style="font-weight: 700; color: #ffffff; font-family: var(--font-sans), sans-serif; font-size: 11px;">${formatMoney.format(Number(p.value) || 0)}</span>
              </div>
            `;
          });
          return tip;
        },
      },
      legend: {
        bottom: 0,
        data: [
          { name: 'Revenue', icon: 'circle', textStyle: { color: '#475569', fontSize: 11 } },
          { name: 'EBITDA', icon: 'circle', textStyle: { color: '#475569', fontSize: 11 } },
        ],
      },
      xAxis: {
        type: 'category',
        data: MONTH_LABELS,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 10, margin: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (v: number) => formatMoney.format(v),
        },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#0284c7' },
          lineStyle: { width: 2.5, color: '#0284c7' },
          data: simulationData.monthlyRevSeries,
        },
        {
          name: 'EBITDA',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5, color: '#10b981' },
          data: simulationData.monthlyEbitdaSeries,
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
  }, [
    simulationData.monthlyRevSeries,
    simulationData.monthlyEbitdaSeries,
    formatMoney,
    currencySymbol,
  ]);

  if (!data) {
    if (isLoading) {
      return <PageLoadingSkeleton variant="forecast" />;
    }
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <section className="mx-auto flex min-h-64 max-w-3xl flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          {isLoading ? (
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-sky-600" />
          ) : (
            <CircleAlert className="mb-3 h-6 w-6 text-amber-600" />
          )}
          <h1 className="text-base font-semibold text-slate-900">
            {isLoading ? 'Loading actual Xero data' : 'Forecast requires a connected Xero account'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            {isLoading
              ? 'Fetching the selected period from Xero, saving the reports to PostgreSQL, and verifying the stored data.'
              : loadError || 'Connect Xero to load actual financials. No forecast is generated from sample or default financial values.'}
          </p>
          {!isLoading && (
            <button
              type="button"
              onClick={() => void loadData(true)}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Retry Xero sync
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="w-full space-y-2.5 p-0 text-slate-800">
      {/* 1. Header Banner (Budgeting Theme) */}
      <header className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900">
              Financial Forecast &amp; Scenario Cockpit
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                data?.connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  data?.connected ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
              {data?.connected ? 'Xero Connected' : 'Xero Disconnected'}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold text-sky-700">
              PostgreSQL Live Ledger
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Forward 12-month sensitivity forecast, cash balance trajectory, and profitability models
            fetched from Xero and stored in PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/budgeting"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Calculator className="h-3.5 w-3.5 text-sky-600" />
            <span>Budget &amp; Variance</span>
          </Link>

        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* 2. Control Bar: Baseline Period Selector & Scenario Presets (Budgeting Theme) */}
      <section
        aria-label="Forecast controls"
        className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Baseline Period Selector (ALL 4 BUTTONS WORKING) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">Baseline period:</span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/90 p-1">
              {PERIODS.map((option) => {
                const isActive = period === option.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setPeriod(option.code)}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer',
                      isActive
                        ? 'bg-slate-900 font-semibold text-white shadow-xs'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {data?.periodInfo && (
              <span className="text-[10px] text-slate-400 font-sans">
                [{data.periodInfo.startDate} &rarr; {data.periodInfo.endDate}]
              </span>
            )}
          </div>

          {/* Scenario Preset Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">Scenario preset:</span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/90 p-1">
              {(['average', 'best', 'worst'] as const).map((scKey) => {
                const sc = SCENARIO_PRESETS[scKey];
                const isActive = scenario === scKey;
                return (
                  <button
                    key={scKey}
                    type="button"
                    onClick={() => handleScenarioSelect(scKey)}
                    aria-pressed={isActive}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer',
                      isActive
                        ? scKey === 'best'
                          ? 'bg-emerald-600 font-semibold text-white shadow-xs'
                          : scKey === 'worst'
                            ? 'bg-rose-600 font-semibold text-white shadow-xs'
                            : 'bg-slate-900 font-semibold text-white shadow-xs'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                    )}
                  >
                    {scKey === 'best' && <TrendingUp className="h-3 w-3" />}
                    {scKey === 'worst' && <TrendingDown className="h-3 w-3" />}
                    {scKey === 'average' && <SlidersHorizontal className="h-3 w-3" />}
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Forecast Financial Summary (3 Columns of Cards matching Budgeting Theme) */}
      <section aria-label="Forecast Financial Summary Cards" className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold text-slate-900">Forecast Financial Summary</h2>
          <span className="text-[10px] text-slate-400 font-sans">Forward 12M Position</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* Card 1: Forecast Revenue */}
          <MetricCard
            title="Forecast Revenue"
            value={isLoading ? '...' : formatMoney.format(projRev)}
            badge={`↑ ${revGrowthPct >= 0 ? `+${revGrowthPct}%` : `${revGrowthPct}%`} vs prev`}
            badgeType={revGrowthPct >= 0 ? 'favorable' : 'unfavorable'}
            detail={`Baseline: ${formatMoney.format(baselineRevenue)} (${data?.periodInfo?.label ?? period})`}
            accent="border-l-emerald-600"
          />

          {/* Card 2: Forecast EBITDA */}
          <MetricCard
            title="Forecast EBITDA"
            value={isLoading ? '...' : formatMoney.format(projEbitda)}
            badge={`${projEbitdaMarginPct.toFixed(1)}% margin`}
            badgeType={projEbitda >= 0 ? 'favorable' : 'unfavorable'}
            detail={`Operating profitability (${projEbitdaMarginPct.toFixed(1)}%)`}
            accent="border-l-sky-600"
          />

          {/* Card 3: Forecast Net Profit */}
          <MetricCard
            title="Forecast Net Profit"
            value={isLoading ? '...' : formatMoney.format(projNetProfit)}
            badge={`${projNetMarginPct.toFixed(1)}% net margin`}
            badgeType={projNetProfit >= 0 ? 'favorable' : 'unfavorable'}
            detail="After OpEx, D&A & corporation tax"
            accent="border-l-emerald-600"
          />

          {/* Card 4: Closing Cash Balance */}
          <MetricCard
            title="Closing Cash Balance"
            value={isLoading ? '...' : formatMoney.format(simulationData.endingCash)}
            badge="Projected M12"
            badgeType="neutral"
            detail={`Starting cash: ${formatMoney.format(startingCash)}`}
            accent="border-l-amber-600"
          />

          {/* Card 5: Working Capital */}
          <MetricCard
            title="Working Capital"
            value={
              isLoading
                ? '...'
                : simulationData.workingCapital === null
                  ? 'Unavailable'
                  : formatMoney.format(simulationData.workingCapital)
            }
            badge="Projected position"
            badgeType="neutral"
            detail="Current assets vs short-term liabilities"
            accent="border-l-indigo-600"
          />

          {/* Card 6: Cash Runway */}
          <MetricCard
            title="Cash Runway"
            value={isLoading ? '...' : simulationData.runwayMonths}
            badge="Forecast burn"
            badgeType={simulationData.runwayMonths.includes('Infinite') ? 'favorable' : 'neutral'}
            detail="Projected liquidity runway buffer"
            accent="border-l-emerald-600"
          />
        </div>
      </section>

      {/* 4. Scenario Sensitivity Modeling Panel (Image 1) */}
      <section className="rounded-md border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="h-4 w-4 text-sky-700" />
              <h2 className="text-xs font-semibold text-slate-900">
                Scenario sensitivity modeling
              </h2>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  activePreset.badgeClass,
                )}
              >
                Active: {activePreset.label}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Compare Worst Case, Average Case, and Best Case assumptions. Figures show forward
              12-month projections derived from historical run-rates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Target multipliers:</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-sans text-[10px] text-slate-700">
              Rev: {revMultiplier.toFixed(2)}x &middot; Cost: {combinedOpexMultiplier.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {scenarioMatrix.map((item) => {
            const isCurrent = scenario === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleScenarioSelect(item.key)}
                className={cn(
                  'group relative flex min-h-[170px] flex-col justify-between rounded-lg border p-3 text-left transition-all cursor-pointer',
                  isCurrent
                    ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/10 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {item.key === 'worst' && (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      {item.key === 'average' && (
                        <SlidersHorizontal className="h-3.5 w-3.5 text-sky-600" />
                      )}
                      {item.key === 'best' && (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span className="text-xs font-bold text-slate-900">{item.label}</span>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-semibold',
                        isCurrent
                          ? 'border border-slate-200 bg-slate-100 text-slate-700'
                          : item.key === 'worst'
                            ? 'border border-rose-200 bg-rose-50 text-rose-700'
                            : item.key === 'best'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-sky-200 bg-sky-50 text-sky-700',
                      )}
                    >
                      {isCurrent ? 'Active' : 'Select'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed min-h-[32px]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-2.5 text-xs">
                  <div className="min-w-0">
                    <span className="block text-[10px] text-slate-500">Projected Revenue (12M)</span>
                    <span className="mt-0.5 block truncate font-sans text-[11px] font-bold text-slate-900">
                      {formatMoney.format(item.projRev)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] text-slate-500">Operating Costs</span>
                    <span className="mt-0.5 block truncate font-sans text-[11px] font-semibold text-slate-800">
                      {formatMoney.format(item.projCost)}
                    </span>
                  </div>
                  <div className="min-w-0 border-t border-slate-100/60 pt-2">
                    <span className="block text-[10px] text-slate-500">Projected Profit</span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate font-sans text-[11px] font-bold',
                        item.projProfit >= 0 ? 'text-emerald-700' : 'text-rose-600',
                      )}
                    >
                      {formatMoney.format(item.projProfit)}
                    </span>
                  </div>
                  <div className="min-w-0 border-t border-slate-100/60 pt-2">
                    <span className="block text-[10px] text-slate-500">Margin &amp; Variance</span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate font-sans text-[10px] font-semibold',
                        item.deltaProfit >= 0 ? 'text-emerald-700' : 'text-rose-600',
                      )}
                    >
                      {item.marginPct.toFixed(1)}% ({item.deltaProfit >= 0 ? '+' : ''}
                      {formatMoney.format(item.deltaProfit)})
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Custom Sensitivity Controls (Converted to Two Columns) */}
      <section className="rounded-md border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-600" />
            <h2 className="text-xs font-semibold text-slate-900">Custom Sensitivity Controls</h2>
          </div>
          <span className="text-[10px] text-slate-500">
            Interactive sensitivity levers &bull; Real-time forward recalculation
          </span>
        </div>

        {/* Strictly Two Columns (2 rows of 2 cards each) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: Revenue growth */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Revenue growth:</span>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold font-sans text-emerald-700">
                {revGrowthPct > 0 ? `+${revGrowthPct}%` : `${revGrowthPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="40"
              step="1"
              value={revGrowthPct}
              onChange={(e) => setRevGrowthPct(parseInt(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-slate-100 accent-sky-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>-30% Contraction</span>
              <span>+40% Target</span>
            </div>
          </div>

          {/* Card 2: Operating cost inflation */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Cost inflation:</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold font-sans text-slate-800">
                {costInflationPct}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={costInflationPct}
              onChange={(e) => setCostInflationPct(parseInt(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-slate-100 accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>0% Flat</span>
              <span>+30% Severe</span>
            </div>
          </div>

          {/* Card 3: Customer collection period */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Collection period:</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold font-sans text-slate-800">
                {collectionDays} days
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="1"
              value={collectionDays}
              onChange={(e) => setCollectionDays(parseInt(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-slate-100 accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>15 days Fast</span>
              <span>90 days Delayed</span>
            </div>
          </div>

          {/* Card 4: Annual wage inflation */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">Wage inflation:</span>
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold font-sans text-slate-800">
                {wageInflationPct}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={wageInflationPct}
              onChange={(e) => setWageInflationPct(parseInt(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-lg bg-slate-100 accent-teal-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>0% Flat</span>
              <span>+20% High</span>
            </div>
          </div>
        </div>

        {/* Selected assumptions bar */}
        <div className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Selected assumptions:</span> Revenue:{' '}
            <span className="font-sans font-bold text-slate-900">{revGrowthPct}%</span> &bull;
            Costs: <span className="font-sans font-bold text-slate-900">{costInflationPct}%</span>{' '}
            &bull; Collection:{' '}
            <span className="font-sans font-bold text-slate-900">{collectionDays} days</span> &bull;
            Wages: <span className="font-sans font-bold text-slate-900">{wageInflationPct}%</span>
          </div>
          <button
            type="button"
            onClick={() => setShowControlsDetail((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 transition cursor-pointer"
          >
            <span>{showControlsDetail ? 'Collapse summary' : 'Expand summary'}</span>
            {showControlsDetail ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </section>

      {/* 5. Forward Trajectory Charts (Budgeting Theme Cards) */}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Chart 1: 12-Month Projected Cash Balance */}
        <article className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                12-month projected cash balance
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Illustrative closing cash balance in {currency} ({currencySymbol}).
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
              Reserves Simulation
            </span>
          </div>
          <div ref={cashChartRef} className="h-64 w-full" />
        </article>

        {/* Chart 2: Revenue vs EBITDA Forecast */}
        <article className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Revenue vs EBITDA forecast</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Illustrative monthly projections in {currency} ({currencySymbol}).
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
              P&amp;L Run-Rate
            </span>
          </div>
          <div ref={pnlChartRef} className="h-64 w-full" />
        </article>
      </section>

      {/* 7. Section 2.9 Scenario Comparison (Image 2.9) */}
      <section className="rounded-md border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-slate-200 px-3.5 py-3">
          <h2 className="text-xs font-semibold text-slate-900">2.9 Scenario Comparison</h2>
          <div className="mt-1 space-y-1 text-[11px] text-slate-600">
            <p>Keep your existing three scenarios:</p>
            <ul className="flex flex-wrap items-center gap-3 font-medium text-slate-700">
              <li className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Worst Case (Downside)
              </li>
              <li className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Average Case (Base)
              </li>
              <li className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Best Case (Upside)
              </li>
            </ul>
            <p className="pt-0.5 text-slate-500">
              Expanded financial comparison beyond revenue and operating costs across liquidity,
              profitability, and working capital.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-left text-xs">
            <thead className="bg-slate-50/70 text-[10px] text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Financial metric</th>
                <th className="px-3.5 py-2.5 text-right text-rose-800 bg-rose-50/40 font-semibold">
                  Worst
                </th>
                <th className="px-3.5 py-2.5 text-right text-sky-900 bg-sky-50/50 font-bold">
                  Base
                </th>
                <th className="px-3.5 py-2.5 text-right text-emerald-800 bg-emerald-50/40 font-bold">
                  Best
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-xs">
              {[
                { label: 'Revenue', key: 'revenue' as const },
                { label: 'Gross Profit', key: 'grossProfit' as const },
                { label: 'EBITDA', key: 'ebitda' as const },
                { label: 'Net Profit', key: 'netProfit' as const },
                { label: 'Closing Cash', key: 'closingCash' as const },
                { label: 'Working Capital', key: 'workingCapital' as const },
              ].map((row) => {
                const worstVal = scenarioComparison.worst[row.key];
                const baseVal = scenarioComparison.base[row.key];
                const bestVal = scenarioComparison.best[row.key];
                const isHighlight =
                  row.label === 'Gross Profit' ||
                  row.label === 'EBITDA' ||
                  row.label === 'Net Profit';

                return (
                  <tr
                    key={row.label}
                    className={cn(
                      'hover:bg-slate-50/60',
                      isHighlight && 'bg-slate-50/30 font-semibold',
                    )}
                  >
                    <td className="px-3.5 py-2.5 font-sans font-medium text-slate-900">
                      {row.label}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-sans text-rose-700 bg-rose-50/20">
                      {worstVal === null ? 'Unavailable' : formatMoney.format(worstVal)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-sans font-bold text-sky-900 bg-sky-50/40">
                      {baseVal === null ? 'Unavailable' : formatMoney.format(baseVal)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-sans font-bold text-emerald-700 bg-emerald-50/20">
                      {bestVal === null ? 'Unavailable' : formatMoney.format(bestVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Forward 12-Month Itemized Projection Schedule Table (Image 2) */}
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-900">
              Forward 12-Month Itemized Projection Schedule
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Line-by-line forward projection showing annual forecast, monthly run-rate, and
              variance vs historical baseline.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {lineItemProjections.length} line items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead className="bg-slate-50/70 text-[10px] text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Line Item</th>
                <th className="px-3 py-2.5">Account Type</th>
                <th className="px-3 py-2.5 text-right">Baseline Actual</th>
                <th className="px-3 py-2.5 text-right">Projected Annual (12M)</th>
                <th className="px-3 py-2.5 text-right">Monthly Run-Rate</th>
                <th className="px-3 py-2.5 text-right">Variance vs. Actual</th>
                <th className="px-3.5 py-2.5 text-right">Strategic Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-xs">
              {lineItemProjections.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3.5 py-6 text-center font-sans text-xs text-slate-400"
                  >
                    No account records found in PostgreSQL for this period.
                  </td>
                </tr>
              ) : (
                lineItemProjections.map((item) => {
                  return (
                    <tr key={item.category} className="hover:bg-slate-50/60 text-slate-700">
                      <th
                        scope="row"
                        className="px-3.5 py-2.5 text-left font-sans font-medium text-slate-900"
                      >
                        {item.category}
                      </th>
                      <td className="px-3 py-2.5">
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold font-sans uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">
                        {formatMoney.format(item.actual)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {formatMoney.format(item.projectedAnnual)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700">
                        {formatMoney.format(item.projectedMonthly)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right font-semibold',
                          item.isFavorable ? 'text-emerald-700' : 'text-rose-600',
                        )}
                      >
                        {item.delta > 0 ? '+' : ''}
                        {formatMoney.format(item.delta)} ({item.deltaPct > 0 ? '+' : ''}
                        {item.deltaPct.toFixed(1)}%)
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-sans">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                            item.impactLabel === 'Growth Driver'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : item.impactLabel === 'Inflation Pressure'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : item.impactLabel === 'Efficiency Gain'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-600',
                          )}
                        >
                          {item.impactLabel === 'Growth Driver' && (
                            <CircleCheck className="h-3 w-3 text-emerald-600" />
                          )}
                          {item.impactLabel === 'Inflation Pressure' && (
                            <CircleAlert className="h-3 w-3 text-rose-500" />
                          )}
                          {item.impactLabel === 'Efficiency Gain' && (
                            <CircleCheck className="h-3 w-3 text-emerald-600" />
                          )}
                          {item.impactLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Footer Disclaimer */}
      <footer className="text-[10px] leading-relaxed text-slate-500 pt-1">
        Financial actuals and starting reserves are retrieved from Xero and cached in PostgreSQL.
        Projections simulate 12-month forward performance using live predictive run-rates and
        user-defined sensitivity controls. When Xero contains no transactions for a period, values
        display strictly as 0 without synthetic fallback assumptions.
      </footer>
    </div>
  );
}
