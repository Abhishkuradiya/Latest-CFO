import { db } from '@/lib/db';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { fetchXeroReport, fetchXeroResourcePaginated } from '@/lib/xero';

type XeroInvoice = Record<string, unknown> & { Contact?: Record<string, unknown> };
type ReportCell = { Value?: unknown };
type ReportRow = { RowType?: string; Cells?: ReportCell[]; Rows?: ReportRow[]; Summary?: ReportRow };
type ContactBalance = { name: string; previous: number; current: number; movement: number; changePercent: number | null };
type ContactBalanceComparison = { available: boolean; entries: ContactBalance[] };

let agedReportQueue = Promise.resolve();
let nextAgedReportAt = 0;

function scheduleAgedReport<T>(action: () => Promise<T>) {
  const scheduled = agedReportQueue.then(async () => {
    const wait = Math.max(0, nextAgedReportAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    nextAgedReportAt = Date.now() + 1_000;
    return action();
  });
  agedReportQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function isoDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) return direct;
  const xeroDate = value.match(/^\/Date\((-?\d+)/)?.[1];
  if (xeroDate) {
    const parsedXeroDate = new Date(Number(xeroDate));
    return Number.isFinite(parsedXeroDate.getTime()) ? parsedXeroDate.toISOString().slice(0, 10) : null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function numeric(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/,/g, '');
  const negative = text.startsWith('(') && text.endsWith(')');
  const result = Number(text.replace(/[()]/g, ''));
  return Number.isFinite(result) ? (negative ? -result : result) : null;
}

function readContactClosingBalance(report: unknown): number | null {
  if (!report || typeof report !== 'object') return null;
  const rows = (report as { Rows?: ReportRow[] }).Rows;
  if (!Array.isArray(rows)) return null;
  let dueColumn: number | null = null;
  let totalColumn: number | null = null;
  let closingBalance: number | null = null;
  let totalBalance: number | null = null;
  let hasHeader = false;

  const visit = (items: ReportRow[]) => {
    for (const row of items) {
      if (row.RowType === 'Header' && Array.isArray(row.Cells)) {
        hasHeader = true;
        const column = row.Cells.findIndex((cell) => String(cell.Value ?? '').trim().toLowerCase() === 'due');
        if (column >= 0) dueColumn = column;
        const total = row.Cells.findIndex((cell) => String(cell.Value ?? '').trim().toLowerCase() === 'total');
        if (total >= 0) totalColumn = total;
      }
      if (Array.isArray(row.Cells)) {
        const label = String(row.Cells[0]?.Value ?? '').trim().toLowerCase();
        const valueColumn = totalColumn ?? dueColumn ?? row.Cells.length - 1;
        const value = numeric(row.Cells[valueColumn]?.Value);
        if (value !== null && (row.RowType === 'SummaryRow' || row.RowType === 'Row')) {
          if (label === 'closing balance') closingBalance = value;
          else if (label === 'total') totalBalance = value;
        }
      }
      if (Array.isArray(row.Rows)) visit(row.Rows);
      if (row.Summary) visit([row.Summary]);
    }
  };
  visit(rows);
  return closingBalance ?? totalBalance ?? (hasHeader ? 0 : null);
}

async function relevantContacts(tenantId: number, type: 'ACCREC' | 'ACCPAY', previousDate: string, currentDate: string, accessToken: string, xeroTenantId: string) {
  let invoices = await db.getPostgresReport(tenantId, 'Invoices');
  if (!Array.isArray(invoices)) {
    const fetched = await fetchXeroResourcePaginated(accessToken, xeroTenantId, 'Invoices');
    await db.savePostgresReport(tenantId, 'Invoices', fetched);
    invoices = await db.getPostgresReport(tenantId, 'Invoices');
  }
  if (!Array.isArray(invoices)) throw new Error('Xero invoice data was not available after saving to PostgreSQL.');

  const contacts = new Map<string, string>();
  for (const item of invoices as XeroInvoice[]) {
    if (String(item.Type ?? '').toUpperCase() !== type) continue;
    const status = String(item.Status ?? '').toUpperCase();
    if (['VOIDED', 'DELETED', 'DRAFT'].includes(status)) continue;
    const issueDate = isoDate(item.DateString ?? item.Date);
    if (issueDate && issueDate > currentDate) continue;
    const paidDate = isoDate(item.FullyPaidOnDate);
    const amountDue = numeric(item.AmountDue) ?? 0;
    const relevantToComparison = Math.abs(amountDue) > 0.005
      || (issueDate !== null && issueDate >= previousDate)
      || (paidDate !== null && paidDate > previousDate);
    if (!relevantToComparison) continue;
    const contact = item.Contact ?? {};
    const id = String(contact.ContactID ?? '').trim();
    const name = String(item.ContactName ?? contact.Name ?? '').trim();
    if (id && name) contacts.set(id, name);
  }
  return [...contacts].map(([id, name]) => ({ id, name }));
}

async function agedBalance(tenantId: number, accessToken: string, xeroTenantId: string, report: 'AgedReceivablesByContact' | 'AgedPayablesByContact', contactId: string, date: string) {
  const key = `${report}_${contactId}_${date}`;
  const data = await getOrFetchManagementReport(tenantId, key, () => scheduleAgedReport(() => fetchXeroReport(
    accessToken,
    xeroTenantId,
    report,
    `contactId=${encodeURIComponent(contactId)}&date=${date}`,
  )));
  return readContactClosingBalance(data);
}

async function compareContacts(tenantId: number, accessToken: string, xeroTenantId: string, contacts: { id: string; name: string }[], report: 'AgedReceivablesByContact' | 'AgedPayablesByContact', previousDate: string, currentDate: string): Promise<ContactBalanceComparison> {
  const results = await Promise.all(contacts.map(async (contact) => {
    const [previous, current] = await Promise.all([
      agedBalance(tenantId, accessToken, xeroTenantId, report, contact.id, previousDate),
      agedBalance(tenantId, accessToken, xeroTenantId, report, contact.id, currentDate),
    ]);
    if (previous === null || current === null) return null;
    const movement = current - previous;
    return {
      name: contact.name,
      previous,
      current,
      movement,
      changePercent: Math.abs(previous) < 0.005 ? null : (movement / Math.abs(previous)) * 100,
    };
  }));
  const successfulContacts = results.filter((entry): entry is ContactBalance => entry !== null);
  const entries = successfulContacts
    .filter((entry) => Math.abs(entry.previous) > 0.005 || Math.abs(entry.current) > 0.005)
    .sort((left, right) => Math.abs(right.movement) - Math.abs(left.movement));
  return { available: successfulContacts.length === contacts.length, entries };
}

export async function loadManagementAccountContactComparisons(tenantId: number, accessToken: string, xeroTenantId: string, previousDate: string, currentDate: string) {
  const [receivableContacts, payableContacts] = await Promise.all([
    relevantContacts(tenantId, 'ACCREC', previousDate, currentDate, accessToken, xeroTenantId),
    relevantContacts(tenantId, 'ACCPAY', previousDate, currentDate, accessToken, xeroTenantId),
  ]);
  const [receivables, payables] = await Promise.all([
    compareContacts(tenantId, accessToken, xeroTenantId, receivableContacts, 'AgedReceivablesByContact', previousDate, currentDate),
    compareContacts(tenantId, accessToken, xeroTenantId, payableContacts, 'AgedPayablesByContact', previousDate, currentDate),
  ]);
  return { receivables, payables };
}
