# Virtual CFO Intelligence Platform

## Local PostgreSQL setup

The Next.js app in this folder connects to PostgreSQL on `127.0.0.1:5432` and uses the `virtual_cfo` database by default. Install/start the PostgreSQL server (pgAdmin alone is only a management tool), then create a database named `virtual_cfo` in pgAdmin if it does not already exist.

Copy `.env.example` to `.env.local`, set `DB_PASSWORD` to the password for the PostgreSQL user shown in your pgAdmin server connection, and restart `npm run dev`. Keep `.env.local` private; it is ignored by Git. Alternatively, configure a `DATABASE_URL` connection string instead of the individual `DB_*` settings.

## Xero Sync Architecture & Data Flow (`Sync Now` Documentation)

Is document me **"Sync Now"** button par click hone ke baad hone wali execution, Live Xero API Data Retrieval, PostgreSQL storage strategy, aur **JSONB `reports` Table Deep-Dive** ko point-by-point track kiya gaya hai.

---

### 1. ❓ Scenario Analysis: 24 Aug to 5 Sept Sync Behavior

**Sawaal:** Agar last sync 24 Aug ko hua tha aur aaj (5 Sept) user "Sync Now" dabata hai, toh kya purana data bhi dubara refresh hota hai ya sirf naya data aata hai?

**Current System Behavior:**
- Current codebase me jab user **"Sync Now"** par click karta hai, toh system **Full Data Re-Sync (Full Replacement)** mode chalata hai.
- Implementation (`src/lib/db.ts` -> `saveCachedRecords`): PostgreSQL tables (`invoices`, `contacts`, `payments`, `accounts`, etc.) me se pehle purana cache clear (`DELETE FROM <table> WHERE tenant_id = $1`) hota hai aur live Xero API se sara dataset (historical + new) re-fetch hoke insert hota hai.
- **Wajah & Solution:** Pehle `If-Modified-Since` header integrated nahi tha. Humne `src/lib/xero.ts` me [`fetchXeroResource`](file:///d:/Virtual-CFO/src/lib/xero.ts#L64-L98) function me `If-Modified-Since` header support enable kar diya hai.

---

### 2. 🛡️ Xero API Best Practices Audit & Compliance Report

| Best Practice Standard | Xero Guideline | Current Codebase Implementation Status | Compliance |
| :--- | :--- | :--- | :---: |
| **1. If-Modified-Since Header** | HTTP Header `If-Modified-Since: UTC_TIMESTAMP` pass karo taaki sirf modified records return hon (`304 Not Modified`). | `src/lib/xero.ts` me `fetchXeroResource` now supports optional `modifiedSince` parameter to avoid full re-fetches when data hasn't changed. | ⚡ Enabled |
| **2. Paging** | High-volume entities (Invoices, Credit Notes) ke liye 100 items per page limit with page loop. | `src/app/api/xero/route.ts` me `Invoices` & `CreditNotes` ke liye `page=1..100` iteration loop implemented hai. | ✅ Compliant |
| **3. Rate Limits** | 60 calls/min, 5 calls/sec per tenant limit. HTTP `429 Too Many Requests` retry handling. | `fetchXeroResource` har call me `150ms` throttle pause deta hai, paginated loops me `250ms` delay deta hai, aur 429 Error aane par `Retry-After` header read karke auto-retry karta hai. | ✅ Compliant |
| **4. Filtering** | `where` parameter use karke unwanted records skip karna. | `Invoices` query me `where=Status=="PAID" OR Status=="AUTHORISED" OR Status=="DRAFT"` condition filtered hai. | ✅ Compliant |
| **5. Caching Data** | Local PostgreSQL DB me data save karo taaki dashboard page view par Xero API hit na ho. | System PostgreSQL tables (`invoices`, `contacts`, `payments`, `accounts`, `reports`, `sales_history`, `tax_transactions`, `inventory_items`) me full local cache maintain karta hai. | ✅ Compliant |
| **6. Reducing Polling** | Real-time page loads par Xero API call mat karo; local DB cache se serve karo. | Overview & analytics dashboards `/api/xero/dashboard` local PostgreSQL database se data read karte hain. Direct polling eliminated hai. | ✅ Compliant |

---

### 3. 🔍 Deep-Dive: PostgreSQL `reports` Table (JSONB Storage Architecture)

Aapka sawal tha ki **Points 8 & 9 (Cash Flow Sources, Organisation, Profit & Loss)** DB me kaise store ho rahe hain? 

Database me in sabhi heavy & nested Xero endpoints ke liye ek dedicated PostgreSQL Key-Value / Document table use ki gayi hai: **`reports`**.

#### `reports` Table Schema Definition (`src/lib/db.ts`):
```sql
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, report_type)
);
```

#### How `db.saveReport()` Stores Data:
Jab bhi sync hota hai, backend `ON CONFLICT (tenant_id, report_type) DO UPDATE SET raw_data = $3` query chalata hai. Iska matlab: HAR `report_type` ka **ek single active master record** `tenant_id` ke against PostgreSQL `JSONB` column me save / overwrite ho jata hai.

---

### 4. 🗄️ Detailed Data Breakdown for Points 8 & 9

#### Point 8: Cash Flow Sources (Bank Transactions, Prepayments, Overpayments)

1. **`BankTransactions`**
   - **DB Key (`report_type`):** `'BankTransactions'`
   - **Target Column:** `reports.raw_data` (JSONB Array)
   - **Inside JSON Structure:**
     ```json
     [
       {
         "BankTransactionID": "bt-12345",
         "Type": "RECEIVE", // RECEIVE = Cash In, SPEND = Cash Out
         "Contact": { "ContactID": "c-111", "Name": "Acme Corp" },
         "BankAccount": { "AccountID": "acc-999", "Code": "1200" },
         "Total": 1500.00,
         "SubTotal": 1250.00,
         "TotalTax": 250.00,
         "Date": "2026-08-20T00:00:00",
         "Status": "AUTHORISED",
         "LineItems": [{ "Description": "Consulting Fee", "UnitAmount": 1250.00, "AccountCode": "200" }]
       }
     ]
     ```
   - **Dashboard Utilization:** Cash Flow Engine is array se non-invoice cash receipts calculate karta hai.

2. **`Prepayments`**
   - **DB Key (`report_type`):** `'Prepayments'`
   - **Target Column:** `reports.raw_data` (JSONB Array)
   - **Inside JSON Structure:**
     ```json
     [
       {
         "PrepaymentID": "prep-555",
         "Type": "RECEIVE-PREPAYMENT", // Customer advance payment before invoice
         "Contact": { "Name": "Global Retail" },
         "Date": "2026-08-15T00:00:00",
         "Total": 5000.00,
         "AmountApplied": 1000.00,
         "RemainingCredit": 4000.00,
         "Status": "AUTHORISED"
       }
     ]
     ```

3. **`Overpayments`**
   - **DB Key (`report_type`):** `'Overpayments'`
   - **Target Column:** `reports.raw_data` (JSONB Array)
   - **Inside JSON Structure:**
     ```json
     [
       {
         "OverpaymentID": "op-777",
         "Type": "RECEIVE-OVERPAYMENT", // Customer paid extra than invoice total
         "Contact": { "Name": "John Doe" },
         "Date": "2026-08-18T00:00:00",
         "Total": 300.00,
         "AmountApplied": 0.00,
         "RemainingCredit": 300.00
       }
     ]
     ```

---

#### Point 9: Financial Reports (Organisation & Profit and Loss)

1. **`Organisation`**
   - **DB Key (`report_type`):** `'Organisation'`
   - **Target Column:** `reports.raw_data` (JSONB Object)
   - **Inside JSON Structure:**
     ```json
     {
       "OrganisationID": "org-999",
       "Name": "MI Health Ltd",
       "LegalName": "MI Health Private Limited",
       "BaseCurrency": "GBP", // Controls currency symbol £ across dashboard
       "OrganisationType": "COMPANY",
       "CountryCode": "GB",
       "FinancialYearEndDay": 31,
       "FinancialYearEndMonth": 3
     }
     ```
   - **Dashboard Utilization:** System tenant ki currency symbol (`GBP` -> `£`) aur org name extract karta hai.

2. **`ProfitAndLoss`**
   - **DB Key (`report_type`):** `'ProfitAndLoss'`
   - **Target Column:** `reports.raw_data` (JSONB Object)
   - **Inside JSON Structure (Nested Tree):**
     ```json
     {
       "ReportID": "ProfitAndLoss",
       "ReportName": "Profit and Loss",
       "ReportDate": "31 August 2026",
       "Rows": [
         {
           "RowType": "Section",
           "Title": "Sales",
           "Rows": [
             { "RowType": "Row", "Cells": [{ "Value": "200 - Sales" }, { "Value": "4530000.00" }] }
           ],
           "SummaryTitle": "Total Sales",
           "Total": 4530000.00
         },
         {
           "RowType": "Section",
           "Title": "Operating Expenses",
           "SummaryTitle": "Total Operating Expenses",
           "Total": 1250000.00
         },
         {
           "RowType": "Section",
           "Title": "Net Profit",
           "SummaryTitle": "Net Profit",
           "Total": 692800.00
         }
       ]
     }
     ```
   - **Dashboard Utilization:** `ProfitAndLossService.ts` is JSON tree parse karke **Revenue (£4.53M)**, **Net Profit (£692.8K)**, aur **Operating Expenses** render karta hai.

---

### 5. 📊 PostgreSQL All Tables Quick Reference

| Target Table | Storage Architecture | Key Columns | Used For |
| :--- | :--- | :--- | :--- |
| **`contacts`** | Relational Table | `tenant_id`, `external_id`, `name`, `email` | Fast relational queries for Customers & Vendors |
| **`invoices`** | Relational + JSONB Table | `tenant_id`, `external_id`, `invoice_number`, `status`, `total`, `amount_due`, `line_items` (JSONB) | Receivables & Invoicing |
| **`payments`** | Relational Table | `tenant_id`, `external_id`, `amount`, `payment_date`, `invoice_id` | Payment records |
| **`accounts`** | Relational Table | `tenant_id`, `external_id`, `code`, `name`, `type` | Chart of Accounts |
| **`inventory_items`** | Relational Table | `tenant_id`, `item_id`, `code`, `name`, `quantity_on_hand` | Inventory & Stock |
| **`sales_history`** | Granular Log Table | `tenant_id`, `item_id`, `invoice_id`, `quantity_sold`, `sold_at` | Historical item sales |
| **`tax_transactions`** | Normalized Log Table | `tenant_id`, `tax_type`, `amount`, `source_type` | Tax Center Calculations |
| **`reports`** | JSONB Document Store Table | `tenant_id`, `report_type`, `raw_data` (JSONB) | P&L, Org, Bank Txns, Prepayments, Overpayments, Credit Notes |
| **`credentials`** | Relational Table | `tenant_id`, `provider`, `access_token`, `refresh_token`, `last_synced_at` | OAuth tokens & last sync time |
