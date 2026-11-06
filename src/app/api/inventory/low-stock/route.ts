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
  const search = (searchParams.get('search') || '').toLowerCase();
  const page = parseInt(searchParams.get('page') || '1') || 1;
  const limit = parseInt(searchParams.get('limit') || '10') || 10;
  const sortBy = searchParams.get('sort_by') || 'code';
  const sortOrder = searchParams.get('sort_order') || 'asc';

  try {
    const items = await db.getInventoryItems(tenantId);
    const lowStock = await XeroInventoryService.calculateLowStock(tenantId, items);

    // Apply searching
    let filtered = lowStock;
    if (search) {
      filtered = lowStock.filter(item => 
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
    return NextResponse.json({ error: err.message || 'Failed to fetch low stock items' }, { status: 500 });
  }
}

// POST allows setting/updating the minimum threshold for a specific item
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { itemId, minimumStock } = body;

    if (!itemId || minimumStock === undefined) {
      return NextResponse.json({ error: 'itemId and minimumStock are required' }, { status: 400 });
    }

    await db.saveThreshold(tenantId, itemId, parseFloat(minimumStock));
    
    // Clear inventory dashboard cache to trigger recalculation
    await db.saveInventoryCache(tenantId, 'InventoryDashboard_90', null, 0);

    return NextResponse.json({ success: true, message: 'Stock threshold updated successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save threshold' }, { status: 500 });
  }
}
