import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { fetchXeroResource, getXeroAccessToken } from '@/lib/xero';
import { loadManagementAccountActivities } from '@/lib/services/ManagementAccountActivityService';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function asAccounts(value: unknown): Record<string, unknown>[] {
  if (typeof value === 'string') {
    try { return asAccounts(JSON.parse(value)); } catch { return []; }
  }
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === 'object' && Array.isArray((value as { Accounts?: unknown }).Accounts)) {
    return (value as { Accounts: Record<string, unknown>[] }).Accounts;
  }
  if (value && typeof value === 'object' && Array.isArray((value as { raw_data?: unknown }).raw_data)) {
    return (value as { raw_data: Record<string, unknown>[] }).raw_data;
  }
  return [];
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const name = (searchParams.get('accountName') || '').trim();
  const accountId = (searchParams.get('accountId') || '').trim();
  const accountCode = (searchParams.get('accountCode') || '').trim();
  const category = (searchParams.get('category') || '').trim();
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  if (!name || !validDate(fromDate) || !validDate(toDate) || fromDate! > toDate!) {
    return NextResponse.json({ error: 'A valid account and comparison date range are required.' }, { status: 400 });
  }

  const token = await getXeroAccessToken(tenantId);
  if (!token) return NextResponse.json({ available: false, transactions: [], message: 'Connect a Xero organisation to view account activity.' });

  try {
    await db.assertPostgres();
    let accounts = asAccounts(await getOrFetchManagementReport(tenantId, 'Accounts_metadata', () => fetchXeroResource(token.accessToken, token.xeroTenantId, 'Accounts')));
    const matchesAccount = (account: Record<string, unknown>) => accountId
      ? String(account.AccountID ?? '').toLowerCase() === accountId.toLowerCase()
      : accountCode
        ? String(account.Code ?? '').trim() === accountCode
        : String(account.Name ?? '').trim().toLocaleLowerCase() === name.toLocaleLowerCase();
    let account = accounts.find(matchesAccount);
    if (!account) {
      const refreshedAccounts = await fetchXeroResource(token.accessToken, token.xeroTenantId, 'Accounts');
      await db.savePostgresReport(tenantId, 'Accounts_metadata', refreshedAccounts);
      accounts = asAccounts(await db.getPostgresReport(tenantId, 'Accounts_metadata'));
      account = accounts.find(matchesAccount);
    }
    if (!account) {
      return NextResponse.json({ available: false, transactions: [], message: 'This account could not be matched to the connected Xero chart of accounts.' }, { status: 404 });
    }

    const resolvedId = String(account.AccountID ?? '');
    const resolvedCode = String(account.Code ?? '');
    const resolvedName = String(account.Name ?? name);
    const key = `${category}|${resolvedName.toLocaleLowerCase()}`;
    const activities = await loadManagementAccountActivities(tenantId, [{
      key,
      name: resolvedName,
      category,
      previous: null,
      accountId: resolvedId,
      accountCode: resolvedCode,
    }], fromDate!, toDate!);
    const activity = activities.get(key);
    const transactions = activity?.transactions ?? [];
    return NextResponse.json({
      available: activity?.available ?? false,
      account: resolvedName,
      accountCode: resolvedCode,
      fromDate,
      toDate,
      transactions,
      message: activity?.message ?? 'No Xero journal detail is available for this account and period.',
    });
  } catch (error) {
    console.error('Management Accounts account activity fetch failed:', error);
    return NextResponse.json({ available: false, transactions: [], message: 'Xero account activity could not be loaded. Please try again.' }, { status: 502 });
  }
}
