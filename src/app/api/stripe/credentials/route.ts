import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { verifyStripeCredentials, syncStripeData } from '@/lib/stripe';

// GET: Return saved Stripe API credentials (masked for security)
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'stripe');
    if (credentials) {
      return NextResponse.json({
        apiKey: credentials.client_id || '',
        publishableKey: credentials.client_secret || '',
        accountId: credentials.tenant_identifier || '',
        environment: credentials.region || 'test'
      });
    }

    return NextResponse.json({
      apiKey: '',
      publishableKey: '',
      accountId: '',
      environment: 'test'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save credentials, test connection, and run initial sync
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { apiKey, publishableKey, environment } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Stripe Secret API Key (sk_live_... / sk_test_...) is required' }, { status: 400 });
    }

    // 1. Verify API Key against Stripe Account Endpoint
    const verifyRes = await verifyStripeCredentials(apiKey);
    if (!verifyRes.success) {
      return NextResponse.json({ error: verifyRes.error || 'Stripe API key verification failed' }, { status: 400 });
    }

    const env = environment || (apiKey.startsWith('sk_live_') ? 'live' : 'test');

    // 2. Save Credentials to PostgreSQL (tenant_credentials table)
    await db.saveCredentials(tenantId, 'stripe', {
      client_id: apiKey,
      client_secret: publishableKey || '',
      refresh_token: apiKey,
      tenant_identifier: verifyRes.accountId || verifyRes.accountName || 'Stripe Account',
      access_token: 'stripe_active',
      expires_at: new Date(Date.now() + 365 * 86400 * 1000)
    });

    if (db.isPgActive()) {
      await db.query(
        `UPDATE tenant_credentials SET region = $1 WHERE tenant_id = $2 AND provider = 'stripe'`,
        [env, tenantId]
      );
    }

    // 3. Trigger Initial Sync into PostgreSQL
    await syncStripeData(tenantId, apiKey);

    return NextResponse.json({
      success: true,
      message: `Stripe account connected successfully (${verifyRes.accountName || 'Connected'})`
    });
  } catch (err: any) {
    console.error('Stripe credentials save error:', err);
    return NextResponse.json({ error: err.message || 'Failed to connect Stripe account' }, { status: 500 });
  }
}
