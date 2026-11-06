"use client";

import React, { useState } from 'react';
import { BarChart3, Download, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminReportsPage() {
  const [tab, setTab] = useState('revenue');

  return (
    <div className="space-y-6 select-none pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">SaaS Platform Reports & Analytics</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Platform-wide MRR/ARR analytics, tenant churn, user activity, and system throughput reports.</p>
        </div>

        <button onClick={() => toast.success('Exporting full analytics report PDF')} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer">
          <Download className="h-4 w-4" /> Export Analytics PDF
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-500 w-fit">
          {['revenue', 'mrr / arr', 'tenant growth', 'churn rate', 'usage analytics', 'system reports'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-xl capitalize transition cursor-pointer ${tab === t ? 'bg-blue-600 text-white shadow-xs' : 'hover:text-slate-900'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
          <BarChart3 className="h-10 w-10 text-blue-600 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900 capitalize">{tab} Report Dashboard</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Aggregated multi-tenant platform metrics for {tab}. All data refreshed in real time.</p>
        </div>
      </div>
    </div>
  );
}
