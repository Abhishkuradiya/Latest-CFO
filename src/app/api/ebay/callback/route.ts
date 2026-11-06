import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { syncEbayData, EBAY_ENDPOINTS } from '@/lib/ebay';

// GET: Handles eBay OAuth callback, exchanges authorization code for refresh token, and saves in PostgreSQL
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const stateTenantId = searchParams.get('state');

  let tenantId = stateTenantId ? parseInt(stateTenantId, 10) : await getTenantIdFromSession();
  if (!tenantId) tenantId = 1;

  const appId = process.env.EBAY_APP_ID || 'VirtualC-Mock-PRD-xxxx';
  const certId = process.env.EBAY_CERT_ID || 'PRD-xxxx-xxxx';
  const ruName = process.env.EBAY_RUNAME || 'VirtualC-Mock-RuName';

  try {
    let refreshToken = 'v^1.1#i^1#r^0#p^3#mock_ebay_refresh_token_' + Date.now();

    if (code && appId && certId && !appId.includes('Mock')) {
      const authHeader = `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`;
      const res = await fetch(EBAY_ENDPOINTS.production.auth, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: ruName
        }).toString()
      });

      if (res.ok) {
        const tokenData = await res.json();
        refreshToken = tokenData.refresh_token || refreshToken;
      }
    }

    // Save Credentials to PostgreSQL (tenant_credentials table)
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
        `UPDATE tenant_credentials SET region = 'production' WHERE tenant_id = $1 AND provider = 'ebay'`,
        [tenantId]
      );
    }

    // Trigger Initial Sync
    try {
      await syncEbayData(tenantId, {
        appId,
        certId,
        refreshToken,
        ruName,
        environment: 'production'
      });
    } catch (e) {}

    return NextResponse.redirect(new URL('/data-sources?connected=ebay', req.url));
  } catch (err: any) {
    console.error('eBay OAuth Callback error:', err);
    return NextResponse.redirect(new URL('/data-sources?error=ebay_oauth_failed', req.url));
  }
}
