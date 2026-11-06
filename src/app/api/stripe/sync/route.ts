import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { syncStripeData } from '@/lib/stripe';

// POST: Trigger Manual Sync of Stripe Charges, Customers, Invoices, & Payouts
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credentials = await db.getCredentials(tenantId, 'stripe');
    if (!credentials || !credentials.client_id) {
      return NextResponse.json({ error: 'Stripe connector is not configured' }, { status: 400 });
    }

    const apiKey = credentials.client_id;
    const syncResult = await syncStripeData(tenantId, apiKey);

    const totalSynced = syncResult.syncedCharges + syncResult.syncedCustomers + syncResult.syncedInvoices + syncResult.syncedPayouts;

    return NextResponse.json({
      success: true,
      message: `Stripe sync completed. Synced ${syncResult.syncedCharges} charges, ${syncResult.syncedCustomers} customers, ${syncResult.syncedInvoices} invoices, and ${syncResult.syncedPayouts} payouts into PostgreSQL.`,
      chargesCount: syncResult.syncedCharges,
      customersCount: syncResult.syncedCustomers,
      invoicesCount: syncResult.syncedInvoices,
      payoutsCount: syncResult.syncedPayouts,
      totalCount: totalSynced
    });
  } catch (err: any) {
    console.error('Stripe manual sync error:', err);
    return NextResponse.json({ error: err.message || 'Stripe sync failed' }, { status: 500 });
  }
}
