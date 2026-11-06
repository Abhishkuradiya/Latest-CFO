import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Initiates 1-Click eBay OAuth Authorization Redirect
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const appId = process.env.EBAY_APP_ID || 'VirtualC-Mock-PRD-xxxx';
  const ruName = process.env.EBAY_RUNAME || 'VirtualC-Mock-RuName';
  const env = req.nextUrl.searchParams.get('environment') || 'production';

  const authHost = env === 'sandbox' ? 'auth.sandbox.ebay.com' : 'auth.ebay.com';
  const scope = encodeURIComponent('https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly https://api.ebay.com/oauth/api_scope/sell.finances.readonly');

  const oauthUrl = `https://${authHost}/oauth2/authorize?client_id=${encodeURIComponent(appId)}&response_type=code&redirect_uri=${encodeURIComponent(ruName)}&scope=${scope}&state=${encodeURIComponent(tenantId.toString())}`;

  return NextResponse.redirect(oauthUrl);
}
