import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { fetchXeroReport, fetchXeroResource, getXeroAccessToken } from '@/lib/xero';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';
import { loadManagementAccountActivities } from '@/lib/services/ManagementAccountActivityService';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

type Cell = { Value?: unknown; Attributes?: { Id?: string; Value?: string }[] };
type ReportRow = { RowType?: string; Title?: string; Cells?: Cell[]; Rows?: ReportRow[]; Summary?: ReportRow };
type AccountMovement = { name: string; category: string; previous: number | null; current: number | null; change: number | null; changePercent: number | null; accountId?: string; accountCode?: string };

const parseIsoDate = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};
const iso = (value: Date) => value.toISOString().slice(0, 10);
const parseAmount = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/,/g, '');
  if (!text || text === '-') return null;
  const negative = text.startsWith('(') && text.endsWith(')');
  const number = Number(text.replace(/[()]/g, ''));
  return Number.isFinite(number) ? (negative ? -number : number) : null;
};
const percentageMovement = (previous: number | null, current: number | null) => previous !== null && current !== null && previous > 0 ? ((current - previous) / previous) * 100 : null;
async function withXeroRetry<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 2 || !/\b429\b|\b5\d{2}\b|fetch failed/i.test(message)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
}

async function cachedReport(tenantId: number, token: { accessToken: string; xeroTenantId: string }, key: string, path: string, query: string) {
  return getOrFetchManagementReport(tenantId, key, () => withXeroRetry(() => fetchXeroReport(token.accessToken, token.xeroTenantId, path, query)));
}

function readBankSummary(report: { Rows?: ReportRow[] } | null) {
  if (!Array.isArray(report?.Rows)) return null;
  let columns: Record<string, number> | null = null;
  const accountRows: { name: string; opening: number | null; inflows: number | null; outflows: number | null; closing: number | null }[] = [];
  const visit = (rows: ReportRow[]) => {
    for (const row of rows) {
      if (row.RowType === 'Header' && Array.isArray(row.Cells)) {
        const labels = row.Cells.map((cell) => String(cell.Value ?? '').toLowerCase());
        const locate = (needles: string[]) => labels.findIndex((label) => needles.some((needle) => label.includes(needle)));
        const opening = locate(['opening']);
        const inflows = locate(['received', 'cash in']);
        const outflows = locate(['spent', 'cash out']);
        const closing = locate(['closing']);
        if ([opening, inflows, outflows, closing].every((index) => index >= 0)) columns = { opening, inflows, outflows, closing };
      }
      if ((row.RowType === 'Row' || row.RowType === 'SummaryRow') && Array.isArray(row.Cells) && columns) {
        const name = String(row.Cells[0]?.Value ?? '').trim();
        if (name && !/^(total|net movement)/i.test(name)) {
          const get = (column: number) => parseAmount(row.Cells?.[column]?.Value);
          const received = get(columns.inflows);
          const spent = get(columns.outflows);
          accountRows.push({ name, opening: get(columns.opening), inflows: received === null ? null : Math.abs(received), outflows: spent === null ? null : Math.abs(spent), closing: get(columns.closing) });
        }
      }
      if (Array.isArray(row.Rows)) visit(row.Rows);
    }
  };
  visit(report.Rows);
  if (!columns || accountRows.length === 0) return null;
  const sumField = (field: 'opening' | 'inflows' | 'outflows' | 'closing') => {
    const values = accountRows.map((account) => account[field]);
    return values.every((value) => value !== null) ? values.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
  };
  const opening = sumField('opening');
  const inflows = sumField('inflows');
  const outflows = sumField('outflows');
  const closing = sumField('closing');
  const netMovement = inflows !== null && outflows !== null ? inflows - outflows : null;
  const difference = opening !== null && netMovement !== null && closing !== null ? opening + netMovement - closing : null;
  return {
    accounts: accountRows,
    opening,
    inflows,
    outflows,
    netMovement,
    closing,
    reconciliationDifference: difference,
    available: opening !== null && inflows !== null && outflows !== null && closing !== null,
  };
}

function readAccountRows(report: { Rows?: ReportRow[] } | null) {
  const entries = new Map<string, { name: string; category: string; value: number; accountId?: string; accountCode?: string }>();
  const visit = (rows: ReportRow[], path: string[]) => {
    for (const row of rows) {
      const nextPath = row.RowType === 'Section' && row.Title ? [...path, row.Title] : path;
      if (row.RowType === 'Row' && Array.isArray(row.Cells) && row.Cells.length >= 2) {
        const name = String(row.Cells[0]?.Value ?? '').trim();
        if (name && !/^(total|net assets|net current assets)/i.test(name)) {
          // Xero Balance Sheet reports put the account balance in the first value
          // column; later columns can contain percentages and must not be treated
          // as the balance itself.
          const value = parseAmount(row.Cells[1]?.Value);
          const attributes = row.Cells.flatMap((cell) => cell.Attributes ?? []);
          const accountId = attributes.find((attribute) => attribute.Id?.toLowerCase() === 'accountid')?.Value;
          const accountCode = attributes.find((attribute) => ['accountcode', 'code'].includes(attribute.Id?.toLowerCase() ?? ''))?.Value;
          const fullPath = nextPath.join(' ').toLowerCase();
          const category = fullPath.includes('equity') || fullPath.includes('capital and reserves') ? 'Equity'
            : fullPath.includes('liabilit') || fullPath.includes('creditor') ? 'Liabilities'
              : fullPath.includes('asset') ? 'Assets' : '';
          if (category && value !== null) {
            const subcategory = category === 'Assets'
              ? fullPath.includes('non-current') || fullPath.includes('fixed asset') ? 'Non-current assets' : 'Current / other assets'
              : category === 'Liabilities'
                ? fullPath.includes('non-current') || fullPath.includes('long term') ? 'Non-current liabilities' : 'Current / other liabilities'
                : 'Equity';
            const key = `${category}|${name.toLocaleLowerCase()}`;
            entries.set(key, { name, category: subcategory, value, accountId, accountCode });
          }
        }
      }
      if (Array.isArray(row.Rows)) visit(row.Rows, nextPath);
    }
  };
  if (Array.isArray(report?.Rows)) visit(report.Rows, []);
  return entries;
}

async function bankTransactionsForPeriod(tenantId: number, token: { accessToken: string; xeroTenantId: string }, fromDate: string, toDate: string) {
  const cacheKey = `ManagementBankTransactions_${fromDate}_${toDate}`;
  const cached = await db.getPostgresReport(tenantId, cacheKey);
  if (cached && typeof cached === 'object' && Array.isArray((cached as { items?: unknown }).items)) return cached as { items: Record<string, unknown>[]; complete: boolean };
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  const xeroDate = (date: Date) => `${date.getUTCFullYear()},${String(date.getUTCMonth() + 1).padStart(2, '0')},${String(date.getUTCDate()).padStart(2, '0')}`;
  const where = `Date>=DateTime(${xeroDate(from)})&&Date<=DateTime(${xeroDate(to)})`;
  const items: Record<string, unknown>[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 100; page += 1) {
    const records = await withXeroRetry(() => fetchXeroResource(token.accessToken, token.xeroTenantId, 'BankTransactions', `where=${encodeURIComponent(where)}&page=${page}`));
    items.push(...records as Record<string, unknown>[]);
    if (records.length < pageSize) {
      const fetched = { items, complete: true };
      await db.savePostgresReport(tenantId, cacheKey, fetched);
      return await db.getPostgresReport(tenantId, cacheKey) as typeof fetched;
    }
  }
  const fetched = { items, complete: false };
  await db.savePostgresReport(tenantId, cacheKey, fetched);
  return await db.getPostgresReport(tenantId, cacheKey) as typeof fetched;
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fromText = request.nextUrl.searchParams.get('fromDate');
  const toText = request.nextUrl.searchParams.get('toDate');
  const from = parseIsoDate(fromText);
  const to = parseIsoDate(toText);
  if (!from || !to || from > to || (to.getTime() - from.getTime()) / 86400000 > 364) {
    return NextResponse.json({ error: 'Provide a valid reporting period of up to 365 days.' }, { status: 400 });
  }

  const token = await getXeroAccessToken(tenantId);
  if (!token) return NextResponse.json({ connected: false, cashMovement: null, balanceMovement: null, closeReview: null });
  try {
    await db.assertPostgres();
  } catch (error) {
    console.error('Management Accounts requires PostgreSQL for report storage:', error);
    return NextResponse.json({ error: 'Management Accounts data could not be loaded from PostgreSQL.' }, { status: 503 });
  }

  const priorMonthEnd = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0));
  const priorDate = iso(priorMonthEnd);
  const selectedDate = iso(to);
  const reportResults = await Promise.allSettled([
    cachedReport(tenantId, token, `BankSummary_${fromText}_${toText}`, 'BankSummary', `fromDate=${fromText}&toDate=${toText}`),
    cachedReport(tenantId, token, `BalanceSheet_${priorDate}`, 'BalanceSheet', `date=${priorDate}`),
    cachedReport(tenantId, token, `BalanceSheet_${selectedDate}`, 'BalanceSheet', `date=${selectedDate}`),
    bankTransactionsForPeriod(tenantId, token, fromText!, toText!),
  ]);
  try {
    await db.assertPostgres();
  } catch (error) {
    console.error('PostgreSQL became unavailable while loading Management Accounts data:', error);
    return NextResponse.json({ error: 'Management Accounts data could not be read back from PostgreSQL.' }, { status: 503 });
  }

  const bankSummary = reportResults[0].status === 'fulfilled' ? readBankSummary(reportResults[0].value) : null;
  const previousReport = reportResults[1].status === 'fulfilled' ? reportResults[1].value as { Rows?: ReportRow[] } : null;
  const currentReport = reportResults[2].status === 'fulfilled' ? reportResults[2].value as { Rows?: ReportRow[] } : null;
  const contactComparisons = {
    receivables: { available: false, loading: true, entries: [] },
    payables: { available: false, loading: true, entries: [] },
  };
  const previousRows = readAccountRows(previousReport);
  const currentRows = readAccountRows(currentReport);
  const movementKeys = new Set([...previousRows.keys(), ...currentRows.keys()]);
  const accountMovements: AccountMovement[] = [...movementKeys].map((key) => {
    const previous = previousRows.get(key);
    const current = currentRows.get(key);
    const opening = previous?.value ?? null;
    const closing = current?.value ?? null;
    const change = opening !== null && closing !== null ? closing - opening : null;
    return { name: current?.name ?? previous?.name ?? 'Account', category: current?.category ?? previous?.category ?? 'Other', previous: opening, current: closing, change, changePercent: percentageMovement(opening, closing), accountId: current?.accountId ?? previous?.accountId, accountCode: current?.accountCode ?? previous?.accountCode };
  }).sort((left, right) => Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0));

  const activityStart = new Date(`${priorDate}T00:00:00.000Z`);
  activityStart.setUTCDate(activityStart.getUTCDate() + 1);
  const activityFromDate = iso(activityStart);
  let xeroAccounts: Record<string, unknown>[] = [];
  try {
    const parsedAccounts = await getOrFetchManagementReport(tenantId, 'Accounts_metadata', () => fetchXeroResource(token.accessToken, token.xeroTenantId, 'Accounts'));
    if (Array.isArray(parsedAccounts)) xeroAccounts = parsedAccounts;
  } catch (error) {
    console.warn('Unable to load Xero account metadata from PostgreSQL/Xero:', error);
  }
  await db.assertPostgres();
  const activeAccountForMovement = (movement: AccountMovement) => xeroAccounts.some((account) => {
    if (String(account.Status ?? account.status ?? '').trim().toUpperCase() !== 'ACTIVE') return false;
    if (movement.accountId) return String(account.AccountID ?? '').toLowerCase() === movement.accountId.toLowerCase();
    if (movement.accountCode) return String(account.Code ?? '').trim() === movement.accountCode;
    return String(account.Name ?? '').trim().toLocaleLowerCase() === movement.name.toLocaleLowerCase();
  });
  const movementTargets = accountMovements.filter(activeAccountForMovement).map((movement) => {
    const metadata = xeroAccounts.find((account) => movement.accountId
      ? String(account.AccountID ?? '').toLowerCase() === movement.accountId.toLowerCase()
      : movement.accountCode
        ? String(account.Code ?? '').trim() === movement.accountCode
        : String(account.Name ?? '').trim().toLocaleLowerCase() === movement.name.toLocaleLowerCase());
    return {
      ...movement,
      accountId: movement.accountId ?? String(metadata?.AccountID ?? ''),
      accountCode: movement.accountCode ?? String(metadata?.Code ?? ''),
      key: `${movement.category}|${movement.name.toLocaleLowerCase()}`,
    };
  });
  const activities = await loadManagementAccountActivities(tenantId, movementTargets, activityFromDate, selectedDate);
  const accountsWithActivity = movementTargets.map((movement) => ({
    ...movement,
    activity: activities.get(movement.key) ?? {
      available: false, message: 'No Xero journal detail is available for this account and period.', transactions: [],
    },
  }));

  const totalsFor = (report: { Rows?: ReportRow[] } | null) => report?.Rows ? {
    assets: BalanceSheetParser.findTotalAssets(report.Rows),
    liabilities: BalanceSheetParser.findTotalLiabilities(report.Rows),
    equity: BalanceSheetParser.findTotalEquity(report.Rows),
  } : null;
  const previousTotals = totalsFor(previousReport);
  const currentTotals = totalsFor(currentReport);
  const balanceMovement = previousTotals && currentTotals ? {
    previousDate: priorDate,
    currentDate: selectedDate,
    previous: previousTotals,
    current: currentTotals,
    changes: {
      assets: previousTotals.assets !== null && currentTotals.assets !== null ? currentTotals.assets - previousTotals.assets : null,
      liabilities: previousTotals.liabilities !== null && currentTotals.liabilities !== null ? currentTotals.liabilities - previousTotals.liabilities : null,
      equity: previousTotals.equity !== null && currentTotals.equity !== null ? currentTotals.equity - previousTotals.equity : null,
    },
    contactComparisons,
    changePercentages: {
      assets: percentageMovement(previousTotals.assets, currentTotals.assets),
      liabilities: percentageMovement(previousTotals.liabilities, currentTotals.liabilities),
      equity: percentageMovement(previousTotals.equity, currentTotals.equity),
    },
    accounts: accountsWithActivity,
    significant: accountsWithActivity.filter((account) => account.change !== null).slice(0, 5),
    equations: [previousTotals, currentTotals].map((totals, index) => {
      const difference = totals.assets !== null && totals.liabilities !== null && totals.equity !== null ? totals.assets - totals.liabilities - totals.equity : null;
      return { date: index === 0 ? priorDate : selectedDate, difference, balanced: difference === null ? null : Math.abs(difference) <= 0.05 };
    }),
    available: accountMovements.length > 0 || Object.values(currentTotals).some((value) => value !== null),
  } : null;

  const transactionsResult = reportResults[3];
  const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : null;
  const bankTransactions = transactions?.items.filter((record) => String(record.Status || '').toUpperCase() === 'AUTHORISED') ?? [];
  const unreconciled = bankTransactions.filter((record) => record.IsReconciled !== true && String(record.IsReconciled).toLowerCase() !== 'true');
  const currentEquation = balanceMovement?.equations[1];
  const controls = [
    {
      id: 'cash-roll-forward', name: 'Cash movement roll-forward', category: 'Cash and bank',
      status: !bankSummary?.available ? 'not-verified' : Math.abs(bankSummary.reconciliationDifference ?? Infinity) <= 0.05 ? 'verified' : 'attention',
      detail: !bankSummary?.available ? 'Xero did not return a complete Bank Summary for this period.' : Math.abs(bankSummary.reconciliationDifference ?? Infinity) <= 0.05 ? 'Opening balance, receipts and payments agree to the closing balance in the Xero Bank Summary.' : `The Bank Summary roll-forward differs by ${Math.abs(bankSummary.reconciliationDifference ?? 0).toFixed(2)} in the reporting currency.`,
      evidence: 'Xero Bank Summary report', referenceDate: `${fromText} to ${toText}`,
    },
    {
      id: 'bank-reconciliation', name: 'Bank transaction reconciliation', category: 'Cash and bank',
      status: !transactions ? 'not-verified' : !transactions.complete ? 'not-verified' : unreconciled.length ? 'attention' : bankTransactions.length ? 'verified' : 'not-verified',
      detail: !transactions ? 'Xero transaction reconciliation evidence could not be retrieved.' : !transactions.complete ? 'The transaction result reached the retrieval limit; completeness cannot be confirmed.' : bankTransactions.length === 0 ? 'No authorised bank transactions were returned for this period.' : unreconciled.length ? `${unreconciled.length} of ${bankTransactions.length} authorised transactions are not marked reconciled in Xero.` : `All ${bankTransactions.length} authorised transactions returned for this period are marked reconciled in Xero.`,
      evidence: transactions ? 'Xero BankTransactions IsReconciled status' : 'Unavailable', referenceDate: `${fromText} to ${toText}`,
    },
    {
      id: 'balance-sheet-equation', name: 'Balance sheet equation', category: 'Balance sheet',
      status: currentEquation?.balanced === true ? 'verified' : currentEquation?.balanced === false ? 'attention' : 'not-verified',
      detail: currentEquation?.balanced === true ? 'Xero-reported assets equal liabilities and equity. This check does not confirm transaction-level reconciliations.' : currentEquation?.balanced === false ? `Xero-reported assets differ from liabilities and equity by ${Math.abs(currentEquation.difference ?? 0).toFixed(2)} in the reporting currency.` : 'The source report did not provide all three balance-sheet totals.',
      evidence: 'Xero Balance Sheet report totals', referenceDate: selectedDate,
    },
    {
      id: 'receivables-control', name: 'Receivables control account', category: 'Receivables', status: 'not-verified',
      detail: 'A historical aged-receivables control reconciliation is not available from the source data loaded for this report.', evidence: 'No independent aged-receivables reconciliation evidence', referenceDate: selectedDate,
    },
    {
      id: 'payables-control', name: 'Payables control account', category: 'Payables', status: 'not-verified',
      detail: 'A historical aged-payables control reconciliation is not available from the source data loaded for this report.', evidence: 'No independent aged-payables reconciliation evidence', referenceDate: selectedDate,
    },
  ];
  const closeReview = {
    controls,
    counts: {
      verified: controls.filter((control) => control.status === 'verified').length,
      attention: controls.filter((control) => control.status === 'attention').length,
      notVerified: controls.filter((control) => control.status === 'not-verified').length,
      notApplicable: controls.filter((control) => control.status === 'not-applicable').length,
    },
    checkedAt: new Date().toISOString(),
    period: { fromDate: fromText, toDate: toText },
  };

  const org = await getOrFetchManagementReport(
    tenantId,
    'Organisation',
    async () => (await fetchXeroResource(token.accessToken, token.xeroTenantId, 'Organisations'))[0] ?? null,
  ) as Record<string, unknown> | null;
  await db.assertPostgres();
  return NextResponse.json({
    connected: true,
    cashMovement: bankSummary,
    balanceMovement,
    closeReview,
    meta: { currency: org?.BaseCurrency || null, calculatedAt: new Date().toISOString() },
  });
}
