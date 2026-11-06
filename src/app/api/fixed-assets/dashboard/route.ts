import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroFixedAssetsService } from '@/lib/fixedAssetsService';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceSync = searchParams.get('force_sync') === 'true';

  try {
    const summary = await XeroFixedAssetsService.getDashboard(tenantId, forceSync);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch fixed assets dashboard data' }, { status: 500 });
  }
}
