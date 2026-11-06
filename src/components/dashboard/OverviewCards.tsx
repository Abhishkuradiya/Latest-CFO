"use client";

import React, { useState } from 'react';
import { MoreVertical, ExternalLink, Globe, Landmark, Calendar, DollarSign, Fingerprint, RefreshCw, FileText, ArrowRight, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './KpisWidget';

// --- TYPE INTERFACES ---

export interface OrganisationInfo {
  Name: string;
  OrganisationStatus: string;
  BaseCurrency: string;
  CountryCode: string;
  OrganisationID: string;
  FinancialYearEndDay?: number;
  FinancialYearEndMonth?: number;
}

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  balance: number;
  currency: string;
  status: 'healthy' | 'attention' | 'disconnected';
  pending_reconciliation: number | null;
}

export interface BankOverviewData {
  total_accounts: number;
  healthy_accounts: number;
  attention_accounts: number;
  disconnected_accounts: number;
  total_balance: number;
  as_of_date?: string;
  last_sync: string;
  accounts: BankAccount[];
}

export interface InvoiceStatusSummary {
  draft: number;
  submitted: number;
  authorised: number;
  paid: number;
}

export interface BillStatusSummary {
  draft: number;
  submitted: number;
  authorised: number;
  paid: number;
}

// Helper to format currency
const formatCurrencyValue = (val: number, curr: string) => {
  const symbol = curr === 'INR' ? '₹' : (curr === 'GBP' ? '£' : (curr === 'USD' ? '$' : `${curr} `));
  return symbol + Math.abs(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Helper for formatting time ago
const formatTimeAgo = (dateStr: string | null) => {
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


// ==================================================
// CARD 1: OrganizationDetailsCard
// ==================================================

interface OrgCardProps {
  organisation: OrganisationInfo | null;
  lastSync: string | null;
  loading: boolean;
}

export function OrganizationDetailsCard({ organisation, lastSync, loading }: OrgCardProps) {
  const getCountryName = (code?: string) => {
    if (!code) return '—';
    const countries: Record<string, string> = {
      'IN': 'India', 'US': 'United States', 'GB': 'United Kingdom',
      'AU': 'Australia', 'NZ': 'New Zealand', 'SG': 'Singapore', 'CA': 'Canada'
    };
    return countries[code.toUpperCase()] || code;
  };

  const getFinancialYearRange = (endDay?: number, endMonth?: number) => {
    if (!endMonth) return 'Apr 2024 - Mar 2025';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const endMonthName = months[endMonth - 1];
    const startMonthIndex = endMonth === 12 ? 0 : endMonth;
    const startMonthName = months[startMonthIndex];
    const currentYear = new Date().getFullYear();
    if (endMonth === 12) return `Jan ${currentYear} - Dec ${currentYear}`;
    return `${startMonthName} ${currentYear} - ${endMonthName} ${currentYear + 1}`;
  };

  if (loading) return <CardSkeleton />;

  if (!organisation) return <CardEmptyState title="No Organization Connected" desc="Connect Xero to show organization profile details." />;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-[#0064eb]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Organization Details</h3>
          <Tooltip text="Profile, currency & financial year configuration synced from Xero ledger." />
        </div>
        <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
      </div>

      <div className="py-2.5 flex items-center justify-between gap-3 shrink-0">
        <h4 className="font-extrabold text-slate-800 text-[14px] leading-tight truncate flex-1" title={organisation.Name}>
          {organisation.Name}
        </h4>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200/50">
          {organisation.OrganisationStatus || 'ACTIVE'}
        </span>
      </div>

      <div className="flex-1 space-y-2.5 pt-1">
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Base Currency</span>
          <span className="font-bold text-slate-700 uppercase">{organisation.BaseCurrency || 'USD'}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Financial Year</span>
          <span className="font-bold text-slate-700 text-right">{getFinancialYearRange(organisation.FinancialYearEndDay, organisation.FinancialYearEndMonth)}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Country</span>
          <span className="font-bold text-slate-700">{getCountryName(organisation.CountryCode)}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" />Organization ID</span>
          <span className="font-bold text-slate-700 text-[9.5px] select-all truncate max-w-[110px]" title={organisation.OrganisationID}>{organisation.OrganisationID}</span>
        </div>
        <div className="flex justify-between items-center text-[10.5px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" />Last Sync</span>
          <span className="font-bold text-slate-700">{formatTimeAgo(lastSync)}</span>
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <a href="https://my.xero.com" target="_blank" rel="noopener noreferrer" className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition">
          <span>View Organization</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}


// ==================================================
// CARD 2: ConnectedBankAccountsCard
// ==================================================

interface BankCardProps {
  data: BankOverviewData | null;
  loading: boolean;
  onRefresh?: () => void;
  onManageConnections?: () => void;
}

export function ConnectedBankAccountsCard({ data, loading, onRefresh, onManageConnections }: BankCardProps) {
  if (loading) return <CardSkeleton />;

  if (!data || data.total_accounts === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px] hover:shadow-xs transition duration-300">
        <Landmark className="h-8 w-8 text-slate-350 mb-3 stroke-[1.5]" />
        <h4 className="text-[12.5px] font-bold text-slate-700 mb-0.5">No Bank Feeds connected</h4>
        <p className="text-[10px] text-slate-400 max-w-[190px] mb-4">Add bank credentials via settings config to import feed rows.</p>
        <button onClick={onManageConnections} className="px-3.5 py-2 bg-[#0064eb] text-white hover:bg-blue-600 text-[10px] font-bold tracking-wider rounded uppercase transition">
          Connect Feeds
        </button>
      </div>
    );
  }

  // Segment values for Ring Chart
  const healthy = data.healthy_accounts;
  const attention = data.attention_accounts;
  const disconnected = data.disconnected_accounts;
  const total = data.total_accounts;

  const radius = 22;
  const strokeWidth = 5;
  const circ = 2 * Math.PI * radius;

  const hPct = total > 0 ? healthy / total : 0;
  const aPct = total > 0 ? attention / total : 0;
  const dPct = total > 0 ? disconnected / total : 0;

  const hStroke = circ * hPct;
  const aStroke = circ * aPct;
  const dStroke = circ * dPct;

  const hOffset = circ;
  const aOffset = circ - hStroke;
  const dOffset = circ - hStroke - aStroke;

  const primaryCurrency = data.accounts[0]?.currency || 'USD';

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-[#0064eb]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Connected Bank Accounts</h3>
          <Tooltip text="Liquid bank balances & pending reconciliation counts across all connected banks." />
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button onClick={onRefresh} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-50 outline-none"><RefreshCw className="h-3 w-3" /></button>
          )}
          <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-50 outline-none"><MoreVertical className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Ring Visualization & Legends Grid */}
      <div className="flex items-center justify-between py-2 shrink-0 border-b border-slate-50">
        <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
          <svg className="h-full w-full transform -rotate-90" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r={radius} stroke="#f8fafc" strokeWidth={strokeWidth} fill="none" />
            {hStroke > 0 && <circle cx="27" cy="27" r={radius} stroke="#10b981" strokeWidth={strokeWidth} strokeDasharray={`${hStroke} ${circ}`} strokeDashoffset={hOffset} strokeLinecap="round" fill="none" />}
            {aStroke > 0 && <circle cx="27" cy="27" r={radius} stroke="#f59e0b" strokeWidth={strokeWidth} strokeDasharray={`${aStroke} ${circ}`} strokeDashoffset={aOffset} strokeLinecap="round" fill="none" />}
            {dStroke > 0 && <circle cx="27" cy="27" r={radius} stroke="#ef4444" strokeWidth={strokeWidth} strokeDasharray={`${dStroke} ${circ}`} strokeDashoffset={dOffset} strokeLinecap="round" fill="none" />}
          </svg>
          <div className="absolute text-center flex flex-col items-center">
            <span className="text-[11px] font-extrabold text-slate-800 leading-none">{total}</span>
            <span className="text-[6.5px] font-bold text-slate-400 uppercase mt-0.5 leading-none">Feeds</span>
          </div>
        </div>

        <div className="flex-1 pl-4 space-y-1 text-[9.5px] font-semibold text-slate-500">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Healthy</span>
            <span className="font-bold text-slate-700">{healthy}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Attention</span>
            <span className="font-bold text-slate-700">{attention}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Disconnected</span>
            <span className="font-bold text-slate-700">{disconnected}</span>
          </div>
        </div>
      </div>

      {/* Mini Account Rows */}
      <div className="flex-1 overflow-y-auto max-h-[105px] divide-y divide-slate-100 py-1">
        {data.accounts.slice(0, 2).map((acc) => {
          const isNegative = acc.balance < 0;
          return (
            <div key={acc.id} className="flex justify-between items-center py-2 text-[10.5px]">
              <div className="min-w-0 pr-2">
                <div className="font-bold text-slate-700 truncate leading-tight">{acc.name}</div>
                <div className="text-[8px] text-slate-450 font-bold uppercase mt-0.5">CODE: {acc.bank_name || 'BANK'}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={cn("font-bold", isNegative ? "text-red-500" : "text-slate-800")}>
                  {isNegative && '-'}
                  {formatCurrencyValue(acc.balance, acc.currency)}
                </span>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  acc.status === 'healthy' ? 'bg-emerald-500' : (acc.status === 'attention' ? 'bg-amber-500' : 'bg-rose-500')
                )} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="border-t border-slate-100 pt-2 shrink-0">
        <div className="flex justify-between items-center text-[10.5px] font-bold">
          <div className="flex flex-col">
            <span className="text-slate-400 font-semibold">Total Cash Balance</span>
            <span className="text-[9px] text-[#0064eb] font-bold mt-0.5">
              {data.as_of_date || 'As at 30 Sept 2026'}
            </span>
          </div>
          <span className="text-slate-800 font-extrabold text-[12.5px]">{formatCurrencyValue(data.total_balance, primaryCurrency)}</span>
        </div>
        <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-semibold mt-1.5">
          <span>Feed Last Synced</span>
          <span>{formatTimeAgo(data.last_sync)}</span>
        </div>
        <div className="mt-3 space-y-1">
          <button onClick={onManageConnections || (() => window.location.href = '/banking/accounts')} className="w-full py-2 bg-[#0064eb] hover:bg-blue-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer">
            Manage Bank Connections
          </button>
          <a href="/banking/accounts" className="flex items-center justify-center gap-0.5 text-[9px] font-bold text-blue-600 hover:underline">
            <span>Open Banking Dashboard</span>
            <ArrowRight className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}


// ==================================================
// CARD 3: InvoiceStatusSummaryCard
// ==================================================

interface InvoiceCardProps {
  summary: InvoiceStatusSummary | null;
  loading: boolean;
  onViewAll?: () => void;
}

export function InvoiceStatusSummaryCard({ summary, loading, onViewAll }: InvoiceCardProps) {
  if (loading) return <CardSkeleton />;

  if (!summary) return <CardEmptyState title="No Invoices Data" desc="Sync with Xero ledger database to compile receivable summaries." />;

  const total = summary.draft + summary.submitted + summary.authorised + summary.paid;

  // Compute status details
  const statuses = [
    { label: 'Draft', count: summary.draft, color: 'bg-slate-350', barColor: 'bg-slate-400' },
    { label: 'Awaiting Approval', count: summary.submitted, color: 'bg-blue-350', barColor: 'bg-blue-500' },
    { label: 'Awaiting Payment', count: summary.authorised, color: 'bg-amber-350', barColor: 'bg-amber-500' },
    { label: 'Paid', count: summary.paid, color: 'bg-emerald-350', barColor: 'bg-emerald-500' }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div 
          onClick={onViewAll || (() => window.location.href = '/invoices')}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition"
        >
          <FileText className="h-4 w-4 text-[#0064eb]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Invoice Status Summary</h3>
          <Tooltip text="Live breakdown of sales invoices across Draft, Awaiting Approval, Awaiting Payment, and Paid." />
        </div>
        <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
      </div>

      <div 
        onClick={onViewAll || (() => window.location.href = '/invoices')}
        className="py-2.5 flex justify-between items-center border-b border-slate-50 shrink-0 cursor-pointer hover:opacity-80 transition"
      >
        <span className="text-[9.5px] font-bold text-slate-400 uppercase">Receivables</span>
        <span className="text-[11px] font-extrabold text-slate-800">{total} Invoices</span>
      </div>

      <div className="flex-1 space-y-2.5 py-3">
        {statuses.map((s, idx) => {
          const percentage = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div 
              key={idx} 
              onClick={() => window.location.href = `/invoices?status=${encodeURIComponent(s.label.toUpperCase())}`}
              className="space-y-1 cursor-pointer hover:bg-slate-50/80 px-1 py-1 rounded transition"
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500">{s.label}</span>
                <span className="text-slate-700">{s.count}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-50 border border-slate-100/50 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", s.barColor)} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onViewAll || (() => window.location.href = '/invoices')} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
          <span>View All Invoices</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


// ==================================================
// CARD 4: BillStatusSummaryCard
// ==================================================

interface BillCardProps {
  summary: BillStatusSummary | null;
  loading: boolean;
  onViewAll?: () => void;
}

export function BillStatusSummaryCard({ summary, loading, onViewAll }: BillCardProps) {
  if (loading) return <CardSkeleton />;

  if (!summary) return <CardEmptyState title="No Bills Data" desc="Sync with Xero ledger database to compile payable summaries." />;

  const total = summary.draft + summary.submitted + summary.authorised + summary.paid;

  // Compute status details
  const statuses = [
    { label: 'Draft Bills', count: summary.draft, color: 'bg-slate-350', barColor: 'bg-slate-400' },
    { label: 'Awaiting Approval', count: summary.submitted, color: 'bg-blue-350', barColor: 'bg-blue-500' },
    { label: 'Awaiting Payment', count: summary.authorised, color: 'bg-amber-350', barColor: 'bg-amber-500' },
    { label: 'Paid Bills', count: summary.paid, color: 'bg-emerald-350', barColor: 'bg-emerald-500' }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div 
          onClick={onViewAll || (() => window.location.href = '/bills')}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition"
        >
          <ClipboardList className="h-4 w-4 text-[#0064eb]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Bill Status Summary</h3>
          <Tooltip text="Live breakdown of vendor payables across Draft, Submitted, Authorized, and Paid." />
        </div>
        <button className="text-slate-400 hover:text-slate-600 outline-none"><MoreVertical className="h-4 w-4" /></button>
      </div>

      <div 
        onClick={onViewAll || (() => window.location.href = '/bills')}
        className="py-2.5 flex justify-between items-center border-b border-slate-50 shrink-0 cursor-pointer hover:opacity-80 transition"
      >
        <span className="text-[9.5px] font-bold text-slate-400 uppercase">Payables</span>
        <span className="text-[11px] font-extrabold text-slate-800">{total} Bills</span>
      </div>

      <div className="flex-1 space-y-2.5 py-3">
        {statuses.map((s, idx) => {
          const percentage = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div 
              key={idx} 
              onClick={() => window.location.href = `/bills?status=${encodeURIComponent(s.label.replace(' Bills', '').toUpperCase())}`}
              className="space-y-1 cursor-pointer hover:bg-slate-50/80 px-1 py-1 rounded transition"
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-500">{s.label}</span>
                <span className="text-slate-700">{s.count}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-50 border border-slate-100/50 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", s.barColor)} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onViewAll || (() => window.location.href = '/bills')} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
          <span>View All Bills</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- CARD 4: TRACKING CATEGORIES CARD (Matching Image 2 Mockup) ---
export function TrackingCategoriesCard({
  configuredCategories = 1,
  trackingOptions = 7,
  activeStatus = 'Active (1)',
  loading = false,
  onNavigate
}: {
  configuredCategories?: number;
  trackingOptions?: number;
  activeStatus?: string;
  loading?: boolean;
  onNavigate?: () => void;
}) {
  if (loading) return <CardSkeleton />;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between select-none min-h-[395px] hover:shadow-xs transition duration-300">
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <ClipboardList className="h-4 w-4" />
            </div>
            <h3 className="text-[13.5px] font-bold text-slate-800">Tracking Categories</h3>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeStatus}
          </span>
        </div>

        {/* Dimension Details */}
        <div className="mt-4 space-y-3">
          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">CONFIGURED DIMENSIONS</span>
          
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold text-slate-900">Trading Name</h4>
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-700 rounded uppercase">ACTIVE</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{trackingOptions} Tracking Options</span>

            {/* Option Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="px-2.5 py-1 text-[9.5px] font-bold bg-white border border-slate-200 text-slate-700 rounded-md uppercase">GENERAL</span>
              <span className="px-2.5 py-1 text-[9.5px] font-bold bg-white border border-slate-200 text-slate-700 rounded-md uppercase">GWL</span>
              <span className="px-2.5 py-1 text-[9.5px] font-bold bg-white border border-slate-200 text-slate-700 rounded-md uppercase">Missing Invoice</span>
              <span className="px-2 py-1 text-[9.5px] font-extrabold text-blue-600 bg-blue-50 rounded-md">+4 More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Details & Action Button */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-3 border-t border-slate-100 pt-3">
          <span>Configured Categories: <b className="text-slate-800">{configuredCategories}</b></span>
          <span>Tracking Options: <b className="text-slate-800">{trackingOptions}</b></span>
        </div>

        <a
          href="/tracking-categories"
          className="w-full py-2.5 px-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span>Manage Tracking</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}


// --- SUPPORT HELPER COMPONENTS ---

function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-4 animate-pulse select-none min-h-[395px] flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="h-4 w-28 bg-slate-100 rounded" />
        <div className="h-4 w-4 bg-slate-100 rounded" />
      </div>
      <div className="space-y-3 flex-1 pt-2">
        <div className="h-4.5 w-40 bg-slate-100 rounded" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <div className="h-9 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

function CardEmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px] hover:shadow-xs transition duration-300">
      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-400 mb-3">
        <Globe className="h-4.5 w-4.5 stroke-[1.5]" />
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal">{desc}</p>
    </div>
  );
}
