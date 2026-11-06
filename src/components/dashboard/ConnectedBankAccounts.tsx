"use client";

import React, { useState, useEffect } from 'react';
import { MoreVertical, Landmark, RefreshCw, ArrowRight, CheckCircle2, AlertCircle, HelpCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// TS Interfaces
export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  balance: number;
  currency: string;
  status: 'healthy' | 'attention' | 'disconnected';
  pending_reconciliation: number;
}

export interface BankOverviewData {
  total_accounts: number;
  healthy_accounts: number;
  attention_accounts: number;
  disconnected_accounts: number;
  total_balance: number;
  last_sync: string;
  accounts: BankAccount[];
}

// 1. BankStatusBadge Component with tooltips
export function BankStatusBadge({ status, pending }: { status: 'healthy' | 'attention' | 'disconnected'; pending: number }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
          dot: 'bg-emerald-500',
          label: 'Healthy',
          tooltip: 'No reconciliation issues found. Bank feeds operational.'
        };
      case 'attention':
        return {
          color: 'bg-amber-50 text-amber-700 border-amber-200/50',
          dot: 'bg-amber-500',
          label: `${pending} Pending`,
          tooltip: `Pending reconciliation. ${pending} transaction statement lines to reconcile.`
        };
      case 'disconnected':
        return {
          color: 'bg-rose-50 text-rose-700 border-rose-200/50',
          dot: 'bg-rose-500',
          label: 'Disconnected',
          tooltip: 'Bank feed is disconnected. Re-authorization required.'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold border select-none cursor-help transition",
          config.color
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
        {config.label}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 text-white text-[9.5px] font-bold p-2 rounded-lg shadow-md z-30 leading-normal pointer-events-none animate-in fade-in-100 slide-in-from-bottom-1">
          <div className="relative">
            {config.tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}

// 2. CircularChart Component
export function CircularChart({
  total,
  healthy,
  attention,
  disconnected
}: {
  total: number;
  healthy: number;
  attention: number;
  disconnected: number;
}) {
  // SVG Ring Settings
  const radius = 34;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  // Calculate segment lengths
  const healthyPct = total > 0 ? healthy / total : 0;
  const attentionPct = total > 0 ? attention / total : 0;
  const disconnectedPct = total > 0 ? disconnected / total : 0;

  const healthyStroke = circumference * healthyPct;
  const attentionStroke = circumference * attentionPct;
  const disconnectedStroke = circumference * disconnectedPct;

  // Calculate offsets for stacking segments in ring
  const healthyOffset = circumference;
  const attentionOffset = circumference - healthyStroke;
  const disconnectedOffset = circumference - healthyStroke - attentionStroke;

  return (
    <div className="relative flex items-center justify-center h-24 w-24 select-none shrink-0">
      <svg className="h-full w-full transform -rotate-90" viewBox="0 0 80 80">
        {/* Base light track */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Healthy Segment (Green) */}
        {healthyStroke > 0 && (
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${healthyStroke} ${circumference}`}
            strokeDashoffset={healthyOffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        )}

        {/* Attention Segment (Orange) */}
        {attentionStroke > 0 && (
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${attentionStroke} ${circumference}`}
            strokeDashoffset={attentionOffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        )}

        {/* Disconnected Segment (Red) */}
        {disconnectedStroke > 0 && (
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            strokeDasharray={`${disconnectedStroke} ${circumference}`}
            strokeDashoffset={disconnectedOffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>
      {/* Center Label */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[15px] font-extrabold text-slate-800 leading-none">{total}</span>
        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Accounts</span>
      </div>
    </div>
  );
}

// 3. SummaryRow Component
export function SummaryRow({ totalBalance, currency }: { totalBalance: number; currency: string }) {
  const formatBalance = (val: number, curr: string) => {
    const symbol = curr === 'INR' ? '₹' : (curr === 'USD' ? '$' : `${curr} `);
    return symbol + val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="flex items-center justify-between py-2 border-t border-slate-100/80 mt-4 select-none shrink-0">
      <div>
        <span className="text-[9.5px] font-semibold text-slate-400 block">Total Cash Balance</span>
        <span className="text-[14px] font-extrabold text-slate-800 tracking-tight">
          {formatBalance(totalBalance, currency)}
        </span>
      </div>
    </div>
  );
}

// 4. BankAccountRow Component
export function BankAccountRow({ account }: { account: BankAccount }) {
  const isNegative = account.balance < 0;
  
  const formatBalance = (val: number, curr: string) => {
    const symbol = curr === 'INR' ? '₹' : (curr === 'USD' ? '$' : `${curr} `);
    return symbol + Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50/70 border border-transparent hover:border-slate-100 transition duration-150 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-7 w-7 rounded-lg bg-slate-50 border border-slate-200/50 flex items-center justify-center text-slate-500 shrink-0">
          <Landmark className="h-4 w-4 stroke-[1.8]" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-700 text-[11px] truncate leading-tight">
            {account.name}
          </span>
          <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 leading-none">
            {account.bank_name}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className={cn(
          "font-bold text-[11px]",
          isNegative ? "text-red-500" : "text-slate-800"
        )}>
          {isNegative && '-'}
          {formatBalance(account.balance, account.currency)}
        </span>
        <BankStatusBadge status={account.status} pending={account.pending_reconciliation} />
      </div>
    </div>
  );
}

// 5. ActionButton Component
export function ActionButton({
  label,
  onClick,
  disabled
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 px-4 bg-[#0064eb] hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-[10.5px] font-bold tracking-wider uppercase transition cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
    >
      <span>{label}</span>
    </button>
  );
}

// MAIN WIDGET COMPONENT
export default function ConnectedBankAccounts({ onManageConnections }: { onManageConnections?: () => void }) {
  const [data, setData] = useState<BankOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBankOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bank-overview');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      toast.error('Failed to sync bank connections overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankOverview();
    
    // Listen for custom global sync events to refresh data
    const handleSyncComplete = () => {
      fetchBankOverview();
    };
    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
  }, []);

  // Format Time Ago
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Never synced';
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  // Skeleton Loader Component
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-pulse select-none min-h-[380px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-4 w-4 bg-slate-100 rounded" />
        </div>

        <div className="flex items-center justify-center gap-6 py-2">
          <div className="h-20 w-20 bg-slate-100 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        </div>

        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex justify-between items-center py-2">
              <div className="flex gap-2">
                <div className="h-6 w-6 bg-slate-100 rounded" />
                <div className="space-y-1">
                  <div className="h-3.5 w-24 bg-slate-100 rounded" />
                  <div className="h-2 w-12 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="h-8 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty State Component
  if (!data || data.total_accounts === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[380px] transition duration-350 hover:shadow-sm">
        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 shadow-3xs flex items-center justify-center text-slate-400 mb-4 animate-bounce">
          <Landmark className="h-5 w-5 stroke-[1.5]" />
        </div>
        <h3 className="text-[13px] font-bold text-slate-700 mb-1">No Bank Accounts Connected</h3>
        <p className="text-[10.5px] text-slate-400 max-w-[220px] mb-5 leading-normal">
          Connect your Xero account and set up client feeds to import your bank records.
        </p>
        <button
          onClick={onManageConnections}
          className="px-4 py-2.5 bg-[#0064eb] hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
        >
          Connect Bank Account
        </button>
      </div>
    );
  }

  const primaryCurrency = data.accounts[0]?.currency || 'USD';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-sm transition duration-300 flex flex-col justify-between select-none min-h-[380px]">
      {/* Header Block */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-blue-600" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Connected Bank Accounts</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchBankOverview}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-md hover:bg-slate-50 outline-none"
            title="Refresh bank status"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button className="text-slate-400 hover:text-slate-600 transition p-1 rounded-md hover:bg-slate-50 outline-none">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Visual circular progress block */}
      <div className="flex flex-row items-center justify-between gap-4 py-3 shrink-0">
        <CircularChart
          total={data.total_accounts}
          healthy={data.healthy_accounts}
          attention={data.attention_accounts}
          disconnected={data.disconnected_accounts}
        />

        {/* Right Side Legends */}
        <div className="flex-1 pl-4 space-y-1.5 border-l border-slate-100">
          <div className="flex items-center justify-between text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Healthy</span>
            </span>
            <span className="text-slate-700">{data.healthy_accounts}</span>
          </div>

          <div className="flex items-center justify-between text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Needs Attention</span>
            </span>
            <span className="text-slate-700">{data.attention_accounts}</span>
          </div>

          <div className="flex items-center justify-between text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>Disconnected</span>
            </span>
            <span className="text-slate-700">{data.disconnected_accounts}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Rows Block */}
      <div className="flex-1 overflow-y-auto max-h-[140px] space-y-1.5 pr-1 py-1">
        {data.accounts.map((acc) => (
          <BankAccountRow key={acc.id} account={acc} />
        ))}
      </div>

      {/* Bottom Summary Block */}
      <div className="shrink-0">
        <SummaryRow totalBalance={data.total_balance} currency={primaryCurrency} />

        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1 select-none">
          <span>Feed Last Synced</span>
          <span>{formatTimeAgo(data.last_sync)}</span>
        </div>

        {/* Buttons Block */}
        <div className="mt-4 space-y-2">
          <ActionButton label="Manage Bank Connections" onClick={onManageConnections || (() => window.location.href = '/banking/accounts')} />
          
          <a
            href="/banking/accounts"
            className="flex items-center justify-center gap-0.5 text-[9.5px] font-bold text-blue-600 hover:text-blue-700 transition py-1 hover:underline"
          >
            <span>Open Banking Dashboard</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
