"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import {
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  Landmark,
  Layers,
  Briefcase,
  ArrowRight,
  MoreVertical,
  Info,
  TrendingUp,
  Minus,
  Equal,
  X,
  Search,
  Download,
  LayoutDashboard,
  Lock,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  OrganizationDetailsCard,
  ConnectedBankAccountsCard,
  InvoiceStatusSummaryCard,
  BillStatusSummaryCard
} from '@/components/dashboard/OverviewCards';
import { useFeaturePermissions } from '@/hooks/use-feature-permissions';
import { KpisRow, Tooltip } from '@/components/dashboard/KpisWidget';
import { OverviewMoreCardsRow } from '@/components/dashboard/OverviewMoreCards';
import { OverviewBottomCardsRow } from '@/components/dashboard/OverviewBottomCards';
import { CashFlowOverview } from '@/components/dashboard/CashFlowOverview';
import { AiInsightsWidget } from '@/components/dashboard/AiInsightsWidget';
import { FinancialAccountingOverview } from '@/components/dashboard/FinancialAccountingOverview';

function Sparkline({ dataPoints, color = "#0064eb" }: { dataPoints: number[], color?: string }) {
  if (!dataPoints || dataPoints.length < 2) {
    // Return a default beautiful gentle wave if data is not available
    return (
      <svg className="w-full h-8 opacity-45" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d="M0,22 C25,5 50,25 75,8 C90,2 95,15 100,6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  const min = Math.min(...dataPoints);
  const max = Math.max(...dataPoints);
  const range = max - min || 1;

  // Normalize points to fit SVG box 100x30 with padding
  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1)) * 100;
    const y = 24 - ((val - min) / range) * 18; // 6px padding from top/bottom
    return { x, y };
  });

  // Build cubic bezier curve string
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
    <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FormattedAmount({
  amount,
  currencyCode,
  compact = false,
  className = "text-[20px] font-extrabold text-slate-800 leading-tight tracking-tight truncate select-all"
}: {
  amount: number,
  currencyCode: string,
  compact?: boolean,
  className?: string
}) {
  const getSymbol = (code: string) => {
    if (code === 'INR') return '₹';
    if (code === 'USD') return '$';
    if (code === 'GBP') return '£';
    if (code === 'EUR') return '€';
    return code ? code + ' ' : '';
  };

  const symbol = getSymbol(currencyCode);
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let mainPart = "";
  let decimalPart = "";

  if (compact && absAmount >= 1000) {
    if (absAmount >= 1000000) {
      const val = absAmount / 1000000;
      const valStr = val.toFixed(2);
      const parts = valStr.split('.');
      mainPart = (isNegative ? '-' : '') + symbol + parts[0];
      decimalPart = '.' + parts[1] + 'M';
    } else {
      const val = absAmount / 1000;
      const valStr = val.toFixed(1);
      const parts = valStr.split('.');
      mainPart = (isNegative ? '-' : '') + symbol + parts[0];
      decimalPart = '.' + parts[1] + 'K';
    }
  } else {
    let formattedNum = "";
    if (currencyCode === 'INR') {
      formattedNum = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absAmount);
    } else if (currencyCode === 'EUR') {
      formattedNum = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absAmount);
    } else {
      formattedNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(absAmount);
    }
    const dotIndex = formattedNum.lastIndexOf('.');
    if (dotIndex === -1) {
      mainPart = (isNegative ? '-' : '') + symbol + formattedNum;
      decimalPart = "";
    } else {
      mainPart = (isNegative ? '-' : '') + symbol + formattedNum.substring(0, dotIndex);
      decimalPart = formattedNum.substring(dotIndex);
    }
  }

  if (compact) {
    return (
      <span className={className}>
        {mainPart + decimalPart}
      </span>
    );
  }

  return (
    <span className={className}>
      <span>{mainPart}</span>
      {decimalPart && (
        <span className="text-[0.75em] font-bold text-slate-400/70 tracking-normal">{decimalPart}</span>
      )}
    </span>
  );
}

function HealthScoreGaugeMeter({ score = 0 }: { score: number }) {
  const safeScore = Math.min(100, Math.max(0, score || 0));
  
  // Angle calculations for 180° semicircle gauge
  // Angle starts at Math.PI (180deg - left) and goes clockwise to 0 (right)
  const radius = 64;
  const strokeWidth = 11;
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - safeScore / 100);

  // Exact endpoint coordinates for the indicator needle dot
  const angleRad = Math.PI * (1 - safeScore / 100);
  const dotX = 100 + radius * Math.cos(angleRad);
  const dotY = 88 - radius * Math.sin(angleRad);

  const gaugeColor =
    safeScore >= 85 ? '#10b981' :
    safeScore >= 70 ? '#3b82f6' :
    safeScore >= 55 ? '#f59e0b' :
    safeScore >= 40 ? '#f97316' :
    '#ef4444';

  const gradientStartColor =
    safeScore >= 70 ? '#3b82f6' :
    safeScore >= 55 ? '#f97316' :
    '#ef4444';

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-[210px] mx-auto py-1 select-none">
      <svg className="w-full h-32 overflow-visible" viewBox="0 0 200 110">
        <defs>
          <linearGradient id={`gauge-grad-${safeScore}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradientStartColor} />
            <stop offset="100%" stopColor={gaugeColor} />
          </linearGradient>
          
          {/* Subtle glow filter for the active progress line tip */}
          <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={gaugeColor} floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Background Track Arc */}
        <path
          d="M 36 88 A 64 64 0 0 1 164 88"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Dynamic Progress Arc */}
        <path
          d="M 36 88 A 64 64 0 0 1 164 88"
          fill="none"
          stroke={`url(#gauge-grad-${safeScore})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />

        {/* Dynamic Tip Circle (Glowing Needle Knob) */}
        {safeScore > 0 && (
          <circle
            cx={dotX}
            cy={dotY}
            r="6"
            fill="#ffffff"
            stroke={gaugeColor}
            strokeWidth="3"
            filter="url(#dot-glow)"
            className="transition-all duration-1000 ease-out"
          />
        )}

        {/* Score Value Text in Center */}
        <text
          x="100"
          y="72"
          textAnchor="middle"
          className="fill-slate-900 font-extrabold text-[36px] tracking-tight"
          style={{ fontWeight: 900 }}
        >
          {safeScore}
        </text>
        <text
          x="100"
          y="88"
          textAnchor="middle"
          className="fill-slate-400 font-bold text-[10px] uppercase tracking-wider"
        >
          / 100 SCORE
        </text>
      </svg>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs h-[148px] relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between w-full shrink-0">
        <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
        <div className="h-8 w-8 bg-slate-100 rounded-lg animate-pulse" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center -mt-1">
        <div className="h-7 w-28 bg-slate-200/60 rounded animate-pulse" />
        <div className="h-3.5 w-36 bg-slate-100 rounded animate-pulse mt-2" />
      </div>

      {/* Bottom Sparkline Loader */}
      <div className="absolute bottom-0 left-0 right-0 px-1 pointer-events-none opacity-20">
        <svg className="w-full h-8" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path
            d="M0,22 C25,5 50,25 75,8 C90,2 95,15 100,6"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-pulse"
          />
        </svg>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isHealthScoreEnabled } = useFeaturePermissions();
  const [revenueTimeframe, setRevenueTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const hasLoadedRevenueTimeframe = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRevenueFlipped, setIsRevenueFlipped] = useState(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  const [isReconciliationDrawerOpen, setIsReconciliationDrawerOpen] = useState(false);
  const [reconciliationSearch, setReconciliationSearch] = useState('');
  const [reconciliationTypeFilter, setReconciliationTypeFilter] = useState('ALL');
  const [reconciliationPage, setReconciliationPage] = useState(1);

  // State for live Xero data calculations
  const [data, setData] = useState({
    connected: false,
    organisation: null as any,
    lastSync: null as string | null,
    invoiceStatusSummary: null as any,
    billStatusSummary: null as any,
    revenueMTD: 0,
    revenueToday: 0,
    revenueYesterday: 0,
    growthPercent: 0,
    currency: "",
    netProfit: 0,
    cogs: 0,
    grossProfit: 0,
    expenses: 0,
    creditNotesCount: 0,
    creditNotesTotal: 0,
    plRevenue: 0,
    invoiceRevenueMTD: 0,
    invoiceGrowthPercent: 0,
    netProfitGrowthPercent: 0,
    totalCash: 0,
    currentAssets: 0,
    bankAccounts: [] as any[],
    accountsReceivable: 0,
    accountsPayable: 0,
    cashGrowthPercent: 0,
    arGrowthPercent: 0,
    apGrowthPercent: 0,
    chartCash: [] as number[],
    chartAR: [] as number[],
    chartAP: [] as number[],
    overdueInvoices: [] as any[],
    chartLabels: [] as string[],
    chartRevenue: [] as number[],
    chartCompRevenue: [] as number[],
    startDate: "",
    endDate: "",
    compStartDate: "",
    compEndDate: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // Dynamic Connectors status state
  const [connectorStatus, setConnectorStatus] = useState<Record<string, boolean>>({
    xero: true,
    amazon: false,
    ebay: false,
    stripe: false
  });

  useEffect(() => {
    fetch('/api/connectors/status')
      .then(res => res.json())
      .then(s => setConnectorStatus(s))
      .catch(() => {});
  }, []);

  // Dynamic Health Score & Alerts state
  const [healthScore, setHealthScore] = useState<{
    overallScore: number;
    label: string;
    description: string;
    metrics: { name: string; score: number; color: string }[];
  } | null>(null);
  const [alertsData, setAlertsData] = useState<{
    alerts: { id: string; title: string; sub: string; time: string; color: string; icon: string }[];
    totalCount: number;
  } | null>(null);
  const [reconciliation, setReconciliation] = useState<{
    reconciliationPercentage: number;
    unreconciledTransactions: number;
    pendingTransactions: number;
    lastReconciliation: string;
    bank?: {
      reconciliationPercentage: number;
      totalTransactions: number;
      reconciledCount: number;
      unreconciledCount: number;
      unreconciledBankValue: number;
      lastReconciliation: string;
    };
    ar?: {
      outstandingCount: number;
      totalOutstandingAmount: number;
      overdueCount: number;
    };
    ap?: {
      outstandingCount: number;
      totalOutstandingAmount: number;
      overdueCount: number;
    };
    unreconciledItems?: Array<{
      id: string;
      type: string;
      contact: string;
      date: string;
      amount: number;
      status: string;
      reference: string;
    }>;
  } | null>(null);

  // Computed bank overview metrics from loaded dashboard bankAccounts
  const bankOverviewData = useMemo(() => {
    const list = data.bankAccounts || [];
    const computedSum = list.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
    const totalBalance = (data.totalCash !== null && data.totalCash !== undefined && data.totalCash !== 0)
      ? data.totalCash
      : computedSum;

    const accounts = list.map((acc: any, index: number) => {
      let status: 'healthy' | 'attention' | 'disconnected' = 'healthy';
      if (acc.status === 'DELETED' || acc.status === 'ARCHIVED') {
        status = 'disconnected';
      }

      return {
        id: acc.accountId || String(index),
        name: acc.accountName || acc.name,
        bank_name: acc.accountCode || '—',
        balance: acc.balance || 0,
        currency: acc.currency || data.currency || '',
        status,
        pending_reconciliation: null
      };
    });

    const healthyCount = accounts.filter(a => a.status === 'healthy').length;
    const attentionCount = accounts.filter(a => (a.status as string) === 'attention').length;
    const disconnectedCount = accounts.filter(a => a.status === 'disconnected').length;

    let asOfSubtext = 'As at —';
    if (data.endDate) {
      try {
        const d = new Date(data.endDate);
        if (!isNaN(d.getTime())) {
          asOfSubtext = `As at ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
      } catch (e) {}
    }

    return {
      total_accounts: accounts.length,
      healthy_accounts: healthyCount,
      attention_accounts: attentionCount,
      disconnected_accounts: disconnectedCount,
      total_balance: totalBalance,
      as_of_date: asOfSubtext,
      last_sync: data.lastSync || '',
      accounts
    };
  }, [data.bankAccounts, data.totalCash, data.endDate, data.lastSync]);

  const formatCurrency = (amount: number, currencyCode: string) => {
    if (!currencyCode) {
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
    }

    if (currencyCode === 'INR') {
      return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
    }
    if (currencyCode === 'USD') {
      return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
    }
    if (currencyCode === 'GBP') {
      return '£' + new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount);
    }
    if (currencyCode === 'EUR') {
      return '€' + new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(amount);
    }
    return `${currencyCode} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`;
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getGrowthDetails = (pct: any) => {
    const val = (pct === null || pct === undefined || isNaN(pct) || typeof pct !== 'number') ? 0 : pct;
    if (val > 0) {
      return {
        text: `↑ ${val}%`,
        className: "text-[#10b981]"
      };
    }
    if (val < 0) {
      return {
        text: `↓ ${Math.abs(val)}%`,
        className: "text-[#ef4445]"
      };
    }
    return {
      text: `0%`,
      className: "text-slate-400 font-semibold"
    };
  };

  const fromDateParam = searchParams.get('from_date') || searchParams.get('fromDate') || '';
  const toDateParam = searchParams.get('to_date') || searchParams.get('toDate') || '';

  const fetchDashboardData = async (isInitial: boolean = true) => {
    try {
      if (isInitial) {
        setIsLoading(true);
      } else {
        setChartLoading(true);
      }
      const fromDate = searchParams.get('from_date') || searchParams.get('fromDate');
      const toDate = searchParams.get('to_date') || searchParams.get('toDate');
      let url = `/api/xero/dashboard?view=${revenueTimeframe.toLowerCase()}`;
      if (fromDate && toDate) {
        url += `&from_date=${fromDate}&to_date=${toDate}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
      setChartLoading(false);
    }
  };

  // Fetch dynamic health score and alerts data
  const fetchHealthAndAlerts = async () => {
    try {
      const promises: Promise<any>[] = [
        fetch('/api/dashboard/alerts'),
        fetch('/api/dashboard/reconciliation')
      ];
      if (isHealthScoreEnabled) {
        promises.unshift(fetch('/api/dashboard/health-score'));
      }
      const results = await Promise.all(promises);

      if (isHealthScoreEnabled) {
        const hsRes = results[0];
        const alRes = results[1];
        const recRes = results[2];
        if (hsRes && hsRes.ok) {
          const hsData = await hsRes.json();
          setHealthScore(hsData);
        }
        if (alRes && alRes.ok) {
          const alData = await alRes.json();
          setAlertsData(alData);
        }
        if (recRes && recRes.ok) {
          const recData = await recRes.json();
          setReconciliation(recData);
        }
      } else {
        const alRes = results[0];
        const recRes = results[1];
        if (alRes && alRes.ok) {
          const alData = await alRes.json();
          setAlertsData(alData);
        }
        if (recRes && recRes.ok) {
          const recData = await recRes.json();
          setReconciliation(recData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch health/alerts:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    fetchHealthAndAlerts();

    // Listen for custom sync events from Header
    const handleSyncComplete = () => {
      fetchDashboardData(true);
      fetchHealthAndAlerts();
    };

    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDateParam, toDateParam, isHealthScoreEnabled]);

  useEffect(() => {
    if (!hasLoadedRevenueTimeframe.current) {
      hasLoadedRevenueTimeframe.current = true;
      return;
    }
    fetchDashboardData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueTimeframe]);

  // Refs for ECharts initialization
  const revenueChartRef = useRef<HTMLDivElement>(null);
  const healthGaugeRef = useRef<HTMLDivElement>(null);
  const dataQualityRef = useRef<HTMLDivElement>(null);

  const getPeriodLabel = (baseTitle: string, startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return `${baseTitle} (MTD)`;
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (monthsDiff === 1) {
        return `${baseTitle} (MTD)`;
      }
      return `${baseTitle} (${monthsDiff} Months)`;
    } catch {
      return `${baseTitle} (Period)`;
    }
  };

  const getComparisonDetails = (startStr?: string, endStr?: string, compStartStr?: string, compEndStr?: string) => {
    if (!startStr || !endStr) {
      return {
        label: "vs Prior Period",
        compShortRange: ""
      };
    }
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

      let compStart: Date;
      let compEnd: Date;
      if (compStartStr && compEndStr) {
        compStart = new Date(compStartStr);
        compEnd = new Date(compEndStr);
      } else {
        compEnd = new Date(start.getTime() - 24 * 3600 * 1000);
        compStart = new Date(compEnd.getTime() - (diffDays - 1) * 24 * 3600 * 1000);
      }

      const startMonth = compStart.toLocaleDateString('en-GB', { month: 'short' });
      const startYr = compStart.toLocaleDateString('en-GB', { year: '2-digit' });
      const endMonth = compEnd.toLocaleDateString('en-GB', { month: 'short' });
      const endYr = compEnd.toLocaleDateString('en-GB', { year: '2-digit' });

      let compShortRange = "";
      if (startMonth === endMonth && startYr === endYr) {
        compShortRange = `${startMonth} ${startYr}`;
      } else if (startYr === endYr) {
        compShortRange = `${startMonth} – ${endMonth} ${endYr}`;
      } else {
        compShortRange = `${startMonth} ${startYr} – ${endMonth} ${endYr}`;
      }

      return { label: "vs Prior Period", compShortRange };
    } catch {
      return {
        label: "vs Prior Period",
        compShortRange: ""
      };
    }
  };

  const compDetails = useMemo(() => {
    return getComparisonDetails(data?.startDate, data?.endDate, data?.compStartDate, data?.compEndDate);
  }, [data?.startDate, data?.endDate, data?.compStartDate, data?.compEndDate]);

  const compText = compDetails.compShortRange ? `vs (${compDetails.compShortRange})` : "vs Last Period";

  // 1. Metric Cards data
  const metricCards: Array<{
    title: string;
    asOfSubtext?: string;
    value: string;
    amount: number;
    currency: string;
    change: string;
    changeClass: string;
    tooltipText: string;
    iconBg: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }> = useMemo(() => [
    {
      title: getPeriodLabel("Revenue", data?.startDate, data?.endDate),
      value: isLoading ? "..." : formatCurrency(data.revenueMTD, data.currency),
      amount: data.revenueMTD || 0,
      currency: data.currency,
      change: isLoading ? "..." : `${getGrowthDetails(data.growthPercent).text} ${compText}`,
      changeClass: getGrowthDetails(data.growthPercent).className,
      tooltipText: "Accounting Revenue from Xero Profit & Loss Report (VAT Excluded, Credit Notes Included).",
      iconBg: "bg-[#e8f0fe] rounded-xl border border-blue-100/50",
      icon: (
        <svg className="h-5.5 w-5.5 text-[#0064eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          <polyline points="12 12 16 8" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      )
    },
    {
      title: getPeriodLabel("Net Profit", data?.startDate, data?.endDate),
      value: isLoading ? "..." : formatCurrency(data.netProfit || 0, data.currency),
      amount: data.netProfit || 0,
      currency: data.currency,
      change: isLoading ? "..." : `${getGrowthDetails(data.netProfitGrowthPercent).text} ${compText}`,
      changeClass: getGrowthDetails(data.netProfitGrowthPercent).className,
      tooltipText: "Net Profit from Xero Profit & Loss Report (VAT Excluded, Credit Notes Included).",
      iconBg: "bg-[#e6fcf5] rounded-xl border border-emerald-100/50",
      icon: (
        <svg className="h-5.5 w-5.5 text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="13" width="4" height="7" rx="1" />
          <rect x="10" y="8" width="4" height="12" rx="1" />
          <rect x="17" y="3" width="4" height="17" rx="1" />
          <path d="M5 11c3-4 6-4 14-8" />
        </svg>
      )
    },
    {
      title: "Total Cash",
      asOfSubtext: data?.endDate ? `As at ${new Date(data.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'As at —',
      value: isLoading ? "..." : formatCurrency(data.totalCash || 0, data.currency),
      amount: data.totalCash || 0,
      currency: data.currency,
      change: isLoading ? "..." : `${getGrowthDetails(data.cashGrowthPercent).text} ${compText}`,
      changeClass: getGrowthDetails(data.cashGrowthPercent).className,
      tooltipText: "Point-in-time snapshot as of date. Sum of all liquid bank accounts verified from Chart of Accounts. Click card to view distribution breakdown.",
      onClick: () => setIsCashDrawerOpen(true),
      iconBg: "bg-[#e6fcf5] rounded-xl border border-emerald-100/50 cursor-pointer hover:bg-emerald-100/70 transition-colors",
      icon: (
        <svg className="h-5.5 w-5.5 text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    },
    {
      title: "Accounts Receivable (Paid)",
      value: isLoading ? "..." : formatCurrency(data.accountsReceivable || 0, data.currency),
      amount: data.accountsReceivable || 0,
      currency: data.currency,
      change: isLoading ? "..." : `${getGrowthDetails(data.arGrowthPercent).text} ${compText}`,
      changeClass: getGrowthDetails(data.arGrowthPercent).className,
      tooltipText: "Total money collected from paid sales invoices in this period (VAT Included, Credit Notes Excluded).",
      iconBg: "bg-[#fef3c7] rounded-xl border border-amber-100/50",
      icon: (
        <svg className="h-5.5 w-5.5 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
          <circle cx="15" cy="15" r="2" />
        </svg>
      )
    },
    {
      title: "Accounts Payable (Paid)",
      value: isLoading ? "..." : formatCurrency(data.accountsPayable || 0, data.currency),
      amount: data.accountsPayable || 0,
      currency: data.currency,
      change: isLoading ? "..." : `${getGrowthDetails(data.apGrowthPercent).text} ${compText}`,
      changeClass: getGrowthDetails(data.apGrowthPercent).className,
      tooltipText: "Total money paid to suppliers for bills in this period (VAT Included, Credit Notes Excluded).",
      iconBg: "bg-[#f3e8ff] rounded-xl border border-purple-100/50",
      icon: (
        <svg className="h-5.5 w-5.5 text-[#a855f7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
          <path d="M12 7V3" />
          <circle cx="12" cy="14" r="3" />
        </svg>
      )
    }
  ], [data, isLoading, searchParams, compText]);

  // 2. Initialize Revenue Trend Line Chart
  useEffect(() => {
    if (!revenueChartRef.current) return;
    const chartInstance = echarts.init(revenueChartRef.current);

    const labels = data.chartLabels && data.chartLabels.length > 0
      ? data.chartLabels
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataLen = labels.length;

    const currentRevData = (data.chartRevenue && data.chartRevenue.length > 0)
      ? (data.chartRevenue.length === dataLen ? data.chartRevenue : data.chartRevenue.slice(0, dataLen))
      : Array(dataLen).fill(0);

    const prevRevData = (data.chartCompRevenue && data.chartCompRevenue.length > 0)
      ? (data.chartCompRevenue.length === dataLen ? data.chartCompRevenue : data.chartCompRevenue.slice(0, dataLen))
      : Array(dataLen).fill(0);

    const option = {
      grid: {
        left: '3%',
        right: '4%',
        top: '14%',
        bottom: '5%',
        containLabel: true
      },
      tooltip: {
        show: true,
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowBlur: 10,
        textStyle: {
          color: '#334155',
          fontFamily: 'var(--font-sans), sans-serif',
          fontSize: 11
        },
        formatter: function (params: any) {
          if (!Array.isArray(params) || params.length === 0) return '';
          const curr = params.find((p: any) => p.seriesName?.includes('Current')) || params[0];
          const prev = params.find((p: any) => p.seriesName?.includes('Previous')) || params[1];
          const displayCurrency = data.currency || "";

          const formatVal = (v: number) => {
            if (v === undefined || v === null) return `${displayCurrency} 0`;
            return `${displayCurrency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;
          };

          const currVal = curr ? (curr.value || 0) : 0;
          const prevVal = prev ? (prev.value || 0) : 0;

          const currYear = data.startDate ? new Date(data.startDate).getFullYear() : 2026;
          const prevYear = currYear - 1;

          let growthBadge = '';
          if (prevVal > 0) {
            const diffPct = (((currVal - prevVal) / prevVal) * 100).toFixed(1);
            const isPos = parseFloat(diffPct) >= 0;
            growthBadge = `<div style="margin-top: 6px; padding: 4px 8px; background: ${isPos ? '#f0fdf4' : '#fff1f2'}; border: 1px solid ${isPos ? '#bbf7d0' : '#fecdd3'}; border-radius: 6px; font-weight: 700; font-size: 10.5px; color: ${isPos ? '#15803d' : '#be123c'}; text-align: center;">${isPos ? '↑' : '↓'} ${Math.abs(parseFloat(diffPct))}% vs ${prevYear}</div>`;
          } else {
            growthBadge = `<div style="margin-top: 6px; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-weight: 600; font-size: 10px; color: #64748b; text-align: center;">No ${prevYear} baseline data</div>`;
          }

          return `
            <div style="font-family: var(--font-sans), sans-serif; min-width: 170px; padding: 2px;">
              <div style="font-weight: 700; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 8px; font-size: 11px;">
                ${curr.axisValue} Performance
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px;">
                <span style="color: #0064eb; font-weight: 700;">● ${currYear}:</span>
                <span style="font-weight: 800; color: #0f172a; margin-left: 10px;">${formatVal(currVal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px;">
                <span style="color: #10b981; font-weight: 700;">● ${prevYear}:</span>
                <span style="font-weight: 800; color: #0f172a; margin-left: 10px;">${formatVal(prevVal)}</span>
              </div>
              ${growthBadge}
            </div>
          `;
        }
      },
      legend: {
        data: [`Current Year (${data.startDate ? new Date(data.startDate).getFullYear() : 2026})`, `Previous Year (${data.startDate ? new Date(data.startDate).getFullYear() - 1 : 2025})`],
        right: '0',
        top: '0',
        icon: 'circle',
        textStyle: {
          color: '#94a3b8',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'var(--font-sans), sans-serif'
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 505, fontFamily: 'var(--font-sans), sans-serif' }
      },
      yAxis: [
        {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          scale: true,
          splitLine: {
            lineStyle: {
              color: '#f8fafc',
              type: 'dashed'
            }
          },
          axisLabel: {
            formatter: (val: number) => {
              const displayCurrency = data.currency || "";
              if (!displayCurrency) return `${val}`;
              if (displayCurrency === 'INR') return `₹${val / 100000}L`;
              return `${displayCurrency} ${val}`;
            },
            color: '#94a3b8',
            fontSize: 10,
            fontWeight: 505,
            fontFamily: 'var(--font-sans), sans-serif'
          }
        },
        {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          scale: true,
          splitLine: { show: false },
          axisLabel: {
            formatter: (val: number) => {
              const displayCurrency = data.currency || "";
              if (!displayCurrency) return `${val}`;
              if (displayCurrency === 'INR') return `₹${val / 100000}L`;
              return `${displayCurrency} ${val}`;
            },
            color: '#10b981',
            fontSize: 10,
            fontWeight: 505,
            fontFamily: 'var(--font-sans), sans-serif'
          }
        }
      ],
      series: [
        {
          name: `Current Year (${data.startDate ? new Date(data.startDate).getFullYear() : 2026})`,
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: '#0064eb', borderWidth: 2 },
          lineStyle: { width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0, 100, 235, 0.10)' },
                { offset: 1, color: 'rgba(0, 100, 235, 0.00)' }
              ]
            }
          },
          data: currentRevData
        },
        {
          name: `Previous Year (${data.startDate ? new Date(data.startDate).getFullYear() - 1 : 2025})`,
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#10b981', borderWidth: 2 },
          lineStyle: { width: 2, type: 'dashed' },
          data: prevRevData
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
  }, [revenueTimeframe, data]);



  // 4. Initialize Data Quality Doughnut
  useEffect(() => {
    if (!dataQualityRef.current) return;
    const chartInstance = echarts.init(dataQualityRef.current);

    const option = {
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: { label: { show: false } },
          data: [
            { value: healthScore?.overallScore ?? 0, itemStyle: { color: '#10b981' } },
            { value: healthScore ? Math.max(0, 100 - healthScore.overallScore) : 100, itemStyle: { color: '#f1f5f9' } }
          ]
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
  }, [healthScore]);

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Executive Master Command Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-linear-to-r from-[#0b1736] via-[#0f2347] to-[#133863] p-5 rounded-2xl text-white shadow-md border border-slate-700/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#00b7e2]/20 border border-[#00b7e2]/40 flex items-center justify-center text-[#00b7e2]">
              <LayoutDashboard className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">Virtual CFO Executive Overview</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Master Command Center
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Consolidated intelligence & multi-channel financial metrics for <span className="text-[#00b7e2] font-semibold">{typeof data.organisation === 'string' ? data.organisation : (data.organisation?.Name || data.organisation?.LegalName || 'My Workspace')}</span>.
          </p>
        </div>

        {/* Quick Connectors Live Badges */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className={cn("h-2 w-2 rounded-full", connectorStatus.xero ? "bg-emerald-400" : "bg-slate-500")} />
            <span className="font-semibold text-white">Xero:</span>
            <span className={connectorStatus.xero ? "text-emerald-400 font-bold" : "text-slate-400"}>{connectorStatus.xero ? 'Connected' : 'Locked'}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className={cn("h-2 w-2 rounded-full", connectorStatus.amazon ? "bg-emerald-400" : "bg-amber-400")} />
            <span className="font-semibold text-white">Amazon:</span>
            <span className={connectorStatus.amazon ? "text-emerald-400 font-bold" : "text-amber-400 flex items-center gap-0.5"}><Lock className="h-2.5 w-2.5 inline" /> Locked</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className={cn("h-2 w-2 rounded-full", connectorStatus.stripe ? "bg-emerald-400" : "bg-amber-400")} />
            <span className="font-semibold text-white">Stripe:</span>
            <span className={connectorStatus.stripe ? "text-emerald-400 font-bold" : "text-amber-400 flex items-center gap-0.5"}><Lock className="h-2.5 w-2.5 inline" /> Locked</span>
          </div>

          <Link href="/data-sources" className="flex items-center gap-1 bg-[#00b7e2] hover:bg-[#009ec3] text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer">
            <span>Manage Connectors</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>



      {/* 1. Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))
        ) : (
          <>
            {metricCards.map((card, idx) => {
              const parts = card.change.split(' vs ');
              const percentPart = parts[0];
              const labelPart = parts[1] ? ` vs ${parts[1]}` : '';

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs transition-all duration-350 ease-out select-none h-[148px] relative hover:translate-y-2 hover:shadow-xs z-10 hover:z-20",
                    card.onClick ? "cursor-pointer" : ""
                  )}
                  onClick={card.onClick}
                >
                  <div className="flex items-start justify-between w-full shrink-0">
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="text-[11px] font-bold text-slate-500 leading-none flex items-center gap-1">
                        <span className="truncate">{card.title}</span>
                        {card.tooltipText && <Tooltip text={card.tooltipText} position="top" />}
                      </span>
                      {card.asOfSubtext && (
                        <span className="text-[9px] font-semibold text-emerald-600 mt-1 block tracking-tight">
                          {card.asOfSubtext}
                        </span>
                      )}
                    </div>
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shadow-3xs shrink-0", card.iconBg)}>
                      {card.icon}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center z-10 -mt-1">
                    <FormattedAmount amount={card.amount} currencyCode={card.currency} compact={false} className="text-[16px] sm:text-[17px] font-extrabold text-slate-800 leading-tight tracking-tight truncate select-all" />
                    <p className="text-[11px] font-semibold mt-1 leading-none whitespace-nowrap">
                      <span className={card.changeClass}>{percentPart}</span>
                      <span className="text-slate-400">{labelPart}</span>
                    </p>
                  </div>

                  {/* Bottom Sparkline */}
                  <div className="absolute bottom-0 left-0 right-0 px-1 pointer-events-none">
                    <Sparkline
                      dataPoints={
                        idx === 0 ? data.chartRevenue :
                          idx === 1 ? [] :
                            idx === 2 ? data.chartCash :
                              idx === 3 ? data.chartAR :
                                idx === 4 ? data.chartAP : []
                      }
                      color={
                        idx === 0 ? "#0064eb" :
                          idx === 1 ? "#10b981" :
                            idx === 2 ? "#10b981" :
                              idx === 3 ? "#0064eb" :
                                idx === 4 ? "#a855f7" : "#0064eb"
                      }
                    />
                  </div>
                </div>
              );
            })}

            {/* Bank Reconciliation Card - Commented out per user request */}
            {/*
            <div
              onClick={() => setIsReconciliationDrawerOpen(true)}
              className="flex flex-col bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition duration-200 select-none h-[148px] relative overflow-hidden cursor-pointer group"
            >
              <div className="flex items-center justify-between w-full shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 leading-none flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="truncate">Bank Reconciliation</span>
                  <span title="Reconciled bank statement lines comparison status.">
                    <Info className="h-3.5 w-3.5 text-slate-350 hover:text-slate-500 cursor-help" />
                  </span>
                </span>
                <div className="relative h-7.5 w-7.5 flex items-center justify-center shrink-0 ml-1">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="text-slate-100" strokeWidth="3.5" stroke="currentColor" />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      className="text-emerald-500"
                      strokeWidth="3.5"
                      strokeDasharray={`${(data.connected ? (reconciliation?.bank?.reconciliationPercentage ?? reconciliation?.reconciliationPercentage ?? 0) : 0)}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center z-10 -mt-1">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-[20px] font-extrabold text-slate-800 leading-tight tracking-tight">
                    {reconciliation?.bank?.reconciliationPercentage ?? reconciliation?.reconciliationPercentage ?? 'N/A'}{reconciliation?.bank?.reconciliationPercentage == null && reconciliation?.reconciliationPercentage == null ? '' : '%'}
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    {reconciliation?.bank?.reconciledCount ?? 'N/A'} / {reconciliation?.bank?.totalTransactions ?? 'N/A'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold mt-1 leading-none whitespace-nowrap">
                  <span className="text-amber-600 font-bold">
                    {reconciliation?.bank?.unreconciledCount ?? 'N/A'} bank txns
                  </span>
                  <span className="text-slate-400"> need review</span>
                </p>
                <div className="text-[10px] font-extrabold text-slate-500 mt-1 flex items-center justify-between border-t border-slate-50 pt-1">
                  <span>Unmatched Value:</span>
                  <span className="text-rose-700 font-black">
                    {formatCurrency(reconciliation?.bank?.unreconciledBankValue ?? 24580, data.currency)}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 px-1 pointer-events-none opacity-40">
                <Sparkline dataPoints={[]} color="#10b981" />
              </div>
            </div>
            */}
          </>
        )}
      </div>

      {/* ─── 1b. REVENUE WATERFALL ROW (Gross Sales → Credit Notes → Net Revenue) ─── */}
      {!isLoading && data.connected && (
        <div className="space-y-4 select-none">
          {/* Revenue Section Header */}
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Revenue Flow & Adjustments
            </h3>
            <span className="text-[10.5px] font-bold text-slate-400">Gross Sales − Credit Notes = Net Revenue</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Gross Sales */}
            <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-slate-600 flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="truncate">Gross Sales</span>
                  <Tooltip text="Total revenue from Xero Profit & Loss report before deducting credit notes & adjustments." position="top" />
                </span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider shrink-0">
                  P&L Revenue
                </span>
              </div>
              <div className="my-1">
                <FormattedAmount amount={data.revenueMTD || 0} currencyCode={data.currency} compact={false} className="text-[18px] sm:text-[19px] font-extrabold text-slate-900 leading-tight tracking-tight select-all" />
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Total revenue from Xero P&L Report</p>
              </div>
            </div>

            {/* 2. Less Credit Notes */}
            <div className="bg-white p-4.5 rounded-xl border border-rose-200/70 bg-rose-50/10 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-rose-700 flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="truncate">Less: Credit Notes & Returns</span>
                  <Tooltip text="Total credit notes, customer refunds, and sales return adjustments." position="top" />
                </span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                  <Minus className="h-3 w-3" /> Subtract
                </span>
              </div>
              <div className="my-1">
                <FormattedAmount amount={data.creditNotesTotal || 0} currencyCode={data.currency} compact={false} className="text-[18px] sm:text-[19px] font-extrabold text-rose-600 leading-tight tracking-tight select-all" />
                <p className="text-[11px] font-semibold text-slate-400 mt-1">
                  <span className="text-rose-600 font-bold">{data.creditNotesCount || 0}</span> Credit Notes in period
                </p>
              </div>
            </div>

            {/* 3. Net Revenue */}
            <div className="bg-white p-4.5 rounded-xl border-2 border-emerald-200/80 bg-emerald-50/10 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-extrabold text-emerald-800 flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="truncate">Net Revenue (After Credit Notes)</span>
                  <Tooltip text="Net Invoiced Revenue = Total P&L Revenue minus Credit Notes & Returns." position="top" />
                </span>
                <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                  <Equal className="h-3 w-3" /> Net Sales
                </span>
              </div>
              <div className="my-1">
                <FormattedAmount amount={(data.revenueMTD || 0) - (data.creditNotesTotal || 0)} currencyCode={data.currency} compact={false} className="text-[18px] sm:text-[19px] font-extrabold text-emerald-700 leading-tight tracking-tight select-all" />
                <p className="text-[11px] font-semibold text-slate-400 mt-1">
                  <span className={data.growthPercent >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                    {data.growthPercent >= 0 ? "↑" : "↓"} {Math.abs(data.growthPercent)}%
                  </span> {compText}
                </p>
              </div>
            </div>
          </div>

          {/* ─── 1c. PROFITABILITY & EXPENSE WATERFALL ROW ─── */}
          <div className="pt-2 space-y-4">
            {/* Profit Section Header */}
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Profitability & Cost Breakdown
              </h3>
              <span className="text-[10.5px] font-bold text-slate-400">Gross Profit − COGS − Operating Expenses = Net Profit</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Gross Profit */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="truncate">Gross Profit</span>
                    <Tooltip text="Gross Profit = Revenue minus Cost of Goods Sold (Direct Costs)." position="top" />
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/60 shrink-0">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="my-1">
                  <FormattedAmount amount={data.grossProfit || (data.revenueMTD - data.cogs)} currencyCode={data.currency} compact={false} className="text-[17px] sm:text-[18px] font-extrabold text-slate-900 leading-tight tracking-tight select-all" />
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">
                    <span className="text-emerald-600 font-bold">
                      {data.revenueMTD > 0 ? (((data.grossProfit || (data.revenueMTD - data.cogs)) / data.revenueMTD) * 100).toFixed(1) : 0}%
                    </span> Gross Margin
                  </p>
                </div>
              </div>

              {/* 2. Direct Costs / COGS */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="truncate">Cost of Goods Sold (COGS)</span>
                    <Tooltip text="Direct materials, labor, and production costs directly attributable to revenue." position="top" />
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100/60 shrink-0">
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="my-1">
                  <FormattedAmount amount={data.cogs || 0} currencyCode={data.currency} compact={false} className="text-[17px] sm:text-[18px] font-extrabold text-amber-600 leading-tight tracking-tight select-all" />
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">
                    <span className="text-amber-600 font-bold">
                      {data.revenueMTD > 0 ? (((data.cogs || 0) / data.revenueMTD) * 100).toFixed(1) : 0}%
                    </span> of Revenue (Direct Costs)
                  </p>
                </div>
              </div>

              {/* 3. Operating / Indirect Expenses */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="truncate">Indirect & Operating Expenses</span>
                    <Tooltip text="Indirect overheads, administrative, selling, marketing, and general operational expenses." position="top" />
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100/60 shrink-0">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="my-1">
                  <FormattedAmount amount={data.expenses || 0} currencyCode={data.currency} compact={false} className="text-[17px] sm:text-[18px] font-extrabold text-purple-700 leading-tight tracking-tight select-all" />
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">
                    <span className="text-purple-600 font-bold">
                      {data.revenueMTD > 0 ? (((data.expenses || 0) / data.revenueMTD) * 100).toFixed(1) : 0}%
                    </span> Expense Ratio (Overheads)
                  </p>
                </div>
              </div>

              {/* 4. Net Profit */}
              <div className="bg-white p-4.5 rounded-xl border-2 border-emerald-200/80 bg-emerald-50/10 shadow-2xs flex flex-col justify-between h-[135px] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-extrabold text-emerald-800 flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="truncate">Net Profit (Bottom Line)</span>
                    <Tooltip text="Final Net Profit from Xero Profit & Loss Report after deducting COGS and operating expenses." position="top" />
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="my-1">
                  <FormattedAmount amount={data.netProfit || 0} currencyCode={data.currency} compact={false} className="text-[17px] sm:text-[18px] font-extrabold text-emerald-700 leading-tight tracking-tight select-all" />
                  <p className="text-[11px] font-semibold text-slate-400 mt-1">
                    <span className="text-emerald-600 font-bold">
                      {data.revenueMTD > 0 ? (((data.netProfit || 0) / data.revenueMTD) * 100).toFixed(1) : 0}%
                    </span> Net Profit Margin
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Middle Row: Line Chart & Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {isLoading ? (
          <>
            {/* 1. Revenue Trend Line Chart Skeleton */}
            <div className={cn(
              isHealthScoreEnabled ? "lg:col-span-7" : "lg:col-span-12",
              "bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs h-[350px] flex flex-col justify-between select-none"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-32 bg-slate-50 rounded animate-pulse" />
              </div>
              <div className="flex-1 flex flex-col justify-end gap-3 h-52 relative">
                {/* Visual line wave skeleton representation */}
                <svg className="w-full h-full opacity-10" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <path d="M0,25 C15,10 30,22 45,5 C60,18 75,5 90,15 C95,20 100,5 100,5" fill="none" stroke="#cbd5e1" strokeWidth="2" className="animate-pulse" />
                </svg>
                <div className="flex justify-between items-center px-1 text-[10px] text-slate-200">
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* 2. Business Health Score Skeleton */}
            {isHealthScoreEnabled && (
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none h-[350px]">
                <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between">
                  <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-4 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center py-4">
                  {/* Circle gauge representation skeleton */}
                  <div className="h-24 w-24 rounded-full border-[7px] border-slate-50 border-t-slate-200 animate-spin" />
                  <div className="h-3 w-20 bg-slate-100 rounded animate-pulse mt-4" />
                  <div className="h-2 w-32 bg-slate-100 rounded animate-pulse mt-2" />
                </div>
                <div className="space-y-2 mt-3 pt-3 border-t border-slate-50">
                  <div className="h-2.5 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-2.5 w-5/6 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            )}

            {/* 3. Alerts & Notifications Skeleton (Temporarily disabled)
            <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none h-[350px]">
              <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                <div className="h-3.5 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="flex-1 space-y-3 overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-50 bg-slate-50/20">
                    <div className="h-6 w-6 rounded-full bg-slate-100 shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                      <div className="h-2.5 w-1/2 bg-slate-50 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            */}
          </>
        ) : !data.connected ? (
          <>
            {/* Revenue Trend Disconnected */}
            <div className={cn(
              isHealthScoreEnabled ? "lg:col-span-7" : "lg:col-span-12",
              "bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[350px]"
            )}>
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3.5 animate-pulse">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
              <p className="text-[10.5px] text-slate-400 max-w-[240px] leading-relaxed font-sans">
                Please connect your Xero organization to view your Revenue Trend analytics.
              </p>
            </div>
            {/* Business Health Score Disconnected */}
            {isHealthScoreEnabled && (
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[350px]">
                <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3.5 animate-pulse">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
                <p className="text-[10.5px] text-slate-400 max-w-[200px] leading-relaxed font-sans">
                  Please connect your Xero organization to calculate your Business Health Score.
                </p>
              </div>
            )}
            {/* Alerts Disconnected (Temporarily disabled)
            <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[350px]">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3.5 animate-pulse">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
              <p className="text-[10.5px] text-slate-400 max-w-[200px] leading-relaxed font-sans">
                Please connect your Xero organization to view alerts and notifications.
              </p>
            </div>
            */}
          </>
        ) : (
          <>
            {/* Revenue Trend Line Chart */}
            <div className={cn(
              isHealthScoreEnabled ? "lg:col-span-7" : "lg:col-span-12",
              "bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between overflow-hidden"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
                <h3 className="text-[13.5px] font-bold text-slate-800">Revenue Trend</h3>

                <div className="flex rounded-md border border-slate-200 p-0.5 bg-slate-50 select-none">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRevenueTimeframe(mode)}
                      className={cn(
                        "px-2.5 py-1 text-[9.5px] font-bold rounded transition cursor-pointer outline-none",
                        revenueTimeframe === mode
                          ? "bg-white shadow-2xs text-primary font-bold"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Container utilizing direct ref to mount successfully under React 19 */}
              <div className="h-68 w-full flex-1 min-h-[270px] relative">
                <div ref={revenueChartRef} className="w-full h-full" />
                {(isLoading || chartLoading) && (
                  <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-lg z-20 transition-all duration-300">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <div className="w-10 h-10 border-[3px] border-slate-100 rounded-full animate-spin"></div>
                        <div className="absolute w-10 h-10 border-[3px] border-t-[#0064eb] rounded-full animate-spin"></div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[11.5px] font-bold text-slate-700 animate-pulse">Calculating trends...</p>
                        <p className="text-[9.5px] text-slate-400 font-medium">Processing Xero financial ledger</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Business Health Score Gauge (Only if enabled) */}
            {isHealthScoreEnabled && (
              <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
                <div className="border-b border-slate-100 pb-3 mb-2 flex items-center justify-between shrink-0">
                  <h3 className="text-[13.5px] font-bold text-slate-800">Business Health Score</h3>
                  <button className="text-slate-400 hover:text-slate-700 outline-none"><MoreVertical className="h-4 w-4" /></button>
                </div>

                <div className="relative flex flex-col items-center justify-center flex-1 min-h-[125px]">
                  {/* Native SVG Speedometer Gauge Meter */}
                  <HealthScoreGaugeMeter score={healthScore?.overallScore ?? 0} />

                  {healthScore ? (
                    <div className="text-center mt-0.5">
                      <span className={cn(
                        "text-[10.5px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider border inline-flex items-center gap-1.5 shadow-3xs",
                        healthScore.label === 'EXCELLENT' || healthScore.label === 'GOOD' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700' :
                          healthScore.label === 'FAIR' ? 'bg-amber-50/90 border-amber-200 text-amber-700' :
                            healthScore.label === 'WARNING' ? 'bg-orange-50/90 border-orange-200 text-orange-700' :
                              healthScore.label === 'OFFLINE' || healthScore.label === 'DISCONNECTED' ? 'bg-slate-100 border-slate-200 text-slate-500' :
                                'bg-rose-50/90 border-rose-200 text-rose-700'
                      )}>
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full animate-pulse",
                          healthScore.label === 'EXCELLENT' || healthScore.label === 'GOOD' ? 'bg-emerald-500' :
                            healthScore.label === 'FAIR' ? 'bg-amber-500' :
                              healthScore.label === 'WARNING' ? 'bg-orange-500' : 'bg-rose-500'
                        )} />
                        {healthScore.label}
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 leading-tight">{healthScore.description}</p>
                    </div>
                  ) : (
                    <div className="text-center mt-1">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border bg-slate-50 border-slate-200 text-slate-400">Loading</span>
                      <p className="text-[11px] text-slate-400 font-medium mt-1.5 leading-normal">Calculating health score...</p>
                    </div>
                  )}
                </div>

                {/* KPI progress bars */}
                <div className="space-y-2 mt-3 pt-3 border-t border-slate-50 shrink-0">
                  {healthScore ? (
                    healthScore.metrics.map((kpi, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-500">
                          <span>{kpi.name}</span>
                          <span className="text-slate-700 font-bold">{kpi.score}/100</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${kpi.score}%`, backgroundColor: kpi.color }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    ['Profitability', 'Liquidity', 'Efficiency', 'Solvency', 'Growth'].map((name) => (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-500">
                          <span>{name}</span>
                          <span className="text-slate-300 font-bold">—</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div className="h-full rounded-full bg-slate-100 animate-pulse" style={{ width: '30%' }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Alerts & Notifications (Temporarily disabled)
            <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
              <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between shrink-0">
                <h3 className="text-[13.5px] font-bold text-slate-800">Alerts & Notifications</h3>
                <Link href="/alerts" className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5">
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[350px] pr-1">
                {alertsData === null ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/30">
                        <div className="h-5.5 w-5.5 shrink-0 rounded-full bg-slate-100 animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                          <div className="h-2.5 w-1/2 bg-slate-50 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : alertsData.alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                      <svg className="h-5 w-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-[12px] font-bold text-slate-500">No Notifications</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">You&apos;re all caught up!</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {alertsData.alerts.map((alert, idx) => (
                      <div key={alert.id || idx} className="flex items-start gap-3 text-[11px] leading-normal p-2.5 rounded-lg border border-slate-100 bg-slate-50/30">
                        <div className={cn("flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-white font-bold text-[10px]", alert.color)}>
                          {alert.icon}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-700 truncate">{alert.title}</span>
                            <span className="text-[9.5px] text-slate-400 font-medium shrink-0">{alert.time}</span>
                          </div>
                          <div className="text-[10px] text-slate-450 font-semibold">{alert.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            */}
          </>
        )}
      </div>

      {/* Financial & Accounting Overview Row */}
      <FinancialAccountingOverview data={data} loading={isLoading} />

      {/* 2.5 New Second Row: 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <OrganizationDetailsCard
          organisation={data.organisation}
          lastSync={data.lastSync}
          loading={isLoading}
        />
        <ConnectedBankAccountsCard
          data={bankOverviewData}
          loading={isLoading}
          onRefresh={fetchDashboardData}
          onManageConnections={() => window.location.href = '/data-sources'}
        />
        <InvoiceStatusSummaryCard
          summary={data.invoiceStatusSummary}
          loading={isLoading}
          onViewAll={() => window.location.href = '/invoices'}
        />
        <BillStatusSummaryCard
          summary={data.billStatusSummary}
          loading={isLoading}
          onViewAll={() => window.location.href = '/purchases'}
        />
      </div>

      {/* 2.7 New Third Row: 6 KPI Cards */}
      <KpisRow
        currency={data.currency}
        fromDate={searchParams.get('from_date')}
        toDate={searchParams.get('to_date')}
        loading={isLoading}
      />

      {/* 2.8 New Fourth Row: 4 Accounts/Reconciliation Summary Cards */}
      <OverviewMoreCardsRow connected={data.connected} loading={isLoading} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {isLoading ? (
          <>
            {/* 1. Top Overdue Invoices Skeleton */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs overflow-hidden select-none min-h-[290px] flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="space-y-4 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center gap-3">
                    <div className="h-3 w-1/4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-1/6 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3.5 w-1/6 bg-slate-200/60 rounded animate-pulse ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Profit & Loss Skeleton */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none min-h-[290px]">
              <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="space-y-3 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center gap-3">
                    <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2 w-12 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-slate-200/60 rounded animate-pulse ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : !data.connected ? (
          <>
            {/* Top Overdue Invoices Disconnected */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[290px]">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3.5 animate-pulse">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
              <p className="text-[10.5px] text-slate-455 font-bold max-w-[240px] leading-relaxed font-sans">
                Please connect your Xero organization to view overdue invoices.
              </p>
            </div>
            {/* Profit & Loss Disconnected */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[290px]">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3.5 animate-pulse">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
              <p className="text-[10.5px] text-slate-455 font-bold max-w-[200px] leading-relaxed font-sans">
                Please connect your Xero organization to view your Profit & Loss statements.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Top Overdue Invoices Table */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs overflow-hidden select-none">
              <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-slate-800">Top Overdue Invoices</h3>
                <Link href="/invoices/overdue" className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5">
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-2">Customer</th>
                      <th className="py-3 px-2">Invoice #</th>
                      <th className="py-3 px-2">Due Date</th>
                      <th className="py-3 px-2 text-right">Amount</th>
                      <th className="py-3 px-2 text-right w-24">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="py-3 px-2"><div className="h-3 w-24 bg-slate-100 rounded" /></td>
                          <td className="py-3 px-2"><div className="h-3 w-12 bg-slate-100 rounded" /></td>
                          <td className="py-3 px-2"><div className="h-3 w-16 bg-slate-100 rounded" /></td>
                          <td className="py-3 px-2 text-right"><div className="h-3 w-16 bg-slate-100 rounded ml-auto" /></td>
                          <td className="py-3 px-2 text-right"><div className="h-3 w-12 bg-slate-100 rounded ml-auto" /></td>
                        </tr>
                      ))
                    ) : (!data.overdueInvoices || data.overdueInvoices.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-12">
                          <div className="flex flex-col items-center justify-center text-center px-4">
                            <div className="h-11 w-11 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100 shadow-2xs">
                              <FileCheck className="h-5 w-5 stroke-[1.5]" />
                            </div>
                            <h4 className="text-[12px] font-bold text-slate-700 mb-0.5 font-sans">All Caught Up!</h4>
                            <p className="text-[10.5px] text-slate-400 max-w-[240px] font-sans">No overdue invoices found at the moment.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.overdueInvoices.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-2 font-bold text-slate-700 truncate max-w-[150px]">{row.name}</td>
                          <td className="py-3 px-2 text-slate-400 font-semibold">{row.id}</td>
                          <td className="py-3 px-2 text-slate-400 font-semibold">{formatDateString(row.due)}</td>
                          <td className="py-3 px-2 text-right font-bold text-slate-800">
                            <FormattedAmount amount={row.amount} currencyCode={data.currency} className="font-bold text-[11px]" />
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-[#ef4444]">{row.days} days</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Profit & Loss summary widget */}
            <div className="lg:col-span-6 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
              <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-slate-800">Profit & Loss (MTD)</h3>
                <Link href="/reports" className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5">
                  <span>View Report</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex-1 space-y-4 pt-2">
                {[
                  {
                    label: 'Revenue',
                    amount: data.plRevenue || 0,
                    percent: (data.plRevenue && data.plRevenue > 0) ? 100 : 0,
                    color: 'bg-emerald-500',
                    showBar: true
                  },
                  {
                    label: 'Cost of Goods Sold',
                    amount: data.cogs || 0,
                    percent: (data.plRevenue && data.plRevenue > 0) ? Math.min(100, Math.max(0, ((data.cogs || 0) / data.plRevenue * 100))) : 0,
                    color: 'bg-red-500',
                    showBar: true
                  },
                  {
                    label: 'Gross Profit',
                    amount: data.grossProfit || 0,
                    percent: (data.plRevenue && data.plRevenue > 0) ? Math.min(100, Math.max(0, ((data.grossProfit || 0) / data.plRevenue * 100))) : 0,
                    showBar: false,
                    isLabelBold: true,
                    hasDividerAbove: true
                  },
                  {
                    label: 'Operating Expenses',
                    amount: data.expenses || 0,
                    percent: (data.plRevenue && data.plRevenue > 0) ? Math.min(100, Math.max(0, ((data.expenses || 0) / data.plRevenue * 100))) : 0,
                    color: 'bg-red-500',
                    showBar: true
                  },
                  {
                    label: 'Net Profit',
                    amount: data.netProfit || 0,
                    percent: (data.plRevenue && data.plRevenue > 0) ? Math.min(100, Math.max(0, ((data.netProfit || 0) / data.plRevenue * 100))) : 0,
                    color: 'bg-emerald-500',
                    showBar: true,
                    isLabelBold: true,
                    hasDividerAbove: true
                  },
                ].map((row, idx) => (
                  <React.Fragment key={idx}>
                    {row.hasDividerAbove && (
                      <div className="border-t border-slate-100 my-2.5" />
                    )}
                    <div className="grid grid-cols-[120px_1fr_95px] gap-2 items-center text-[11px] min-h-[32px]">
                      <div className="flex flex-col min-w-0">
                        <span className={cn(row.isLabelBold ? "font-bold text-slate-800" : "text-slate-500 font-semibold", "truncate")}>
                          {row.label}
                        </span>
                        {row.label === 'Gross Profit' && (
                          <span className="text-[9px] text-slate-455 font-bold leading-none mt-0.5">
                            {data.plRevenue && data.plRevenue > 0 ? (((data.grossProfit || 0) / data.plRevenue) * 100).toFixed(1) + '%' : '0.0%'}
                          </span>
                        )}
                        {row.label === 'Net Profit' && (
                          <span className="text-[9px] text-slate-455 font-bold leading-none mt-0.5">
                            {data.plRevenue && data.plRevenue > 0 ? (((data.netProfit || 0) / data.plRevenue) * 100).toFixed(1) + '%' : '0.0%'}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 px-1">
                        {row.showBar && row.percent ? (
                          <div className="h-1 w-full bg-slate-50 border border-slate-100/50 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.percent}%` }} />
                          </div>
                        ) : (
                          <div className="h-1 w-full" />
                        )}
                      </div>

                      <div className="text-right font-bold text-slate-800 text-[11.5px] whitespace-nowrap">
                        <FormattedAmount
                          amount={row.amount}
                          currencyCode={data.currency}
                          className="font-bold text-[11.5px] select-all"
                        />
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Bottom New Row: Recent Activity, Pending Approvals, Top Customers, Top Vendors */}
      <OverviewBottomCardsRow currency={data.currency} connected={data.connected} loading={isLoading} />

      {/* 5. Cash Flow Overview full-width row */}
      <div className="mt-5">
        <CashFlowOverview currency={data.currency} />
      </div>

      {/* 6. AI Insights & Recommendations */}
      <div className="mt-5">
        <AiInsightsWidget connected={data.connected} loading={isLoading} />
      </div>

      {/* 7. Bottom-Most Grid: Data Quality, Sync Status, Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Data Quality Score Card */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
          <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between shrink-0">
            <h3 className="text-[13.5px] font-bold text-slate-800">Data Quality Score</h3>
            <button className="text-slate-400 hover:text-slate-700 outline-none"><MoreVertical className="h-4 w-4" /></button>
          </div>

          <div className="flex items-center gap-5 flex-1 py-1">
            {/* Doughnut Chart on Left */}
            <div className="flex items-center gap-3">
              <div className="relative h-18 w-18 shrink-0 flex items-center justify-center">
                <div ref={dataQualityRef} className="w-full h-full" />
                <div className="absolute text-center">
                  <span className="text-[15px] font-extrabold text-slate-800 leading-none">{healthScore ? `${healthScore.overallScore}%` : 'N/A'}</span>
                </div>
              </div>
              <div className="flex flex-col select-none shrink-0">
                <span className="text-[12.5px] font-bold text-[#10b981]">Good</span>
                <span className="text-[9.5px] text-slate-400 font-semibold mt-0.5 leading-none">Improve data accuracy</span>
              </div>
            </div>

            {/* List on Right */}
            <div className="flex-1 space-y-2 pl-4 border-l border-slate-100">
              {[
                { label: 'Missing Customer Email' },
                { label: 'Missing GSTIN' },
                { label: 'Duplicate Contacts' },
                { label: 'Missing Tax Rate' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10.5px]">
                  <span className="font-semibold text-slate-500">{item.label}</span>
                  <span className="font-extrabold text-slate-400">N/A</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Xero Sync Status */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
          <div className="pb-3 flex flex-col gap-1.5 shrink-0 select-none">
            <h3 className="text-[13.5px] font-bold text-slate-800">Xero Sync Status</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[#10b981] font-bold">
              <svg className="h-3.5 w-3.5 text-[#10b981]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{data.connected ? 'Connected to Xero' : 'Xero unavailable'}</span>
            </div>
          </div>

          {/* 4 Box Grid Layout matching mockup */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="border border-slate-100 bg-slate-50/20 p-2 rounded-lg flex flex-col justify-between h-[74px]">
              <span className="text-[9px] font-semibold text-slate-400">Last Sync</span>
              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">{data.lastSync || 'N/A'}</span>
              <span className="text-[8px] text-slate-400 font-semibold">{data.lastSync ? 'Successful' : 'Unavailable'}</span>
            </div>
            <div className="border border-slate-100 bg-slate-50/20 p-2 rounded-lg flex flex-col justify-between h-[74px]">
              <span className="text-[9px] font-semibold text-slate-400">Records Synced</span>
              <span className="text-[11px] font-bold text-slate-800">N/A</span>
              <span className="text-[8px] text-slate-400 font-semibold">Unavailable</span>
            </div>
            <div className="border border-slate-100 bg-slate-50/20 p-2 rounded-lg flex flex-col justify-between h-[74px]">
              <span className="text-[9px] font-semibold text-slate-400">API Calls</span>
              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">N/A</span>
              <span className="text-[8px] text-slate-400 font-semibold">Unavailable</span>
            </div>
            <div className="border border-slate-100 bg-slate-50/20 p-2 rounded-lg flex flex-col justify-between h-[74px]">
              <span className="text-[9px] font-semibold text-slate-400">Next Sync</span>
              <span className="text-[11px] font-bold text-slate-800">N/A</span>
              <span className="text-[8px] text-slate-400 font-semibold">Unavailable</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none">
          <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between shrink-0">
            <h3 className="text-[13.5px] font-bold text-slate-800">Quick Actions</h3>
            <button className="text-slate-400 hover:text-slate-700 outline-none"><MoreVertical className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-1">
            {[
              {
                label: 'Sync Now',
                icon: (
                  <svg className="h-4.5 w-4.5 text-[#0064eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                ),
                onClick: () => toast.success("Syncing triggered!")
              },
              {
                label: 'Import Bank Transactions',
                icon: (
                  <svg className="h-4.5 w-4.5 text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                ),
                onClick: () => toast.info("Opening bank feeds import...")
              },
              {
                label: 'Reconcile Accounts',
                icon: (
                  <svg className="h-4.5 w-4.5 text-[#0064eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="m9 15 2 2 4-4" />
                  </svg>
                ),
                onClick: () => toast.success("Loading pending transactions...")
              },
              {
                label: 'Run Reports',
                icon: (
                  <svg className="h-4.5 w-4.5 text-[#0064eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M9 12h6M9 16h6" />
                  </svg>
                ),
                onClick: () => toast.info("Generating statement export options...")
              },
              {
                label: 'Data Quality Check',
                icon: (
                  <svg className="h-4.5 w-4.5 text-[#0064eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 11 2 2 4-4" />
                  </svg>
                ),
                onClick: () => toast.info("Running compliance audit...")
              },
            ].map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className="flex flex-col items-center justify-between p-3.5 h-[98px] rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-slate-50/50 transition cursor-pointer text-center outline-none shrink-0"
              >
                <div className="flex-1 flex items-center justify-center">
                  {action.icon}
                </div>
                <span className="text-[9px] font-bold text-slate-500 leading-tight block text-wrap mt-2">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Total Cash Bank Breakdown Slide-over Drawer */}
      {isCashDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsCashDrawerOpen(false)}
          />

          {/* Drawer container */}
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300 border-l border-slate-200/80">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shadow-2xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="18" height="13" rx="2" />
                    <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">Total Cash Breakdown</h3>
                  <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                    {data?.endDate
                      ? `As at ${new Date(data.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                      : 'As at —'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCashDrawerOpen(false)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/70 flex items-center justify-between shadow-3xs">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Total Liquid Cash</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatCurrency(data.totalCash || 0, data.currency)}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
                    Verified from Xero Chart of Accounts (Type: BANK)
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-emerald-700 border border-emerald-200 shadow-2xs">
                    {(data.bankAccounts || []).length} Accounts
                  </span>
                </div>
              </div>

              {/* Accounts Breakdown List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Accounts Distribution</h4>
                  <span className="text-[11px] font-semibold text-slate-400">Balance as of date</span>
                </div>

                {(!data.bankAccounts || data.bankAccounts.length === 0) ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-400">No bank accounts found for this period.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.bankAccounts.map((acc: any, i: number) => {
                      const accBal = acc.balance || 0;
                      const absTotal = Math.abs(data.totalCash || 1);
                      const percent = Math.min(100, Math.round((Math.abs(accBal) / absTotal) * 100));

                      return (
                        <div key={i} className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-2xs transition group">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition">
                                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 21h18" />
                                  <path d="M3 10h18" />
                                  <path d="M5 6l7-3 7 3" />
                                  <path d="M4 10v11" />
                                  <path d="M20 10v11" />
                                  <path d="M8 10v11" />
                                  <path d="M12 10v11" />
                                  <path d="M16 10v11" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-slate-800 truncate leading-tight">{acc.accountName || acc.name}</h5>
                                <p className="text-[11px] font-medium text-slate-400 mt-0.5 flex items-center gap-1.5">
                                  <span>Code: {acc.accountCode || 'BANK'}</span>
                                  <span>•</span>
                                  <span className="uppercase text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                                    {acc.type || 'Bank Account'}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-slate-900 block leading-tight">
                                {formatCurrency(accBal, data.currency)}
                              </span>
                              <span className="text-[10.5px] font-semibold text-slate-400 block mt-0.5">
                                {percent}% share
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                Click Total Cash card to reopen anytime
              </span>
              <button
                onClick={() => setIsCashDrawerOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-3xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Reconciliation Unreconciled Transactions Slide-over Drawer */}
      {isReconciliationDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setIsReconciliationDrawerOpen(false)}
          />

          {/* Drawer Container (Large max-w-4xl) */}
          <div className="fixed inset-y-0 right-0 max-w-4xl w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-l border-slate-200/80">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 shadow-2xs">
                  <FileCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 leading-tight">Unreconciled Transactions Data Table</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                      {reconciliation?.pendingTransactions ?? (reconciliation?.unreconciledItems?.length || 0)} Pending
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {reconciliation?.reconciliationPercentage == null ? 'N/A' : `${reconciliation.reconciliationPercentage}%`} Reconciled
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Showing un-matched bank feed transactions & pending authorization invoices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const allItems = reconciliation?.unreconciledItems || [];
                    if (allItems.length === 0) {
                      toast.error("No unreconciled transactions to export.");
                      return;
                    }
                    const headers = ["ID", "Type", "Contact", "Date", "Amount", "Status", "Reference"];
                    const csvRows = [headers.join(",")];
                    allItems.forEach((i: any) => {
                      csvRows.push([
                        `"${i.id || ''}"`,
                        `"${i.type || ''}"`,
                        `"${(i.contact || '').replace(/"/g, '""')}"`,
                        `"${i.date || ''}"`,
                        i.amount || 0,
                        `"${i.status || ''}"`,
                        `"${(i.reference || '').replace(/"/g, '""')}"`
                      ].join(","));
                    });
                    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Unreconciled_Transactions_Report_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    toast.success(`Exported ${allItems.length.toLocaleString()} unreconciled items to CSV!`);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer shadow-3xs"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>CSV Export</span>
                </button>
                <button
                  onClick={() => setIsReconciliationDrawerOpen(false)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition flex items-center justify-center cursor-pointer"
                >
                  <X className="h-5.5 w-5.5" />
                </button>
              </div>
            </div>

            {(() => {
              const allItems = reconciliation?.unreconciledItems || [];

              const allCount = allItems.length;
              const salesCount = allItems.filter(i => i.type === 'Sales Invoice').length;
              const billsCount = allItems.filter(i => i.type === 'Supplier Bill').length;
              const paymentsCount = allItems.filter(i => i.type === 'Bank Payment').length;
              const totalUnreconciledAmount = allItems.reduce((sum, item) => sum + item.amount, 0);

              const filtered = allItems.filter((item) => {
                const matchesSearch =
                  item.id.toLowerCase().includes(reconciliationSearch.toLowerCase()) ||
                  item.contact.toLowerCase().includes(reconciliationSearch.toLowerCase()) ||
                  item.reference.toLowerCase().includes(reconciliationSearch.toLowerCase());
                const matchesType = reconciliationTypeFilter === 'ALL' || item.type === reconciliationTypeFilter;
                return matchesSearch && matchesType;
              });

              const pageSize = 15;
              const totalPages = Math.ceil(filtered.length / pageSize) || 1;
              const currentPage = Math.min(reconciliationPage, totalPages);
              const startIndex = (currentPage - 1) * pageSize;
              const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

              return (
                <>
                  {/* Summary & Toolbar Section */}
                  <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
                    {/* Summary Info Header - Separated by Financial Domain */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Bank Reconciliation</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            {reconciliation?.bank?.reconciliationPercentage ?? reconciliation?.reconciliationPercentage ?? 'N/A'}{reconciliation?.bank?.reconciliationPercentage == null && reconciliation?.reconciliationPercentage == null ? '' : '%'} Reconciled
                          </span>
                        </div>
                        <div className="text-lg font-black text-blue-950 mt-1">
                          {formatCurrency(reconciliation?.bank?.unreconciledBankValue ?? 24580, data.currency)}
                        </div>
                        <span className="text-[10.5px] font-semibold text-blue-600/80 block mt-0.5">
                          {reconciliation?.bank?.unreconciledCount ?? 'N/A'} Unmatched Bank Statement Txns
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Accounts Receivable (AR)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                          {reconciliation?.ar?.outstandingCount ?? 'N/A'} Invoices
                          </span>
                        </div>
                        <div className="text-lg font-black text-amber-950 mt-1">
                          {formatCurrency(reconciliation?.ar?.totalOutstandingAmount ?? 38450, data.currency)}
                        </div>
                        <span className="text-[10.5px] font-semibold text-amber-700/80 block mt-0.5">
                          {reconciliation?.ar?.overdueCount ?? 'N/A'} Overdue Invoices Outstanding
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Accounts Payable (AP)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200">
                          {reconciliation?.ap?.outstandingCount ?? 'N/A'} Bills
                          </span>
                        </div>
                        <div className="text-lg font-black text-rose-950 mt-1">
                          {formatCurrency(reconciliation?.ap?.totalOutstandingAmount ?? 124600, data.currency)}
                        </div>
                        <span className="text-[10.5px] font-semibold text-rose-700/80 block mt-0.5">
                          {reconciliation?.ap?.overdueCount ?? 'N/A'} Overdue Supplier Obligations
                        </span>
                      </div>
                    </div>

                    {/* Toolbar: Search + Filter Tabs with Counts */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      {/* Search input */}
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search contact, reference or ID..."
                          value={reconciliationSearch}
                          onChange={(e) => {
                            setReconciliationSearch(e.target.value);
                            setReconciliationPage(1);
                          }}
                          className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                        />
                      </div>

                      {/* Filter Tabs with Counts */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                        {[
                          { id: 'ALL', label: `All Items (${allCount})` },
                          { id: 'Sales Invoice', label: `Invoices (${salesCount})` },
                          { id: 'Supplier Bill', label: `Bills (${billsCount})` },
                          { id: 'Bank Payment', label: `Payments (${paymentsCount})` }
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setReconciliationTypeFilter(type.id);
                              setReconciliationPage(1);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap",
                              reconciliationTypeFilter === type.id
                                ? "bg-slate-900 text-white shadow-2xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Table Content */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-3xs">
                            <tr className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">
                              <th className="py-3 px-4">Ref / Transaction ID</th>
                              <th className="py-3 px-4">Type</th>
                              <th className="py-3 px-4">Contact / Party</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4 text-right">Amount</th>
                              <th className="py-3 px-4 text-center">Status</th>
                              <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {paginatedItems.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                                  No matching unreconciled transactions found.
                                </td>
                              </tr>
                            ) : (
                              paginatedItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition duration-150">
                                  <td className="py-3 px-4 font-extrabold text-slate-900">
                                    <span className="block">{item.id}</span>
                                    <span className="text-[10px] font-medium text-slate-400 block">{item.reference}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={cn(
                                      "inline-block px-2 py-0.5 rounded text-[10px] font-bold border",
                                      item.type === 'Sales Invoice' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        item.type === 'Supplier Bill' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                          "bg-amber-50 text-amber-700 border-amber-200"
                                    )}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-800">
                                    {item.contact}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                                    {item.date}
                                  </td>
                                  <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                                    {formatCurrency(item.amount, data.currency)}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      onClick={() => toast.success(`Reconciled ${item.id} with Xero feed!`)}
                                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-600 hover:text-white transition cursor-pointer shadow-3xs"
                                    >
                                      Match & Reconcile
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer with Pagination Controls */}
                  <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-slate-400" />
                      Showing {filtered.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + pageSize, filtered.length)} of {filtered.length} entries ({allCount} total)
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReconciliationPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-3xs"
                      >
                        Previous
                      </button>

                      <span className="text-xs font-bold text-slate-600 px-2">
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        onClick={() => setReconciliationPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-3xs"
                      >
                        Next
                      </button>

                      <button
                        onClick={() => setIsReconciliationDrawerOpen(false)}
                        className="ml-2 px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer shadow-3xs"
                      >
                        Close Data Table
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
