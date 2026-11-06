import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroInventoryService } from '@/lib/inventoryService';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deadStockDays = parseInt(searchParams.get('dead_stock_days') || '90') || 90;

  try {
    const summary = await XeroInventoryService.getDashboard(tenantId, deadStockDays);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch inventory dashboard data' }, { status: 500 });
  }
}
