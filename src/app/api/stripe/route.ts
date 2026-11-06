import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Check Stripe Connection Status & Record Counts
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'stripe');
    
    if (!credentials || !credentials.client_id) {
      return NextResponse.json({
        connected: false,
        accountName: 'Not connected',
        records: 0,
        lastSync: '─'
      });
    }

    const stats = await db.getStripeStats(tenantId);
    
    const lastSyncDate = credentials.last_synced_at 
      ? new Date(credentials.last_synced_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return NextResponse.json({
      connected: true,
      accountName: credentials.tenant_identifier || 'Stripe Account Connected',
      records: stats.recordsCount,
      chargesCount: stats.chargesCount,
      customersCount: stats.customersCount,
      invoicesCount: stats.invoicesCount,
      payoutsCount: stats.payoutsCount,
      lastSync: lastSyncDate,
      environment: credentials.region || 'test'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, connected: false }, { status: 500 });
  }
}

// DELETE: Disconnect Stripe Connector & Clear Stripe Records
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.clearStripeTokens(tenantId);
    return NextResponse.json({ success: true, message: 'Stripe Payments disconnected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
