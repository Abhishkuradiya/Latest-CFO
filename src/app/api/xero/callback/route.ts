import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fetchXeroResource } from '@/lib/xero';
import { AccountMappingService } from '@/lib/services/AccountMappingService';
 
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!state) {
    return new Response('Error: Missing state parameter in OAuth callback.', { status: 400 });
  }
  const tenantId = parseInt(state, 10);
  if (isNaN(tenantId)) {
    return new Response('Error: Invalid tenant ID state in OAuth callback.', { status: 400 });
  }
 
  const errorParam = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  if (errorParam) {
    console.warn(`[Xero OAuth Callback] Authorization denied or error returned for tenant ${tenantId}: ${errorParam} (${errorDesc || ''})`);
    return new Response(`Xero Authorization Denied: ${errorDesc || errorParam}. Existing connection preserved.`, { status: 400 });
  }

  if (!code) {
    return new Response('Error: Missing authorization code from Xero server.', { status: 400 });
  }
 
  try {
    const credentials = await db.getCredentials(tenantId, 'xero');
    const clientId = credentials?.client_id || process.env.XERO_CLIENT_ID || 'C930279BD01B4AB6AAEC93E6C24ABE73';
    const clientSecret = credentials?.client_secret || process.env.XERO_CLIENT_SECRET || 'Fahq-95hnCZB0h4z3nbeFQ0p_86Kfm27m_h5UEZHg-hGohNZ';

    if (!clientId || !clientSecret) {
      return new Response('Error: Client credentials not found for this tenant.', { status: 400 });
    }

    // 1. Exchange authorization code for access token
    const tokenUrl = 'https://identity.xero.com/connect/token';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
    const proto = req.headers.get('x-forwarded-proto') || (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'http');
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/xero/callback`;
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
 
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });
 
    if (!tokenRes.ok) {
      const errorMsg = await tokenRes.text();
      throw new Error(`Token exchange failed: ${errorMsg}`);
    }
 
    const tokenData = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
 
    // 2. Fetch connected organization connections from Xero
    const connectionsRes = await fetch('https://api.xero.com/connections', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });
 
    if (!connectionsRes.ok) {
      throw new Error('Failed to retrieve connected Xero organizations.');
    }
 
    const connections = await connectionsRes.json();
    
    // Find organization connection
    const orgConnection = connections.find((conn: any) => conn.tenantType === 'ORGANISATION');
    if (!orgConnection) {
      throw new Error('No active Xero organization connection found.');
    }
 
    const xeroTenantId = orgConnection.tenantId; // Connection UUID
    const orgName = orgConnection.tenantName || 'Xero Organisation';
 
    // 3. Save connection details in the database
    await db.saveCredentials(tenantId, 'xero', {
      tenant_identifier: xeroTenantId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      scopes: tokenData.scope.split(' ')
    });
 
    // 4. Update the local tenant company name to match the authorized Xero organization name!
    await db.updateTenantName(tenantId, orgName);

    // Trigger dynamic non-blocking background sync of cash flow and main resources
    (async () => {
      try {
        console.log(`[BackgroundSync] Starting initial sync for tenant ${tenantId}...`);
        
        // Contacts
        try {
          const contacts = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Contacts');
          await db.saveCachedRecords(tenantId, 'contacts', contacts || []);
          await db.saveReport(tenantId, 'Contacts', contacts || []);
        } catch (e: any) {
          console.error('[BackgroundSync] Contacts sync failed:', e.message);
        }

        // Invoices
        try {
          const invoices = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Invoices');
          await db.saveCachedRecords(tenantId, 'invoices', invoices || []);
        } catch (e: any) {
          console.error('[BackgroundSync] Invoices sync failed:', e.message);
        }

        // Payments
        try {
          const payments = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Payments');
          await db.saveCachedRecords(tenantId, 'payments', payments || []);
        } catch (e: any) {
          console.error('[BackgroundSync] Payments sync failed:', e.message);
        }

        // Accounts & Tenant Account Mappings Seeding (Phase 2 Integration)
        try {
          const accounts = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Accounts');
          await db.saveCachedRecords(tenantId, 'accounts', accounts || []);
          if (Array.isArray(accounts) && accounts.length > 0) {
            await AccountMappingService.seedMappingsForTenant(tenantId, accounts);
          }
        } catch (e: any) {
          console.error('[BackgroundSync] Accounts sync failed:', e.message);
        }

        // BankTransactions
        try {
          const bankTxns = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'BankTransactions');
          await db.saveReport(tenantId, 'BankTransactions', bankTxns || []);
        } catch (e: any) {
          console.error('[BackgroundSync] BankTransactions sync failed:', e.message);
        }

        // Prepayments
        try {
          const prepayments = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Prepayments');
          await db.saveReport(tenantId, 'Prepayments', prepayments || []);
        } catch (e: any) {
          console.error('[BackgroundSync] Prepayments sync failed:', e.message);
        }

        // Overpayments
        try {
          const overpayments = await fetchXeroResource(tokenData.access_token, xeroTenantId, 'Overpayments');
          await db.saveReport(tenantId, 'Overpayments', overpayments || []);
        } catch (e: any) {
          console.error('[BackgroundSync] Overpayments sync failed:', e.message);
        }

        // Save last sync time in credentials database
        await db.saveCredentials(tenantId, 'xero', {
          last_synced_at: new Date().toISOString()
        });

        console.log(`[BackgroundSync] Initial sync completed for tenant ${tenantId}!`);
      } catch (err: any) {
        console.error('[BackgroundSync] Failed during background initial sync:', err.message);
      }
    })();

    // 5. Render a premium HTML success page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xero Connected Successfully</title>
        <style>
          body {
            font-family: 'Plus Jakarta Sans', Arial, sans-serif;
            background-color: #f4f7f9;
            color: #334155;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
          }
          .logo {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 60px;
            height: 60px;
            background-color: #00b7e2;
            color: #ffffff;
            border-radius: 50%;
            font-size: 20px;
            font-weight: 300;
            margin-bottom: 24px;
            user-select: none;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin: 0 0 8px 0;
          }
          p {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
            margin: 0 0 24px 0;
          }
          .badge {
            background-color: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 9999px;
            display: inline-block;
            margin-bottom: 24px;
          }
          .button {
            background-color: #1e293b;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            padding: 10px 24px;
            border-radius: 8px;
            text-decoration: none;
            cursor: pointer;
            border: none;
            outline: none;
            display: inline-block;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #0f172a;
          }
          .timer {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 16px;
          }
        </style>
        <script>
          let seconds = 5;
          function countdown() {
            seconds--;
            if (seconds <= 0) {
              window.close();
            } else {
              document.getElementById("timer").innerHTML = "This window will close in " + seconds + " seconds...";
              setTimeout(countdown, 1000);
            }
          }
          window.onload = function() {
            setTimeout(countdown, 1000);
          };
        </script>
      </head>
      <body>
        <div class="card">
          <div class="logo">xero</div>
          <h1>Connection Authorized!</h1>
          <p>Your tenant company <strong>${orgName}</strong> is now securely connected to the Virtual CFO Platform.</p>
          <div class="badge">Success Callback Processed</div>
          <div>
            <button class="button" onclick="window.close()">Close Window</button>
          </div>
          <div class="timer" id="timer">This window will close in 5 seconds...</div>
        </div>
      </body>
      </html>
    `;
 
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err: any) {
    return new Response(`Authentication Callback failed: ${err.message}`, { status: 500 });
  }
}
