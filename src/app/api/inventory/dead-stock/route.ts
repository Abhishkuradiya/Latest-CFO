import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroInventoryService } from '@/lib/inventoryService';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deadStockDays = parseInt(searchParams.get('dead_stock_days') || '90') || 90;
  const search = (searchParams.get('search') || '').toLowerCase();
  const page = parseInt(searchParams.get('page') || '1') || 1;
  const limit = parseInt(searchParams.get('limit') || '10') || 10;
  const sortBy = searchParams.get('sort_by') || 'daysUnsold';
  const sortOrder = searchParams.get('sort_order') || 'desc'; // Default desc so longest unsold shows first

  try {
    const items = await db.getInventoryItems(tenantId);
    const deadStock = await XeroInventoryService.calculateDeadStock(tenantId, items, deadStockDays);

    // Apply searching
    let filtered = deadStock;
    if (search) {
      filtered = deadStock.filter(item => 
        item.name.toLowerCase().includes(search) || 
        item.code.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    filtered.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: paginated,
      total,
      page,
      limit
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch dead stock items' }, { status: 500 });
  }
}
