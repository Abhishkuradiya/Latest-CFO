import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Check Amazon Connection Status & Record Counts
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'amazon');
    
    if (!credentials || !credentials.client_id || !credentials.refresh_token) {
      return NextResponse.json({
        connected: false,
        sellerName: 'Not connected',
        records: 0,
        lastSync: '─'
      });
    }

    const stats = await db.getAmazonStats(tenantId);
    
    const lastSyncDate = credentials.last_synced_at 
      ? new Date(credentials.last_synced_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return NextResponse.json({
      connected: true,
      sellerName: `Seller ID: ${credentials.tenant_identifier || 'Amazon Seller'}`,
      sellerId: credentials.tenant_identifier,
      records: stats.recordsCount,
      ordersCount: stats.ordersCount,
      settlementsCount: stats.settlementsCount,
      lastSync: lastSyncDate,
      region: credentials.region || 'eu-west-1'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, connected: false }, { status: 500 });
  }
}

// DELETE: Disconnect Amazon Connector & Clear Amazon Records
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.clearAmazonTokens(tenantId);
    return NextResponse.json({ success: true, message: 'Amazon Seller Central disconnected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
