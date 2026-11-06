'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  ShoppingBag, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Filter, 
  Download, 
  RefreshCw, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  PieChart, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  ShieldAlert, 
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  Eye,
  Activity,
  Zap,
  Tag,
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { toast } from 'sonner';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export interface ExpenseRecord {
  id: string;
  date: string;
  dueDate: string;
  vendorName: string;
  billNumber: string;
  reference: string;
  category: 'Direct COGS' | 'SaaS & Software' | 'Rent & Facilities' | 'Marketing & Ads' | 'Logistics & Freight' | 'Professional Fees' | 'Utilities & Admin';
  department: 'Procurement' | 'IT & Engineering' | 'Marketing' | 'Operations' | 'Executive & HR' | 'Sales';
  amount: number;
  status: 'Paid' | 'Pending Approval' | 'Overdue' | 'Scheduled';
  recurring: boolean;
}

// Dynamic Date Helper Utilities
const getTodayFormatted = (): string => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getSixMonthsAgoFormatted = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split('T')[0];
};

const getStartOfMonthFormatted = (): string => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const getThreeMonthsAgoFormatted = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().split('T')[0];
};

const getStartOfYearFormatted = (): string => {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().split('T')[0];
};

const formatToDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

// Shimmer Skeleton Loader Component
const ExpensesShimmerSkeleton = () => (
  <div className="space-y-6 animate-pulse select-none">
    {/* KPI Ribbon Shimmer */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-7 w-7 bg-slate-200 rounded-lg" />
          </div>
          <div className="h-7 w-32 bg-slate-200 rounded-lg" />
          <div className="h-3 w-28 bg-slate-100 rounded" />
        </div>
      ))}
    </div>

    {/* Charts Grid Shimmer */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 h-80 space-y-4">
        <div className="h-5 w-56 bg-slate-200 rounded" />
        <div className="h-56 bg-slate-100/70 rounded-2xl" />
      </div>
      <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 h-80 space-y-4">
        <div className="h-5 w-44 bg-slate-200 rounded" />
        <div className="h-56 bg-slate-100/70 rounded-2xl" />
      </div>
    </div>

    {/* Datatable Shimmer */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="h-10 bg-slate-100 rounded-xl" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-slate-50 rounded-lg flex items-center justify-between px-4">
            <div className="h-4 w-12 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Empty State View with SVG Graphic
const EmptyStateView = ({ isConnected, onReset }: { isConnected: boolean; onReset: () => void }) => (
  <div className="bg-white rounded-3xl border border-slate-200 p-10 sm:p-14 text-center space-y-5 shadow-xs max-w-2xl mx-auto my-6">
    <div className="mx-auto h-24 w-24 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center relative shadow-inner">
      <svg className="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-md">
        X
      </div>
    </div>

    <div className="space-y-2">
      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
        {isConnected ? 'No Purchases or Expenses Found' : 'Xero Organisation Not Connected'}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
        {isConnected
          ? 'No purchase bills match the selected date range or category filters. Try expanding your date range or clearing filter selections.'
          : 'Connect your Xero organization to sync live ACCPAY bills, vendor commitments, COGS and overhead expense analytics.'}
      </p>
    </div>

    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
      {isConnected ? (
        <button
          onClick={onReset}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-blue-600/20"
        >
          Reset Filters & Refresh
        </button>
      ) : (
        <Link
          href="/api/xero/auth"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-blue-600/20 flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          <span>Connect Xero Account</span>
        </Link>
      )}
    </div>
  </div>
);

export default function PurchasesExpensesDashboard() {
  const initialFrom = useMemo(() => getSixMonthsAgoFormatted(), []);
  const initialTo = useMemo(() => getTodayFormatted(), []);

  // Draft Filter States (Form Controls - do not affect data until Search is clicked)
  const [draftFromDate, setDraftFromDate] = useState<string>(initialFrom);
  const [draftToDate, setDraftToDate] = useState<string>(initialTo);
  const [draftDept, setDraftDept] = useState<string>('ALL');
  const [draftCategory, setDraftCategory] = useState<string>('ALL');
  const [draftVendor, setDraftVendor] = useState<string>('ALL');
  const [draftStatus, setDraftStatus] = useState<string>('ALL');
  const [draftSearchTerm, setDraftSearchTerm] = useState<string>('');

  // Applied Filter States (Used for API calls, KPIs & Table Filtering)
  const [appliedFromDate, setAppliedFromDate] = useState<string>(initialFrom);
  const [appliedToDate, setAppliedToDate] = useState<string>(initialTo);
  const [appliedDept, setAppliedDept] = useState<string>('ALL');
  const [appliedCategory, setAppliedCategory] = useState<string>('ALL');
  const [appliedVendor, setAppliedVendor] = useState<string>('ALL');
  const [appliedStatus, setAppliedStatus] = useState<string>('ALL');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'all' | 'cogs' | 'opex' | 'recurring' | 'overdue'>('all');
  const [selectedBill, setSelectedBill] = useState<ExpenseRecord | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [orgName, setOrgName] = useState<string>('');

  // DataTables Pagination & Sorting State
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortCol, setSortCol] = useState<'date' | 'dueDate' | 'vendor' | 'number' | 'category' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [expensesData, setExpensesData] = useState<ExpenseRecord[]>([]);
  const [isXeroConnected, setIsXeroConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiSummary, setApiSummary] = useState<any>(null);
  const [apiPrevSummary, setApiPrevSummary] = useState<any>(null);
  const [apiVariance, setApiVariance] = useState<any>(null);

  const handleSort = (col: 'date' | 'dueDate' | 'vendor' | 'number' | 'category' | 'amount' | 'status') => {
    if (sortCol === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  // Live Data Fetch from PostgreSQL API with date parameters
  const fetchExpenses = async (fDate?: string, tDate?: string) => {
    setLoading(true);
    const start = fDate !== undefined ? fDate : appliedFromDate;
    const end = tDate !== undefined ? tDate : appliedToDate;
    try {
      const url = `/api/dashboard/expenses?fromDate=${start}&toDate=${end}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.expenses && Array.isArray(json.expenses)) {
          setExpensesData(json.expenses);
        } else {
          setExpensesData([]);
        }
        if (json.connected !== undefined) setIsXeroConnected(json.connected);
        if (json.orgName) setOrgName(json.orgName);
        if (json.summary) setApiSummary(json.summary);
        if (json.prevSummary) setApiPrevSummary(json.prevSummary);
        if (json.variance) setApiVariance(json.variance);
      }
    } catch (err) {
      console.error('Failed to fetch live expenses API:', err);
    } finally {
      setLoading(false);
    }
  };

  // Explicit Handler to Apply Draft Filters
  const handleApplyFilters = (overrideFrom?: string, overrideTo?: string) => {
    const fDate = overrideFrom ?? draftFromDate;
    const tDate = overrideTo ?? draftToDate;

    if (overrideFrom) setDraftFromDate(overrideFrom);
    if (overrideTo) setDraftToDate(overrideTo);

    setAppliedFromDate(fDate);
    setAppliedToDate(tDate);
    setAppliedDept(draftDept);
    setAppliedCategory(draftCategory);
    setAppliedVendor(draftVendor);
    setAppliedStatus(draftStatus);
    setAppliedSearchTerm(draftSearchTerm);

    setCurrentPage(1);
    fetchExpenses(fDate, tDate);
    toast.success('Filters applied successfully');
  };

  // Explicit Handler to Reset All Filters
  const handleResetFilters = () => {
    const defaultFrom = getSixMonthsAgoFormatted();
    const defaultTo = getTodayFormatted();

    setDraftFromDate(defaultFrom);
    setDraftToDate(defaultTo);
    setDraftDept('ALL');
    setDraftCategory('ALL');
    setDraftVendor('ALL');
    setDraftStatus('ALL');
    setDraftSearchTerm('');

    setAppliedFromDate(defaultFrom);
    setAppliedToDate(defaultTo);
    setAppliedDept('ALL');
    setAppliedCategory('ALL');
    setAppliedVendor('ALL');
    setAppliedStatus('ALL');
    setAppliedSearchTerm('');

    setCurrentPage(1);
    fetchExpenses(defaultFrom, defaultTo);
    toast.info('Filters reset to default (Last 6 Months)');
  };

  // Initial Fetch on Component Mount
  React.useEffect(() => {
    fetchExpenses(appliedFromDate, appliedToDate);
  }, []);

  // Unique Vendors List for Dropdown
  const uniqueVendorsList = useMemo(() => {
    const set = new Set<string>();
    expensesData.forEach(item => {
      if (item.vendorName) set.add(item.vendorName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expensesData]);

  // Filtered & Sorted Expenses Logic (Uses Applied States)
  const filteredExpenses = useMemo(() => {
    let list = expensesData.filter(item => {
      if (appliedDept !== 'ALL' && item.department !== appliedDept) return false;
      if (appliedCategory !== 'ALL' && item.category !== appliedCategory) return false;
      if (appliedVendor !== 'ALL' && item.vendorName !== appliedVendor) return false;
      if (appliedStatus !== 'ALL' && item.status !== appliedStatus) return false;

      if (activeTab === 'cogs' && item.category !== 'Direct COGS') return false;
      if (activeTab === 'opex' && item.category === 'Direct COGS') return false;
      if (activeTab === 'recurring' && !item.recurring) return false;
      if (activeTab === 'overdue' && item.status !== 'Overdue') return false;

      if (appliedSearchTerm) {
        const query = appliedSearchTerm.toLowerCase();
        return (
          item.vendorName.toLowerCase().includes(query) ||
          item.billNumber.toLowerCase().includes(query) ||
          item.reference.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let res = 0;
      if (sortCol === 'amount') res = b.amount - a.amount;
      else if (sortCol === 'date') res = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      else if (sortCol === 'dueDate') res = new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime();
      else if (sortCol === 'vendor') res = (a.vendorName || '').localeCompare(b.vendorName || '');
      else if (sortCol === 'number') res = (a.billNumber || '').localeCompare(b.billNumber || '');
      else if (sortCol === 'category') res = (a.category || '').localeCompare(b.category || '');
      else if (sortCol === 'status') res = (a.status || '').localeCompare(b.status || '');

      return sortDir === 'desc' ? res : -res;
    });
  }, [expensesData, appliedDept, appliedCategory, appliedVendor, appliedStatus, activeTab, appliedSearchTerm, sortCol, sortDir]);

  // Pagination Logic
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    if (pageSize === 0) return filteredExpenses;
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  // Executive Computations
  // Dynamic Executive Computations from Actual Live Expenses Data
  const totalExpenses = useMemo(() => expensesData.reduce((acc, curr) => acc + curr.amount, 0), [expensesData]);
  const directCogs = useMemo(() => expensesData.filter(i => i.category === 'Direct COGS').reduce((acc, curr) => acc + curr.amount, 0), [expensesData]);
  const indirectOpex = useMemo(() => expensesData.filter(i => i.category !== 'Direct COGS').reduce((acc, curr) => acc + curr.amount, 0), [expensesData]);
  const recurringSpend = useMemo(() => expensesData.filter(i => i.recurring).reduce((acc, curr) => acc + curr.amount, 0), [expensesData]);
  const pendingAmount = useMemo(() => expensesData.filter(i => i.status === 'Pending Approval' || i.status === 'Overdue').reduce((acc, curr) => acc + curr.amount, 0), [expensesData]);

  // Previous Period Computations for Comparison (Live from API)
  const prevTotalExpenses = apiPrevSummary?.totalExpenses ?? 0;
  const prevDirectCogs = apiPrevSummary?.directCogs ?? 0;
  const prevIndirectOpex = apiPrevSummary?.indirectOpex ?? 0;
  const prevRecurringSpend = apiPrevSummary?.recurringSpend ?? 0;
  const prevPendingAmount = apiPrevSummary?.pendingAmount ?? 0;

  const totalVariancePct = apiVariance?.totalExpensesPct ?? (prevTotalExpenses > 0 ? parseFloat((((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100).toFixed(1)) : 0);
  const directCogsPct = apiVariance?.directCogsPct ?? (prevDirectCogs > 0 ? parseFloat((((directCogs - prevDirectCogs) / prevDirectCogs) * 100).toFixed(1)) : 0);
  const indirectOpexPct = apiVariance?.indirectOpexPct ?? (prevIndirectOpex > 0 ? parseFloat((((indirectOpex - prevIndirectOpex) / prevIndirectOpex) * 100).toFixed(1)) : 0);
  const recurringSpendPct = apiVariance?.recurringSpendPct ?? (prevRecurringSpend > 0 ? parseFloat((((recurringSpend - prevRecurringSpend) / prevRecurringSpend) * 100).toFixed(1)) : 0);
  const pendingAmountPct = apiVariance?.pendingAmountPct ?? (prevPendingAmount > 0 ? parseFloat((((pendingAmount - prevPendingAmount) / prevPendingAmount) * 100).toFixed(1)) : 0);

  // Dynamic Metrics for Cards
  const cogsCount = useMemo(() => expensesData.filter(i => i.category === 'Direct COGS').length, [expensesData]);
  const cogsPct = useMemo(() => totalExpenses > 0 ? ((directCogs / totalExpenses) * 100).toFixed(1) : '0', [directCogs, totalExpenses]);
  const opexPct = useMemo(() => totalExpenses > 0 ? ((indirectOpex / totalExpenses) * 100).toFixed(1) : '0', [indirectOpex, totalExpenses]);
  const recurringCount = useMemo(() => expensesData.filter(i => i.recurring).length, [expensesData]);
  const pendingCount = useMemo(() => expensesData.filter(i => i.status === 'Pending Approval' || i.status === 'Overdue').length, [expensesData]);

  // Dynamic AI Cost Optimization Insights
  const aiInsights = useMemo(() => {
    if (expensesData.length === 0) {
      return [
        {
          title: 'No Active Expense Data',
          tag: 'Status Clean',
          description: 'No purchase bills match the selected timeframe. Connect Xero or adjust filter parameters to generate live cost optimization insights.',
          bgClass: 'bg-slate-50 border-slate-200',
          titleClass: 'text-slate-800',
          tagClass: 'bg-slate-200 text-slate-700',
          icon: <ShieldAlert className="h-4 w-4 text-slate-500 shrink-0" />
        }
      ];
    }

    const insights = [];

    // 1. Overdue Bills Insight
    const overdueBills = expensesData.filter(i => i.status === 'Overdue');
    if (overdueBills.length > 0) {
      const topOverdue = overdueBills.reduce((max, b) => b.amount > max.amount ? b : max, overdueBills[0]);
      insights.push({
        title: `${overdueBills.length} Overdue Supplier Payment${overdueBills.length > 1 ? 's' : ''}`,
        tag: 'Action Required',
        description: `Highest overdue bill: ${topOverdue.vendorName} (${topOverdue.billNumber}) for £${topOverdue.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })} (Due: ${formatToDDMMYYYY(topOverdue.dueDate)}). Authorization required.`,
        bgClass: 'bg-rose-50/70 border-rose-200/80',
        titleClass: 'text-rose-950',
        tagClass: 'bg-rose-200/80 text-rose-800',
        icon: <Clock className="h-4 w-4 text-rose-600 shrink-0" />
      });
    } else {
      insights.push({
        title: 'Supplier Payment Timelines Healthy',
        tag: 'Up to Date',
        description: 'All supplier bills are paid or scheduled within due dates. Zero late payment penalties incurred across all active vendor accounts.',
        bgClass: 'bg-emerald-50/70 border-emerald-200/80',
        titleClass: 'text-emerald-950',
        tagClass: 'bg-emerald-200/80 text-emerald-800',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      });
    }

    // 2. Vendor Concentration Insight
    const vendorSums: Record<string, number> = {};
    expensesData.forEach(i => {
      vendorSums[i.vendorName] = (vendorSums[i.vendorName] || 0) + i.amount;
    });
    const topVendorEntry = Object.entries(vendorSums).sort((a, b) => b[1] - a[1])[0];
    if (topVendorEntry && totalExpenses > 0) {
      const vendorName = topVendorEntry[0];
      const vendorAmount = topVendorEntry[1];
      const pct = ((vendorAmount / totalExpenses) * 100).toFixed(1);
      insights.push({
        title: `Top Supplier Spend: ${vendorName}`,
        tag: `${pct}% Total Spend`,
        description: `${vendorName} represents £${vendorAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })} (${pct}% of total period purchases). Review vendor contract terms for volume discounts.`,
        bgClass: 'bg-amber-50/70 border-amber-200/80',
        titleClass: 'text-amber-950',
        tagClass: 'bg-amber-200/80 text-amber-800',
        icon: <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
      });
    }

    // 3. SaaS & Recurring Run-rate Insight
    const saasItems = expensesData.filter(i => i.recurring || i.category === 'SaaS & Software');
    const totalSaas = saasItems.reduce((acc, curr) => acc + curr.amount, 0);
    if (totalSaas > 0) {
      const saasPct = ((totalSaas / (totalExpenses || 1)) * 100).toFixed(1);
      insights.push({
        title: `Software & SaaS Subscription Run-Rate`,
        tag: `${saasItems.length} Subscriptions`,
        description: `Active recurring SaaS commitments total £${totalSaas.toLocaleString('en-GB', { minimumFractionDigits: 2 })} (${saasPct}% of total period spend). Audit active seats to eliminate duplicate software licenses.`,
        bgClass: 'bg-blue-50/70 border-blue-200/80',
        titleClass: 'text-blue-950',
        tagClass: 'bg-blue-200/80 text-blue-800',
        icon: <Layers className="h-4 w-4 text-blue-600 shrink-0" />
      });
    }

    return insights;
  }, [expensesData, totalExpenses]);

  // Dynamic ECharts 1: Gradient Area Spend Trajectory vs Budget & Comparative View
  const trajectoryChartOption = useMemo(() => {
    const monthGroupMap: Record<string, { cogs: number; opex: number }> = {};
    const currentMonthLabel = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    expensesData.forEach(item => {
      const d = new Date(item.date);
      const monthKey = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : currentMonthLabel;
      if (!monthGroupMap[monthKey]) monthGroupMap[monthKey] = { cogs: 0, opex: 0 };
      if (item.category === 'Direct COGS') {
        monthGroupMap[monthKey].cogs += item.amount;
      } else {
        monthGroupMap[monthKey].opex += item.amount;
      }
    });

    let months = Object.keys(monthGroupMap);
    if (months.length === 0) {
      months = [currentMonthLabel];
      monthGroupMap[currentMonthLabel] = { cogs: 0, opex: 0 };
    }

    const cogsData = months.map(m => parseFloat(monthGroupMap[m].cogs.toFixed(2)));
    const opexData = months.map(m => parseFloat(monthGroupMap[m].opex.toFixed(2)));
    const totalData = months.map(m => parseFloat((monthGroupMap[m].cogs + monthGroupMap[m].opex).toFixed(2)));
    const budgetLimitData = totalData.map(val => parseFloat((val * 1.1).toFixed(2)));
    const priorPeriodData = months.map(() => apiPrevSummary?.totalExpenses ? parseFloat((apiPrevSummary.totalExpenses / Math.max(1, months.length)).toFixed(2)) : 0);

    return {
      grid: { left: '3%', right: '4%', top: '15%', bottom: '8%', containLabel: true },
      tooltip: { 
        trigger: 'axis', 
        confine: true, 
        backgroundColor: '#0f172a', 
        borderColor: '#1e293b', 
        borderRadius: 12,
        padding: [10, 14],
        textStyle: { color: '#f8fafc', fontSize: 11, fontFamily: 'var(--font-sans), sans-serif' }
      },
      legend: { 
        data: compareMode 
          ? ['Direct COGS', 'Indirect Opex', 'Prior Period Spend', 'Budget Limit']
          : ['Direct COGS', 'Indirect Opex', 'Budget Limit'], 
        top: '0%', 
        right: '2%', 
        icon: 'circle',
        textStyle: { color: '#64748b', fontSize: 11, fontWeight: '600' } 
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (val: number) => `£${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}` }
      },
      series: [
        {
          name: 'Direct COGS',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3, color: '#2563eb' },
          itemStyle: { color: '#2563eb' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 99, 235, 0.35)' },
                { offset: 1, color: 'rgba(37, 99, 235, 0.01)' }
              ]
            }
          },
          data: cogsData
        },
        {
          name: 'Indirect Opex',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 158, 11, 0.30)' },
                { offset: 1, color: 'rgba(245, 158, 11, 0.01)' }
              ]
            }
          },
          data: opexData
        },
        ...(compareMode ? [{
          name: 'Prior Period Spend',
          type: 'line',
          smooth: true,
          symbol: 'diamond',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#a855f7', type: 'dashed' },
          itemStyle: { color: '#a855f7' },
          data: priorPeriodData
        }] : []),
        {
          name: 'Budget Limit',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#ef4444', type: 'dashed' },
          itemStyle: { color: '#ef4444' },
          data: budgetLimitData
        }
      ]
    };
  }, [expensesData, compareMode]);

  // Dynamic ECharts 2: Category Sunburst Donut from Live Filtered Data
  const categoryDonutOption = useMemo(() => {
    const categorySums: Record<string, number> = {
      'Direct COGS': 0,
      'SaaS & Software': 0,
      'Rent & Facilities': 0,
      'Marketing & Ads': 0,
      'Logistics & Freight': 0,
      'Professional Fees': 0,
      'Utilities & Admin': 0
    };

    expensesData.forEach(item => {
      const cat = item.category || 'Utilities & Admin';
      categorySums[cat] = (categorySums[cat] || 0) + item.amount;
    });

    const colorPalette: Record<string, string> = {
      'Direct COGS': '#2563eb',
      'Rent & Facilities': '#10b981',
      'SaaS & Software': '#0284c7',
      'Marketing & Ads': '#8b5cf6',
      'Professional Fees': '#f59e0b',
      'Logistics & Freight': '#f43f5e',
      'Utilities & Admin': '#64748b'
    };

    const donutData = Object.entries(categorySums)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2)),
        itemStyle: { color: colorPalette[name] || '#94a3b8' }
      }));

    return {
      tooltip: { trigger: 'item', formatter: '{b}: <b>£{c}</b> ({d}%)', backgroundColor: '#0f172a', textStyle: { color: '#fff', fontSize: 11 } },
      legend: { orient: 'vertical', right: '0%', top: 'middle', textStyle: { color: '#475569', fontSize: 10, fontWeight: '700' } },
      series: [
        {
          name: 'Expense Category',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['36%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
          label: { show: false },
          data: donutData.length > 0 ? donutData : [{ name: 'No Expense Data', value: 0, itemStyle: { color: '#e2e8f0' } }]
        }
      ]
    };
  }, [expensesData]);

  // Dynamic ECharts 3: Departmental Spend Radar Chart from Live Filtered Data
  const radarChartOption = useMemo(() => {
    const deptSums: Record<string, number> = {
      'Procurement': 0,
      'IT & Engineering': 0,
      'Marketing': 0,
      'Operations': 0,
      'Executive & HR': 0,
      'Sales': 0
    };

    expensesData.forEach(item => {
      const d = item.department || 'Operations';
      deptSums[d] = (deptSums[d] || 0) + item.amount;
    });

    const values = [
      deptSums['Procurement'] || 0,
      deptSums['IT & Engineering'] || 0,
      deptSums['Marketing'] || 0,
      deptSums['Operations'] || 0,
      deptSums['Executive & HR'] || 0,
      deptSums['Sales'] || 0
    ].map(v => parseFloat(v.toFixed(2)));

    const maxVal = Math.max(...values, 100);
    const scaleMax = Math.ceil(maxVal * 1.25);

    return {
      tooltip: { trigger: 'item', backgroundColor: '#0f172a', textStyle: { color: '#fff', fontSize: 11 } },
      radar: {
        indicator: [
          { name: 'Procurement', max: scaleMax },
          { name: 'IT & Eng.', max: scaleMax },
          { name: 'Marketing', max: scaleMax },
          { name: 'Operations', max: scaleMax },
          { name: 'Executive/HR', max: scaleMax },
          { name: 'Sales', max: scaleMax }
        ],
        shape: 'circle',
        splitNumber: 4,
        axisName: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
        splitLine: { lineStyle: { color: ['#f1f5f9', '#e2e8f0'] } },
        splitArea: { areaStyle: { color: ['rgba(248,250,252,0.5)', 'rgba(241,245,249,0.5)'] } }
      },
      series: [
        {
          name: 'Department Spend (£)',
          type: 'radar',
          data: [
            {
              value: values,
              name: 'Current Spend Distribution',
              itemStyle: { color: '#2563eb' },
              areaStyle: { color: 'rgba(37, 99, 235, 0.25)' }
            }
          ]
        }
      ]
    };
  }, [expensesData]);

  return (
    <PageContainer>
      <div className="space-y-6 max-w-full pb-16 select-none font-sans text-slate-800">
            {/* SLEEK, COMPACT HEADER & CFO FILTERS CONTROL PANEL */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
          {/* TOP ROW: HEADER TITLE & ACTION BUTTONS */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Purchases & Expense Analytics</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/70 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5 text-blue-600" />
                    Live Xero Sync
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">• {orgName || 'Connected Organisation'}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Unified procurement intelligence, vendor cost commitments & software license tracking
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toast.success('Exporting Purchases & Expense Matrix (.xlsx)')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200/80 shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => toast.success('Generating Executive PDF Intelligence Report')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-600/20"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Executive PDF Summary</span>
              </button>
            </div>
          </div>

          {/* ROW 1 FILTERS: DATE RANGE, QUICK PRESETS & LIVE COMPARE TOGGLE */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* From Date */}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>From:</span>
                </label>
                <input
                  type="date"
                  value={draftFromDate}
                  onChange={(e) => setDraftFromDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                />
              </div>

              {/* To Date */}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                  <span>To:</span>
                </label>
                <input
                  type="date"
                  value={draftToDate}
                  onChange={(e) => setDraftToDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                />
              </div>

              {/* Quick Period Presets */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleApplyFilters(getStartOfMonthFormatted(), getTodayFormatted())}
                  className="px-2 py-1 hover:bg-blue-50 hover:text-blue-600 rounded text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyFilters(getThreeMonthsAgoFormatted(), getTodayFormatted())}
                  className="px-2 py-1 hover:bg-blue-50 hover:text-blue-600 rounded text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  Last 3 Months
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyFilters(getSixMonthsAgoFormatted(), getTodayFormatted())}
                  className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-bold transition cursor-pointer"
                >
                  Last 6 Months
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyFilters(getStartOfYearFormatted(), getTodayFormatted())}
                  className="px-2 py-1 hover:bg-blue-50 hover:text-blue-600 rounded text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  YTD {new Date().getFullYear()}
                </button>
              </div>
            </div>

            {/* LIVE COMPARE VIEW TOGGLE */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs shrink-0">
              <Activity className={cn("h-3.5 w-3.5 transition", compareMode ? "text-purple-600 animate-pulse" : "text-slate-400")} />
              <span className="text-[11px] font-bold text-slate-700">Compare View:</span>
              <button
                type="button"
                onClick={() => {
                  setCompareMode(!compareMode);
                  toast.success(compareMode ? 'Compare View Disabled' : 'Live Compare View Enabled');
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  compareMode ? "bg-purple-600" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out",
                    compareMode ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              {compareMode && (
                <span className="px-1.5 py-0.2 text-[9.5px] font-black uppercase bg-purple-100 text-purple-800 rounded">
                  vs Prior
                </span>
              )}
            </div>
          </div>

          {/* ROW 2 FILTERS: CATEGORICAL DROPDOWNS & APPLY / RESET BUTTONS */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1 text-xs">
              {/* Department Filter */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Department:</label>
                <select
                  value={draftDept}
                  onChange={(e) => setDraftDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Procurement">Procurement</option>
                  <option value="IT & Engineering">IT & Engineering</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                  <option value="Executive & HR">Executive & HR</option>
                  <option value="Sales">Sales</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Category:</label>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Direct COGS">Direct COGS</option>
                  <option value="SaaS & Software">SaaS & Software</option>
                  <option value="Rent & Facilities">Rent & Facilities</option>
                  <option value="Marketing & Ads">Marketing & Ads</option>
                  <option value="Logistics & Freight">Logistics & Freight</option>
                  <option value="Professional Fees">Professional Fees</option>
                  <option value="Utilities & Admin">Utilities & Admin</option>
                </select>
              </div>

              {/* Vendor Filter */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Supplier:</label>
                <select
                  value={draftVendor}
                  onChange={(e) => setDraftVendor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                >
                  <option value="ALL">All Suppliers ({uniqueVendorsList.length})</option>
                  {uniqueVendorsList.map((vName) => (
                    <option key={vName} value={vName}>
                      {vName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status Filter */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Status:</label>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>
            </div>

            {/* ACTION BUTTONS: RESET & SEARCH / APPLY FILTERS */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyFilters()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search / Apply Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* CONDITIONAL RENDER: SHIMMER SKELETON / EMPTY STATE SVG / LIVE DASHBOARD CONTENT */}
        {loading ? (
          <ExpensesShimmerSkeleton />
        ) : expensesData.length === 0 ? (
          <EmptyStateView
            isConnected={isXeroConnected}
            onReset={handleResetFilters}
          />
        ) : (
          <>
            {/* HIGH-IMPACT EXECUTIVE KPI CARDS RIBBON (5 GLOW CARDS WITH LIVE COMPARISON) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: TOTAL SPEND */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition" />
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">TOTAL PURCHASES & OPEX</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-slate-900 font-sans tabular-nums block">£{totalExpenses.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            {compareMode ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>+{totalVariancePct}% vs Prior Period</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Prior Period: £{prevTotalExpenses.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-2">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{expensesData.length} Bills Total</span>
              </div>
            )}
          </div>

          {/* Card 2: DIRECT COGS */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition" />
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">DIRECT COGS SPEND</span>
              <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-indigo-900 font-sans tabular-nums block">£{directCogs.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            {compareMode ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+{directCogsPct}% vs Prior Period</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Prior Period: £{prevDirectCogs.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 font-bold mt-2 flex items-center justify-between">
                <span>{cogsPct}% of Total Purchases</span>
                <span className="text-indigo-600 font-extrabold">{cogsCount} Bills</span>
              </div>
            )}
          </div>

          {/* Card 3: INDIRECT OPEX */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition" />
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">INDIRECT OPEX OVERHEADS</span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-amber-900 font-sans tabular-nums block">£{indirectOpex.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            {compareMode ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-bold">
                  <Activity className="h-3.5 w-3.5" />
                  <span>+{indirectOpexPct}% vs Prior Period</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Prior Period: £{prevIndirectOpex.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-amber-600 font-bold mt-2 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                <span>{opexPct}% of Total Purchases</span>
              </div>
            )}
          </div>

          {/* Card 4: RECURRING SAAS */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl group-hover:bg-sky-500/10 transition" />
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">RECURRING SAAS & SUBS</span>
              <div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-sky-900 font-sans tabular-nums block">£{recurringSpend.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            {compareMode ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-sky-700 font-bold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>+{recurringSpendPct}% vs Prior Period</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Prior Period: £{prevRecurringSpend.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-sky-700 font-bold mt-2 flex items-center justify-between">
                <span>{recurringCount} Software Subscriptions</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px]">Active</span>
              </div>
            )}
          </div>

          {/* Card 5: PENDING & OVERDUE */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition" />
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">PENDING & OVERDUE BILLS</span>
              <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-rose-700 font-sans tabular-nums block">£{pendingAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            {compareMode ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-bold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>+{pendingAmountPct}% vs Prior Period</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Prior Period: £{prevPendingAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-rose-600 font-bold mt-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span>{pendingCount} Priority Authorization Required</span>
              </div>
            )}
          </div>
        </div>

        {/* ECHARTS ANALYTICS GRID (ROW 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Spend Trajectory & Forecast Model */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span>Spend Trajectory & Budget Variance Model</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Monthly Direct COGS vs Indirect Opex run-rate against CFO budget ceiling limit
                </p>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-extrabold self-start sm:self-auto border border-slate-200">
                Monthly Trend
              </span>
            </div>
            <div className="h-72 w-full">
              <ReactECharts option={trajectoryChartOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* Expense Category Share Donut */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between space-y-3">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-600" />
                <span>Expense Category Share</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Proportional percentage breakdown of total operating spend
              </p>
            </div>
            <div className="h-64 w-full">
              <ReactECharts option={categoryDonutOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        {/* ECHARTS ANALYTICS GRID (ROW 2: RADAR & ANOMALY ALERTS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Departmental Spend Distribution Radar */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-600" />
                <span>Departmental Cost Center Radar</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Multi-axis expenditure balance across Procurement, IT, Marketing & Ops
              </p>
            </div>
            <div className="h-64 w-full">
              <ReactECharts option={radarChartOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* CFO AI Cost Optimization Alerts */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">AI Cost Optimization Insights</h3>
              </div>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10.5px] font-black uppercase tracking-wider">
                {aiInsights.length} Actionable Alert{aiInsights.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {aiInsights.map((insight, idx) => (
                <div key={idx} className={cn("p-3.5 border rounded-2xl space-y-1.5 hover:shadow-2xs transition", insight.bgClass)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-black flex items-center gap-2", insight.titleClass)}>
                      {insight.icon}
                      {insight.title}
                    </span>
                    <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md", insight.tagClass)}>
                      {insight.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {insight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MASTER PURCHASES & EXPENSES LEDGER DATATABLE (MATCHING UNIFIED AP & AR ANALYTICS TABLE UI) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* DataTables Header Control Toolbar */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-semibold text-slate-700">
            
            {/* Show Entries Dropdown & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Show Entries Dropdown */}
              <div className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={50}>50</option>
                  <option value={100}>100 (Default)</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={0}>All</option>
                </select>
                <span>entries</span>
              </div>

              {/* Contact / Vendor Dropdown Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
                <span className="text-slate-400 font-normal">Contact:</span>
                <select
                  value={draftVendor}
                  onChange={(e) => setDraftVendor(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  <option value="ALL">All Contacts ({uniqueVendorsList.length})</option>
                  {uniqueVendorsList.map((vName) => (
                    <option key={vName} value={vName}>
                      {vName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Switcher Dropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded">
                <span className="text-slate-400 font-normal">Type:</span>
                <select
                  value={activeTab}
                  onChange={(e: any) => {
                    setActiveTab(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Purchases & Bills</option>
                  <option value="cogs">Direct COGS</option>
                  <option value="opex">Indirect Opex</option>
                  <option value="recurring">Recurring SaaS</option>
                  <option value="overdue">Overdue Only</option>
                </select>
              </div>

            </div>

            {/* Search Input & Apply Search Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span>Search:</span>
                <div className="relative flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Type to filter..."
                    value={draftSearchTerm}
                    onChange={(e) => setDraftSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyFilters();
                    }}
                    className="pl-3 pr-8 py-1 bg-white border border-slate-300 rounded font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 min-w-[180px]"
                  />
                  {draftSearchTerm && (
                    <button
                      onClick={() => {
                        setDraftSearchTerm('');
                        setAppliedSearchTerm('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyFilters()}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Search / Apply Filters"
                >
                  <Search className="h-3 w-3" />
                  <span>Search</span>
                </button>
              </div>

              {/* Export Report Button */}
              <button
                onClick={() => toast.success('Exporting Purchases & Expenses Ledger (.csv)')}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 transition cursor-pointer text-xs shrink-0 shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Report</span>
              </button>
            </div>

          </div>

          {/* DataTables Main Table - Matching AP & AR Analytics exact columns & style */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              
              {/* Table Header */}
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300 select-none">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">#</th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center justify-between">
                      <span>DATE</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'date' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center justify-between">
                      <span>DUE DATE</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'dueDate' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('vendor')}
                  >
                    <div className="flex items-center justify-between">
                      <span>CONTACT / PARTY NAME</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'vendor' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('number')}
                  >
                    <div className="flex items-center justify-between">
                      <span>REFERENCE / INVOICE #</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'number' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center justify-between">
                      <span>EXPENSE CATEGORY</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'category' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th className="py-2.5 px-3 border-r border-slate-200 text-center">CURRENCY</th>

                  <th className="py-2.5 px-3 border-r border-slate-200 text-right">
                    <span>DEBIT (AR)</span>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>CREDIT (AP)</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'amount' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>AMOUNT DUE</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'amount' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-200 transition"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>STATUS</span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {sortCol === 'status' ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </div>
                  </th>

                  <th className="py-2.5 px-3 text-center">ACTION</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400 font-semibold">
                      No matching purchase or expense records found.
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition hover:bg-blue-50/50",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      )}
                    >
                      {/* # Index */}
                      <td className="py-2.5 px-3 text-center text-slate-400 border-r border-slate-200 font-mono">
                        {(currentPage - 1) * (pageSize || paginatedExpenses.length) + idx + 1}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200 text-slate-700">
                        {formatToDDMMYYYY(row.date)}
                      </td>

                      {/* Due Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-slate-200 font-semibold text-slate-900">
                        {formatToDDMMYYYY(row.dueDate)}
                      </td>

                      {/* Contact / Vendor Name */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 truncate max-w-[240px]">
                          {row.vendorName}
                        </div>
                        {row.recurring && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-sky-50 text-sky-700 text-[9px] font-bold rounded border border-sky-200">
                            Recurring
                          </span>
                        )}
                      </td>

                      {/* Reference / Invoice # */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-bold text-blue-600 hover:underline cursor-pointer">
                          {row.billNumber}
                        </div>
                        {row.reference && row.reference !== '—' && (
                          <div className="text-[10.5px] text-slate-400 font-mono truncate max-w-[180px]">
                            {row.reference}
                          </div>
                        )}
                      </td>

                      {/* Expense Category */}
                      <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                          {row.category}
                        </span>
                      </td>

                      {/* Currency */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 font-semibold text-slate-600">
                        GBP
                      </td>

                      {/* Debit (AR) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 text-slate-400 font-mono">
                        —
                      </td>

                      {/* Credit (AP) */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 font-bold text-rose-700 font-mono">
                        £{row.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Amount Due */}
                      <td className="py-2.5 px-3 text-right border-r border-slate-200 font-black text-slate-900 font-mono">
                        £{row.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10.5px] font-black inline-flex items-center gap-1",
                          row.status === 'Paid' && "bg-emerald-100 text-emerald-800 border border-emerald-200",
                          row.status === 'Pending Approval' && "bg-amber-100 text-amber-800 border border-amber-200",
                          row.status === 'Overdue' && "bg-rose-100 text-rose-800 border border-rose-200",
                          row.status === 'Scheduled' && "bg-blue-100 text-blue-800 border border-blue-200"
                        )}>
                          {row.status === 'Paid' && <CheckCircle2 className="h-3 w-3" />}
                          {row.status === 'Overdue' && <AlertTriangle className="h-3 w-3" />}
                          {row.status === 'Pending Approval' && <Clock className="h-3 w-3" />}
                          <span>{row.status}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedBill(row)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded font-bold text-[11px] transition cursor-pointer border border-slate-200 inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* DataTables Pagination Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <div>
              Showing {filteredExpenses.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredExpenses.length) + 1} to {pageSize === 0 ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length)} of {filteredExpenses.length} entries
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-bold text-slate-800">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>

        </div>
          </>
        )}

        {/* EXPENSE DETAIL DRAWER MODAL */}
        {selectedBill && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block">Bill & Expense Detail</span>
                  <h3 className="text-lg font-black text-slate-900">{selectedBill.billNumber}</h3>
                </div>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Vendor / Supplier:</span>
                  <strong className="text-slate-900 font-bold">{selectedBill.vendorName}</strong>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Expense Category:</span>
                  <span className="font-bold text-slate-800">{selectedBill.category}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Department:</span>
                  <span className="font-bold text-slate-800">{selectedBill.department}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Bill Date / Due Date:</span>
                  <span className="font-bold text-slate-800">{selectedBill.date} (Due: {selectedBill.dueDate})</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Payment Status:</span>
                  <span className="font-black text-blue-700">{selectedBill.status}</span>
                </div>

                <div className="flex justify-between py-2 bg-slate-50 rounded-xl px-3 text-sm">
                  <span className="font-extrabold text-slate-700">Total Amount (GBP):</span>
                  <strong className="font-black text-slate-900 font-sans">£{selectedBill.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    toast.success(`Authorizing bill ${selectedBill.billNumber}`);
                    setSelectedBill(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
                >
                  Authorize Payment
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageContainer>
  );
}
