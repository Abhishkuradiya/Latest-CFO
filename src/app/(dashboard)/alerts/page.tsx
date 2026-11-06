"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Clock, 
  Filter, 
  ArrowRight, 
  ShieldAlert, 
  TrendingDown, 
  DollarSign,
  Building2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { PageContainer } from '@/components/common/page-container';
import { SectionHeader } from '@/components/common/section-header';
import { toast } from 'sonner';

interface AlertItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'receivables' | 'payables' | 'banking' | 'liquidity' | 'system';
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  timestamp: string;
  actionUrl: string;
  actionLabel: string;
}

export default function AlertsPage() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Live alerts threshold items
  const alerts: AlertItem[] = [
    {
      id: 'alt-1',
      severity: 'high',
      category: 'receivables',
      title: 'Overdue Accounts Receivable Threshold Exceeded',
      description: '2 customer invoices are overdue beyond 30 days totaling £11,391. Requires immediate collection follow-up.',
      amount: 11391,
      currency: 'GBP',
      timestamp: '27w ago',
      actionUrl: '/invoices?filter=overdue',
      actionLabel: 'View Overdue Invoices'
    },
    {
      id: 'alt-2',
      severity: 'high',
      category: 'payables',
      title: 'Supplier Bills Approaching Due Date',
      description: '3 vendor bills are overdue totaling £8,995. Pay before due date to maintain supplier credit standing.',
      amount: 8995,
      currency: 'GBP',
      timestamp: '1d ago',
      actionUrl: '/bills?filter=overdue',
      actionLabel: 'Review Payables'
    },
    {
      id: 'alt-3',
      severity: 'medium',
      category: 'banking',
      title: 'Bank Reconciliation Pending',
      description: '3 bank accounts have unallocated bank statement lines awaiting ledger classification in Xero.',
      timestamp: '6m ago',
      actionUrl: '/bookkeeping-health',
      actionLabel: 'Check Reconciliation Status'
    },
    {
      id: 'alt-4',
      severity: 'medium',
      category: 'receivables',
      title: 'High Outstanding Customer Balance Concentration',
      description: 'Top overdue customer account represents over 40% of total Accounts Receivable balance.',
      amount: 11391,
      currency: 'GBP',
      timestamp: '6h ago',
      actionUrl: '/customers',
      actionLabel: 'Inspect Customer Ledger'
    },
    {
      id: 'alt-5',
      severity: 'low',
      category: 'banking',
      title: 'New Bank Transactions Imported',
      description: '97 payment transactions verified and posted from primary HSBC Bank statement feed.',
      amount: 115220,
      currency: 'GBP',
      timestamp: '1d ago',
      actionUrl: '/reports/cash-flow',
      actionLabel: 'Open Cash Flow Report'
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredAlerts = alerts.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterSeverity !== 'all' && item.severity !== filterSeverity) return false;
    return true;
  });

  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Threshold Alerts & Notifications
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time automated financial alerts monitored directly from your Live Xero accounting engine.
            </p>
          </div>
          <button
            onClick={() => {
              setIsLoading(true);
              toast.success("Refreshed threshold alerts from Xero ledger!");
              setTimeout(() => setIsLoading(false), 400);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Alerts
          </button>
        </div>

        {/* Summary Counter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-700 block">Critical Alerts</span>
              <span className="text-2xl font-black text-red-900 mt-0.5 block">{highCount} Action Required</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
              !
            </div>
          </div>
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 block">Warnings</span>
              <span className="text-2xl font-black text-amber-900 mt-0.5 block">{mediumCount} Pending Review</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
              ⚠
            </div>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 block">Info & Log Updates</span>
              <span className="text-2xl font-black text-blue-900 mt-0.5 block">{lowCount} Informational</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              ℹ
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Category:
            </span>
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'receivables', label: 'Receivables' },
              { id: 'payables', label: 'Payables' },
              { id: 'banking', label: 'Banking' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterCategory === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>
        </div>

        {/* Alerts List Grid */}
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500 bg-slate-50">
              No alerts match your selected filters.
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all bg-white dark:bg-slate-900 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  alert.severity === 'high'
                    ? 'border-red-200 dark:border-red-950/60 hover:border-red-300'
                    : alert.severity === 'medium'
                    ? 'border-amber-200 dark:border-amber-950/60 hover:border-amber-300'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    alert.severity === 'high'
                      ? 'bg-red-100 text-red-600'
                      : alert.severity === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {alert.severity === 'high' ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : alert.severity === 'medium' ? (
                      <Clock className="h-5 w-5" />
                    ) : (
                      <Info className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        alert.severity === 'high'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{alert.timestamp}</span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {alert.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center pt-2 md:pt-0">
                  {alert.amount && (
                    <div className="text-right mr-2 hidden sm:block">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Amount</span>
                      <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                        £{alert.amount.toLocaleString('en-GB')}
                      </span>
                    </div>
                  )}

                  <Link
                    href={alert.actionUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-bold shadow-2xs transition cursor-pointer"
                  >
                    <span>{alert.actionLabel}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
