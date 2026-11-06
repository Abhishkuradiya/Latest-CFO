import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    if (tenantId === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mode = await db.getTenantEngineMode(tenantId);
    return NextResponse.json({
      success: true,
      tenantId,
      engineMode: mode
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    if (tenantId === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mode } = await req.json();
    if (!mode || !['LEGACY', 'SHADOW', 'CANONICAL'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be LEGACY, SHADOW, or CANONICAL' },
        { status: 400 }
      );
    }

    await db.saveTenantEngineMode(tenantId, mode as any);

    return NextResponse.json({
      success: true,
      tenantId,
      engineMode: mode,
      message: `Tenant ${tenantId} CFO metric calculation engine mode updated to ${mode}.`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
