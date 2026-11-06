'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, BookOpen, ChevronDown, CircleCheck, CircleHelp, FileWarning, LoaderCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ManagementManualJournals } from './ManagementManualJournals';

type LedgerAccount = {
  accountId: string; accountCode: string; accountName: string; accountType: string;
  classification: string; normalBalance: string; statement: string;
  openingBalance: number | null; totalDebits: number | null; totalCredits: number | null;
  netMovement: number | null; sourceClosingBalance: number | null; adjustedClosingBalance: number | null;
  unresolvedDifference: number | null; reconciliationStatus: string; transactionEvidenceAvailable: boolean;
  sourceJournalCoverage: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN';
};
type Transaction = { date: string; type: string; reference: string; description: string; contact: string; debit: number; credit: number; runningBalance: number | null; sourceId: string | null; sourceClassification: string; journalLines: { accountId: string; accountCode: string; accountName: string; description: string; debit: number; credit: number }[] };
type ManualJournal = { id: number; reference: string; date: string; description: string; reason: string; createdBy: string; sourceClassification: 'MANAGEMENT_ONLY'; lines: { accountId: string; accountCode: string | null; accountName: string; classification: string; description: string; debit: number; credit: number; sourceClassification: 'MANAGEMENT_ONLY' }[] };
type SourceChecks = { controls: { id: string; name: string; status: 'verified' | 'attention' | 'not-verified' | 'not-applicable'; detail: string; evidence: string; referenceDate: string }[]; counts: { verified: number; attention: number; notVerified: number; notApplicable: number } };
type LedgerData = { connected: boolean; accounts: LedgerAccount[]; manualJournals: ManualJournal[]; summary: { totalAccounts: number; reconciledAccounts: number; accountsRequiringReview: number; unresolvedDifferences: number; evidenceUnavailable: number } | null; currency: string | null; lastSyncedAt: string | null; canManageManualJournals: boolean };
type Detail = {
  account: { accountId: string; accountCode: string; accountName: string; accountType: string; classification: string; normalBalance: string };
  balances: { opening: number | null; xeroReported: number | null; independentReported: number | null; totalDebits: number | null; totalCredits: number | null; netMovement: number | null; adjusted: number | null; difference: number | null };
  transactions: Transaction[]; manualJournals: ManualJournal[]; status: string; warning: string | null;
  transactionEvidenceAvailable: boolean; sourceJournalCoverage: LedgerAccount['sourceJournalCoverage'];
};

const unavailable = 'Not available';
const sourceStatusStyles: Record<string, string> = {
  'Matches Xero activity': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Difference outstanding': 'border-rose-200 bg-rose-50 text-rose-700',
  'Evidence unavailable': 'border-slate-200 bg-slate-100 text-slate-600',
};

function money(value: number | null | undefined, currency: string | null) {
  if (value == null || !Number.isFinite(value)) return unavailable;
  try { return currency ? new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency || ''} ${value.toFixed(2)}`.trim(); }
}
function displayDate(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString() : unavailable; }

function closingState(account: LedgerAccount, journalCount: number) {
  if (account.sourceClosingBalance === null || account.adjustedClosingBalance === null || account.unresolvedDifference === null) {
    return { label: account.sourceJournalCoverage === 'UNAVAILABLE' ? 'Source activity unavailable' : 'Closing position unavailable', style: 'border-slate-200 bg-slate-100 text-slate-600' };
  }
  if (Math.abs(account.unresolvedDifference) <= 0.01) {
    if (journalCount > 0) return { label: 'Management close balanced', style: 'border-cyan-200 bg-cyan-50 text-cyan-800' };
    return account.sourceJournalCoverage === 'COMPLETE'
      ? { label: 'Matches Xero activity', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : { label: 'Balanced · source detail partial', style: 'border-cyan-200 bg-cyan-50 text-cyan-800' };
  }
  return { label: journalCount ? 'Variance remains' : 'Closing entry required', style: 'border-amber-200 bg-amber-50 text-amber-800' };
}

export function ManagementLedgerWorkspace({ fromDate, toDate, sourceChecks, onLedgerData }: { fromDate: string; toDate: string; sourceChecks?: SourceChecks | null; onLedgerData?: (data: LedgerData, fromDate: string, toDate: string) => void }) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All classifications');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeCloseTab, setActiveCloseTab] = useState<'review' | 'journals'>('review');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [journalOpenAccountId, setJournalOpenAccountId] = useState<string | null>(null);
  const clearJournalOpenRequest = useCallback(() => setJournalOpenAccountId(null), []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/dashboard/management-accounts/ledger?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Closing review could not be loaded.');
      setData(result);
      onLedgerData?.(result, fromDate, toDate);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Closing review could not be loaded.'); }
    finally { setLoading(false); }
  }, [fromDate, toDate, onLedgerData]);

  // Fetch tenant and period scoped closing data when the selected range changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const accounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (data?.accounts ?? []).filter((account) =>
      (!normalizedQuery || `${account.accountName} ${account.accountCode} ${account.accountType}`.toLocaleLowerCase().includes(normalizedQuery)) &&
      (classFilter === 'All classifications' || account.classification === classFilter),
    );
  }, [data?.accounts, query, classFilter]);
  const pageCount = Math.max(1, Math.ceil(accounts.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const pagedAccounts = accounts.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);

  const openAccount = async (account: LedgerAccount) => {
    if (expandedAccountId === account.accountId) { setExpandedAccountId(null); setDetail(null); setDetailError(null); return; }
    setExpandedAccountId(account.accountId); setDetail(null); setDetailError(null); setDetailLoading(true);
    try {
      const response = await fetch(`/api/dashboard/management-accounts/ledger?accountId=${encodeURIComponent(account.accountId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Account activity could not be loaded.');
      setDetail(result);
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : 'Account activity could not be loaded.'); }
    finally { setDetailLoading(false); }
  };

  const reloadAfterJournal = async () => {
    await load();
    if (expandedAccountId) {
      const response = await fetch(`/api/dashboard/management-accounts/ledger?accountId=${encodeURIComponent(expandedAccountId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`, { cache: 'no-store' });
      const result = await response.json();
      if (response.ok) setDetail(result);
    }
  };

  const journalCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const journal of data?.manualJournals ?? []) for (const line of journal.lines) counts.set(line.accountId, (counts.get(line.accountId) ?? 0) + 1);
    return counts;
  }, [data?.manualJournals]);

  const totals = useMemo(() => ({
    accounts: data?.accounts.length ?? 0,
    matches: data?.accounts.filter((account) => account.reconciliationStatus === 'Matches Xero activity').length ?? 0,
    closingEntries: data?.accounts.filter((account) => account.unresolvedDifference !== null && Math.abs(account.unresolvedDifference) > 0.01).length ?? 0,
    unavailable: data?.accounts.filter((account) => account.sourceJournalCoverage !== 'COMPLETE').length ?? 0,
  }), [data?.accounts]);

  const detailJournalLines = useMemo(() => (data?.manualJournals ?? []).flatMap((journal) => {
    const lines = journal.lines.filter((line) => line.accountId === expandedAccountId);
    return lines.length ? [{ journal, lines }] : [];
  }), [data?.manualJournals, expandedAccountId]);
  const selectedCloseTab = data?.connected ? activeCloseTab : 'review';

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800"><BookOpen className="h-4 w-4" /></span><h2 className="text-base font-semibold text-slate-900">Ledger review and closing entries</h2></div><p className="mt-1 text-xs text-slate-600">Review account activity and closing balances for {fromDate} to {toDate}.</p>{data?.lastSyncedAt && <p className="mt-1 text-[11px] text-slate-400">Last Xero synchronisation: {new Date(data.lastSyncedAt).toLocaleString()}</p>}</div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />Refresh closing data</button>
    </div>
    {error && <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {data?.summary && <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-white sm:grid-cols-4">{[
      { label: 'Accounts in review', value: totals.accounts, Icon: Activity, color: 'text-slate-800' },
      { label: 'Matched to Xero activity', value: totals.matches, Icon: CircleCheck, color: 'text-emerald-700' },
      { label: 'Closing entries outstanding', value: totals.closingEntries, Icon: FileWarning, color: 'text-amber-700' },
      { label: 'Source detail incomplete', value: totals.unavailable, Icon: CircleHelp, color: 'text-slate-600' },
    ].map(({ label, value, Icon, color }) => <div key={label} className="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:px-4"><Icon className={cn('h-4 w-4 shrink-0', color)} /><div className="min-w-0"><span className="block text-[10px] leading-4 text-slate-500 sm:text-[11px]">{label}</span><strong className={cn('mt-0.5 block text-base tabular-nums', color)}>{value}</strong></div></div>)}</div>}
    <div role="tablist" aria-label="Period-end close sections" className="flex gap-1.5 border-b border-slate-200 px-3 pt-3">
      <button id="close-review-tab" type="button" role="tab" aria-selected={selectedCloseTab === 'review'} aria-controls="close-review-panel" onClick={() => setActiveCloseTab('review')} className={cn('rounded-t-lg border border-b-0 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600', selectedCloseTab === 'review' ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>Account review</button>
      {data?.connected && <button id="close-journals-tab" type="button" role="tab" aria-selected={selectedCloseTab === 'journals'} aria-controls="close-journals-panel" onClick={() => setActiveCloseTab('journals')} className={cn('inline-flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600', selectedCloseTab === 'journals' ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900')}>Management journals<span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', selectedCloseTab === 'journals' ? 'bg-cyan-100 text-cyan-900' : 'bg-slate-100 text-slate-500')}>{data.manualJournals.length}</span></button>}
    </div>

    {data?.connected && <div id="close-journals-panel" role="tabpanel" aria-labelledby="close-journals-tab" hidden={selectedCloseTab !== 'journals'}>
      <ManagementManualJournals
        fromDate={fromDate} toDate={toDate} currency={data.currency}
        accounts={data.accounts.map(({ accountId, accountCode, accountName, classification }) => ({ accountId, accountCode, accountName, classification }))}
        activeAccountIds={data.accounts.map(({ accountId }) => accountId)}
        canManage={data.canManageManualJournals} onSaved={() => { void reloadAfterJournal(); }}
        openForAccountId={journalOpenAccountId} onOpenHandled={clearJournalOpenRequest}
      />
    </div>}

    <div id="close-review-panel" role="tabpanel" aria-labelledby="close-review-tab" hidden={selectedCloseTab !== 'review'}>
    <div className="border-b border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-5 text-slate-700"><p className="font-semibold text-slate-800">How this close is assessed</p><p className="mt-0.5">Xero system journals and Xero manual journals are shown as source activity when access is available. Management-only closing journals are stored in this application and can complete the management view; they are never posted to Xero and do not certify Xero’s source ledger.</p></div>

    {data?.connected && data.accounts.some((account) => account.sourceJournalCoverage !== 'COMPLETE') && <div role="status" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Some source journal detail is incomplete.</strong> The affected accounts show the available Xero manual journal lines and any management-only entries. An app-only entry can support the management closing view, but it must not be mistaken for missing Xero source evidence.</p></div></div>}

    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 p-3 md:flex-row">
      <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search account name or code" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500" /></label>
      <select aria-label="Filter accounts by classification" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option>All classifications</option>{['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses', 'Other'].map((value) => <option key={value}>{value}</option>)}</select>
    </div>
    {loading && !data ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading Xero closing data…</div> : !data?.connected ? <div className="p-10 text-center text-sm text-slate-600"><ShieldAlert className="mx-auto mb-2 h-6 w-6 text-slate-400" />Connect Xero to load the organisation’s closing balances.</div> : accounts.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No accounts match this search.</div> : <div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-xs">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Account</th><th className="px-3 py-3">Class</th><th className="px-3 py-3 text-right">Opening</th><th className="px-3 py-3 text-right">Xero closing</th><th className="px-3 py-3 text-right">Management closing</th><th className="px-3 py-3 text-right">Remaining difference</th><th className="px-3 py-3">Closing status</th></tr></thead>
        <tbody className="divide-y divide-slate-200">{pagedAccounts.map((account) => {
          const state = closingState(account, journalCounts.get(account.accountId) ?? 0);
          const isOpen = expandedAccountId === account.accountId;
          return <Fragment key={account.accountId}><tr className={cn('transition-colors hover:bg-cyan-50/30', isOpen && 'bg-cyan-50/40')}>
            <th scope="row" className="px-3 py-3"><button type="button" onClick={() => void openAccount(account)} aria-expanded={isOpen} className="group inline-flex cursor-pointer items-center gap-2 text-left"><ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} /><span><span className="block font-semibold text-slate-800 group-hover:text-cyan-800">{account.accountName}</span><span className="mt-0.5 block text-[10px] text-slate-500">{account.accountCode || account.accountType}</span></span></button></th>
            <td className="px-3 py-3 text-slate-600">{account.classification}</td><td className="px-3 py-3 text-right tabular-nums">{money(account.openingBalance, data.currency)}</td><td className="px-3 py-3 text-right tabular-nums">{money(account.sourceClosingBalance, data.currency)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{money(account.adjustedClosingBalance, data.currency)}</td><td className={cn('px-3 py-3 text-right font-semibold tabular-nums', account.unresolvedDifference !== null && Math.abs(account.unresolvedDifference) > 0.01 ? 'text-amber-800' : 'text-slate-700')}>{account.unresolvedDifference === null ? unavailable : money(account.unresolvedDifference, data.currency)}</td><td className="px-3 py-3"><span className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium', state.style)}>{state.label}</span></td>
          </tr>{isOpen && <tr><td colSpan={7} className="border-b border-cyan-100 bg-slate-50/70 p-3 sm:p-4"><div className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h3 className="text-sm font-semibold text-slate-900">{account.accountName} · source activity</h3><p className="mt-1 text-xs text-slate-500">Xero journal lines for {fromDate} to {toDate}</p></div><span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-medium', sourceStatusStyles[account.reconciliationStatus] || sourceStatusStyles['Evidence unavailable'])}>{account.sourceJournalCoverage === 'COMPLETE' ? account.reconciliationStatus : account.sourceJournalCoverage === 'PARTIAL' ? 'Partial Xero journal detail' : 'Source evidence unavailable'}</span></div>
            {detail?.account.accountId === account.accountId && data.canManageManualJournals && <button type="button" onClick={() => { setJournalOpenAccountId(account.accountId); setActiveCloseTab('journals'); }} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900 hover:bg-cyan-100"><FileWarning className="h-4 w-4" />Add management-only closing journal</button>}
            {detailLoading && isOpen ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading account activity…</div> : detailError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{detailError}</div> : detail?.account.accountId === account.accountId && <>
              {detail.warning && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{detail.warning}{detail.warning.includes('does not include permission to retrieve system journal entries') && <p className="mt-2">After a platform administrator enables journal access for the Xero app, <a href="/api/xero/redirect?include_restricted=true" className="cursor-pointer font-semibold text-cyan-800 underline underline-offset-2">reconnect Xero with journal access</a>.</p>}</div>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
                ['Opening balance', detail.balances.opening], ['Xero reported closing', detail.balances.xeroReported], ['Management closing', detail.balances.adjusted], ['Remaining difference', detail.balances.difference],
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><span className="block text-[10px] text-slate-500">{label}</span><strong className="mt-1 block text-sm tabular-nums text-slate-900">{money(value as number | null, data.currency)}</strong></div>)}</div>
              <section className="overflow-hidden rounded-lg border border-slate-200"><div className="border-b border-slate-200 px-3 py-2.5"><h4 className="text-xs font-semibold text-slate-800">Xero journal entries and line items</h4><p className="mt-1 text-[10px] text-slate-500">Each entry shows its source and the full set of Xero journal lines.</p></div>{detail.transactions.length ? <div className="max-h-[28rem] overflow-auto"><div className="divide-y divide-slate-200">{detail.transactions.map((entry, index) => <article key={`${entry.sourceId ?? entry.reference}-${index}`} className="p-3"><div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-800">{entry.type}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{entry.reference || 'No reference'}</span></div><p className="mt-1 text-[11px] text-slate-500">{displayDate(entry.date)}{entry.description ? ` · ${entry.description}` : ''}</p></div><div className="flex gap-4 text-[11px] tabular-nums sm:justify-end"><span>Debit <strong>{money(entry.debit, data.currency)}</strong></span><span>Credit <strong>{money(entry.credit, data.currency)}</strong></span><span>Balance <strong>{money(entry.runningBalance, data.currency)}</strong></span></div></div><div className="mt-2 overflow-x-auto rounded-md border border-slate-100"><table className="w-full min-w-[560px] text-left text-[11px]"><thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="px-2.5 py-1.5">Account</th><th className="px-2.5 py-1.5">Line description</th><th className="px-2.5 py-1.5 text-right">Debit</th><th className="px-2.5 py-1.5 text-right">Credit</th></tr></thead><tbody className="divide-y divide-slate-100">{entry.journalLines.map((journalLine, lineIndex) => <tr key={`${entry.sourceId}-${lineIndex}`}><td className="px-2.5 py-1.5 font-medium text-slate-700">{journalLine.accountCode ? `${journalLine.accountCode} · ` : ''}{journalLine.accountName || journalLine.accountId}</td><td className="px-2.5 py-1.5 text-slate-500">{journalLine.description || '—'}</td><td className="px-2.5 py-1.5 text-right tabular-nums">{journalLine.debit ? money(journalLine.debit, data.currency) : '—'}</td><td className="px-2.5 py-1.5 text-right tabular-nums">{journalLine.credit ? money(journalLine.credit, data.currency) : '—'}</td></tr>)}</tbody></table></div></article>)}</div></div> : <p className="p-3 text-xs text-slate-500">No source journal entries were returned for this account and period. If source access is incomplete, use a documented management-only closing entry in the section above.</p>}</section>
              {detailJournalLines.length > 0 && <section className="overflow-hidden rounded-lg border border-cyan-200"><div className="border-b border-cyan-100 bg-cyan-50/60 px-3 py-2.5"><h4 className="text-xs font-semibold text-cyan-950">Management-only closing lines</h4><p className="mt-1 text-[10px] text-cyan-900">These lines contribute to the management closing balance and remain outside Xero.</p></div><div className="divide-y divide-slate-100">{detailJournalLines.map(({ journal, lines }) => <div key={journal.id} className="px-3 py-2.5"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{journal.reference} · {journal.description}</span><span className="text-[10px] text-slate-500">{journal.date}</span></div><div className="mt-2 space-y-1">{lines.map((line, index) => <div key={`${journal.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 text-[11px]"><span className="text-slate-600">{line.description || line.accountName}</span><span className="tabular-nums">{line.debit ? `Dr ${money(line.debit, data.currency)}` : '—'}</span><span className="tabular-nums">{line.credit ? `Cr ${money(line.credit, data.currency)}` : '—'}</span></div>)}</div></div>)}</div></section>}
            </>}
          </div></td></tr>}</Fragment>;
        })}</tbody>
      </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500">Showing <span className="font-semibold text-slate-700">{(visiblePage - 1) * pageSize + 1}–{Math.min(visiblePage * pageSize, accounts.length)}</span> of <span className="font-semibold text-slate-700">{accounts.length}</span> accounts</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-slate-500">Rows per page<select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
          <button type="button" onClick={() => setCurrentPage(Math.max(1, visiblePage - 1))} disabled={visiblePage <= 1} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span className="min-w-16 text-center text-slate-500">Page {visiblePage} of {pageCount}</span>
          <button type="button" onClick={() => setCurrentPage(Math.min(pageCount, visiblePage + 1))} disabled={visiblePage >= pageCount} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>}
    {sourceChecks && <details className="group border-t border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 border-l-4 border-cyan-600 bg-gradient-to-r from-cyan-50/80 to-white px-4 py-4 transition-colors hover:from-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-cyan-800 shadow-sm ring-1 ring-cyan-100"><ShieldAlert className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">Supporting source checks</span><span className="mt-0.5 block text-xs font-normal text-slate-600">Evidence behind the close review results</span><span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium"><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">{sourceChecks.counts.verified} passed</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">{sourceChecks.counts.attention} require review</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{sourceChecks.counts.notVerified} unavailable</span></span></span></span>
        <span className="flex shrink-0 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-900 shadow-sm transition-colors group-hover:bg-cyan-50"><span className="hidden sm:inline">View checks</span><span className="sm:hidden">View</span><ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" /></span>
      </summary>
      <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white">{sourceChecks.controls.map((control) => { const passed = control.status === 'verified'; const requiresReview = control.status === 'attention'; const statusLabel = passed ? 'Passed' : requiresReview ? 'Review required' : control.status === 'not-applicable' ? 'Not applicable' : 'Evidence unavailable'; return <article key={control.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-semibold text-slate-800">{control.name}</h3><span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', passed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : requiresReview ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-600')}>{statusLabel}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{control.detail}</p><p className="mt-1 text-[10px] text-slate-400">Source: {control.evidence} · {displayDate(control.referenceDate)}</p></div></article>; })}</div>
    </details>}
    <p className="border-t border-slate-200 px-4 py-3 text-[11px] leading-5 text-slate-500">Management-only journals help prepare the management view. They are not Xero journals and do not confirm that the accounting period has been formally closed.</p>
    </div>
  </section>;
}
