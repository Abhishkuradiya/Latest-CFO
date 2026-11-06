import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { fetchXeroReport, fetchXeroResource, fetchXeroResourcePaginated, getXeroAccessToken } from '@/lib/xero';
import { ProfitAndLossService } from '@/lib/services/ProfitAndLossService';
import { XeroBudgetService } from '@/lib/budgetService';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

type PeriodTotals = { revenue: number; grossProfit: number; operatingExpenses: number; netProfit: number };
type BudgetCategory = 'revenue' | 'cogs' | 'operatingExpenses' | 'otherIncome' | 'otherExpenses';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

function parseDate(value: string) {
  if (!datePattern.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftYear(date: Date, years: number) {
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

function summarizePnl(report: unknown): PeriodTotals | null {
  const normalizedReport = report as { Rows?: unknown[] } | null;
  if (!Array.isArray(normalizedReport?.Rows) || normalizedReport.Rows.length === 0) return null;
  const parsed = ProfitAndLossService.parseReport(normalizedReport);
  return {
    revenue: parsed.revenue,
    grossProfit: parsed.grossProfit,
    operatingExpenses: parsed.operatingExpenses + parsed.otherExpenses,
    netProfit: parsed.netProfit,
  };
}

function accountBudgetCategory(account: unknown): BudgetCategory | null {
  const record = asRecord(account);
  const type = String(record.Type || record.type || '').toUpperCase();
  const accountClass = String(record.Class || record.class || '').toUpperCase();
  if (['REVENUE', 'SALES'].includes(type) || accountClass === 'REVENUE') return 'revenue';
  if (['COGS', 'DIRECTCOSTS'].includes(type)) return 'cogs';
  if (type === 'OTHERINCOME') return 'otherIncome';
  if (type === 'OTHEREXPENSE') return 'otherExpenses';
  if (['EXPENSE', 'OVERHEADS', 'DEPRECIAT'].includes(type) || accountClass === 'EXPENSE') return 'operatingExpenses';
  return null;
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const start = parseDate(fromDate);
  const end = parseDate(toDate);
  if (!start || !end || start > end || (end.getTime() - start.getTime()) / 86400000 > 364) {
    return NextResponse.json({ error: 'Provide a valid reporting period of up to 365 days.' }, { status: 400 });
  }

  const tokenInfo = await getXeroAccessToken(tenantId);
  if (!tokenInfo) return NextResponse.json({ connected: false, comparisons: null, receivables: null, payables: null });
  try {
    await db.assertPostgres();
  } catch (error) {
    console.error('Management Accounts requires PostgreSQL for report storage:', error);
    return NextResponse.json({ error: 'Management Accounts data could not be loaded from PostgreSQL.' }, { status: 503 });
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  const yearStart = shiftYear(start, -1);
  const yearEnd = shiftYear(end, -1);
  const reportForPeriod = async (from: Date, to: Date) => {
    const fromText = isoDate(from);
    const toText = isoDate(to);
    const key = `ProfitAndLoss_${fromText}_${toText}`;
    try {
      const report = await getOrFetchManagementReport(tenantId, key, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${fromText}&toDate=${toText}`));
      return { fromDate: fromText, toDate: toText, available: Boolean(summarizePnl(report)), totals: summarizePnl(report) };
    } catch (error) {
      console.warn(`Management comparison P&L unavailable for ${fromText} to ${toText}:`, error);
      if (!db.isPostgres()) throw error;
      return { fromDate: fromText, toDate: toText, available: false, totals: null };
    }
  };

  const currentDate = isoDate(new Date());
  const invoiceBalancesByContact = async (type: 'ACCREC' | 'ACCPAY') => {
    if (toDate !== currentDate) return { available: false, asOfDate: currentDate, entries: [] as { name: string; amount: number; invoiceCount: number }[] };
    try {
      let invoices = await db.getPostgresReport(tenantId, 'Invoices');
      if (!Array.isArray(invoices)) {
        const fetchedInvoices = await fetchXeroResourcePaginated(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Invoices');
        await db.savePostgresReport(tenantId, 'Invoices', fetchedInvoices);
        invoices = await db.getPostgresReport(tenantId, 'Invoices');
      }
      if (!Array.isArray(invoices)) throw new Error('Xero invoices were not available after saving to PostgreSQL.');

      const balances = new Map<string, { name: string; amount: number; invoiceCount: number }>();
      for (const invoice of invoices) {
        const record = asRecord(invoice);
        if (String(record.Type || record.type || '').toUpperCase() !== type) continue;
        const status = String(record.Status || record.status || '').toUpperCase();
        if (['PAID', 'VOIDED', 'DELETED', 'DRAFT'].includes(status)) continue;
        const contact = asRecord(record.Contact);
        const name = String(record.ContactName || record.contact_name || contact.Name || '').trim();
        if (!name) continue;
        const total = Number(record.Total ?? record.total ?? 0);
        const paid = Number(record.AmountPaid ?? record.amount_paid ?? 0);
        const amountDue = Number(record.AmountDue ?? record.amount_due ?? (total - paid));
        if (!Number.isFinite(amountDue) || Math.abs(amountDue) < 0.005) continue;
        const contactId = String(contact.ContactID || record.contact_id || name.toLowerCase());
        const existing = balances.get(contactId) || { name, amount: 0, invoiceCount: 0 };
        existing.amount += amountDue;
        existing.invoiceCount += 1;
        balances.set(contactId, existing);
      }
      const entries = [...balances.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
      return { available: entries.length > 0, asOfDate: currentDate, entries };
    } catch (error) {
      console.warn(`Management ${type} contact balances unavailable:`, error);
      if (!db.isPostgres()) throw error;
      return { available: false, asOfDate: currentDate, entries: [] as { name: string; amount: number; invoiceCount: number }[] };
    }
  };

  const [previousPeriod, priorYear, receivables, payables] = await Promise.all([
    reportForPeriod(previousStart, previousEnd),
    reportForPeriod(yearStart, yearEnd),
    invoiceBalancesByContact('ACCREC'),
    invoiceBalancesByContact('ACCPAY'),
  ]);

  let budget: (PeriodTotals & { available: boolean; periodLabel: string }) | null = null;
  try {
    const monthStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0));
    const budgets = await getOrFetchManagementReport(tenantId, 'Budgets_metadata', () => XeroBudgetService.fetchBudgetsList(tokenInfo.accessToken, tokenInfo.xeroTenantId)) as unknown[];
    const selectedBudget = budgets.find((item) => asRecord(item).Type === 'OVERALL') || budgets[0];
    const selectedBudgetRecord = asRecord(selectedBudget);
    if (selectedBudgetRecord.BudgetID) {
      const budgetStart = isoDate(monthStart);
      const budgetEnd = isoDate(monthEnd);
      const budgetId = String(selectedBudgetRecord.BudgetID);
      const details = await getOrFetchManagementReport(tenantId, `Budget_${budgetId}_${budgetStart}_${budgetEnd}`, () => XeroBudgetService.fetchSingleBudget(tokenInfo.accessToken, tokenInfo.xeroTenantId, budgetId, budgetStart, budgetEnd)) as { BudgetLines?: { AccountID?: unknown; AccountCode?: unknown; Balances?: { Period?: unknown; Amount?: unknown; UnitAmount?: unknown }[] }[] } | null;
      const accounts = await getOrFetchManagementReport(tenantId, 'Accounts_metadata', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Accounts')) as unknown[];
      const byId = new Map<string, BudgetCategory>();
      const byCode = new Map<string, BudgetCategory>();
      for (const account of accounts) {
        const category = accountBudgetCategory(account);
        if (!category) continue;
        const accountRecord = asRecord(account);
        const id = String(accountRecord.AccountID || accountRecord.accountId || accountRecord.account_id || '');
        const code = String(accountRecord.Code || accountRecord.code || accountRecord.account_code || '');
        if (id) byId.set(id, category);
        if (code) byCode.set(code, category);
      }
      const budgetTotals: Record<BudgetCategory, number> = { revenue: 0, cogs: 0, operatingExpenses: 0, otherIncome: 0, otherExpenses: 0 };
      let hasBudgetValues = false;
      for (const line of details?.BudgetLines || []) {
        const category = byId.get(String(line.AccountID || '')) || byCode.get(String(line.AccountCode || ''));
        if (!category) continue;
        for (const balance of line.Balances || []) {
          const match = /^(\d{4})-(\d{2})$/.exec(String(balance.Period || ''));
          if (!match) continue;
          const month = Number(match[2]) - 1;
          const periodStart = new Date(Date.UTC(Number(match[1]), month, 1));
          const periodEnd = new Date(Date.UTC(Number(match[1]), month + 1, 0));
          const overlapStart = new Date(Math.max(start.getTime(), periodStart.getTime()));
          const overlapEnd = new Date(Math.min(end.getTime(), periodEnd.getTime()));
          if (overlapStart > overlapEnd) continue;
          const daysInMonth = periodEnd.getUTCDate();
          const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
          const amount = Math.abs(Number(balance.Amount ?? balance.UnitAmount ?? 0));
          if (!Number.isFinite(amount)) continue;
          budgetTotals[category] += amount * (overlapDays / daysInMonth);
          hasBudgetValues = true;
        }
      }
      if (hasBudgetValues) {
        const revenue = budgetTotals.revenue;
        const grossProfit = revenue - budgetTotals.cogs;
        budget = {
          revenue,
          grossProfit,
          operatingExpenses: budgetTotals.operatingExpenses + budgetTotals.otherExpenses,
          netProfit: grossProfit + budgetTotals.otherIncome - budgetTotals.operatingExpenses - budgetTotals.otherExpenses,
          available: true,
          periodLabel: `${isoDate(start)} to ${isoDate(end)} (monthly budget allocation)`,
        };
      }
    }
  } catch (error) {
    console.warn('Management Accounts budget comparison unavailable:', error);
    if (!db.isPostgres()) throw error;
  }

  return NextResponse.json({
    connected: true,
    comparisons: {
      previousPeriod: { ...previousPeriod, label: 'Previous period' },
      priorYear: { ...priorYear, label: 'Same period last year' },
      budget,
    },
    receivables,
    payables,
  });
}
