import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroCapabilityService } from '@/lib/services/XeroCapabilityService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const matrix = await XeroCapabilityService.getTenantCapabilityMatrix(tenantId);
    return NextResponse.json(matrix);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to check capabilities' },
      { status: 500 }
    );
  }
}
