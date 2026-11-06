import React, { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  Layers, 
  Grid, 
  Globe, 
  MoreVertical, 
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================================================
// TOOLTIP HELPER
// ==================================================
function CardTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1">
      <Info
        className="h-3.5 w-3.5 text-slate-350 hover:text-slate-500 cursor-help transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[9.5px] p-2 rounded shadow-md z-50 pointer-events-none text-center leading-normal">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

// ==================================================
// SKELETON LOADER FOR A CARD
// ==================================================
function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-4 animate-pulse select-none min-h-[395px] flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="h-4 w-28 bg-slate-100 rounded" />
        <div className="h-4 w-4 bg-slate-100 rounded" />
      </div>
      <div className="space-y-3 flex-1 pt-2">
        <div className="h-4.5 w-40 bg-slate-100 rounded" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <div className="h-9 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

// ==================================================
// ERROR STATE FOR A CARD WITH RETRY
// ==================================================
function CardErrorState({ title, desc, onRetry }: { title: string; desc: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px]">
      <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3 animate-bounce">
        <AlertCircle className="h-4.5 w-4.5 stroke-[1.8]" />
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal mb-3.5">{desc}</p>
      <button 
        onClick={onRetry} 
        className="px-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[10px] font-bold transition flex items-center gap-1.5"
      >
        <RefreshCw className="h-3 w-3" />
        <span>Retry Fetch</span>
      </button>
    </div>
  );
}

// ==================================================
// EMPTY STATE FOR A CARD
// ==================================================
function CardEmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px]">
      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-400 mb-3">
        <Globe className="h-4.5 w-4.5 stroke-[1.5]" />
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal">{desc}</p>
    </div>
  );
}

// ==================================================
// CARD 1: RECONCILIATION SUMMARY CARD
// ==================================================
interface ReconciliationData {
  reconciliationPercentage: number | null;
  unreconciledTransactions: number | null;
  pendingTransactions: number | null;
  lastReconciliation: string | null;
}

function ReconciliationSummaryCard({ 
  data, 
  loading, 
  error, 
  onRetry,
  onNavigate 
}: { 
  data: ReconciliationData | null; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Reconciliation Fetch Failed" desc="We couldn't connect to retrieve reconciliation statuses." onRetry={onRetry} />;
  if (!data) return <CardEmptyState title="No Reconciliation Data" desc="Reconciliation indicators are unavailable for this tenant." />;

  const pct = data.reconciliationPercentage ?? 0;
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (pct / 100) * circ;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Reconciliation Summary</h3>
        </div>
        <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
      </div>

      <div className="py-2 flex justify-between items-center border-b border-slate-50 shrink-0">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase">Bank reconciliation</span>
        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Live Status
        </span>
      </div>

      {/* Progress & Value */}
      <div className="flex items-center justify-between py-3.5 shrink-0 border-b border-slate-50">
        <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
          <svg className="h-full w-full transform -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r={radius} stroke="#f1f5f9" strokeWidth="3.5" fill="none" />
            <circle 
              cx="20" 
              cy="20" 
              r={radius} 
              stroke={pct === 100 ? "#10b981" : pct > 50 ? "#f59e0b" : "#ef4444"} 
              strokeWidth="3.5" 
              strokeDasharray={circ} 
              strokeDashoffset={strokeDashoffset} 
              strokeLinecap="round" 
              fill="none" 
            />
          </svg>
          <div className="absolute text-center flex flex-col items-center">
            <span className="text-[13.5px] font-extrabold text-slate-800 leading-none">{data.reconciliationPercentage == null ? 'N/A' : `${pct}%`}</span>
          </div>
        </div>
        <div className="flex-1 pl-4 text-[9.5px] font-semibold text-slate-400 leading-normal">
          Overall bank account reconciliation progress indicator.
        </div>
      </div>

      {/* Breakdown Metrics */}
      <div className="flex-1 space-y-2.5 py-3">
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-500 font-semibold">Unreconciled Items</span>
          <span className="font-extrabold text-slate-700">{data.unreconciledTransactions == null ? 'N/A' : `${data.unreconciledTransactions} Txns`}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-500 font-semibold">Transactions Pending</span>
          <span className="font-extrabold text-slate-700">{data.pendingTransactions == null ? 'N/A' : `${data.pendingTransactions} Txns`}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-500 font-semibold">Last Reconciliation</span>
          <span className="font-extrabold text-slate-700 text-[9.5px] truncate max-w-[110px]">{data.lastReconciliation || 'N/A'}</span>
        </div>
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[8.5px] font-bold text-slate-400">
            <span>Reconciliation health</span>
            <span>{pct}% Reconciled</span>
          </div>
          <div className="h-1.5 w-full bg-slate-50 border border-slate-100/50 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onNavigate} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition">
          <span>View Reconciliation</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// CARD 2: CHART OF ACCOUNTS CARD
// ==================================================
interface AccountsData {
  totalAccounts: number;
  distribution: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expenses: number;
  };
}

function ChartOfAccountsCard({ 
  data, 
  loading, 
  error, 
  onRetry,
  onNavigate 
}: { 
  data: AccountsData | null; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Accounts Fetch Failed" desc="We couldn't retrieve the Chart of Accounts list." onRetry={onRetry} />;
  if (!data) return <CardEmptyState title="No Chart of Accounts" desc="Connect ledger to analyze distribution accounts." />;

  const dist = data.distribution;
  const total = data.totalAccounts;
  const radius = 16;
  const strokeWidth = 4;
  const circ = 2 * Math.PI * radius;

  // Compute strokes & offsets for multi-segment SVG Donut Chart
  const items = [
    { label: 'Assets', count: dist.assets, color: '#10b981' },
    { label: 'Liabilities', count: dist.liabilities, color: '#ef4444' },
    { label: 'Equity', count: dist.equity, color: '#6366f1' },
    { label: 'Revenue', count: dist.revenue, color: '#3b82f6' },
    { label: 'Expenses', count: dist.expenses, color: '#f59e0b' }
  ].filter(i => i.count > 0);

  // Precompute all segment strokeDasharray and strokeDashoffset values
  const segments: { label: string; count: number; color: string; strokeVal: number; offsetVal: number }[] = [];
  let accumulated = 0;
  for (const item of items) {
    const pct = total > 0 ? item.count / total : 0;
    const strokeVal = circ * pct;
    const offsetVal = circ - accumulated;
    segments.push({ ...item, strokeVal, offsetVal });
    accumulated += strokeVal;
  }

  const showScrollHint = items.length > 3;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div 
          onClick={onNavigate}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition"
        >
          <Layers className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Chart of Accounts</h3>
        </div>
        <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
      </div>

      {/* Donut Chart and Legends */}
      <div className="flex items-center justify-between py-3 shrink-0 border-b border-slate-50">
        <div 
          onClick={onNavigate}
          className="relative flex items-center justify-center h-16 w-16 shrink-0 cursor-pointer hover:scale-105 transition-transform"
        >
          <svg className="h-full w-full transform -rotate-90" viewBox="0 0 40 40">
            {/* Background track ring */}
            <circle cx="20" cy="20" r={radius} stroke="#f1f5f9" strokeWidth={strokeWidth} fill="none" />
            {/* Colored segment arcs */}
            {segments.map((seg, idx) => (
              <circle 
                key={idx}
                cx="20" 
                cy="20" 
                r={radius} 
                stroke={seg.color} 
                strokeWidth={strokeWidth} 
                strokeDasharray={`${seg.strokeVal} ${circ - seg.strokeVal}`} 
                strokeDashoffset={seg.offsetVal} 
                fill="none" 
              />
            ))}
          </svg>
          {/* White center disc to ensure clean donut hole */}
          <div className="absolute h-[34px] w-[34px] rounded-full bg-white" />
          <div className="absolute text-center flex flex-col items-center">
            <span className="text-[13px] font-extrabold text-slate-800 leading-none">{total}</span>
            <span className="text-[6px] font-bold text-slate-400 uppercase mt-0.5 leading-none">Total</span>
          </div>
        </div>
        <div className="flex-1 pl-4 text-[9.5px] font-semibold text-slate-400 leading-normal">
          Active distribution across account types in your connected ledger.
        </div>
      </div>

      {/* Account Categories distribution */}
      <div className="flex-1 py-3">
        <div className="space-y-0 divide-y divide-slate-100/60">
          {items.map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => window.location.href = `/chart-of-accounts?type=${item.label}`}
              className="flex justify-between items-center text-[10.5px] py-2 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50/80 px-1 rounded transition"
            >
              <span className="flex items-center gap-1.5 text-slate-500 font-semibold">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
              <span className="font-extrabold text-slate-700">{item.count} Accounts</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onNavigate} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
          <span>View Chart of Accounts</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// CARD 3: TRACKING CATEGORIES CARD
// ==================================================
interface TrackingCategory {
  name: string;
  optionsCount: number;
  optionNames: string[];
  status: string;
}

interface TrackingData {
  enabled: boolean;
  totalCategories: number;
  totalOptions: number;
  categories: TrackingCategory[];
}

// --- Reusable sub-components ---

function TrackingOptionBadge({ name }: { name: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-[9px] font-bold leading-tight">
      {name}
    </span>
  );
}

function CategorySummary({ category }: { category: TrackingCategory }) {
  const maxVisible = 3;
  const visibleOptions = category.optionNames.slice(0, maxVisible);
  const remaining = category.optionsCount - maxVisible;

  return (
    <div className="pt-3 first:pt-0">
      {/* Category header row */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[11.5px] font-extrabold text-slate-700">{category.name}</span>
          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
            {category.optionsCount} Tracking Option{category.optionsCount !== 1 ? 's' : ''}
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-bold uppercase tracking-wider shrink-0">
          {category.status}
        </span>
      </div>

      {/* Option badges */}
      {visibleOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {visibleOptions.map((optName, idx) => (
            <TrackingOptionBadge key={idx} name={optName} />
          ))}
          {remaining > 0 && (
            <span className="text-[9px] font-bold text-slate-400">
              +{remaining} More
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TrackingCategoriesCard({ 
  data, 
  loading, 
  error, 
  onRetry,
  onNavigate 
}: { 
  data: TrackingData | null; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Tracking Fetch Failed" desc="We couldn't retrieve tracking category configuration." onRetry={onRetry} />;
  
  const categories = data ? (data.categories || []) : [];
  const enabled = data ? (data.enabled !== undefined ? data.enabled : categories.length > 0) : false;
  const totalCategories = data ? (data.totalCategories ?? categories.length) : 0;
  const totalOptions = data ? (data.totalOptions ?? (data as any)?.summary?.trackingOptions ?? 0) : 0;

  // --- Empty state ---
  if (!enabled || categories.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Grid className="h-4 w-4 text-[#0064eb] stroke-[2]" />
            <h3 className="text-[13.5px] font-bold text-slate-800">Tracking Categories</h3>
          </div>
          <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3.5">
            <Grid className="h-4.5 w-4.5 stroke-[1.5]" />
          </div>
          <h4 className="text-[11.5px] font-extrabold text-slate-700 mb-1">No Tracking Categories Configured</h4>
          <p className="text-[9.5px] text-slate-400 max-w-[190px] leading-normal">
            Tracking categories are not enabled.
          </p>
        </div>

        <div className="mt-4 shrink-0">
          <button onClick={onNavigate} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition">
            <span>Configure Tracking</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // --- Active state ---
  const maxVisibleCategories = 2;
  const visibleCategories = categories.slice(0, maxVisibleCategories);
  const remainingCategories = totalCategories - maxVisibleCategories;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Grid className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Tracking Categories</h3>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active ({totalCategories})
        </span>
      </div>

      {/* Sub-header */}
      <div className="py-2 flex justify-between items-center border-b border-slate-50 shrink-0">
        <span className="text-[9.5px] font-bold text-slate-400 uppercase">Configured Dimensions</span>
      </div>

      {/* Category list with option badges */}
      <div className="flex-1 py-3 space-y-0 divide-y divide-slate-100/60">
        {visibleCategories.map((cat, idx) => (
          <CategorySummary key={idx} category={cat} />
        ))}
        {remainingCategories > 0 && (
          <div className="pt-3">
            <span className="text-[9.5px] font-bold text-blue-500">
              +{remainingCategories} More Categor{remainingCategories === 1 ? 'y' : 'ies'}
            </span>
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="border-t border-slate-100 pt-2.5 shrink-0">
        <div className="flex justify-between items-center text-[10px] mb-3">
          <span className="text-slate-400 font-semibold">Configured Categories: <span className="font-extrabold text-slate-700">{totalCategories}</span></span>
          <span className="text-slate-400 font-semibold">Tracking Options: <span className="font-extrabold text-slate-700">{totalOptions}</span></span>
        </div>
        <button onClick={onNavigate} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition">
          <span>Manage Tracking</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// CARD 4: MULTI CURRENCY CARD
// ==================================================
interface CurrencyData {
  baseCurrency: string;
  baseCurrencyDescription: string;
  allCurrencies: string[];
  otherCurrencies: string[];
  totalCurrencies: number;
  multiCurrencyEnabled: boolean;
  exchangeRateUpdated: string;
}

// --- Reusable sub-components ---

function CurrencyBadge({ code, large }: { code: string; large?: boolean }) {
  return (
    <span className={cn(
      "rounded-lg border font-extrabold tracking-wider uppercase",
      large
        ? "px-3 py-1.5 bg-blue-50 border-blue-100 text-blue-700 text-[13px]"
        : "px-2 py-0.5 bg-slate-50 border-slate-200/80 text-slate-700 text-[10px]"
    )}>
      {code}
    </span>
  );
}

function CurrencyStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
      enabled
        ? "bg-emerald-50 border border-emerald-100 text-emerald-600"
        : "bg-slate-50 border border-slate-200 text-slate-400"
    )}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function MultiCurrencyCard({ 
  data, 
  loading, 
  error, 
  onRetry,
  onNavigate 
}: { 
  data: CurrencyData | null; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Currency Fetch Failed" desc="We couldn't retrieve currency configuration." onRetry={onRetry} />;
  if (!data) return <CardEmptyState title="No Currency Configuration Found" desc="Currency data is currently unavailable." />;

  const multiEnabled = data.multiCurrencyEnabled;
  const allCurrencies = data.allCurrencies;
  const maxVisibleBadges = 4;
  const visibleCurrencies = allCurrencies.slice(0, maxVisibleBadges);
  const remainingCurrencies = allCurrencies.length - maxVisibleBadges;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Multi Currency</h3>
        </div>
        <span className="text-[8.5px] text-slate-400 font-semibold">{data.exchangeRateUpdated}</span>
      </div>

      {/* Content sections */}
      <div className="flex-1 py-3 space-y-0 divide-y divide-slate-100/60">
        {/* Section: Base Currency */}
        <div className="pb-3">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Base Currency</span>
          <div className="mt-2 flex items-center gap-2">
            <CurrencyBadge code={data.baseCurrency} large />
          </div>
          {data.baseCurrencyDescription && (
            <div className="mt-1.5 text-[9.5px] font-semibold text-slate-500">{data.baseCurrencyDescription}</div>
          )}
          <div className="mt-1 text-[8.5px] font-semibold text-slate-400">Ledger Base Currency</div>
        </div>

        {/* Section: Currency Configuration */}
        <div className="py-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Currency Configuration</span>
            <CurrencyStatusBadge enabled={multiEnabled} />
          </div>
          <div className="mt-1.5 text-[9.5px] font-semibold text-slate-500">
            {multiEnabled
              ? `Multi Currency — ${data.otherCurrencies.length} additional currenc${data.otherCurrencies.length === 1 ? 'y' : 'ies'}`
              : 'Single Currency Ledger'
            }
          </div>
        </div>

        {/* Section: Available Currencies */}
        <div className="pt-3">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Available Currencies</span>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {visibleCurrencies.map((cur, idx) => (
              <CurrencyBadge key={idx} code={cur} />
            ))}
            {remainingCurrencies > 0 && (
              <span className="text-[9px] font-bold text-slate-400">
                +{remainingCurrencies} More
              </span>
            )}
          </div>
          {!multiEnabled && (
            <div className="mt-1.5 text-[9px] font-semibold text-slate-400">
              No additional currencies configured.
            </div>
          )}
        </div>
      </div>

      {/* Footer summary */}
      <div className="border-t border-slate-100 pt-2.5 shrink-0">
        <div className="flex justify-between items-center text-[10px] mb-3">
          <span className="text-slate-400 font-semibold">Base Currency: <span className="font-extrabold text-slate-700">{data.baseCurrency}</span></span>
          <span className="text-slate-400 font-semibold">Available Currencies: <span className="font-extrabold text-slate-700">{data.totalCurrencies}</span></span>
        </div>
        <button onClick={onNavigate} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition">
          <span>View All Currencies</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// MAIN ROW CONTAINER COMPONENT
// ==================================================
export function OverviewMoreCardsRow({ connected = false, loading = false }: { connected?: boolean; loading?: boolean }) {
  const [reconData, setReconData] = useState<ReconciliationData | null>(null);
  const [reconLoading, setReconLoading] = useState(true);
  const [reconError, setReconError] = useState(false);

  const [accountsData, setAccountsData] = useState<AccountsData | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [trackingError, setTrackingError] = useState(false);

  const [currencyData, setCurrencyData] = useState<CurrencyData | null>(null);
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState(false);

  const fetchReconciliation = async () => {
    try {
      setReconLoading(true);
      setReconError(false);
      const res = await fetch('/api/dashboard/reconciliation');
      if (res.ok) {
        setReconData(await res.json());
      } else {
        setReconError(true);
      }
    } catch {
      setReconError(true);
    } finally {
      setReconLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setAccountsLoading(true);
      setAccountsError(false);
      const res = await fetch('/api/dashboard/accounts');
      if (res.ok) {
        setAccountsData(await res.json());
      } else {
        setAccountsError(true);
      }
    } catch {
      setAccountsError(true);
    } finally {
      setAccountsLoading(false);
    }
  };

  const fetchTracking = async () => {
    try {
      setTrackingLoading(true);
      setTrackingError(false);
      const res = await fetch('/api/dashboard/tracking-categories');
      if (res.ok) {
        setTrackingData(await res.json());
      } else {
        setTrackingError(true);
      }
    } catch {
      setTrackingError(true);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      setCurrencyLoading(true);
      setCurrencyError(false);
      const res = await fetch('/api/dashboard/currencies');
      if (res.ok) {
        setCurrencyData(await res.json());
      } else {
        setCurrencyError(true);
      }
    } catch {
      setCurrencyError(true);
    } finally {
      setCurrencyLoading(false);
    }
  };

  const loadAll = () => {
    fetchAccounts();
    fetchTracking();
    fetchCurrencies();
  };

  useEffect(() => {
    if (connected) {
      loadAll();
    }

    // Re-fetch on custom sync events
    const handleSyncComplete = () => {
      if (connected) {
        loadAll();
      }
    };

    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
  }, [connected]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex flex-col bg-white p-5 rounded-lg border border-slate-200/80 shadow-2xs h-[290px] relative overflow-hidden select-none">
            <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between shrink-0">
              <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-4 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-4 py-2">
              <div className="space-y-2">
                <div className="h-3.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-3/4 bg-slate-200/60 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-2 w-full bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2.5 mt-auto">
              <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CardEmptyState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view your account distributions." 
        />
        <CardEmptyState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view tracking categories." 
        />
        <CardEmptyState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view base and transaction currencies." 
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <ChartOfAccountsCard 
        data={accountsData} 
        loading={accountsLoading} 
        error={accountsError} 
        onRetry={fetchAccounts}
        onNavigate={() => window.location.href = '/chart-of-accounts'}
      />
      <TrackingCategoriesCard 
        data={trackingData} 
        loading={trackingLoading} 
        error={trackingError} 
        onRetry={fetchTracking}
        onNavigate={() => window.location.href = '/tracking-categories'}
      />
      <MultiCurrencyCard 
        data={currencyData} 
        loading={currencyLoading} 
        error={currencyError} 
        onRetry={fetchCurrencies}
        onNavigate={() => window.location.href = '/settings'}
      />
    </div>
  );
}
