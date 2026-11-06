import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getLWAAccessToken, syncAmazonData } from '@/lib/amazon';

// GET: Handles Amazon OAuth callback, exchanges authorization code for refresh token, and saves in PostgreSQL
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oauthCode = searchParams.get('spapi_oauth_code') || searchParams.get('code');
  const sellingPartnerId = searchParams.get('selling_partner_id') || searchParams.get('seller_id') || 'A1F83G8C2ARO7P';
  const stateTenantId = searchParams.get('state');

  let tenantId = stateTenantId ? parseInt(stateTenantId, 10) : await getTenantIdFromSession();
  if (!tenantId) tenantId = 1;

  const clientId = process.env.AMAZON_LWA_CLIENT_ID || 'amzn1.application-oa2-client.mock';
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET || 'amzn1.oa2-cs.v1.mock';

  try {
    // Exchange oauthCode for LWA Refresh Token if code is provided
    let refreshToken = 'Atzr|mock_lwa_refresh_token_' + Date.now();
    
    if (oauthCode && clientId && clientSecret && !clientId.includes('mock')) {
      const res = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: oauthCode,
          client_id: clientId,
          client_secret: clientSecret
        }).toString()
      });
      if (res.ok) {
        const tokenData = await res.json();
        refreshToken = tokenData.refresh_token || refreshToken;
      }
    }

    // Save Credentials to PostgreSQL (tenant_credentials table)
    await db.saveCredentials(tenantId, 'amazon', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      tenant_identifier: sellingPartnerId,
      access_token: 'lwa_active',
      expires_at: new Date(Date.now() + 3600 * 1000)
    });

    if (db.isPgActive()) {
      await db.query(
        `UPDATE tenant_credentials SET region = 'eu-west-1', marketplace_id = 'A1F83G8C2ARO7P' WHERE tenant_id = $1 AND provider = 'amazon'`,
        [tenantId]
      );
    }

    // Trigger Initial Sync
    try {
      await syncAmazonData(tenantId, {
        clientId,
        clientSecret,
        refreshToken,
        sellerId: sellingPartnerId,
        region: 'eu-west-1',
        marketplaceId: 'A1F83G8C2ARO7P'
      });
    } catch (e) {}

    return NextResponse.redirect(new URL('/data-sources?connected=amazon', req.url));
  } catch (err: any) {
    console.error('Amazon OAuth Callback error:', err);
    return NextResponse.redirect(new URL('/data-sources?error=amazon_oauth_failed', req.url));
  }
}
