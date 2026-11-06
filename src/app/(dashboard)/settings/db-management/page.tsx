"use client";

import React, { useState, useEffect } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Users,
  Shield,
  Layers,
  FileText,
  UserCheck,
  CheckCircle,
  HelpCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { PageContainer } from '@/components/common/page-container';
import { SectionHeader } from '@/components/common/section-header';
import { toast } from 'sonner';

export default function DatabaseManagementPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/db-management');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      } else {
        toast.error('Failed to load database status details.');
      }
    } catch (err: any) {
      toast.error('Error fetching admin cockpit data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (action: string, payload: Record<string, any>) => {
    if (!confirm(`Are you sure you want to perform this action? (${action})`)) {
      return;
    }

    const actionKey = `${action}-${payload.tenantId || payload.userId || 'global'}`;
    setActionLoading(actionKey);

    try {
      const res = await fetch('/api/admin/db-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });

      const responseData = await res.json();
      if (res.ok && responseData.success) {
        toast.success(responseData.message || 'Action executed successfully.');
        await fetchData();
      } else {
        toast.error(responseData.error || 'Failed to execute database action.');
      }
    } catch (err: any) {
      toast.error('Error executing admin action: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <PageContainer>
        <div className="flex h-[400px] items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  const isPg = data?.postgresConnected;

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Database & Tenant Control Center"
            description="Manage systems, clear caching layers, delete tenants/users, and sync cache states."
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-card-foreground shadow-sm transition hover:bg-muted"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh Control Center
          </button>
        </div>

        {/* CONNECTION STATUS CARDS */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg p-3 ${isPg ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PostgreSQL DB</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${isPg ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-sm font-bold">{isPg ? 'Connected & Active' : 'Disconnected / Error'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg p-3 bg-blue-500/10 text-blue-500">
                <HardDrive className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fallback JSON DB</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold">Resilient (Always Loaded)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-lg p-3 bg-violet-500/10 text-violet-500">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current User Tenant ID</h3>
                <div className="mt-1">
                  <span className="text-sm font-bold">Tenant ID: {data?.currentTenantId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CACHE HYDRATION SECTION */}
        {isPg && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Rate Limit Safe Cache Restoration</h4>
                  <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                    If Xero API returns 429 errors or you cleared your PostgreSQL cache, you can hydrate PG tables directly from the local JSON DB cache. This avoids querying the Xero API entirely.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAction('hydratePgFromJson', { tenantId: data?.currentTenantId })}
                disabled={actionLoading === `hydratePgFromJson-${data?.currentTenantId}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === `hydratePgFromJson-${data?.currentTenantId}` ? 'animate-spin' : ''}`} />
                Hydrate PostgreSQL from JSON DB Cache
              </button>
            </div>
          </div>
        )}

        {/* COMPARATIVE TABLE ROW COUNTS */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-6 py-4">
            <h3 className="text-sm font-bold">Comparative Cached Row Counts</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Stats of cached entities in PostgreSQL vs the backup JSON database.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-6 py-3">Database Entity / Table Name</th>
                  <th className="px-6 py-3 text-center">PostgreSQL Cache Row Count</th>
                  <th className="px-6 py-3 text-center">Local JSON DB Count (Backup)</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {Object.keys(data?.jsonStats || {}).map((key) => {
                  const pgCount = data?.pgStats[key] ?? -1;
                  const jsonCount = data?.jsonStats[key] ?? 0;
                  return (
                    <tr key={key} className="hover:bg-muted/20">
                      <td className="px-6 py-3 font-semibold capitalize">{key.replace('_', ' ')}</td>
                      <td className="px-6 py-3 text-center font-mono font-bold">
                        {pgCount === -1 ? 'N/A (PG Down)' : pgCount}
                      </td>
                      <td className="px-6 py-3 text-center font-mono text-muted-foreground">{jsonCount}</td>
                      <td className="px-6 py-3 text-center">
                        {pgCount === jsonCount && pgCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                            <CheckCircle className="h-3 w-3" /> Balanced
                          </span>
                        ) : pgCount === 0 && jsonCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-500">
                            <AlertTriangle className="h-3 w-3" /> Cache Cleared (PG Empty)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-500">
                            <Layers className="h-3 w-3" /> Populated
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* TENANTS MANAGEMENT */}
          <div className="rounded-xl border bg-card">
            <div className="border-b px-6 py-4">
              <h3 className="text-sm font-bold">Tenants Directory</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tenants registered in the system. Clearing cache keeps OAuth credentials.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="px-6 py-3">Tenant ID</th>
                    <th className="px-6 py-3">Tenant Name</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {data?.tenants.map((t: any) => {
                    const isCurrent = t.id === data.currentTenantId;
                    return (
                      <tr key={t.id} className={`hover:bg-muted/20 ${isCurrent ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-6 py-3 font-mono font-bold">{t.id}</td>
                        <td className="px-6 py-3 font-medium flex items-center gap-2">
                          {t.name}
                          {isCurrent && (
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-500">
                              Active Session
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleAction('clearPgCache', { tenantId: t.id })}
                              disabled={actionLoading !== null}
                              className="rounded border border-border bg-card px-2 py-1 text-[10px] font-semibold text-card-foreground transition hover:bg-muted"
                            >
                              Clear Cache
                            </button>
                            <button
                              onClick={() => handleAction('deleteCredentials', { tenantId: t.id })}
                              disabled={actionLoading !== null}
                              className="rounded border border-border bg-card px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-50"
                            >
                              Disconnect Xero
                            </button>
                            <button
                              onClick={() => handleAction('deleteTenant', { tenantId: t.id })}
                              disabled={isCurrent || actionLoading !== null}
                              className="rounded border border-transparent bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
                              title={isCurrent ? "Cannot delete the active logged-in tenant" : "Delete tenant"}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* USERS MANAGEMENT */}
          <div className="rounded-xl border bg-card">
            <div className="border-b px-6 py-4">
              <h3 className="text-sm font-bold">Users Directory</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Users registered. Registered users must map to an active tenant.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="px-6 py-3">User ID</th>
                    <th className="px-6 py-3">Email Address</th>
                    <th className="px-6 py-3">Tenant ID</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {data?.users.map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="px-6 py-3 font-mono font-bold">{u.id}</td>
                      <td className="px-6 py-3 font-medium">{u.email}</td>
                      <td className="px-6 py-3 font-mono text-muted-foreground">{u.tenant_id}</td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleAction('deleteUser', { userId: u.id })}
                          disabled={actionLoading !== null}
                          className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3 w-3" /> Delete User
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
