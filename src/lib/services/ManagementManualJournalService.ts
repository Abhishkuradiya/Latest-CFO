import crypto from 'node:crypto';
import { db, pgPool } from '@/lib/db';

type JsonRecord = Record<string, unknown>;
type JournalLineInput = { accountId?: unknown; debit?: unknown; credit?: unknown; description?: unknown };
type JournalActor = { userId: number; email: string };
export type ManagementManualJournalLine = {
  accountId: string; accountCode: string | null; accountName: string; classification: string;
  description: string; debit: number; credit: number; sourceClassification: 'MANAGEMENT_ONLY';
};
export type ManagementManualJournal = {
  id: number; reference: string; date: string; description: string; reason: string; createdBy: string;
  createdAt: string; sourceClassification: 'MANAGEMENT_ONLY'; lines: ManagementManualJournalLine[];
};

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function accountClass(account: JsonRecord) {
  const cls = String(account.Class ?? '').toUpperCase();
  const type = String(account.Type ?? '').toUpperCase();
  if (cls.includes('ASSET') || ['BANK', 'CURRENT', 'FIXED', 'INVENTORY', 'PREPAYMENT'].includes(type)) return 'Assets';
  if (cls.includes('LIABIL') || ['CURRLIAB', 'TERMLIAB', 'LIABILITY'].includes(type)) return 'Liabilities';
  if (cls.includes('EQUITY') || type === 'EQUITY') return 'Equity';
  if (cls.includes('REVENUE') || ['REVENUE', 'SALES', 'OTHERINCOME'].includes(type)) return 'Income';
  if (cls.includes('EXPENSE') || ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS', 'DEPRECIAT', 'OTHEREXPENSE'].includes(type)) return 'Expenses';
  return 'Other';
}

export async function listManagementManualJournals(tenantId: number, periodStart: string, periodEnd: string): Promise<ManagementManualJournal[]> {
  await db.assertPostgres();
  const result = await pgPool.query(
    `SELECT j.id, j.journal_ref, j.journal_date, j.description, j.reason,
            j.created_by_email, j.created_at, j.source_classification,
            COALESCE(json_agg(json_build_object(
              'accountId', l.account_id, 'accountCode', l.account_code,
              'accountName', l.account_name, 'classification', l.account_classification,
              'description', l.line_description, 'debit', l.debit, 'credit', l.credit,
              'sourceClassification', l.source_classification
            ) ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS lines
       FROM management_manual_journals j
       LEFT JOIN management_manual_journal_lines l ON l.journal_id = j.id AND l.tenant_id = j.tenant_id
      WHERE j.tenant_id = $1 AND j.journal_date BETWEEN $2 AND $3
      GROUP BY j.id ORDER BY j.journal_date, j.id`,
    [tenantId, periodStart, periodEnd],
  );
  return result.rows.map((row) => ({
    id: Number(row.id), reference: String(row.journal_ref), date: String(row.journal_date).slice(0, 10),
    description: String(row.description), reason: String(row.reason), createdBy: String(row.created_by_email),
    createdAt: new Date(String(row.created_at)).toISOString(), sourceClassification: 'MANAGEMENT_ONLY' as const,
    lines: Array.isArray(row.lines) ? row.lines.map((line: JsonRecord) => ({
      accountId: String(line.accountId), accountCode: line.accountCode == null ? null : String(line.accountCode),
      accountName: String(line.accountName), classification: String(line.classification),
      description: line.description == null ? '' : String(line.description), debit: Number(line.debit), credit: Number(line.credit),
      sourceClassification: 'MANAGEMENT_ONLY' as const,
    })) : [],
  }));
}

export async function createManagementManualJournal(
  tenantId: number,
  actor: JournalActor,
  input: JsonRecord,
) {
  await db.assertPostgres();
  const periodStart = String(input.periodStart ?? '');
  const periodEnd = String(input.periodEnd ?? '');
  const journalDate = String(input.journalDate ?? '');
  const description = String(input.description ?? '').trim();
  const reason = String(input.reason ?? '').trim();
  const lines = Array.isArray(input.lines) ? input.lines as JournalLineInput[] : [];
  if (!validDate(periodStart) || !validDate(periodEnd) || periodStart > periodEnd || !validDate(journalDate) || journalDate < periodStart || journalDate > periodEnd) {
    throw new Error('Choose a journal date within the selected reporting period.');
  }
  if (description.length < 3 || description.length > 500 || reason.length < 5 || reason.length > 2000) {
    throw new Error('Enter a description and a reason for this journal.');
  }
  if (lines.length < 2 || lines.length > 100) throw new Error('A journal must contain between 2 and 100 lines.');

  const sourceAccounts = await db.getPostgresReport(tenantId, 'Accounts_metadata');
  const accounts = new Map((Array.isArray(sourceAccounts) ? sourceAccounts : []).map((item) => {
    const account = item as JsonRecord;
    return [String(account.AccountID ?? ''), account] as const;
  }));
  let debitTotal = 0;
  let creditTotal = 0;
  const validatedLines = lines.map((line) => {
    const accountId = String(line.accountId ?? '').trim();
    const account = accounts.get(accountId);
    if (!account || String(account.Status ?? account.status ?? '').trim().toUpperCase() !== 'ACTIVE') throw new Error('Every journal line must use an active account from this Xero organisation.');
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || debit > 1_000_000_000_000 || credit > 1_000_000_000_000) throw new Error('Enter valid non-negative debit and credit amounts.');
    if (Math.abs(debit * 100 - Math.round(debit * 100)) > 1e-8 || Math.abs(credit * 100 - Math.round(credit * 100)) > 1e-8) throw new Error('Journal amounts may have no more than two decimal places.');
    if ((debit > 0) === (credit > 0)) throw new Error('Each journal line must have either a debit or a credit amount.');
    debitTotal += debit;
    creditTotal += credit;
    return {
      accountId,
      accountCode: account.Code == null ? null : String(account.Code),
      accountName: String(account.Name ?? 'Xero account'),
      classification: accountClass(account),
      description: String(line.description ?? '').trim().slice(0, 500), debit, credit,
    };
  });
  if (Math.abs(debitTotal - creditTotal) > 0.005) throw new Error('Total debits must equal total credits before the journal can be saved.');
  if (new Set(validatedLines.map((line) => line.accountId)).size < 2) throw new Error('Use at least two different Xero accounts in the journal.');

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const reference = `MJ-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
    const header = await client.query(
      `INSERT INTO management_manual_journals
        (tenant_id, journal_ref, period_start, period_end, journal_date, description, reason, created_by_user_id, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [tenantId, reference, periodStart, periodEnd, journalDate, description, reason, actor.userId, actor.email],
    );
    const journalId = Number(header.rows[0].id);
    for (const line of validatedLines) {
      await client.query(
        `INSERT INTO management_manual_journal_lines
          (tenant_id, journal_id, account_id, account_code, account_name, account_classification, line_description, debit, credit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenantId, journalId, line.accountId, line.accountCode, line.accountName, line.classification, line.description || null, line.debit, line.credit],
      );
    }
    await client.query('COMMIT');
    return { id: journalId, reference, date: journalDate, description, reason, createdBy: actor.email, sourceClassification: 'MANAGEMENT_ONLY' as const, lines: validatedLines };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteManagementManualJournal(tenantId: number, journalId: number) {
  await db.assertPostgres();
  if (!Number.isSafeInteger(journalId) || journalId <= 0) throw new Error('Choose a valid management journal.');
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT journal_ref FROM management_manual_journals
        WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, journalId],
    );
    if (!existing.rows[0]) {
      await client.query('COMMIT');
      return null;
    }

    // Delete dependent lines explicitly in the same tenant-scoped transaction.
    // The FK cascade remains a safeguard, while this makes cleanup unambiguous.
    await client.query(
      `DELETE FROM management_manual_journal_lines
        WHERE tenant_id = $1 AND journal_id = $2`,
      [tenantId, journalId],
    );
    await client.query(
      `DELETE FROM management_manual_journals
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, journalId],
    );
    await client.query('COMMIT');
    return String(existing.rows[0].journal_ref);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
