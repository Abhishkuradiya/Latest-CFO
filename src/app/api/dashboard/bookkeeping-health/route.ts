import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession } from '@/lib/auth';
import { getBookkeepingHealth, runBookkeepingHealthScan } from '@/lib/services/bookkeeping-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize')) || 25));
    const data = await getBookkeepingHealth(session.tenantId, {
      page,
      pageSize,
      search: params.get('search')?.trim() || undefined,
      category: params.get('category') || undefined,
      severity: params.get('severity') || undefined,
      status: params.get('status') || undefined,
      periodStart: /^\d{4}-\d{2}-\d{2}$/.test(params.get('periodStart') ?? '') ? params.get('periodStart')! : undefined,
      periodEnd: /^\d{4}-\d{2}-\d{2}$/.test(params.get('periodEnd') ?? '') ? params.get('periodEnd')! : undefined,
      fromDate: /^\d{4}-\d{2}-\d{2}$/.test(params.get('fromDate') ?? '') ? params.get('fromDate')! : undefined,
      toDate: /^\d{4}-\d{2}-\d{2}$/.test(params.get('toDate') ?? '') ? params.get('toDate')! : undefined,
      minAmount: params.has('minAmount') && Number.isFinite(Number(params.get('minAmount'))) ? Math.max(0, Number(params.get('minAmount'))) : undefined,
      maxAmount: params.has('maxAmount') && Number.isFinite(Number(params.get('maxAmount'))) ? Math.max(0, Number(params.get('maxAmount'))) : undefined,
      sort: ['DATE', 'AMOUNT'].includes(params.get('sort') ?? '') ? params.get('sort')! : undefined
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Bookkeeping Health database read failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bookkeeping Health could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'scan') return NextResponse.json({ error: 'Unsupported Bookkeeping Health action.' }, { status: 400 });
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart ?? '') ? body.periodStart : undefined;
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(body.periodEnd ?? '') ? body.periodEnd : undefined;
    const scan = await runBookkeepingHealthScan(session.tenantId, { startDate, endDate });
    return NextResponse.json({ success: true, scan });
  } catch (error) {
    console.error('Bookkeeping Health scan failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The scan could not be completed.' }, { status: 503 });
  }
}
