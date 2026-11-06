import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.clearCachedRecords(tenantId);
    return NextResponse.json({ success: true, message: 'Local cache cleared successfully!' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Failed to clear cache' }, { status: 500 });
  }
}
