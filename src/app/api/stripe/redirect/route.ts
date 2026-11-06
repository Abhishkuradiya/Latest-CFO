import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Initiates 1-Click Stripe Connect OAuth Authorization Redirect
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_mock_stripe_client_id';

  // Stripe Connect OAuth URL
  const oauthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=read_write&state=${encodeURIComponent(tenantId.toString())}`;

  return NextResponse.redirect(oauthUrl);
}
