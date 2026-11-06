import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Check eBay Connection Status & Record Counts
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'ebay');
    
    if (!credentials || !credentials.client_id || !credentials.refresh_token) {
      return NextResponse.json({
        connected: false,
        sellerName: 'Not connected',
        records: 0,
        lastSync: '─'
      });
    }

    const stats = await db.getEbayStats(tenantId);
    
    const lastSyncDate = credentials.last_synced_at 
      ? new Date(credentials.last_synced_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return NextResponse.json({
      connected: true,
      sellerName: credentials.tenant_identifier && credentials.tenant_identifier !== 'eBay Seller'
        ? `RuName: ${credentials.tenant_identifier}`
        : `App ID: ${credentials.client_id.slice(0, 8)}...`,
      records: stats.recordsCount,
      ordersCount: stats.ordersCount,
      transactionsCount: stats.transactionsCount,
      lastSync: lastSyncDate,
      environment: credentials.region || 'production'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, connected: false }, { status: 500 });
  }
}

// DELETE: Disconnect eBay Connector & Clear eBay Records
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.clearEbayTokens(tenantId);
    return NextResponse.json({ success: true, message: 'eBay Seller Central disconnected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
