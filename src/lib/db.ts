import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
 
// PostgreSQL Connection Pool Config
export function parseXeroDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr !== 'string') {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = dateStr.match(/Date\((\d+)(?:[+-]\d+)?\)/);
  if (match) {
    return new Date(parseInt(match[1]));
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const pgPool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000
      }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'virtual_cfo',
        connectionTimeoutMillis: 5000
      }
);

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});
 
let isPgConnected = true;
 
// Initialize PostgreSQL tables if online
const initPgTables = async () => {
  try {
    const client = await pgPool.connect();
    isPgConnected = true;
    console.log('Successfully connected to PostgreSQL database!');
    
    // Create Tenants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Drop unique constraint on tenant name to allow duplicate/reconnected names across tenants
    try {
      await client.query('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_name_key;');
    } catch (err: any) {
      console.warn('Could not drop unique constraint on tenants(name):', err.message);
    }

    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        role VARCHAR(100) NOT NULL DEFAULT 'Finance Manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100) NOT NULL DEFAULT 'Finance Manager';");

    // Create Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create User Invitations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_invitations (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        organization_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) DEFAULT 'Finance Manager',
        invited_by VARCHAR(255) DEFAULT 'Super Administrator',
        status VARCHAR(50) DEFAULT 'Pending',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Organization Onboarding Profiles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_profiles (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255),
        work_email VARCHAR(255),
        job_title VARCHAR(100),
        financial_decision_role VARCHAR(100),
        business_name VARCHAR(255),
        business_type VARCHAR(100),
        industry VARCHAR(100),
        business_description TEXT,
        employees_range VARCHAR(50),
        customers_range VARCHAR(50),
        annual_revenue_range VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'INR',
        legal_entities_count VARCHAR(20),
        monetization_models JSONB,
        sales_channels JSONB,
        revenue_model VARCHAR(50),
        payment_terms VARCHAR(50),
        fiscal_year VARCHAR(50),
        accounting_basis VARCHAR(50),
        primary_accounting_platform VARCHAR(100),
        bank_reconciliation_frequency VARCHAR(50),
        cfo_help_priorities JSONB,
        biggest_financial_challenge VARCHAR(255),
        improvement_goals_12m VARCHAR(255),
        custom_cfo_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
 
    // Create Tenant Credentials Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_credentials (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        tenant_identifier VARCHAR(255),
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP,
        scopes TEXT[],
        client_id VARCHAR(255),
        client_secret VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, provider)
      );
    `);
 
    // Create Caches Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        name VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
 
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        invoice_number VARCHAR(100),
        type VARCHAR(50),
        status VARCHAR(50),
        total DECIMAL,
        amount_due DECIMAL,
        amount_paid DECIMAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
 
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        amount DECIMAL,
        payment_type VARCHAR(50),
        status VARCHAR(50),
        payment_date TIMESTAMP,
        invoice_id VARCHAR(255),
        invoice_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
 
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        external_id VARCHAR(255),
        name VARCHAR(255),
        code VARCHAR(50),
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
 
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        report_type VARCHAR(150) NOT NULL,
        raw_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, report_type)
      );
    `);
    await client.query('ALTER TABLE reports ALTER COLUMN report_type TYPE VARCHAR(150);');

    await client.query(`
      CREATE TABLE IF NOT EXISTS management_account_adjustments (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        adjustment_ref VARCHAR(80) NOT NULL,
        account_id VARCHAR(255) NOT NULL,
        account_code VARCHAR(50),
        account_name VARCHAR(255) NOT NULL,
        account_classification VARCHAR(80) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        adjustment_date DATE NOT NULL,
        adjustment_type VARCHAR(60) NOT NULL,
        direction VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
        amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence_reference TEXT,
        source_classification VARCHAR(32) NOT NULL DEFAULT 'INTERNAL_ADJUSTMENT' CHECK (source_classification = 'INTERNAL_ADJUSTMENT'),
        idempotency_key VARCHAR(100),
        status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REVERSED')),
        reversal_of BIGINT,
        created_by_user_id INTEGER NOT NULL,
        created_by_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by_user_id INTEGER,
        reviewed_by_email VARCHAR(255),
        reviewed_at TIMESTAMPTZ,
        UNIQUE (tenant_id, adjustment_ref),
        UNIQUE (tenant_id, idempotency_key),
        UNIQUE (tenant_id, reversal_of),
        FOREIGN KEY (reversal_of) REFERENCES management_account_adjustments(id),
        CHECK (period_start <= period_end),
        CHECK (adjustment_date BETWEEN period_start AND period_end)
      );
      CREATE INDEX IF NOT EXISTS management_account_adjustments_period_idx
        ON management_account_adjustments (tenant_id, period_start, period_end, account_id);
      CREATE INDEX IF NOT EXISTS management_account_adjustments_status_idx
        ON management_account_adjustments (tenant_id, status);

      CREATE TABLE IF NOT EXISTS management_account_adjustment_audit (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        adjustment_id BIGINT NOT NULL REFERENCES management_account_adjustments(id),
        event_type VARCHAR(30) NOT NULL,
        actor_user_id INTEGER NOT NULL,
        actor_email VARCHAR(255) NOT NULL,
        event_reason TEXT NOT NULL,
        before_state JSONB,
        after_state JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS management_account_adjustment_audit_idx
        ON management_account_adjustment_audit (tenant_id, adjustment_id, created_at);

      CREATE TABLE IF NOT EXISTS management_account_ledger_snapshots (
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        account_id VARCHAR(255) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        source_classification VARCHAR(16) NOT NULL DEFAULT 'XERO_SOURCE' CHECK (source_classification = 'XERO_SOURCE'),
        raw_report JSONB NOT NULL,
        parsed_ledger JSONB NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, account_id, period_start, period_end),
        CHECK (period_start <= period_end)
      );

      CREATE OR REPLACE FUNCTION reject_management_adjustment_audit_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Management account adjustment audit history is immutable';
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS management_account_adjustment_audit_immutable ON management_account_adjustment_audit;
      CREATE TRIGGER management_account_adjustment_audit_immutable
        BEFORE UPDATE OR DELETE ON management_account_adjustment_audit
        FOR EACH ROW EXECUTE FUNCTION reject_management_adjustment_audit_mutation();
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS management_manual_journals (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        journal_ref VARCHAR(80) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        journal_date DATE NOT NULL,
        description VARCHAR(500) NOT NULL,
        reason TEXT NOT NULL,
        created_by_user_id INTEGER NOT NULL,
        created_by_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_classification VARCHAR(32) NOT NULL DEFAULT 'MANAGEMENT_ONLY' CHECK (source_classification = 'MANAGEMENT_ONLY'),
        UNIQUE (tenant_id, journal_ref),
        CHECK (period_start <= period_end),
        CHECK (journal_date BETWEEN period_start AND period_end)
      );
      CREATE TABLE IF NOT EXISTS management_manual_journal_lines (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        journal_id BIGINT NOT NULL REFERENCES management_manual_journals(id) ON DELETE CASCADE,
        account_id VARCHAR(255) NOT NULL,
        account_code VARCHAR(50),
        account_name VARCHAR(255) NOT NULL,
        account_classification VARCHAR(80) NOT NULL,
        line_description VARCHAR(500),
        debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
        credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
        source_classification VARCHAR(32) NOT NULL DEFAULT 'MANAGEMENT_ONLY' CHECK (source_classification = 'MANAGEMENT_ONLY'),
        CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
      );
      CREATE INDEX IF NOT EXISTS management_manual_journals_period_idx
        ON management_manual_journals (tenant_id, period_start, period_end, journal_date);
      CREATE INDEX IF NOT EXISTS management_manual_journal_lines_account_idx
        ON management_manual_journal_lines (tenant_id, account_id, journal_id);
    `);
    // Xero can return values with more precision than two decimal places.
    // Keep that precision for management-only journal inputs as well; source
    // reports and journals are stored losslessly in JSONB.
    await client.query(`
      ALTER TABLE management_account_adjustments ALTER COLUMN amount TYPE NUMERIC(30,10);
      ALTER TABLE management_manual_journal_lines ALTER COLUMN debit TYPE NUMERIC(30,10);
      ALTER TABLE management_manual_journal_lines ALTER COLUMN credit TYPE NUMERIC(30,10);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_credit_limits (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        contact_id VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        credit_limit DECIMAL DEFAULT 0,
        credit_terms_days INTEGER DEFAULT 90,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, contact_id)
      );
    `);
 
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookkeeping_rules (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        rule_code VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        condition_type VARCHAR(100),
        config_json JSONB DEFAULT '{}'::jsonb,
        rationale_template TEXT,
        is_custom BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, rule_code)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        item_id VARCHAR(255) NOT NULL,
        code VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        is_tracked_as_inventory BOOLEAN DEFAULT FALSE,
        quantity_on_hand DECIMAL,
        unit_price DECIMAL,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, item_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_menu_permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) DEFAULT 'ALL',
        menu_key VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role, menu_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_thresholds (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        item_id VARCHAR(255) NOT NULL,
        minimum_stock DECIMAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, item_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_sales_history (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        item_id VARCHAR(255) NOT NULL,
        invoice_id VARCHAR(255) NOT NULL,
        quantity_sold DECIMAL NOT NULL,
        sold_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_cache (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, cache_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fixed_assets (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        external_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        asset_number VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        purchase_date TIMESTAMP,
        purchase_price DECIMAL DEFAULT 0.0000,
        accumulated_depreciation DECIMAL DEFAULT 0.0000,
        book_value DECIMAL DEFAULT 0.0000,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, external_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fixed_assets_cache (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, cache_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets_cache (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, cache_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_budget_plans (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL,
        plan_key VARCHAR(255) DEFAULT 'default_plan',
        plan_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, plan_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_cache (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, cache_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS gl_cache (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, cache_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_transactions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        xero_transaction_id VARCHAR(255) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        direction VARCHAR(50) NOT NULL,
        date TIMESTAMP NOT NULL,
        tax_type VARCHAR(100) NOT NULL,
        tax_rate_name VARCHAR(255),
        tax_rate_percent DECIMAL DEFAULT 0,
        taxable_amount DECIMAL DEFAULT 0,
        tax_amount DECIMAL DEFAULT 0,
        status VARCHAR(50),
        currency VARCHAR(50),
        contact_name VARCHAR(255),
        account_code VARCHAR(50),
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, xero_transaction_id, tax_type, direction)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS account_transactions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        account_code VARCHAR(50) NOT NULL,
        account_name VARCHAR(255),
        date TIMESTAMP NOT NULL,
        source VARCHAR(100) NOT NULL,
        source_id VARCHAR(255),
        description TEXT,
        reference VARCHAR(255),
        currency VARCHAR(10) DEFAULT 'GBP',
        debit DECIMAL DEFAULT 0,
        credit DECIMAL DEFAULT 0,
        debit_gbp DECIMAL DEFAULT 0,
        credit_gbp DECIMAL DEFAULT 0,
        running_balance DECIMAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS xero_account_transaction_rows (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        account_code VARCHAR(50),
        account_name VARCHAR(255),
        date TIMESTAMP,
        source VARCHAR(100),
        source_id VARCHAR(255),
        description TEXT,
        reference VARCHAR(255),
        currency VARCHAR(10) DEFAULT 'GBP',
        debit DECIMAL DEFAULT 0,
        credit DECIMAL DEFAULT 0,
        gross_amount DECIMAL DEFAULT 0,
        tax_amount DECIMAL DEFAULT 0,
        running_balance DECIMAL DEFAULT 0,
        source_account_id VARCHAR(255),
        source_line_id VARCHAR(255),
        transaction_type VARCHAR(50),
        source_id_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, source_account_id, date, transaction_type, reference, description, debit, credit)
      );
    `);

    // Alter table to add currency, invoice_date, contact_name, due_date, and last_synced_at if they don't exist
    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(50);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMP;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference VARCHAR(255);
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB;
      ALTER TABLE tenant_credentials ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
      ALTER TABLE tenant_credentials ALTER COLUMN access_token DROP NOT NULL;
      ALTER TABLE tenant_credentials ALTER COLUMN refresh_token DROP NOT NULL;
      ALTER TABLE tenant_credentials ALTER COLUMN expires_at DROP NOT NULL;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(255);
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50);
      ALTER TABLE tenant_credentials ADD COLUMN IF NOT EXISTS region VARCHAR(50);
      ALTER TABLE tenant_credentials ADD COLUMN IF NOT EXISTS marketplace_id VARCHAR(100);
      ALTER TABLE tenant_credentials ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'production';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE;
      ALTER TABLE organization_profiles ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_id VARCHAR(255);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status VARCHAR(50);
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(255);
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS source_line_id VARCHAR(255);
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS tax_type VARCHAR(100);
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS net_amount DECIMAL DEFAULT 0;
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS tax_amount DECIMAL DEFAULT 0;
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS gross_amount DECIMAL DEFAULT 0;
      ALTER TABLE account_transactions ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'DEBIT';
    `);

    // Create Amazon Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_orders (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        amazon_order_id VARCHAR(100) NOT NULL,
        seller_id VARCHAR(100),
        purchase_date TIMESTAMP,
        order_status VARCHAR(50),      -- Raw SP-API: Pending, Unshipped, PartiallyShipped, Shipped, Canceled, Unfulfillable, InvoiceUnconfirmed, PendingAvailability
        business_status VARCHAR(50),   -- Derived CFO State: Pending, Unshipped, Shipped, Delivered, Returned, Canceled
        fulfillment_channel VARCHAR(50),
        sales_channel VARCHAR(100),
        order_total_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        number_of_items_shipped INTEGER DEFAULT 0,
        number_of_items_unshipped INTEGER DEFAULT 0,
        buyer_email VARCHAR(255),
        buyer_name VARCHAR(255),
        ship_city VARCHAR(100),
        ship_country VARCHAR(10),
        amazon_fees DECIMAL(15, 2) DEFAULT 0,
        refund_amount DECIMAL(15, 2) DEFAULT 0,
        is_returned BOOLEAN DEFAULT FALSE,
        return_reason VARCHAR(255),
        delivery_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, amazon_order_id)
      );
    `);

    // Ensure updated_at, amazon_fees, refund_amount, business_status, is_returned exist on amazon_orders
    await client.query(`
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS amazon_fees DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS business_status VARCHAR(50) DEFAULT 'Shipped';
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS is_returned BOOLEAN DEFAULT FALSE;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS return_reason VARCHAR(255);
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP;
    `);

    // Create Amazon Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_order_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        amazon_order_id VARCHAR(100) NOT NULL,
        order_item_id VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        seller_sku VARCHAR(100),
        title TEXT,
        image_url TEXT,
        thumbnail_url TEXT,
        quantity_ordered INTEGER DEFAULT 1,
        quantity_shipped INTEGER DEFAULT 0,
        item_price DECIMAL(15, 2) DEFAULT 0,
        item_tax DECIMAL(15, 2) DEFAULT 0,
        shipping_price DECIMAL(15, 2) DEFAULT 0,
        promotion_discount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, order_item_id)
      );
    `);

    // Ensure image_url and thumbnail_url exist on amazon_order_items
    await client.query(`
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
    `);

    // Create Amazon Financial Settlements Table (Finances & Transfers API Payouts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_settlements (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        financial_event_group_id VARCHAR(100) NOT NULL,
        settlement_id VARCHAR(100),
        processing_status VARCHAR(50),      -- Open, Closed
        fund_transfer_status VARCHAR(50),    -- SUCCESS, IN_PROGRESS, FAILED
        original_total_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        deposit_date TIMESTAMP,              -- Bank transfer completion date
        account_tail VARCHAR(10),            -- Bank account last 4 digits
        transfer_type VARCHAR(50) DEFAULT 'STANDARD', -- STANDARD, EXPRESS, SELLER_WALLET
        trace_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, financial_event_group_id)
      );
    `);

    // Ensure deposit_date, account_tail, transfer_type, trace_id exist on amazon_settlements
    await client.query(`
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS deposit_date TIMESTAMP;
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS account_tail VARCHAR(10);
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(50) DEFAULT 'STANDARD';
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100);
    `);

    // Create Amazon Financial Event Groups Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_financial_event_groups (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        financial_event_group_id VARCHAR(100) NOT NULL,
        processing_status VARCHAR(50),
        fund_transfer_status VARCHAR(50),
        original_total_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, financial_event_group_id)
      );
    `);

    // Create Amazon Transfers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_transfers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        transfer_id VARCHAR(100),
        financial_event_group_id VARCHAR(100),
        transfer_type VARCHAR(50) DEFAULT 'STANDARD',
        amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        status VARCHAR(50) DEFAULT 'SUCCESS',
        deposit_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Products (Catalog, Pricing & Intelligence) Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_products (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        asin VARCHAR(50) NOT NULL,
        seller_sku VARCHAR(100),
        title TEXT,
        brand VARCHAR(100),
        product_group VARCHAR(100),
        category_name VARCHAR(255),                    -- Category title from Catalog Items salesRanks
        image_url TEXT,
        sales_rank INTEGER DEFAULT 0,                  -- Catalog Items API: Primary Sales Rank (BSR)
        display_group_rank INTEGER DEFAULT 0,          -- Catalog Items API: Sub-category display group rank
        price DECIMAL(15, 2) DEFAULT 0,
        cogs DECIMAL(15, 2) DEFAULT 0,                 -- Cost of Goods Sold per unit
        shipping_cost DECIMAL(15, 2) DEFAULT 0,        -- Other shipping / handling costs
        units_sold INTEGER DEFAULT 0,                  -- Derived Orders API Units
        total_revenue DECIMAL(15, 2) DEFAULT 0,       -- Derived Revenue
        total_fees DECIMAL(15, 2) DEFAULT 0,          -- Derived Finances API Fees
        total_refunds DECIMAL(15, 2) DEFAULT 0,       -- Derived Refunds
        contribution_profit DECIMAL(15, 2) DEFAULT 0, -- Revenue - Fees - Refunds - COGS - Shipping
        margin_percentage DECIMAL(10, 2) DEFAULT 0,   -- Margin %
        buy_box_price DECIMAL(15, 2) DEFAULT 0,        -- Product Pricing API v2022-05-01: Buy Box / Featured Offer
        lowest_offer_price DECIMAL(15, 2) DEFAULT 0,   -- Product Pricing API: Lowest Offer
        competitor_price DECIMAL(15, 2) DEFAULT 0,     -- Product Pricing API: Competitor Price Summary
        is_buy_box_winner BOOLEAN DEFAULT TRUE,        -- Buy Box Winner status
        reference_price DECIMAL(15, 2) DEFAULT 0,      -- List / MSRP Reference Price
        estimated_referral_fee DECIMAL(15, 2) DEFAULT 0, -- Product Fees API (getMyFeesEstimates)
        estimated_fba_fee DECIMAL(15, 2) DEFAULT 0,      -- Product Fees API (getMyFeesEstimates)
        estimated_total_fee DECIMAL(15, 2) DEFAULT 0,    -- Product Fees API (getMyFeesEstimates)
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, asin)
      );
    `);

    // Ensure all Product Intelligence, Pricing & Fee Estimation columns exist on amazon_products
    await client.query(`
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS category_name VARCHAR(255);
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS sales_rank INTEGER DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS display_group_rank INTEGER DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS cogs DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS units_sold INTEGER DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS total_fees DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS total_refunds DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS contribution_profit DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS margin_percentage DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS buy_box_price DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS lowest_offer_price DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS competitor_price DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS is_buy_box_winner BOOLEAN DEFAULT TRUE;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS reference_price DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS estimated_referral_fee DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS estimated_fba_fee DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS estimated_total_fee DECIMAL(15, 2) DEFAULT 0;
    `);

    // Create Amazon Item Review Trends & Customer Insights Table (getItemReviewTrends API)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_reviews (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        asin VARCHAR(50) NOT NULL,
        seller_sku VARCHAR(100),
        title TEXT,
        average_rating DECIMAL(3, 2) DEFAULT 4.50,
        total_reviews INTEGER DEFAULT 0,
        positive_sentiment_percent DECIMAL(5, 2) DEFAULT 88.00,
        negative_sentiment_percent DECIMAL(5, 2) DEFAULT 12.00,
        recent_reviews_count INTEGER DEFAULT 0,
        review_sentiment VARCHAR(50) DEFAULT 'POSITIVE',
        top_topics JSONB,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, asin)
      );
    `);

    // Create Amazon Product Fee Estimates Table (Product Fees API: getMyFeesEstimates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_fee_estimates (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        asin VARCHAR(50) NOT NULL,
        seller_sku VARCHAR(100),
        listing_price DECIMAL(15, 2) DEFAULT 0,
        estimated_referral_fee DECIMAL(15, 2) DEFAULT 0,
        estimated_fba_fulfillment_fee DECIMAL(15, 2) DEFAULT 0,
        estimated_variable_closing_fee DECIMAL(15, 2) DEFAULT 0,
        estimated_total_fee DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, asin)
      );
    `);

    // Create Amazon Product Pricing Table (Product Pricing API v2022-05-01 Competitive History)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_pricing (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        asin VARCHAR(50) NOT NULL,
        seller_sku VARCHAR(100),
        your_price DECIMAL(15, 2) DEFAULT 0,
        buy_box_price DECIMAL(15, 2) DEFAULT 0,
        lowest_offer_price DECIMAL(15, 2) DEFAULT 0,
        competitor_price DECIMAL(15, 2) DEFAULT 0,
        is_buy_box_winner BOOLEAN DEFAULT TRUE,
        currency VARCHAR(10) DEFAULT 'GBP',
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon FBA Inbound Shipments Table (Fulfillment Inbound API v2024-03-20)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_inbound_shipments (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        shipment_id VARCHAR(100) NOT NULL,
        shipment_name VARCHAR(255),
        shipment_status VARCHAR(50),       -- WORKING, SHIPPED, IN_TRANSIT, DELIVERED, CHECKED_IN, RECEIVING, CLOSED, CANCELLED
        destination_fulfillment_center_id VARCHAR(50),
        expected_units INTEGER DEFAULT 0,
        received_units INTEGER DEFAULT 0,
        created_date TIMESTAMP,
        last_updated_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, shipment_id)
      );
    `);

    // Create Amazon FBA Inbound Items Table (Fulfillment Inbound API v2024-03-20 Line Items)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_inbound_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        shipment_id VARCHAR(100) NOT NULL,
        seller_sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        title TEXT,
        quantity_shipped INTEGER DEFAULT 0,   -- Expected Units
        quantity_received INTEGER DEFAULT 0,  -- Received Units
        quantity_in_case INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon FBA Outbound Fulfillment Orders Table (Fulfillment Outbound API v2020-07-01 / MCF)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_outbound_fulfillment_orders (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_fulfillment_order_id VARCHAR(100) NOT NULL,
        displayable_order_id VARCHAR(100),
        fulfillment_action VARCHAR(50) DEFAULT 'SHIP',
        fulfillment_policy VARCHAR(50) DEFAULT 'FILL_ALL',
        fulfillment_order_status VARCHAR(50),  -- RECEIVED, PLANNING, PROCESSING, COMPLETE, UNFULFILLABLE, CANCELLED
        shipping_speed_category VARCHAR(50),    -- STANDARD, EXPEDITED, PRIORITY
        destination_name VARCHAR(255),
        destination_city VARCHAR(100),
        destination_country VARCHAR(10),
        total_items_count INTEGER DEFAULT 1,
        displayable_order_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, seller_fulfillment_order_id)
      );
    `);

    // Create Amazon FBA Outbound Fulfillment Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_outbound_fulfillment_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_fulfillment_order_id VARCHAR(100) NOT NULL,
        seller_sku VARCHAR(100) NOT NULL,
        seller_fulfillment_order_item_id VARCHAR(100),
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Listings Health Table (Listings Items API v2021-08-01)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_listings_health (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        title TEXT,
        status VARCHAR(50) DEFAULT 'ACTIVE',            -- ACTIVE, INACTIVE, SUPPRESSED, DISCONTINUED
        status_reason VARCHAR(255),
        is_buyable BOOLEAN DEFAULT TRUE,
        is_search_suppressed BOOLEAN DEFAULT FALSE,
        issues_count INTEGER DEFAULT 0,
        fulfillment_channel VARCHAR(50) DEFAULT 'AMAZON_NA',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, seller_sku)
      );
    `);

    // Create Amazon Listing Issues Table (Listings Items API Errors & Policy Warnings)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_listing_issues (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        issue_code VARCHAR(100),
        severity VARCHAR(20) DEFAULT 'WARNING',           -- ERROR, WARNING, INFO
        message TEXT,
        attribute_names TEXT[],
        status VARCHAR(20) DEFAULT 'OPEN',               -- OPEN, RESOLVED
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Listing Restrictions Table (Listings Restrictions API v2021-08-01)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_listing_restrictions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        asin VARCHAR(50) NOT NULL,
        seller_sku VARCHAR(100),
        title TEXT,
        restriction_type VARCHAR(100),                   -- APPROVAL_REQUIRED, BRAND_GATING, HAZMAT, CATEGORY_RESTRICTION
        reason_code VARCHAR(100),
        condition_type VARCHAR(50) DEFAULT 'new_new',
        approval_link TEXT,                              -- Direct Seller Central Approval URL
        status VARCHAR(50) DEFAULT 'RESTRICTED',         -- RESTRICTED, APPROVAL_PENDING, APPROVED
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, asin, condition_type)
      );
    `);

    // Create Amazon Product Type Definitions Table (Product Type Definitions API v2020-09-01)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_type_definitions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        product_type VARCHAR(100) NOT NULL,              -- LUGGAGE, CLOTHING, SHOES, ELECTRONIC_COMPONENT
        marketplace_id VARCHAR(50) NOT NULL,
        schema_version VARCHAR(50) DEFAULT 'v2020-09-01',
        product_type_version VARCHAR(50) DEFAULT 'v1',
        requirements VARCHAR(100) DEFAULT 'LISTING_PRODUCT_ONLY',
        schema_json JSONB,                               -- Full JSON schema defining required fields, attributes, enums, rules
        required_attributes JSONB,                      -- Array of required field names like title, brand, manufacturer
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, product_type, marketplace_id)
      );
    `);

    // Create Amazon Sync Runs Table (Module 23: Data Coverage & Pipeline Sync Tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_sync_runs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        connection_id VARCHAR(100),
        api_name VARCHAR(100) NOT NULL,                  -- Orders, Finances, Reports, Inventory, Catalog, Listings, Pricing, Fees
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        records_fetched INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Healthy',             -- Healthy, Syncing, Failed, Warning
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Report Jobs Table (Reports API v2021-06-30 Workflow Engine)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_report_jobs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        report_id VARCHAR(100) NOT NULL,
        report_type VARCHAR(100) NOT NULL,              -- GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA, GET_VAT_TRANSACTION_DATA, etc.
        report_category VARCHAR(50) NOT NULL,          -- INVENTORY, ORDER, RETURN, TAX, PERFORMANCE, FBA
        processing_status VARCHAR(50) DEFAULT 'SUBMITTED', -- SUBMITTED, IN_PROGRESS, CANCELLED, DONE, FATAL
        report_document_id VARCHAR(100),
        download_url TEXT,                              -- Pre-signed S3 download URL
        compression_algorithm VARCHAR(20) DEFAULT 'NONE', -- GZIP, NONE
        data_start_time TIMESTAMP,
        data_end_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, report_id)
      );
    `);

    // Create Amazon Inventory (FBA Stock & Fulfillment) Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_inventory (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        fn_sku VARCHAR(100),
        fulfillable_quantity INTEGER DEFAULT 0,
        inbound_working_quantity INTEGER DEFAULT 0,
        inbound_shipped_quantity INTEGER DEFAULT 0,
        inbound_receiving_quantity INTEGER DEFAULT 0,
        reserved_quantity INTEGER DEFAULT 0,
        unfulfillable_quantity INTEGER DEFAULT 0,
        researching_quantity INTEGER DEFAULT 0,
        total_quantity INTEGER DEFAULT 0,
        avg_daily_sales DECIMAL(10, 2) DEFAULT 0,
        days_of_cover DECIMAL(10, 1) DEFAULT 0,
        is_low_stock BOOLEAN DEFAULT FALSE,
        warehouse_location VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, seller_sku)
      );
    `);

    // Ensure all FBA Inventory columns exist on amazon_inventory
    await client.query(`
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS inbound_receiving_quantity INTEGER DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS unfulfillable_quantity INTEGER DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS researching_quantity INTEGER DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS avg_daily_sales DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS days_of_cover DECIMAL(10, 1) DEFAULT 0;
      ALTER TABLE amazon_inventory ADD COLUMN IF NOT EXISTS is_low_stock BOOLEAN DEFAULT FALSE;
      CREATE UNIQUE INDEX IF NOT EXISTS amazon_inventory_tenant_sku_idx ON amazon_inventory (tenant_id, seller_sku);
    `);

    // Create Amazon Inventory Alerts Table (CFO Intelligence Layer Generated Low Stock Alerts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_inventory_alerts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        seller_sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        title TEXT,
        current_stock INTEGER DEFAULT 0,
        avg_daily_sales DECIMAL(10, 2) DEFAULT 0,
        days_of_cover DECIMAL(10, 1) DEFAULT 0,
        threshold_days INTEGER DEFAULT 14,
        severity VARCHAR(20) NOT NULL,  -- 'OUT_OF_STOCK', 'CRITICAL', 'WARNING'
        recommended_reorder_qty INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, seller_sku, status)
      );
    `);

    // Create Amazon Sales Metrics Table (Time-Series Aggregations for Business Performance Chart)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_sales_metrics (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        metric_date DATE NOT NULL,
        granularity VARCHAR(20) DEFAULT 'DAY',
        total_sales DECIMAL(15, 2) DEFAULT 0,
        order_count INTEGER DEFAULT 0,
        unit_count INTEGER DEFAULT 0,
        order_item_count INTEGER DEFAULT 0,
        average_unit_price DECIMAL(15, 2) DEFAULT 0,
        net_revenue DECIMAL(15, 2) DEFAULT 0,
        amazon_fees DECIMAL(15, 2) DEFAULT 0,
        refund_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, metric_date, granularity)
      );
    `);

    // Create Amazon Financial Events Table (Finances API breakdown)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_financial_events (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        event_id VARCHAR(100),
        amazon_order_id VARCHAR(100),
        posted_date TIMESTAMP,
        event_type VARCHAR(50),  -- Shipment, Refund, Fee, Adjustment, ServiceFee, Promotion, Tax
        fee_type VARCHAR(100),    -- Principal, Tax, Commission, FBAPerUnitFulfillmentFee, PromotionDiscount, StorageFee, RefundCommission
        amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Refunds Table (Finances API: Monetary Refund Value Breakdown)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_refunds (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        amazon_order_id VARCHAR(100) NOT NULL,
        refund_event_id VARCHAR(100),
        posted_date TIMESTAMP,
        principal_refund DECIMAL(15, 2) DEFAULT 0,       -- Gross Refund Value (£ / $ / ₹)
        tax_refund DECIMAL(15, 2) DEFAULT 0,
        refund_fee_commission DECIMAL(15, 2) DEFAULT 0,   -- Amazon Fee Deduction on Refund
        net_refund_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Returns Reports Table (Reports API: Physical Return Units & Dispositions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_returns_reports (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        amazon_order_id VARCHAR(100) NOT NULL,
        return_date TIMESTAMP,
        seller_sku VARCHAR(100),
        asin VARCHAR(50),
        title TEXT,
        quantity_returned INTEGER DEFAULT 1,              -- Physical Return Units Count
        fulfillment_center_id VARCHAR(50),
        detailed_disposition VARCHAR(50),                 -- SELLABLE, CUSTOMER_DAMAGED, DEFECTIVE, EXPIRED
        reason TEXT,                                      -- Customer Return Reason
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Amazon Waterfall Summary Table (Money Flow: Customer Sales -> Discounts -> Refunds -> Amazon Fees -> Net Proceeds -> Payouts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_waterfall_summary (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        customer_sales DECIMAL(15, 2) DEFAULT 0,       -- Gross Principal Sales
        discounts DECIMAL(15, 2) DEFAULT 0,            -- Promotional Discounts
        tax DECIMAL(15, 2) DEFAULT 0,                  -- Tax
        refunds DECIMAL(15, 2) DEFAULT 0,              -- Returns & Refunds
        commission_fees DECIMAL(15, 2) DEFAULT 0,      -- Amazon Referral Commission
        fba_fulfillment_fees DECIMAL(15, 2) DEFAULT 0, -- FBA Per Unit Fulfillment Fees
        other_fees DECIMAL(15, 2) DEFAULT 0,           -- Storage, Subscription & Service Fees
        net_proceeds DECIMAL(15, 2) DEFAULT 0,         -- Net Proceeds (Sales - Discounts - Refunds - Fees)
        payouts DECIMAL(15, 2) DEFAULT 0,              -- Payout Disbursements
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, period_start, period_end)
      );
    `);

    // Create Amazon Marketplaces Mapping Reference Table (Requirement 3)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_marketplaces (
        id SERIAL PRIMARY KEY,
        marketplace_id VARCHAR(50) UNIQUE NOT NULL,
        marketplace_name VARCHAR(100) NOT NULL,
        country_code VARCHAR(10) NOT NULL,
        currency_code VARCHAR(10) NOT NULL,
        region VARCHAR(50) NOT NULL,
        amazon_domain VARCHAR(100) NOT NULL,
        timezone VARCHAR(50) DEFAULT 'UTC',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE amazon_marketplaces ADD COLUMN IF NOT EXISTS marketplace_name VARCHAR(100);
      ALTER TABLE amazon_marketplaces ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);
      ALTER TABLE amazon_marketplaces ADD COLUMN IF NOT EXISTS amazon_domain VARCHAR(100);
      ALTER TABLE amazon_marketplaces ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
      ALTER TABLE amazon_marketplaces ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);

    // Fix legacy columns: old schema had country_name (NOT NULL) and currency (NOT NULL)
    // which are no longer used. Make them nullable so INSERTs don't fail.
    try {
      await client.query(`
        ALTER TABLE amazon_marketplaces ALTER COLUMN country_name DROP NOT NULL;
        ALTER TABLE amazon_marketplaces ALTER COLUMN currency DROP NOT NULL;
      `);
    } catch (legacyErr: any) {
      // Columns may not exist on fresh installs — that's fine
    }

    await client.query(`
      INSERT INTO amazon_marketplaces (marketplace_id, country_code, marketplace_name, region, currency_code, amazon_domain, timezone)
      VALUES 
        ('A21TJRUUN4KGV', 'IN', 'Amazon India', 'us-west-2', 'INR', 'amazon.in', 'Asia/Kolkata'),
        ('ATVPDKIKX0DER', 'US', 'Amazon United States', 'us-east-1', 'USD', 'amazon.com', 'America/New_York'),
        ('A1F83G8C2ARO7P', 'GB', 'Amazon United Kingdom', 'eu-west-1', 'GBP', 'amazon.co.uk', 'Europe/London'),
        ('A1PA6795UKMFR9', 'DE', 'Amazon Germany', 'eu-west-1', 'EUR', 'amazon.de', 'Europe/Berlin'),
        ('F21TE56469C93', 'FR', 'Amazon France', 'eu-west-1', 'EUR', 'amazon.fr', 'Europe/Paris'),
        ('APJ6JRA9NG5V4', 'IT', 'Amazon Italy', 'eu-west-1', 'EUR', 'amazon.it', 'Europe/Rome'),
        ('A1RKKUPIHCS9HS', 'ES', 'Amazon Spain', 'eu-west-1', 'EUR', 'amazon.es', 'Europe/Madrid'),
        ('A1VC38T7YXB528', 'JP', 'Amazon Japan', 'us-west-2', 'JPY', 'amazon.co.jp', 'Asia/Tokyo'),
        ('A39IBJ37TRP1C6', 'AU', 'Amazon Australia', 'us-west-2', 'AUD', 'amazon.com.au', 'Australia/Sydney'),
        ('A2EUQ1WTGCTBG2', 'CA', 'Amazon Canada', 'us-east-1', 'CAD', 'amazon.ca', 'America/Toronto')
      ON CONFLICT (marketplace_id) DO UPDATE SET 
        marketplace_name = EXCLUDED.marketplace_name,
        currency_code = EXCLUDED.currency_code,
        amazon_domain = EXCLUDED.amazon_domain;
    `);

    // Clean up hardcoded mock Amazon inventory items & alerts from DB
    try {
      await client.query(`
        DELETE FROM amazon_inventory;
        DELETE FROM amazon_inventory_alerts;
        DELETE FROM amazon_order_items WHERE seller_sku IN ('STAND-LAPTOP-ALU', 'CHARGER-20W-USB', 'EARBUDS-BLK', 'WATCH-SMART-PRO', 'CABLE-USBC-BRAIDED', 'SKU-PROD');
        DELETE FROM amazon_products WHERE seller_sku IN ('STAND-LAPTOP-ALU', 'CHARGER-20W-USB', 'EARBUDS-BLK', 'WATCH-SMART-PRO', 'CABLE-USBC-BRAIDED', 'SKU-PROD');
        DELETE FROM amazon_orders WHERE amazon_order_id IN ('406-6907320-8418469', '408-2849102-3918241', '402-9918274-1294810', '114-8827361-9928174', '203-7728194-0019284', '305-6615243-8819204');
        DELETE FROM amazon_financial_event_groups WHERE financial_event_group_id LIKE 'FEG-IN-%' OR financial_event_group_id LIKE 'FEG-US-%';
        DELETE FROM amazon_settlements WHERE financial_event_group_id LIKE 'FEG-IN-%' OR financial_event_group_id LIKE 'FEG-US-%';
      `);
    } catch (cleanErr: any) {
      // Ignore if table doesn't exist yet
    }

    // Create Amazon Financial Event Groups Table (Requirement 4)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_financial_event_groups (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        connection_id VARCHAR(100) DEFAULT 'default',
        financial_event_group_id VARCHAR(100) NOT NULL,
        processing_status VARCHAR(50) DEFAULT 'Open',
        fund_transfer_status VARCHAR(50) DEFAULT 'IN_PROGRESS',
        original_total_amount DECIMAL(15, 2) DEFAULT 0,
        original_currency VARCHAR(10) DEFAULT 'INR',
        reporting_total_amount DECIMAL(15, 2) DEFAULT 0,
        reporting_currency VARCHAR(10) DEFAULT 'INR',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        trace_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, connection_id, financial_event_group_id)
      );
    `);

    // Create Amazon Bank Transfers / Payouts Table (Requirement 4)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_transfers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        connection_id VARCHAR(100) DEFAULT 'default',
        transfer_id VARCHAR(100) NOT NULL,
        settlement_id VARCHAR(100),
        financial_event_group_id VARCHAR(100),
        amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        reporting_amount DECIMAL(15, 2) DEFAULT 0,
        reporting_currency VARCHAR(10) DEFAULT 'INR',
        transfer_status VARCHAR(50) DEFAULT 'SUCCESS',
        transfer_date TIMESTAMP,
        destination_account_reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, connection_id, transfer_id)
      );
    `);

    // Create Amazon Raw API Responses Storage Table (Requirement 5)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_raw_api_responses (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        connection_id VARCHAR(100) DEFAULT 'default',
        api_name VARCHAR(100) NOT NULL,
        api_version VARCHAR(50) NOT NULL,
        endpoint TEXT,
        http_method VARCHAR(10) DEFAULT 'GET',
        request_hash VARCHAR(64),
        amazon_resource_id VARCHAR(100),
        marketplace_id VARCHAR(50),
        response_json JSONB NOT NULL,
        response_status INTEGER DEFAULT 200,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_amazon_raw_api_res ON amazon_raw_api_responses(tenant_id, connection_id, api_name, amazon_resource_id);
    `);

    // Create Dedicated Product Costs Table (Requirement 6)
    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_product_costs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV',
        sku VARCHAR(100) NOT NULL,
        asin VARCHAR(50),
        cost_type VARCHAR(50) NOT NULL,                 -- COGS, SHIPPING, PACKAGING, WAREHOUSE, OTHER
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        effective_to TIMESTAMP,
        source VARCHAR(100) DEFAULT 'CFO_CONFIG',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, sku, cost_type, effective_from)
      );
    `);

    // Alter Amazon Tables to add multi-tenant connection_id, FX conversion fields, and sync run metrics
    await client.query(`
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100) DEFAULT 'default';
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV';
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15, 2);
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS original_currency VARCHAR(10);
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS reporting_amount DECIMAL(15, 2);
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS reporting_currency VARCHAR(10) DEFAULT 'INR';
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 4) DEFAULT 1.0;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS exchange_rate_date TIMESTAMP;
      ALTER TABLE amazon_orders ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(50) DEFAULT 'AUTOMATIC';

      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100) DEFAULT 'default';
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV';
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS original_price DECIMAL(15, 2);
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS original_currency VARCHAR(10);
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS reporting_price DECIMAL(15, 2);
      ALTER TABLE amazon_order_items ADD COLUMN IF NOT EXISTS reporting_currency VARCHAR(10) DEFAULT 'INR';

      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100) DEFAULT 'default';
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV';
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS reporting_total_amount DECIMAL(15, 2);
      ALTER TABLE amazon_settlements ADD COLUMN IF NOT EXISTS reporting_currency VARCHAR(10) DEFAULT 'INR';

      ALTER TABLE amazon_financial_events ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100) DEFAULT 'default';
      ALTER TABLE amazon_financial_events ADD COLUMN IF NOT EXISTS marketplace_id VARCHAR(50) DEFAULT 'A21TJRUUN4KGV';
      ALTER TABLE amazon_financial_events ADD COLUMN IF NOT EXISTS raw_event_reference TEXT;
      ALTER TABLE amazon_financial_events ADD COLUMN IF NOT EXISTS reporting_amount DECIMAL(15, 2);
      ALTER TABLE amazon_financial_events ADD COLUMN IF NOT EXISTS reporting_currency VARCHAR(10) DEFAULT 'INR';

      ALTER TABLE amazon_sync_runs ADD COLUMN IF NOT EXISTS connection_id VARCHAR(100) DEFAULT 'default';
      ALTER TABLE amazon_sync_runs ADD COLUMN IF NOT EXISTS records_inserted INTEGER DEFAULT 0;
      ALTER TABLE amazon_sync_runs ADD COLUMN IF NOT EXISTS records_updated INTEGER DEFAULT 0;
      ALTER TABLE amazon_sync_runs ADD COLUMN IF NOT EXISTS records_failed INTEGER DEFAULT 0;
      ALTER TABLE amazon_sync_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
    `);

    // Create eBay Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ebay_orders (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        ebay_order_id VARCHAR(100) NOT NULL,
        legacy_order_id VARCHAR(100),
        creation_date TIMESTAMP,
        order_status VARCHAR(50),
        payment_status VARCHAR(50),
        total_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        buyer_username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, ebay_order_id)
      );
    `);

    // Create eBay Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ebay_order_items (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        ebay_order_id VARCHAR(100) NOT NULL,
        line_item_id VARCHAR(100) NOT NULL,
        title TEXT,
        sku VARCHAR(100),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, line_item_id)
      );
    `);

    // Create eBay Financial Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ebay_transactions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        transaction_id VARCHAR(100) NOT NULL,
        ebay_order_id VARCHAR(100),
        transaction_type VARCHAR(50),
        amount DECIMAL(15, 2) DEFAULT 0,
        fee_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'GBP',
        transaction_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, transaction_id)
      );
    `);

    // Create Stripe Charges Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_charges (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        charge_id VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2) DEFAULT 0,
        amount_refunded DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50),
        customer_id VARCHAR(100),
        description TEXT,
        payment_method VARCHAR(50),
        charge_created_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, charge_id)
      );
    `);

    // Create Stripe Customers Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_customers (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        name VARCHAR(255),
        phone VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, customer_id)
      );
    `);

    // Create Stripe Invoices Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_invoices (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id VARCHAR(100) NOT NULL,
        invoice_number VARCHAR(100),
        customer_id VARCHAR(100),
        amount_due DECIMAL(15, 2) DEFAULT 0,
        amount_paid DECIMAL(15, 2) DEFAULT 0,
        status VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, invoice_id)
      );
    `);

    // Create Stripe Payouts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_payouts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        payout_id VARCHAR(100) NOT NULL,
        amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50),
        arrival_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, payout_id)
      );
    `);

    // Create Stripe Subscriptions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_subscriptions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id VARCHAR(100) NOT NULL,
        customer_id VARCHAR(100),
        plan_name VARCHAR(255),
        mrr_amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'active',
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, subscription_id)
      );
    `);

    // Create Stripe Disputes Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_disputes (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        dispute_id VARCHAR(100) NOT NULL,
        charge_id VARCHAR(100),
        amount DECIMAL(15, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'under_review',
        dispute_created_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, dispute_id)
      );
    `);

    // Create Stripe Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_products (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        product_id VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        price DECIMAL(15, 2) DEFAULT 0,
        sales_count INTEGER DEFAULT 0,
        revenue DECIMAL(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, product_id)
      );
    `);

    // Create Tenant Account Mappings Table (Phase 1 Foundation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_account_mappings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL DEFAULT 'xero',
        source_account_id VARCHAR(255) NOT NULL,
        account_code VARCHAR(50),
        account_name VARCHAR(255),
        source_account_type VARCHAR(100),
        source_account_class VARCHAR(100),
        financial_statement_category VARCHAR(100) NOT NULL,
        subcategory VARCHAR(100),
        cfo_analytical_tag VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'SUGGESTED',
        confidence_score DECIMAL(5,2) DEFAULT 0.00,
        user_confirmed BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, source, source_account_id)
      );
    `);

    // Create Tenant Engine Settings Table (Phase 4 Feature Control)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_engine_settings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        engine_mode VARCHAR(50) DEFAULT 'LEGACY',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id)
      );
    `);

    client.release();
  } catch (err) {
    isPgConnected = false;
    console.error('CRITICAL: PostgreSQL database is offline or not created:', err);
  }
};
 
// Run PG check initially
initPgTables();

// In-Memory fallback schema (No db.json file created on disk)
interface JsonSchema {
  tenants: any[];
  tenant_credentials: any[];
  contacts: any[];
  invoices: any[];
  payments: any[];
  accounts: any[];
  reports: any[];
  users: any[];
  sessions: any[];
  bank_transactions: any[];
  prepayments: any[];
  overpayments: any[];
  inventory_items?: any[];
  inventory_thresholds?: any[];
  inventory_sales_history?: any[];
  inventory_cache?: any[];
  fixed_assets?: any[];
  fixed_assets_cache?: any[];
  budgets_cache?: any[];
  tax_cache?: any[];
  gl_cache?: any[];
  tax_transactions?: any[];
  contact_credit_limits?: any[];
  tenant_account_mappings?: any[];
  tenant_engine_settings?: any[];
  custom_budget_plans?: any[];
}

const memoryDb: JsonSchema = {
  tenants: [],
  tenant_credentials: [],
  contacts: [],
  invoices: [],
  payments: [],
  accounts: [],
  reports: [],
  users: [],
  sessions: [],
  bank_transactions: [],
  prepayments: [],
  overpayments: [],
  tenant_account_mappings: [],
  tenant_engine_settings: [],
  inventory_items: [],
  inventory_thresholds: [],
  inventory_sales_history: [],
  inventory_cache: [],
  fixed_assets: [],
  fixed_assets_cache: [],
  budgets_cache: [],
  tax_cache: [],
  gl_cache: [],
  tax_transactions: [],
  custom_budget_plans: []
};

const readJsonDb = (): JsonSchema => memoryDb;
const writeJsonDb = (data: JsonSchema) => {};

// DATABASE EXPORTS
export const db = {
  saveReport: async (tenantId: string | number, reportType: string, rawData: any): Promise<void> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
            report_type VARCHAR(150) NOT NULL,
            raw_data JSONB NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, report_type)
          );
          ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        await pgPool.query(`
          INSERT INTO reports (tenant_id, report_type, raw_data)
          VALUES ($1, $2, $3)
          ON CONFLICT (tenant_id, report_type) DO UPDATE SET raw_data = EXCLUDED.raw_data, updated_at = CURRENT_TIMESTAMP;
        `, [tid, reportType, JSON.stringify(rawData)]);
        return;
      } catch (e) {
        console.error("Failed to save report in PG:", e);
      }
    }
    const json = readJsonDb();
    if (!json.reports) json.reports = [];
    const idx = json.reports.findIndex((r: any) => r.tenant_id === tid && r.report_type === reportType);
    if (idx >= 0) json.reports[idx].raw_data = rawData;
    else json.reports.push({ tenant_id: tid, report_type: reportType, raw_data: rawData });
    writeJsonDb(json);
  },

  getPostgresReport: async (tenantId: number, reportType: string): Promise<any | null> => {
    try {
      const { rows } = await pgPool.query(
        'SELECT raw_data FROM reports WHERE tenant_id = $1 AND report_type = $2 LIMIT 1',
        [tenantId, reportType]
      );
      isPgConnected = true;
      return rows[0]?.raw_data ?? null;
    } catch (error) {
      isPgConnected = false;
      throw error;
    }
  },

  deleteReport: async (tenantId: number, reportType: string): Promise<void> => {
    if (isPgConnected) {
      await pgPool.query('DELETE FROM reports WHERE tenant_id = $1 AND report_type = $2', [tenantId, reportType]);
      return;
    }
    const json = readJsonDb();
    if (json.reports) json.reports = json.reports.filter((r: any) => !(r.tenant_id === tenantId && r.report_type === reportType));
    writeJsonDb(json);
  },

  savePostgresReport: async (tenantId: number, reportType: string, rawData: unknown): Promise<void> => {
    try {
      await pgPool.query(
        `INSERT INTO reports (tenant_id, report_type, raw_data)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, report_type)
         DO UPDATE SET raw_data = EXCLUDED.raw_data, updated_at = CURRENT_TIMESTAMP`,
        [tenantId, reportType, JSON.stringify(rawData)]
      );
      isPgConnected = true;
    } catch (error) {
      isPgConnected = false;
      throw error;
    }
  },

  assertPostgres: async (): Promise<void> => {
    try {
      await pgPool.query('SELECT 1');
      isPgConnected = true;
    } catch (error) {
      isPgConnected = false;
      throw error;
    }
  },

  getAccounts: async (tenantId: string | number): Promise<any[]> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM accounts WHERE tenant_id = $1', [tid]);
        if (rows.length > 0) {
          return rows.map(r => ({
            ...r,
            account_id: r.external_id || r.account_id || String(r.id),
            AccountID: r.external_id || r.account_id || String(r.id),
            code: r.code || r.Code || '',
            Code: r.code || r.Code || '',
            name: r.name || r.Name || '',
            Name: r.name || r.Name || '',
            type: r.type || r.Type || '',
            Type: r.type || r.Type || '',
            status: r.status || r.Status || 'ACTIVE',
            Status: r.status || r.Status || 'ACTIVE'
          }));
        }
      } catch (e) {
        // Fallback below
      }
    }
    const report = await db.getReport(tid, 'Accounts');
    if (report && Array.isArray(report) && report.length > 0) {
      return report.map(a => ({
        ...a,
        account_id: a.account_id || a.AccountID || a.id || a.code,
        AccountID: a.account_id || a.AccountID || a.id || a.code,
        code: a.code || a.Code || '',
        Code: a.code || a.Code || '',
        name: a.name || a.Name || '',
        Name: a.name || a.Name || '',
        type: a.type || a.Type || '',
        Type: a.type || a.Type || '',
        status: a.status || a.Status || 'ACTIVE',
        Status: a.status || a.Status || 'ACTIVE'
      }));
    }
    const mappings = await db.getAccountMappings(tid);
    if (mappings && mappings.length > 0) {
      return mappings.map(m => ({
        account_id: m.source_account_id,
        AccountID: m.source_account_id,
        code: m.account_code,
        Code: m.account_code,
        name: m.account_name,
        Name: m.account_name,
        type: m.financial_statement_category,
        Type: m.financial_statement_category,
        status: m.status || 'ACTIVE',
        Status: m.status || 'ACTIVE'
      }));
    }
    const json = readJsonDb();
    return (json.accounts || []).filter((x: any) => x.tenant_id === tid).map((acc: any) => ({
      ...acc,
      account_id: acc.account_id || acc.external_id || acc.AccountID || String(acc.id),
      AccountID: acc.account_id || acc.external_id || acc.AccountID || String(acc.id),
      code: acc.code || acc.Code || '',
      Code: acc.code || acc.Code || '',
      name: acc.name || acc.Name || '',
      Name: acc.name || acc.Name || '',
      type: acc.type || acc.Type || '',
      Type: acc.type || acc.Type || '',
      status: acc.status || acc.Status || 'ACTIVE',
      Status: acc.status || acc.Status || 'ACTIVE'
    }));
  },

  getXeroReport: async (tenantId: string | number, reportType: string, startDate?: string, endDate?: string): Promise<any | null> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        if (startDate && endDate) {
          const key1 = `${reportType}_${startDate}_${endDate}`;
          const res1 = await pgPool.query('SELECT raw_data FROM reports WHERE tenant_id = $1 AND report_type = $2', [tid, key1]);
          if (res1.rows[0]?.raw_data) return res1.rows[0].raw_data;
        }
        if (endDate) {
          const key2 = `${reportType}_${endDate}`;
          const res2 = await pgPool.query('SELECT raw_data FROM reports WHERE tenant_id = $1 AND report_type = $2', [tid, key2]);
          if (res2.rows[0]?.raw_data) return res2.rows[0].raw_data;
        }
        const res3 = await pgPool.query(
          'SELECT raw_data FROM reports WHERE tenant_id = $1 AND (report_type = $2 OR report_type LIKE $3) ORDER BY updated_at DESC LIMIT 1',
          [tid, reportType, `${reportType}%`]
        );
        if (res3.rows[0]?.raw_data) return res3.rows[0].raw_data;
      } catch (e) {
        console.error("Database query failed in getXeroReport:", e);
      }
    }
    return await db.getReport(tid, reportType);
  },

  getTenantAccountMappings: async (tenantId: string | number): Promise<any[]> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    return await db.getAccountMappings(tid);
  },

  getCanonicalAccountBalance: async (tenantId: string | number, accountId: string, startDate?: string, endDate?: string): Promise<number> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    const invoices = await db.getInvoices(tid);
    let total = 0;
    for (const inv of invoices) {
      if (startDate && inv.date && new Date(inv.date) < new Date(startDate)) continue;
      if (endDate && inv.date && new Date(inv.date) > new Date(endDate)) continue;
      const lineItems = inv.line_items || inv.lineItems || [];
      for (const line of lineItems) {
        if (line.account_id === accountId || line.accountId === accountId || line.account_code === accountId || line.accountCode === accountId) {
          const amt = Number(line.line_amount || line.lineAmount || line.amount || 0);
          total += inv.type === 'ACCPAY' ? -amt : amt;
        }
      }
    }
    return total;
  },

  getTenantCFOThresholds: async (tenantId: string | number): Promise<any> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM tenant_cfo_thresholds WHERE tenant_id = $1', [tid]);
        if (rows[0]) {
          return {
            marginCompressionThreshold: Number(rows[0].margin_compression_threshold),
            revenueDeclineThreshold: Number(rows[0].revenue_decline_threshold),
            opexIncreaseThreshold: Number(rows[0].opex_increase_threshold),
            arIncreaseThreshold: Number(rows[0].ar_increase_threshold),
            cashDeclineThreshold: Number(rows[0].cash_decline_threshold),
            isDefault: false
          };
        }
      } catch (e) {
        // Table fallback
      }
    }
    const json = readJsonDb();
    const item = (json as any).tenant_cfo_thresholds?.find((t: any) => t.tenant_id === tid);
    if (item) {
      return { ...item, isDefault: false };
    }
    return {
      marginCompressionThreshold: 5,
      revenueDeclineThreshold: 5,
      opexIncreaseThreshold: 10,
      arIncreaseThreshold: 15,
      cashDeclineThreshold: 10,
      isDefault: true
    };
  },

  saveTenantCFOThresholds: async (tenantId: string | number, thresholds: any): Promise<void> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS tenant_cfo_thresholds (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
            margin_compression_threshold NUMERIC DEFAULT 5,
            revenue_decline_threshold NUMERIC DEFAULT 5,
            opex_increase_threshold NUMERIC DEFAULT 10,
            ar_increase_threshold NUMERIC DEFAULT 15,
            cash_decline_threshold NUMERIC DEFAULT 10,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pgPool.query(`
          INSERT INTO tenant_cfo_thresholds (tenant_id, margin_compression_threshold, revenue_decline_threshold, opex_increase_threshold, ar_increase_threshold, cash_decline_threshold)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tenant_id) DO UPDATE SET
            margin_compression_threshold = EXCLUDED.margin_compression_threshold,
            revenue_decline_threshold = EXCLUDED.revenue_decline_threshold,
            opex_increase_threshold = EXCLUDED.opex_increase_threshold,
            ar_increase_threshold = EXCLUDED.ar_increase_threshold,
            cash_decline_threshold = EXCLUDED.cash_decline_threshold,
            updated_at = CURRENT_TIMESTAMP;
        `, [
          tid,
          thresholds.marginCompressionThreshold ?? 5,
          thresholds.revenueDeclineThreshold ?? 5,
          thresholds.opexIncreaseThreshold ?? 10,
          thresholds.arIncreaseThreshold ?? 15,
          thresholds.cashDeclineThreshold ?? 10
        ]);
        return;
      } catch (e) {
        console.error("Failed to save tenant CFO thresholds in PG:", e);
      }
    }
    const json = readJsonDb();
    if (!(json as any).tenant_cfo_thresholds) (json as any).tenant_cfo_thresholds = [];
    const idx = (json as any).tenant_cfo_thresholds.findIndex((t: any) => t.tenant_id === tid);
    const rec = { tenant_id: tid, ...thresholds, isDefault: false };
    if (idx >= 0) (json as any).tenant_cfo_thresholds[idx] = rec;
    else (json as any).tenant_cfo_thresholds.push(rec);
    writeJsonDb(json);
  },

  // Check Connection Type
  isPostgres: () => isPgConnected,

  checkPgConnection: async (): Promise<boolean> => {
    try {
      await pgPool.query('SELECT 1');
      isPgConnected = true;
      return true;
    } catch (e) {
      console.warn("PostgreSQL live ping check failed:", e);
      isPgConnected = false;
      return false;
    }
  },

  checkPgConnectionDetails: async (): Promise<{ success: boolean; error?: string; code?: string; config?: any }> => {
    try {
      await pgPool.query('SELECT 1');
      isPgConnected = true;
      return { success: true };
    } catch (e: any) {
      console.error("PostgreSQL live ping check failed:", e);
      isPgConnected = false;
      return {
        success: false,
        error: e?.message || String(e),
        code: e?.code || 'UNKNOWN_ERROR',
        config: {
          host: process.env.DB_HOST || '127.0.0.1',
          port: process.env.DB_PORT || '5432',
          user: process.env.DB_USER || 'postgres',
          database: process.env.DB_NAME || 'virtual_cfo',
          hasPassword: !!process.env.DB_PASSWORD,
          passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
        }
      };
    }
  },

  // 1. TENANT OPERATIONS
  getTenants: async (): Promise<any[]> => {
    try {
      const { rows } = await pgPool.query('SELECT * FROM tenants ORDER BY id ASC');
      return rows;
    } catch (e) {
      console.error("PostgreSQL getTenants query failed:", e);
      return [];
    }
  },
 
  createTenant: async (name: string): Promise<any> => {
    if (isPgConnected) {
      try {
        await pgPool.query("SELECT setval('tenants_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 0), 1) FROM tenants));").catch(() => {});
        const { rows } = await pgPool.query(
          'INSERT INTO tenants (name) VALUES ($1) RETURNING *',
          [name]
        );
        return rows[0];
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const newId = json.tenants.length > 0 ? Math.max(...json.tenants.map(t => t.id)) + 1 : 1;
    const newTenant = { id: newId, name, created_at: new Date().toISOString() };
    json.tenants.push(newTenant);
    writeJsonDb(json);
    return newTenant;
  },
 
  updateTenantName: async (id: number, name: string): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('UPDATE tenants SET name = $1 WHERE id = $2', [name, id]);
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const t = json.tenants.find(x => x.id === id);
    if (t) {
      t.name = name;
      writeJsonDb(json);
    }
  },

  // TENANT ACCOUNT MAPPINGS OPERATIONS (Phase 1 Foundation)
  getAccountMappings: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM tenant_account_mappings WHERE tenant_id = $1 AND active = TRUE ORDER BY account_code ASC',
          [tenantId]
        );
        return rows;
      } catch (e) {
        console.error("PostgreSQL getAccountMappings query failed:", e);
        return [];
      }
    }
    const json = readJsonDb();
    const mappings = json.tenant_account_mappings || [];
    return mappings.filter((m: any) => m.tenant_id === tenantId && m.active !== false);
  },

  getAccountMapping: async (tenantId: number, sourceAccountId: string, source: string = 'xero'): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM tenant_account_mappings WHERE tenant_id = $1 AND source = $2 AND source_account_id = $3',
          [tenantId, source, sourceAccountId]
        );
        return rows[0] || null;
      } catch (e) {
        console.error("PostgreSQL getAccountMapping query failed:", e);
        return null;
      }
    }
    const json = readJsonDb();
    const mappings = json.tenant_account_mappings || [];
    return mappings.find((m: any) => m.tenant_id === tenantId && m.source === source && m.source_account_id === sourceAccountId) || null;
  },

  saveAccountMapping: async (mapping: any): Promise<any> => {
    const {
      tenant_id,
      source = 'xero',
      source_account_id,
      account_code,
      account_name,
      source_account_type,
      source_account_class,
      financial_statement_category,
      subcategory,
      cfo_analytical_tag,
      status = 'SUGGESTED',
      confidence_score = 0.00,
      user_confirmed = mapping.user_confirmed !== undefined ? mapping.user_confirmed : (mapping.status === 'CONFIRMED' || mapping.status === 'CUSTOM_OVERRIDE'),
      active = true
    } = mapping;

    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          `INSERT INTO tenant_account_mappings 
            (tenant_id, source, source_account_id, account_code, account_name, source_account_type, source_account_class, financial_statement_category, subcategory, cfo_analytical_tag, status, confidence_score, user_confirmed, active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
           ON CONFLICT (tenant_id, source, source_account_id) DO UPDATE SET
            account_code = EXCLUDED.account_code,
            account_name = EXCLUDED.account_name,
            source_account_type = EXCLUDED.source_account_type,
            source_account_class = EXCLUDED.source_account_class,
            financial_statement_category = CASE WHEN tenant_account_mappings.user_confirmed = TRUE THEN tenant_account_mappings.financial_statement_category ELSE EXCLUDED.financial_statement_category END,
            subcategory = CASE WHEN tenant_account_mappings.user_confirmed = TRUE THEN tenant_account_mappings.subcategory ELSE EXCLUDED.subcategory END,
            cfo_analytical_tag = CASE WHEN tenant_account_mappings.user_confirmed = TRUE THEN tenant_account_mappings.cfo_analytical_tag ELSE EXCLUDED.cfo_analytical_tag END,
            status = CASE WHEN tenant_account_mappings.user_confirmed = TRUE THEN tenant_account_mappings.status ELSE EXCLUDED.status END,
            confidence_score = EXCLUDED.confidence_score,
            active = EXCLUDED.active,
            updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [tenant_id, source, source_account_id, account_code, account_name, source_account_type, source_account_class, financial_statement_category, subcategory, cfo_analytical_tag, status, confidence_score, user_confirmed, active]
        );
        return rows[0];
      } catch (e) {
        console.error("PostgreSQL saveAccountMapping query failed:", e);
      }
    }

    const json = readJsonDb();
    if (!json.tenant_account_mappings) json.tenant_account_mappings = [];
    let existingIdx = json.tenant_account_mappings.findIndex((m: any) => m.tenant_id === tenant_id && m.source === source && m.source_account_id === source_account_id);
    let record: any;
    if (existingIdx >= 0) {
      record = { ...json.tenant_account_mappings[existingIdx] };
      if (!record.user_confirmed) {
        record = {
          ...record,
          account_code,
          account_name,
          source_account_type,
          source_account_class,
          financial_statement_category,
          subcategory,
          cfo_analytical_tag,
          status,
          confidence_score,
          active,
          updated_at: new Date().toISOString()
        };
      }
      json.tenant_account_mappings[existingIdx] = record;
    } else {
      record = {
        id: json.tenant_account_mappings.length + 1,
        tenant_id,
        source,
        source_account_id,
        account_code,
        account_name,
        source_account_type,
        source_account_class,
        financial_statement_category,
        subcategory,
        cfo_analytical_tag,
        status,
        confidence_score,
        user_confirmed,
        active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      json.tenant_account_mappings.push(record);
    }
    writeJsonDb(json);
    return record;
  },

  confirmAccountMapping: async (tenantId: number, mappingId: number | string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          `UPDATE tenant_account_mappings 
           SET status = 'CONFIRMED', user_confirmed = TRUE, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1 AND tenant_id = $2 
           RETURNING *`,
          [mappingId, tenantId]
        );
        return rows[0] || null;
      } catch (e) {
        console.error("PostgreSQL confirmAccountMapping query failed:", e);
        return null;
      }
    }
    const json = readJsonDb();
    if (!json.tenant_account_mappings) return null;
    const m = json.tenant_account_mappings.find((x: any) => x.id === mappingId && x.tenant_id === tenantId);
    if (m) {
      m.status = 'CONFIRMED';
      m.user_confirmed = true;
      m.updated_at = new Date().toISOString();
      writeJsonDb(json);
      return m;
    }
    return null;
  },

  overrideAccountMapping: async (tenantId: number, mappingId: number | string, updates: any): Promise<any | null> => {
    const { financial_statement_category, subcategory, cfo_analytical_tag } = updates;
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          `UPDATE tenant_account_mappings 
           SET financial_statement_category = COALESCE($1, financial_statement_category),
               subcategory = COALESCE($2, subcategory),
               cfo_analytical_tag = COALESCE($3, cfo_analytical_tag),
               status = 'CUSTOM_OVERRIDE',
               user_confirmed = TRUE,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $4 AND tenant_id = $5 
           RETURNING *`,
          [financial_statement_category, subcategory, cfo_analytical_tag, mappingId, tenantId]
        );
        return rows[0] || null;
      } catch (e) {
        console.error("PostgreSQL overrideAccountMapping query failed:", e);
        return null;
      }
    }
    const json = readJsonDb();
    if (!json.tenant_account_mappings) return null;
    const m = json.tenant_account_mappings.find((x: any) => x.id === mappingId && x.tenant_id === tenantId);
    if (m) {
      if (financial_statement_category) m.financial_statement_category = financial_statement_category;
      if (subcategory) m.subcategory = subcategory;
      if (cfo_analytical_tag !== undefined) m.cfo_analytical_tag = cfo_analytical_tag;
      m.status = 'CUSTOM_OVERRIDE';
      m.user_confirmed = true;
      m.updated_at = new Date().toISOString();
      writeJsonDb(json);
      return m;
    }
    return null;
  },

  getTenantEngineMode: async (tenantId: number): Promise<'LEGACY' | 'SHADOW' | 'CANONICAL'> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT engine_mode FROM tenant_engine_settings WHERE tenant_id = $1',
          [tenantId]
        );
        if (rows[0] && rows[0].engine_mode) {
          return rows[0].engine_mode as any;
        }
      } catch (e) {
        console.error("PostgreSQL getTenantEngineMode query failed:", e);
      }
    }
    const json: any = readJsonDb();
    if (json.tenant_engine_settings) {
      const rec = json.tenant_engine_settings.find((x: any) => x.tenant_id === tenantId);
      if (rec && rec.engine_mode) return rec.engine_mode;
    }
    return 'LEGACY';
  },

  saveTenantEngineMode: async (tenantId: number, mode: 'LEGACY' | 'SHADOW' | 'CANONICAL'): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [tenantId, `Tenant ${tenantId}`]
        );
        await pgPool.query(
          `INSERT INTO tenant_engine_settings (tenant_id, engine_mode, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (tenant_id) DO UPDATE SET engine_mode = $2, updated_at = CURRENT_TIMESTAMP`,
          [tenantId, mode]
        );
        return;
      } catch (e) {
        console.error("PostgreSQL saveTenantEngineMode query failed:", e);
      }
    }
    const json: any = readJsonDb();
    if (!json.tenant_engine_settings) json.tenant_engine_settings = [];
    const idx = json.tenant_engine_settings.findIndex((x: any) => x.tenant_id === tenantId);
    if (idx >= 0) json.tenant_engine_settings[idx].engine_mode = mode;
    else json.tenant_engine_settings.push({ tenant_id: tenantId, engine_mode: mode });
    writeJsonDb(json);
  },
 
  // 2. CREDENTIAL OPERATIONS
  getCredentials: async (tenantId: number, provider: string): Promise<any> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM tenant_credentials WHERE tenant_id = $1 AND provider = $2',
          [tenantId, provider]
        );
        return rows[0] || null;
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return json.tenant_credentials.find(c => c.tenant_id === tenantId && c.provider === provider) || null;
  },
 
  saveCredentials: async (tenantId: number, provider: string, fields: {
    client_id?: string;
    client_secret?: string;
    tenant_identifier?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: Date | string;
    scopes?: string[];
    last_synced_at?: Date | string;
  }): Promise<void> => {
    // If client_id is changing, clear old tokens and tenant_identifier
    if (fields.client_id) {
      try {
        const existing = await db.getCredentials(tenantId, provider);
        if (existing && existing.client_id && fields.client_id !== existing.client_id) {
          if (isPgConnected) {
            await pgPool.query(
              `UPDATE tenant_credentials SET access_token = NULL, refresh_token = NULL, expires_at = NULL, tenant_identifier = NULL WHERE tenant_id = $1 AND provider = $2`,
              [tenantId, provider]
            );
          }
        }
      } catch (err) {
        console.error('Failed to check existing client_id on change:', err);
      }
    }

    // If the tenant_identifier (Xero Org ID) is changing, auto-clear old cached records
    if (fields.tenant_identifier) {
      try {
        const existing = await db.getCredentials(tenantId, provider);
        if (existing && existing.tenant_identifier && fields.tenant_identifier !== existing.tenant_identifier) {
          await db.clearCachedRecords(tenantId);
        }
      } catch (err) {
        console.error('Failed to auto-clear cache on tenant identifier change:', err);
      }
    }

    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO tenant_credentials (tenant_id, provider, client_id, client_secret, tenant_identifier, access_token, refresh_token, expires_at, scopes, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (tenant_id, provider) 
           DO UPDATE SET 
             client_id = COALESCE($3, tenant_credentials.client_id),
             client_secret = COALESCE($4, tenant_credentials.client_secret),
             tenant_identifier = COALESCE($5, tenant_credentials.tenant_identifier),
             access_token = COALESCE($6, tenant_credentials.access_token),
             refresh_token = COALESCE($7, tenant_credentials.refresh_token),
             expires_at = COALESCE($8, tenant_credentials.expires_at),
             scopes = COALESCE($9, tenant_credentials.scopes),
             last_synced_at = COALESCE($10, tenant_credentials.last_synced_at)`,
          [
            tenantId,
            provider,
            fields.client_id || null,
            fields.client_secret || null,
            fields.tenant_identifier || null,
            fields.access_token || null,
            fields.refresh_token || null,
            fields.expires_at || null,
            fields.scopes || null,
            fields.last_synced_at || null
          ]
        );
        return;
      } catch (e) {
        console.error('PostgreSQL saveCredentials error:', e);
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const idx = json.tenant_credentials.findIndex(c => c.tenant_id === tenantId && c.provider === provider);
    const existing = idx >= 0 ? json.tenant_credentials[idx] : {};
    const updated = {
      tenant_id: tenantId,
      provider,
      client_id: fields.client_id !== undefined ? fields.client_id : existing.client_id,
      client_secret: fields.client_secret !== undefined ? fields.client_secret : existing.client_secret,
      tenant_identifier: fields.tenant_identifier !== undefined ? fields.tenant_identifier : existing.tenant_identifier,
      access_token: fields.access_token !== undefined ? fields.access_token : existing.access_token,
      refresh_token: fields.refresh_token !== undefined ? fields.refresh_token : existing.refresh_token,
      expires_at: fields.expires_at !== undefined ? fields.expires_at : existing.expires_at,
      scopes: fields.scopes !== undefined ? fields.scopes : existing.scopes,
      last_synced_at: fields.last_synced_at !== undefined ? fields.last_synced_at : existing.last_synced_at
    };
    if (idx >= 0) {
      json.tenant_credentials[idx] = updated;
    } else {
      json.tenant_credentials.push(updated);
    }
    writeJsonDb(json);
  },
 
  deleteCredentials: async (tenantId: number, provider: string): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(
          'DELETE FROM tenant_credentials WHERE tenant_id = $1 AND provider = $2',
          [tenantId, provider]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    json.tenant_credentials = json.tenant_credentials.filter(c => !(c.tenant_id === tenantId && c.provider === provider));
    writeJsonDb(json);
  },
 
  // 3. CACHE SCHEMA STATISTICS
  getSyncCounts: async (tenantId: number): Promise<any> => {
    if (isPgConnected) {
      try {
        const contacts = await pgPool.query('SELECT COUNT(*) FROM contacts WHERE tenant_id = $1', [tenantId]);
        const invoices = await pgPool.query('SELECT COUNT(*) FROM invoices WHERE tenant_id = $1', [tenantId]);
        const payments = await pgPool.query('SELECT COUNT(*) FROM payments WHERE tenant_id = $1', [tenantId]);
        const accounts = await pgPool.query('SELECT COUNT(*) FROM accounts WHERE tenant_id = $1', [tenantId]);
        // Bank transactions, prepayments, overpayments stored in reports table as JSON
        const bankTxns = await db.getReport(tenantId, 'BankTransactions');
        const prepays = await db.getReport(tenantId, 'Prepayments');
        const overpays = await db.getReport(tenantId, 'Overpayments');
        return {
          contacts: parseInt(contacts.rows[0].count),
          invoices: parseInt(invoices.rows[0].count),
          payments: parseInt(payments.rows[0].count),
          accounts: parseInt(accounts.rows[0].count),
          bankTransactions: Array.isArray(bankTxns) ? bankTxns.length : 0,
          prepayments: Array.isArray(prepays) ? prepays.length : 0,
          overpayments: Array.isArray(overpays) ? overpays.length : 0
        };
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return {
      contacts: json.contacts.filter(x => x.tenant_id === tenantId).length,
      invoices: json.invoices.filter(x => x.tenant_id === tenantId).length,
      payments: json.payments.filter(x => x.tenant_id === tenantId).length,
      accounts: json.accounts.filter(x => x.tenant_id === tenantId).length,
      bankTransactions: (json.bank_transactions || []).filter(x => x.tenant_id === tenantId).length,
      prepayments: (json.prepayments || []).filter(x => x.tenant_id === tenantId).length,
      overpayments: (json.overpayments || []).filter(x => x.tenant_id === tenantId).length
    };
  },
 
  saveInvoices: async (tenantId: number, records: any[]): Promise<void> => {
    return await db.saveCachedRecords(tenantId, 'invoices', records);
  },

  saveCachedRecords: async (tenantId: number, type: 'invoices' | 'contacts' | 'payments' | 'accounts', records: any[]): Promise<void> => {
    if (isPgConnected) {
      try {
        // Clear old cache first
        await pgPool.query(`DELETE FROM ${type} WHERE tenant_id = $1`, [tenantId]);
        
        // Batch insert
        for (const item of records) {
          if (type === 'contacts') {
            await pgPool.query(
              'INSERT INTO contacts (tenant_id, external_id, name, email) VALUES ($1, $2, $3, $4)',
              [tenantId, item.ContactID || item.contact_id || null, item.Name || item.name || null, item.EmailAddress || item.email || null]
            );
          } else if (type === 'invoices') {
            await pgPool.query(
              'INSERT INTO invoices (tenant_id, external_id, invoice_number, reference, type, status, total, amount_due, amount_paid, currency, invoice_date, contact_name, due_date, line_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
              [
                tenantId,
                item.InvoiceID || item.invoice_id || null,
                item.InvoiceNumber || item.invoice_number || null,
                item.Reference || item.reference || null,
                item.Type || item.type || null,
                item.Status || item.status || null,
                item.Total || item.total || 0,
                item.AmountDue || item.amount_due || 0,
                item.AmountPaid || item.amount_paid || 0,
                item.CurrencyCode || item.currency || null,
                parseXeroDate(item.Date || item.date),
                item.Contact?.Name || item.contactName || item.contact_name || item.contact_id || null,
                parseXeroDate(item.DueDate || item.due_date),
                JSON.stringify(item.LineItems || item.line_items || [])
              ]
            );
          } else if (type === 'payments') {
            await pgPool.query(
              'INSERT INTO payments (tenant_id, external_id, amount, payment_type, status, payment_date, invoice_id, invoice_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
              [
                tenantId,
                item.PaymentID || item.payment_id || null,
                item.Amount || item.amount || 0,
                item.PaymentType || item.payment_type || null,
                item.Status || item.status || null,
                item.Date || item.date ? parseXeroDate(item.Date || item.date) : null,
                item.Invoice?.InvoiceID || item.invoice_id || null,
                item.Invoice?.Type || item.invoice_type || null
              ]
            );
          } else if (type === 'accounts') {
            await pgPool.query(
              'INSERT INTO accounts (tenant_id, external_id, account_id, name, code, type, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [
                tenantId,
                item.AccountID || item.account_id || null,
                item.account_id || item.AccountID || null,
                item.Name || item.name || null,
                item.Code || item.code || null,
                item.Type || item.type || null,
                item.Status || item.status || 'ACTIVE'
              ]
            );
          }
        }
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    
    const json = readJsonDb();
    // Clear old elements
    json[type] = json[type].filter(x => x.tenant_id !== tenantId);
    
    // Add new elements
    for (const item of records) {
      json[type].push({ tenant_id: tenantId, ...item });
    }
    writeJsonDb(json);
  },

  clearDerivedCaches: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM fixed_assets_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM budgets_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM tax_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM gl_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM inventory_cache WHERE tenant_id = $1', [tenantId]);
        return;
      } catch (e) {
        console.error("Database query failed in clearDerivedCaches:", e);
        throw e;
      }
    }
    const json = readJsonDb();
    json.fixed_assets_cache = (json.fixed_assets_cache || []).filter(x => x.tenant_id !== tenantId);
    json.budgets_cache = (json.budgets_cache || []).filter(x => x.tenant_id !== tenantId);
    json.tax_cache = (json.tax_cache || []).filter(x => x.tenant_id !== tenantId);
    json.gl_cache = (json.gl_cache || []).filter(x => x.tenant_id !== tenantId);
    json.inventory_cache = (json.inventory_cache || []).filter(x => x.tenant_id !== tenantId);
    writeJsonDb(json);
  },
 
  clearCachedRecords: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM contacts WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM invoices WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM payments WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM accounts WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM reports WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM inventory_items WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM fixed_assets WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM fixed_assets_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM budgets_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM tax_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM gl_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM inventory_cache WHERE tenant_id = $1', [tenantId]);
        await pgPool.query('DELETE FROM inventory_sales_history WHERE tenant_id = $1', [tenantId]);
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    json.contacts = json.contacts.filter(x => x.tenant_id !== tenantId);
    json.invoices = json.invoices.filter(x => x.tenant_id !== tenantId);
    json.payments = json.payments.filter(x => x.tenant_id !== tenantId);
    json.accounts = json.accounts.filter(x => x.tenant_id !== tenantId);
    json.reports = json.reports.filter(x => x.tenant_id !== tenantId);
    json.inventory_items = (json.inventory_items || []).filter(x => x.tenant_id !== tenantId);
    json.bank_transactions = (json.bank_transactions || []).filter(x => x.tenant_id !== tenantId);
    json.prepayments = (json.prepayments || []).filter(x => x.tenant_id !== tenantId);
    json.overpayments = (json.overpayments || []).filter(x => x.tenant_id !== tenantId);
    json.fixed_assets = (json.fixed_assets || []).filter(x => x.tenant_id !== tenantId);
    json.fixed_assets_cache = (json.fixed_assets_cache || []).filter(x => x.tenant_id !== tenantId);
    json.budgets_cache = (json.budgets_cache || []).filter(x => x.tenant_id !== tenantId);
    json.tax_cache = (json.tax_cache || []).filter(x => x.tenant_id !== tenantId);
    json.gl_cache = (json.gl_cache || []).filter(x => x.tenant_id !== tenantId);
    json.inventory_cache = (json.inventory_cache || []).filter(x => x.tenant_id !== tenantId);
    json.inventory_sales_history = (json.inventory_sales_history || []).filter(x => x.tenant_id !== tenantId);
    writeJsonDb(json);
  },
 
  getInvoices: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(`
          SELECT i.*, 
                 json_agg(
                   json_build_object(
                     'PaymentID', p.external_id,
                     'Amount', p.amount,
                     'Date', p.payment_date,
                     'Status', p.status
                   )
                 ) FILTER (WHERE p.id IS NOT NULL) as payments
          FROM invoices i
          LEFT JOIN payments p ON p.invoice_id = i.external_id AND p.tenant_id = i.tenant_id
          WHERE i.tenant_id = $1
          GROUP BY i.id
        `, [tenantId]);
        if (rows.length > 0) {
          return rows.map(r => ({
            ...r,
            InvoiceID: r.external_id,
            InvoiceNumber: r.invoice_number,
            Reference: r.reference || r.invoice_number,
            Type: r.type,
            Status: r.status,
            Total: parseFloat(r.total || 0),
            AmountDue: parseFloat(r.amount_due || 0),
            AmountPaid: parseFloat(r.amount_paid || 0),
            CurrencyCode: r.currency,
            Date: r.invoice_date,
            ContactName: r.contact_name,
            DueDate: r.due_date,
            LineItems: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : (r.line_items || []),
            Payments: r.payments || [],
            FullyPaidOnDate: (r.payments && r.payments.length > 0) ? r.payments[0].Date : null
          }));
        }
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return json.invoices.filter(x => x.tenant_id === tenantId).map(inv => ({
      ...inv,
      ContactName: inv.Contact?.Name || inv.ContactName || null,
      DueDate: inv.DueDate
    }));
  },

  getPayments: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM payments WHERE tenant_id = $1', [tenantId]);
        if (rows.length > 0) {
          return rows.map(r => ({
            ...r,
            PaymentID: r.external_id,
            Amount: parseFloat(r.amount || 0),
            PaymentType: r.payment_type,
            Status: r.status,
            Date: r.payment_date || r.created_at,
            Invoice: r.invoice_id ? {
              InvoiceID: r.invoice_id,
              Type: r.invoice_type
            } : null
          }));
        }
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return json.payments.filter(x => x.tenant_id === tenantId);
  },

    // ── Cash Flow Source Getters ──────────────────────────────────────
  // BankTransactions, Prepayments, and Overpayments are stored as JSON arrays.
  // In PG mode: stored in the `reports` table with report_type keys.
  // In JSON mode: stored in dedicated top-level arrays in db.json.eport_type keys.
  // In JSON mode: stored in dedicated top-level arrays in db.json.

  getBankTransactions: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const data = await db.getReport(tenantId, 'BankTransactions');
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return (json.bank_transactions || []).filter(x => x.tenant_id === tenantId);
  },

  getContacts: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM contacts WHERE tenant_id = $1', [tenantId]);
        if (rows.length > 0) {
          return rows.map(r => ({
            ...r,
            contactId: r.external_id || String(r.id),
            ContactID: r.external_id || String(r.id),
            name: r.name,
            Name: r.name,
            isCustomer: r.is_customer !== false,
            isSupplier: r.is_supplier === true,
            email: r.email || '',
            phone: r.phone || ''
          }));
        }
      } catch (e) {
        console.error("Database query failed in getContacts:", e);
      }
    }
    const report = await db.getReport(tenantId, 'Contacts');
    if (report && Array.isArray(report) && report.length > 0) {
      return report.map(c => ({
        ...c,
        contactId: c.ContactID || c.contact_id || c.id,
        ContactID: c.ContactID || c.contact_id || c.id,
        name: c.Name || c.name || '',
        Name: c.Name || c.name || '',
        isCustomer: c.IsCustomer !== false,
        isSupplier: c.IsSupplier === true,
        email: c.EmailAddress || c.email || '',
        phone: c.Phones?.[0]?.PhoneNumber || c.phone || ''
      }));
    }
    const json = readJsonDb();
    const jsonContacts = (json.contacts || []).filter(x => x.tenant_id === tenantId);
    if (jsonContacts.length > 0) return jsonContacts;

    // Fallback: build contacts list from invoices
    const invoices = await db.getInvoices(tenantId);
    const contactMap = new Map<string, any>();
    for (const inv of invoices) {
      const cName = inv.ContactName || inv.contact_name || inv.Contact?.Name;
      if (cName && !contactMap.has(cName)) {
        contactMap.set(cName, {
          contactId: 'c_' + Math.abs(cName.split('').reduce((a: number, b: string)=>{a=((a<<5)-a)+b.charCodeAt(0);return a|0},0)),
          ContactID: 'c_' + Math.abs(cName.split('').reduce((a: number, b: string)=>{a=((a<<5)-a)+b.charCodeAt(0);return a|0},0)),
          name: cName,
          Name: cName,
          isCustomer: inv.Type === 'ACCREC' || inv.type === 'ACCREC',
          isSupplier: inv.Type === 'ACCPAY' || inv.type === 'ACCPAY',
          email: '',
          phone: ''
        });
      }
    }
    return Array.from(contactMap.values());
  },

  getPrepayments: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const data = await db.getReport(tenantId, 'Prepayments');
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return (json.prepayments || []).filter(x => x.tenant_id === tenantId);
  },

  getOverpayments: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const data = await db.getReport(tenantId, 'Overpayments');
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return (json.overpayments || []).filter(x => x.tenant_id === tenantId);
  },
 
  getReport: async (tenantId: number, reportType: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT raw_data FROM reports WHERE tenant_id = $1 AND (report_type = $2 OR report_type LIKE $3) ORDER BY CASE WHEN report_type = $2 THEN 0 ELSE 1 END, updated_at DESC LIMIT 1',
          [tenantId, reportType, `${reportType}%`]
        );
        if (rows[0] && rows[0].raw_data) {
          return rows[0].raw_data;
        }
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    const tenantReports = json.reports.filter(r => r.tenant_id === tenantId);
    const item = tenantReports.find(r => r.report_type === reportType)
      || tenantReports.filter(r => r.report_type.startsWith(reportType)).sort((a, b) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      )[0];
    return item ? item.raw_data : null;
  },

  createUser: async (email: string, passwordHash: string, tenantId: number, role = 'Finance Manager'): Promise<any> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'INSERT INTO users (email, password_hash, tenant_id, role) VALUES ($1, $2, $3, $4) RETURNING *',
          [email, passwordHash, tenantId, role]
        );
        return rows[0];
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const newId = json.users.length > 0 ? Math.max(...json.users.map(u => u.id)) + 1 : 1;
    const newUser = { id: newId, email, password_hash: passwordHash, tenant_id: tenantId, role, created_at: new Date().toISOString() };
    json.users.push(newUser);
    writeJsonDb(json);
    return newUser;
  },

  getUserByEmail: async (email: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        return rows[0] || null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    return json.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  createSession: async (userId: number, token: string, expiresAt: Date | string): Promise<any> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'INSERT INTO sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3) RETURNING *',
          [userId, token, expiresAt]
        );
        return rows[0];
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const newId = json.sessions.length > 0 ? Math.max(...json.sessions.map(s => s.id)) + 1 : 1;
    const newSession = { id: newId, user_id: userId, session_token: token, expires_at: new Date(expiresAt).toISOString(), created_at: new Date().toISOString() };
    json.sessions.push(newSession);
    writeJsonDb(json);
    return newSession;
  },

  getSession: async (token: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          `SELECT s.*, u.email, u.tenant_id, u.role
           FROM sessions s 
           JOIN users u ON s.user_id = u.id 
           WHERE s.session_token = $1 AND s.expires_at > NOW()`,
          [token]
        );
        return rows[0] || null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const session = json.sessions.find(s => s.session_token === token);
    if (!session) return null;
    
    // Check expiration
    if (new Date(session.expires_at) <= new Date()) {
      json.sessions = json.sessions.filter(s => s.session_token !== token);
      writeJsonDb(json);
      return null;
    }

    const user = json.users.find(u => u.id === session.user_id);
    if (!user) return null;

    return {
      ...session,
      email: user.email,
      tenant_id: user.tenant_id
    };
  },

  deleteSession: async (token: string): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM sessions WHERE session_token = $1', [token]);
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    json.sessions = json.sessions.filter(s => s.session_token !== token);
    writeJsonDb(json);
  },

  // 9. INVENTORY OPERATIONS
  saveInventoryItems: async (tenantId: number, items: any[]): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM inventory_items WHERE tenant_id = $1', [tenantId]);
        for (const item of items) {
          await pgPool.query(
            `INSERT INTO inventory_items (tenant_id, item_id, code, name, is_tracked_as_inventory, quantity_on_hand, unit_price, raw_data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              tenantId,
              item.ItemID,
              item.Code,
              item.Name || null,
              item.IsTrackedAsInventory === true,
              item.QuantityOnHand !== undefined && item.QuantityOnHand !== null ? parseFloat(item.QuantityOnHand) : null,
              item.PurchaseDetails?.UnitPrice !== undefined && item.PurchaseDetails?.UnitPrice !== null ? parseFloat(item.PurchaseDetails.UnitPrice) : null,
              JSON.stringify(item)
            ]
          );
        }
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.inventory_items) json.inventory_items = [];
    json.inventory_items = json.inventory_items.filter(x => x.tenant_id !== tenantId);
    for (const item of items) {
      json.inventory_items.push({
        tenant_id: tenantId,
        item_id: item.ItemID,
        code: item.Code,
        name: item.Name || null,
        is_tracked_as_inventory: item.IsTrackedAsInventory === true,
        quantity_on_hand: item.QuantityOnHand !== undefined && item.QuantityOnHand !== null ? parseFloat(item.QuantityOnHand) : null,
        unit_price: item.PurchaseDetails?.UnitPrice !== undefined && item.PurchaseDetails?.UnitPrice !== null ? parseFloat(item.PurchaseDetails.UnitPrice) : null,
        raw_data: item,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getInventoryItems: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM inventory_items WHERE tenant_id = $1', [tenantId]);
        return rows.map(r => ({
          ...r,
          IsTrackedAsInventory: r.is_tracked_as_inventory,
          QuantityOnHand: r.quantity_on_hand,
          PurchaseDetails: { UnitPrice: r.unit_price },
          ItemID: r.item_id,
          Code: r.code,
          Name: r.name
        }));
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    return (json.inventory_items || [])
      .filter(x => x.tenant_id === tenantId)
      .map(r => ({
        ...r,
        IsTrackedAsInventory: r.is_tracked_as_inventory,
        QuantityOnHand: r.quantity_on_hand,
        PurchaseDetails: { UnitPrice: r.unit_price },
        ItemID: r.item_id,
        Code: r.code,
        Name: r.name
      }));
  },

  getThresholds: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM inventory_thresholds WHERE tenant_id = $1', [tenantId]);
        return rows;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    return (json.inventory_thresholds || []).filter(x => x.tenant_id === tenantId);
  },

  saveThreshold: async (tenantId: number, itemId: string, minimumStock: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO inventory_thresholds (tenant_id, item_id, minimum_stock, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (tenant_id, item_id) 
           DO UPDATE SET minimum_stock = $3, updated_at = NOW()`,
          [tenantId, itemId, minimumStock]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.inventory_thresholds) json.inventory_thresholds = [];
    const idx = json.inventory_thresholds.findIndex(x => x.tenant_id === tenantId && x.item_id === itemId);
    if (idx >= 0) {
      json.inventory_thresholds[idx].minimum_stock = minimumStock;
      json.inventory_thresholds[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.inventory_thresholds.length > 0 ? Math.max(...json.inventory_thresholds.map(x => x.id || 0)) + 1 : 1;
      json.inventory_thresholds.push({
        id: newId,
        tenant_id: tenantId,
        item_id: itemId,
        minimum_stock: minimumStock,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  saveSalesHistory: async (tenantId: number, sales: any[]): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM inventory_sales_history WHERE tenant_id = $1', [tenantId]);
        for (const s of sales) {
          await pgPool.query(
            `INSERT INTO inventory_sales_history (tenant_id, item_id, invoice_id, quantity_sold, sold_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [tenantId, s.item_id, s.invoice_id, s.quantity_sold, s.sold_at]
          );
        }
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.inventory_sales_history) json.inventory_sales_history = [];
    json.inventory_sales_history = json.inventory_sales_history.filter(x => x.tenant_id !== tenantId);
    for (const s of sales) {
      json.inventory_sales_history.push({
        tenant_id: tenantId,
        item_id: s.item_id,
        invoice_id: s.invoice_id,
        quantity_sold: s.quantity_sold,
        sold_at: s.sold_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getSalesHistory: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM inventory_sales_history WHERE tenant_id = $1', [tenantId]);
        return rows;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    return (json.inventory_sales_history || []).filter(x => x.tenant_id === tenantId);
  },

  saveInventoryCache: async (tenantId: number, key: string, value: any, expiresSeconds: number): Promise<void> => {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO inventory_cache (tenant_id, cache_key, cache_value, expires_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, cache_key)
           DO UPDATE SET cache_value = $3, expires_at = $4, updated_at = NOW()`,
          [tenantId, key, JSON.stringify(value), expiresAt]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.inventory_cache) json.inventory_cache = [];
    const idx = json.inventory_cache.findIndex(x => x.tenant_id === tenantId && x.cache_key === key);
    if (idx >= 0) {
      json.inventory_cache[idx].cache_value = value;
      json.inventory_cache[idx].expires_at = expiresAt;
      json.inventory_cache[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.inventory_cache.length > 0 ? Math.max(...json.inventory_cache.map(x => x.id || 0)) + 1 : 1;
      json.inventory_cache.push({
        id: newId,
        tenant_id: tenantId,
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getInventoryCache: async (tenantId: number, key: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM inventory_cache WHERE tenant_id = $1 AND cache_key = $2 AND expires_at > NOW()',
          [tenantId, key]
        );
        return rows[0] ? (typeof rows[0].cache_value === 'string' ? JSON.parse(rows[0].cache_value) : rows[0].cache_value) : null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const cached = (json.inventory_cache || []).find(
      x => x.tenant_id === tenantId && x.cache_key === key && new Date(x.expires_at) > new Date()
    );
    return cached ? cached.cache_value : null;
  },

  saveFixedAssets: async (tenantId: number, assets: any[]): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM fixed_assets WHERE tenant_id = $1', [tenantId]);
        for (const asset of assets) {
          await pgPool.query(
            `INSERT INTO fixed_assets (tenant_id, external_id, name, asset_number, status, purchase_date, purchase_price, accumulated_depreciation, book_value, raw_data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [
              tenantId,
              asset.external_id,
              asset.name,
              asset.asset_number || null,
              asset.status,
              asset.purchase_date || null,
              asset.purchase_price || 0,
              asset.accumulated_depreciation || 0,
              asset.book_value || 0,
              JSON.stringify(asset.raw_data)
            ]
          );
        }
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.fixed_assets) json.fixed_assets = [];
    json.fixed_assets = json.fixed_assets.filter(x => x.tenant_id !== tenantId);
    for (const asset of assets) {
      json.fixed_assets.push({
        tenant_id: tenantId,
        ...asset,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getFixedAssets: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query('SELECT * FROM fixed_assets WHERE tenant_id = $1', [tenantId]);
        return rows.map(r => ({
          tenant_id: r.tenant_id,
          external_id: r.external_id,
          name: r.name,
          asset_number: r.asset_number,
          status: r.status,
          purchase_date: r.purchase_date,
          purchase_price: parseFloat(r.purchase_price || 0),
          accumulated_depreciation: parseFloat(r.accumulated_depreciation || 0),
          book_value: parseFloat(r.book_value || 0),
          raw_data: typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data
        }));
      } catch (e) {
        console.error("Database query failed, falling back to JSON DB:", e);
        isPgConnected = false;
      }
    }
    const json = readJsonDb();
    return (json.fixed_assets || [])
      .filter(x => x.tenant_id === tenantId)
      .map(r => ({
        tenant_id: r.tenant_id,
        external_id: r.external_id,
        name: r.name,
        asset_number: r.asset_number,
        status: r.status,
        purchase_date: r.purchase_date,
        purchase_price: parseFloat(r.purchase_price || 0),
        accumulated_depreciation: parseFloat(r.accumulated_depreciation || 0),
        book_value: parseFloat(r.book_value || 0),
        raw_data: r.raw_data
      }));
  },

  saveFixedAssetsCache: async (tenantId: number, key: string, value: any, expiresSeconds: number): Promise<void> => {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO fixed_assets_cache (tenant_id, cache_key, cache_value, expires_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, cache_key)
           DO UPDATE SET cache_value = $3, expires_at = $4, updated_at = NOW()`,
          [tenantId, key, JSON.stringify(value), expiresAt]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.fixed_assets_cache) json.fixed_assets_cache = [];
    const idx = json.fixed_assets_cache.findIndex(x => x.tenant_id === tenantId && x.cache_key === key);
    if (idx >= 0) {
      json.fixed_assets_cache[idx].cache_value = value;
      json.fixed_assets_cache[idx].expires_at = expiresAt;
      json.fixed_assets_cache[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.fixed_assets_cache.length > 0 ? Math.max(...json.fixed_assets_cache.map(x => x.id || 0)) + 1 : 1;
      json.fixed_assets_cache.push({
        id: newId,
        tenant_id: tenantId,
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getFixedAssetsCache: async (tenantId: number, key: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM fixed_assets_cache WHERE tenant_id = $1 AND cache_key = $2 AND expires_at > NOW()',
          [tenantId, key]
        );
        return rows[0] ? (typeof rows[0].cache_value === 'string' ? JSON.parse(rows[0].cache_value) : rows[0].cache_value) : null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const cached = (json.fixed_assets_cache || []).find(
      x => x.tenant_id === tenantId && x.cache_key === key && new Date(x.expires_at) > new Date()
    );
    return cached ? cached.cache_value : null;
  },

  saveBudgetsCache: async (tenantId: number, key: string, value: any, expiresSeconds: number): Promise<void> => {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO budgets_cache (tenant_id, cache_key, cache_value, expires_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, cache_key)
           DO UPDATE SET cache_value = $3, expires_at = $4, updated_at = NOW()`,
          [tenantId, key, JSON.stringify(value), expiresAt]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.budgets_cache) json.budgets_cache = [];
    const idx = json.budgets_cache.findIndex(x => x.tenant_id === tenantId && x.cache_key === key);
    if (idx >= 0) {
      json.budgets_cache[idx].cache_value = value;
      json.budgets_cache[idx].expires_at = expiresAt;
      json.budgets_cache[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.budgets_cache.length > 0 ? Math.max(...json.budgets_cache.map(x => x.id || 0)) + 1 : 1;
      json.budgets_cache.push({
        id: newId,
        tenant_id: tenantId,
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getBudgetsCache: async (tenantId: number, key: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM budgets_cache WHERE tenant_id = $1 AND cache_key = $2 AND expires_at > NOW()',
          [tenantId, key]
        );
        return rows[0] ? (typeof rows[0].cache_value === 'string' ? JSON.parse(rows[0].cache_value) : rows[0].cache_value) : null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const cached = (json.budgets_cache || []).find(
      x => x.tenant_id === tenantId && x.cache_key === key && new Date(x.expires_at) > new Date()
    );
    return cached ? cached.cache_value : null;
  },

  saveTaxCache: async (tenantId: number, key: string, value: any, expiresSeconds: number): Promise<void> => {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO tax_cache (tenant_id, cache_key, cache_value, expires_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, cache_key)
           DO UPDATE SET cache_value = $3, expires_at = $4, updated_at = NOW()`,
          [tenantId, key, JSON.stringify(value), expiresAt]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.tax_cache) json.tax_cache = [];
    const idx = json.tax_cache.findIndex(x => x.tenant_id === tenantId && x.cache_key === key);
    if (idx >= 0) {
      json.tax_cache[idx].cache_value = value;
      json.tax_cache[idx].expires_at = expiresAt;
      json.tax_cache[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.tax_cache.length > 0 ? Math.max(...json.tax_cache.map(x => x.id || 0)) + 1 : 1;
      json.tax_cache.push({
        id: newId,
        tenant_id: tenantId,
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getTaxCache: async (tenantId: number, key: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM tax_cache WHERE tenant_id = $1 AND cache_key = $2 AND expires_at > NOW()',
          [tenantId, key]
        );
        return rows[0] ? (typeof rows[0].cache_value === 'string' ? JSON.parse(rows[0].cache_value) : rows[0].cache_value) : null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const cached = (json.tax_cache || []).find(
      x => x.tenant_id === tenantId && x.cache_key === key && new Date(x.expires_at) > new Date()
    );
    return cached ? cached.cache_value : null;
  },

  saveGlCache: async (tenantId: number, key: string, value: any, expiresSeconds: number): Promise<void> => {
    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO gl_cache (tenant_id, cache_key, cache_value, expires_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, cache_key)
           DO UPDATE SET cache_value = $3, expires_at = $4, updated_at = NOW()`,
          [tenantId, key, JSON.stringify(value), expiresAt]
        );
        return;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    if (!json.gl_cache) json.gl_cache = [];
    const idx = json.gl_cache.findIndex(x => x.tenant_id === tenantId && x.cache_key === key);
    if (idx >= 0) {
      json.gl_cache[idx].cache_value = value;
      json.gl_cache[idx].expires_at = expiresAt;
      json.gl_cache[idx].updated_at = new Date().toISOString();
    } else {
      const newId = json.gl_cache.length > 0 ? Math.max(...json.gl_cache.map(x => x.id || 0)) + 1 : 1;
      json.gl_cache.push({
        id: newId,
        tenant_id: tenantId,
        cache_key: key,
        cache_value: value,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
  },

  getGlCache: async (tenantId: number, key: string): Promise<any | null> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT * FROM gl_cache WHERE tenant_id = $1 AND cache_key = $2 AND expires_at > NOW()',
          [tenantId, key]
        );
        return rows[0] ? (typeof rows[0].cache_value === 'string' ? JSON.parse(rows[0].cache_value) : rows[0].cache_value) : null;
      } catch (e) {
        console.error("Database query failed:", e); throw e;
      }
    }
    const json = readJsonDb();
    const cached = (json.gl_cache || []).find(
      x => x.tenant_id === tenantId && x.cache_key === key && new Date(x.expires_at) > new Date()
    );
    return cached ? cached.cache_value : null;
  },

  saveTaxTransactions: async (tenantId: number, txns: any[]): Promise<void> => {
    if (isPgConnected) {
      try {
        for (const txn of txns) {
          await pgPool.query(
            `INSERT INTO tax_transactions (
              tenant_id, xero_transaction_id, transaction_type, source_type, direction,
              date, tax_type, tax_rate_name, tax_rate_percent, taxable_amount, tax_amount,
              status, currency, contact_name, account_code, last_synced_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (tenant_id, xero_transaction_id, tax_type, direction)
            DO UPDATE SET
              transaction_type = $3,
              source_type = $4,
              date = $6,
              tax_rate_name = $8,
              tax_rate_percent = $9,
              taxable_amount = $10,
              tax_amount = $11,
              status = $12,
              currency = $13,
              contact_name = $14,
              account_code = $15,
              last_synced_at = NOW()`,
            [
              tenantId, txn.xero_transaction_id, txn.transaction_type, txn.source_type, txn.direction,
              txn.date, txn.tax_type, txn.tax_rate_name, txn.tax_rate_percent, txn.taxable_amount, txn.tax_amount,
              txn.status, txn.currency, txn.contact_name, txn.account_code
            ]
          );
        }
        return;
      } catch (e) {
        console.error("Database query failed in saveTaxTransactions:", e);
        throw e;
      }
    }
    const json = readJsonDb();
    if (!json.tax_transactions) json.tax_transactions = [];
    for (const txn of txns) {
      const idx = json.tax_transactions.findIndex(
        x => x.tenant_id === tenantId &&
             x.xero_transaction_id === txn.xero_transaction_id &&
             x.tax_type === txn.tax_type &&
             x.direction === txn.direction
      );
      const newRecord = {
        ...txn,
        tenant_id: tenantId,
        last_synced_at: new Date().toISOString()
      };
      if (idx >= 0) {
        json.tax_transactions[idx] = newRecord;
      } else {
        json.tax_transactions.push(newRecord);
      }
    }
    writeJsonDb(json);
  },

  getTaxTransactions: async (tenantId: number, startDate: Date, endDate: Date, filters?: any): Promise<any[]> => {
    if (isPgConnected) {
      try {
        let query = `
          SELECT * FROM tax_transactions 
          WHERE tenant_id = $1 AND date >= $2 AND date <= $3
        `;
        const params: any[] = [tenantId, startDate, endDate];
        let paramIdx = 4;

        if (filters?.taxType && filters.taxType !== 'All Taxes') {
          query += ` AND tax_type ILIKE $${paramIdx}`;
          params.push(`%${filters.taxType}%`);
          paramIdx++;
        }

        query += ` ORDER BY date DESC`;
        const { rows } = await pgPool.query(query, params);
        return rows;
      } catch (e) {
        console.error("Database query failed in getTaxTransactions:", e);
        throw e;
      }
    }
    const json = readJsonDb();
    const list = json.tax_transactions || [];
    return list.filter(x => {
      if (x.tenant_id !== tenantId) return false;
      const d = new Date(x.date);
      if (d < startDate || d > endDate) return false;
      if (filters?.taxType && filters.taxType !== 'All Taxes') {
        if (!x.tax_type.toLowerCase().includes(filters.taxType.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  clearTaxTransactions: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query('DELETE FROM tax_transactions WHERE tenant_id = $1', [tenantId]);
        return;
      } catch (e) {
        console.error("Database query failed in clearTaxTransactions:", e);
        throw e;
      }
    }
    const json = readJsonDb();
    if (json.tax_transactions) {
      json.tax_transactions = json.tax_transactions.filter(x => x.tenant_id !== tenantId);
      writeJsonDb(json);
    }
  },

  clearXeroTokens: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(
          `UPDATE tenant_credentials 
           SET access_token = NULL, refresh_token = NULL, expires_at = NULL, scopes = NULL 
           WHERE tenant_id = $1 AND provider = 'xero'`,
          [tenantId]
        );
      } catch (e) {
        console.error("Database query failed in clearXeroTokens:", e);
        throw e;
      }
    }
    const json = readJsonDb();
    const idx = (json.tenant_credentials || []).findIndex(x => x.tenant_id === tenantId && x.provider === 'xero');
    if (idx >= 0) {
      json.tenant_credentials[idx].access_token = null;
      json.tenant_credentials[idx].refresh_token = null;
      json.tenant_credentials[idx].expires_at = null;
      json.tenant_credentials[idx].scopes = null;
      writeJsonDb(json);
    }
  },

  getAmazonStats: async (tenantId: number): Promise<{ recordsCount: number; ordersCount: number; settlementsCount: number }> => {
    if (isPgConnected) {
      try {
        const { rows: oRows } = await pgPool.query('SELECT COUNT(*) as count FROM amazon_orders WHERE tenant_id = $1', [tenantId]);
        const { rows: sRows } = await pgPool.query('SELECT COUNT(*) as count FROM amazon_settlements WHERE tenant_id = $1', [tenantId]);
        const ordersCount = parseInt(oRows[0]?.count || '0', 10);
        const settlementsCount = parseInt(sRows[0]?.count || '0', 10);
        return {
          recordsCount: ordersCount + settlementsCount,
          ordersCount,
          settlementsCount
        };
      } catch (e) {
        console.error("Database query failed in getAmazonStats:", e);
      }
    }
    return { recordsCount: 0, ordersCount: 0, settlementsCount: 0 };
  },

  clearAmazonTokens: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        // Delete all Amazon data tables for this tenant (order matters for FK constraints)
        await pgPool.query("DELETE FROM amazon_order_items WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_orders WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_settlements WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_product_fee_estimates WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_product_pricing WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_products WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_inventory_alerts WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_inventory WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_sales_metrics WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_inbound_items WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_inbound_shipments WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_outbound_fulfillment_items WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_outbound_fulfillment_orders WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_listing_issues WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_listings_health WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_listing_restrictions WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_product_type_definitions WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_sync_runs WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM amazon_report_jobs WHERE tenant_id = $1", [tenantId]);
        // Finally, remove the Amazon credential itself
        await pgPool.query("DELETE FROM tenant_credentials WHERE tenant_id = $1 AND provider = 'amazon'", [tenantId]);
        console.log(`[clearAmazonTokens] All Amazon data wiped for tenant ${tenantId}`);
      } catch (e) {
        console.error("Database query failed in clearAmazonTokens:", e);
        throw e;
      }
    }
  },

  getEbayStats: async (tenantId: number): Promise<{ recordsCount: number; ordersCount: number; transactionsCount: number }> => {
    if (isPgConnected) {
      try {
        const { rows: oRows } = await pgPool.query('SELECT COUNT(*) as count FROM ebay_orders WHERE tenant_id = $1', [tenantId]);
        const { rows: tRows } = await pgPool.query('SELECT COUNT(*) as count FROM ebay_transactions WHERE tenant_id = $1', [tenantId]);
        const ordersCount = parseInt(oRows[0]?.count || '0', 10);
        const transactionsCount = parseInt(tRows[0]?.count || '0', 10);
        return {
          recordsCount: ordersCount + transactionsCount,
          ordersCount,
          transactionsCount
        };
      } catch (e) {
        console.error("Database query failed in getEbayStats:", e);
      }
    }
    return { recordsCount: 0, ordersCount: 0, transactionsCount: 0 };
  },

  clearEbayTokens: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query("DELETE FROM tenant_credentials WHERE tenant_id = $1 AND provider = 'ebay'", [tenantId]);
        await pgPool.query("DELETE FROM ebay_orders WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM ebay_order_items WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM ebay_transactions WHERE tenant_id = $1", [tenantId]);
      } catch (e) {
        console.error("Database query failed in clearEbayTokens:", e);
        throw e;
      }
    }
  },

  getStripeStats: async (tenantId: number): Promise<{ recordsCount: number; chargesCount: number; customersCount: number; invoicesCount: number; payoutsCount: number }> => {
    if (isPgConnected) {
      try {
        const { rows: chRows } = await pgPool.query('SELECT COUNT(*) as count FROM stripe_charges WHERE tenant_id = $1', [tenantId]);
        const { rows: cuRows } = await pgPool.query('SELECT COUNT(*) as count FROM stripe_customers WHERE tenant_id = $1', [tenantId]);
        const { rows: invRows } = await pgPool.query('SELECT COUNT(*) as count FROM stripe_invoices WHERE tenant_id = $1', [tenantId]);
        const { rows: poRows } = await pgPool.query('SELECT COUNT(*) as count FROM stripe_payouts WHERE tenant_id = $1', [tenantId]);

        const chargesCount = parseInt(chRows[0]?.count || '0', 10);
        const customersCount = parseInt(cuRows[0]?.count || '0', 10);
        const invoicesCount = parseInt(invRows[0]?.count || '0', 10);
        const payoutsCount = parseInt(poRows[0]?.count || '0', 10);

        return {
          recordsCount: chargesCount + customersCount + invoicesCount + payoutsCount,
          chargesCount,
          customersCount,
          invoicesCount,
          payoutsCount
        };
      } catch (e) {
        console.error("Database query failed in getStripeStats:", e);
      }
    }
    return { recordsCount: 0, chargesCount: 0, customersCount: 0, invoicesCount: 0, payoutsCount: 0 };
  },

  clearStripeTokens: async (tenantId: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query("DELETE FROM tenant_credentials WHERE tenant_id = $1 AND provider = 'stripe'", [tenantId]);
        await pgPool.query("DELETE FROM stripe_charges WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM stripe_customers WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM stripe_invoices WHERE tenant_id = $1", [tenantId]);
        await pgPool.query("DELETE FROM stripe_payouts WHERE tenant_id = $1", [tenantId]);
      } catch (e) {
        console.error("Database query failed in clearStripeTokens:", e);
        throw e;
      }
    }
  },
  getContactCreditLimits: async (tenantId: number): Promise<Record<string, { creditLimit: number; creditTermsDays: number; contactName: string }>> => {
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT contact_id, contact_name, credit_limit, credit_terms_days FROM contact_credit_limits WHERE tenant_id = $1',
          [tenantId]
        );
        const map: Record<string, { creditLimit: number; creditTermsDays: number; contactName: string }> = {};
        rows.forEach(r => {
          const rec = {
            creditLimit: parseFloat(r.credit_limit || 0),
            creditTermsDays: parseInt(r.credit_terms_days || 90, 10),
            contactName: r.contact_name
          };
          if (r.contact_id) map[r.contact_id] = rec;
          if (r.contact_name) map[r.contact_name] = rec;
        });
        return map;
      } catch (e) {
        console.error("Database query failed in getContactCreditLimits:", e);
      }
    }
    const json = readJsonDb();
    const list = json.contact_credit_limits || [];
    const map: Record<string, { creditLimit: number; creditTermsDays: number; contactName: string }> = {};
    list.filter((x: any) => x.tenant_id === tenantId).forEach((r: any) => {
      const rec = {
        creditLimit: parseFloat(r.credit_limit || 0),
        creditTermsDays: parseInt(r.credit_terms_days || 90, 10),
        contactName: r.contact_name
      };
      if (r.contact_id) map[r.contact_id] = rec;
      if (r.contact_name) map[r.contact_name] = rec;
    });
    return map;
  },

  saveContactCreditLimit: async (tenantId: number, contactId: string, contactName: string, creditLimit: number, creditTermsDays: number): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO contact_credit_limits (tenant_id, contact_id, contact_name, credit_limit, credit_terms_days, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (tenant_id, contact_id)
           DO UPDATE SET contact_name = $3, credit_limit = $4, credit_terms_days = $5, updated_at = CURRENT_TIMESTAMP`,
          [tenantId, contactId, contactName, creditLimit, creditTermsDays]
        );
        return;
      } catch (e) {
        console.error("Database query failed in saveContactCreditLimit:", e);
      }
    }
    const json = readJsonDb();
    if (!json.contact_credit_limits) json.contact_credit_limits = [];
    const idx = json.contact_credit_limits.findIndex((x: any) => x.tenant_id === tenantId && x.contact_id === contactId);
    const rec = { tenant_id: tenantId, contact_id: contactId, contact_name: contactName, credit_limit: creditLimit, credit_terms_days: creditTermsDays, updated_at: new Date().toISOString() };
    if (idx >= 0) {
      json.contact_credit_limits[idx] = rec;
    } else {
      json.contact_credit_limits.push(rec);
    }
    writeJsonDb(json);
  },

  isPgActive: (): boolean => {
    return isPgConnected;
  },
  query: async (text: string, params?: any[]): Promise<any> => {
    return pgPool.query(text, params);
  },
  readJsonDb: (): any => {
    return readJsonDb();
  },
  writeJsonDb: (data: any): void => {
    return writeJsonDb(data);
  },

  getTenantBookkeepingRules: async (tenantId: number): Promise<any[]> => {
    if (isPgConnected) {
      try {
        const res = await pgPool.query(
          `SELECT id, tenant_id, rule_code as "ruleCode", name, category, severity, is_enabled as "isEnabled",
                  condition_type as "conditionType", config_json as "configJson", rationale_template as "rationaleTemplate",
                  is_custom as "isCustom", created_at as "createdAt"
           FROM bookkeeping_rules
           WHERE tenant_id = $1
           ORDER BY is_custom DESC, id ASC`,
          [tenantId]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows;
        }
      } catch (e) {
        console.error("Database query failed in getTenantBookkeepingRules:", e);
      }
    }
    const json: any = readJsonDb();
    const rules = (json.bookkeeping_rules || []).filter((r: any) => r.tenant_id === tenantId);
    if (rules.length > 0) return rules;
    return [];
  },

  saveTenantBookkeepingRule: async (tenantId: number, rule: any): Promise<void> => {
    const ruleCode = rule.ruleCode || `CUSTOM_RULE_${Date.now()}`;
    const name = rule.name || 'Custom Audit Rule';
    const category = rule.category || 'CUSTOM_POLICY';
    const severity = rule.severity || 'REVIEW_REQUIRED';
    const isEnabled = rule.isEnabled !== undefined ? rule.isEnabled : true;
    const conditionType = rule.conditionType || 'CUSTOM_CONSTRAINT';
    const configJson = rule.configJson || {};
    const rationaleTemplate = rule.rationaleTemplate || 'User custom policy violation';
    const isCustom = rule.isCustom !== undefined ? rule.isCustom : true;

    if (isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO bookkeeping_rules (tenant_id, rule_code, name, category, severity, is_enabled, condition_type, config_json, rationale_template, is_custom, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
           ON CONFLICT (tenant_id, rule_code)
           DO UPDATE SET name = $3, category = $4, severity = $5, is_enabled = $6, condition_type = $7, config_json = $8, rationale_template = $9, is_custom = $10`,
          [tenantId, ruleCode, name, category, severity, isEnabled, conditionType, JSON.stringify(configJson), rationaleTemplate, isCustom]
        );
        return;
      } catch (e) {
        console.error("Database query failed in saveTenantBookkeepingRule:", e);
      }
    }
    const json: any = readJsonDb();
    if (!json.bookkeeping_rules) json.bookkeeping_rules = [];
    const idx = json.bookkeeping_rules.findIndex((r: any) => r.tenant_id === tenantId && r.ruleCode === ruleCode);
    const rec = { tenant_id: tenantId, ruleCode, name, category, severity, isEnabled, conditionType, configJson, rationaleTemplate, isCustom };
    if (idx >= 0) json.bookkeeping_rules[idx] = rec;
    else json.bookkeeping_rules.push(rec);
    writeJsonDb(json);
  },

  deleteTenantBookkeepingRule: async (tenantId: number, ruleCode: string): Promise<void> => {
    if (isPgConnected) {
      try {
        await pgPool.query(`DELETE FROM bookkeeping_rules WHERE tenant_id = $1 AND rule_code = $2`, [tenantId, ruleCode]);
        return;
      } catch (e) {
        console.error("Database query failed in deleteTenantBookkeepingRule:", e);
      }
    }
    const json: any = readJsonDb();
    if (json.bookkeeping_rules) {
      json.bookkeeping_rules = json.bookkeeping_rules.filter((r: any) => !(r.tenant_id === tenantId && r.ruleCode === ruleCode));
      writeJsonDb(json);
    }
  },

  getAccountTransactions: async (tenantId: number, fromDateStr?: string, toDateStr?: string): Promise<any[]> => {
    if (isPgConnected) {
      try {
        let query = `SELECT * FROM account_transactions WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        if (fromDateStr && toDateStr) {
          query += ` AND date >= $2 AND date <= $3`;
          params.push(`${fromDateStr}T00:00:00.000Z`, `${toDateStr}T23:59:59.999Z`);
        }
        query += ` ORDER BY date ASC`;
        const res = await pgPool.query(query, params);
        return res.rows;
      } catch (e) {
        console.error("Database query failed in getAccountTransactions:", e);
      }
    }
    const json: any = readJsonDb();
    let txns = (json.account_transactions || []).filter((r: any) => r.tenant_id === tenantId);
    if (fromDateStr && toDateStr) {
      const fromTs = new Date(`${fromDateStr}T00:00:00.000Z`).getTime();
      const toTs = new Date(`${toDateStr}T23:59:59.999Z`).getTime();
      txns = txns.filter((r: any) => {
        const t = new Date(r.date).getTime();
        return !isNaN(t) && t >= fromTs && t <= toTs;
      });
    }
    return txns;
  },

  getXeroAccountTransactionRows: async (tenantId: number, sourceAccountId?: string, accountCode?: string): Promise<any[]> => {
    if (isPgConnected) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS xero_account_transaction_rows (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
            account_code VARCHAR(50),
            account_name VARCHAR(255),
            date TIMESTAMP,
            source VARCHAR(100),
            source_id VARCHAR(255),
            description TEXT,
            reference VARCHAR(255),
            currency VARCHAR(10) DEFAULT 'GBP',
            debit DECIMAL DEFAULT 0,
            credit DECIMAL DEFAULT 0,
            gross_amount DECIMAL DEFAULT 0,
            tax_amount DECIMAL DEFAULT 0,
            running_balance DECIMAL DEFAULT 0,
            source_account_id VARCHAR(255),
            source_line_id VARCHAR(255),
            transaction_type VARCHAR(50),
            source_id_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, source_account_id, date, transaction_type, reference, description, debit, credit)
          );
        `);
        let query = `SELECT * FROM xero_account_transaction_rows WHERE tenant_id = $1`;
        const params: any[] = [tenantId];
        if (sourceAccountId) {
          query += ` AND source_account_id = $2`;
          params.push(sourceAccountId);
        } else if (accountCode) {
          query += ` AND account_code = $2`;
          params.push(accountCode);
        }
        query += ` ORDER BY date ASC`;
        const res = await pgPool.query(query, params);
        return res.rows;
      } catch (e) {
        console.error("Database query failed in getXeroAccountTransactionRows:", e);
      }
    }
    const json: any = readJsonDb();
    return (json.xero_account_transaction_rows || []).filter((r: any) => {
      if (r.tenant_id !== tenantId) return false;
      if (sourceAccountId && r.source_account_id === sourceAccountId) return true;
      if (accountCode && r.account_code === accountCode) return true;
      return !sourceAccountId && !accountCode;
    });
  },

  saveXeroAccountTransactionRows: async (tenantId: number, rows: any[]): Promise<number> => {
    if (!rows || rows.length === 0) return 0;
    let saved = 0;
    if (isPgConnected) {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS xero_account_transaction_rows (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
            account_code VARCHAR(50),
            account_name VARCHAR(255),
            date TIMESTAMP,
            source VARCHAR(100),
            source_id VARCHAR(255),
            description TEXT,
            reference VARCHAR(255),
            currency VARCHAR(10) DEFAULT 'GBP',
            debit DECIMAL DEFAULT 0,
            credit DECIMAL DEFAULT 0,
            gross_amount DECIMAL DEFAULT 0,
            tax_amount DECIMAL DEFAULT 0,
            running_balance DECIMAL DEFAULT 0,
            source_account_id VARCHAR(255),
            source_line_id VARCHAR(255),
            transaction_type VARCHAR(50),
            source_id_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, source_account_id, date, transaction_type, reference, description, debit, credit)
          );
        `);
        await client.query('BEGIN');
        for (const r of rows) {
          await client.query(`
            INSERT INTO xero_account_transaction_rows (
              tenant_id, account_code, account_name, date, source, source_id, description, reference, currency, debit, credit, gross_amount, tax_amount, running_balance, source_account_id, source_line_id, transaction_type, source_id_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT DO NOTHING;
          `, [
            tenantId,
            r.accountCode || r.account_code || '',
            r.accountName || r.account_name || '',
            r.date,
            'xero',
            r.sourceTransactionId || r.source_id || '',
            r.description || '',
            r.reference || '',
            r.currency || 'GBP',
            r.debit || 0,
            r.credit || 0,
            r.gross || r.gross_amount || 0,
            r.tax || r.tax_amount || 0,
            r.runningBalance || r.running_balance || 0,
            r.sourceAccountId || r.source_account_id || '',
            r.sourceLineId || r.source_line_id || '',
            r.transactionType || r.transaction_type || 'Account Transaction',
            r.sourceIdType || r.source_id_type || 'XERO_ID'
          ]);
          saved++;
        }
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Failed to save xero_account_transaction_rows in PG:', err.message);
      } finally {
        client.release();
      }
    } else {
      const json: any = readJsonDb();
      if (!json.xero_account_transaction_rows) json.xero_account_transaction_rows = [];
      for (const r of rows) {
        json.xero_account_transaction_rows.push({
          tenant_id: tenantId,
          account_code: r.accountCode || r.account_code || '',
          account_name: r.accountName || r.account_name || '',
          date: r.date,
          source: 'xero',
          source_id: r.sourceTransactionId || r.source_id || '',
          description: r.description || '',
          reference: r.reference || '',
          currency: r.currency || 'GBP',
          debit: r.debit || 0,
          credit: r.credit || 0,
          gross_amount: r.gross || r.gross_amount || 0,
          tax_amount: r.tax || r.tax_amount || 0,
          running_balance: r.runningBalance || r.running_balance || 0,
          source_account_id: r.sourceAccountId || r.source_account_id || '',
          source_line_id: r.sourceLineId || r.source_line_id || '',
          transaction_type: r.transactionType || r.transaction_type || 'Account Transaction',
          source_id_type: r.sourceIdType || r.source_id_type || 'XERO_ID'
        });
        saved++;
      }
      writeJsonDb(json);
    }
    return saved;
  },

  getMenuPermissions: async (role?: string, userEmail?: string): Promise<{ role: string; menu_key: string; is_enabled: boolean }[]> => {
    if (isPgConnected) {
      try {
        let query = `SELECT role, menu_key, is_enabled FROM system_menu_permissions`;
        const params: any[] = [];
        const conditions: string[] = [];

        if (userEmail) {
          params.push(`USER:${userEmail.toLowerCase().trim()}`);
          conditions.push(`role = $${params.length}`);
        }
        if (role) {
          params.push(role);
          conditions.push(`role = $${params.length}`);
        }

        if (conditions.length > 0) {
          conditions.push(`role = 'ALL'`);
          query += ` WHERE ` + conditions.join(' OR ');
        }

        const res = await pgPool.query(query, params);
        return res.rows;
      } catch (e) {
        console.error("Database query failed in getMenuPermissions:", e);
      }
    }
    const json: any = readJsonDb();
    const rows = json.system_menu_permissions || [];
    if (!role && !userEmail) return rows;
    const userRoleKey = userEmail ? `USER:${userEmail.toLowerCase().trim()}` : null;
    return rows.filter((r: any) => {
      if (r.role === 'ALL') return true;
      if (role && r.role === role) return true;
      if (userRoleKey && r.role.toLowerCase() === userRoleKey) return true;
      return false;
    });
  },

  saveMenuPermissions: async (permissions: { role?: string; user_email?: string; menu_key: string; is_enabled: boolean }[]): Promise<boolean> => {
    if (!permissions || permissions.length === 0) return true;
    if (isPgConnected) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        for (const item of permissions) {
          const roleKey = item.user_email ? `USER:${item.user_email.toLowerCase().trim()}` : (item.role || 'ALL');
          await client.query(`
            INSERT INTO system_menu_permissions (role, menu_key, is_enabled, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (role, menu_key)
            DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP;
          `, [roleKey, item.menu_key, item.is_enabled]);
        }
        await client.query('COMMIT');
        return true;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('Failed to save system_menu_permissions in PG:', err.message);
        return false;
      } finally {
        client.release();
      }
    } else {
      const json: any = readJsonDb();
      if (!json.system_menu_permissions) json.system_menu_permissions = [];
      for (const item of permissions) {
        const roleKey = item.user_email ? `USER:${item.user_email.toLowerCase().trim()}` : (item.role || 'ALL');
        const idx = json.system_menu_permissions.findIndex((r: any) => r.role === roleKey && r.menu_key === item.menu_key);
        if (idx >= 0) {
          json.system_menu_permissions[idx].is_enabled = item.is_enabled;
          json.system_menu_permissions[idx].updated_at = new Date().toISOString();
        } else {
          json.system_menu_permissions.push({
            id: json.system_menu_permissions.length + 1,
            role: roleKey,
            menu_key: item.menu_key,
            is_enabled: item.is_enabled,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      writeJsonDb(json);
      return true;
    }
  },

  getCustomBudgetPlan: async (tenantId: number | string = 1, planKey = 'default_plan'): Promise<any | null> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS custom_budget_plans (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            plan_key VARCHAR(255) DEFAULT 'default_plan',
            plan_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, plan_key)
          );
        `);
        const { rows } = await pgPool.query(
          'SELECT plan_data FROM custom_budget_plans WHERE tenant_id = $1 AND plan_key = $2',
          [tid, planKey]
        );
        return rows[0]?.plan_data || null;
      } catch (err: any) {
        console.error('Failed to get custom budget plan in PG:', err.message);
      }
    }
    const json: any = readJsonDb();
    const found = (json.custom_budget_plans || []).find(
      (p: any) => p.tenant_id === tid && p.plan_key === planKey
    );
    return found?.plan_data || null;
  },

  saveCustomBudgetPlan: async (tenantId: number | string = 1, planData: any, planKey = 'default_plan'): Promise<boolean> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS custom_budget_plans (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            plan_key VARCHAR(255) DEFAULT 'default_plan',
            plan_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, plan_key)
          );
        `);
        await pgPool.query(
          `INSERT INTO custom_budget_plans (tenant_id, plan_key, plan_data, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (tenant_id, plan_key)
           DO UPDATE SET plan_data = EXCLUDED.plan_data, updated_at = CURRENT_TIMESTAMP`,
          [tid, planKey, JSON.stringify(planData)]
        );
        return true;
      } catch (err: any) {
        console.error('Failed to save custom budget plan in PG:', err.message);
      }
    }
    const json: any = readJsonDb();
    if (!json.custom_budget_plans) json.custom_budget_plans = [];
    const idx = json.custom_budget_plans.findIndex(
      (p: any) => p.tenant_id === tid && p.plan_key === planKey
    );
    if (idx >= 0) {
      json.custom_budget_plans[idx].plan_data = planData;
      json.custom_budget_plans[idx].updated_at = new Date().toISOString();
    } else {
      json.custom_budget_plans.push({
        id: json.custom_budget_plans.length + 1,
        tenant_id: tid,
        plan_key: planKey,
        plan_data: planData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    writeJsonDb(json);
    return true;
  },

  listCustomBudgetPlans: async (tenantId: number | string = 1): Promise<{ planKey: string; updatedAt: string }[]> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        const { rows } = await pgPool.query(
          'SELECT plan_key, updated_at FROM custom_budget_plans WHERE tenant_id = $1 ORDER BY plan_key ASC',
          [tid]
        );
        return rows.map((r: any) => ({ planKey: r.plan_key, updatedAt: r.updated_at }));
      } catch (err: any) {
        console.error('Failed to list custom budget plans in PG:', err.message);
      }
    }
    const json: any = readJsonDb();
    return (json.custom_budget_plans || [])
      .filter((p: any) => p.tenant_id === tid)
      .map((p: any) => ({ planKey: p.plan_key, updatedAt: p.updated_at }));
  },

  deleteCustomBudgetPlan: async (tenantId: number | string = 1, planKey = 'default_plan'): Promise<boolean> => {
    const tid = typeof tenantId === 'string' ? parseInt(tenantId) || 1 : tenantId;
    if (isPgConnected) {
      try {
        await pgPool.query(
          'DELETE FROM custom_budget_plans WHERE tenant_id = $1 AND plan_key = $2',
          [tid, planKey]
        );
        return true;
      } catch (err: any) {
        console.error('Failed to delete custom budget plan in PG:', err.message);
      }
    }
    const json: any = readJsonDb();
    if (json.custom_budget_plans) {
      json.custom_budget_plans = json.custom_budget_plans.filter(
        (p: any) => !(p.tenant_id === tid && p.plan_key === planKey)
      );
      writeJsonDb(json);
    }
    return true;
  }
};
