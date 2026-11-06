import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const currentTenantId = await getTenantIdFromSession();
  if (currentTenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let isPg = db.isPgActive();

  try {
    let tenants: any[] = [];
    let users: any[] = [];
    let credentials: any[] = [];
    let pgStats: Record<string, number> = {};
    let jsonStats: Record<string, number> = {};

    // Get PG Data if active
    if (isPg) {
      try {
        const tenantRes = await db.query('SELECT * FROM tenants ORDER BY id ASC');
        tenants = tenantRes.rows;

        const userRes = await db.query('SELECT id, email, tenant_id, created_at FROM users ORDER BY id ASC');
        users = userRes.rows;

        const credRes = await db.query('SELECT tenant_id, provider, client_id, expires_at, scopes FROM tenant_credentials');
        credentials = credRes.rows;

        // Table counts in PG
        const tables = ['tenants', 'users', 'sessions', 'tenant_credentials', 'contacts', 'invoices', 'payments', 'accounts', 'reports', 'fixed_assets', 'tax_transactions'];
        for (const t of tables) {
          try {
            const countRes = await db.query(`SELECT COUNT(*) as count FROM ${t}`);
            pgStats[t] = parseInt(countRes.rows[0].count || '0');
          } catch (e) {
            pgStats[t] = -1;
          }
        }
      } catch (e: any) {
        console.warn('PostgreSQL query error in db-management, falling back to JSON DB:', e.message);
        isPg = false;
      }
    }

    // Get JSON stats
    const json = db.readJsonDb();
    jsonStats['tenants'] = (json.tenants || []).length;
    jsonStats['users'] = (json.users || []).length;
    jsonStats['tenant_credentials'] = (json.tenant_credentials || []).length;
    jsonStats['contacts'] = (json.contacts || []).length;
    jsonStats['invoices'] = (json.invoices || []).length;
    jsonStats['payments'] = (json.payments || []).length;
    jsonStats['accounts'] = (json.accounts || []).length;
    jsonStats['reports'] = (json.reports || []).length;
    jsonStats['fixed_assets'] = (json.fixed_assets || []).length;
    jsonStats['tax_transactions'] = (json.tax_transactions || []).length;

    // JSON tenants lists fallback if PG is down
    if (!isPg) {
      tenants = json.tenants || [];
      users = (json.users || []).map((u: any) => ({ id: u.id, email: u.email, tenant_id: u.tenant_id, created_at: u.created_at }));
      credentials = json.tenant_credentials || [];
    }

    return NextResponse.json({
      postgresConnected: isPg,
      tenants,
      users,
      credentials,
      pgStats,
      jsonStats,
      currentTenantId
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const currentTenantId = await getTenantIdFromSession();
  if (currentTenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isPg = db.isPgActive();
  const body = await req.json();
  const { action, tenantId, userId } = body;

  try {
    if (action === 'deleteTenant') {
      if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
      if (tenantId === currentTenantId) {
        return NextResponse.json({ error: 'Cannot delete the tenant you are currently logged in to!' }, { status: 400 });
      }

      if (isPg) {
        await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      }
      
      const json = db.readJsonDb();
      json.tenants = (json.tenants || []).filter((x: any) => x.id !== tenantId);
      json.users = (json.users || []).filter((x: any) => x.tenant_id !== tenantId);
      json.tenant_credentials = (json.tenant_credentials || []).filter((x: any) => x.tenant_id !== tenantId);
      json.contacts = (json.contacts || []).filter((x: any) => x.tenant_id !== tenantId);
      json.invoices = (json.invoices || []).filter((x: any) => x.tenant_id !== tenantId);
      json.payments = (json.payments || []).filter((x: any) => x.tenant_id !== tenantId);
      json.accounts = (json.accounts || []).filter((x: any) => x.tenant_id !== tenantId);
      json.reports = (json.reports || []).filter((x: any) => x.tenant_id !== tenantId);
      json.fixed_assets = (json.fixed_assets || []).filter((x: any) => x.tenant_id !== tenantId);
      json.tax_transactions = (json.tax_transactions || []).filter((x: any) => x.tenant_id !== tenantId);
      db.writeJsonDb(json);

      return NextResponse.json({ success: true, message: `Tenant ${tenantId} deleted successfully.` });
    }

    if (action === 'deleteUser') {
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

      if (isPg) {
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
      }

      const json = db.readJsonDb();
      json.users = (json.users || []).filter((x: any) => x.id !== userId);
      db.writeJsonDb(json);

      return NextResponse.json({ success: true, message: `User ${userId} deleted successfully.` });
    }

    if (action === 'deleteCredentials') {
      if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

      if (isPg) {
        await db.query('DELETE FROM tenant_credentials WHERE tenant_id = $1', [tenantId]);
      }

      const json = db.readJsonDb();
      json.tenant_credentials = (json.tenant_credentials || []).filter((x: any) => x.tenant_id !== tenantId);
      db.writeJsonDb(json);

      return NextResponse.json({ success: true, message: `Xero Credentials for Tenant ${tenantId} cleared.` });
    }

    if (action === 'clearPgCache') {
      if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });

      await db.clearCachedRecords(tenantId);
      await db.clearTaxTransactions(tenantId);
      return NextResponse.json({ success: true, message: `Cache cleared for Tenant ${tenantId}.` });
    }

    if (action === 'hydratePgFromJson') {
      if (!tenantId) return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
      if (!isPg) {
        return NextResponse.json({ error: 'PostgreSQL is not connected. Fallback JSON DB mode is already active.' }, { status: 400 });
      }

      // Clear existing PG cache for this tenant first
      await db.clearCachedRecords(tenantId);
      await db.clearTaxTransactions(tenantId);

      const json = db.readJsonDb();

      // Hydrate Contacts
      const tenantContacts = (json.contacts || []).filter((x: any) => x.tenant_id === tenantId);
      for (const c of tenantContacts) {
        await db.query(
          'INSERT INTO contacts (tenant_id, external_id, name, email) VALUES ($1, $2, $3, $4)',
          [tenantId, c.external_id || c.ContactID, c.name || c.Name, c.email || c.EmailAddress]
        );
      }

      // Hydrate Invoices
      const tenantInvoices = (json.invoices || []).filter((x: any) => x.tenant_id === tenantId);
      for (const inv of tenantInvoices) {
        await db.query(
          `INSERT INTO invoices (tenant_id, external_id, invoice_number, type, status, total, amount_due, amount_paid, invoice_date, due_date, contact_name, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tenantId,
            inv.external_id || inv.InvoiceID,
            inv.invoice_number || inv.InvoiceNumber,
            inv.type || inv.Type,
            inv.status || inv.Status,
            inv.total || inv.Total || 0,
            inv.amount_due || inv.AmountDue || 0,
            inv.amount_paid || inv.AmountPaid || 0,
            inv.invoice_date || inv.Date,
            inv.due_date || inv.DueDate,
            inv.contact_name || inv.ContactName || (inv.Contact && inv.Contact.Name) || '',
            inv.currency || inv.CurrencyCode || 'GBP'
          ]
        );
      }

      // Hydrate Payments
      const tenantPayments = (json.payments || []).filter((x: any) => x.tenant_id === tenantId);
      for (const p of tenantPayments) {
        await db.query(
          'INSERT INTO payments (tenant_id, external_id, amount, payment_type, status, payment_date) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            tenantId,
            p.external_id || p.PaymentID,
            p.amount || p.Amount || 0,
            p.payment_type || p.PaymentType,
            p.status || p.Status,
            p.payment_date || p.Date
          ]
        );
      }

      // Hydrate Accounts
      const tenantAccounts = (json.accounts || []).filter((x: any) => x.tenant_id === tenantId);
      for (const acc of tenantAccounts) {
        await db.query(
          'INSERT INTO accounts (tenant_id, external_id, name, code, type, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            tenantId,
            acc.external_id || acc.AccountID,
            acc.name || acc.Name,
            acc.code || acc.Code,
            acc.type || acc.Type,
            acc.status || acc.Status || 'ACTIVE'
          ]
        );
      }

      // Hydrate Reports
      const tenantReports = (json.reports || []).filter((x: any) => x.tenant_id === tenantId);
      for (const r of tenantReports) {
        await db.query(
          `INSERT INTO reports (tenant_id, report_type, raw_data)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, report_type)
           DO UPDATE SET raw_data = $3`,
          [tenantId, r.report_type, JSON.stringify(r.raw_data)]
        );
      }

      // Hydrate Credentials
      const tenantCreds = (json.tenant_credentials || []).filter((x: any) => x.tenant_id === tenantId);
      for (const cred of tenantCreds) {
        await db.query(
          `INSERT INTO tenant_credentials (tenant_id, provider, tenant_identifier, access_token, refresh_token, expires_at, scopes, client_id, client_secret)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (tenant_id, provider)
           DO UPDATE SET tenant_identifier = $3, access_token = $4, refresh_token = $5, expires_at = $6, scopes = $7, client_id = $8, client_secret = $9`,
          [
            tenantId,
            cred.provider,
            cred.tenant_identifier,
            cred.access_token,
            cred.refresh_token,
            cred.expires_at,
            cred.scopes,
            cred.client_id,
            cred.client_secret
          ]
        );
      }

      // Hydrate Tax transactions
      const tenantTax = (json.tax_transactions || []).filter((x: any) => x.tenant_id === tenantId);
      for (const tx of tenantTax) {
        await db.query(
          `INSERT INTO tax_transactions (tenant_id, external_id, date, type, description, tax_rate_name, tax_rate, net_amount, tax_amount, gross_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            tenantId,
            tx.external_id,
            tx.date,
            tx.type,
            tx.description,
            tx.tax_rate_name,
            tx.tax_rate,
            tx.net_amount,
            tx.tax_amount,
            tx.gross_amount,
            tx.status
          ]
        );
      }

      return NextResponse.json({ success: true, message: `Successfully hydrated PostgreSQL from JSON database cache for Tenant ${tenantId}!` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
