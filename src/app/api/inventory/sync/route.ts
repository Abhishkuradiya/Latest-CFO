import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokenInfo = await getXeroAccessToken(tenantId);
  if (!tokenInfo) {
    return NextResponse.json({ error: 'Xero integration not connected' }, { status: 400 });
  }

  const { accessToken, xeroTenantId } = tokenInfo;

  try {
    // 1. Sync Items
    const items = await fetchXeroResource(accessToken, xeroTenantId, 'Items');
    await db.saveInventoryItems(tenantId, items || []);

    // 2. Sync Invoice Line Items for sales history (pages 1 and 2)
    const invoicesWithLinesPage1 = await fetchXeroResource(accessToken, xeroTenantId, 'Invoices', 'page=1');
    const invoicesWithLinesPage2 = await fetchXeroResource(accessToken, xeroTenantId, 'Invoices', 'page=2').catch(() => []);
    const allInvoicesWithLines = [...(invoicesWithLinesPage1 || []), ...(invoicesWithLinesPage2 || [])];

    const sales: any[] = [];
    const parseXeroDate = (dateStr: string) => {
      const match = dateStr.match(/\/Date\((\d+)/);
      return match ? new Date(parseInt(match[1])) : new Date(dateStr);
    };

    for (const inv of allInvoicesWithLines) {
      if (inv.Status === 'PAID' || inv.Status === 'AUTHORISED') {
        const soldAt = inv.Date ? parseXeroDate(inv.Date) : null;
        if (Array.isArray(inv.LineItems)) {
          for (const line of inv.LineItems) {
            const itemId = line.Item?.ItemID || line.ItemID;
            if (itemId) {
              sales.push({
                item_id: itemId,
                invoice_id: inv.InvoiceID,
                quantity_sold: parseFloat(line.Quantity) || 0,
                sold_at: soldAt ? soldAt.toISOString() : null
              });
            }
          }
        }
      }
    }
    await db.saveSalesHistory(tenantId, sales);

    // 3. Clear dashboard cache to force refresh
    await db.saveInventoryCache(tenantId, 'InventoryDashboard_90', null, 0);

    return NextResponse.json({ success: true, message: 'Xero inventory sync completed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Inventory sync failed' }, { status: 500 });
  }
}
