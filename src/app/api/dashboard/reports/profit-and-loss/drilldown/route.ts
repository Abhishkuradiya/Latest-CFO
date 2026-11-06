import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getAccountTransactionsLedger } from '@/lib/ledger-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountName = searchParams.get('account') || 'Amazon Sales';
  const fromDateStr = searchParams.get('fromDate') || searchParams.get('from_date') || searchParams.get('startDate') || '2026-01-01';
  const toDateStr = searchParams.get('toDate') || searchParams.get('to_date') || searchParams.get('endDate') || '2026-12-31';
  const targetValue = parseFloat(searchParams.get('value') || '0');

  try {
    const result = await getAccountTransactionsLedger(
      tenantId,
      accountName,
      fromDateStr,
      toDateStr,
      targetValue
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error fetching P&L drilldown:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
