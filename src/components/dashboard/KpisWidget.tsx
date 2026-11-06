import React, { useEffect, useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Briefcase, 
  Clock, 
  FileText, 
  TrendingUp, 
  CalendarClock, 
  Hourglass 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================================================
// TOOLTIP COMPONENT
// ==================================================
export function Tooltip({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center ml-1">
      <HelpCircle
        className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 cursor-help transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div className={cn(
          "absolute left-1/2 transform -translate-x-1/2 w-48 bg-slate-900 text-white text-[9.5px] p-2 rounded shadow-md z-50 pointer-events-none text-center leading-normal",
          position === 'top' ? "bottom-full mb-2" : "top-full mt-1.5"
        )}>
          {text}
          <div className={cn(
            "absolute left-1/2 transform -translate-x-1/2 border-4 border-transparent",
            position === 'top' ? "top-full -mt-1 border-t-slate-900" : "bottom-full -mb-1 border-b-slate-900"
          )} />
        </div>
      )}
    </div>
  );
}

// ==================================================
// MINI SPARKLINE COMPONENT
// ==================================================
export function MiniSparkline({ data, color }: { data: number[], color: string }) {
  if (!data || data.length < 2) {
    return (
      <svg className="w-full h-8 opacity-40" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0,22 C25,5 50,25 75,8 C90,2 95,15 100,6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 24 - ((val - min) / range) * 18;
    return { x, y };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 3;
    const cpY1 = curr.y;
    const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  return (
    <svg className="w-full h-8 opacity-75" viewBox="0 0 100 30" preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ==================================================
// TREND INDICATOR COMPONENT
// ==================================================
export function TrendIndicator({ value, suffix = "%", inverted = false }: { value: number, suffix?: string, inverted?: boolean }) {
  if (value === 0) return <span className="text-slate-450 font-semibold text-[9.5px]">0{suffix}</span>;
  
  const isPositive = value > 0;
  const isGreen = inverted ? !isPositive : isPositive;
  const colorClass = isGreen ? 'text-[#10b981]' : 'text-[#ef4444]';
  const prefix = isPositive ? '▲' : '▼';

  return (
    <span className={cn("font-bold text-[9.5px] flex items-center gap-0.5", colorClass)}>
      <span>{prefix} {Math.abs(value)}{suffix}</span>
    </span>
  );
}

// ==================================================
// VALUE FORMATTER COMPONENT
// ==================================================
// ==================================================
export function ValueFormatter({ value, type, currency = "GBP" }: { value: number, type: 'currency' | 'days' | 'percent', currency?: string }) {
  if (type === 'percent') {
    return (
      <span className="select-all font-sans font-extrabold text-[19px] text-slate-800 tracking-tight">
        {value.toFixed(1)}<span className="text-[12px] font-bold text-slate-500">%</span>
      </span>
    );
  }
  if (type === 'days') {
    return (
      <span className="select-all font-sans font-extrabold text-[19px] text-slate-800 tracking-tight">
        {value}<span className="text-[12px] font-bold text-slate-500 ml-0.5">Days</span>
      </span>
    );
  }

  let formatted = "";
  if (!currency) {
    formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } else if (currency === 'GBP') {
    formatted = '£' + new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } else if (currency === 'USD') {
    formatted = '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } else if (currency === 'INR') {
    formatted = '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } else if (currency === 'EUR') {
    formatted = '€' + new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } else {
    formatted = currency + ' ' + new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  const parts = formatted.split('.');
  if (parts.length === 2) {
    return (
      <span className="select-all font-sans font-extrabold text-[19px] text-slate-800 tracking-tight">
        {parts[0]}<span className="text-[12px] font-bold text-slate-400">.{parts[1]}</span>
      </span>
    );
  }
  return <span className="select-all font-sans font-extrabold text-[19px] text-slate-800 tracking-tight">{formatted}</span>;
}

// ==================================================
// KPI CARD COMPONENT
// ==================================================
interface KpiCardProps {
  title: string;
  tooltipText: string;
  value: number;
  valueType: 'currency' | 'days' | 'percent';
  currency?: string;
  subtitle: string | React.ReactNode;
  history: number[];
  sparklineColor: string;
  loading: boolean;
  trend?: number;
  trendSuffix?: string;
  trendInverted?: boolean;
  icon?: React.ComponentType<any>;
}

export function KpiCard({
  title,
  tooltipText,
  value,
  valueType,
  currency = "GBP",
  subtitle,
  history,
  sparklineColor,
  loading,
  trend,
  trendSuffix = "%",
  trendInverted = false,
  icon: Icon
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs animate-pulse min-h-[135px] flex flex-col justify-between">
        <div>
          <div className="h-3 w-20 bg-slate-100 rounded mb-3.5" />
          <div className="h-6 w-24 bg-slate-100 rounded mb-2.5" />
          <div className="h-2.5 w-32 bg-slate-50 rounded" />
        </div>
        <div className="h-6 w-full bg-slate-50/50 rounded mt-4" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-slate-300/80 transition duration-300 flex flex-col justify-between select-none min-h-[135px]">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {Icon && <Icon className="h-3.5 w-3.5 text-slate-450 shrink-0 stroke-[1.8]" />}
            <span className="text-[9.5px] font-extrabold text-slate-450 uppercase tracking-wider truncate">{title}</span>
          </div>
          <Tooltip text={tooltipText} />
        </div>
        <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
          <ValueFormatter value={value} type={valueType} currency={currency} />
          {trend !== undefined && (
            <TrendIndicator value={trend} suffix={trendSuffix} inverted={trendInverted} />
          )}
        </div>
        <div className="text-[9px] text-slate-400 font-medium mt-1 leading-tight truncate">
          {subtitle}
        </div>
      </div>
      <div className="mt-3 pointer-events-none shrink-0">
        <MiniSparkline data={history} color={sparklineColor} />
      </div>
    </div>
  );
}

// ==================================================
// KPIS ROW COMPONENT (6 CARDS GRID)
// ==================================================
interface KpisRowProps {
  currency?: string;
  fromDate?: string | null;
  toDate?: string | null;
  loading?: boolean;
}

export function KpisRow({ currency = "GBP", fromDate, toDate, loading: parentLoading }: KpisRowProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = async () => {
    try {
      setLoading(true);
      let url = '/api/dashboard/kpis';
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      const query = params.toString();
      if (query) url += `?${query}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setError(null);
      } else {
        setError('Failed to fetch KPI indicators.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();

    // Listen for custom sync events from Header
    const handleSyncComplete = () => {
      fetchKpis();
    };

    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
  }, [fromDate, toDate]);

  const isRowLoading = loading || !!parentLoading;

  if (error && !isRowLoading) {
    return (
      <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-5 text-center text-[11px] font-bold text-[#ef4444] select-none shadow-2xs">
        {error}
      </div>
    );
  }

  const wc = data?.workingCapital || { value: 0, trend: 0, history: [] };
  const or = data?.overdueReceivables || { value: 0, percentage: 0, history: [] };
  const ob = data?.outstandingBills || { value: 0, percentage: 0, history: [] };
  const cr = data?.collectionRate || { value: 0, trend: 0, history: [] };
  const ac = data?.averageCollectionDays || { value: 0, difference: 0, history: [] };
  const ap = data?.averagePaymentDays || { value: 0, difference: 0, history: [] };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5">
      <KpiCard
        title="Working Capital"
        tooltipText="Current Assets minus Current Liabilities."
        value={wc.value}
        valueType="currency"
        currency={currency}
        trend={wc.trend}
        subtitle="Formula: Bank + CA - CL"
        history={wc.history}
        sparklineColor="#10b981"
        loading={isRowLoading}
        icon={Briefcase}
      />
      <KpiCard
        title="Overdue Receivables"
        tooltipText="Money customers should have already paid."
        value={or.value}
        valueType="currency"
        currency={currency}
        subtitle={`${or.percentage}% of Accounts Receivable`}
        history={or.history}
        sparklineColor="#ef4444"
        loading={isRowLoading}
        icon={Clock}
      />
      <KpiCard
        title="Outstanding Bills"
        tooltipText="Bills that still require payment."
        value={ob.value}
        valueType="currency"
        currency={currency}
        subtitle={`${ob.percentage}% of Accounts Payable`}
        history={ob.history}
        sparklineColor="#f59e0b"
        loading={isRowLoading}
        icon={FileText}
      />
      <KpiCard
        title="Invoice Collection Rate"
        tooltipText="Percentage of invoiced revenue already collected."
        value={cr.value}
        valueType="percent"
        trend={cr.trend}
        subtitle="Period collection rate"
        history={cr.history}
        sparklineColor="#10b981"
        loading={isRowLoading}
        icon={TrendingUp}
      />
      <KpiCard
        title="Average Collection Days (DSO)"
        tooltipText="Average days to collect customer payments."
        value={ac.value}
        valueType="days"
        trend={ac.difference}
        trendSuffix=" Days"
        trendInverted={true}
        subtitle="vs. Previous Period"
        history={ac.history}
        sparklineColor={ac.difference <= 0 ? "#10b981" : "#ef4444"}
        loading={isRowLoading}
        icon={CalendarClock}
      />
      <KpiCard
        title="Average Payment Days (DPO)"
        tooltipText="Average days taken to pay suppliers."
        value={ap.value}
        valueType="days"
        trend={ap.difference}
        trendSuffix=" Days"
        trendInverted={false}
        subtitle="vs. Previous Period"
        history={ap.history}
        sparklineColor={ap.difference >= 0 ? "#10b981" : "#ef4444"}
        loading={isRowLoading}
        icon={Hourglass}
      />
    </div>
  );
}
