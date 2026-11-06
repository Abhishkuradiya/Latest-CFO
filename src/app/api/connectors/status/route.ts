import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check Xero Credentials directly from DB
    const xeroCreds = await db.getCredentials(tenantId, 'xero').catch(() => null);
    const xeroConnected = Boolean(xeroCreds && xeroCreds.access_token && xeroCreds.tenant_identifier);

    // Check Amazon Credentials directly from DB
    const amazonCreds = await db.getCredentials(tenantId, 'amazon').catch(() => null);
    const amazonConnected = Boolean(amazonCreds && amazonCreds.client_id && amazonCreds.refresh_token);

    // Check eBay Credentials directly from DB
    const ebayCreds = await db.getCredentials(tenantId, 'ebay').catch(() => null);
    const ebayConnected = Boolean(ebayCreds && ebayCreds.client_id && ebayCreds.refresh_token);

    // Check Stripe Credentials directly from DB
    const stripeCreds = await db.getCredentials(tenantId, 'stripe').catch(() => null);
    const stripeConnected = Boolean(stripeCreds && (stripeCreds.client_id || stripeCreds.apiKey));

    return NextResponse.json({
      xero: xeroConnected,
      amazon: amazonConnected,
      ebay: ebayConnected,
      shopify: false,
      woocommerce: false,
      etsy: false,
      stripe: stripeConnected,
      paypal: false,
      square: false,
      razorpay: false
    });
  } catch (err: any) {
    console.error('Connector status check error:', err);
    return NextResponse.json({
      xero: false,
      amazon: false,
      ebay: false,
      shopify: false,
      woocommerce: false,
      etsy: false,
      stripe: false,
      paypal: false,
      square: false,
      razorpay: false
    });
  }
}
