"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Bot,
  Mail,
  ShieldAlert,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  Search,
  FileText,
  DollarSign,
  TrendingUp,
  X,
  RefreshCw,
  Sparkles,
  Check,
  Cpu,
  ShieldCheck,
  Calculator,
  Receipt,
  Play,
  Activity,
  Plus,
  ArrowUpRight,
  MoreVertical,
  Grid,
  List,
  ChevronDown,
  ArrowLeft,
  SlidersHorizontal,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Custom HD Brand Integration Badges matching reference image
const XeroBadge = () => (
  <div className="flex items-center gap-1 bg-white/95 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 border border-white/40" title="Xero Ledger API">
    <svg className="h-3 w-3 fill-[#00b7e2]" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.8 17.4l-3.6-3.6 1.4-1.4 2.2 2.2 6.2-6.2 1.4 1.4-7.6 7.6z"/>
    </svg>
    <span>Xero</span>
  </div>
);

const GmailBadge = () => (
  <div className="flex items-center gap-1 bg-white/95 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 border border-white/40" title="Gmail Inbox">
    <svg className="h-3 w-3" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
    <span>Gmail</span>
  </div>
);

const WhatsAppBadge = () => (
  <div className="flex items-center gap-1 bg-white/95 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 border border-white/40" title="WhatsApp API">
    <svg className="h-3 w-3 fill-emerald-500" viewBox="0 0 24 24">
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.76.459 3.477 1.332 4.992l-1.417 5.176 5.298-1.389c1.458.795 3.099 1.213 4.772 1.214h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.668-1.039-5.176-2.926-7.062a9.923 9.923 0 0 0-7.058-2.932z"/>
    </svg>
    <span>WhatsApp</span>
  </div>
);

const SlackBadge = () => (
  <div className="flex items-center gap-1 bg-white/95 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 border border-white/40" title="Slack Webhooks">
    <svg className="h-3 w-3 fill-purple-600" viewBox="0 0 24 24">
      <path d="M6 15a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3h3v3zm1.5 0a3 3 0 0 1 3-3 3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V15z"/>
    </svg>
    <span>Slack</span>
  </div>
);

const StripeBadge = () => (
  <div className="flex items-center gap-1 bg-white/95 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm shrink-0 border border-white/40" title="Stripe Connect">
    <svg className="h-3 w-3 fill-indigo-600" viewBox="0 0 24 24">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C17.766.757 15.228 0 12.355 0 6.643 0 2.68 2.94 2.68 7.558c0 5.438 6.945 6.02 6.945 9.123 0 1.05-.806 1.481-2.172 1.481-2.52 0-5.467-1.163-7.24-2.215L0 21.498C2.028 22.8 5.105 24 8.291 24c6.147 0 10.165-2.885 10.165-7.614 0-5.87-7.165-6.398-7.165-9.336 0-.66.444-1.022 1.34-1.022.9 0 2.457.24 3.738.79l-2.393-7.666z"/>
    </svg>
    <span>Stripe</span>
  </div>
);

interface WorkflowItem {
  id: string;
  title: string;
  category: 'AR & Chasing' | 'Bookkeeping & AI Audit' | 'Cash & Liquidity' | 'Tax & Compliance' | 'FX & Currency';
  headerGradient: string;
  headerIcon: React.ComponentType<any>;
  headerIconBg: string;
  headerIconColor: string;
  offerBadge: string;
  badgeStyle: string;
  description: string;
  highlights: string[];
  hoursSaved: string;
  yieldStat: string;
  isActive: boolean;
  appBadges: React.ComponentType<any>[];
  triggers: string[];
  sampleMessage?: string;
}

export default function AutomationWorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Workflows');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Popular');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);

  const [activeWorkflowsState, setActiveWorkflowsState] = useState<Record<string, boolean>>({
    'chasing-1': true,
    'audit-2': true,
    'recon-3': true,
    'receipt-5': true
  });

  const workflows: WorkflowItem[] = [
    {
      id: 'chasing-1',
      title: 'AI Client Payment Chaser & AR Collector',
      category: 'AR & Chasing',
      headerGradient: 'from-[#0070f3] via-[#0088ff] to-[#00a8ff]',
      headerIcon: Mail,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '🔥 POPULAR',
      badgeStyle: 'bg-amber-400 text-slate-950 font-black',
      description: 'Automatically detects overdue sales invoices and dispatches multi-tier Email & WhatsApp payment reminders based on customer risk scoring.',
      highlights: [
        'Multi-Tier Email & WhatsApp Reminder Flow',
        'Auto-Pauses Reminders on Invoice Clearance',
        'Smart Customer Risk Tier Payment Scoring'
      ],
      hoursSaved: '14 hrs/mo',
      yieldStat: '99.4% Collection Yield',
      isActive: !!activeWorkflowsState['chasing-1'],
      appBadges: [XeroBadge, GmailBadge, WhatsAppBadge],
      triggers: [
        'Triggers when Xero Sales Invoice is 3+ days overdue',
        'AI analyzes payment history & applies friendly or strict tone',
        'Dispatches Email + WhatsApp link with 1-click Pay Now',
        'Auto-pauses reminders immediately upon payment detection'
      ],
      sampleMessage: 'Hi {{ContactName}}, friendly reminder that invoice #{{InvoiceNumber}} for {{AmountDue}} was due on {{DueDate}}. Click here to clear instantly: {{PayLink}}'
    },
    {
      id: 'audit-2',
      title: '24/7 Ledger Anomaly & Error Audit Bot',
      category: 'Bookkeeping & AI Audit',
      headerGradient: 'from-[#6366f1] via-[#7c3aed] to-[#4f46e5]',
      headerIcon: Bot,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '🛡️ AUDIT SHIELD',
      badgeStyle: 'bg-purple-100 text-purple-900 font-black',
      description: 'Continuously audits general ledger entries for miscoded account codes, duplicate vendor bills, price surges, and missing VAT receipts.',
      highlights: [
        'Scans 100% of General Ledger Transactions',
        'Flags Duplicate Vendor Bills & Price Spikes',
        'Instant Slack Alerts with 1-Click Correction'
      ],
      hoursSaved: '8 hrs/mo',
      yieldStat: '99.8% Audit Precision',
      isActive: !!activeWorkflowsState['audit-2'],
      appBadges: [XeroBadge, SlackBadge],
      triggers: [
        'Scans newly approved Xero bills & bank payments hourly',
        'Flags transactions >2.5x historical average for same vendor',
        'Detects missing tax receipts or incorrect VAT rates',
        'Posts instant Slack alert to CFO with 1-click correction button'
      ]
    },
    {
      id: 'recon-3',
      title: 'Smart Auto-Bank Reconciliation Engine',
      category: 'Bookkeeping & AI Audit',
      headerGradient: 'from-[#10b981] via-[#059669] to-[#047857]',
      headerIcon: Cpu,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '⚡ AUTO-MATCH',
      badgeStyle: 'bg-emerald-300 text-slate-950 font-black',
      description: 'Matches incoming bank statement lines against open invoices and bills automatically using transaction fingerprinting.',
      highlights: [
        'Daily Midnight Bank Feed Sync & Match',
        'Fuzzy String & Amount Matching (>98%)',
        'Auto-Reconciles High-Confidence Receipts'
      ],
      hoursSaved: '12 hrs/mo',
      yieldStat: '98.9% Auto-Match',
      isActive: !!activeWorkflowsState['recon-3'],
      appBadges: [XeroBadge, StripeBadge],
      triggers: [
        'Pulls raw bank statement feeds every midnight',
        'Matches exact amount + fuzzy vendor name strings',
        'Auto-reconciles high-confidence matches (>98%)',
        'Queues remaining uncertain items into CFO One-Click Review'
      ]
    },
    {
      id: 'fx-4',
      title: 'Multi-Currency FX Margin Sentinel',
      category: 'FX & Currency',
      headerGradient: 'from-[#f59e0b] via-[#d97706] to-[#b45309]',
      headerIcon: DollarSign,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '💱 FX GUARD',
      badgeStyle: 'bg-amber-100 text-amber-900 font-extrabold',
      description: 'Monitors foreign currency swings across USD, GBP, EUR, & INR ledgers and alerts CFOs when exchange rate volatility impacts gross margins.',
      highlights: [
        '24/7 Live Mid-Market Exchange Rate Ticks',
        'Calculates Unrealized FX Gains & Losses',
        'Automated Margin Risk Warning Alerts'
      ],
      hoursSaved: '5 hrs/mo',
      yieldStat: 'Real-Time FX Feed',
      isActive: !!activeWorkflowsState['fx-4'],
      appBadges: [StripeBadge, XeroBadge],
      triggers: [
        'Monitors live mid-market exchange rate ticks 24/7',
        'Calculates unrealized FX gain/loss across foreign accounts',
        'Alerts when currency variance exceeds 2.5% threshold',
        'Recommends optimal Wise auto-transfer timing for settlement'
      ]
    },
    {
      id: 'receipt-5',
      title: 'Mailbox Receipt OCR & Policy Enforcer',
      category: 'Bookkeeping & AI Audit',
      headerGradient: 'from-[#0284c7] via-[#0369a1] to-[#075985]',
      headerIcon: Receipt,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '🧾 OCR SCANNER',
      badgeStyle: 'bg-sky-100 text-sky-900 font-extrabold',
      description: 'Scans executive Gmail inboxes for PDF receipts, extracts line items using OCR, and flags non-compliant expense claims automatically.',
      highlights: [
        'Automatic Mailbox Attachment Ingestion',
        'Parses Dates, Vendors & Itemized Totals',
        'Flags Weekend Spends & Policy Breaches'
      ],
      hoursSaved: '9 hrs/mo',
      yieldStat: '97.6% OCR Precision',
      isActive: !!activeWorkflowsState['receipt-5'],
      appBadges: [GmailBadge, XeroBadge],
      triggers: [
        'Ingests email attachments from receipts@organization.com',
        'Parses date, vendor, tax ID, and line-item totals',
        'Flags weekend transactions or unapproved vendor categories',
        'Creates draft Xero Spend Money transaction automatically'
      ]
    },
    {
      id: 'runway-6',
      title: 'Cash Runway Early Warning System',
      category: 'Cash & Liquidity',
      headerGradient: 'from-[#e11d48] via-[#be123c] to-[#9f1239]',
      headerIcon: TrendingUp,
      headerIconBg: 'bg-white/20 border border-white/30',
      headerIconColor: 'text-white',
      offerBadge: '🚀 RUNWAY SENTINEL',
      badgeStyle: 'bg-rose-100 text-rose-900 font-extrabold',
      description: 'Simulates daily 13-week cash projections against AR/AP schedules and triggers warning alerts 45 days before any cash floor breach.',
      highlights: [
        'Daily Monte Carlo Liquidity Stress-Testing',
        'Incorporates Historical Customer Payment Delays',
        '45-Day Advance Zero-Cash Runway Notice'
      ],
      hoursSaved: '6 hrs/mo',
      yieldStat: '45-Day Buffer',
      isActive: !!activeWorkflowsState['runway-6'],
      appBadges: [XeroBadge, SlackBadge],
      triggers: [
        'Runs daily Monte Carlo cash flow forecasting models',
        'Factors in historical customer payment delay percentages',
        'Triggers warning if projected cash drops below £15,000 threshold',
        'Generates emergency cash preservation action recommendations'
      ]
    }
  ];

  const handleToggleWorkflow = (id: string, title: string) => {
    const nextState = !activeWorkflowsState[id];
    setActiveWorkflowsState(prev => ({ ...prev, [id]: nextState }));

    if (nextState) {
      toast.success(`${title} Activated!`, {
        description: 'Workflow is now running actively in your Xero workspace.'
      });
    } else {
      toast.info(`${title} Paused`, {
        description: 'Workflow has been paused.'
      });
    }
  };

  const categoryPills = [
    { name: 'All Workflows', count: 10 },
    { name: 'AR & Chasing', count: 2 },
    { name: 'Bookkeeping & AI Audit', count: 2 },
    { name: 'Cash & Liquidity', count: 2 },
    { name: 'Tax & Compliance', count: 1 },
    { name: 'FX & Currency', count: 1 },
  ];

  const filteredWorkflows = workflows.filter(w => {
    const matchesCategory = selectedCategory === 'All Workflows' || w.category === selectedCategory;
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? w.isActive : !w.isActive);
    const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          w.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const activeCount = Object.values(activeWorkflowsState).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header Banner matching reference design */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-[#f7fafc] border border-slate-200/80 p-6 lg:p-7 rounded-3xl shadow-3xs relative overflow-hidden">
        {/* Glow & Soft Shapes */}
        <div className="absolute right-32 top-0 w-80 h-80 bg-gradient-to-br from-cyan-400/10 via-purple-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Link href="/overview" className="hover:text-slate-700 flex items-center gap-1 transition">
              <ArrowLeft className="h-3.5 w-3.5" /> Automation
            </Link>
          </div>

          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Automation Workflows
          </h1>
          <p className="text-sm font-medium text-[#8a99ad]">
            Configure automatic bank reconciliation, AI client chasing, and email reminders.
          </p>
        </div>

        {/* Right Side Illustration & Usage Ring Card */}
        <div className="flex items-center gap-4 relative z-10 shrink-0">
          {/* Abstract 3D Automation Nodes Banner */}
          <div className="hidden xl:flex h-24 w-60 rounded-2xl bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-cyan-400/20 border border-blue-400/20 p-3 items-center justify-center relative overflow-hidden shadow-2xs">
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-10 w-10 rounded-xl bg-white shadow-md flex items-center justify-center text-blue-600">
                <Zap className="h-5 w-5 fill-blue-600" />
              </div>
              <div className="h-0.5 w-6 bg-blue-400/40 rounded-full" />
              <div className="h-10 w-10 rounded-xl bg-white shadow-md flex items-center justify-center text-purple-600">
                <Cpu className="h-5 w-5" />
              </div>
              <div className="h-0.5 w-6 bg-purple-400/40 rounded-full" />
              <div className="h-10 w-10 rounded-xl bg-white shadow-md flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Usage Ring Indicator */}
          <div className="bg-white p-3.5 px-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Workflow Usage</span>
              <div className="text-lg font-black text-slate-900">72.5 / 100 hrs</div>
              <span className="text-[10px] font-bold text-slate-400">Monthly Usage</span>
            </div>

            {/* Circular Progress Indicator matching screenshot */}
            <div className="relative h-12 w-12 flex items-center justify-center">
              <svg className="h-12 w-12 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#00b7e2]"
                  strokeDasharray="73, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-black text-slate-900">73%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metric Summary Row (4 Ultra-Clean White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workflows Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Workflows</span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">10</div>
            <div className="text-[11px] font-bold text-slate-500">
              <span className="text-emerald-600 font-extrabold">{activeCount} Active</span> • {10 - activeCount} Paused
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#00b7e2]">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        {/* Time Saved Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Time Saved</span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">72.5 hrs / mo</div>
            <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> 34% vs last month
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Success Rate</span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">98.7%</div>
            <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> +0.8% improvement
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Est. Cost Savings Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Est. Cost Savings</span>
            <div className="text-2xl font-black text-slate-900 tracking-tight">$1,240 / mo</div>
            <div className="text-[11px] font-bold text-slate-500">Based on automation</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Category Filter & Controls Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Category Filter Pills matching screenshot */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 no-scrollbar">
          {categoryPills.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer shrink-0 flex items-center gap-1.5 border",
                selectedCategory === cat.name
                  ? "bg-[#0070f3] text-white border-[#0070f3] shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              <span>{cat.name}</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                selectedCategory === cat.name ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Right Tools: View Toggle, Sort, Status, Search */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Grid / List Switcher */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition cursor-pointer", viewMode === 'grid' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700")}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-lg transition cursor-pointer", viewMode === 'list' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="Popular">Sort: Popular</option>
              <option value="Name">Sort: Name</option>
              <option value="TimeSaved">Sort: Time Saved</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white pl-3 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Active">Status: Active</option>
              <option value="Paused">Status: Paused</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-56 shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search automations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0070f3] text-slate-900 shadow-2xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Offer Cards Grid matching screenshot pixel-for-pixel */}
      <div className={cn("grid gap-6", viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
        {filteredWorkflows.map((item) => {
          const isActive = !!activeWorkflowsState[item.id];
          const HeaderIcon = item.headerIcon;

          return (
            <div
              key={item.id}
              className={cn(
                "group bg-white rounded-3xl border overflow-hidden shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative border-slate-200/90 hover:border-slate-300"
              )}
            >
              <div>
                {/* GRADIENT TOP BANNER */}
                <div className={cn("p-4 text-white bg-gradient-to-r relative", item.headerGradient)}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-xl flex items-center justify-center shadow-xs", item.headerIconBg, item.headerIconColor)}>
                        <HeaderIcon className="h-4 w-4" />
                      </div>
                      {/* Offer Badge Pill */}
                      <span className={cn("px-2.5 py-0.5 text-[9px] rounded-full uppercase tracking-wider shadow-2xs", item.badgeStyle)}>
                        {item.offerBadge}
                      </span>
                    </div>

                    {/* Integrated Apps Stack */}
                    <div className="flex items-center gap-1">
                      {item.appBadges.map((BadgeComp, idx) => (
                        <BadgeComp key={idx} />
                      ))}
                    </div>
                  </div>

                  <h3 className="text-base font-black text-white leading-tight tracking-tight drop-shadow-xs">
                    {item.title}
                  </h3>
                </div>

                {/* CARD BODY CONTENT */}
                <div className="p-5 space-y-4">
                  {/* Subtitle Description */}
                  <p className="text-xs text-slate-600 leading-relaxed font-medium min-h-[36px]">
                    {item.description}
                  </p>

                  {/* Bullet Highlights List with Checkmarks */}
                  <div className="space-y-1.5 pt-1">
                    {item.highlights.map((h, hIdx) => (
                      <div key={hIdx} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#0070f3] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>

                  {/* Yield & Hours Stat Bar */}
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-bold">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#0070f3]" /> Saves {item.hoursSaved}
                    </span>
                    <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> {item.yieldStat}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD FOOTER ACTION BAR matching screenshot */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                {/* Active/Paused Status Indicator */}
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
                  <span className={cn("text-xs font-extrabold", isActive ? "text-emerald-700" : "text-amber-700")}>
                    {isActive ? 'Active' : 'Paused'}
                  </span>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedWorkflow(item)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                  >
                    View Details
                  </button>

                  <button
                    onClick={() => handleToggleWorkflow(item.id, item.title)}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs",
                      isActive
                        ? "bg-[#0070f3] hover:bg-[#0060d0] text-white"
                        : "bg-rose-500 hover:bg-rose-600 text-white"
                    )}
                  >
                    {isActive ? 'Edit Workflow' : 'Resume'}
                  </button>

                  <button
                    onClick={() => handleToggleWorkflow(item.id, item.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Workflow Details Modal */}
      {selectedWorkflow && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden space-y-0">
            {/* Modal Header */}
            <div className={cn("p-6 text-white bg-gradient-to-r relative flex items-start justify-between gap-4", selectedWorkflow.headerGradient)}>
              <div className="space-y-1">
                <span className={cn("px-2.5 py-0.5 text-[9px] rounded-full uppercase tracking-wider", selectedWorkflow.badgeStyle)}>
                  {selectedWorkflow.offerBadge}
                </span>
                <h2 className="text-xl font-black text-white mt-1">{selectedWorkflow.title}</h2>
                <p className="text-xs text-white/90 font-medium">{selectedWorkflow.description}</p>
              </div>

              <button onClick={() => setSelectedWorkflow(null)} className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto text-xs">
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-[#0070f3]" /> Automation Execution Pipeline Sequence
                </h4>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 font-medium text-slate-700">
                  {selectedWorkflow.triggers.map((trig, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-[#0070f3] text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        {idx + 1}
                      </div>
                      <span className="mt-0.5">{trig}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedWorkflow.sampleMessage && (
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-purple-600" /> Automated Message Template
                  </h4>
                  <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl text-xs font-mono">
                    {selectedWorkflow.sampleMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-bold">
                Impact: <span className="text-slate-900">Saves {selectedWorkflow.hoursSaved}</span> • <span className="text-emerald-600">{selectedWorkflow.yieldStat}</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedWorkflow(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl">
                  Close
                </button>
                <button
                  onClick={() => {
                    handleToggleWorkflow(selectedWorkflow.id, selectedWorkflow.title);
                    setSelectedWorkflow(null);
                  }}
                  className={cn(
                    "px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs",
                    activeWorkflowsState[selectedWorkflow.id]
                      ? "bg-slate-900 hover:bg-slate-800 text-white"
                      : "bg-[#0070f3] hover:bg-[#0060d0] text-white font-black"
                  )}
                >
                  {activeWorkflowsState[selectedWorkflow.id] ? (
                    <>
                      <Unlock className="h-4 w-4" /> Pause Workflow
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Activate Workflow
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
