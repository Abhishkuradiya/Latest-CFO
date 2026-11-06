'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Users,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink,
  HelpCircle,
  Bell,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/store/sidebar-store';

export default function StripeDashboardPage() {
  const setCollapsed = useSidebarStore((state) => state.setCollapsed);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'payments' | 'refunds' | 'netcash'>('revenue');

  // Collapse sidebar by default for full-width analytics view
  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stripe/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching Stripe dashboard data:', err);
    } finally {
      // Small smooth delay for preloader animation
      setTimeout(() => setLoading(false), 600);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/stripe/sync', { method: 'POST' });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Stripe sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Helper currency formatter (default INR ₹ format matching design)
  const formatCurrency = (val: number) => {
    if (isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const metrics = data?.metrics || {
    grossRevenue: 2482410,
    grossRevenueTrend: '+12.4%',
    netRevenue: 2310320,
    netRevenueTrend: '+10.8%',
    successfulPayments: 8421,
    successfulPaymentsTrend: '+8.1%',
    refunds: 74210,
    refundsTrend: '+2.3%',
    stripeFees: 42090,
    stripeFeesTrend: '+11.2%',
    netCashPayouts: 2268230,
    netCashPayoutsTrend: '+9.6%',
    activeSubscriptions: 127,
    activeSubscriptionsTrend: '+14.4%',
    outstandingInvoices: 186450,
    outstandingInvoicesTrend: '-6.1%'
  };

  const isTestMode = data?.credentials?.isTestMode ?? true;

  // Preloader Screen
  if (loading) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-slate-50/70 p-6 space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-xl border border-slate-200/80 p-3 flex items-center justify-center animate-pulse">
            <img
              src="/stripe-com-logo.png"
              alt="Stripe Preloader Logo"
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/stripe_logo.png'; }}
            />
          </div>
          <div className="absolute -inset-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Loading Stripe Command Center</h3>
          <p className="text-xs text-slate-400">Synchronizing transactions, subscriptions, payouts and intelligence...</p>
        </div>

        {/* Skeleton Grid Preview */}
        <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 opacity-40 mt-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse p-3 space-y-2">
              <div className="w-6 h-6 rounded-lg bg-slate-100" />
              <div className="w-12 h-3 bg-slate-100 rounded" />
              <div className="w-20 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 lg:p-8 space-y-5 font-sans text-slate-800 max-w-[1700px] mx-auto">
      {/* Development Mode Notice Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/15 border border-amber-300/60 dark:border-amber-700/50 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs font-black">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider">Dashboard Under Active Development</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-widest shadow-2xs">Coming Soon</span>
            </div>
            <p className="text-xs text-amber-900/90 dark:text-amber-300/90 font-medium mt-0.5">
              We are currently developing this Stripe Analytics dashboard. Live metrics, webhook automation, customer LTV insights, & payment features are being added.
            </p>
          </div>
        </div>
      </div>

      {/* Top Filter & Control Bar (Clean No-Card Layout matching Amazon Dashboard pattern) */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        {/* Left Status Pills */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{data?.credentials?.accountName || 'Virtual CFO Account'}</span>
            <span className={cn(
              "px-2 py-0.5 rounded-md text-[10px] font-extrabold border ml-1",
              isTestMode
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {isTestMode ? 'Test Mode' : 'Live Mode'}
            </span>
          </div>

          <span className="text-xs text-slate-400 font-normal hidden sm:inline-block">
            Account ID: <span className="font-mono text-slate-600 dark:text-slate-300">{data?.credentials?.accountId || 'acct_1Pq2...Xyz'}</span>
          </span>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Button */}
          <button className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer outline-none">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Aug 1, 2025 - Aug 31, 2025</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Compare Dropdown */}
          <button className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer outline-none">
            <span>Compare: Previous period</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Sync Button */}
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer outline-none"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Row 1: Top 8 Key Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3.5">
        {/* Metric 1: Gross Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.grossRevenueTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Gross Revenue</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.grossRevenue)}</p>
          </div>
        </div>

        {/* Metric 2: Net Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.netRevenueTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Net Revenue</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.netRevenue)}</p>
          </div>
        </div>

        {/* Metric 3: Successful Payments */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.successfulPaymentsTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Successful Payments</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{metrics.successfulPayments.toLocaleString()}</p>
          </div>
        </div>

        {/* Metric 4: Refunds */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.refundsTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Refunds</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.refunds)}</p>
          </div>
        </div>

        {/* Metric 5: Stripe Fees */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.stripeFeesTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Stripe Fees</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.stripeFees)}</p>
          </div>
        </div>

        {/* Metric 6: Net Cash (Payouts) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.netCashPayoutsTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Net Cash (Payouts)</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.netCashPayouts)}</p>
          </div>
        </div>

        {/* Metric 7: Active Subscriptions */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <ArrowUpRight className="w-3 h-3" />
              {metrics.activeSubscriptionsTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Active Subscriptions</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{metrics.activeSubscriptions}</p>
          </div>
        </div>

        {/* Metric 8: Outstanding Invoices */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[10.5px] font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded-md">
              <ArrowDownRight className="w-3 h-3" />
              {metrics.outstandingInvoicesTrend}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400">Outstanding Invoices</p>
            <p className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">{formatCurrency(metrics.outstandingInvoices)}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Charts & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Revenue & Payments Line Area Chart */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Revenue & Payments</h2>
              <p className="text-xs text-slate-400">Daily gross revenue vs net revenue trends</p>
            </div>

            {/* Filter Pill */}
            <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer">
              <span>Daily</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Chart Controls Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl">
              {(['revenue', 'payments', 'refunds', 'netcash'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveChartTab(tab)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer",
                    activeChartTab === tab ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {tab === 'netcash' ? 'Net Cash' : tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Gross Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Net Revenue</span>
              </div>
            </div>
          </div>

          {/* Visual SVG Wave Line Chart */}
          <div className="w-full h-[220px] pt-4 relative flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A855F7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area 1: Gross */}
              <path
                d="M0,140 Q70,90 140,110 T280,60 T420,50 T500,80 L500,180 L0,180 Z"
                fill="url(#grossGrad)"
              />
              {/* Line 1: Gross */}
              <path
                d="M0,140 Q70,90 140,110 T280,60 T420,50 T500,80"
                fill="none"
                stroke="#6366F1"
                strokeWidth="3"
              />

              {/* Area 2: Net */}
              <path
                d="M0,160 Q70,110 140,130 T280,85 T420,70 T500,100 L500,180 L0,180 Z"
                fill="url(#netGrad)"
              />
              {/* Line 2: Net */}
              <path
                d="M0,160 Q70,110 140,130 T280,85 T420,70 T500,100"
                fill="none"
                stroke="#A855F7"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
            </svg>

            {/* X Axis Labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              <span>Aug 1</span>
              <span>Aug 5</span>
              <span>Aug 10</span>
              <span>Aug 15</span>
              <span>Aug 20</span>
              <span>Aug 25</span>
              <span>Aug 31</span>
            </div>
          </div>
        </div>

        {/* Card 2: Payment Success Rate Donut Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Payment Success Rate</h2>
            <p className="text-xs text-slate-400">Success rate of attempted transactions</p>
          </div>

          {/* Donut Graphic + Legend */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Donut SVG Ring */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-indigo-600" strokeDasharray="92.4, 100" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-rose-500" strokeDasharray="5.6, 100" strokeDashoffset="-92.4" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-slate-900">92.4%</span>
                <span className="text-[10px] font-semibold text-slate-400">Success Rate</span>
              </div>
            </div>

            {/* Legend breakdown list */}
            <div className="w-full space-y-2 mt-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span className="text-slate-600">Successful</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>8,421</span>
                  <span className="text-slate-400 font-normal">92.4%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600">Failed</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>512</span>
                  <span className="text-slate-400 font-normal">5.6%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-slate-600">Pending</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>124</span>
                  <span className="text-slate-400 font-normal">1.4%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-slate-600">Requires Action</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>55</span>
                  <span className="text-slate-400 font-normal">0.6%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Revenue by Payment Method */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Revenue by Payment Method</h2>
              <p className="text-xs text-slate-400">Distribution across payment options</p>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
          </div>

          <div className="space-y-4 my-auto">
            {/* Method 1: Card */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> Card
                </span>
                <span className="font-bold text-slate-900">68.2%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '68.2%' }} />
              </div>
            </div>

            {/* Method 2: UPI */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <Zap className="w-3.5 h-3.5 text-purple-600" /> UPI
                </span>
                <span className="font-bold text-slate-900">12.4%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '12.4%' }} />
              </div>
            </div>

            {/* Method 3: Bank Transfer */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <Layers className="w-3.5 h-3.5 text-blue-600" /> Bank Transfer
                </span>
                <span className="font-bold text-slate-900">8.1%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '8.1%' }} />
              </div>
            </div>

            {/* Method 4: Wallets */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <DollarSign className="w-3.5 h-3.5 text-sky-600" /> Wallets
                </span>
                <span className="font-bold text-slate-900">6.3%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: '6.3%' }} />
              </div>
            </div>

            {/* Method 5: Other */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-violet-600" /> Other
                </span>
                <span className="font-bold text-slate-900">5.0%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: '5.0%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: 4 Data Sub-Cards (MRR, Invoices, Payouts, Disputes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Sub-Card 1: Recurring Revenue (MRR) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Recurring Revenue (MRR)</h2>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-slate-900">{formatCurrency(648320)}</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> 14.4% vs previous period
              </span>
            </div>
          </div>

          {/* Bar Chart Mock */}
          <div className="h-28 flex items-end justify-between gap-2 mt-4 pt-2 border-t border-slate-100">
            {[
              { m: 'Mar', h: 40 },
              { m: 'Apr', h: 45 },
              { m: 'May', h: 60 },
              { m: 'Jun', h: 70 },
              { m: 'Jul', h: 80 },
              { m: 'Aug', h: 95 }
            ].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full bg-indigo-200 group-hover:bg-indigo-600 rounded-t-lg transition-colors" style={{ height: `${bar.h}%` }} />
                <span className="text-[10px] font-semibold text-slate-400">{bar.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-Card 2: Invoices */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Invoices</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
            </div>

            {/* Status Counter Badges */}
            <div className="grid grid-cols-4 gap-1.5 my-3 text-center">
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <p className="text-xs font-extrabold text-slate-900">248</p>
                <p className="text-[9.5px] text-slate-400 font-medium">Total</p>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                <p className="text-xs font-extrabold text-emerald-700">198</p>
                <p className="text-[9.5px] text-emerald-600 font-medium">Paid</p>
              </div>
              <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100">
                <p className="text-xs font-extrabold text-amber-700">32</p>
                <p className="text-[9.5px] text-amber-600 font-medium">Outstanding</p>
              </div>
              <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                <p className="text-xs font-extrabold text-rose-700">18</p>
                <p className="text-[9.5px] text-rose-600 font-medium">Overdue</p>
              </div>
            </div>
          </div>

          {/* Invoice List Items */}
          <div className="space-y-2 text-xs">
            {[
              { num: 'INV-00124', name: 'Acme Corp', val: 12500, status: 'Paid', bg: 'bg-emerald-50 text-emerald-700' },
              { num: 'INV-00123', name: 'Techstart Ltd', val: 8200, status: 'Pending', bg: 'bg-amber-50 text-amber-700' },
              { num: 'INV-00122', name: 'Global Solutions', val: 24000, status: 'Overdue', bg: 'bg-rose-50 text-rose-700' },
              { num: 'INV-00121', name: 'DesignHub', val: 5600, status: 'Paid', bg: 'bg-emerald-50 text-emerald-700' }
            ].map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-800 text-[11px]">{inv.num}</span>
                  <span className="text-slate-500 truncate text-[11px]">{inv.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 text-[11px]">{formatCurrency(inv.val)}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[9.5px] font-extrabold", inv.bg)}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-Card 3: Payouts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Payouts</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
            </div>

            <div className="flex items-baseline gap-4 my-2">
              <div>
                <p className="text-base font-extrabold text-slate-900">{formatCurrency(2268230)}</p>
                <p className="text-[10px] text-slate-400">Total Paid Out</p>
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-900">12</p>
                <p className="text-[10px] text-slate-400">Total Payouts</p>
              </div>
            </div>
          </div>

          {/* Payout List Items */}
          <div className="space-y-2 text-xs">
            {[
              { id: 'po_1Pq2X...', date: 'Aug 28, 2025', val: 342180 },
              { id: 'po_1Pq2W...', date: 'Aug 21, 2025', val: 298420 },
              { id: 'po_1Pq2V...', date: 'Aug 14, 2025', val: 318900 },
              { id: 'po_1Pq2U...', date: 'Aug 07, 2025', val: 284600 },
              { id: 'po_1Pq2T...', date: 'Jul 31, 2025', val: 324130 }
            ].map((po, idx) => (
              <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="font-mono text-[10.5px] font-semibold text-slate-700">{po.id}</span>
                  <span className="text-slate-400 text-[10px]">{po.date}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 text-[11px]">{formatCurrency(po.val)}</span>
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold">Paid</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub-Card 4: Disputes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Disputes</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
            </div>

            <div className="flex items-baseline gap-4 my-2">
              <div>
                <p className="text-base font-extrabold text-slate-900">14</p>
                <p className="text-[10px] text-slate-400">Total Disputes</p>
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-900">{formatCurrency(128420)}</p>
                <p className="text-[10px] text-slate-400">Disputed Amount</p>
              </div>
            </div>
          </div>

          {/* Dispute List Items */}
          <div className="space-y-2 text-xs">
            {[
              { id: 'dp_1Pq2...', date: 'Aug 26, 2025', val: 8200, status: 'Under review', bg: 'bg-amber-50 text-amber-700' },
              { id: 'dp_1Pq1...', date: 'Aug 18, 2025', val: 12500, status: 'Lost', bg: 'bg-rose-50 text-rose-700' },
              { id: 'dp_1Pq1...', date: 'Aug 12, 2025', val: 6300, status: 'Won', bg: 'bg-emerald-50 text-emerald-700' },
              { id: 'dp_1Pq0...', date: 'Aug 05, 2025', val: 9420, status: 'Under review', bg: 'bg-amber-50 text-amber-700' }
            ].map((dp, idx) => (
              <div key={idx} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-mono text-[10.5px] font-semibold text-slate-700">{dp.id}</span>
                  <span className="text-slate-400 text-[10px]">{dp.date}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 text-[11px]">{formatCurrency(dp.val)}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[9.5px] font-extrabold", dp.bg)}>{dp.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Top Products, Customers & AI CFO Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Top Products */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Top Products</h2>
              <p className="text-xs text-slate-400">Best performing plans and products</p>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
          </div>

          <div className="space-y-3 my-3">
            {[
              { name: 'Premium Plan', val: 842320, sales: 1284, color: 'bg-purple-100 text-purple-700' },
              { name: 'Pro Plan', val: 621450, sales: 892, color: 'bg-indigo-100 text-indigo-700' },
              { name: 'Basic Plan', val: 418220, sales: 1102, color: 'bg-amber-100 text-amber-700' },
              { name: 'Consulting Session', val: 284600, sales: 346, color: 'bg-rose-100 text-rose-700' },
              { name: 'API Access', val: 196820, sales: 241, color: 'bg-blue-100 text-blue-700' }
            ].map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs", prod.color)}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{prod.name}</p>
                    <p className="text-[10px] text-slate-400">{prod.sales.toLocaleString()} Sales</p>
                  </div>
                </div>
                <span className="font-extrabold text-slate-900 text-xs">{formatCurrency(prod.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Customers */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Customers</h2>
              <p className="text-xs text-slate-400">Customer volume and key accounts</p>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
          </div>

          <div className="grid grid-cols-3 gap-2 my-3 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <p className="text-sm font-extrabold text-slate-900">1,428</p>
              <p className="text-[10px] text-slate-400 font-medium">Total Customers</p>
              <span className="text-[9.5px] font-bold text-emerald-600">↑ 12.1%</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <p className="text-sm font-extrabold text-slate-900">312</p>
              <p className="text-[10px] text-slate-400 font-medium">New Customers</p>
              <span className="text-[9.5px] font-bold text-emerald-600">↑ 18.4%</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <p className="text-sm font-extrabold text-slate-900">6.2</p>
              <p className="text-[10px] text-slate-400 font-medium">Avg Payments</p>
              <span className="text-[9.5px] font-bold text-emerald-600">↑ 6.8%</span>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { name: 'Acme Corp', email: 'acme@corp.com', val: 124500, count: '12 payments' },
              { name: 'Techstart Ltd', email: 'hello@techstart.com', val: 92800, count: '8 payments' },
              { name: 'Global Solutions', email: 'contact@global.com', val: 86400, count: '9 payments' },
              { name: 'DesignHub', email: 'hey@designhub.com', val: 74200, count: '7 payments' }
            ].map((cust, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                    {cust.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">{cust.name}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{cust.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-900">{formatCurrency(cust.val)}</p>
                  <p className="text-[10px] text-slate-400">{cust.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: AI CFO Insights BETA */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">AI CFO Insights</h2>
              <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-indigo-100 text-indigo-700 uppercase">BETA</span>
            </div>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
          </div>

          <div className="space-y-2.5 my-3 text-xs">
            {/* Insight 1: Revenue Success */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-emerald-950">Revenue is up 12.4% compared to last month.</p>
                <p className="text-[10.5px] text-emerald-700 mt-0.5">You generated ₹2.7L more revenue this period.</p>
              </div>
            </div>

            {/* Insight 2: Refund Warning */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-amber-950">Refund rate increased to 3.0% (↑ 0.8%).</p>
                <p className="text-[10.5px] text-amber-700 mt-0.5">Monitor product issues or customer satisfaction.</p>
              </div>
            </div>

            {/* Insight 3: MRR Growth */}
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-blue-950">MRR grew by 14.4%.</p>
                <p className="text-[10.5px] text-blue-700 mt-0.5">You added 18 new subscriptions this month.</p>
              </div>
            </div>

            {/* Insight 4: Overdue Invoices */}
            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/80 flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-purple-100 text-purple-700 shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-purple-950">5 invoices are overdue.</p>
                <p className="text-[10.5px] text-purple-700 mt-0.5">Total outstanding: ₹1,86,450. Consider sending reminders.</p>
              </div>
            </div>

            {/* Insight 5: Dispute Rate */}
            <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-slate-200 text-slate-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Dispute rate is 0.6%.</p>
                <p className="text-[10.5px] text-slate-600 mt-0.5">This is within normal range for your business.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
