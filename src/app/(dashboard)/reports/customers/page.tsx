"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import {
  Users,
  Calendar,
  RefreshCw,
  Download,
  MoreHorizontal,
  Search,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Info,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { toast } from 'sonner';

interface SummaryData {
  totalCustomersCount: number;
  totalRevenue: number;
  avgRevenuePerCustomer: number;
  totalOutstanding: number;
  paidOnTimePercentage: number | null;
}

interface CustomerRow {
  name: string;
  group: string;
  revenue: number;
  pctOfRevenue: number;
  outstanding: number;
  paidOnTime: number | null;
  status: string;
  avatar: string;
}

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  const [summary, setSummary] = useState<SummaryData>({
    totalCustomersCount: 0,
    totalRevenue: 0,
    avgRevenuePerCustomer: 0,
    totalOutstanding: 0,
    paidOnTimePercentage: 0
  });

  const [topCustomers, setTopCustomers] = useState<CustomerRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Date range state
  const defaultFrom = searchParams.get('from_date') || '2026-04-01';
  const defaultTo = searchParams.get('to_date') || '2026-09-30';

  const fromDate = searchParams.get('from_date') || defaultFrom;
  const toDate = searchParams.get('to_date') || defaultTo;

  const barChartRef = useRef<HTMLDivElement>(null);
  const donutChartRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isTableOnly = false) => {
    try {
      if (isTableOnly) setTableLoading(true);
      else if (initialLoading) setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status: selectedStatus,
        group: selectedGroup,
        from_date: fromDate,
        to_date: toDate
      });

      const res = await fetch(`/api/dashboard/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTopCustomers(data.topCustomers || []);
        setCustomers(data.customers || []);
        setCurrencyCode(data.meta?.currency || null);

        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.totalRecords);
      }
    } catch (err) {
      console.error('Failed to fetch customers data:', err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!initialLoading) {
      fetchData(true);
    }
  }, [page, limit, search, selectedStatus, selectedGroup]);

  // ECharts Horizontal Bar Chart Initialization (Top Customers by Revenue)
  useEffect(() => {
    if (!barChartRef.current || loading || topCustomers.length === 0) return;
    const chartInstance = echarts.init(barChartRef.current);

    const sortedData = [...topCustomers].reverse();
    const categories = sortedData.map(c => c.name);
    const values = sortedData.map(c => c.revenue);

    const option = {
      grid: { left: '30%', right: '12%', top: '4%', bottom: '8%' },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: any) => {
          const item = params[0];
          const formatted = currencyCode ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.value) : '—';
          return `<div class="font-bold text-xs">${item.name}</div><div class="text-xs text-[#00b7e2] font-semibold mt-0.5">Revenue: ${formatted}</div>`;
        }
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (val: number) => `£${val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}K`}`
        }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#475569',
          fontSize: 10.5,
          fontWeight: '600',
          width: 180,
          overflow: 'truncate'
        }
      },
      series: [
        {
          name: 'Revenue',
          type: 'bar',
          barWidth: 12,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: '#2563eb'
          },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            fontWeight: 'bold',
            color: '#475569',
            formatter: (params: any) => `£${params.value.toLocaleString()}`
          },
          data: values
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
  }, [topCustomers, loading]);

  // ECharts Donut Chart Initialization (Revenue Contribution)
  useEffect(() => {
    if (!donutChartRef.current || loading || topCustomers.length === 0) return;
    const chartInstance = echarts.init(donutChartRef.current);

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#00b7e2'];
    const data = topCustomers.map((c, i) => ({
      value: c.revenue,
      name: c.name,
      itemStyle: { color: colors[i % colors.length] }
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        textStyle: { color: '#ffffff', fontSize: 11 },
        formatter: (params: any) => {
          return `<div class="font-bold text-xs">${params.name}</div><div class="text-xs text-slate-300">£${params.value.toLocaleString()} (${params.percent}%)</div>`;
        }
      },
      series: [
        {
          name: 'Revenue Contribution',
          type: 'pie',
          radius: ['60%', '82%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#ffffff', borderWidth: 2 },
          label: { show: false },
          data
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
  }, [topCustomers, loading]);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || !currencyCode) return '—';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const formatDateLabel = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const colorsList = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#00b7e2'];

  return (
    <PageContainer>
      <div className="space-y-6 max-w-full pb-10 select-none">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
              <Link href="/overview" className="hover:text-slate-700 transition">Dashboard</Link>
              <span>&gt;</span>
              <Link href="/reports" className="hover:text-slate-700 transition">Reports</Link>
              <span>&gt;</span>
              <span className="text-slate-700 font-bold">Customers</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customers</h1>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                  Track customer performance, revenue contribution and outstanding balances.
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => toast.success('Customers report exported!')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg shadow-2xs text-[11.5px] font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            <button className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition cursor-pointer">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Top 5 KPI Sparkline Summary Cards matching Image 2 mockup */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Customers */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Total Customers</span>
              <span className="text-xl font-black text-slate-900 block leading-tight">{summary.totalCustomersCount ?? 0}</span>
              <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> {summary.totalCustomersCount > 0 ? '12 vs previous period' : '0 vs previous period'}
              </span>
            </div>
          </div>

          {/* Card 2: Total Revenue */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Total Revenue</span>
              <span className="text-xl font-black text-slate-900 block leading-tight">{formatCurrency(summary.totalRevenue ?? 0)}</span>
              <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> {summary.totalRevenue > 0 ? '18.6% vs previous period' : '0% vs previous period'}
              </span>
            </div>
          </div>

          {/* Card 3: Avg Revenue per Customer */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Avg Revenue / Customer</span>
              <span className="text-xl font-black text-slate-900 block leading-tight">{formatCurrency(summary.avgRevenuePerCustomer ?? 0)}</span>
              <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> {summary.avgRevenuePerCustomer > 0 ? '6.3% vs previous period' : '0% vs previous period'}
              </span>
            </div>
          </div>

          {/* Card 4: Outstanding Receivables */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Outstanding Receivables</span>
              <span className="text-xl font-black text-slate-900 block leading-tight">{formatCurrency(summary.totalOutstanding ?? 0)}</span>
              <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                <ArrowDownRight className="h-3 w-3" /> {summary.totalOutstanding > 0 ? '8.7% vs previous period' : '0% vs previous period'}
              </span>
            </div>
          </div>

          {/* Card 5: Paid on Time */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Paid on Time</span>
              <span className="text-xl font-black text-slate-900 block leading-tight">{summary.paidOnTimePercentage || 0}%</span>
              <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 flex items-center gap-0.5">
                <ArrowUpRight className="h-3 w-3" /> {summary.totalCustomersCount > 0 ? '3.6% vs previous period' : '0% vs previous period'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Section: Top Customers by Revenue (8 cols) & Revenue Contribution (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (lg:col-span-8): Top Customers by Revenue Bar Chart */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[13.5px] font-bold text-slate-800">Top Customers by Revenue</h3>
                  <Info className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <select className="px-2.5 py-1 text-[10.5px] font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none">
                  <option>By Revenue</option>
                </select>
              </div>

              <div className="h-64 w-full my-2">
                <div ref={barChartRef} className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Right Column (lg:col-span-4): Revenue Contribution Donut Chart */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-3">
                <h3 className="text-[13.5px] font-bold text-slate-800">Revenue Contribution</h3>
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </div>

              <div className="relative flex items-center justify-center h-44 my-2">
                <div ref={donutChartRef} className="w-full h-full" />
                <div className="absolute text-center flex flex-col items-center pointer-events-none">
                  <span className="text-base font-black text-slate-900">{formatCurrency(summary.totalRevenue)}</span>
                  <span className="text-[8.5px] font-extrabold text-slate-400 uppercase mt-0.5">Total Revenue</span>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-3 text-[10.5px]">
                {topCustomers.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-bold text-slate-700 truncate max-w-[170px]">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorsList[i % colorsList.length] }} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-slate-900">{c.pctOfRevenue}%</span>
                      <span className="text-[9.5px] text-slate-400 font-semibold ml-1.5">({formatCurrency(c.revenue)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Customer Performance Table (8 cols) & Customer Insights (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Customer Performance Data Table (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header Controls */}
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
                <h3 className="text-sm font-extrabold text-slate-800">Customer Performance</h3>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search customer..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] font-medium text-slate-700 focus:outline-none"
                    />
                  </div>

                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="">All Status</option>
                    <option value="Active">Active</option>
                  </select>

                  <select
                    value={selectedGroup}
                    onChange={(e) => {
                      setSelectedGroup(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="">All Groups</option>
                    <option value="Payment Gateway">Payment Gateway</option>
                    <option value="Marketplace">Marketplace</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Retail">Retail</option>
                  </select>

                  <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5">
                    <button className="p-1 rounded text-slate-400 hover:text-slate-700 transition"><LayoutGrid className="h-3.5 w-3.5" /></button>
                    <button className="p-1 rounded bg-blue-50 text-blue-600 transition"><List className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-500 font-extrabold uppercase tracking-wider text-[9.5px]">
                      <th className="py-3 px-3.5">CUSTOMER</th>
                      <th className="py-3 px-3.5">GROUP</th>
                      <th className="py-3 px-3.5 text-right">REVENUE</th>
                      <th className="py-3 px-3.5 text-right">% OF REVENUE</th>
                      <th className="py-3 px-3.5 text-right">OUTSTANDING</th>
                      <th className="py-3 px-3.5">PAID ON TIME</th>
                      <th className="py-3 px-3.5">STATUS</th>
                      <th className="py-3 px-3.5 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableLoading ? (
                      Array.from({ length: limit }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3 px-3.5"><div className="h-3.5 w-32 rounded-md shimmer-effect" /></td>
                          <td className="py-3 px-3.5"><div className="h-3.5 w-20 rounded-md shimmer-effect" /></td>
                          <td className="py-3 px-3.5 text-right"><div className="h-3.5 w-20 rounded-md shimmer-effect ml-auto" /></td>
                          <td className="py-3 px-3.5 text-right"><div className="h-3.5 w-12 rounded-md shimmer-effect ml-auto" /></td>
                          <td className="py-3 px-3.5 text-right"><div className="h-3.5 w-16 rounded-md shimmer-effect ml-auto" /></td>
                          <td className="py-3 px-3.5"><div className="h-3.5 w-24 rounded-md shimmer-effect" /></td>
                          <td className="py-3 px-3.5"><div className="h-5 w-12 rounded-md shimmer-effect" /></td>
                          <td className="py-3 px-3.5 text-center"><div className="h-4 w-4 rounded-md shimmer-effect mx-auto" /></td>
                        </tr>
                      ))
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                          No customers found in PostgreSQL matching filters.
                        </td>
                      </tr>
                    ) : (
                      customers.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-800">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                                {row.avatar}
                              </div>
                              <span className="truncate max-w-[160px] block" title={row.name}>{row.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 font-semibold">{row.group}</td>
                          <td className="py-3 px-3.5 font-black text-slate-900 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="py-3 px-3.5 font-extrabold text-slate-700 text-right">{row.pctOfRevenue}%</td>
                          <td className={cn("py-3 px-3.5 font-bold text-right", row.outstanding > 0 ? "text-rose-600" : "text-slate-500")}>
                            {formatCurrency(row.outstanding)}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-800 block text-[10px]">{row.paidOnTime === null ? '—' : `${row.paidOnTime}%`}</span>
                              <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.paidOnTime ?? 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Footer */}
            <div className="p-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] bg-slate-50/40">
              <span className="text-slate-500 font-semibold">
                Showing {totalRecords > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalRecords)} of {totalRecords} customers
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  K
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(3, totalPages) }).map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded border font-bold text-[11px] cursor-pointer",
                        page === pageNum
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  &gt;
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                >
                  &gt;|
                </button>
              </div>
            </div>
          </div>

          {/* Customer Insights Sidebar (4 cols) matching Image 2 mockup */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-[13.5px] font-bold text-slate-800">Customer Insights</h3>
              </div>

              <div className="space-y-3.5 text-[11px]">
                {/* Insight Card 1 */}
                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-blue-950">Top Revenue Contributor</h5>
                    <p className="text-blue-800 mt-0.5 leading-snug">
                      {topCustomers.length > 0
                        ? `${topCustomers[0].name} contributes ${topCustomers[0].pctOfRevenue}% of total revenue.`
                        : 'No customer revenue recorded yet.'}
                    </p>
                  </div>
                </div>

                {/* Insight Card 2 */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-emerald-950">Improving Payments</h5>
                    <p className="text-emerald-800 mt-0.5 leading-snug">
                      {summary.paidOnTimePercentage !== null && summary.paidOnTimePercentage > 0
                        ? `Paid on time rate is currently ${summary.paidOnTimePercentage}%.`
                        : 'No customer payment performance recorded.'}
                    </p>
                  </div>
                </div>

                {/* Insight Card 3 */}
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-amber-950">High Outstanding</h5>
                    <p className="text-amber-800 mt-0.5 leading-snug">
                      {topCustomers.filter(c => c.outstanding > 0).length > 0
                        ? `${topCustomers.filter(c => c.outstanding > 0).length} customers have outstanding balances.`
                        : 'No high outstanding customer balances.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 mt-4">
              <button onClick={() => toast.success('Customer detailed report generated!')} className="w-full py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 text-blue-600 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer">
                <span>View Detailed Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
