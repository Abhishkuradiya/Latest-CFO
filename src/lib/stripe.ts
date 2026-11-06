import { db } from '@/lib/db';

export interface StripeConfig {
  apiKey: string;
  publishableKey?: string;
  environment?: 'live' | 'test';
}

/**
 * Validates Stripe Secret API Key by fetching account info from Stripe API
 */
export async function verifyStripeCredentials(apiKey: string): Promise<{ success: boolean; accountName?: string; accountId?: string; error?: string }> {
  if (!apiKey) {
    return { success: false, error: 'Stripe API key is required' };
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Invalid Stripe API Key: ${res.statusText}` };
    }

    const data = await res.json();
    return {
      success: true,
      accountId: data.id || 'acct_stripe',
      accountName: data.settings?.dashboard?.display_name || data.email || data.id || 'Stripe Account'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to authenticate with Stripe' };
  }
}

/**
 * Synchronizes Stripe Charges, Customers, Invoices, and Payouts into PostgreSQL
 */
export async function syncStripeData(tenantId: number, apiKey: string): Promise<{ syncedCharges: number; syncedCustomers: number; syncedInvoices: number; syncedPayouts: number }> {
  let syncedCharges = 0;
  let syncedCustomers = 0;
  let syncedInvoices = 0;
  let syncedPayouts = 0;

  const authHeader = { 'Authorization': `Bearer ${apiKey}` };

  // 1. Sync Charges
  try {
    const res = await fetch('https://api.stripe.com/v1/charges?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const ch of data.data || []) {
        const chargeId = ch.id;
        const amount = (ch.amount || 0) / 100;
        const amountRefunded = (ch.amount_refunded || 0) / 100;
        const currency = (ch.currency || 'usd').toUpperCase();
        const status = ch.status || 'succeeded';
        const customerId = ch.customer || null;
        const description = ch.description || ch.calculated_statement_descriptor || 'Stripe Charge';
        const paymentMethod = ch.payment_method_details?.type || 'card';
        const createdAt = ch.created ? new Date(ch.created * 1000) : new Date();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_charges
             (tenant_id, charge_id, amount, amount_refunded, currency, status, customer_id, description, payment_method, charge_created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (tenant_id, charge_id) DO UPDATE SET
               amount = EXCLUDED.amount,
               amount_refunded = EXCLUDED.amount_refunded,
               status = EXCLUDED.status;`,
            [tenantId, chargeId, amount, amountRefunded, currency, status, customerId, description, paymentMethod, createdAt]
          );
        }
        syncedCharges++;
      }
    }
  } catch (err) {
    console.error('Stripe charges fetch error:', err);
  }

  // 2. Sync Customers
  try {
    const res = await fetch('https://api.stripe.com/v1/customers?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const cu of data.data || []) {
        const customerId = cu.id;
        const email = cu.email || null;
        const name = cu.name || cu.description || 'Stripe Customer';
        const phone = cu.phone || null;
        const currency = (cu.currency || 'usd').toUpperCase();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_customers
             (tenant_id, customer_id, email, name, phone, currency)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, customer_id) DO NOTHING;`,
            [tenantId, customerId, email, name, phone, currency]
          );
        }
        syncedCustomers++;
      }
    }
  } catch (err) {
    console.error('Stripe customers fetch error:', err);
  }

  // 3. Sync Invoices
  try {
    const res = await fetch('https://api.stripe.com/v1/invoices?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const inv of data.data || []) {
        const invoiceId = inv.id;
        const invoiceNumber = inv.number || inv.id;
        const customerId = inv.customer || null;
        const amountDue = (inv.amount_due || 0) / 100;
        const amountPaid = (inv.amount_paid || 0) / 100;
        const status = inv.status || 'paid';
        const currency = (inv.currency || 'usd').toUpperCase();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_invoices
             (tenant_id, invoice_id, invoice_number, customer_id, amount_due, amount_paid, status, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (tenant_id, invoice_id) DO UPDATE SET
               amount_due = EXCLUDED.amount_due,
               amount_paid = EXCLUDED.amount_paid,
               status = EXCLUDED.status;`,
            [tenantId, invoiceId, invoiceNumber, customerId, amountDue, amountPaid, status, currency]
          );
        }
        syncedInvoices++;
      }
    }
  } catch (err) {
    console.error('Stripe invoices fetch error:', err);
  }

  // 4. Sync Payouts
  try {
    const res = await fetch('https://api.stripe.com/v1/payouts?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const po of data.data || []) {
        const payoutId = po.id;
        const amount = (po.amount || 0) / 100;
        const currency = (po.currency || 'usd').toUpperCase();
        const status = po.status || 'paid';
        const arrivalDate = po.arrival_date ? new Date(po.arrival_date * 1000) : new Date();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_payouts
             (tenant_id, payout_id, amount, currency, status, arrival_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, payout_id) DO UPDATE SET
               status = EXCLUDED.status;`,
            [tenantId, payoutId, amount, currency, status, arrivalDate]
          );
        }
        syncedPayouts++;
      }
    }
  } catch (err) {
    console.error('Stripe payouts fetch error:', err);
  }

  // 5. Sync Subscriptions
  try {
    const res = await fetch('https://api.stripe.com/v1/subscriptions?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const sub of data.data || []) {
        const subId = sub.id;
        const customerId = sub.customer || null;
        const planName = sub.items?.data?.[0]?.price?.nickname || sub.items?.data?.[0]?.plan?.nickname || 'Standard Subscription';
        const mrrAmount = ((sub.items?.data?.[0]?.price?.unit_amount || sub.items?.data?.[0]?.plan?.amount || 0) / 100);
        const currency = (sub.currency || 'usd').toUpperCase();
        const status = sub.status || 'active';
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_subscriptions
             (tenant_id, subscription_id, customer_id, plan_name, mrr_amount, currency, status, current_period_end)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (tenant_id, subscription_id) DO UPDATE SET
               plan_name = EXCLUDED.plan_name,
               mrr_amount = EXCLUDED.mrr_amount,
               status = EXCLUDED.status;`,
            [tenantId, subId, customerId, planName, mrrAmount, currency, status, currentPeriodEnd]
          );
        }
      }
    }
  } catch (err) {
    console.error('Stripe subscriptions fetch error:', err);
  }

  // 6. Sync Disputes
  try {
    const res = await fetch('https://api.stripe.com/v1/disputes?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const disp of data.data || []) {
        const disputeId = disp.id;
        const chargeId = disp.charge || null;
        const amount = (disp.amount || 0) / 100;
        const currency = (disp.currency || 'usd').toUpperCase();
        const status = disp.status || 'under_review';
        const createdAt = disp.created ? new Date(disp.created * 1000) : new Date();

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_disputes
             (tenant_id, dispute_id, charge_id, amount, currency, status, dispute_created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (tenant_id, dispute_id) DO UPDATE SET
               amount = EXCLUDED.amount,
               status = EXCLUDED.status;`,
            [tenantId, disputeId, chargeId, amount, currency, status, createdAt]
          );
        }
      }
    }
  } catch (err) {
    console.error('Stripe disputes fetch error:', err);
  }

  // 7. Sync Products
  try {
    const res = await fetch('https://api.stripe.com/v1/products?limit=50', { headers: authHeader });
    if (res.ok) {
      const data = await res.json();
      for (const prod of data.data || []) {
        const productId = prod.id;
        const name = prod.name || 'Stripe Product';
        const currency = 'USD';

        if (db.isPgActive()) {
          await db.query(
            `INSERT INTO stripe_products
             (tenant_id, product_id, name, price, currency)
             VALUES ($1, $2, $3, 0, $4)
             ON CONFLICT (tenant_id, product_id) DO UPDATE SET
               name = EXCLUDED.name;`,
            [tenantId, productId, name, currency]
          );
        }
      }
    }
  } catch (err) {
    console.error('Stripe products fetch error:', err);
  }

  // Update last_synced_at timestamp in tenant_credentials
  if (db.isPgActive()) {
    await db.query(
      `UPDATE tenant_credentials SET last_synced_at = NOW() WHERE tenant_id = $1 AND provider = 'stripe'`,
      [tenantId]
    );
  }

  return { syncedCharges, syncedCustomers, syncedInvoices, syncedPayouts };
}
