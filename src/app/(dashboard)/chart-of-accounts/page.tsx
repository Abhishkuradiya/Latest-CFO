"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  RefreshCw,
  Calendar,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Filter,
  MoreHorizontal,
  Layers,
  FileCheck,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  type: string;
  class: string;
  taxType: string;
  status: string;
  currency: string | null;
  description: string;
  group: string;
}

interface SummaryData {
  totalAccounts: number;
  distribution: {
    assets: number;
    assetsPct: string;
    liabilities: number;
    liabilitiesPct: string;
    equity: number;
    equityPct: string;
    revenue: number;
    revenuePct: string;
    expenses: number;
    expensesPct: string;
  };
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  startIndex: number;
  endIndex: number;
}

export default function ChartOfAccountsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTax, setSelectedTax] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [summary, setSummary] = useState<SummaryData>({
    totalAccounts: 0,
    distribution: {
      assets: 0,
      assetsPct: '0',
      liabilities: 0,
      liabilitiesPct: '0',
      equity: 0,
      equityPct: '0',
      revenue: 0,
      revenuePct: '0',
      expenses: 0,
      expensesPct: '0'
    }
  });

  const [pagination, setPagination] = useState<PaginationData>({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
    startIndex: 0,
    endIndex: 0
  });

  const [accounts, setAccounts] = useState<AccountItem[]>([]);

  // Update url param when type filter changes
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam) {
      setSelectedType(typeParam);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedType !== 'ALL') params.append('type', selectedType);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedTax !== 'ALL') params.append('taxType', selectedTax);
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));

      const res = await fetch(`/api/dashboard/chart-of-accounts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary);
        setPagination(json.pagination);
        setAccounts(json.accounts || []);
      }
    } catch (err) {
      console.error('Failed to fetch Chart of Accounts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, selectedType, selectedStatus, selectedTax, currentPage, pageSize]);

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      toast.info('Syncing Chart of Accounts with Xero...');
      const res = await fetch('/api/xero', { method: 'POST' });
      if (res.ok) {
        toast.success('Chart of Accounts synced successfully!');
        window.dispatchEvent(new CustomEvent('xero-sync-complete'));
      } else {
        toast.error('Sync completed with warnings.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync with Xero.');
    } finally {
      setIsSyncing(false);
      fetchData();
    }
  };

  // Helper badge color functions
  const getTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'BANK') {
      return 'bg-emerald-50 text-emerald-600 border-emerald-200/60';
    }
    if (t === 'REVENUE' || t === 'SALES') {
      return 'bg-blue-50 text-blue-600 border-blue-200/60';
    }
    if (t === 'DIRECTCOSTS') {
      return 'bg-amber-50 text-amber-600 border-amber-200/60';
    }
    if (t === 'EXPENSE' || t === 'OVERHEADS') {
      return 'bg-orange-50 text-orange-600 border-orange-200/60';
    }
    if (t === 'CURRLIAB' || t === 'LIABILITY') {
      return 'bg-rose-50 text-rose-600 border-rose-200/60';
    }
    if (t === 'EQUITY') {
      return 'bg-indigo-50 text-indigo-600 border-indigo-200/60';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getClassBadge = (cls: string) => {
    const c = cls.toUpperCase();
    if (c === 'ASSET') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (c === 'REVENUE') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (c === 'EXPENSE') return 'bg-orange-50 text-orange-600 border-orange-100';
    if (c === 'LIABILITY') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (c === 'EQUITY') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const dist = summary.distribution;

  return (
    <div className="space-y-6 max-w-full pb-10 select-none">
      {/* Top Header */}
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
          <Link href="/overview" className="hover:text-slate-700 transition">Dashboard</Link>
          <span>&gt;</span>
          <span className="text-slate-700 font-bold">Chart of Accounts</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Chart of Accounts</h1>
        <p className="text-[12px] text-slate-500 font-medium mt-0.5">
          Complete list of all accounts in your connected Xero organization.
        </p>
      </div>

      {/* KPI Distribution Cards Row (6 Cards matching Screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Accounts (Donut Chart) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between min-h-[110px]">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Accounts</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{summary.totalAccounts}</span>
            <span className="text-[10px] font-medium text-slate-400 mt-0.5 block leading-tight">
              Active distribution across account types.
            </span>
          </div>
          {/* Mini Donut SVG */}
          <div className="relative h-14 w-14 shrink-0 flex items-center justify-center">
            <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" stroke="#10b981" strokeWidth="4" strokeDasharray="18 100" strokeDashoffset="0" fill="none" />
              <circle cx="18" cy="18" r="14" stroke="#ef4444" strokeWidth="4" strokeDasharray="18 100" strokeDashoffset="-18" fill="none" />
              <circle cx="18" cy="18" r="14" stroke="#6366f1" strokeWidth="4" strokeDasharray="3 100" strokeDashoffset="-36" fill="none" />
              <circle cx="18" cy="18" r="14" stroke="#3b82f6" strokeWidth="4" strokeDasharray="12 100" strokeDashoffset="-39" fill="none" />
              <circle cx="18" cy="18" r="14" stroke="#f59e0b" strokeWidth="4" strokeDasharray="49 100" strokeDashoffset="-51" fill="none" />
            </svg>
            <span className="absolute text-[11px] font-extrabold text-slate-800">{summary.totalAccounts}</span>
          </div>
        </div>

        {/* Card 2: Assets */}
        <div
          onClick={() => setSelectedType(selectedType === 'Assets' ? 'ALL' : 'Assets')}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xs min-h-[110px]",
            selectedType === 'Assets' ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Assets</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{dist.assets}</span>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dist.assetsPct}% of total</p>
          </div>
        </div>

        {/* Card 3: Liabilities */}
        <div
          onClick={() => setSelectedType(selectedType === 'Liabilities' ? 'ALL' : 'Liabilities')}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xs min-h-[110px]",
            selectedType === 'Liabilities' ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <span>Liabilities</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{dist.liabilities}</span>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dist.liabilitiesPct}% of total</p>
          </div>
        </div>

        {/* Card 4: Equity */}
        <div
          onClick={() => setSelectedType(selectedType === 'Equity' ? 'ALL' : 'Equity')}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xs min-h-[110px]",
            selectedType === 'Equity' ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            <span>Equity</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{dist.equity}</span>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dist.equityPct}% of total</p>
          </div>
        </div>

        {/* Card 5: Revenue */}
        <div
          onClick={() => setSelectedType(selectedType === 'Revenue' ? 'ALL' : 'Revenue')}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xs min-h-[110px]",
            selectedType === 'Revenue' ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <span>Revenue</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{dist.revenue}</span>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dist.revenuePct}% of total</p>
          </div>
        </div>

        {/* Card 6: Expenses */}
        <div
          onClick={() => setSelectedType(selectedType === 'Expenses' ? 'ALL' : 'Expenses')}
          className={cn(
            "bg-white rounded-xl border p-4 shadow-2xs flex flex-col justify-between cursor-pointer transition-all duration-200 hover:shadow-xs min-h-[110px]",
            selectedType === 'Expenses' ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200/80 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span>Expenses</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{dist.expenses}</span>
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{dist.expensesPct}% of total</p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Controls Header Bar: Search & Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts by name, code or type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-[11.5px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-primary transition"
              />
            </div>

            {/* Account Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-[11.5px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer focus:border-primary"
            >
              <option value="ALL">All Account Types</option>
              <option value="Assets">Assets</option>
              <option value="Liabilities">Liabilities</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expenses">Expenses</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-[11.5px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer focus:border-primary"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Tax Type Filter */}
            <select
              value={selectedTax}
              onChange={(e) => {
                setSelectedTax(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-[11.5px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer focus:border-primary"
            >
              <option value="ALL">All Tax Types</option>
              <option value="OUTPUT">OUTPUT</option>
              <option value="INPUT">INPUT</option>
              <option value="NONE">NONE</option>
            </select>

            {/* More Filters button */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>More Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Dropdown button */}
            <button
              onClick={() => toast.info('Exporting Chart of Accounts list...')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              <span>Export</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Add Account Primary Button */}
            <button
              onClick={() => toast.success('Add Account modal trigger')}
              className="flex items-center gap-1 px-3.5 py-1.5 text-[11.5px] font-bold text-white bg-[#0064eb] hover:bg-blue-700 rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Account</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 font-extrabold text-slate-500">CODE</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">NAME</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">TYPE</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">CLASS</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">TAX TYPE</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">STATUS</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">CURRENCY</th>
                <th className="py-3 px-4 font-extrabold text-slate-500">DESCRIPTION</th>
                <th className="py-3 px-4 text-center font-extrabold text-slate-500">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-3 w-10 bg-slate-100 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 w-36 bg-slate-100 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-100 rounded-full" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-100 rounded-full" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 w-12 bg-slate-100 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-14 bg-slate-100 rounded-full" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 w-8 bg-slate-100 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-3 w-48 bg-slate-100 rounded" /></td>
                    <td className="py-3.5 px-4 text-center"><div className="h-4 w-4 bg-slate-100 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-350 mb-3 shadow-2xs">
                        <Layers className="h-6 w-6 stroke-[1.5]" />
                      </div>
                      <h4 className="text-[13px] font-bold text-slate-700">No Accounts Found</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">
                        No chart of accounts matched your search or filter query.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-700 font-mono text-[11px]">{row.code}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[200px] truncate">{row.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={cn("px-2 py-0.5 text-[9.5px] font-extrabold uppercase rounded border tracking-wider", getTypeBadge(row.type))}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn("px-2 py-0.5 text-[9.5px] font-extrabold uppercase rounded border tracking-wider", getClassBadge(row.class))}>
                        {row.class}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-500 uppercase text-[10.5px]">{row.taxType}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 text-[9.5px] font-extrabold uppercase rounded bg-emerald-50 text-emerald-600 border border-emerald-200/60 tracking-wider">
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 text-[10.5px]">{row.currency}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium max-w-[240px] truncate">{row.description}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px]">
          <div className="text-slate-400 font-semibold">
            Showing <span className="font-bold text-slate-700">{pagination.startIndex}</span> to{' '}
            <span className="font-bold text-slate-700">{pagination.endIndex}</span> of{' '}
            <span className="font-bold text-slate-700">{pagination.totalItems}</span> accounts
          </div>

          <div className="flex items-center gap-4">
            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 cursor-pointer transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition cursor-pointer",
                      pagination.currentPage === pageNum
                        ? "border border-blue-600 bg-white text-blue-600 shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {pagination.totalPages > 5 && (
                <>
                  <span className="px-1 text-slate-400">...</span>
                  <button
                    onClick={() => setCurrentPage(pagination.totalPages)}
                    className={cn(
                      "h-7 w-7 flex items-center justify-center rounded text-[11px] font-bold transition cursor-pointer",
                      pagination.currentPage === pagination.totalPages
                        ? "border border-blue-600 bg-white text-blue-600 shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {pagination.totalPages}
                  </button>
                </>
              )}

              <button
                disabled={pagination.currentPage >= pagination.totalPages}
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 cursor-pointer transition"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items per page selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-700 outline-none cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
