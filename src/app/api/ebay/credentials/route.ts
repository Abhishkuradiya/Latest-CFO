import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { verifyEbayCredentials, syncEbayData } from '@/lib/ebay';

// GET: Return saved eBay credentials
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'ebay');
    if (credentials) {
      return NextResponse.json({
        appId: credentials.client_id || '',
        certId: credentials.client_secret || '',
        refreshToken: credentials.refresh_token || '',
        ruName: credentials.tenant_identifier || '',
        environment: credentials.region || 'production'
      });
    }

    return NextResponse.json({
      appId: '',
      certId: '',
      refreshToken: '',
      ruName: '',
      environment: 'production'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save credentials, test OAuth connection, and run initial sync
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { appId, certId, refreshToken, ruName, environment } = body;

    if (!appId || !certId || !refreshToken) {
      return NextResponse.json({ error: 'All fields (App ID, Cert ID, and Refresh Token) are required' }, { status: 400 });
    }

    const env = environment || 'production';

    // 1. Verify eBay Credentials via OAuth
    const verifyRes = await verifyEbayCredentials({
      appId,
      certId,
      refreshToken,
      ruName: ruName || '',
      environment: env
    });

    if (!verifyRes.success) {
      return NextResponse.json({ error: verifyRes.error || 'eBay credential verification failed' }, { status: 400 });
    }

    // 2. Save Credentials to PostgreSQL (tenant_credentials table)
    await db.saveCredentials(tenantId, 'ebay', {
      client_id: appId,
      client_secret: certId,
      refresh_token: refreshToken,
      tenant_identifier: ruName || 'eBay Seller',
      access_token: 'ebay_oauth_active',
      expires_at: new Date(Date.now() + 7200 * 1000)
    });

    if (db.isPgActive()) {
      await db.query(
        `UPDATE tenant_credentials SET region = $1 WHERE tenant_id = $2 AND provider = 'ebay'`,
        [env, tenantId]
      );
    }

    // 3. Trigger Initial Sync into PostgreSQL
    await syncEbayData(tenantId, {
      appId,
      certId,
      refreshToken,
      ruName: ruName || '',
      environment: env
    });

    return NextResponse.json({
      success: true,
      message: `eBay account connected successfully (${verifyRes.sellerName || 'Connected'})`
    });
  } catch (err: any) {
    console.error('eBay credentials save error:', err);
    return NextResponse.json({ error: err.message || 'Failed to connect eBay account' }, { status: 500 });
  }
}
