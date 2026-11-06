'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  ChevronDown, 
  SlidersHorizontal,
  Scale, 
  TrendingUp, 
  ShieldCheck, 
  RefreshCw, 
  BookOpen,
  Clock,
  Building,
  HelpCircle,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Search,
  Settings,
  ArrowDown,
  ArrowUp,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TrialBalanceAccount {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  netBalance: number;
}

interface TBData {
  connected: boolean;
  available?: boolean;
  summary: {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    balanced: boolean;
  } | null;
  accounts: TrialBalanceAccount[];
  meta: {
    currency: string | null;
    calculatedAt: string;
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

export default function TrialBalancePage() {
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [data, setData] = useState<TBData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [showZeroBalance, setShowZeroBalance] = useState('No');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTrialBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/reports/trial-balance?date=${date}`);
      if (!res.ok) {
        throw new Error('Failed to load Trial Balance');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load Trial Balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, [date]);

  const currencyCode = data?.meta?.currency || null;
  const getCurrencySymbol = (code: string | null) => {
    if (!code) return '';
    try {
      const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
      return parts.find(p => p.type === 'currency')?.value || '';
    } catch {
      return code === 'GBP' ? '£' : (code === 'EUR' ? '€' : (code === 'INR' ? '₹' : '$'));
    }
  };
  const currencySymbol = getCurrencySymbol(currencyCode);

  const formatAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
    if (val === 0) return '-';
    const prefix = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    return `${prefix}${currencySymbol}${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencyCode ? ` ${currencyCode}` : ''}`;
  };

  const formatKpiAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !Number.isFinite(val)) return 'Not available';
    const prefix = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    return `${prefix}${currencySymbol}${absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencyCode ? ` ${currencyCode}` : ''}`;
  };

  const getFilteredAccounts = () => {
    if (!data || !data.connected || !data.accounts) return [];
    return data.accounts.filter(acc => {
      // 1. Search query
      const matchSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          acc.code.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Account type filter
      let matchType = true;
      if (accountTypeFilter !== 'All') {
        const typeGroup = accountTypeFilter.toLowerCase();
        if (typeGroup === 'asset') matchType = acc.type.includes('Asset') || acc.type === 'Bank' || acc.type.includes('Receivable');
        else if (typeGroup === 'liability') matchType = acc.type.includes('Liability') || acc.type.includes('Payable');
        else matchType = acc.type.toLowerCase().includes(typeGroup);
      }

      // 3. Zero balance filter
      let matchZero = true;
      if (showZeroBalance === 'No') {
        matchZero = acc.debit !== 0 || acc.credit !== 0;
      }

      return matchSearch && matchType && matchZero;
    });
  };

  const filteredAccounts = getFilteredAccounts();
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ECharts Configurations
  const debitVsCreditOption = {
    tooltip: { 
      trigger: 'item',
      formatter: (params: any) => `${params.name}: ${currencySymbol}${params.value.toLocaleString()} (${params.percent}%)`
    },
    legend: { bottom: 10, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: '#64748b' } },
    series: [
      {
        name: 'Balances',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.summary?.totalDebit || 0;
            return `${currencySymbol}${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nTotal`;
          },
          textStyle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: [
          { value: data?.summary?.totalDebit || 0, name: 'Total Debit', itemStyle: { color: '#0064eb' } },
          { value: data?.summary?.totalCredit || 0, name: 'Total Credit', itemStyle: { color: '#10b981' } }
        ]
      }
    ]
  };

  const getAccountTypesData = () => {
    if (!data || !data.connected || !data.accounts) return [];
    const counts: Record<string, number> = {};
    data.accounts.forEach(acc => {
      const g = acc.type.includes('Asset') || acc.type === 'Bank' || acc.type.includes('Receivable') ? 'Assets' :
                acc.type.includes('Liability') || acc.type.includes('Payable') ? 'Liabilities' :
                acc.type === 'Equity' ? 'Equity' : 'Others';
      counts[g] = (counts[g] || 0) + 1;
    });
    const colors: Record<string, string> = { Assets: '#0064eb', Liabilities: '#ef4444', Equity: '#10b981', Others: '#f59e0b' };
    return Object.keys(counts).map(name => ({
      value: counts[name],
      name,
      itemStyle: { color: colors[name] || '#94a3b8' }
    }));
  };

  const accountTypesOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} accounts ({d}%)' },
    legend: { bottom: 10, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: '#64748b' } },
    series: [
      {
        name: 'Account Types',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.accounts?.length || 0;
            return `${sum}\nTotal Accounts`;
          },
          textStyle: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: getAccountTypesData()
      }
    ]
  };

  const getTopAccountsData = () => {
    if (!data || !data.connected || !data.accounts) return { names: [], debits: [], credits: [] };
    // Get top 5 accounts by absolute net value
    const sorted = [...data.accounts]
      .sort((a, b) => Math.abs(b.debit || b.credit) - Math.abs(a.debit || a.credit))
      .slice(0, 5);
    
    return {
      names: sorted.map(a => a.name),
      debits: sorted.map(a => a.debit),
      credits: sorted.map(a => a.credit)
    };
  };

  const topAccounts = getTopAccountsData();
  const topAccountsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Debit', 'Credit'], right: 10, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: topAccounts.names,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10 }
    },
    series: [
      {
        name: 'Debit',
        type: 'bar',
        barWidth: '35%',
        itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
        data: topAccounts.debits
      },
      {
        name: 'Credit',
        type: 'bar',
        barWidth: '35%',
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
        data: topAccounts.credits
      }
    ]
  };

  return (
    <PageContainer>
      {/* ─── Breadcrumbs ─── */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none mb-3">
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Dashboard</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/reports" className="hover:text-slate-600 text-slate-400 transition">Accounting</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/reports" className="hover:text-slate-600 text-slate-400 transition">Reports</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <span className="text-slate-600 font-semibold">Trial Balance</span>
      </div>

      {/* ─── Header Section ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Trial Balance</h1>
            <HelpCircle className="h-4 w-4 text-slate-350 hover:text-slate-500 cursor-pointer transition" />
          </div>
          <p className="text-xs text-slate-500 font-medium">List of all accounts and their debit/credit balances.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* As at Date Selector (Formatted DD/MM/YYYY) */}
          <FormattedDatePicker
            value={date}
            onChange={setDate}
            label="As at:"
          />

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50/20 text-xs font-bold text-red-600 transition cursor-pointer">
            <FileText className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50/20 text-xs font-bold text-emerald-600 transition cursor-pointer">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-3 select-none text-[11px] font-semibold text-slate-500">
        <div className="flex flex-col gap-1 min-w-[130px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Date</span>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white">
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Account Type</span>
          <select 
            value={accountTypeFilter}
            onChange={(e) => { setAccountTypeFilter(e.target.value); setCurrentPage(1); }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Asset">Assets</option>
            <option value="Liability">Liabilities</option>
            <option value="Equity">Equity</option>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expenses</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Show Zero Balance</span>
          <select 
            value={showZeroBalance}
            onChange={(e) => { setShowZeroBalance(e.target.value); setCurrentPage(1); }}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white text-xs outline-none cursor-pointer"
          >
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[90px]">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Currency</span>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-slate-50">
            <span>{currencyCode}</span>
          </div>
        </div>

        <button 
          onClick={fetchTrialBalance}
          className="flex items-center gap-1.5 border border-slate-200 px-3.5 py-1.75 rounded-lg text-slate-600 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer mt-4"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reload Report</span>
        </button>
      </div>

      {/* ─── Error Handling ─── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-3 select-none">
          <AlertCircle className="h-5 w-5 text-red-550 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-red-800">Unable to load Trial Balance</h4>
            <p className="text-xs text-red-650 font-medium">{error}</p>
            <button 
              onClick={fetchTrialBalance}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Skeleton Loader ─── */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 h-96 animate-pulse" />
          </div>
        </div>
      )}

      {/* ─── Main dynamic view ─── */}
      {!loading && !error && data && data.connected !== false && data.summary && (
        <>
          {/* Summary widgets cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 select-none">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Debit</span>
                  <Tooltip text="Total YTD debit balances across all synchronized ledger accounts." />
                </div>
                <h3 className="text-xl font-extrabold text-slate-805 tracking-tight">{formatKpiAmount(data.summary.totalDebit)}</h3>
                <span className="text-[9px] font-bold text-slate-400">Total debit across all accounts</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100/50 text-blue-600 flex items-center justify-center">
                <ArrowDown className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Credit</span>
                  <Tooltip text="Total YTD credit balances across all synchronized ledger accounts." />
                </div>
                <h3 className="text-xl font-extrabold text-slate-805 tracking-tight">{formatKpiAmount(data.summary.totalCredit)}</h3>
                <span className="text-[9px] font-bold text-slate-400">Total credit across all accounts</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100/50 text-emerald-600 flex items-center justify-center">
                <ArrowUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Difference</span>
                  <Tooltip text="The difference between total debits and credits. Must equal zero (balanced) in double-entry bookkeeping." />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-slate-805 tracking-tight">{formatKpiAmount(data.summary.difference)}</h3>
                  {data.summary.balanced && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 border border-emerald-250 text-emerald-700 flex items-center gap-0.75">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>Balanced</span>
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold text-slate-400">Debits and credits are balanced</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100/50 text-purple-600 flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Tables layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Table Details */}
            <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 select-none">
                <h3 className="text-xs font-extrabold text-slate-850 tracking-wider uppercase">Trial Balance Details</h3>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Search account..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 w-[180px] focus:bg-white focus:border-slate-350 outline-none transition"
                    />
                  </div>
                  <button className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 shadow-2xs text-slate-500 cursor-pointer">
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-semibold text-slate-650 text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-extrabold tracking-wider uppercase bg-slate-50/50">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Account Code</th>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Account Type</th>
                      <th className="py-2.5 px-3 text-right">Debit</th>
                      <th className="py-2.5 px-3 text-right">Credit</th>
                      <th className="py-2.5 px-3 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {paginatedAccounts.map((acc, index) => (
                      <tr key={index} className="hover:bg-slate-50/40 transition">
                        <td className="py-3 px-3 text-slate-400 font-bold">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                        <td className="py-3 px-3 text-slate-800 font-bold font-mono">{acc.code || '-'}</td>
                        <td className="py-3 px-3 text-slate-700 font-bold">{acc.name}</td>
                        <td className="py-3 px-3">
                          <span className={cn(
                            "px-2 py-0.75 rounded-md text-[9.5px] font-bold border",
                            acc.type.includes('Asset') || acc.type === 'Bank' || acc.type.includes('Receivable') ? "bg-blue-50 border-blue-100 text-blue-600" :
                            acc.type.includes('Liability') || acc.type.includes('Payable') ? "bg-red-50 border-red-100 text-red-600" :
                            acc.type === 'Equity' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            "bg-amber-50 border-amber-100 text-amber-600"
                          )}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-800">{formatAmount(acc.debit)}</td>
                        <td className="py-3 px-3 text-right text-slate-800">{formatAmount(acc.credit)}</td>
                        <td className={cn("py-3 px-3 text-right font-bold font-mono", acc.netBalance >= 0 ? "text-slate-800" : "text-red-550")}>
                          {formatAmount(acc.netBalance)}
                        </td>
                      </tr>
                    ))}

                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-bold italic">
                          No account records matches search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Totals row */}
                  {filteredAccounts.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/70 text-slate-800 font-extrabold">
                        <td colSpan={4} className="py-3 px-3 text-left">Total</td>
                        <td className="py-3 px-3 text-right border-double border-b-4 border-slate-400">{formatAmount(data.summary.totalDebit)}</td>
                        <td className="py-3 px-3 text-right border-double border-b-4 border-slate-400">{formatAmount(data.summary.totalCredit)}</td>
                        <td className={cn("py-3 px-3 text-right border-double border-b-4 border-slate-400 font-mono", data.summary.difference === 0 ? "text-emerald-700" : "text-red-550")}>
                          {formatAmount(data.summary.totalDebit - data.summary.totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500 select-none">
                  <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAccounts.length)} of {filteredAccounts.length} entries</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1 border border-slate-200 bg-white rounded-md text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="font-bold text-slate-700">Page {currentPage} of {totalPages}</span>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 border border-slate-200 bg-white rounded-md text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right widgets column */}
            <div className="lg:col-span-3 space-y-5">
              {/* Balance Verification */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm text-center space-y-3.5 select-none">
                <div className="h-11 w-11 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-800">Trial Balance is Balanced</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Total Debits equals Total Credits</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-xs font-semibold text-slate-500 space-y-2 border border-slate-100 text-left">
                  <div className="flex justify-between"><span>Total Debit</span><span className="text-slate-805 font-bold font-mono">{formatAmount(data.summary.totalDebit)}</span></div>
                  <div className="flex justify-between"><span>Total Credit</span><span className="text-slate-805 font-bold font-mono">{formatAmount(data.summary.totalCredit)}</span></div>
                  <div className="border-t border-slate-200/60 my-1" />
                  <div className="flex justify-between"><span>Difference</span><span className="text-emerald-600 font-extrabold font-mono">{formatAmount(data.summary.difference)}</span></div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h4>
                <div className="grid grid-cols-1 gap-2.5 text-xs font-semibold">
                  <button className="flex items-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>Export PDF Report</span>
                  </button>
                  <button className="flex items-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                    <span>Export Excel Report</span>
                  </button>
                  <button className="flex items-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none">
                    <Printer className="h-3.5 w-3.5 text-slate-400" />
                    <span>Print Report</span>
                  </button>
                  <button 
                    onClick={fetchTrialBalance}
                    className="flex items-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition text-left cursor-pointer outline-none"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ECharts Visualization */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6 select-none">
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Debit vs Credit</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={debitVsCreditOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Account Types Distribution</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={accountTypesOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider block">Top Accounts by Balance</span>
              <div className="h-[210px] w-full relative">
                <ReactECharts option={topAccountsOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
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
            Please connect your Xero organization under credentials in Data Sources to compile and view your Trial Balance.
          </p>
          <Link href="/data-sources" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm">
            Go to Data Sources
          </Link>
        </div>
      )}

      {/* ─── Footer Notes Section ─── */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 select-none text-[11px] font-semibold text-slate-500/85">
        <div className="flex items-center gap-2 mb-3 text-slate-700">
          <BookOpen className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold">Report Notes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed pl-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><Clock className="h-3.5 w-3.5 text-slate-400" /><span>Generated automatically from Xero</span></div>
            <div className="flex items-center gap-1.75"><Building className="h-3.5 w-3.5 text-slate-400" /><span>Organization: Connected Organization</span></div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.75"><SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" /><span>Report Basis: Accrual</span></div>
            <div className="flex items-center gap-1.75"><Database className="h-3.5 w-3.5 text-slate-400" /><span>Data Source: Xero Accounting API</span></div>
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <div className="flex items-center gap-1.75"><CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /><span>Currency: {currencyCode}</span></div>
            <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">
              "This report reflects the cumulative debit/credit balances across all ledger accounts."
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
