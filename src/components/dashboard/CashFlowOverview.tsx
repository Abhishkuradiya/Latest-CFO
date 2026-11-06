'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  TrendingUp,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShieldCheck,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  Sparkles,
  Database,
  Activity,
  Lock,
  Layers,
  Eye,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════
interface CashFlowHistoryItem {
  month: string;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}

interface CashFlowDetailedItem extends CashFlowHistoryItem {
  cashInFromPayments: number;
  cashInFromBankTxns: number;
  cashInFromPrepayments: number;
  cashInFromOverpayments: number;
  reconciledIn: number;
  pendingIn: number;
}

interface CashFlowData {
  summary: {
    cashIn: number;
    cashOut: number;
    netCashFlow: number;
    incomingPaymentsCount?: number;
    outgoingPaymentsCount?: number;
  };
  breakdown: {
    cashInFromPayments: number;
    cashInFromBankTxns: number;
    cashInFromPrepayments: number;
    cashInFromOverpayments: number;
    duplicatesSkipped: number;
  };
  sources: {
    payments: { count: number; total: number; enabled: boolean };
    bankTransactions: { count: number; total: number; enabled: boolean };
    prepayments: { count: number; total: number; enabled: boolean };
    overpayments: { count: number; total: number; enabled: boolean };
    bankTransfers: { count: number; total: number; enabled: boolean; reason: string };
  };
  reconciliation: {
    reconciledCount: number;
    pendingCount: number;
    reconciledPercentage: number;
    reconciledAmount: number;
    pendingAmount: number;
  };
  dataQuality: {
    paymentsImported: boolean;
    bankFeedImported: boolean;
    reconciliationRate: number;
    duplicatesDetected: number;
    pendingReview: number;
    confidenceScore: number;
  };
  meta: {
    calculatedAt: string;
    dataSourcesUsed: string[];
    deduplicationMethod: string;
    totalRecordsProcessed: number;
    totalRecordsSkipped: number;
  };
  history: CashFlowHistoryItem[];
  historyDetailed: CashFlowDetailedItem[];
}

type CalcMode = 'hybrid' | 'verified' | 'accounting';
type Timeline = 'Monthly' | 'Quarterly' | 'Yearly';
type Verification = 'all' | 'reconciled' | 'pending';

interface CashFlowPrefs {
  calcMode: CalcMode;
  timeline: Timeline;
  verification: Verification;
  sources: { payments: boolean; bankTransactions: boolean; prepayments: boolean; overpayments: boolean };
}

const DEFAULT_PREFS: CashFlowPrefs = {
  calcMode: 'hybrid',
  timeline: 'Monthly',
  verification: 'all',
  sources: { payments: true, bankTransactions: true, prepayments: true, overpayments: true }
};

const PREFS_KEY = 'vcfo-cashflow-prefs';

function loadPrefs(): CashFlowPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PREFS;
}

function savePrefs(prefs: CashFlowPrefs) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════
function fmt(amount: number, currencyCode: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currencyCode || '$'}${amount.toLocaleString()}`;
  }
}

function fmtPct(val: number): string {
  return `${val}%`;
}

function confidenceColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-500';
}

function confidenceBg(score: number): string {
  if (score >= 90) return 'bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function confidenceDot(score: number): string {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

// ════════════════════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════════════════════
function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm animate-pulse select-none">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="space-y-2">
          <div className="h-5 w-44 bg-slate-200 rounded-md" />
          <div className="h-3 w-72 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="h-10 bg-slate-50 rounded-lg mt-4" />
      <div className="flex gap-6 mt-5">
        <div className="w-[68%] h-[260px] bg-slate-50 rounded-xl" />
        <div className="w-[32%] space-y-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-slate-100 rounded" />
              <div className="h-5 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ERROR STATE
// ════════════════════════════════════════════════════════════════
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm flex flex-col items-center justify-center text-center select-none min-h-[400px]">
      <div className="h-12 w-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1">Failed to Load Cash Flow</h4>
      <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mb-5">
        We couldn't retrieve cash flow transaction metrics. Please check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-2"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Retry</span>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SEGMENTED TOGGLE
// ════════════════════════════════════════════════════════════════
function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  size = 'sm'
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'xs' }) {
  return (
    <div className="flex bg-slate-100/80 p-0.5 rounded-lg">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md font-semibold transition-all duration-200 cursor-pointer outline-none",
            size === 'sm' ? "px-3 py-1.5 text-[11px]" : "px-2.5 py-1 text-[10px]",
            value === opt.value
              ? "bg-white text-slate-800 shadow-sm border border-slate-200/60"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONFIDENCE BADGE
// ════════════════════════════════════════════════════════════════
function ConfidenceBadge({ score, onClick }: { score: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 hover:shadow-sm cursor-pointer",
        confidenceBg(score), confidenceColor(score)
      )}
    >
      <span className={cn("h-2 w-2 rounded-full animate-pulse", confidenceDot(score))} />
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>Financial Integrity: {score}%</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// PROGRESS BAR (micro)
// ════════════════════════════════════════════════════════════════
function MicroProgress({ value, color = 'bg-emerald-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// METHODOLOGY POPOVER
// ════════════════════════════════════════════════════════════════
function MethodologyPanel({ data, onClose }: { data: CashFlowData; onClose: () => void }) {
  const { meta, dataQuality, breakdown } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Lock className="h-4 w-4 text-slate-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Calculation Methodology</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="space-y-3 text-xs text-slate-600">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Mode</span><span className="font-semibold text-slate-700">Hybrid Cash Flow</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Sources Used</span><span className="font-semibold text-slate-700">{meta.dataSourcesUsed.join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Excluded</span><span className="font-semibold text-slate-700">Bank Transfers, Duplicates</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Deduplication</span><span className="font-semibold text-slate-700">{meta.deduplicationMethod}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Records Processed</span><span className="font-semibold text-slate-700">{meta.totalRecordsProcessed}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Duplicates Removed</span><span className="font-semibold text-slate-700">{meta.totalRecordsSkipped}</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Data Quality</span><span className={cn("font-bold", confidenceColor(dataQuality.confidenceScore))}>{dataQuality.confidenceScore}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400 font-medium">Last Calculated</span><span className="font-semibold text-slate-700">{new Date(meta.calculatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
export function CashFlowOverview({ currency = 'USD' }: { currency?: string }) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [prefs, setPrefs] = useState<CashFlowPrefs>(DEFAULT_PREFS);
  const [showConfig, setShowConfig] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  // Load prefs on mount
  useEffect(() => { setPrefs(loadPrefs()); }, []);

  const updatePrefs = useCallback((partial: Partial<CashFlowPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      savePrefs(next);
      return next;
    });
  }, []);

  const fetchCashFlow = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch('/api/dashboard/cash-flow', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashFlow();
    const handleSync = () => fetchCashFlow();
    window.addEventListener('xero-sync-complete', handleSync);
    return () => window.removeEventListener('xero-sync-complete', handleSync);
  }, []);

  // ─── Filtered Chart Data ───
  const { chartLabels, cashInValues, cashOutValues, netValues } = useMemo(() => {
    if (!data) return { chartLabels: [], cashInValues: [], cashOutValues: [], netValues: [] };

    // Apply calculation mode filter to historyDetailed
    const detailed = data.historyDetailed || [];
    const filtered = detailed.map(h => {
      let cashIn = 0;
      if (prefs.calcMode === 'verified') {
        // Verified: only bank-verified transactions
        if (prefs.sources.bankTransactions) cashIn += h.cashInFromBankTxns;
      } else if (prefs.calcMode === 'accounting') {
        // Accounting: only invoice-based payments
        if (prefs.sources.payments) cashIn += h.cashInFromPayments;
      } else {
        // Hybrid: all enabled sources
        if (prefs.sources.payments) cashIn += h.cashInFromPayments;
        if (prefs.sources.bankTransactions) cashIn += h.cashInFromBankTxns;
        if (prefs.sources.prepayments) cashIn += h.cashInFromPrepayments;
        if (prefs.sources.overpayments) cashIn += h.cashInFromOverpayments;
      }

      // Apply verification filter
      if (prefs.verification === 'reconciled' && h.reconciledIn < cashIn) {
        cashIn = h.reconciledIn;
      } else if (prefs.verification === 'pending') {
        cashIn = h.pendingIn;
      }

      return { month: h.month, cashIn, cashOut: h.cashOut, net: cashIn - h.cashOut };
    });

    // Aggregate by timeline
    if (prefs.timeline === 'Monthly') {
      return {
        chartLabels: filtered.map(f => f.month),
        cashInValues: filtered.map(f => f.cashIn),
        cashOutValues: filtered.map(f => f.cashOut),
        netValues: filtered.map(f => f.net)
      };
    } else if (prefs.timeline === 'Quarterly') {
      const qMap: Record<string, { cashIn: number; cashOut: number; net: number }> = {};
      filtered.forEach(item => {
        let q = 'Q1';
        if (['Jan','Feb','Mar'].includes(item.month)) q = 'Q1';
        else if (['Apr','May','Jun'].includes(item.month)) q = 'Q2';
        else if (['Jul','Aug','Sep'].includes(item.month)) q = 'Q3';
        else q = 'Q4';
        if (!qMap[q]) qMap[q] = { cashIn: 0, cashOut: 0, net: 0 };
        qMap[q].cashIn += item.cashIn;
        qMap[q].cashOut += item.cashOut;
        qMap[q].net += item.net;
      });
      const keys = Object.keys(qMap);
      return { chartLabels: keys, cashInValues: keys.map(k => qMap[k].cashIn), cashOutValues: keys.map(k => qMap[k].cashOut), netValues: keys.map(k => qMap[k].net) };
    } else {
      const totIn = filtered.reduce((s, f) => s + f.cashIn, 0);
      const totOut = filtered.reduce((s, f) => s + f.cashOut, 0);
      return { chartLabels: ['Full Year'], cashInValues: [totIn], cashOutValues: [totOut], netValues: [totIn - totOut] };
    }
  }, [data, prefs]);

  // ─── Filtered summary values ───
  const filteredCashIn = useMemo(() => cashInValues.reduce((a, b) => a + b, 0), [cashInValues]);
  const filteredCashOut = useMemo(() => cashOutValues.reduce((a, b) => a + b, 0), [cashOutValues]);
  const filteredNet = filteredCashIn - filteredCashOut;

  // ─── AI Insights ───
  const insights = useMemo(() => {
    if (!data) return [];
    const { reconciliation, breakdown, summary, sources } = data;
    const items: string[] = [];

    if (reconciliation.reconciledPercentage > 0) {
      items.push(`${reconciliation.reconciledPercentage}% of cash transactions have been verified by bank reconciliation.`);
    }
    if (reconciliation.pendingAmount > 0) {
      items.push(`${fmt(reconciliation.pendingAmount, currency)} remains unreconciled and pending review.`);
    }
    if (summary.cashIn > 0 && breakdown.cashInFromPayments > 0) {
      const pct = Math.round((breakdown.cashInFromPayments / summary.cashIn) * 100);
      const btPct = Math.round((breakdown.cashInFromBankTxns / summary.cashIn) * 100);
      items.push(`Cash In breakdown: ${pct}% invoice payments, ${btPct}% bank transactions, ${100 - pct - btPct}% other sources.`);
    }
    if (sources.bankTransfers) {
      items.push(`Bank Transfers excluded from Cash In/Out — internal movement between own accounts.`);
    }
    if (data.meta.totalRecordsSkipped > 0) {
      items.push(`${data.meta.totalRecordsSkipped} duplicate transactions were automatically detected and excluded.`);
    }
    return items.slice(0, 4);
  }, [data]);

  if (loading) return <SkeletonChart />;
  if (error) return <ErrorState onRetry={fetchCashFlow} />;
  
  if (data && (data as any).connected === false) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-sm flex flex-col items-center justify-center text-center select-none min-h-[400px]">
        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-450 mb-4">
          <TrendingUp className="h-6 w-6 stroke-[1.5]" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 mb-1">Xero Disconnected</h4>
        <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
          Please connect your Xero organization to view your Cash Flow dashboard.
        </p>
      </div>
    );
  }

  if (!data || data.history.length === 0) return <SkeletonChart />;

  const { summary, reconciliation, dataQuality, meta, breakdown, sources } = data;
  const confidence = dataQuality.confidenceScore;

  // ─── ECharts config ───
  const chartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#0f172a',
      borderColor: '#1e293b',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 11 },
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0;
        const label = params[0]?.name ?? '';
        const cIn = cashInValues[idx] || 0;
        const cOut = cashOutValues[idx] || 0;
        const net = netValues[idx] || 0;
        const modeLabel = prefs.calcMode === 'verified' ? 'Verified' : prefs.calcMode === 'accounting' ? 'Accounting' : 'Hybrid';
        return `<div style="font-family:var(--font-sans),ui-sans-serif,system-ui,sans-serif;padding:4px 2px;min-width:220px">
          <div style="font-weight:700;margin-bottom:8px;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:#34d399">● Cash In</span><span style="font-weight:600">${fmt(cIn, currency)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:#f87171">● Cash Out</span><span style="font-weight:600">${fmt(cOut, currency)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-top:4px;border-top:1px solid #334155"><span style="color:#60a5fa">● Net Flow</span><span style="font-weight:700;color:${net >= 0 ? '#34d399' : '#f87171'}">${fmt(net, currency)}</span></div>
          <div style="border-top:1px solid #334155;padding-top:6px;font-size:10px;color:#64748b">
            <div>Mode: ${modeLabel} · Reconciled: ${reconciliation.reconciledPercentage}%</div>
            <div>Sources: ${meta.dataSourcesUsed.length} · Confidence: ${confidence}%</div>
          </div>
        </div>`;
      }
    },
    grid: { left: '1%', right: '1%', bottom: '2%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartLabels,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { fontSize: 10, fontWeight: 600, color: '#64748b' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 500 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    series: [
      {
        name: 'Cash In', type: 'bar',
        barWidth: prefs.timeline === 'Yearly' ? '48%' : '26%',
        data: cashInValues,
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: 'Cash Out', type: 'bar',
        barWidth: prefs.timeline === 'Yearly' ? '48%' : '26%',
        data: cashOutValues,
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: 'Net Cash Flow', type: 'line', smooth: true,
        data: netValues,
        itemStyle: { color: '#2563eb' },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(37,99,235,0.08)' }, { offset: 1, color: 'rgba(37,99,235,0)' }] }
        },
        symbol: 'circle', symbolSize: 6,
        emphasis: { itemStyle: { borderWidth: 2, borderColor: '#fff', shadowColor: 'rgba(37,99,235,0.3)', shadowBlur: 8 } }
      }
    ]
  };

  const modeLabel = prefs.calcMode === 'verified' ? 'Verified Cash Flow' : prefs.calcMode === 'accounting' ? 'Accounting Cash Flow' : 'Hybrid Cash Flow';

  // ─── RENDER ───
  return (
    <>
      {showMethodology && <MethodologyPanel data={data} onClose={() => setShowMethodology(false)} />}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-300 select-none overflow-hidden">

        {/* ═══ HEADER BAR ═══ */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-white stroke-[2.5]" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Cash Flow Overview</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium pl-9">
              Real-time cash movement based on your selected financial methodology
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <ConfidenceBadge score={confidence} onClick={() => setShowMethodology(true)} />
            <SegmentedToggle<Timeline>
              options={[{ value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }, { value: 'Yearly', label: 'Yearly' }]}
              value={prefs.timeline}
              onChange={v => updatePrefs({ timeline: v })}
              size="xs"
            />
          </div>
        </div>

        {/* ═══ CONFIGURATION TOOLBAR ═══ */}
        <div className="border-b border-slate-100">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-6 py-2.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              <span>Configuration</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">{modeLabel}</span>
            </div>
            {showConfig ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showConfig && (
            <div className="px-6 pb-4 pt-1 space-y-4 bg-slate-50/40">
              {/* Row 1: Calc Mode + Verification */}
              <div className="flex flex-wrap gap-6">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Calculation Mode</span>
                  <SegmentedToggle<CalcMode>
                    options={[
                      { value: 'hybrid', label: 'Hybrid' },
                      { value: 'verified', label: 'Verified' },
                      { value: 'accounting', label: 'Accounting' }
                    ]}
                    value={prefs.calcMode}
                    onChange={v => updatePrefs({ calcMode: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Verification</span>
                  <SegmentedToggle<Verification>
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'reconciled', label: 'Reconciled Only' },
                      { value: 'pending', label: 'Pending Only' }
                    ]}
                    value={prefs.verification}
                    onChange={v => updatePrefs({ verification: v })}
                  />
                </div>
              </div>

              {/* Row 2: Data Sources */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data Sources</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'payments' as const, label: 'Payments', count: sources.payments.count },
                    { key: 'bankTransactions' as const, label: 'Bank Transactions', count: sources.bankTransactions.count },
                    { key: 'prepayments' as const, label: 'Prepayments', count: sources.prepayments.count },
                    { key: 'overpayments' as const, label: 'Overpayments', count: sources.overpayments.count },
                  ].map(src => (
                    <button
                      key={src.key}
                      onClick={() => updatePrefs({ sources: { ...prefs.sources, [src.key]: !prefs.sources[src.key] } })}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold border transition-all duration-200 cursor-pointer",
                        prefs.sources[src.key]
                          ? "bg-white border-slate-200 text-slate-700 shadow-sm"
                          : "bg-transparent border-slate-200/60 text-slate-400"
                      )}
                    >
                      <div className={cn("h-3 w-3 rounded border flex items-center justify-center transition-colors", prefs.sources[src.key] ? "bg-emerald-500 border-emerald-500" : "border-slate-300")}>
                        {prefs.sources[src.key] && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                      </div>
                      {src.label}
                      {src.count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">{src.count}</span>}
                    </button>
                  ))}
                  {/* Bank Transfers - always disabled */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold border border-dashed border-slate-200 text-slate-300 cursor-not-allowed">
                    <X className="h-3 w-3 text-slate-300" />
                    Bank Transfers
                    <span className="text-[9px] text-slate-300">(excluded)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ CHART + KPI ROW ═══ */}
        <div className="px-6 py-5">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Chart */}
            <div className="w-full lg:w-[66%] relative">
              {/* Legend */}
              <div className="flex items-center gap-4 text-[9.5px] font-semibold text-slate-500 mb-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Cash In</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" />Cash Out</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-blue-600" />Net Flow</span>
              </div>
              <ReactECharts
                option={{ ...chartOption, backgroundColor: 'transparent' }}
                style={{ height: '260px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            </div>

            {/* Right: KPI Panel */}
            <div className="w-full lg:w-[34%] lg:border-l border-slate-100 lg:pl-6 space-y-3.5">
              {/* Cash In */}
              <div className="flex items-start gap-2.5">
                <span className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Cash In</span>
                  <span className="text-xl font-bold text-slate-800 tracking-tight block">{fmt(filteredCashIn, currency)}</span>
                  <span className="text-[9.5px] font-medium text-slate-400">{summary.incomingPaymentsCount ?? 0} transactions</span>
                </div>
              </div>
              <div className="border-t border-slate-100/60" />
              {/* Cash Out */}
              <div className="flex items-start gap-2.5">
                <span className="h-7 w-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0 mt-0.5">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                </span>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Cash Out</span>
                  <span className="text-xl font-bold text-slate-800 tracking-tight block">{fmt(filteredCashOut, currency)}</span>
                  <span className="text-[9.5px] font-medium text-slate-400">{summary.outgoingPaymentsCount ?? 0} transactions</span>
                </div>
              </div>
              <div className="border-t border-slate-100/60" />
              {/* Net Flow */}
              <div className="flex items-start gap-2.5">
                <span className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Net Cash Flow</span>
                  <span className={cn("text-xl font-bold tracking-tight block", filteredNet >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {filteredNet >= 0 ? '+' : ''}{fmt(filteredNet, currency)}
                  </span>
                  <span className="text-[9.5px] font-medium text-slate-400">{filteredNet >= 0 ? 'Positive' : 'Negative'} Cash Flow</span>
                </div>
              </div>
              <div className="border-t border-slate-100/60" />
              {/* Reconciliation mini stats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Verified</span>
                  <span className="text-sm font-bold text-emerald-600">{fmtPct(reconciliation.reconciledPercentage)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Pending</span>
                  <span className="text-sm font-bold text-amber-600">{reconciliation.pendingCount}</span>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Integrity</span>
                  <span className={cn("text-sm font-bold", confidenceColor(confidence))}>{fmtPct(confidence)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Sources</span>
                  <span className="text-sm font-bold text-slate-700">{meta.dataSourcesUsed.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ DATA QUALITY + METHODOLOGY CARDS ═══ */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Data Quality Card */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-100 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-600">Financial Data Quality</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Payments Imported', value: dataQuality.paymentsImported ? 100 : 0, color: 'bg-emerald-500' },
                  { label: 'Bank Feed', value: dataQuality.bankFeedImported ? 100 : 0, color: 'bg-blue-500' },
                  { label: 'Reconciliation', value: dataQuality.reconciliationRate, color: 'bg-emerald-500' },
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium text-slate-500">{item.label}</span>
                      <span className="font-bold text-slate-700">{fmtPct(item.value)}</span>
                    </div>
                    <MicroProgress value={item.value} color={item.color} />
                  </div>
                ))}
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                  <span className="font-medium text-slate-500">Duplicates Detected</span>
                  <span className="font-bold text-slate-700">{dataQuality.duplicatesDetected}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-500">Pending Review</span>
                  <span className="font-bold text-amber-600">{dataQuality.pendingReview}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-500">Confidence Score</span>
                  <span className={cn("font-bold", confidenceColor(confidence))}>{fmtPct(confidence)}</span>
                </div>
              </div>
            </div>

            {/* Methodology Card */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-100 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-600">Calculation Methodology</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-500">Current Mode</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{modeLabel}</span>
                </div>
                <div className="text-[10px]">
                  <span className="font-medium text-slate-500 block mb-1">Sources Used</span>
                  <div className="flex flex-wrap gap-1">
                    {meta.dataSourcesUsed.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-semibold">✓ {s}</span>
                    ))}
                  </div>
                </div>
                <div className="text-[10px]">
                  <span className="font-medium text-slate-500 block mb-1">Excluded</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-semibold">• Bank Transfers</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-semibold">• Duplicate Txns</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                  <span className="font-medium text-slate-500">Deduplication</span>
                  <span className="font-semibold text-slate-600 text-[9px]">{meta.deduplicationMethod}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-slate-500">Last Synced</span>
                  <span className="font-semibold text-slate-600">{new Date(meta.calculatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ AI INSIGHTS ═══ */}
        {insights.length > 0 && (
          <div className="px-6 pb-5">
            <div className="bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-violet-50/20 rounded-xl border border-blue-100/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">Financial Insights</span>
              </div>
              <div className="space-y-2">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 leading-relaxed">
                    <Activity className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="px-6 pb-5">
          <button
            onClick={() => window.location.href = '/cash-flow'}
            className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View Full Cash Flow Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
