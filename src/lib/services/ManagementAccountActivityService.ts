import { db } from '@/lib/db';
import { XeroGeneralLedgerService } from '@/lib/generalLedgerService';

export type ManagementAccountActivityEntry = {
  date: string;
  type: string;
  description: string;
  reference: string;
  sourceId: string;
  debit: number;
  credit: number;
  runningBalance: number | null;
  currency: string;
  journalLines: { accountId: string; accountCode: string; accountName: string; description: string; debit: number; credit: number }[];
};

export type ManagementAccountActivity = {
  available: boolean;
  coverage: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN';
  message: string | null;
  transactions: ManagementAccountActivityEntry[];
};

export type ManagementAccountActivityTarget = {
  key: string;
  name: string;
  category: string;
  previous: number | null;
  accountId?: string;
  accountCode?: string;
};

function records(value: unknown): Record<string, unknown>[] {
  if (typeof value === 'string') {
    try { return records(JSON.parse(value)); } catch { return []; }
  }
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
  if (value && typeof value === 'object') {
    const wrapper = value as { raw_data?: unknown; Journals?: unknown; ManualJournals?: unknown };
    for (const nested of [wrapper.raw_data, wrapper.Journals, wrapper.ManualJournals]) {
      if (Array.isArray(nested)) return records(nested);
    }
  }
  return [];
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const explicit = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (explicit) return explicit[0];
  const millis = text.match(/\/Date\((-?\d+)/);
  const date = millis ? new Date(Number(millis[1])) : new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function amount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const text = value.trim().replace(/,/g, '');
  const isNegative = text.startsWith('(') && text.endsWith(')');
  const parsed = Number(text.replace(/[()]/g, ''));
  return Number.isFinite(parsed) ? (isNegative ? -parsed : parsed) : 0;
}

function accountMatches(target: ManagementAccountActivityTarget, line: Record<string, unknown>) {
  const lineId = String(line.AccountID ?? line.account_id ?? '').trim();
  const lineCode = String(line.AccountCode ?? line.account_code ?? '').trim();
  const lineName = String(line.AccountName ?? line.account_name ?? '').trim();
  // Prefer the stable Xero ID, but allow an exact code match when an older or
  // partial journal payload omits/changes its account ID field.
  if (target.accountId && lineId.toLowerCase() === target.accountId.toLowerCase()) return true;
  if (target.accountCode && lineCode === target.accountCode) return true;
  if ((target.accountId && lineId) || (target.accountCode && lineCode)) return false;
  return lineName.toLocaleLowerCase() === target.name.toLocaleLowerCase();
}

function buildActivities(targets: ManagementAccountActivityTarget[], journals: Record<string, unknown>[], manualJournals: Record<string, unknown>[], fromDate: string, toDate: string, activeAccountKeys?: Set<string>) {
  const output = new Map<string, ManagementAccountActivity>();
  const manualIdsInSystemJournals = new Set(journals.map((journal) => String(journal.SourceID ?? '')).filter(Boolean));
  for (const target of targets) {
    const matches: { date: string; type: string; description: string; reference: string; sourceId: string; debit: number; credit: number; currency: string; journalLines: ManagementAccountActivityEntry['journalLines'] }[] = [];
    const collect = (journal: Record<string, unknown>, isManual: boolean) => {
      if (isManual && journal.ManualJournalID && manualIdsInSystemJournals.has(String(journal.ManualJournalID))) return;
      const date = isoDate(isManual ? journal.Date ?? journal.DateUTC ?? journal.UpdatedDateUTC : journal.JournalDate ?? journal.Date);
      if (!date || date < fromDate || date > toDate) return;
      const lines = records(journal.JournalLines);
      const journalLines = lines.map((line) => {
        const signedAmount = amount(isManual ? line.LineAmount : line.NetAmount ?? line.LineAmount);
        return {
          accountId: String(line.AccountID ?? line.account_id ?? ''),
          accountCode: String(line.AccountCode ?? line.account_code ?? ''),
          accountName: String(line.AccountName ?? line.account_name ?? ''),
          description: String(line.Description ?? '').trim(),
          debit: signedAmount > 0 ? signedAmount : 0,
          credit: signedAmount < 0 ? Math.abs(signedAmount) : 0,
        };
      }).filter((line) => (line.debit > 0 || line.credit > 0) && (!activeAccountKeys || activeAccountKeys.has(line.accountId.toLowerCase()) || activeAccountKeys.has(`code:${line.accountCode}`) || activeAccountKeys.has(`name:${line.accountName.toLocaleLowerCase()}`)));
      const targetLines = journalLines.filter((line) => accountMatches(target, {
        AccountID: line.accountId, AccountCode: line.accountCode, AccountName: line.accountName,
      }));
      if (targetLines.length === 0) return;
      const reference = String(journal.Reference ?? journal.JournalNumber ?? journal.SourceID ?? journal.ManualJournalID ?? '').trim();
      const description = String(journal.Narration ?? journal.SourceType ?? (isManual ? 'Manual journal' : 'Journal entry')).trim();
      const type = isManual ? 'Xero manual journal' : String(journal.SourceType ?? 'Xero system journal');
      matches.push({
        date, type, description, reference,
        sourceId: String(journal.JournalID ?? journal.ManualJournalID ?? journal.JournalNumber ?? reference),
        debit: targetLines.reduce((sum, line) => sum + line.debit, 0),
        credit: targetLines.reduce((sum, line) => sum + line.credit, 0),
        currency: String(journal.CurrencyCode ?? ''), journalLines,
      });
    };
    journals.forEach((journal) => collect(journal, false));
    manualJournals.forEach((journal) => collect(journal, true));
    matches.sort((left, right) => `${left.date}|${left.reference}|${left.sourceId}`.localeCompare(`${right.date}|${right.reference}|${right.sourceId}`));

    const isCreditNormal = target.category.toLowerCase().includes('liabilit') || target.category.toLowerCase() === 'equity';
    let running = target.previous;
    const transactions = matches.map((entry) => {
      if (running !== null) running += isCreditNormal ? entry.credit - entry.debit : entry.debit - entry.credit;
      return { ...entry, runningBalance: running };
    });
    output.set(target.key, {
      available: transactions.length > 0,
      coverage: 'UNKNOWN',
      message: transactions.length ? null : 'Xero returned no journal entries for this account during the comparison period.',
      transactions,
    });
  }
  return output;
}

export async function loadManagementAccountActivities(tenantId: number, targets: ManagementAccountActivityTarget[], fromDate: string, toDate: string) {
  if (targets.length === 0) return new Map<string, ManagementAccountActivity>();
  const accountMetadata = await db.getPostgresReport(tenantId, 'Accounts_metadata');
  const activeAccountKeys = new Set<string>();
  if (Array.isArray(accountMetadata)) {
    for (const account of accountMetadata) {
      if (String(account.Status ?? account.status ?? '').trim().toUpperCase() !== 'ACTIVE') continue;
      const id = String(account.AccountID ?? '').trim().toLowerCase();
      const code = String(account.Code ?? '').trim();
      const name = String(account.Name ?? '').trim().toLocaleLowerCase();
      if (id) activeAccountKeys.add(id);
      if (code) activeAccountKeys.add(`code:${code}`);
      if (name) activeAccountKeys.add(`name:${name}`);
    }
  }
  let journals = records(await db.getPostgresReport(tenantId, 'Journals'));
  let manualJournals = records(await db.getPostgresReport(tenantId, 'ManualJournals'));
  let activities = buildActivities(targets, journals, manualJournals, fromDate, toDate, activeAccountKeys.size ? activeAccountKeys : undefined);

  // Refresh the journal feed while building the multi-account report, so opening
  // an account later can use already-persisted activity without a second fetch.
  // A non-empty cache can still be incomplete (for example, it may only contain
  // the first 1,000 entries), so also refresh a selected account with no matches.
  const selectedAccountHasNoActivity = targets.length === 1 && !activities.get(targets[0].key)?.available;
  const refreshForReport = targets.length > 1;
  let refreshWarning: string | null = null;
  let coverage: ManagementAccountActivity['coverage'] = 'UNKNOWN';
  const credentials = await db.getCredentials(tenantId, 'xero');
  const recordedScopes = Array.isArray(credentials?.scopes) ? credentials.scopes as string[] : null;
  const journalScopeMissing = recordedScopes !== null && !recordedScopes.includes('accounting.journals.read');
  if (journalScopeMissing) coverage = 'PARTIAL';
  const permissionWarning = 'This Xero connection does not include permission to retrieve system journal entries. Xero manual journals may still be shown, but the source activity is incomplete. A platform administrator must enable journal access for the Xero app and reconnect the organisation.';
  if (refreshForReport || (journals.length === 0 && manualJournals.length === 0) || selectedAccountHasNoActivity) {
    try {
      if (journalScopeMissing) {
        // Manual journals use a separate, normally available permission. Keep
        // those source entries current, but don't repeatedly call an endpoint
        // that this connection is known not to be authorised to access.
        await XeroGeneralLedgerService.syncManualJournals(tenantId, true);
        refreshWarning = permissionWarning;
        coverage = 'PARTIAL';
      } else {
        await XeroGeneralLedgerService.syncGeneralLedger(tenantId, true);
        coverage = 'COMPLETE';
      }
      journals = records(await db.getPostgresReport(tenantId, 'Journals'));
      manualJournals = records(await db.getPostgresReport(tenantId, 'ManualJournals'));
      activities = buildActivities(targets, journals, manualJournals, fromDate, toDate, activeAccountKeys.size ? activeAccountKeys : undefined);
    } catch (error) {
      console.warn('Unable to refresh Xero general ledger for Management Accounts:', error);
      refreshWarning = error instanceof Error ? error.message : 'Xero journal activity could not be refreshed.';
      coverage = journals.length || manualJournals.length ? 'PARTIAL' : 'UNAVAILABLE';
    }
  }
  if (refreshWarning) {
    for (const target of targets) {
      const activity = activities.get(target.key);
      if (!activity?.available) {
        activities.set(target.key, {
          available: false,
          coverage,
          message: refreshWarning,
          transactions: [],
        });
      }
    }
  }
  for (const target of targets) {
    const activity = activities.get(target.key);
    if (!activity) continue;
    const hasRows = activity.transactions.length > 0;
    activities.set(target.key, {
      ...activity,
      coverage: activity.coverage === 'UNKNOWN' ? coverage : activity.coverage,
      available: hasRows || coverage === 'COMPLETE',
      message: coverage === 'PARTIAL' && journalScopeMissing ? permissionWarning : activity.message === 'Xero returned no journal entries for this account during the comparison period.' && coverage === 'COMPLETE'
        ? null : activity.message,
    });
  }
  return activities;
}
