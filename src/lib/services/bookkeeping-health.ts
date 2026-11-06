/* eslint-disable @typescript-eslint/no-explicit-any -- Raw Xero JSON is intentionally inspected without dropping provider fields. */
import { db } from '@/lib/db';
import { createHash } from 'node:crypto';

type JsonRecord = Record<string, any>;
export type BookkeepingPeriod = { startDate?: string; endDate?: string };

const SOURCE_TYPES = ['Invoices', 'CreditNotes', 'BankTransactions', 'Accounts_metadata', 'TaxRates', 'Contacts', 'Payments', 'Prepayments', 'Overpayments', 'ManualJournals'] as const;
const REQUIRED_SOURCES = ['Invoices', 'BankTransactions', 'Accounts_metadata', 'TaxRates', 'Contacts'] as const;

export type BookkeepingFinding = {
  issueKey: string;
  ruleCode: string;
  title: string;
  category: string;
  severity: 'CRITICAL' | 'REVIEW_REQUIRED' | 'DATA_QUALITY' | 'MONITORING';
  transactionType: string;
  sourceId: string | null;
  relatedSourceIds: string[];
  contactName: string | null;
  reference: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null;
  explanation: string;
  evidence: string[];
  xeroUrl: string | null;
  relatedRecords?: JsonRecord[];
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS bookkeeping_health_scans (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          status VARCHAR(24) NOT NULL CHECK (status IN ('COMPLETE','PARTIAL','INCOMPLETE')),
          summary JSONB NOT NULL,
          source_status JSONB NOT NULL,
          quality JSONB NOT NULL,
          risk JSONB NOT NULL,
          scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, id)
        );
        CREATE INDEX IF NOT EXISTS bookkeeping_health_scans_tenant_date_idx ON bookkeeping_health_scans (tenant_id, scanned_at DESC);
        CREATE TABLE IF NOT EXISTS bookkeeping_health_issues (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          issue_key VARCHAR(500) NOT NULL,
          latest_scan_id BIGINT,
          status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','IGNORED','KEEP_BOTH')),
          assigned_to VARCHAR(255),
          internal_note TEXT,
          details JSONB NOT NULL,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, issue_key)
        );
        CREATE INDEX IF NOT EXISTS bookkeeping_health_issues_tenant_status_idx ON bookkeeping_health_issues (tenant_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS bookkeeping_health_issues_tenant_key_idx ON bookkeeping_health_issues (tenant_id, issue_key);
        CREATE TABLE IF NOT EXISTS bookkeeping_health_audit_logs (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          issue_key VARCHAR(500),
          actor_user_id INTEGER,
          actor_email VARCHAR(255),
          action VARCHAR(40) NOT NULL,
          previous_status VARCHAR(24),
          new_status VARCHAR(24),
          note TEXT,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS bookkeeping_health_audit_tenant_date_idx ON bookkeeping_health_audit_logs (tenant_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS bookkeeping_health_ai_recommendations (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          scan_id BIGINT REFERENCES bookkeeping_health_scans(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          explanation TEXT NOT NULL,
          evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
          suggested_action TEXT NOT NULL,
          confidence NUMERIC(5,2),
          model VARCHAR(160) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'REVIEW' CHECK (status IN ('REVIEW','ACCEPTED','REJECTED')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS bookkeeping_health_ai_tenant_date_idx ON bookkeeping_health_ai_recommendations (tenant_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS bookkeeping_health_close_checks (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          checklist_key VARCHAR(80) NOT NULL,
          label VARCHAR(180) NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETE')),
          assigned_to VARCHAR(255),
          expected_date DATE,
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMPTZ,
          note TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, checklist_key)
        );
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function val(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function numberOrNull(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function stableIssueKey(signature: string) {
  return `${signature.split(':', 2).join(':')}:${createHash('sha256').update(signature).digest('hex')}`;
}

function xeroDate(...values: unknown[]): string | null {
  for (const value of values) {
    if (!value) continue;
    const raw = String(value);
    const millis = raw.match(/Date\((\d+)/)?.[1];
    const date = millis ? new Date(Number(millis)) : new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function sourceId(item: JsonRecord): string | null {
  return val(item.InvoiceID, item.CreditNoteID, item.BankTransactionID, item.TransactionID, item.ManualJournalID, item.id, item.external_id);
}

function sourceUrl(type: string, id: string | null): string | null {
  if (!id) return null;
  const path = type === 'BILL' ? 'AccountsPayable/View/' : type === 'INVOICE' ? 'AccountsReceivable/View/' : type === 'CREDIT_NOTE' ? 'AccountsReceivable/CreditNotes/' : null;
  return path ? `https://go.xero.com/${path}${encodeURIComponent(id)}` : null;
}

function inPeriod(record: JsonRecord, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return true;
  const date = xeroDate(record.Date, record.date, record.invoice_date, record.JournalDate, record.journal_date, record.PaymentDate);
  return Boolean(date && (!startDate || date >= startDate) && (!endDate || date <= endDate));
}

async function readSources(tenantId: number, period: BookkeepingPeriod = {}) {
  if (!db.isPgActive()) throw new Error('PostgreSQL is unavailable. Bookkeeping Health requires persisted Xero data.');
  const [reports, credentials] = await Promise.all([
    db.query(`SELECT report_type, raw_data, updated_at, created_at FROM reports WHERE tenant_id = $1 AND report_type = ANY($2::varchar[])`, [tenantId, [...SOURCE_TYPES]]),
    db.query(`SELECT tenant_identifier, last_synced_at FROM tenant_credentials WHERE tenant_id = $1 AND provider = 'xero' LIMIT 1`, [tenantId])
  ]);
  const map = new Map<string, JsonRecord>();
  for (const row of reports.rows) map.set(row.report_type, {
    data: row.raw_data,
    updatedAt: row.updated_at ?? row.created_at ?? null
  });
  const sourceStatus = Object.fromEntries(SOURCE_TYPES.map((source) => {
    const record = map.get(source);
    const value = record?.data;
    return [source, {
      available: value !== undefined && value !== null,
      count: Array.isArray(value) ? value.length : value ? 1 : 0,
      updatedAt: record?.updatedAt ?? null
    }];
  }));
  const allBankTransactions = list(map.get('BankTransactions')?.data);
  return {
    map,
    sourceStatus,
    connected: Boolean(credentials.rows[0]?.tenant_identifier),
    lastSyncedAt: credentials.rows[0]?.last_synced_at ?? null,
    invoices: list(map.get('Invoices')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    creditNotes: list(map.get('CreditNotes')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    bankTransactions: list(map.get('BankTransactions')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    reconciliationFieldAvailable: allBankTransactions.some((record) => typeof (record.IsReconciled ?? record.is_reconciled ?? record.Reconciled ?? record.reconciled) === 'boolean'),
    accounts: list(map.get('Accounts_metadata')?.data),
    taxRates: list(map.get('TaxRates')?.data),
    contacts: list(map.get('Contacts')?.data),
    payments: list(map.get('Payments')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    prepayments: list(map.get('Prepayments')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    overpayments: list(map.get('Overpayments')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate)),
    manualJournals: list(map.get('ManualJournals')?.data).filter((row) => inPeriod(row, period.startDate, period.endDate))
  };
}

function detectFindings(sources: Awaited<ReturnType<typeof readSources>>): BookkeepingFinding[] {
  const findings = new Map<string, BookkeepingFinding>();
  const add = (finding: BookkeepingFinding) => findings.set(finding.issueKey, finding);
  const allInvoices = [...sources.invoices, ...sources.creditNotes];

  const dupGroups = new Map<string, JsonRecord[]>();
  for (const record of allInvoices) {
    const rawType = val(record.Type, record.type, record.CreditNoteType)?.toUpperCase() ?? 'INVOICE';
    const type = rawType === 'ACCPAY' || rawType === 'ACCPAYCREDIT' ? 'BILL' : rawType.includes('CREDIT') || record.CreditNoteID ? 'CREDIT_NOTE' : 'INVOICE';
    const status = val(record.Status, record.status)?.toUpperCase();
    if (['VOIDED', 'DELETED', 'DRAFT'].includes(status ?? '')) continue;
    const contact = val(record.Contact?.ContactID, record.Contact?.Name, record.contact_id, record.contact_name)?.toLowerCase();
    const reference = val(record.InvoiceNumber, record.CreditNoteNumber, record.Reference, record.invoice_number)?.toLowerCase();
    const amount = numberOrNull(record.Total, record.total, record.Amount);
    const currency = val(record.CurrencyCode, record.currency) ?? '';
    if (!contact || !reference || amount === null) continue;
    const date = xeroDate(record.Date, record.date);
    const description = list(record.LineItems ?? record.line_items).map((line) => val(line.Description, line.description)?.toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean).join('|');
    const key = stableIssueKey(`DUPLICATE:${type}:${contact}:${reference}:${amount.toFixed(2)}:${currency}:${date ?? ''}:${description}`);
    dupGroups.set(key, [...(dupGroups.get(key) ?? []), record]);
  }
  for (const [key, group] of dupGroups) {
    if (group.length < 2) continue;
    const first = group[0];
    const rawType = val(first.Type, first.type, first.CreditNoteType)?.toUpperCase() ?? 'INVOICE';
    const type = rawType === 'ACCPAY' || rawType === 'ACCPAYCREDIT' ? 'BILL' : rawType.includes('CREDIT') || first.CreditNoteID ? 'CREDIT_NOTE' : 'INVOICE';
    const ids = group.map(sourceId).filter((id): id is string => Boolean(id));
    const amount = numberOrNull(first.Total, first.total, first.Amount);
    add({
      issueKey: key, ruleCode: 'POTENTIAL_DUPLICATE', title: `Potential duplicate ${type.toLowerCase().replace('_', ' ')}`,
      category: 'DUPLICATE', severity: 'REVIEW_REQUIRED', transactionType: type, sourceId: ids[0] ?? null,
      relatedSourceIds: ids.slice(1), contactName: val(first.Contact?.Name, first.contact_name),
      reference: val(first.InvoiceNumber, first.CreditNoteNumber, first.Reference, first.invoice_number), amount,
      currency: val(first.CurrencyCode, first.currency), date: xeroDate(first.Date, first.date),
      explanation: `${group.length} active records match on contact, reference, amount, currency, date and line description. This is a candidate for review, not a confirmed duplicate.`,
      evidence: [`Matching record count: ${group.length}`, `Contact, reference, amount, currency, date and line description match`, `Reference: ${val(first.InvoiceNumber, first.CreditNoteNumber, first.Reference) ?? 'not supplied'}`, `Amount: ${amount ?? 'not supplied'} ${val(first.CurrencyCode, first.currency) ?? ''}`],
      xeroUrl: sourceUrl(type, ids[0] ?? null),
      relatedRecords: group.map((record) => ({
        sourceId: sourceId(record),
        contactName: val(record.Contact?.Name, record.contact_name),
        reference: val(record.InvoiceNumber, record.CreditNoteNumber, record.Reference, record.invoice_number),
        date: xeroDate(record.Date, record.date),
        amount: numberOrNull(record.Total, record.total, record.Amount),
        currency: val(record.CurrencyCode, record.currency),
        status: val(record.Status, record.status)
      }))
    });
  }

  const bankDuplicateGroups = new Map<string, JsonRecord[]>();
  for (const record of sources.bankTransactions) {
    const id = sourceId(record);
    const accountId = val(record.BankAccount?.AccountID, record.BankAccountID, record.bank_account_id);
    const date = xeroDate(record.Date, record.date);
    const amount = numberOrNull(record.Total, record.total, record.Amount, record.amount);
    const type = val(record.Type, record.type)?.toUpperCase();
    const reference = val(record.Reference, record.reference)?.toLowerCase().replace(/\s+/g, ' ').trim();
    const description = val(record.LineItems?.[0]?.Description, record.Description, record.description)?.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!id || !accountId || !date || amount === null || !type || (!reference && !description)) continue;
    const key = stableIssueKey(`DUPLICATE:BANK_TRANSACTION:${accountId}:${date}:${amount.toFixed(2)}:${type}:${reference ?? ''}:${description ?? ''}`);
    bankDuplicateGroups.set(key, [...(bankDuplicateGroups.get(key) ?? []), record]);
  }
  for (const [key, group] of bankDuplicateGroups) {
    if (group.length < 2) continue;
    const first = group[0];
    const ids = group.map(sourceId).filter((id): id is string => Boolean(id));
    const amount = numberOrNull(first.Total, first.total, first.Amount, first.amount);
    const date = xeroDate(first.Date, first.date);
    const reference = val(first.Reference, first.reference);
    add({ issueKey: key, ruleCode: 'POTENTIAL_DUPLICATE_BANK_TRANSACTION', title: 'Potential duplicate bank transaction', category: 'DUPLICATE', severity: 'REVIEW_REQUIRED',
      transactionType: 'BANK_TRANSACTION', sourceId: ids[0] ?? null, relatedSourceIds: ids.slice(1), contactName: val(first.Contact?.Name), reference, amount,
      currency: val(first.CurrencyCode, first.currency), date, explanation: `${group.length} bank transactions match on account, date, amount, type and the available reference/description fields. This is a review candidate, not a confirmed duplicate.`,
      evidence: ['Bank account, date, amount and transaction type match', `Reference: ${reference ?? 'not supplied'}`, `Description: ${val(first.LineItems?.[0]?.Description, first.Description, first.description) ?? 'not supplied'}`],
      xeroUrl: null, relatedRecords: group.map((record) => ({ sourceId: sourceId(record), contactName: val(record.Contact?.Name), reference: val(record.Reference, record.reference), date: xeroDate(record.Date, record.date), amount: numberOrNull(record.Total, record.total, record.Amount, record.amount), currency: val(record.CurrencyCode, record.currency), status: val(record.Status, record.status) }))
    });
  }

  const accountByCode = new Map(sources.accounts.map((account) => [val(account.Code, account.code) ?? '', account]));
  for (const record of allInvoices) {
    const status = val(record.Status, record.status)?.toUpperCase();
    if (['VOIDED', 'DELETED', 'DRAFT'].includes(status ?? '')) continue;
    const id = sourceId(record);
    const rawType = val(record.Type, record.type, record.CreditNoteType)?.toUpperCase() ?? 'INVOICE';
    const type = rawType === 'ACCPAY' || rawType === 'ACCPAYCREDIT' ? 'BILL' : rawType.includes('CREDIT') || record.CreditNoteID ? 'CREDIT_NOTE' : 'INVOICE';
    const contact = val(record.Contact?.Name, record.contact_name, record.contactName);
    const reference = val(record.InvoiceNumber, record.CreditNoteNumber, record.Reference, record.invoice_number);
    const amount = numberOrNull(record.Total, record.total, record.AmountDue);
    const date = xeroDate(record.Date, record.invoice_date);
    const lines = list(record.LineItems ?? record.line_items);
    const flags: string[] = [];
    if (!date) flags.push('Transaction date is missing or invalid.');
    if (!contact) flags.push('Contact is not present in the stored transaction.');
    if (!reference) flags.push('Invoice, bill or credit-note reference is missing.');
    if (amount === null) flags.push('Transaction total is missing or not numeric in the stored record.');
    for (const line of lines) {
      const accountCode = val(line.AccountCode, line.account_code);
      const accountName = val(accountByCode.get(accountCode ?? '')?.Name, accountByCode.get(accountCode ?? '')?.name);
      if (!accountCode) flags.push('At least one line has no account code.');
      else if (sources.sourceStatus.Accounts_metadata.available && !accountByCode.has(accountCode)) flags.push(`Account code ${accountCode} is not present in the synced chart of accounts.`);
      if (/suspense|uncategorized|uncategorised/i.test(`${accountCode ?? ''} ${accountName ?? ''}`)) flags.push(`Line is coded to ${accountName ?? accountCode}.`);
    }
    if (flags.length) {
      const issueKey = `DATA_QUALITY:${type}:${id ?? `${reference ?? ''}:${date ?? ''}:${amount ?? ''}`}`;
      add({ issueKey, ruleCode: 'INCOMPLETE_OR_CLASSIFICATION', title: flags.some((f) => f.includes('coded to')) ? 'Suspense or uncategorised account coding' : 'Transaction data needs review',
        category: flags.some((f) => f.includes('coded to') || f.includes('account code')) ? 'CLASSIFICATION' : 'MISSING_INFORMATION',
        severity: flags.some((f) => f.includes('coded to')) ? 'REVIEW_REQUIRED' : 'DATA_QUALITY', transactionType: type, sourceId: id,
        relatedSourceIds: [], contactName: contact, reference, amount, currency: val(record.CurrencyCode, record.currency), date,
        explanation: flags.join(' '), evidence: flags, xeroUrl: sourceUrl(type, id) });
    }
    for (const line of lines) {
      if (line.TaxType === undefined && line.tax_type === undefined) {
        const issueKey = `TAX_REVIEW:${type}:${id ?? `${reference ?? ''}:${date ?? ''}`}`;
        add({ issueKey, ruleCode: 'TAX_CODE_MISSING', title: 'Tax coding is not present in synced line data', category: 'TAX', severity: 'DATA_QUALITY',
          transactionType: type, sourceId: id, relatedSourceIds: [], contactName: contact, reference, amount,
          currency: val(record.CurrencyCode, record.currency), date, explanation: 'The stored Xero line item has no TaxType field. This is a data completeness check and does not determine that the transaction tax treatment is incorrect.',
          evidence: ['Line item TaxType field is absent'], xeroUrl: sourceUrl(type, id) });
        break;
      }
    }
  }

  // Reconciliation is evaluated only when the Xero payload explicitly includes the flag.
  for (const transaction of sources.bankTransactions) {
    const reconciled = transaction.IsReconciled ?? transaction.is_reconciled ?? transaction.Reconciled ?? transaction.reconciled;
    if (typeof reconciled !== 'boolean' || reconciled) continue;
    const id = sourceId(transaction);
    const date = xeroDate(transaction.Date, transaction.date);
    const reference = val(transaction.Reference, transaction.reference, transaction.BankTransactionID);
    const amount = numberOrNull(transaction.Total, transaction.total, transaction.Amount, transaction.amount);
    const key = `RECONCILIATION:${id ?? `${date}:${reference}:${amount}`}`;
    add({ issueKey: key, ruleCode: 'UNRECONCILED_BANK_TRANSACTION', title: 'Bank transaction explicitly marked unreconciled', category: 'RECONCILIATION', severity: 'REVIEW_REQUIRED',
      transactionType: 'BANK_TRANSACTION', sourceId: id, relatedSourceIds: [], contactName: val(transaction.Contact?.Name), reference, amount,
      currency: val(transaction.CurrencyCode, transaction.currency), date, explanation: 'The synchronized record explicitly marks this bank transaction as unreconciled.',
      evidence: ['Xero reconciliation flag is false'], xeroUrl: sourceUrl('BANK_TRANSACTION', id) });
  }

  return [...findings.values()];
}

function buildQuality(sources: Awaited<ReturnType<typeof readSources>>) {
  const records = [...sources.invoices, ...sources.creditNotes, ...sources.bankTransactions];
  const checks = [
    { key: 'validDates', label: 'Valid transaction dates', applicable: (r: JsonRecord) => r.Type !== undefined || r.CreditNoteID !== undefined || r.BankTransactionID !== undefined, pass: (r: JsonRecord) => Boolean(xeroDate(r.Date, r.date, r.invoice_date)) },
    { key: 'contact', label: 'Contact information present', applicable: (r: JsonRecord) => Boolean(r.Type || r.CreditNoteID), pass: (r: JsonRecord) => Boolean(val(r.Contact?.Name, r.contact_name, r.contactName)) },
    { key: 'reference', label: 'Invoice or bill reference present', applicable: (r: JsonRecord) => Boolean(r.Type || r.CreditNoteID), pass: (r: JsonRecord) => Boolean(val(r.InvoiceNumber, r.CreditNoteNumber, r.Reference, r.invoice_number)) },
    { key: 'validAmount', label: 'Valid transaction amount', applicable: (r: JsonRecord) => r.Type !== undefined || r.CreditNoteID !== undefined || r.BankTransactionID !== undefined, pass: (r: JsonRecord) => numberOrNull(r.Total, r.total, r.Amount, r.amount) !== null },
    { key: 'accountCoding', label: 'Line account codes present', applicable: (r: JsonRecord) => Boolean(r.Type || r.CreditNoteID), pass: (r: JsonRecord) => { const lines = list(r.LineItems ?? r.line_items); return lines.length > 0 && lines.every((line) => Boolean(val(line.AccountCode, line.account_code))); } },
    { key: 'taxCoding', label: 'Line tax type present', applicable: (r: JsonRecord) => Boolean(r.Type || r.CreditNoteID), pass: (r: JsonRecord) => { const lines = list(r.LineItems ?? r.line_items); return lines.length > 0 && lines.every((line) => line.TaxType !== undefined || line.tax_type !== undefined); } }
  ];
  return checks.map((check) => {
    const eligible = records.filter(check.applicable);
    const passed = eligible.filter(check.pass).length;
    return { key: check.key, label: check.label, eligible: eligible.length, passed, failed: eligible.length - passed, completionPct: eligible.length ? Math.round(passed / eligible.length * 100) : null, status: eligible.length ? 'CHECKED' : 'NO_ELIGIBLE_RECORDS' };
  });
}

export async function runBookkeepingHealthScan(tenantId: number, period: BookkeepingPeriod = {}) {
  await ensureSchema();
  if (period.startDate && period.endDate && period.startDate > period.endDate) throw new Error('The start date must be on or before the end date.');
  const sources = await readSources(tenantId, period);
  const findings = detectFindings(sources).map((finding) => ({
    ...finding,
    issueKey: `${finding.issueKey}:PERIOD:${period.startDate ?? 'ALL'}:${period.endDate ?? 'ALL'}`,
    periodStart: period.startDate ?? null,
    periodEnd: period.endDate ?? null
  }));
  const sourceStatus = sources.sourceStatus;
  const requiredAvailable = REQUIRED_SOURCES.filter((source) => sourceStatus[source].available).length;
  const status = !sources.connected || requiredAvailable === 0 ? 'INCOMPLETE' : requiredAvailable < REQUIRED_SOURCES.length ? 'PARTIAL' : 'COMPLETE';
  const quality = buildQuality(sources);
  const severe = findings.filter((f) => f.severity === 'CRITICAL').length;
  const review = findings.filter((f) => f.severity === 'REVIEW_REQUIRED').length;
  const qualityCount = findings.filter((f) => f.severity === 'DATA_QUALITY').length;
  const materiality = findings.reduce((sum, f) => sum + (f.amount !== null ? Math.abs(f.amount) : 0), 0);
  const bankAccounts = sources.accounts.filter((account) => String(account.Type ?? account.type ?? '').toUpperCase() === 'BANK');
  const reconciliationSupported = sources.reconciliationFieldAvailable;
  const bankAccountDetails = bankAccounts.map((account) => {
    const id = val(account.AccountID, account.account_id);
    const related = sources.bankTransactions.filter((transaction) => val(transaction.BankAccount?.AccountID, transaction.BankAccountID, transaction.bank_account_id) === id);
    const unreconciled = related.filter((transaction) => (transaction.IsReconciled ?? transaction.is_reconciled ?? transaction.Reconciled ?? transaction.reconciled) === false);
    const oldest = unreconciled.map((transaction) => xeroDate(transaction.Date, transaction.date)).filter((date): date is string => Boolean(date)).sort()[0] ?? null;
    const agingBuckets = { days0to7: 0, days8to30: 0, days31to60: 0, over60Days: 0, ageUnknown: 0 };
    for (const transaction of unreconciled) {
      const transactionDate = xeroDate(transaction.Date, transaction.date);
      if (!transactionDate) { agingBuckets.ageUnknown++; continue; }
      const age = Math.max(0, Math.floor((Date.now() - new Date(`${transactionDate}T00:00:00Z`).getTime()) / 86_400_000));
      if (age <= 7) agingBuckets.days0to7++;
      else if (age <= 30) agingBuckets.days8to30++;
      else if (age <= 60) agingBuckets.days31to60++;
      else agingBuckets.over60Days++;
    }
    return { id, name: val(account.Name, account.name) ?? 'Unnamed bank account', code: val(account.Code, account.code), currency: val(account.CurrencyCode, account.currency), status: val(account.Status, account.status), transactionCount: related.length, unreconciledCount: unreconciled.length, unreconciledAmount: unreconciled.reduce((sum, transaction) => sum + Math.abs(numberOrNull(transaction.Total, transaction.Amount, transaction.total, transaction.amount) ?? 0), 0), oldestUnreconciledDate: oldest, agingBuckets };
  });
  const scoreAvailable = status === 'COMPLETE';
  const summary: JsonRecord = {
    period: { start: period.startDate ?? null, end: period.endDate ?? null, basis: 'Xero transaction date; latest synchronized record status' },
    healthScore: null,
    scoreStatus: scoreAvailable ? 'CALCULATED' : 'INCOMPLETE_DATA',
    scoreMethodology: 'Calculated from currently open findings: 12 points per critical, 4 per review-required, and 1 per data-quality finding; add a capped materiality adjustment of 2 × log10(absolute flagged exposure + 1) and an age penalty of 1 point per 30 days open per issue, capped at 10. Incomplete source coverage makes the score unavailable.',
    coverage: { required: REQUIRED_SOURCES.length, available: requiredAvailable, percent: Math.round(requiredAvailable / REQUIRED_SOURCES.length * 100) },
    issueCount: findings.length, criticalCount: severe, reviewCount: review, dataQualityCount: qualityCount,
    duplicateCount: findings.filter((f) => f.category === 'DUPLICATE').length,
    reconciliationCount: findings.filter((f) => f.category === 'RECONCILIATION').length,
    classificationCount: findings.filter((f) => f.category === 'CLASSIFICATION').length,
    taxCount: findings.filter((f) => f.category === 'TAX').length,
    missingInformationCount: findings.filter((f) => f.category === 'MISSING_INFORMATION').length,
    measurableExposure: materiality,
    dataRecords: { invoices: sources.invoices.length, creditNotes: sources.creditNotes.length, bankTransactions: sources.bankTransactions.length, accounts: sources.accounts.length, taxRates: sources.taxRates.length, contacts: sources.contacts.length, payments: sources.payments.length, prepayments: sources.prepayments.length, overpayments: sources.overpayments.length, manualJournals: sources.manualJournals.length },
    bankAccountCount: bankAccounts.length,
    bankAccountDetails,
    unreconciledCount: findings.filter((finding) => finding.category === 'RECONCILIATION').length,
    reconciliationCheck: reconciliationSupported ? 'SUPPORTED' : 'NOT_EXPOSED_BY_SYNCED_XERO_DATA',
    lastSyncedAt: sources.lastSyncedAt
  };
  const risk = [
    ['Duplicate risk', 'DUPLICATE'], ['Reconciliation risk', 'RECONCILIATION'], ['Classification risk', 'CLASSIFICATION'], ['Tax coding risk', 'TAX'], ['Data completeness risk', 'MISSING_INFORMATION']
  ].map(([label, category]) => {
    const count = findings.filter((f) => f.category === category).length;
    const eligible = category === 'DUPLICATE' ? sources.invoices.length + sources.creditNotes.length : category === 'RECONCILIATION' ? sources.bankTransactions.length : sources.invoices.length + sources.creditNotes.length;
    return { label, category, affected: count, eligible, affectedPct: eligible ? Number((count / eligible * 100).toFixed(2)) : null, exposure: findings.filter((f) => f.category === category).reduce((sum, f) => sum + Math.abs(f.amount ?? 0), 0), status: eligible ? 'CHECKED' : 'UNAVAILABLE' };
  });

  const scan = await db.query(
    `INSERT INTO bookkeeping_health_scans (tenant_id, status, summary, source_status, quality, risk)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb) RETURNING id, scanned_at`,
    [tenantId, status, JSON.stringify(summary), JSON.stringify(sourceStatus), JSON.stringify(quality), JSON.stringify(risk)]
  );
  const scanId = Number(scan.rows[0].id);

  const existingIssueStates = await db.query(`SELECT issue_key, status FROM bookkeeping_health_issues WHERE tenant_id = $1 AND issue_key = ANY($2::varchar[])`, [tenantId, findings.map((finding) => finding.issueKey)]);
  const existingStateByKey = new Map(existingIssueStates.rows.map((row: JsonRecord) => [row.issue_key, row.status]));
  for (const finding of findings) {
    await db.query(
      `INSERT INTO bookkeeping_health_issues (tenant_id, issue_key, latest_scan_id, details, last_seen_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
       ON CONFLICT (tenant_id, issue_key) DO UPDATE SET latest_scan_id = EXCLUDED.latest_scan_id, details = EXCLUDED.details,
         status = CASE WHEN bookkeeping_health_issues.status = 'RESOLVED' THEN 'OPEN' ELSE bookkeeping_health_issues.status END,
         last_seen_at = NOW(), updated_at = NOW()`,
      [tenantId, finding.issueKey, scanId, JSON.stringify(finding)]
    );
    const priorStatus = existingStateByKey.get(finding.issueKey);
    if (!priorStatus) {
      await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, issue_key, action, new_status, metadata) VALUES ($1,$2,'ISSUE_DETECTED','OPEN',$3::jsonb)`, [tenantId, finding.issueKey, JSON.stringify({ scanId, ruleCode: finding.ruleCode })]);
    } else if (priorStatus === 'RESOLVED') {
      await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, issue_key, action, previous_status, new_status, metadata) VALUES ($1,$2,'SOURCE_REAPPEARED','RESOLVED','OPEN',$3::jsonb)`, [tenantId, finding.issueKey, JSON.stringify({ scanId, ruleCode: finding.ruleCode })]);
    }
  }
  // A finding that disappears after a new scan is closed as source-cleared, with a durable audit event.
  const openRows = await db.query(`SELECT issue_key, status FROM bookkeeping_health_issues WHERE tenant_id = $1 AND COALESCE(details->>'periodStart','') = COALESCE($3,'') AND COALESCE(details->>'periodEnd','') = COALESCE($4,'') AND status IN ('OPEN','IN_REVIEW') AND (latest_scan_id IS NULL OR latest_scan_id <> $2)`, [tenantId, scanId, period.startDate ?? null, period.endDate ?? null]);
  for (const row of openRows.rows) {
    await db.query(`UPDATE bookkeeping_health_issues SET status = 'RESOLVED', updated_at = NOW() WHERE tenant_id = $1 AND issue_key = $2`, [tenantId, row.issue_key]);
    await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, issue_key, action, previous_status, new_status, note, metadata) VALUES ($1,$2,'SOURCE_CLEARED',$3,'RESOLVED','Finding no longer present in the latest database-backed scan.',$4::jsonb)`, [tenantId, row.issue_key, row.status, JSON.stringify({ scanId })]);
  }
  await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, action, metadata) VALUES ($1,'SCAN_COMPLETED',$2::jsonb)`, [tenantId, JSON.stringify({ scanId, status, findingCount: findings.length })]);
  const statusCounts = await db.query(`SELECT status, COUNT(*)::int AS count FROM bookkeeping_health_issues WHERE tenant_id = $1 AND COALESCE(details->>'periodStart','') = COALESCE($2,'') AND COALESCE(details->>'periodEnd','') = COALESCE($3,'') GROUP BY status`, [tenantId, period.startDate ?? null, period.endDate ?? null]);
  const currentCounts = Object.fromEntries(statusCounts.rows.map((row: JsonRecord) => [row.status, Number(row.count)]));
  const openIssueCount = (currentCounts.OPEN ?? 0) + (currentCounts.IN_REVIEW ?? 0);
  const resolvedCount = (currentCounts.RESOLVED ?? 0) + (currentCounts.IGNORED ?? 0) + (currentCounts.KEEP_BOTH ?? 0);
  const activeFindings = await db.query(`SELECT issue_key, details->>'sourceId' AS source_id, details->>'severity' AS severity, NULLIF(details->>'amount','')::numeric AS amount, first_seen_at FROM bookkeeping_health_issues WHERE tenant_id = $1 AND COALESCE(details->>'periodStart','') = COALESCE($2,'') AND COALESCE(details->>'periodEnd','') = COALESCE($3,'') AND status IN ('OPEN','IN_REVIEW')`, [tenantId, period.startDate ?? null, period.endDate ?? null]);
  const activeSeverity = activeFindings.rows.reduce((counts: JsonRecord, row: JsonRecord) => {
    counts[row.severity] = (counts[row.severity] ?? 0) + 1;
    return counts;
  }, {});
  const exposureByRecord = new Map<string, number>();
  for (const row of activeFindings.rows) exposureByRecord.set(row.source_id || row.issue_key, Math.max(exposureByRecord.get(row.source_id || row.issue_key) ?? 0, Math.abs(Number(row.amount) || 0)));
  const activeExposure = [...exposureByRecord.values()].reduce((sum, amount) => sum + amount, 0);
  const agePenalty = Math.min(10, activeFindings.rows.reduce((sum: number, row: JsonRecord) => {
    const ageDays = Math.max(0, (Date.now() - new Date(row.first_seen_at).getTime()) / 86_400_000);
    return sum + Math.floor(ageDays / 30);
  }, 0));
  const healthScore = scoreAvailable ? Math.max(0, Math.round(100
    - (activeSeverity.CRITICAL ?? 0) * 12
    - (activeSeverity.REVIEW_REQUIRED ?? 0) * 4
    - (activeSeverity.DATA_QUALITY ?? 0)
    - Math.min(20, Math.log10(activeExposure + 1) * 2)
    - agePenalty)) : null;
  await db.query(`UPDATE bookkeeping_health_scans SET summary = summary || $3::jsonb WHERE tenant_id = $1 AND id = $2`, [tenantId, scanId, JSON.stringify({ openIssueCount, resolvedCount, healthScore, agePenalty })]);
  summary.openIssueCount = openIssueCount;
  summary.resolvedCount = resolvedCount;
  summary.healthScore = healthScore;
  summary.agePenalty = agePenalty;
  return { id: scanId, scannedAt: scan.rows[0].scanned_at, status, summary, sourceStatus, quality, risk };
}

export async function getBookkeepingHealth(tenantId: number, options: { page: number; pageSize: number; search?: string; category?: string; severity?: string; status?: string; fromDate?: string; toDate?: string; minAmount?: number; maxAmount?: number; sort?: string; periodStart?: string; periodEnd?: string }) {
  await ensureSchema();
  if (!db.isPgActive()) throw new Error('PostgreSQL is unavailable. Bookkeeping Health does not substitute local or demo records.');
  await getOrCreateCloseChecks(tenantId);
  const latest = await db.query(`SELECT id, status, summary, source_status, quality, risk, scanned_at FROM bookkeeping_health_scans WHERE tenant_id = $1 AND COALESCE(summary->'period'->>'start','') = COALESCE($2,'') AND COALESCE(summary->'period'->>'end','') = COALESCE($3,'') ORDER BY scanned_at DESC LIMIT 1`, [tenantId, options.periodStart ?? null, options.periodEnd ?? null]);
  const current = latest.rows[0] ?? null;
  const params: any[] = [tenantId];
  const where = ['tenant_id = $1', `COALESCE(details->>'periodStart','') = COALESCE($2,'')`, `COALESCE(details->>'periodEnd','') = COALESCE($3,'')`];
  params.push(options.periodStart ?? null, options.periodEnd ?? null);
  if (options.search) { params.push(`%${options.search}%`); where.push(`(details->>'title' ILIKE $${params.length} OR details->>'reference' ILIKE $${params.length} OR details->>'contactName' ILIKE $${params.length} OR details->>'explanation' ILIKE $${params.length})`); }
  if (options.category && options.category !== 'ALL') { params.push(options.category); where.push(`details->>'category' = $${params.length}`); }
  if (options.severity && options.severity !== 'ALL') { params.push(options.severity); where.push(`details->>'severity' = $${params.length}`); }
  if (options.status && options.status !== 'ALL') { params.push(options.status); where.push(`status = $${params.length}`); }
  if (options.fromDate) { params.push(options.fromDate); where.push(`NULLIF(details->>'date','')::date >= $${params.length}::date`); }
  if (options.toDate) { params.push(options.toDate); where.push(`NULLIF(details->>'date','')::date <= $${params.length}::date`); }
  if (options.minAmount !== undefined) { params.push(options.minAmount); where.push(`ABS(COALESCE(NULLIF(details->>'amount','')::numeric,0)) >= $${params.length}`); }
  if (options.maxAmount !== undefined) { params.push(options.maxAmount); where.push(`ABS(COALESCE(NULLIF(details->>'amount','')::numeric,0)) <= $${params.length}`); }
  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM bookkeeping_health_issues WHERE ${where.join(' AND ')}`, params);
  params.push(options.pageSize, (options.page - 1) * options.pageSize);
  const orderBy = options.sort === 'AMOUNT' ? `ABS(COALESCE(NULLIF(details->>'amount','')::numeric,0)) DESC, updated_at DESC` : options.sort === 'DATE' ? `NULLIF(details->>'date','') DESC NULLS LAST, updated_at DESC` : `CASE details->>'severity' WHEN 'CRITICAL' THEN 0 WHEN 'REVIEW_REQUIRED' THEN 1 WHEN 'DATA_QUALITY' THEN 2 ELSE 3 END, updated_at DESC`;
  const issueResult = await db.query(`SELECT issue_key, status, assigned_to, internal_note, details, first_seen_at, last_seen_at, updated_at FROM bookkeeping_health_issues WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  const recommendations = await db.query(`SELECT id, scan_id, title, explanation, evidence, suggested_action, confidence, model, status, created_at FROM bookkeeping_health_ai_recommendations WHERE tenant_id = $1 AND scan_id = $2 ORDER BY created_at DESC LIMIT 20`, [tenantId, current?.id ?? null]);
  const issueSuffix = `:PERIOD:${options.periodStart ?? 'ALL'}:${options.periodEnd ?? 'ALL'}`;
  const activity = await db.query(`SELECT id, issue_key, actor_user_id, actor_email, action, previous_status, new_status, note, metadata, created_at FROM bookkeeping_health_audit_logs WHERE tenant_id = $1 AND (issue_key LIKE $2 OR metadata->>'scanId' = $3) ORDER BY created_at DESC LIMIT 100`, [tenantId, `%${issueSuffix}`, current ? String(current.id) : '']);
  const trend = await db.query(`SELECT id, scanned_at, status, summary FROM bookkeeping_health_scans WHERE tenant_id = $1 AND COALESCE(summary->'period'->>'start','') = COALESCE($2,'') AND COALESCE(summary->'period'->>'end','') = COALESCE($3,'') ORDER BY scanned_at DESC LIMIT 30`, [tenantId, options.periodStart ?? null, options.periodEnd ?? null]);
  const closeChecks = await db.query(`SELECT checklist_key, label, status, assigned_to, expected_date, reviewed_by, reviewed_at, note, updated_at FROM bookkeeping_health_close_checks WHERE tenant_id = $1 ORDER BY id`, [tenantId]);
  const groupedIssues = await db.query(`SELECT details->>'category' AS category, details->>'severity' AS severity, COUNT(*)::int AS count FROM bookkeeping_health_issues WHERE tenant_id = $1 AND COALESCE(details->>'periodStart','') = COALESCE($2,'') AND COALESCE(details->>'periodEnd','') = COALESCE($3,'') AND status IN ('OPEN','IN_REVIEW') GROUP BY details->>'category', details->>'severity'`, [tenantId, options.periodStart ?? null, options.periodEnd ?? null]);
  const activeCounts = { total: 0, critical: 0, review: 0, dataQuality: 0, duplicate: 0, reconciliation: 0, classification: 0, tax: 0, missing: 0 };
  for (const row of groupedIssues.rows) {
    const count = Number(row.count);
    activeCounts.total += count;
    if (row.severity === 'CRITICAL') activeCounts.critical += count;
    if (row.severity === 'REVIEW_REQUIRED') activeCounts.review += count;
    if (row.severity === 'DATA_QUALITY') activeCounts.dataQuality += count;
    if (row.category === 'DUPLICATE') activeCounts.duplicate += count;
    if (row.category === 'RECONCILIATION') activeCounts.reconciliation += count;
    if (row.category === 'CLASSIFICATION') activeCounts.classification += count;
    if (row.category === 'TAX') activeCounts.tax += count;
    if (row.category === 'MISSING_INFORMATION') activeCounts.missing += count;
  }
  return {
    connected: Boolean(current?.source_status && Object.values(current.source_status).some((item: any) => item.available)),
    scan: current ? { id: current.id, status: current.status, scannedAt: current.scanned_at, summary: current.summary, sourceStatus: current.source_status, quality: current.quality, risk: current.risk } : null,
    activeCounts,
    issues: issueResult.rows.map((row: JsonRecord) => ({ ...row.details, id: row.issue_key, status: row.status, assignedTo: row.assigned_to, internalNote: row.internal_note, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, updatedAt: row.updated_at })),
    pagination: { page: options.page, pageSize: options.pageSize, total: Number(countResult.rows[0]?.count ?? 0), pageCount: Math.ceil(Number(countResult.rows[0]?.count ?? 0) / options.pageSize) },
    recommendations: recommendations.rows,
    closeChecks: closeChecks.rows,
    activity: activity.rows,
    trend: trend.rows.reverse().map((row: JsonRecord) => ({ scannedAt: row.scanned_at, status: row.status, openIssues: row.summary.issueCount, critical: row.summary.criticalCount, resolved: row.summary.resolvedCount ?? null }))
  };
}

const CLOSE_CHECKS = [
  ['bank_reconciliation', 'Review bank reconciliation exceptions'],
  ['duplicate_review', 'Review potential duplicate transactions'],
  ['suspense_review', 'Review suspense and uncategorised coding'],
  ['classification_review', 'Review account classification findings'],
  ['tax_review', 'Review tax coding findings'],
  ['missing_information', 'Review incomplete transaction information'],
  ['manual_journal_review', 'Review available manual journals']
] as const;

export async function getOrCreateCloseChecks(tenantId: number) {
  await ensureSchema();
  for (const [key, label] of CLOSE_CHECKS) {
    await db.query(`INSERT INTO bookkeeping_health_close_checks (tenant_id, checklist_key, label) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, checklist_key) DO NOTHING`, [tenantId, key, label]);
  }
}

export async function updateBookkeepingCloseCheck(tenantId: number, actor: { userId: number; email: string }, key: string, action: string, assignedTo?: string, expectedDate?: string, note?: string) {
  await getOrCreateCloseChecks(tenantId);
  const old = await db.query(`SELECT status FROM bookkeeping_health_close_checks WHERE tenant_id = $1 AND checklist_key = $2`, [tenantId, key]);
  if (!old.rows[0]) throw new Error('Checklist item was not found for this organisation.');
  let status = old.rows[0].status;
  if (action === 'check_complete') status = 'COMPLETE';
  else if (action === 'check_reopen') status = 'PENDING';
  else if (action !== 'check_assign' && action !== 'check_note') throw new Error('Unsupported checklist action.');
  const date = expectedDate && /^\d{4}-\d{2}-\d{2}$/.test(expectedDate) ? expectedDate : null;
  await db.query(
    `UPDATE bookkeeping_health_close_checks SET status = $3,
       assigned_to = CASE WHEN $4 THEN $5 ELSE assigned_to END,
       expected_date = CASE WHEN $6 THEN $7::date ELSE expected_date END,
       reviewed_by = CASE WHEN $8 THEN $9 ELSE reviewed_by END,
       reviewed_at = CASE WHEN $8 THEN CASE WHEN $3 = 'COMPLETE' THEN NOW() ELSE NULL END ELSE reviewed_at END,
       note = CASE WHEN $10 THEN $11 ELSE note END, updated_at = NOW()
     WHERE tenant_id = $1 AND checklist_key = $2`,
    [tenantId, key, status, action === 'check_assign', assignedTo ?? null, Boolean(expectedDate), date, action === 'check_complete' || action === 'check_reopen', actor.email, action === 'check_note' || Boolean(note), note ?? null]
  );
  await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, actor_user_id, actor_email, action, note, metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [tenantId, actor.userId, actor.email, action.toUpperCase(), note ?? null, JSON.stringify({ checklistKey: key, status, assignedTo: action === 'check_assign' ? assignedTo ?? null : undefined, expectedDate: date })]);
  return { status };
}

export async function updateBookkeepingIssue(tenantId: number, actor: { userId: number; email: string }, issueKey: string, action: string, note?: string, assignedTo?: string) {
  await ensureSchema();
  const allowed: Record<string, string> = { review: 'IN_REVIEW', resolve: 'RESOLVED', ignore: 'IGNORED', keep_both: 'KEEP_BOTH', reopen: 'OPEN' };
  const existing = await db.query(`SELECT status FROM bookkeeping_health_issues WHERE tenant_id = $1 AND issue_key = $2`, [tenantId, issueKey]);
  if (!existing.rows[0]) throw new Error('Issue was not found for this organisation.');
  const previousStatus = existing.rows[0].status as string;
  let newStatus = allowed[action] ?? previousStatus;
  if (action === 'assign') newStatus = previousStatus;
  if (!allowed[action] && action !== 'assign' && action !== 'note') throw new Error('Unsupported issue action.');
  await db.query(`UPDATE bookkeeping_health_issues SET status = $3, assigned_to = CASE WHEN $4 THEN $5 ELSE assigned_to END, internal_note = CASE WHEN $6 THEN $7 ELSE internal_note END, updated_at = NOW() WHERE tenant_id = $1 AND issue_key = $2`, [tenantId, issueKey, newStatus, action === 'assign', assignedTo ?? null, action === 'note' || Boolean(note), note ?? null]);
  await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, issue_key, actor_user_id, actor_email, action, previous_status, new_status, note, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [tenantId, issueKey, actor.userId, actor.email, action.toUpperCase(), previousStatus, newStatus, note ?? null, JSON.stringify({ assignedTo: action === 'assign' ? assignedTo ?? null : undefined })]);
  return { status: newStatus };
}

export async function updateRecommendation(tenantId: number, actor: { userId: number; email: string }, id: number, decision: 'ACCEPTED' | 'REJECTED' | 'REVIEW') {
  await ensureSchema();
  const result = await db.query(`UPDATE bookkeeping_health_ai_recommendations SET status = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING status`, [tenantId, id, decision]);
  if (!result.rows[0]) throw new Error('AI recommendation was not found for this organisation.');
  await db.query(`INSERT INTO bookkeeping_health_audit_logs (tenant_id, actor_user_id, actor_email, action, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`, [tenantId, actor.userId, actor.email, `AI_RECOMMENDATION_${decision}`, JSON.stringify({ recommendationId: id })]);
  return result.rows[0];
}

export async function buildBookkeepingAiContext(tenantId: number, period: BookkeepingPeriod = {}) {
  await ensureSchema();
  const snapshot = await getBookkeepingHealth(tenantId, { page: 1, pageSize: 40, periodStart: period.startDate, periodEnd: period.endDate });
  if (!snapshot.scan) throw new Error('Run a database-backed bookkeeping scan before requesting AI analysis.');
  const sources = await readSources(tenantId, period);
  return {
    scanId: snapshot.scan.id,
    sourceCoverage: snapshot.scan.sourceStatus,
    summary: snapshot.scan.summary,
    findings: snapshot.issues.slice(0, 40).map((issue: JsonRecord) => ({ id: issue.id, title: issue.title, category: issue.category, severity: issue.severity, reference: issue.reference, contact: issue.contactName, amount: issue.amount, currency: issue.currency, date: issue.date, explanation: issue.explanation, evidence: issue.evidence })),
    accountingRecords: [...sources.invoices, ...sources.creditNotes, ...sources.bankTransactions, ...sources.payments, ...sources.prepayments, ...sources.overpayments].slice(0, 80).map((record) => ({
      sourceId: sourceId(record), type: val(record.Type, record.CreditNoteID ? 'CREDIT_NOTE' : undefined, record.BankTransactionID ? 'BANK_TRANSACTION' : undefined),
      reference: val(record.InvoiceNumber, record.CreditNoteNumber, record.Reference), date: xeroDate(record.Date, record.date),
      amount: numberOrNull(record.Total, record.Amount, record.AmountDue), currency: val(record.CurrencyCode), status: val(record.Status),
      contact: val(record.Contact?.Name), accountCodes: list(record.LineItems).map((line) => val(line.AccountCode)).filter(Boolean),
      taxTypes: list(record.LineItems).map((line) => val(line.TaxType)).filter(Boolean)
    }))
  };
}

