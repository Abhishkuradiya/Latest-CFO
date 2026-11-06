"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- The page renders typed JSONB snapshots from the bookkeeping API. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BookOpenCheck, Check, CheckCircle2, CircleHelp, Database, ExternalLink, FileSearch, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Issue = {
  id: string; title: string; category: string; severity: string; transactionType: string;
  sourceId: string | null; relatedSourceIds: string[]; relatedRecords?: Array<Record<string, any>>;
  contactName: string | null; reference: string | null; amount: number | null; currency: string | null; date: string | null;
  explanation: string; evidence: string[]; xeroUrl: string | null; status: string; assignedTo: string | null; internalNote: string | null;
};
type PageData = {
  connected: boolean;
  scan: null | { id: number; status: string; scannedAt: string; summary: Record<string, any>; sourceStatus: Record<string, any>; quality: Array<Record<string, any>>; risk: Array<Record<string, any>> };
  activeCounts: Record<string, number>;
  issues: Issue[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  recommendations: Array<Record<string, any>>;
  closeChecks: Array<Record<string, any>>;
  activity: Array<Record<string, any>>;
  trend: Array<Record<string, any>>;
};

const sections = [
  ['overview', 'Overview'], ['issues', 'Issues'], ['reconciliation', 'Bank reconciliation'], ['duplicates', 'Duplicates'],
  ['classification', 'Classification'], ['tax', 'Tax checks'], ['quality', 'Data quality'], ['ai', 'AI assistant'],
  ['readiness', 'Month-end readiness'], ['activity', 'Activity log']
] as const;
type Section = typeof sections[number][0];
const categoryOptions = [
  ['ALL', 'All categories'], ['DUPLICATE', 'Duplicates'], ['RECONCILIATION', 'Reconciliation'], ['CLASSIFICATION', 'Classification'],
  ['TAX', 'Tax'], ['MISSING_INFORMATION', 'Missing information'], ['PAYMENT_MISMATCH', 'Payment / amount']
];

function money(amount: number | null | undefined, currency?: string | null) {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return 'N/A';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount));
}
function dateText(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function severityStyle(value: string) {
  if (value === 'CRITICAL') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 'REVIEW_REQUIRED') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}
function Metric({ label, value, sub, icon: Icon, tone = 'slate', onClick }: { label: string; value: string | number; sub?: string; icon: any; tone?: string; onClick?: () => void }) {
  const tones: Record<string, string> = { slate: 'text-slate-700 bg-slate-50', rose: 'text-rose-700 bg-rose-50', amber: 'text-amber-700 bg-amber-50', blue: 'text-blue-700 bg-blue-50', violet: 'text-violet-700 bg-violet-50', emerald: 'text-emerald-700 bg-emerald-50' };
  return <button type="button" onClick={onClick} className={cn('min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300', onClick && 'cursor-pointer hover:shadow')}>
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">{label}</span><span className={cn('grid h-8 w-8 place-items-center rounded-lg', tones[tone] || tones.slate)}><Icon className="h-4 w-4" /></span></div>
    <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</div>{sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
  </button>;
}

export default function BookkeepingHealthPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section>('overview');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [issueStatus, setIssueStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sort, setSort] = useState('SEVERITY');
  const [checklistDueDate, setChecklistDueDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState('ALL');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [draftPeriodStart, setDraftPeriodStart] = useState('');
  const [draftPeriodEnd, setDraftPeriodEnd] = useState('');

  const choosePeriod = (preset: string) => {
    setPeriodPreset(preset);
    if (preset === 'CUSTOM') return;
    if (preset === 'ALL') { setPeriodStart(''); setPeriodEnd(''); return; }
    const today = new Date();
    const to = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    const fromDate = new Date(today);
    if (preset === '30D') fromDate.setDate(fromDate.getDate() - 29);
    if (preset === '90D') fromDate.setDate(fromDate.getDate() - 89);
    if (preset === 'YTD') fromDate.setMonth(0, 1);
    if (preset === '12M') fromDate.setFullYear(fromDate.getFullYear() - 1);
    const from = new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    setPeriodStart(from); setPeriodEnd(to); setDraftPeriodStart(from); setDraftPeriodEnd(to);
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', category, severity, status: issueStatus });
      if (periodStart) params.set('periodStart', periodStart);
      if (periodEnd) params.set('periodEnd', periodEnd);
      if (search.trim()) params.set('search', search.trim());
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (minAmount && Number.isFinite(Number(minAmount))) params.set('minAmount', minAmount);
      if (maxAmount && Number.isFinite(Number(maxAmount))) params.set('maxAmount', maxAmount);
      if (sort !== 'SEVERITY') params.set('sort', sort);
      const response = await fetch(`/api/dashboard/bookkeeping-health?${params}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not load Bookkeeping Health.');
      setLoadError(null);
      setData(json);
      setSelectedIssue((current) => current ? json.issues.find((item: Issue) => item.id === current.id) ?? null : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Bookkeeping Health load failed.');
      if (!quiet) toast.error(error instanceof Error ? error.message : 'Bookkeeping Health load failed.');
    } finally { if (!quiet) setBusy(false); }
  }, [page, category, severity, issueStatus, search, fromDate, toDate, minAmount, maxAmount, sort, periodStart, periodEnd]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 250); return () => clearTimeout(timer); }, [load]);

  const act = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/dashboard/bookkeeping-health/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not save the action.');
    return json;
  }, []);

  const runScan = async (successText = 'Bookkeeping scan completed.') => {
    setScanBusy(true);
    try {
      const response = await fetch('/api/dashboard/bookkeeping-health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan', periodStart: periodStart || undefined, periodEnd: periodEnd || undefined }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Scan failed.');
      toast.success(successText);
      setPage(1);
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Scan failed.'); }
    finally { setScanBusy(false); }
  };

  const syncXero = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/xero', { method: 'POST' });
      const json = await response.json();
      if (!response.ok || json.success === false) throw new Error(json.message || 'Xero sync failed.');
      await runScan('Xero sync and bookkeeping scan completed.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Xero sync failed.'); }
    finally { setSyncing(false); }
  };

  const updateIssue = async (action: string) => {
    if (!selectedIssue) return;
    try {
      await act({ issueKey: selectedIssue.id, action, note: note.trim() || undefined, assignedTo: assignee.trim() || undefined });
      setNote('');
      toast.success(action === 'resolve' ? 'Issue marked resolved.' : action === 'ignore' ? 'Issue ignored.' : action === 'keep_both' ? 'Decision saved: keep both records.' : action === 'review' ? 'Issue moved to review.' : action === 'reopen' ? 'Issue reopened.' : 'Issue updated.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Issue action failed.'); }
  };

  const generateAi = async () => {
    setAiBusy(true);
    try {
      const response = await fetch('/api/dashboard/bookkeeping-health/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze', periodStart: periodStart || undefined, periodEnd: periodEnd || undefined }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'AI analysis failed.');
      toast.success(`Analysis completed with ${json.model}.`);
      setSelectedSection('ai');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'AI analysis failed.'); }
    finally { setAiBusy(false); }
  };

  const decideAi = async (id: number, decision: string) => {
    try {
      const response = await fetch('/api/dashboard/bookkeeping-health/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decision', id, decision }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save recommendation decision.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Recommendation action failed.'); }
  };

  const updateChecklist = async (check: Record<string, any>, action: string) => {
    try {
      await act({ checklistKey: check.checklist_key, action, assignedTo: assignee.trim() || undefined, expectedDate: check.expected_date || undefined, note: note.trim() || undefined });
      setNote('');
      toast.success('Readiness checklist updated.');
      await load(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Checklist update failed.'); }
  };

  const switchToIssues = (nextCategory: string) => {
    setCategory(nextCategory); setIssueStatus('OPEN'); setPage(1); setSelectedSection('issues');
  };

  const summary = data?.scan?.summary;
  const active = data?.activeCounts;
  const issueByCategory = useMemo(() => data?.issues ?? [], [data?.issues]);
  const currentSection = selectedSection;
  const sectionTitle = sections.find(([key]) => key === currentSection)?.[1] ?? 'Overview';
  const availableRecords = summary?.dataRecords ?? {};
  const riskItems = data?.scan?.risk ?? [];
  const trend = data?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((item) => Number(item.openIssues ?? 0)));
  const trendPoints = trend.map((item, index) => `${trend.length <= 1 ? 300 : 20 + index * (560 / (trend.length - 1))},${130 - Number(item.openIssues ?? 0) / maxTrend * 105}`).join(' ');

  const isSourceAvailable = (key: string) => Boolean(data?.scan?.sourceStatus?.[key]?.available);
  const sourceState = !data?.scan ? 'Initial scan required' : data.scan.status === 'COMPLETE' ? 'Current source data is available' : data.scan.status === 'PARTIAL' ? 'Partial source coverage' : 'Required source information unavailable';

  return <div className="space-y-5 pb-10 text-slate-800">
    <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
      <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Accounting controls</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Bookkeeping Health</h1><p className="mt-1 text-sm text-slate-500">Database-backed checks for transaction integrity, coding and reconciliation evidence.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className={cn('rounded-full border px-2.5 py-1 font-semibold', data?.scan?.status === 'COMPLETE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>{sourceState}</span><span>Last Xero sync: {dateText(summary?.lastSyncedAt ?? data?.scan?.sourceStatus?.Invoices?.updatedAt)}</span><span>Last scan: {data?.scan ? new Date(data.scan.scannedAt).toLocaleString('en-GB') : 'Not run'}</span></div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={() => void syncXero()} disabled={syncing || scanBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"><RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />{syncing ? 'Syncing Xero…' : 'Sync Xero data'}</button>
        <button type="button" onClick={() => void runScan()} disabled={scanBusy || syncing} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><Activity className={cn('h-4 w-4', scanBusy && 'animate-pulse')} />{scanBusy ? 'Checking…' : 'Run checks'}</button>
      </div>
    </header>

    <section aria-label="Bookkeeping Health reporting period" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h2 className="text-sm font-semibold text-slate-900">Reporting period</h2><p className="mt-1 text-xs text-slate-500">Filters records by their Xero transaction date. Undated transactions cannot be assigned to a custom period; statuses reflect the latest synchronized snapshot.</p>
          <div className="mt-3 flex flex-wrap gap-2">{[['ALL','All dates'],['30D','30 days'],['90D','90 days'],['YTD','Year to date'],['12M','12 months'],['CUSTOM','Custom']].map(([key,label])=><button key={key} type="button" onClick={()=>choosePeriod(key)} className={cn('rounded-lg border px-3 py-2 text-xs font-semibold transition',periodPreset===key?'border-cyan-700 bg-cyan-700 text-white':'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50')}>{label}</button>)}</div>
        </div>
        {periodPreset==='CUSTOM' && <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1 text-xs font-medium text-slate-600">From<input type="date" value={draftPeriodStart} onChange={(event)=>setDraftPeriodStart(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">To<input type="date" value={draftPeriodEnd} onChange={(event)=>setDraftPeriodEnd(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
          <button type="button" onClick={()=>{if(!draftPeriodStart||!draftPeriodEnd){toast.error('Choose both a start and end date.');return;}if(draftPeriodStart>draftPeriodEnd){toast.error('The start date must be on or before the end date.');return;}setPeriodStart(draftPeriodStart);setPeriodEnd(draftPeriodEnd);setPage(1);}} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Apply dates</button>
        </div>}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Showing: <strong className="text-slate-700">{periodStart&&periodEnd?`${dateText(periodStart)} – ${dateText(periodEnd)}`:'All available transaction dates'}</strong>{(data?.scan?.summary?.period?.start??'')===periodStart&&(data?.scan?.summary?.period?.end??'')===periodEnd?' · Scan available':' · Run checks to calculate this period'}</div>
    </section>

    <nav aria-label="Bookkeeping Health sections" className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-1">{sections.map(([key, label]) => <button key={key} onClick={() => setSelectedSection(key)} className={cn('rounded-lg px-3 py-2 text-sm font-medium transition', selectedSection === key ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>{label}</button>)}</div>
    </nav>

    {busy && !data ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading persisted bookkeeping data…</div> : null}
    {!busy && loadError ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" /><div><h2 className="font-semibold text-rose-950">Bookkeeping Health could not load</h2><p className="mt-1 text-sm text-rose-900">{loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">Try again</button></div></div></section> : null}
    {!busy && !loadError && !data?.scan ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex items-start gap-3"><Database className="mt-0.5 h-5 w-5 text-amber-700" /><div><h2 className="font-semibold text-amber-950">No bookkeeping scan is available</h2><p className="mt-1 text-sm text-amber-900">The page does not use demo records. Sync the connected Xero organisation, then run checks against the PostgreSQL snapshots.</p><p className="mt-2 text-xs text-amber-800">If sync has already run, select “Run checks” to analyse stored records.</p></div></div></section> : null}
    {data?.scan && data.scan.status !== 'COMPLETE' && <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>{data.scan.status === 'INCOMPLETE' ? 'Health result unavailable:' : 'Partial results:'}</strong> Only {summary?.coverage?.available ?? 0} of {summary?.coverage?.required ?? 0} required Xero source snapshots are available. Missing sources are not counted as zero risk.</section>}

    {data?.scan && selectedSection === 'overview' && <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric label="Health score" value={summary?.healthScore === null ? 'N/A' : `${summary?.healthScore ?? 'N/A'}/100`} sub={summary?.healthScore === null ? 'Incomplete source coverage' : 'Current unresolved findings'} icon={ShieldCheck} tone="emerald" />
        <Metric label="Critical exceptions" value={active?.critical ?? 'N/A'} icon={ShieldAlert} tone="rose" onClick={() => { setSeverity('CRITICAL'); switchToIssues('ALL'); }} />
        <Metric label="Potential duplicates" value={active?.duplicate ?? 'N/A'} icon={CopyIcon} tone="amber" onClick={() => switchToIssues('DUPLICATE')} />
        <Metric label="Reconciliation flags" value={summary?.reconciliationCheck === 'SUPPORTED' ? active?.reconciliation ?? 0 : 'N/A'} sub={summary?.reconciliationCheck === 'SUPPORTED' ? 'Only explicit Xero flags' : 'Not exposed in synced data'} icon={RefreshCw} tone="blue" onClick={() => switchToIssues('RECONCILIATION')} />
        <Metric label="Classification findings" value={active?.classification ?? 'N/A'} icon={BookOpenCheck} tone="violet" onClick={() => switchToIssues('CLASSIFICATION')} />
        <Metric label="Incomplete records" value={active?.missing ?? 'N/A'} icon={AlertTriangle} tone="amber" onClick={() => switchToIssues('MISSING_INFORMATION')} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Issue history</h2><p className="mt-1 text-xs text-slate-500">Only saved scans are plotted. No synthetic trend data is used.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{trend.length} saved scans</span></div>
          {trend.length < 2 ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Run additional scans over time to build an issue trend.</div> : <div className="mt-5"><svg viewBox="0 0 600 160" role="img" aria-label="Open issue count across saved scans" className="h-44 w-full overflow-visible"><line x1="20" y1="130" x2="580" y2="130" stroke="#cbd5e1"/><line x1="20" y1="25" x2="580" y2="25" stroke="#e2e8f0" strokeDasharray="4 4"/><line x1="20" y1="77" x2="580" y2="77" stroke="#e2e8f0" strokeDasharray="4 4"/><polyline points={trendPoints} fill="none" stroke="#0891b2" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{trend.map((item, index) => <circle key={`${item.scannedAt}-${index}`} cx={trend.length <= 1 ? 300 : 20 + index * (560 / (trend.length - 1))} cy={130 - Number(item.openIssues ?? 0) / maxTrend * 105} r="3.5" fill="#0891b2"><title>{dateText(item.scannedAt)}: {item.openIssues} open</title></circle>)}</svg><div className="flex justify-between text-[11px] text-slate-500"><span>{dateText(trend[0]?.scannedAt)}</span><span>Open issues: {trend[trend.length - 1]?.openIssues ?? 0}</span><span>{dateText(trend[trend.length - 1]?.scannedAt)}</span></div></div>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold text-slate-950">Accounting risk overview</h2><p className="mt-1 text-xs text-slate-500">Affected records divided by eligible records for each completed check.</p></div><div className="mt-4 space-y-4">{riskItems.map((risk: any) => <div key={risk.category}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-medium text-slate-700">{risk.label}</span><span className="text-slate-500">{risk.status === 'CHECKED' ? `${risk.affected}/${risk.eligible} · ${risk.affectedPct}%` : 'Unavailable'}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${risk.status === 'CHECKED' ? Math.min(100, risk.affectedPct) : 0}%` }} /></div><p className="mt-1 text-[11px] text-slate-500">Measurable exposure: {risk.status === 'CHECKED' ? money(risk.exposure) : 'N/A'}</p></div>)}</div></section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Synced source coverage</h2><p className="mt-1 text-xs text-slate-500">Source records are read from PostgreSQL reports written by the existing Xero synchronizer.</p></div><span className="text-xs text-slate-500">Last sync {summary?.lastSyncedAt ? new Date(summary.lastSyncedAt).toLocaleString('en-GB') : 'not recorded'}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(data.scan.sourceStatus).map(([name, source]: [string, any]) => <div key={name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5"><div><div className="text-xs font-semibold text-slate-800">{name.replace('_metadata', '').replace(/([A-Z])/g, ' $1').trim()}</div><div className="mt-0.5 text-[11px] text-slate-500">{source.available ? `${source.count} stored record${source.count === 1 ? '' : 's'}` : 'Not synced / unavailable'}</div></div>{source.available ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleHelp className="h-4 w-4 text-amber-600" />}</div>)}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">{Object.entries(availableRecords).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-3 py-2"><span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span><strong className="ml-2 text-slate-900">{String(value)}</strong></div>)}</div></section>
    </div>}

    {data?.scan && selectedSection === 'issues' && <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{selectedSection === 'issues' ? 'Issues requiring attention' : sectionTitle}</h2><p className="mt-1 text-xs text-slate-500">Findings are based on the most recently scanned PostgreSQL snapshots.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{data.pagination.total} matching</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative sm:col-span-2 xl:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search issue, reference, contact…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-600" /></label>
          <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{categoryOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ALL">All severity</option><option value="CRITICAL">Critical</option><option value="REVIEW_REQUIRED">Review</option><option value="DATA_QUALITY">Data quality</option><option value="MONITORING">Monitoring</option></select>
          <select value={issueStatus} onChange={(event) => { setIssueStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option><option value="KEEP_BOTH">Keep both</option><option value="ALL">All statuses</option></select>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs text-slate-600">Date from<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-600">Date to<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-600">Min amount<input type="number" min="0" step="0.01" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-600">Max amount<input type="number" min="0" step="0.01" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-600">Sort by<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"><option value="SEVERITY">Severity</option><option value="DATE">Date</option><option value="AMOUNT">Amount</option></select></label></div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[850px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Severity</th><th className="px-3 py-3">Finding</th><th className="px-3 py-3">Reference / party</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{issueByCategory.length ? issueByCategory.map((issue) => <tr key={issue.id} onClick={() => { setSelectedIssue(issue); setNote(issue.internalNote ?? ''); setAssignee(issue.assignedTo ?? ''); }} className={cn('cursor-pointer hover:bg-cyan-50/50', selectedIssue?.id === issue.id && 'bg-cyan-50')}><td className="px-3 py-3"><span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold', severityStyle(issue.severity))}>{issue.severity.replaceAll('_',' ')}</span></td><td className="max-w-[240px] px-3 py-3"><div className="font-semibold text-slate-900">{issue.title}</div><div className="mt-1 text-[11px] text-slate-500">{issue.category.replaceAll('_',' ')} · {issue.transactionType.replaceAll('_',' ')}</div></td><td className="px-3 py-3"><div className="font-medium text-slate-800">{issue.reference || 'No reference'}</div><div className="mt-1 text-[11px] text-slate-500">{issue.contactName || 'No contact stored'}</div></td><td className="whitespace-nowrap px-3 py-3 text-slate-600">{dateText(issue.date)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{money(issue.amount, issue.currency)}</td><td className="px-3 py-3 text-slate-600">{issue.status.replaceAll('_',' ')}</td><td className="px-3 py-3"><button className="rounded-md border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700">Review</button></td></tr>) : <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">{data.pagination.total === 0 ? 'No findings match these filters.' : 'No issue records on this page.'}</td></tr>}</tbody></table></div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Page {data.pagination.page} of {Math.max(1,data.pagination.pageCount)} · {data.pagination.total} issues</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1,p-1))} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= data.pagination.pageCount} onClick={() => setPage((p) => p+1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </section>
      <IssuePanel issue={selectedIssue} note={note} setNote={setNote} assignee={assignee} setAssignee={setAssignee} onAction={updateIssue} />
    </div>}

    {data?.scan && selectedSection === 'reconciliation' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950">Bank Reconciliation Health</h2><p className="mt-1 text-sm text-slate-500">Uses only explicit reconciliation flags in the synchronized Xero payload.</p></div><span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', summary?.reconciliationCheck === 'SUPPORTED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>{summary?.reconciliationCheck === 'SUPPORTED' ? 'Reconciliation fields available' : 'Reconciliation state not exposed'}</span></div>{summary?.reconciliationCheck !== 'SUPPORTED' && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Xero BankTransactions snapshots do not contain an explicit reconciliation flag for this organisation. Unmatched or pending status is not inferred from transaction status.</div>}<div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Mini label="Connected bank accounts" value={summary?.bankAccountCount ?? 'N/A'} /><Mini label="Bank transactions stored" value={availableRecords.bankTransactions ?? 'N/A'} /><Mini label="Explicitly unreconciled" value={summary?.reconciliationCheck === 'SUPPORTED' ? summary.unreconciledCount : 'N/A'} /><Mini label="Oldest outstanding" value={summary?.reconciliationCheck === 'SUPPORTED' ? dateText(summary.bankAccountDetails?.map((account:any)=>account.oldestUnreconciledDate).filter(Boolean).sort()[0]) : 'N/A'} /></div><div className="mt-5 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Bank account</th><th className="px-3 py-3">Currency</th><th className="px-3 py-3">Stored transactions</th><th className="px-3 py-3">Unreconciled</th><th className="px-3 py-3">Age bands (0–7 / 8–30 / 31–60 / 60+ days; undated)</th><th className="px-3 py-3">Oldest item</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{(summary?.bankAccountDetails ?? []).map((account:any)=><tr key={account.id ?? account.name}><td className="px-3 py-3 font-semibold text-slate-900">{account.name}<div className="text-[11px] font-normal text-slate-500">{account.code || 'No account code'}</div></td><td className="px-3 py-3">{account.currency || 'N/A'}</td><td className="px-3 py-3">{account.transactionCount}</td><td className="px-3 py-3">{summary?.reconciliationCheck === 'SUPPORTED' ? account.unreconciledCount : 'N/A'}</td><td className="px-3 py-3">{summary?.reconciliationCheck === 'SUPPORTED' ? `${account.agingBuckets?.days0to7 ?? 0} / ${account.agingBuckets?.days8to30 ?? 0} / ${account.agingBuckets?.days31to60 ?? 0} / ${account.agingBuckets?.over60Days ?? 0} / ${account.agingBuckets?.ageUnknown ?? 0} undated` : 'N/A'}</td><td className="px-3 py-3">{summary?.reconciliationCheck === 'SUPPORTED' ? dateText(account.oldestUnreconciledDate) : 'N/A'}</td><td className="px-3 py-3">{summary?.reconciliationCheck === 'SUPPORTED' ? (account.unreconciledCount ? 'Review required' : 'No explicit flags') : 'Not available'}</td></tr>)}{!summary?.bankAccountDetails?.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{isSourceAvailable('Accounts_metadata') ? 'No bank accounts in the synced chart of accounts.' : 'Bank account data has not been synchronized.'}</td></tr>}</tbody></table></div></section>}

    {data?.scan && selectedSection === 'duplicates' && <CategorySection title="Duplicate Transaction Detection" description="Exact candidate matches based on contact, reference, amount and currency. Findings require human review." data={data} category="DUPLICATE" onOpen={(issue) => {setSelectedIssue(issue);setSelectedSection('issues');}} />}
    {data?.scan && selectedSection === 'classification' && <CategorySection title="Account Classification & Coding Health" description="Highlights missing account codes and lines explicitly coded to suspense or uncategorised accounts." data={data} category="CLASSIFICATION" onOpen={(issue) => {setSelectedIssue(issue);setSelectedSection('issues');}} />}
    {data?.scan && selectedSection === 'tax' && <CategorySection title="Tax Coding Checks" description="Reports missing TaxType data where supplied invoice lines are present. This does not judge whether a tax treatment is correct." data={data} category="TAX" onOpen={(issue) => {setSelectedIssue(issue);setSelectedSection('issues');}} />}

    {data?.scan && selectedSection === 'quality' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-950">Data Completeness & Quality</h2><p className="mt-1 text-sm text-slate-500">Each percentage uses eligible stored records; “no eligible records” is distinct from a pass.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{(data.scan.quality ?? []).map((check:any)=><div key={check.key} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{check.label}</h3><p className="mt-1 text-xs text-slate-500">{check.eligible} eligible records</p></div><span className="text-lg font-bold text-slate-900">{check.completionPct === null ? 'N/A' : `${check.completionPct}%`}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{width:`${check.completionPct ?? 0}%`}}/></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{check.passed} passed</span><span>{check.failed} need review</span></div><div className="mt-2 text-[11px] text-slate-500">{check.status === 'NO_ELIGIBLE_RECORDS' ? 'Not assessed: no applicable source records.' : 'Validation performed on the current stored snapshot.'}</div></div>)}</div></section>}

    {data?.scan && selectedSection === 'ai' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">AI Bookkeeping Assistant</h2><p className="mt-1 text-sm text-slate-500">Recommendations are generated from stored Xero records and rule findings. They never alter Xero transactions.</p></div><button onClick={() => void generateAi()} disabled={aiBusy} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><Sparkles className={cn('h-4 w-4',aiBusy&&'animate-pulse')}/>{aiBusy?'Analysing…':'Generate analysis'}</button></div><div className="mt-4 space-y-3">{(data.recommendations ?? []).map((item:any)=><article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{item.model} · {item.status}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{item.explanation}</p><div className="mt-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence references</div><div className="mt-1 flex flex-wrap gap-1.5">{(item.evidence ?? []).map((ref:string)=><span key={ref} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">{ref}</span>)}</div></div><div className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-950"><strong>Suggested review:</strong> {item.suggested_action}</div>{item.status==='REVIEW'&&<div className="mt-3 flex gap-2"><button onClick={()=>void decideAi(item.id,'ACCEPTED')} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Accept recommendation</button><button onClick={()=>void decideAi(item.id,'REJECTED')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Reject</button></div>}<p className="mt-2 text-[11px] text-slate-500">AI guidance is not a guarantee and requires professional review. No confidence score is claimed.</p></article>)}{!data.recommendations?.length&&<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Sparkles className="mx-auto h-6 w-6 text-violet-600"/><p className="mt-2 text-sm font-semibold text-slate-800">No AI recommendations saved</p><p className="mt-1 text-xs text-slate-500">Generate an analysis to request evidence-linked guidance from the configured model. Provider failures are shown as errors, not replaced with demo suggestions.</p></div>}</div></section>}

    {data?.scan && selectedSection === 'readiness' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Month-End Bookkeeping Readiness</h2><p className="mt-1 text-sm text-slate-500">A review checklist for detailed bookkeeping exceptions. It does not duplicate Management Accounts close reporting.</p></div><div className="flex gap-2"><input aria-label="Assign checklist reviewer" value={assignee} onChange={(event)=>setAssignee(event.target.value)} placeholder="Reviewer email" className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-xs"/><input aria-label="Checklist due date" type="date" value={checklistDueDate} onChange={(event)=>setChecklistDueDate(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/></div></div><div className="mt-4 divide-y divide-slate-100">{(data.closeChecks ?? []).map((check:any)=><div key={check.checklist_key} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><div className="text-sm font-medium text-slate-900">{check.label}</div><div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"><span>Owner: {check.assigned_to || 'Unassigned'}</span><span>Due: {dateText(check.expected_date)}</span><span>Last review: {check.reviewed_at ? `${check.reviewed_by} · ${dateText(check.reviewed_at)}` : 'Not reviewed'}</span></div></div><div className="flex items-center gap-2"><span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', check.status==='COMPLETE'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-amber-200 bg-amber-50 text-amber-800')}>{check.status==='COMPLETE'?'Complete':'Pending review'}</span><button onClick={()=>void updateChecklist(check,check.status==='COMPLETE'?'check_reopen':'check_complete')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">{check.status==='COMPLETE'?'Reopen':'Mark reviewed'}</button><button onClick={()=>void updateChecklist({...check,expected_date:checklistDueDate||check.expected_date},'check_assign')} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">Assign / due date</button></div></div>)}</div></section>}

    {data?.scan && selectedSection === 'activity' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-950">Bookkeeping Activity & Audit Trail</h2><p className="mt-1 text-sm text-slate-500">Persisted user actions and scan history for this organisation.</p></div><Activity className="h-5 w-5 text-cyan-700"/></div><div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">When</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Issue / details</th><th className="px-3 py-3">Change</th></tr></thead><tbody className="divide-y divide-slate-100">{data.activity.map((event:any)=><tr key={event.id}><td className="whitespace-nowrap px-3 py-3">{new Date(event.created_at).toLocaleString('en-GB')}</td><td className="px-3 py-3">{event.actor_email||'System'}</td><td className="px-3 py-3 font-semibold">{event.action.replaceAll('_',' ')}</td><td className="px-3 py-3">{event.issue_key||JSON.stringify(event.metadata||{})}{event.note&&<div className="mt-1 text-slate-500">{event.note}</div>}</td><td className="px-3 py-3">{event.previous_status&&`${event.previous_status} → `}{event.new_status||'—'}</td></tr>)}{!data.activity.length&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">No activity has been recorded yet.</td></tr>}</tbody></table></div></section>}
  </div>;
}

function Mini({label,value}:{label:string;value:any}) { return <div className="rounded-lg bg-slate-50 p-3"><div className="text-[11px] font-medium text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold text-slate-950">{value}</div></div>; }
function CopyIcon({className}:{className?:string}) { return <span className={className}><FileSearch className="h-4 w-4"/></span>; }

function IssuePanel({issue,note,setNote,assignee,setAssignee,onAction}:{issue:Issue|null;note:string;setNote:(value:string)=>void;assignee:string;setAssignee:(value:string)=>void;onAction:(action:string)=>void}) {
  if (!issue) return <aside className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><FileSearch className="mx-auto h-8 w-8 text-slate-300"/><h3 className="mt-3 text-sm font-semibold text-slate-800">Select a finding to investigate</h3><p className="mt-1 text-xs text-slate-500">Evidence and safe review actions appear here.</p></aside>;
  return <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-4"><div className="flex items-start justify-between gap-2"><div><span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold',severityStyle(issue.severity))}>{issue.severity.replaceAll('_',' ')}</span><h2 className="mt-2 text-base font-bold text-slate-950">{issue.title}</h2><p className="mt-1 text-xs text-slate-500">{issue.category.replaceAll('_',' ')} · {issue.transactionType.replaceAll('_',' ')}</p></div></div><div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-700">Why flagged</div><p className="mt-1 text-sm leading-5 text-slate-700">{issue.explanation}</p></div><div className="grid grid-cols-2 gap-2 text-xs">{[['Contact',issue.contactName],['Reference',issue.reference],['Amount',money(issue.amount,issue.currency)],['Date',dateText(issue.date)],['Source ID',issue.sourceId],['Status',issue.status.replaceAll('_',' ')]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 p-2.5"><div className="text-[10px] font-semibold uppercase text-slate-500">{label}</div><div className="mt-1 break-words font-medium text-slate-900">{value||'N/A'}</div></div>)}</div>
    {issue.relatedRecords?.length ? <div><div className="mb-2 text-xs font-semibold text-slate-800">Candidate records side by side</div><div className="grid gap-2 sm:grid-cols-2">{issue.relatedRecords.map((record:any,index:number)=><div key={record.sourceId||index} className="rounded-lg border border-slate-200 p-3 text-xs"><div className="font-semibold text-slate-900">Record {index+1}</div><div className="mt-2 space-y-1 text-slate-600"><div>Contact: <b className="text-slate-800">{record.contactName||'N/A'}</b></div><div>Reference: <b className="text-slate-800">{record.reference||'N/A'}</b></div><div>Date: <b className="text-slate-800">{dateText(record.date)}</b></div><div>Amount: <b className="text-slate-800">{money(record.amount,record.currency)}</b></div><div>Status: <b className="text-slate-800">{record.status||'N/A'}</b></div><div className="break-all">ID: {record.sourceId||'N/A'}</div></div></div>)}</div></div>:null}
    <div><div className="text-xs font-semibold text-slate-800">Evidence</div><ul className="mt-1 space-y-1">{(issue.evidence??[]).map((item,index)=><li key={index} className="flex gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700"/>{item}</li>)}</ul></div>
    {issue.xeroUrl&&<a href={issue.xeroUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Open source in Xero <ExternalLink className="h-3.5 w-3.5"/></a>}
    <label className="block text-xs font-medium text-slate-700">Assigned reviewer<input value={assignee} onChange={(event)=>setAssignee(event.target.value)} placeholder="Name or email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
    <label className="block text-xs font-medium text-slate-700">Internal note<textarea value={note} onChange={(event)=>setNote(event.target.value)} rows={3} placeholder="Add a review note" className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"/></label>
    <div className="grid grid-cols-2 gap-2"><button onClick={()=>onAction('assign')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Assign</button><button onClick={()=>onAction('note')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Save note</button><button onClick={()=>onAction('review')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Mark in review</button><button onClick={()=>onAction('resolve')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Resolve</button><button onClick={()=>onAction('keep_both')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Keep both</button><button onClick={()=>onAction('ignore')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Ignore</button>{issue.status!=='OPEN'&&<button onClick={()=>onAction('reopen')} className="col-span-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Reopen issue</button>}</div>
    <p className="text-[11px] leading-4 text-slate-500">These actions update this review record only. They do not edit, delete, void or reconcile the Xero transaction.</p>
  </aside>;
}

function CategorySection({title,description,data,category,onOpen}:{title:string;description:string;data:PageData;category:string;onOpen:(issue:Issue)=>void}) {
  const items=(data.issues??[]).filter((issue)=>issue.category===category);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">{items.map((issue)=><button key={issue.id} onClick={()=>onOpen(issue)} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/30"><div className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900">{issue.title}</span><span className={cn('shrink-0 rounded-full border px-2 py-1 text-[10px]',severityStyle(issue.severity))}>{issue.severity.replaceAll('_',' ')}</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{issue.explanation}</p><div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{issue.reference||'No reference'} · {issue.contactName||'No contact'}</span><strong className="text-slate-800">{money(issue.amount,issue.currency)}</strong></div></button>)}{!items.length&&<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 md:col-span-2">No open findings in this category for the current scan.</div>}</div></section>;
}
