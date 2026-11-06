import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// Standard working Xero OAuth scopes (24 scopes)
export const STANDARD_XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.contacts.read',
  'accounting.invoices.read',
  'accounting.payments.read',
  'accounting.settings.read',
  'accounting.reports.profitandloss.read',
  'accounting.banktransactions.read',
  'accounting.attachments',
  'accounting.budgets.read',
  'accounting.manualjournals.read',
  'accounting.reports.balancesheet.read',
  'accounting.reports.trialbalance.read',
  'accounting.reports.aged.read',
  'accounting.reports.banksummary.read',
  'accounting.reports.tenninetynine.read',
  'accounting.reports.taxreports.read',
  'accounting.reports.budgetsummary.read',
  'accounting.reports.executivesummary.read',
  'accounting.invoices',
  'accounting.payments',
  'assets'
].join(' ');

// Optional restricted scopes requiring explicit Xero Developer Portal enablement per app client_id
export const OPTIONAL_RESTRICTED_SCOPES = [
  'accounting.journals.read'
].join(' ');

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return new Response(
      'Error: Unauthorized. Please log in first.',
      { status: 401 }
    );
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'xero');
    const clientId = credentials?.client_id || process.env.XERO_CLIENT_ID || 'C930279BD01B4AB6AAEC93E6C24ABE73';
    
    if (!clientId) {
      return new Response(
        'Error: No client credentials found for this tenant company. Please save Client ID and Client Secret in Data Sources first.',
        { status: 400 }
      );
    }

    // Construct Redirect URL
    const authorizeUrl = 'https://login.xero.com/identity/connect/authorize';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
    const proto = req.headers.get('x-forwarded-proto') || (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'http');
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/xero/callback`;

    // Default to STANDARD_XERO_SCOPES for seamless user authorization
    const includeRestricted = req.nextUrl.searchParams.get('include_restricted') === 'true';
    const scopes = includeRestricted 
      ? `${STANDARD_XERO_SCOPES} ${OPTIONAL_RESTRICTED_SCOPES}`
      : STANDARD_XERO_SCOPES;

    console.log('--- XERO OAUTH REDIRECT ---');
    console.log('Redirect URI:', redirectUri);
    console.log('Include Restricted:', includeRestricted);
    console.log('Scopes:', scopes);
    console.log('---------------------------');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: String(tenantId)
    });

    return NextResponse.redirect(`${authorizeUrl}?${params.toString()}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown OAuth redirect error';
    return new Response(`Redirection failed: ${message}`, { status: 500 });
  }
}
