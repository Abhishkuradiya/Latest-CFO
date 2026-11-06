'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilePlus2, LoaderCircle, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type AccountOption = { accountId: string; accountCode: string; accountName: string; classification: string };
type JournalLine = { accountId: string; debit: string; credit: string; description: string };
type Journal = {
  id: number; reference: string; date: string; description: string; reason: string; createdBy: string;
  sourceClassification: 'MANAGEMENT_ONLY';
  lines: { accountId: string; accountCode: string | null; accountName: string; classification: string; description: string; debit: number; credit: number; sourceClassification: 'MANAGEMENT_ONLY' }[];
};

const blankLine = (): JournalLine => ({ accountId: '', debit: '', credit: '', description: '' });

export function ManagementManualJournals({
  fromDate, toDate, currency, accounts, activeAccountIds, canManage, onSaved, openForAccountId, onOpenHandled,
}: {
  fromDate: string; toDate: string; currency: string | null; accounts: AccountOption[]; canManage: boolean; onSaved: () => void;
  activeAccountIds: string[];
  openForAccountId?: string | null; onOpenHandled?: () => void;
}) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Journal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [journalDate, setJournalDate] = useState(toDate);
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([blankLine(), blankLine()]);

  const loadJournals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/management-accounts/manual-journals?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Management journals could not be loaded.');
      setJournals(result.journals ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Management journals could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  // This request loads tenant-scoped records for the selected period.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadJournals(); }, [loadJournals]);

  useEffect(() => {
    if (!openForAccountId || !canManage) return;
    const frame = window.requestAnimationFrame(() => {
      setJournalDate(toDate);
      setLines([{ ...blankLine(), accountId: openForAccountId }, blankLine()]);
      setFormOpen(true);
      document.getElementById('management-manual-journals')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onOpenHandled?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openForAccountId, canManage, toDate, onOpenHandled]);

  const totals = useMemo(() => lines.reduce((sum, line) => ({
    debit: sum.debit + (Number(line.debit) || 0), credit: sum.credit + (Number(line.credit) || 0),
  }), { debit: 0, credit: 0 }), [lines]);
  const balanced = Math.abs(totals.debit - totals.credit) < 0.005 && totals.debit > 0;
  const activeAccountIdSet = new Set(activeAccountIds);
  const visibleJournals = journals.filter((journal) => journal.lines.length > 0 && journal.lines.every((line) => activeAccountIdSet.has(line.accountId)));

  const updateLine = (index: number, key: keyof JournalLine, value: string) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? {
      ...line, [key]: value,
      ...(key === 'debit' && value ? { credit: '' } : {}),
      ...(key === 'credit' && value ? { debit: '' } : {}),
    } : line));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!balanced) { toast.error('Total debits must equal total credits.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/dashboard/management-accounts/manual-journals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart: fromDate, periodEnd: toDate, journalDate, description, reason,
          lines: lines.map((line) => ({ ...line, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Journal could not be saved.');
      toast.success(`${result.journal.reference} saved to this management report.`);
      setDescription(''); setReason(''); setLines([blankLine(), blankLine()]); setFormOpen(false);
      await loadJournals(); onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Journal could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const deleteJournal = async (journal: Journal) => {
    setDeletingId(journal.id);
    try {
      const response = await fetch(`/api/dashboard/management-accounts/manual-journals/${journal.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Management journal could not be deleted.');
      toast.success(`${journal.reference} removed from this management report.`);
      setPendingDelete(null);
      await loadJournals();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Management journal could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  };

  const money = (value: number) => {
    try { return new Intl.NumberFormat(undefined, { style: currency ? 'currency' : 'decimal', currency: currency || undefined, maximumFractionDigits: 2 }).format(value); }
    catch { return `${currency || ''} ${value.toFixed(2)}`.trim(); }
  };

  return <><section id="management-manual-journals" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h3 className="text-sm font-semibold text-slate-900">Manual journals</h3><p className="mt-1 text-xs text-slate-500">Balanced closing entries for this management report, stored separately from Xero.</p></div>
      {canManage && <button type="button" onClick={() => { setLines([blankLine(), blankLine()]); setJournalDate(toDate); setFormOpen((open) => !open); }} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"><FilePlus2 className="h-4 w-4" />{formOpen ? 'Close form' : 'Add journal'}</button>}
    </div>
    {formOpen && canManage && <form onSubmit={submit} className="space-y-4 border-b border-cyan-200 bg-cyan-50/30 p-4">
      <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"><strong className="text-cyan-900">Management report only.</strong> This balanced journal is stored in PostgreSQL for this organisation and period. It is never sent or posted to Xero, and does not change Xero source balances.</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-slate-600">Journal date<input type="date" required min={fromDate} max={toDate} value={journalDate} onChange={(event) => setJournalDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-slate-600">Journal description<input required maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="e.g. Accrue professional fees" /></label></div>
      <div className="space-y-2">
        <div className="hidden grid-cols-[minmax(180px,1.5fr)_minmax(150px,1fr)_120px_120px_40px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid"><span>Account</span><span>Line description</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span /></div>
        {lines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[minmax(180px,1.5fr)_minmax(150px,1fr)_120px_120px_40px] sm:items-center">
          <select required aria-label={`Journal line ${index + 1} account`} value={line.accountId} onChange={(event) => updateLine(index, 'accountId', event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 text-xs"><option value="">Select Xero account…</option>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountCode ? `${account.accountCode} · ` : ''}${account.accountName}</option>)}</select>
          <input aria-label={`Journal line ${index + 1} description`} maxLength={500} value={line.description} onChange={(event) => updateLine(index, 'description', event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 text-xs" placeholder="Line description (optional)" />
          <input aria-label={`Journal line ${index + 1} debit`} type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(index, 'debit', event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 text-right text-xs tabular-nums" placeholder="Debit" />
          <input aria-label={`Journal line ${index + 1} credit`} type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(index, 'credit', event.target.value)} className="min-w-0 rounded-md border border-slate-200 px-2 py-2 text-right text-xs tabular-nums" placeholder="Credit" />
          <button type="button" aria-label={`Remove journal line ${index + 1}`} disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="justify-self-end rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>)}
        <button type="button" onClick={() => setLines((current) => [...current, blankLine()])} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"><Plus className="h-3.5 w-3.5" />Add line</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className="text-xs font-medium text-slate-600">Purpose / supporting reason<textarea required minLength={5} maxLength={2000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><div className="flex gap-5"><span>Debits <strong>{money(totals.debit)}</strong></span><span>Credits <strong>{money(totals.credit)}</strong></span></div><p className={`mt-1 font-semibold ${balanced ? 'text-emerald-700' : 'text-amber-700'}`}>{balanced ? 'Journal is balanced' : 'Debits and credits must balance'}</p></div></div>
      <button type="submit" disabled={saving || !balanced || accounts.length < 2} className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-800 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Saving journal…' : 'Save management journal'}</button>
    </form>}
    {loading ? <div className="flex items-center gap-2 p-4 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading journals…</div> : visibleJournals.length === 0 ? <p className="p-4 text-xs text-slate-500">No management-only journals for active accounts have been recorded for this period.</p> : <div className="divide-y divide-slate-200">{visibleJournals.map((journal) => <article key={journal.id} className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="text-sm font-semibold text-slate-800">{journal.description}</h4><p className="mt-1 text-[11px] text-slate-500">{journal.reference} · {journal.date} · Created by {journal.createdBy}</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-900">Management-only</span>{canManage && <button type="button" onClick={() => setPendingDelete(journal)} disabled={deletingId !== null} aria-label={`Delete management-only journal ${journal.reference}`} title="Delete this management-only journal. Xero will not be changed." className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete journal</button>}</div></div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Account</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr></thead><tbody className="divide-y divide-slate-100">{journal.lines.map((line, index) => <tr key={`${journal.id}-${line.accountId}-${index}`}><td className="px-3 py-2 font-medium text-slate-700">{line.accountCode ? `${line.accountCode} · ` : ''}{line.accountName}</td><td className="px-3 py-2 text-slate-500">{line.description || '—'}</td><td className="px-3 py-2 text-right tabular-nums">{line.debit ? money(line.debit) : '—'}</td><td className="px-3 py-2 text-right tabular-nums">{line.credit ? money(line.credit) : '—'}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[11px] text-slate-500">Purpose: {journal.reason}</p>
    </article>)}</div>}
  </section>{pendingDelete && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-management-journal-title" aria-describedby="delete-management-journal-description" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100"><ShieldAlert className="h-5 w-5" /></span><div className="min-w-0"><h2 id="delete-management-journal-title" className="text-base font-semibold text-slate-900">Delete management-only journal?</h2><p id="delete-management-journal-description" className="mt-1 text-sm leading-5 text-slate-600">This will permanently remove <strong className="text-slate-800">{pendingDelete.reference} · {pendingDelete.description}</strong> and its journal lines from this management report.</p><p className="mt-2 rounded-lg border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-xs leading-5 text-cyan-950">This entry is stored only in this application. Deleting it will not change Xero.</p></div></div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end"><button type="button" disabled={deletingId !== null} onClick={() => setPendingDelete(null)} className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="button" disabled={deletingId !== null} onClick={() => void deleteJournal(pendingDelete)} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60">{deletingId === pendingDelete.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{deletingId === pendingDelete.id ? 'Deleting journal…' : 'Delete journal'}</button></div>
    </div>
  </div>}</>;
}
