import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// GET: Returns live PostgreSQL table schemas, exact row counts, and DB connection diagnostics
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isPg = db.isPgActive();
    
    let tableStats: any[] = [];
    let totalRecords = 0;

    if (isPg) {
      // Query exact live counts from PostgreSQL for current tenant
      const queries = [
        { key: 'invoices', name: 'Sales & Purchase Invoices', category: 'Invoicing & Receivables', table: 'invoices' },
        { key: 'contacts', name: 'Customers & Suppliers (Contacts)', category: 'CRM & Entities', table: 'contacts' },
        { key: 'accounts', name: 'Chart of Accounts (GL)', category: 'General Ledger', table: 'accounts' },
        { key: 'payments', name: 'Payment Transactions', category: 'Cash & Reconciliation', table: 'payments' },
        { key: 'amazon_orders', name: 'Amazon Sales Orders', category: 'E-Commerce Marketplace', table: 'amazon_orders' },
        { key: 'amazon_settlements', name: 'Amazon Financial Settlements', category: 'E-Commerce Marketplace', table: 'amazon_settlements' },
        { key: 'ebay_orders', name: 'eBay Sales Orders', category: 'E-Commerce Marketplace', table: 'ebay_orders' },
        { key: 'ebay_transactions', name: 'eBay Financial Transactions', category: 'E-Commerce Marketplace', table: 'ebay_transactions' },
        { key: 'stripe_charges', name: 'Stripe Payment Charges', category: 'Payment Gateway', table: 'stripe_charges' },
        { key: 'stripe_customers', name: 'Stripe Customers', category: 'Payment Gateway', table: 'stripe_customers' },
        { key: 'stripe_invoices', name: 'Stripe Subscriptions & Invoices', category: 'Payment Gateway', table: 'stripe_invoices' },
        { key: 'stripe_payouts', name: 'Stripe Payouts & Settlements', category: 'Payment Gateway', table: 'stripe_payouts' },
        { key: 'tax_transactions', name: 'Tax Transactions', category: 'Tax Center', table: 'tax_transactions' },
        { key: 'fixed_assets', name: 'Fixed Asset Register', category: 'Assets', table: 'fixed_assets' }
      ];

      for (const q of queries) {
        try {
          const res = await db.query(`SELECT COUNT(*) as count FROM ${q.table} WHERE tenant_id = $1`, [tenantId]);
          const count = parseInt(res.rows[0]?.count || '0', 10);
          tableStats.push({
            key: q.key,
            displayName: q.name,
            tableName: q.table,
            category: q.category,
            count: count,
            status: count > 0 ? 'Active' : 'Empty'
          });
          totalRecords += count;
        } catch (err) {
          // Table may not exist yet if empty
          tableStats.push({
            key: q.key,
            displayName: q.name,
            tableName: q.table,
            category: q.category,
            count: 0,
            status: 'Empty'
          });
        }
      }
    } else {
      // Memory fallback stats
      const json = db.readJsonDb();
      tableStats = [
        { key: 'invoices', displayName: 'Sales & Purchase Invoices', tableName: 'invoices', category: 'Invoicing', count: (json.invoices || []).length, status: 'Active' },
        { key: 'contacts', displayName: 'Customers & Suppliers', tableName: 'contacts', category: 'CRM', count: (json.contacts || []).length, status: 'Active' },
        { key: 'accounts', displayName: 'Chart of Accounts', tableName: 'accounts', category: 'General Ledger', count: (json.accounts || []).length, status: 'Active' },
        { key: 'payments', displayName: 'Payments', tableName: 'payments', category: 'Cash', count: (json.payments || []).length, status: 'Active' }
      ];
      totalRecords = tableStats.reduce((acc, t) => acc + t.count, 0);
    }

    // Active Data Sources = Number of tables with count > 0
    const activeDataSourcesCount = tableStats.filter(t => t.count > 0).length;

    return NextResponse.json({
      success: true,
      postgresConnected: isPg,
      databaseName: process.env.DB_NAME || 'virtual_cfo',
      databaseHost: process.env.DB_HOST || 'localhost',
      databasePort: process.env.DB_PORT || '5432',
      tables: tableStats,
      totalRecords: totalRecords,
      activeDataSourcesCount: activeDataSourcesCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to inspect database' }, { status: 500 });
  }
}
