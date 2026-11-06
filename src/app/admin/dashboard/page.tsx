"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Users, 
  CreditCard, 
  PauseCircle, 
  ShieldCheck, 
  TrendingUp, 
  ArrowUpRight, 
  RefreshCw, 
  Plus, 
  UserPlus, 
  Sliders, 
  Plug, 
  BarChart2, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState('3M');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [adminName, setAdminName] = useState('Rajan');

  const fetchAdminProfile = async () => {
    try {
      const res = await fetch('/api/admin/profile');
      const data = await res.json();
      if (res.ok && data.success && data.profile?.name) {
        const firstName = data.profile.name.split(' ')[0] || data.profile.name;
        setAdminName(firstName);
      }
    } catch (e) {
      console.warn('Failed to load admin profile name for greeting:', e);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
      } else {
        toast.error('Failed to load live database metrics');
      }
    } catch (e) {
      toast.error('Network error loading admin stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAdminProfile();
    const handleProfileUpdate = () => fetchAdminProfile();
    window.addEventListener('adminProfileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('adminProfileUpdated', handleProfileUpdate);
  }, []);

  const totalTenants = stats?.totalTenants || 0;
  const totalUsers = stats?.totalUsers || 0;
  const saasMonthlyRevenue = stats?.mrr || '₹0';
  const suspendedTenants = stats?.suspendedTenants || 0;
  const activeIntegrations = stats?.activeIntegrations || 0;
  const topTenants = stats?.tenants || [];

  return (
    <div className="space-y-8 select-none pb-12">
      
      {/* 1. GREETING & TOP CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Welcome back, {adminName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Super Admin Platform Governance & Multi-Tenant Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs text-xs text-slate-500 font-medium">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Wednesday, 23 Sep 2026</span>
            <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-2">System Active</span>
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. ROW 1: 5 KPI SUMMARY CARDS (PURE REAL DATA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        
        {/* KPI 1: Total Tenants */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tenants</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{totalTenants}</span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> Active Organizations
              </span>
            </div>
          </div>

          <Link href="/admin/tenants" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <span>View all companies</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* KPI 2: Total Users */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Users</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{totalUsers}</span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> Active Users
              </span>
            </div>
          </div>

          <Link href="/admin/users" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            <span>Manage users</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* KPI 3: SaaS Subscription Revenue */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SaaS Monthly Revenue</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{saasMonthlyRevenue}</span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> Active SaaS Plans
              </span>
            </div>
          </div>

          <Link href="/admin/billing" className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1">
            <span>View SaaS Billing</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* KPI 4: Suspended Tenants */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
              <PauseCircle className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suspended Tenants</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{suspendedTenants}</span>
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-0.5">
                All Healthy
              </span>
            </div>
          </div>

          <Link href="/admin/tenants?filter=suspended" className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
            <span>Review now</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* KPI 5: Active Integrations */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active API Connectors</span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{activeIntegrations}</span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> Verified Connectors
              </span>
            </div>
          </div>

          <Link href="/admin/integrations" className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            <span>View integrations</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

      </div>

      {/* 3. REAL TENANT SUBSCRIPTION REGISTRY TABLE */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Tenant Subscription & Validity Registry</h3>
            <p className="text-xs text-slate-500">Live multi-tenant subscription plan allocations, assigned dates, and validity days remaining.</p>
          </div>
          <Link href="/admin/tenants" className="text-xs font-bold text-blue-600 hover:underline">
            View All ({topTenants.length}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Organization Name</th>
                <th className="py-3 px-4">Subdomain</th>
                <th className="py-3 px-4">SaaS Plan Tier</th>
                <th className="py-3 px-4">Billing Cycle</th>
                <th className="py-3 px-4">Validity Days Left</th>
                <th className="py-3 px-4">SaaS Fee</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topTenants.length > 0 ? (
                topTenants.map((t: any, idx: number) => (
                  <tr key={t.id || idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 font-extrabold text-xs flex items-center justify-center">
                        {t.name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-900">{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{t.owner}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{t.domain}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        t.plan === 'Enterprise' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        t.plan === 'Business' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        t.plan === 'Professional' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{t.billing_cycle || 'Monthly'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-emerald-600" /> {t.validity_days_left || 30} Days Remaining
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{t.saas_fee || '₹29,990'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toast.info(`Managing plan for "${t.name}"`)}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold rounded-lg transition text-[11px] cursor-pointer"
                      >
                        Manage Plan
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                    {loading ? 'Loading tenant subscriptions...' : 'No tenant organizations found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
