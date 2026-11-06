import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken } from '@/lib/xero';
import { loadManagementAccountContactComparisons } from '@/lib/services/ManagementAccountAgedContactService';

export const dynamic = 'force-dynamic';

function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const selectedDate = request.nextUrl.searchParams.get('date');
  if (!isIsoDate(selectedDate)) return NextResponse.json({ error: 'A valid balance-sheet date is required.' }, { status: 400 });

  const token = await getXeroAccessToken(tenantId);
  if (!token) return NextResponse.json({ connected: false }, { status: 200 });

  try {
    await db.assertPostgres();
    const previousMonthEnd = new Date(`${selectedDate}T00:00:00.000Z`);
    previousMonthEnd.setUTCDate(0);
    const previousDate = previousMonthEnd.toISOString().slice(0, 10);
    const contactComparisons = await loadManagementAccountContactComparisons(
      tenantId,
      token.accessToken,
      token.xeroTenantId,
      previousDate,
      selectedDate,
    );
    await db.assertPostgres();
    return NextResponse.json({ connected: true, contactComparisons });
  } catch (error) {
    console.error('Management Accounts contact comparison failed:', error);
    return NextResponse.json({ error: 'Xero contact balances could not be loaded.' }, { status: 502 });
  }
}
