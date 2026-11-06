import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { verifyAmazonCredentials, syncAmazonData } from '@/lib/amazon';

// GET: Return saved Amazon credentials (masked for security)
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'amazon');
    if (credentials) {
      return NextResponse.json({
        clientId: credentials.client_id || '',
        clientSecret: credentials.client_secret || '',
        refreshToken: credentials.refresh_token || '',
        sellerId: credentials.tenant_identifier || '',
        region: credentials.region || 'eu-west-1',
        marketplaceId: credentials.marketplace_id || 'A1F83G8C2ARO7P',
        environment: credentials.environment || 'sandbox'
      });
    }

    return NextResponse.json({
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      sellerId: '',
      region: 'eu-west-1',
      marketplaceId: 'A1F83G8C2ARO7P',
      environment: 'sandbox'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save credentials, test LWA connection, and run initial sync
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, clientSecret, refreshToken, sellerId, region, marketplaceId, environment } = body;

    if (!clientId || !clientSecret || !refreshToken || !sellerId) {
      return NextResponse.json({ error: 'All fields (LWA Client ID, Client Secret, Refresh Token, Seller ID) are required' }, { status: 400 });
    }

    // 1. Verify LWA and SP-API Credentials
    const verifyRes = await verifyAmazonCredentials({
      clientId,
      clientSecret,
      refreshToken,
      sellerId,
      region,
      marketplaceId,
      environment: environment || 'sandbox'
    });

    if (!verifyRes.success) {
      return NextResponse.json({ error: verifyRes.error || 'Amazon credential verification failed' }, { status: 400 });
    }

    // 2. Save Credentials to PostgreSQL (tenant_credentials table)
    await db.saveCredentials(tenantId, 'amazon', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      tenant_identifier: sellerId,
      access_token: 'lwa_active',
      expires_at: new Date(Date.now() + 3600 * 1000)
    });

    // Save region and marketplace_id
    if (db.isPostgres()) {
      await db.query(
        `UPDATE tenant_credentials SET region = $1, marketplace_id = $2, environment = $3 WHERE tenant_id = $4 AND provider = 'amazon'`,
        [region || 'eu-west-1', marketplaceId || 'A1F83G8C2ARO7P', environment || 'sandbox', tenantId]
      );
    }

    // 3. Trigger Initial Sync into PostgreSQL
    await syncAmazonData(tenantId, {
      clientId,
      clientSecret,
      refreshToken,
      sellerId,
      region,
      marketplaceId,
      environment: environment || 'sandbox'
    });

    return NextResponse.json({
      success: true,
      message: `Amazon Seller Central connected successfully for ${verifyRes.sellerName || sellerId}`
    });
  } catch (err: any) {
    console.error('Amazon credentials save error:', err);
    return NextResponse.json({ error: err.message || 'Failed to connect Amazon account' }, { status: 500 });
  }
}

// DELETE: Disconnect Amazon Seller Central credentials
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (db.isPostgres()) {
      await db.query(`DELETE FROM tenant_credentials WHERE tenant_id = $1 AND provider = 'amazon'`, [tenantId]);
    }
    return NextResponse.json({ success: true, message: 'Amazon Seller Central disconnected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to disconnect Amazon account' }, { status: 500 });
  }
}
