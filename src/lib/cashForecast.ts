import { db } from '@/lib/db';
import { fetchXeroReport, fetchXeroResourcePaginated, getXeroAccessToken } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';

type Token = { accessToken: string; xeroTenantId: string } | null;
type Movement = { id: string; party: string; reference: string; amount: number; dueDate: string | null; expectedDate: string; status: string; type: 'receipt' | 'payment'; currency: string };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const number = (value: unknown) => { const parsed = Number(String(value ?? '').replace(/,/g, '')); return Number.isFinite(parsed) ? parsed : null; };
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

async function cachedResource(tenantId: number, token: Token, reportType: string, resource: string) {
  const cached = await db.getPostgresReport(tenantId, reportType);
  if (cached !== null) return cached;
  if (!token) return null;
  return getOrFetchManagementReport(tenantId, reportType, () => resource.startsWith('Reports/')
    ? fetchXeroReport(token.accessToken, token.xeroTenantId, resource.slice('Reports/'.length))
    : fetchXeroResourcePaginated(token.accessToken, token.xeroTenantId, resource));
}

function activeInvoice(invoice: any) {
  return !['DELETED', 'VOIDED', 'DRAFT', 'PAID'].includes(String(invoice.Status || invoice.status || '').toUpperCase());
}

function mapInvoice(invoice: any, type: 'receipt' | 'payment', today: Date, horizonEnd: Date): Movement | null {
  const invoiceType = String(invoice.Type || invoice.type || '').toUpperCase();
  if (type === 'receipt' && invoiceType !== 'ACCREC') return null;
  if (type === 'payment' && invoiceType !== 'ACCPAY') return null;
  if (!activeInvoice(invoice)) return null;
  const amount = number(invoice.AmountDue ?? invoice.amount_due);
  if (amount === null || amount <= 0) return null;
  const due = invoice.DueDate || invoice.due_date || null;
  const dueDate = due ? new Date(due) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return null;
  const expected = dueDate < today ? today : dueDate;
  if (expected > horizonEnd) return null;
  return {
    id: String(invoice.InvoiceID || invoice.external_id || invoice.id || invoice.InvoiceNumber),
    party: invoice.Contact?.Name || invoice.ContactName || invoice.contact_name || 'Unnamed contact',
    reference: invoice.InvoiceNumber || invoice.invoice_number || invoice.Reference || 'No reference',
    amount,
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? iso(dueDate) : null,
    expectedDate: iso(expected),
    status: dueDate ? (expected < today ? 'Overdue' : 'Due') : 'Missing due date',
    type,
    currency: invoice.CurrencyCode || invoice.currency || 'Unknown'
  };
}

function buildWeeks(start: Date, receipts: Movement[], payments: Movement[], openingCash: number) {
  return Array.from({ length: 13 }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const inflows = receipts.filter(item => item.expectedDate >= iso(weekStart) && item.expectedDate <= iso(weekEnd));
    const outflows = payments.filter(item => item.expectedDate >= iso(weekStart) && item.expectedDate <= iso(weekEnd));
    const totalIn = inflows.reduce((sum, item) => sum + item.amount, 0);
    const totalOut = outflows.reduce((sum, item) => sum + item.amount, 0);
    const previous = index === 0 ? openingCash : 0;
    return { index: index + 1, start: iso(weekStart), end: iso(weekEnd), opening: previous, inflows: totalIn, outflows: totalOut, net: totalIn - totalOut, closing: previous + totalIn - totalOut, receipts: inflows, payments: outflows };
  }).reduce((weeks, week, index) => {
    if (index > 0) week.opening = weeks[index - 1].closing;
    week.closing = week.opening + week.inflows - week.outflows;
    weeks.push(week);
    return weeks;
  }, [] as any[]);
}

export async function getCashForecast(tenantId: number) {
  const token = await getXeroAccessToken(tenantId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = addDays(today, 13 * 7 - 1);
  const [balanceSheet, invoiceData, bankTransactions, organisation] = await Promise.all([
    cachedResource(tenantId, token, `BalanceSheet_${iso(today)}`, 'Reports/BalanceSheet'),
    cachedResource(tenantId, token, 'Invoices', 'Invoices'),
    cachedResource(tenantId, token, 'BankTransactions', 'BankTransactions'),
    db.getPostgresReport(tenantId, 'Organisation')
  ]);
  const rows = Array.isArray(balanceSheet?.Rows) ? balanceSheet.Rows : [];
  const currentCash = rows.length ? BalanceSheetParser.findTotalCash(rows) : null;
  const invoices = Array.isArray(invoiceData) ? invoiceData : [];
  const receipts = invoices.map(item => mapInvoice(item, 'receipt', today, horizonEnd)).filter((item): item is Movement => item !== null && String(item.type) === 'receipt' && String(item.status) !== 'PAID');
  const payments = invoices.map(item => mapInvoice(item, 'payment', today, horizonEnd)).filter((item): item is Movement => item !== null && String(item.type) === 'payment');
  const missingDueDates = invoices.filter(item => activeInvoice(item) && ['ACCREC', 'ACCPAY'].includes(String(item.Type || item.type || '').toUpperCase()) && (number(item.AmountDue ?? item.amount_due) || 0) > 0 && !(item.DueDate || item.due_date)).length;
  const weeks = currentCash === null ? [] : buildWeeks(addDays(today, 1), receipts, payments, currentCash);
  const minimum = weeks.length ? Math.min(...weeks.map(week => week.closing)) : null;
  const ending = weeks.length ? weeks[weeks.length - 1].closing : null;
  const totalIn = weeks.reduce((sum, week) => sum + week.inflows, 0);
  const totalOut = weeks.reduce((sum, week) => sum + week.outflows, 0);
  const missingSources = [currentCash === null ? 'bank cash balance' : null, invoiceData === null ? 'invoices and bills' : null, missingDueDates > 0 ? `${missingDueDates} invoice/bill due date${missingDueDates === 1 ? '' : 's'}` : null].filter(Boolean);
  const result = {
    connected: Boolean(token),
    currency: organisation?.BaseCurrency || organisation?.CurrencyCode || 'N/A',
    calculatedAt: new Date().toISOString(),
    period: { start: iso(addDays(today, 1)), end: iso(horizonEnd), weeks: 13 },
    dataQuality: { bankTransactions: Array.isArray(bankTransactions) ? bankTransactions.length : 0, invoices: invoices.length, missingDueDates, missingSources, ready: currentCash !== null && invoiceData !== null && missingDueDates === 0 },
    summary: { currentCash, availableCash: currentCash, projectedMinimum: minimum, projectedEnding: ending, netCashFlow: currentCash === null ? null : totalIn - totalOut, liquidityShortfall: minimum === null ? null : Math.max(0, -minimum) },
    receipts, payments, weeks,
    ai: { available: false, status: 'AI provider is not configured for this forecast module.' }
  };
  await db.savePostgresReport(tenantId, `CashForecast_${iso(today)}`, result);
  return result;
}
