import { db, pgPool } from '@/lib/db';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { fetchXeroReport, fetchXeroResource, getXeroAccessToken } from '@/lib/xero';
import { calculateLedgerBalances, getLedgerReconciliationStatus, isManagementAccountsAdministrator } from '@/lib/services/ManagementLedgerAccounting';
import { loadManagementAccountActivities, type ManagementAccountActivityEntry } from '@/lib/services/ManagementAccountActivityService';
import { listManagementManualJournals } from '@/lib/services/ManagementManualJournalService';

type RecordValue = Record<string, unknown>;
type ReportRow = { RowType?: string; Title?: string; Cells?: { Value?: unknown; Attributes?: { Id?: string; Value?: string }[] }[]; Rows?: ReportRow[]; Summary?: ReportRow };
export type LedgerTransaction = {
  date: string; type: string; reference: string; description: string; contact: string;
  debit: number; credit: number; runningBalance: number | null; sourceId: string | null;
  journalLines: ManagementAccountActivityEntry['journalLines'];
  sourceClassification: 'XERO_SOURCE';
};

export type LedgerAccount = {
  accountId: string; accountCode: string; accountName: string; accountType: string;
  classification: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses' | 'Other';
  normalBalance: 'DEBIT' | 'CREDIT'; statement: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'OTHER';
  openingBalance: number | null; totalDebits: number | null; totalCredits: number | null;
  netMovement: number | null; sourceClosingBalance: number | null; adjustedClosingBalance: number | null;
  unresolvedDifference: number | null; reconciliationStatus: string;
  transactionEvidenceAvailable: boolean;
  sourceJournalCoverage: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN';
};

function record(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function isActiveXeroAccount(account: RecordValue) {
  return String(account.Status ?? account.status ?? '').trim().toUpperCase() === 'ACTIVE';
}
function amount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/,/g, '').replace(/[^\d.()-]/g, '');
  if (!text || text === '-') return null;
  const negative = text.startsWith('(') && text.endsWith(')');
  const parsed = Number(text.replace(/[()]/g, ''));
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : null;
}
function dateText(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const text = String(value);
  const direct = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const millis = text.match(/\/Date\((-?\d+)/)?.[1];
  const parsed = millis ? new Date(Number(millis)) : new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

async function loadOrganisationMetadata(tenantId: number, accessToken: string, xeroTenantId: string) {
  try {
    return await getOrFetchManagementReport(tenantId, 'Organisation', async () => (await fetchXeroResource(accessToken, xeroTenantId, 'Organisations'))[0] ?? null);
  } catch (error) {
    console.warn('Unable to load Xero organisation metadata:', error);
  }
  return db.getPostgresReport(tenantId, 'Organisation');
}

async function loadAccountMetadata(tenantId: number, accessToken: string, xeroTenantId: string) {
  const storedAccounts = await getOrFetchManagementReport(tenantId, 'Accounts_metadata', () => fetchXeroResource(accessToken, xeroTenantId, 'Accounts'));
  if (!Array.isArray(storedAccounts)) throw new Error('Xero accounts were not available after saving to PostgreSQL.');
  return storedAccounts;
}
function classification(account: RecordValue): LedgerAccount['classification'] {
  const cls = String(account.Class ?? account.class ?? '').toUpperCase();
  const type = String(account.Type ?? account.type ?? '').toUpperCase();
  if (cls.includes('ASSET') || ['BANK', 'CURRENT', 'FIXED', 'INVENTORY', 'PREPAYMENT'].includes(type)) return 'Assets';
  if (cls.includes('LIABIL') || ['CURRLIAB', 'TERMLIAB', 'LIABILITY'].includes(type)) return 'Liabilities';
  if (cls.includes('EQUITY') || type === 'EQUITY') return 'Equity';
  if (cls.includes('REVENUE') || ['REVENUE', 'SALES', 'OTHERINCOME'].includes(type)) return 'Income';
  if (cls.includes('EXPENSE') || ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS', 'DEPRECIAT', 'OTHEREXPENSE'].includes(type)) return 'Expenses';
  return 'Other';
}
function normalBalance(classificationValue: LedgerAccount['classification']): LedgerAccount['normalBalance'] {
  return classificationValue === 'Assets' || classificationValue === 'Expenses' ? 'DEBIT' : 'CREDIT';
}
function sourceAmounts(report: unknown) {
  const result = new Map<string, number>();
  const duplicateNames = new Set<string>();
  const rows = record(report).Rows;
  const visit = (items: ReportRow[]) => {
    for (const row of items) {
      if (row.RowType === 'Row' && Array.isArray(row.Cells) && row.Cells.length > 1) {
        const label = String(row.Cells[0]?.Value ?? '').trim();
        const value = amount(row.Cells[1]?.Value);
        const attrs = row.Cells.flatMap((cell) => cell.Attributes ?? []);
        const id = attrs.find((attr) => attr.Id?.toLowerCase() === 'accountid')?.Value;
        if (label && value !== null && !/^(total|net assets|net current assets|gross profit|net profit|operating profit)/i.test(label)) {
          if (id) result.set(String(id), value);
          const nameKey = `name:${label.toLocaleLowerCase()}`;
          if (result.has(nameKey)) { result.delete(nameKey); duplicateNames.add(nameKey); }
          if (!duplicateNames.has(nameKey)) result.set(nameKey, value);
        }
      }
      if (Array.isArray(row.Rows)) visit(row.Rows);
      if (row.Summary) visit([row.Summary]);
    }
  };
  if (Array.isArray(rows)) visit(rows as ReportRow[]);
  return result;
}
function statementFor(accountClass: LedgerAccount['classification']): LedgerAccount['statement'] {
  return ['Assets', 'Liabilities', 'Equity'].includes(accountClass) ? 'BALANCE_SHEET'
    : ['Income', 'Expenses'].includes(accountClass) ? 'PROFIT_AND_LOSS' : 'OTHER';
}
export function parseAccountTransactionReport(report: unknown, account: RecordValue, fromDate: string, toDate: string): {
  available: boolean; openingBalance: number | null; closingBalance: number | null; totalDebits: number | null;
  totalCredits: number | null; transactions: LedgerTransaction[]; warning: string | null;
} {
  const root = record(report);
  if (!Array.isArray(root.Rows)) return { available: false, openingBalance: null, closingBalance: null, totalDebits: null, totalCredits: null, transactions: [], warning: 'Xero did not return account transaction rows for this period.' };
  const column: Record<string, number> = {};
  const discover = (rows: ReportRow[]) => {
    for (const row of rows) {
      if (row.RowType === 'Header' && Array.isArray(row.Cells)) row.Cells.forEach((cell, i) => {
        const key = String(cell.Value ?? '').trim().toLowerCase();
        if (key.includes('date')) column.date = i;
        else if (key.includes('source') || key === 'type') column.type = i;
        else if (key.includes('description')) column.description = i;
        else if (key.includes('reference')) column.reference = i;
        else if (key === 'contact' || key.includes('contact name')) column.contact = i;
        else if (key.includes('debit')) column.debit = i;
        else if (key.includes('credit')) column.credit = i;
        else if (key.includes('balance')) column.balance = i;
      });
      if (Array.isArray(row.Rows)) discover(row.Rows);
    }
  };
  discover(root.Rows as ReportRow[]);
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  const transactions: LedgerTransaction[] = [];
  const walk = (rows: ReportRow[]) => {
    for (const row of rows) {
      const cells = row.Cells;
      if (Array.isArray(cells)) {
        const values = cells.map((cell) => String(cell.Value ?? '').trim());
        const labels = values.join(' ').toLowerCase();
        const balanceValue = amount(cells[column.balance ?? cells.length - 1]?.Value);
        if (/opening balance|balance brought forward/.test(labels) && balanceValue !== null) openingBalance = balanceValue;
        if (/closing balance|balance carried forward/.test(labels) && balanceValue !== null) closingBalance = balanceValue;
        const date = dateText(cells[column.date ?? 0]?.Value);
        if (row.RowType === 'Row' && date && date >= fromDate && date <= toDate) {
          const sourceId = cells.flatMap((cell) => cell.Attributes ?? []).find((attr) => /invoiceid|creditnoteid|banktransactionid|manualjournalid|paymentid/i.test(attr.Id ?? ''))?.Value ?? null;
          transactions.push({
            date,
            type: values[column.type ?? 1] || 'Xero transaction',
            description: values[column.description ?? 2] || '',
            reference: values[column.reference ?? 3] || '',
            contact: values[column.contact ?? -1] || '',
            debit: Math.abs(amount(cells[column.debit ?? 4]?.Value) ?? 0),
            credit: Math.abs(amount(cells[column.credit ?? 5]?.Value) ?? 0),
            runningBalance: amount(cells[column.balance ?? 9]?.Value),
            sourceId: sourceId ? String(sourceId) : null,
            journalLines: [],
            sourceClassification: 'XERO_SOURCE',
          });
        }
      }
      if (Array.isArray(row.Rows)) walk(row.Rows);
      if (row.Summary) walk([row.Summary]);
    }
  };
  walk(root.Rows as ReportRow[]);
  transactions.sort((a, b) => `${a.date}|${a.reference}`.localeCompare(`${b.date}|${b.reference}`));
  const totalDebits = transactions.reduce((sum, item) => sum + item.debit, 0);
  const totalCredits = transactions.reduce((sum, item) => sum + item.credit, 0);
  return {
    available: true,
    openingBalance,
    closingBalance,
    totalDebits,
    totalCredits,
    transactions,
    warning: transactions.length === 0 ? 'Xero returned no dated transaction rows for this period. The report balance is retained when present.' : null,
  };
}

export async function listManagementLedger(tenantId: number, fromDate: string, toDate: string) {
  await db.assertPostgres();
  const token = await getXeroAccessToken(tenantId);
  if (!token) return { connected: false, accounts: [], manualJournals: [], summary: null, currency: null, lastSyncedAt: null };
  const beforeStart = new Date(`${fromDate}T00:00:00.000Z`);
  beforeStart.setUTCDate(beforeStart.getUTCDate() - 1);
  const openingDate = beforeStart.toISOString().slice(0, 10);
  const [accountsRaw, pnlReport, openingBs, closingBs, org, manualJournals] = await Promise.all([
    loadAccountMetadata(tenantId, token.accessToken, token.xeroTenantId),
    getOrFetchManagementReport(tenantId, `ProfitAndLoss_${fromDate}_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'ProfitAndLoss', `fromDate=${fromDate}&toDate=${toDate}`)),
    getOrFetchManagementReport(tenantId, `BalanceSheet_${openingDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${openingDate}`)),
    getOrFetchManagementReport(tenantId, `BalanceSheet_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${toDate}`)),
    loadOrganisationMetadata(tenantId, token.accessToken, token.xeroTenantId),
    listManagementManualJournals(tenantId, fromDate, toDate),
  ]);
  await db.assertPostgres();
  const accounts = Array.isArray(accountsRaw) ? accountsRaw.map(record) : [];
  const openingValues = sourceAmounts(openingBs);
  const closingValues = sourceAmounts(closingBs);
  const pnlValues = sourceAmounts(pnlReport);
  const activeAccounts = accounts.filter(isActiveXeroAccount);
  const activeAccountIds = new Set(activeAccounts.map((account) => String(account.AccountID ?? '')).filter(Boolean));
  const activeManualJournals = manualJournals.filter((journal) => journal.lines.length > 0 && journal.lines.every((line) => activeAccountIds.has(line.accountId)));
  const activityTargets = activeAccounts.map((source) => {
    const id = String(source.AccountID ?? '');
    const name = String(source.Name ?? 'Unnamed Xero account');
    const accountClass = classification(source);
    const statement = statementFor(accountClass);
    const opening = openingValues.get(id) ?? openingValues.get(`name:${name.toLocaleLowerCase()}`) ?? null;
    return { key: id, name, category: accountClass, previous: statement === 'BALANCE_SHEET' ? opening : statement === 'PROFIT_AND_LOSS' ? 0 : null, accountId: id, accountCode: String(source.Code ?? '') };
  }).filter((target) => target.key);
  const activityByAccount = await loadManagementAccountActivities(tenantId, activityTargets, fromDate, toDate);
  const snapshotsById = new Map<string, RecordValue>();
  const snapshotRows: { id: string; transactions: ManagementAccountActivityEntry[]; parsed: RecordValue }[] = [];
  for (const source of activeAccounts) {
    const id = String(source.AccountID ?? '');
    if (!id) continue;
    const accountClass = classification(source);
    const statement = statementFor(accountClass);
    const name = String(source.Name ?? 'Unnamed Xero account');
    const opening = openingValues.get(id) ?? openingValues.get(`name:${name.toLocaleLowerCase()}`) ?? null;
    const activity = activityByAccount.get(id);
    const transactions = activity?.transactions ?? [];
    const available = Boolean(activity?.available);
    const coverage = activity?.coverage ?? 'UNKNOWN';
    const hasMovementEvidence = coverage === 'COMPLETE' || coverage === 'PARTIAL';
    const debits = hasMovementEvidence ? transactions.reduce((total, item) => total + item.debit, 0) : null;
    const credits = hasMovementEvidence ? transactions.reduce((total, item) => total + item.credit, 0) : null;
    const calculationOpening = statement === 'PROFIT_AND_LOSS' ? 0 : opening;
    const calculated = calculateLedgerBalances(calculationOpening, debits, credits, normalBalance(accountClass));
    const parsed: RecordValue = {
      available,
      coverage,
      openingBalance: statement === 'BALANCE_SHEET' ? opening : null,
      closingBalance: calculated.originalClosing,
      totalDebits: debits,
      totalCredits: credits,
      netMovement: calculated.netMovement,
      transactions,
      warning: activity?.message ?? null,
    };
    snapshotsById.set(id, parsed);
    snapshotRows.push({ id, transactions, parsed });
  }
  const snapshotClient = await pgPool.connect();
  try {
    await snapshotClient.query('BEGIN');
    for (const snapshot of snapshotRows) {
      await snapshotClient.query(
        `INSERT INTO management_account_ledger_snapshots (tenant_id, account_id, period_start, period_end, raw_report, parsed_ledger, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (tenant_id, account_id, period_start, period_end)
         DO UPDATE SET raw_report = EXCLUDED.raw_report, parsed_ledger = EXCLUDED.parsed_ledger, fetched_at = NOW()`,
        [tenantId, snapshot.id, fromDate, toDate, JSON.stringify(snapshot.transactions), JSON.stringify(snapshot.parsed)],
      );
    }
    await snapshotClient.query('COMMIT');
  } catch (error) {
    await snapshotClient.query('ROLLBACK');
    throw error;
  } finally { snapshotClient.release(); }
  const syncResult = await pgPool.query('SELECT last_synced_at FROM tenant_credentials WHERE tenant_id=$1 AND provider=$2 LIMIT 1', [tenantId, 'xero']);
  const syncedValue = syncResult.rows[0]?.last_synced_at;
  const ledgerAccounts: LedgerAccount[] = activeAccounts.map((source) => {
    const id = String(source.AccountID ?? '');
    const code = String(source.Code ?? '');
    const name = String(source.Name ?? 'Unnamed Xero account');
    const accountClass = classification(source);
    const statement = statementFor(accountClass);
    const normal = normalBalance(accountClass);
    const snapshot = snapshotsById.get(id);
    const journalSigned = activeManualJournals.reduce((total, journal) => total + journal.lines
      .filter((line) => line.accountId === id)
      .reduce((lineTotal, line) => lineTotal + (normal === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit), 0), 0);
    const sourceOpening = openingValues.get(id) ?? openingValues.get(`name:${name.toLocaleLowerCase()}`) ?? null;
    const sourceClosing = statement === 'BALANCE_SHEET'
      ? closingValues.get(id) ?? closingValues.get(`name:${name.toLocaleLowerCase()}`) ?? null
      : statement === 'PROFIT_AND_LOSS' ? pnlValues.get(id) ?? pnlValues.get(`name:${name.toLocaleLowerCase()}`) ?? null : null;
    const openingBalance = snapshot ? amount(snapshot.openingBalance) : sourceOpening;
    const totalDebits = snapshot ? amount(snapshot.totalDebits) : null;
    const totalCredits = snapshot ? amount(snapshot.totalCredits) : null;
    const netMovement = statement === 'BALANCE_SHEET' && sourceClosing !== null && sourceOpening !== null
      ? sourceClosing - sourceOpening
      : statement === 'PROFIT_AND_LOSS' ? sourceClosing : snapshot ? amount(snapshot.netMovement) : null;
    // Management-only journals affect the pro forma closing balance, never
    // the comparison with Xero's unadjusted source activity.
    const activityClosingBalance = snapshot && snapshot.closingBalance !== null ? Number(snapshot.closingBalance) : null;
    const independentClosing = sourceClosing;
    const sourceCoverage = (snapshot?.coverage as LedgerAccount['sourceJournalCoverage'] | undefined) ?? 'UNKNOWN';
    const managementBase = activityClosingBalance ?? (sourceCoverage === 'PARTIAL' && openingBalance !== null ? openingBalance : null);
    const adjustedClosingBalance = managementBase === null ? null : managementBase + journalSigned;
    const unresolvedDifference = independentClosing !== null && adjustedClosingBalance !== null ? independentClosing - adjustedClosingBalance : null;
    return {
      accountId: id, accountCode: code, accountName: name, accountType: String(source.Type ?? ''),
      classification: accountClass, normalBalance: normal, statement,
      openingBalance, totalDebits, totalCredits, netMovement,
      sourceClosingBalance: independentClosing,
      adjustedClosingBalance,
      unresolvedDifference,
      reconciliationStatus: getLedgerReconciliationStatus({
        independentClosing,
        adjustedClosing: activityClosingBalance,
        difference: independentClosing !== null && activityClosingBalance !== null ? independentClosing - activityClosingBalance : null,
        approvedAdjustmentCount: 0,
        pendingAdjustmentCount: 0,
        transactionEvidenceAvailable: sourceCoverage === 'COMPLETE' && Boolean(snapshot?.available),
      }),
      transactionEvidenceAvailable: Boolean(snapshot?.available),
      sourceJournalCoverage: sourceCoverage,
    };
  });
  const fullyReconciled = ledgerAccounts.filter((a) => a.reconciliationStatus === 'Matches Xero activity').length;
  const needsReview = ledgerAccounts.filter((a) => a.reconciliationStatus === 'Difference outstanding').length;
  const unresolved = ledgerAccounts.filter((a) => a.unresolvedDifference !== null && Math.abs(a.unresolvedDifference) > 0.01).length;
  const evidenceUnavailable = ledgerAccounts.filter((a) => a.reconciliationStatus === 'Evidence unavailable').length;
  return {
    connected: true,
    accounts: ledgerAccounts,
    manualJournals: activeManualJournals,
    summary: { totalAccounts: ledgerAccounts.length, reconciledAccounts: fullyReconciled, accountsRequiringReview: needsReview, unresolvedDifferences: unresolved, evidenceUnavailable },
    currency: String(record(org).BaseCurrency ?? ''),
    lastSyncedAt: syncedValue ? new Date(syncedValue).toISOString() : null,
    openingDate,
    selectedDate: toDate,
  };
}

/** Lightweight ledger payload for exports: uses the report snapshots already stored in PostgreSQL and
 * avoids refreshing the organisation-wide journal feed just to build a PDF or workbook. */
export async function getManagementLedgerExportData(tenantId: number, fromDate: string, toDate: string) {
  await db.assertPostgres();
  const token = await getXeroAccessToken(tenantId);
  if (!token) return { connected: false, accounts: [], manualJournals: [], currency: null, lastSyncedAt: null };
  const priorDate = new Date(`${fromDate}T00:00:00.000Z`);
  priorDate.setUTCDate(priorDate.getUTCDate() - 1);
  const openingDate = priorDate.toISOString().slice(0, 10);
  const [storedAccounts, pnlReport, openingReport, balanceReport, journals, organisation] = await Promise.all([
    db.getPostgresReport(tenantId, 'Accounts_metadata'),
    getOrFetchManagementReport(tenantId, `ProfitAndLoss_${fromDate}_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'ProfitAndLoss', `fromDate=${fromDate}&toDate=${toDate}`)),
    getOrFetchManagementReport(tenantId, `BalanceSheet_${openingDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${openingDate}`)),
    getOrFetchManagementReport(tenantId, `BalanceSheet_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${toDate}`)),
    listManagementManualJournals(tenantId, fromDate, toDate),
    db.getPostgresReport(tenantId, 'Organisation'),
  ]);
  const accounts = Array.isArray(storedAccounts) ? storedAccounts.map(record).filter(isActiveXeroAccount) : [];
  const activeIds = new Set(accounts.map((account) => String(account.AccountID ?? '')).filter(Boolean));
  const activeJournals = journals.filter((journal) => journal.lines.length > 0 && journal.lines.every((line) => activeIds.has(line.accountId)));
  const pnlValues = sourceAmounts(pnlReport);
  const openingValues = sourceAmounts(openingReport);
  const balanceValues = sourceAmounts(balanceReport);
  const accountsById = new Map(accounts.map((account) => [String(account.AccountID ?? ''), account]));
  const signedAdjustments = new Map<string, number>();
  const adjustmentCounts = new Map<string, number>();
  for (const journal of activeJournals) {
    for (const line of journal.lines) {
      const account = accountsById.get(line.accountId);
      if (!account) continue;
      const accountClass = classification(account);
      const signed = normalBalance(accountClass) === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit;
      signedAdjustments.set(line.accountId, (signedAdjustments.get(line.accountId) ?? 0) + signed);
      adjustmentCounts.set(line.accountId, (adjustmentCounts.get(line.accountId) ?? 0) + 1);
    }
  }
  return {
    connected: true,
    accounts: accounts.map((account) => {
      const accountId = String(account.AccountID ?? '');
      const accountName = String(account.Name ?? 'Unnamed Xero account');
      const accountClass = classification(account);
      const statement = statementFor(accountClass);
      const balances = statement === 'BALANCE_SHEET' ? balanceValues : statement === 'PROFIT_AND_LOSS' ? pnlValues : new Map<string, number>();
      const closing = balances.get(accountId) ?? balances.get(`name:${accountName.toLocaleLowerCase()}`) ?? null;
      const signed = signedAdjustments.get(accountId) ?? 0;
      return {
        accountId,
        accountCode: String(account.Code ?? ''),
        accountName,
        classification: accountClass,
        openingBalance: statement === 'BALANCE_SHEET' ? openingValues.get(accountId) ?? openingValues.get(`name:${accountName.toLocaleLowerCase()}`) ?? null : null,
        totalDebits: null,
        totalCredits: null,
        netMovement: null,
        sourceClosingBalance: closing,
        adjustedClosingBalance: closing === null ? null : closing + signed,
        unresolvedDifference: closing === null ? null : closing - (closing + signed),
        reconciliationStatus: 'Evidence unavailable',
        adjustmentCount: adjustmentCounts.get(accountId) ?? 0,
        pendingAdjustmentCount: 0,
      };
    }),
    manualJournals: activeJournals,
    currency: String(record(organisation).BaseCurrency ?? ''),
    lastSyncedAt: null,
  };
}

export async function loadLedgerAccountDetail(tenantId: number, accountId: string, fromDate: string, toDate: string) {
  await db.assertPostgres();
  const token = await getXeroAccessToken(tenantId);
  if (!token) throw new Error('Xero is not connected.');
  const accountsRaw = await loadAccountMetadata(tenantId, token.accessToken, token.xeroTenantId);
  const source = (Array.isArray(accountsRaw) ? accountsRaw.map(record) : []).find((item) => String(item.AccountID ?? '') === accountId && isActiveXeroAccount(item));
  if (!source) throw new Error('The requested account is not active in this Xero organisation.');
  const account: RecordValue = { ...source, AccountID: accountId };
  const accountClass = classification(account);
  const normal = normalBalance(accountClass);
  const priorDate = new Date(`${fromDate}T00:00:00.000Z`);
  priorDate.setUTCDate(priorDate.getUTCDate() - 1);
  const openingDate = priorDate.toISOString().slice(0, 10);
  const [openingReport, balanceReport, pnlReport] = await Promise.all([
    getOrFetchManagementReport(tenantId, `BalanceSheet_${openingDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${openingDate}`)),
    getOrFetchManagementReport(tenantId, `BalanceSheet_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'BalanceSheet', `date=${toDate}`)),
    ['Income', 'Expenses'].includes(accountClass)
      ? getOrFetchManagementReport(tenantId, `ProfitAndLoss_${fromDate}_${toDate}`, () => fetchXeroReport(token.accessToken, token.xeroTenantId, 'ProfitAndLoss', `fromDate=${fromDate}&toDate=${toDate}`))
      : Promise.resolve(null),
  ]);
  const openingValues = sourceAmounts(openingReport);
  const independentMap = sourceAmounts(balanceReport);
  const pnlValues = sourceAmounts(pnlReport);
  const accountName = String(account.Name ?? '');
  const opening = openingValues.get(accountId) ?? openingValues.get(`name:${accountName.toLocaleLowerCase()}`) ?? null;
  const independentClosing = (['Income', 'Expenses'].includes(accountClass) ? pnlValues : independentMap).get(accountId)
    ?? (['Income', 'Expenses'].includes(accountClass) ? pnlValues : independentMap).get(`name:${accountName.toLocaleLowerCase()}`) ?? null;
  const activityMap = await loadManagementAccountActivities(tenantId, [{
    key: accountId, name: accountName, category: accountClass, previous: opening,
    accountId, accountCode: String(account.Code ?? ''),
  }], fromDate, toDate);
  const activity = activityMap.get(accountId);
  const transactions: LedgerTransaction[] = (activity?.transactions ?? []).map((item) => ({
    date: item.date,
    type: item.type,
    reference: item.reference,
    description: item.description,
    contact: '',
    debit: item.debit,
    credit: item.credit,
    runningBalance: item.runningBalance,
    sourceId: item.sourceId,
    journalLines: item.journalLines,
    sourceClassification: 'XERO_SOURCE',
  }));
  const sourceCoverage = activity?.coverage ?? 'UNKNOWN';
  const hasMovementEvidence = sourceCoverage === 'COMPLETE' || sourceCoverage === 'PARTIAL';
  const totalDebits = hasMovementEvidence ? transactions.reduce((sum, item) => sum + item.debit, 0) : null;
  const totalCredits = hasMovementEvidence ? transactions.reduce((sum, item) => sum + item.credit, 0) : null;
  const calculated = calculateLedgerBalances(opening, totalDebits, totalCredits, normal);
  const netMovement = calculated.netMovement;
  const calculatedClosing = calculated.originalClosing ?? (sourceCoverage === 'PARTIAL' && opening !== null ? opening : null);
  const allManualJournals = await listManagementManualJournals(tenantId, fromDate, toDate);
  const activeAccountIds = new Set((Array.isArray(accountsRaw) ? accountsRaw.map(record) : []).filter(isActiveXeroAccount).map((item) => String(item.AccountID ?? '')).filter(Boolean));
  const manualJournals = allManualJournals.filter((journal) => journal.lines.some((line) => line.accountId === accountId) && journal.lines.every((line) => activeAccountIds.has(line.accountId)));
  const journalSigned = manualJournals.reduce((total, journal) => total + journal.lines
    .filter((line) => line.accountId === accountId)
    .reduce((lineTotal, line) => lineTotal + (normal === 'DEBIT' ? line.debit - line.credit : line.credit - line.debit), 0), 0);
  const adjustedClosing = calculatedClosing === null ? null : calculatedClosing + journalSigned;
  // Reconciliation compares the source report with unadjusted Xero activity.
  // App-only closing journals must never reduce the source variance.
  const sourceDifference = independentClosing !== null && calculatedClosing !== null ? independentClosing - calculatedClosing : null;
  const difference = independentClosing !== null && adjustedClosing !== null ? independentClosing - adjustedClosing : null;
  const parsedLedger = {
    available: Boolean(activity?.available), openingBalance: opening, closingBalance: calculatedClosing,
    totalDebits, totalCredits, netMovement,
    independentClosingBalance: independentClosing, adjustedClosingBalance: adjustedClosing,
    unresolvedDifference: sourceDifference, transactions, coverage: sourceCoverage, warning: activity?.message ?? (!activity?.available ? 'Xero journal detail is not available for this account and period.' : null),
  };
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO management_account_ledger_snapshots (tenant_id, account_id, period_start, period_end, raw_report, parsed_ledger, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (tenant_id, account_id, period_start, period_end)
       DO UPDATE SET raw_report = EXCLUDED.raw_report, parsed_ledger = EXCLUDED.parsed_ledger, fetched_at = NOW()`,
      [tenantId, accountId, fromDate, toDate, JSON.stringify(transactions), JSON.stringify(parsedLedger)],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  await db.assertPostgres();
  const status = getLedgerReconciliationStatus({
    independentClosing,
    adjustedClosing: calculatedClosing,
    difference: sourceDifference,
    approvedAdjustmentCount: 0,
    pendingAdjustmentCount: 0,
    transactionEvidenceAvailable: sourceCoverage === 'COMPLETE' && Boolean(activity?.available),
  });
  return {
    account: { accountId, accountCode: String(account.Code ?? ''), accountName, accountType: String(account.Type ?? ''), classification: accountClass, normalBalance: normal },
    period: { fromDate, toDate },
    balances: { opening, xeroReported: independentClosing, independentReported: independentClosing, totalDebits, totalCredits, netMovement, adjusted: adjustedClosing, difference },
    transactions,
    manualJournals,
    status,
    sourceClassification: 'XERO_SOURCE',
    transactionEvidenceAvailable: sourceCoverage === 'COMPLETE' && Boolean(activity?.available),
    sourceJournalCoverage: sourceCoverage,
    warning: activity?.message ?? (!activity?.available ? 'Xero journal detail is not available for this account and period.' : null),
  };
}

export async function requireManagementAccountsAdmin(role: string) {
  return isManagementAccountsAdministrator(role);
}

