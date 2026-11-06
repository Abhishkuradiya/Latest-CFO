import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getKpiScorecard } from '@/lib/kpiScorecard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  try {
    // Remove legacy KPI target configuration now that the scorecard is
    // comparison-only. This is tenant-scoped and idempotent.
    await db.deleteReport(tenantId, 'KpiTargets').catch(() => undefined);
    return NextResponse.json(await getKpiScorecard(tenantId, params.get('period') || 'ttm', params.get('from'), params.get('to')));
  } catch (error: any) {
    console.error('KPI scorecard load failed:', error);
    return NextResponse.json({ error: error.message || 'Unable to calculate KPI scorecard' }, { status: 500 });
  }
}
