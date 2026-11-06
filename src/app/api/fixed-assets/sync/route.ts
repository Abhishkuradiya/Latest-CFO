import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroFixedAssetsService } from '@/lib/fixedAssetsService';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Perform manual sync
    await XeroFixedAssetsService.syncFixedAssets(tenantId);
    
    // Clear fixed assets dashboard summary cache to force reload
    await db.saveFixedAssetsCache(tenantId, 'FixedAssetsDashboardSummary', null, 0);

    return NextResponse.json({ success: true, message: 'Xero fixed assets sync completed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Fixed assets sync failed' }, { status: 500 });
  }
}
