"use client";

import React, { useState, useEffect } from 'react';
import { Plug, Server, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Key, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminIntegrationsPage() {
  const [tab, setTab] = useState('health');
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<any[]>([]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations');
      const data = await res.json();
      if (res.ok && data.success) {
        setIntegrations(data.integrations || []);
      } else {
        toast.error('Failed to load database integrations');
      }
    } catch (e) {
      toast.error('Error connecting to integration database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  return (
    <div className="space-y-6 select-none pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Integrations & API Health</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Monitor multi-tenant financial data connectors and API health statuses. Total: <strong className="text-blue-600">{integrations.length} Active Connectors</strong></p>
        </div>

        <button onClick={fetchIntegrations} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Trigger API Health Check
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-500 w-fit">
          {['health', 'xero', 'quickbooks', 'zoho books', 'api keys'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-xl capitalize transition cursor-pointer ${tab === t ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {integrations.length > 0 ? (
            integrations.map((item, idx) => (
              <div key={idx} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                    <p className="text-[11px] text-slate-400">Organization: <strong className="text-slate-700">{item.company}</strong> • Tenant ID: <span className="font-mono text-slate-600">{item.tenant_identifier || 'Standard'}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-bold text-slate-800 block">{item.uptime} Uptime</span>
                    <span className="text-[10px] text-slate-400">Last Synced: {item.last_synced}</span>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {item.status}
                  </span>

                  <button onClick={() => toast.info(`Configuring ${item.name}`)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer">Credentials</button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              {loading ? 'Loading real database API connectors...' : 'No API credentials found in database.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
