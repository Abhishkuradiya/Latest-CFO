"use client";

import React from 'react';
import { ShieldCheck, Search, Lock, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminAuditLogsPage() {
  const logs = [
    { id: 'log-501', time: '10 mins ago', action: 'Tenant Impersonation', actor: 'admin@virtualcfo.com', details: 'Started authorized support session for "TechNova Solutions"', ip: '182.73.11.45', status: 'Logged' },
    { id: 'log-502', time: '1 hour ago', action: '2FA Verification Success', actor: 'admin@virtualcfo.com', details: 'Completed TOTP 2FA code verification for Super Admin', ip: '182.73.11.45', status: 'Success' },
    { id: 'log-503', time: '3 hours ago', action: 'Tenant Plan Upgrade', actor: 'Billing Engine', details: 'Upgraded BrightFlow Ltd. to Business Plan (₹49,990/mo)', ip: 'Internal System', status: 'Success' },
    { id: 'log-504', time: '6 hours ago', action: 'Integration Key Rotated', actor: 'admin@greenleaf.in', details: 'Refreshed OAuth 2.0 access token for Xero Accounting API', ip: '49.36.19.12', status: 'Success' },
    { id: 'log-505', time: '12 hours ago', action: 'Database Backup Completed', actor: 'Cron Engine', details: 'PostgreSQL database snapshot saved successfully', ip: '127.0.0.1', status: 'Success' },
  ];

  return (
    <div className="space-y-6 select-none pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          Security Audit Logs & Compliance Stream
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Immutable security event records, impersonation trails, 2FA verifications, and system configuration mutations.</p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{l.time}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{l.action}</td>
                  <td className="py-3.5 px-4 font-medium text-blue-600">{l.actor}</td>
                  <td className="py-3.5 px-4 text-slate-700">{l.details}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{l.ip}</td>
                  <td className="py-3.5 px-4 text-right"><span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
