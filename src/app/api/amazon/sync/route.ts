import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { syncAmazonData } from '@/lib/amazon';

// POST: Trigger Manual Live Amazon Data Sync
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'amazon');
    if (!credentials || (!credentials.client_id && !credentials.refresh_token)) {
      return NextResponse.json({ error: 'Amazon Seller Central is not connected for this tenant.' }, { status: 400 });
    }

    const syncResult = await syncAmazonData(tenantId, {
      clientId: credentials.client_id || '',
      clientSecret: credentials.client_secret || '',
      refreshToken: credentials.refresh_token || '',
      sellerId: credentials.tenant_identifier || '',
      region: credentials.region || 'eu-west-1',
      marketplaceId: credentials.marketplace_id || 'A1F83G8C2ARO7P',
      environment: (credentials as any)?.environment || 'sandbox'
    });

    // Save updated last_synced_at timestamp in credentials table
    await db.saveCredentials(tenantId, 'amazon', {
      last_synced_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Amazon sync completed successfully! Synced ${syncResult.ordersCount} orders and ${syncResult.settlementsCount} financial settlement event groups.`,
      ordersCount: syncResult.ordersCount,
      settlementsCount: syncResult.settlementsCount,
      lastSyncedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Amazon manual sync error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to sync Amazon data. Invalid credentials or API connection error.' },
      { status: 400 }
    );
  }
}
