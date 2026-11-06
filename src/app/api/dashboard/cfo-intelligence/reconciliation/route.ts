import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { CFOReconciliationService } from '@/lib/services/CFOReconciliationService';

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    if (tenantId === null) {
      return NextResponse.json({ error: 'Unauthorized: Session missing or invalid' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const reconciliation = await CFOReconciliationService.reconcileTenantMetrics(
      tenantId,
      fromDate,
      toDate
    );

    return NextResponse.json({
      success: true,
      data: reconciliation
    });
  } catch (err: any) {
    console.error('Error in CFO reconciliation shadow API:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to compute engine reconciliation' },
      { status: 500 }
    );
  }
}
