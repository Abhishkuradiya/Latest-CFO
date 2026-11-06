import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { syncEbayData } from '@/lib/ebay';

// POST: Trigger Manual Sync of eBay Orders & Transactions
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'ebay');
    if (!credentials || !credentials.client_id || !credentials.refresh_token) {
      return NextResponse.json({ error: 'eBay connector is not configured' }, { status: 400 });
    }

    const syncResult = await syncEbayData(tenantId, {
      appId: credentials.client_id,
      certId: credentials.client_secret,
      refreshToken: credentials.refresh_token,
      ruName: credentials.tenant_identifier || '',
      environment: (credentials.region as 'production' | 'sandbox') || 'production'
    });

    const totalSynced = syncResult.syncedOrders + syncResult.syncedTransactions;

    return NextResponse.json({
      success: true,
      message: `eBay sync completed. Synced ${syncResult.syncedOrders} orders and ${syncResult.syncedTransactions} financial transactions into PostgreSQL.`,
      ordersCount: syncResult.syncedOrders,
      transactionsCount: syncResult.syncedTransactions,
      totalCount: totalSynced
    });
  } catch (err: any) {
    console.error('eBay manual sync error:', err);
    return NextResponse.json({ error: err.message || 'eBay sync failed' }, { status: 500 });
  }
}
