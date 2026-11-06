"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Tenant {
  id: number;
  name: string;
  created_at: string;
}

export default function OrganizationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTenants(data.tenants);
        }
      }
    } catch (err) {
      toast.error('Failed to load tenants');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTenantName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(`Tenant "${data.tenant.name}" created successfully!`);
          setNewTenantName('');
          fetchTenants();
        } else {
          toast.error(data.message || 'Failed to create tenant');
        }
      }
    } catch (err) {
      toast.error('Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 font-sans max-w-4xl mx-auto space-y-8 select-none">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Organization Workspaces</h1>
        <p className="text-sm text-slate-500 mt-1.5 font-medium">
          Create separate workspaces to connect different Xero accounts and manage multiple companies.
        </p>
      </div>

      {/* Create Tenant Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Create New Workspace</h2>
        <form onSubmit={handleCreateTenant} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="e.g. Acme Corporation, Demo Company (UK)"
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-slate-50/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-[#0064eb] text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>

      {/* Tenants List */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-bold text-slate-700">Available Workspaces</h2>
        {tenants.length === 0 ? (
          <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-sm text-slate-400 font-medium">
            No workspaces registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-3xs gap-4"
              >
                <div>
                  <div className="font-bold text-slate-800 text-[14.5px]">
                    {t.name}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider mt-1">
                    Platform Workspace ID: {t.id} • Registered: {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="/overview"
                    className="px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition text-center min-w-[110px]"
                  >
                    Go to Dashboard
                  </a>
                  <a
                    href="/data-sources"
                    className="px-4 py-2 bg-[#64748b] hover:bg-slate-500 text-white rounded-lg text-xs font-bold transition text-center min-w-[110px]"
                  >
                    Manage Xero
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
