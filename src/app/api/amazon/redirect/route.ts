import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Initiates 1-Click Amazon SP-API OAuth Authorization Redirect
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const appId = process.env.AMAZON_APP_ID || 'amzn1.sp.solution.virtualcfo-mock';
  const region = req.nextUrl.searchParams.get('region') || 'eu-west-1';

  // Amazon SP-API Seller Central OAuth Redirect URL
  const sellerCentralHost = region.startsWith('us') 
    ? 'sellercentral.amazon.com'
    : (region.startsWith('fe') || region === 'us-west-2' ? 'sellercentral-japan.amazon.com' : 'sellercentral-europe.amazon.com');

  const oauthUrl = `https://${sellerCentralHost}/apps/authorize/consent?application_id=${encodeURIComponent(appId)}&state=${encodeURIComponent(tenantId.toString())}&version=beta`;

  return NextResponse.redirect(oauthUrl);
}
