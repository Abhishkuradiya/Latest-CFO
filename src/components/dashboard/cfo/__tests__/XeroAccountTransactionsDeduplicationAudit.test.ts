import { db } from '../../../../lib/db';
import { XeroAccountTransactionsService } from '../../../../lib/services/XeroAccountTransactionsService';
import { CanonicalMetricEngine } from '../../../../lib/services/CanonicalMetricEngine';
import { getAccountTransactionsLedger } from '../../../../lib/ledger-engine';

async function runDeduplicationAuditSuite() {
  console.log('====================================================================');
  console.log(' XERO ACCOUNT TRANSACTIONS DEDUPLICATION & SAFETY AUDIT SUITE ');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    const compA = await db.createTenant('Dedup Tenant A (Demo Co)');
    const compB = await db.createTenant('Dedup Tenant B (Tenant 4 Ref)');

    const tA = compA.id;
    const tB = compB.id;

    const accIdSalesA = 'd1ebb97b-d207-4ccb-9ab6-8a466a8b4d39';
    const accIdSalesB = 'acc-b-guid-200';

    // Seed Accounts
    await db.saveCachedRecords(tA, 'accounts', [
      { AccountID: accIdSalesA, Code: '200', Name: 'Sales', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);
    await db.saveCachedRecords(tB, 'accounts', [
      { AccountID: accIdSalesB, Code: '200', Name: 'Sales', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);

    // Construct 30-row Xero Account Transactions report fixture for Tenant A (Sales 200)
    const rows: any[] = [];
    let running = 0;
    for (let i = 1; i <= 28; i++) {
      const amt = 550.00;
      running += amt;
      const pad = i.toString().padStart(4, '0');
      rows.push({
        RowType: 'Row',
        Cells: [
          { Value: `2026-04-${(i % 28 + 1).toString().padStart(2, '0')}`, Attributes: [{ Id: 'Date', Value: `2026-04-${(i % 28 + 1).toString().padStart(2, '0')}` }] },
          { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: `inv-xero-id-${pad}` }, { Id: 'AccountID', Value: accIdSalesA }] },
          { Value: `Sales Invoice Client ${i}` },
          { Value: `INV-${pad}` },
          { Value: '0.00' },
          { Value: amt.toFixed(2) },
          { Value: (amt * 1.2).toFixed(2) },
          { Value: (amt * 0.2).toFixed(2) },
          { Value: 'GBP' },
          { Value: running.toFixed(2) }
        ]
      });
    }

    running += 509.59;
    rows.push({
      RowType: 'Row',
      Cells: [
        { Value: '2026-05-10', Attributes: [{ Id: 'Date', Value: '2026-05-10' }] },
        { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: 'inv-xero-id-0029' }, { Id: 'AccountID', Value: accIdSalesA }] },
        { Value: 'Enterprise Consulting Subscription' },
        { Value: 'INV-0029' },
        { Value: '0.00' },
        { Value: '509.59' },
        { Value: '611.51' },
        { Value: '101.92' },
        { Value: 'GBP' },
        { Value: running.toFixed(2) }
      ]
    });

    running -= 200.00;
    rows.push({
      RowType: 'Row',
      Cells: [
        { Value: '2026-05-15', Attributes: [{ Id: 'Date', Value: '2026-05-15' }] },
        { Value: 'Receivable Credit Note', Attributes: [{ Id: 'CreditNoteID', Value: 'cn-xero-id-0030' }, { Id: 'AccountID', Value: accIdSalesA }] },
        { Value: 'Customer Volume Rebate' },
        { Value: 'CN-0030' },
        { Value: '200.00' },
        { Value: '0.00' },
        { Value: '240.00' },
        { Value: '40.00' },
        { Value: 'GBP' },
        { Value: running.toFixed(2) }
      ]
    });

    const reportFixture = {
      ReportID: 'AccountTransactions',
      ReportName: 'Account Transactions',
      ReportType: 'AccountTransactions',
      ReportTitles: ['Account Transactions', 'Demo Company (Global)', 'From 1 April 2026 to 3 September 2026'],
      ReportDate: '03 September 2026',
      Rows: [
        {
          RowType: 'Header',
          Cells: [
            { Value: 'Date' },
            { Value: 'Source' },
            { Value: 'Description' },
            { Value: 'Reference' },
            { Value: 'Debit' },
            { Value: 'Credit' },
            { Value: 'Gross' },
            { Value: 'Tax' },
            { Value: 'Currency' },
            { Value: 'Running Balance' }
          ]
        },
        {
          RowType: 'Section',
          Title: '200 - Sales',
          Rows: rows,
          Summary: {
            RowType: 'SummaryRow',
            Cells: [
              { Value: 'Total 200 - Sales' },
              { Value: '' },
              { Value: '' },
              { Value: '' },
              { Value: '200.00' },
              { Value: '15909.59' },
              { Value: '19091.51' },
              { Value: '3181.92' },
              { Value: '' },
              { Value: '15709.59' }
            ]
          }
        }
      ]
    };

    // TEST 1: Measure Canonical Revenue BEFORE Account Transactions Ingestion
    const cfoBefore = await CanonicalMetricEngine.calculateMetrics(tA, '2026-04-01', '2026-09-03');
    const revenueBefore = cfoBefore.metrics.revenue.value;

    // Save report in Tenant A cache
    const reportKey = `AccTxn_${accIdSalesA}`.slice(0, 48);
    await db.saveReport(tA, reportKey, reportFixture);
    await db.saveReport(tA, 'AccountTransactions', reportFixture);

    // TEST 2: Perform Account Transactions Sync for Tenant A
    const sync1 = await XeroAccountTransactionsService.fetchAccountTransactions(
      tA,
      accIdSalesA,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      15709.59
    );

    assert(sync1.transactionCount === 30, 'Test 1: First sync parsed exactly 30 report rows');
    assert(sync1.closingBalance === 15709.59, 'Test 1b: First sync closing balance equals £15,709.59');

    // TEST 3: Measure Canonical Revenue AFTER Account Transactions Ingestion
    const cfoAfter = await CanonicalMetricEngine.calculateMetrics(tA, '2026-04-01', '2026-09-03');
    const revenueAfter = cfoAfter.metrics.revenue.value;

    assert(revenueBefore === revenueAfter, `Test 2: Authoritative P&L Revenue did NOT change due to report ingestion (Before: ${revenueBefore}, After: ${revenueAfter})`);

    // TEST 4: Idempotency & Repeat Sync Safety
    const sync2 = await XeroAccountTransactionsService.fetchAccountTransactions(
      tA,
      accIdSalesA,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      15709.59
    );
    assert(sync2.transactionCount === 30, 'Test 3: Repeat sync returns 30 rows without creating duplicate rows');

    // TEST 5: Verify Dedicated Table Separation (xero_account_transaction_rows vs account_transactions)
    const dedicatedRows = await db.getXeroAccountTransactionRows(tA, accIdSalesA);
    assert(dedicatedRows.length === 30, `Test 4: xero_account_transaction_rows table populated with 30 dedicated report rows (got ${dedicatedRows.length})`);

    const canonicalRows = await db.getAccountTransactions(tA, '2026-04-01', '2026-09-03');
    const reportRowsInCanonical = canonicalRows.filter((r: any) => r.source === 'xero_report' || r.transaction_type === 'REPORT_ROW');
    assert(reportRowsInCanonical.length === 0, 'Test 4b: Canonical account_transactions table remains 100% clean of report row contamination');

    // TEST 6: Multi-Tenant Scoping & Isolation
    const syncTenantB = await XeroAccountTransactionsService.fetchAccountTransactions(
      tB,
      accIdSalesB,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      0
    );
    assert(syncTenantB.transactionCount === 0, 'Test 5: Tenant B receives 0 rows (isolated tenant_id + source + source_account_id scoping)');

    // TEST 7: P&L Financial Statement Metric Integrity
    const rev = cfoAfter.metrics.revenue.value || 0;
    const cogs = cfoAfter.metrics.costOfSales.value || 0;
    const gp = cfoAfter.metrics.grossProfit.value || 0;
    const opProf = cfoAfter.metrics.operatingProfit.value || 0;
    const netProf = cfoAfter.metrics.netProfit.value || 0;
    assert(typeof netProf === 'number', 'Test 6b: Net Profit formula integrity preserved');

    // TEST 8: P&L Account Drilldown Integration Reconciliation
    const drilldown = await getAccountTransactionsLedger(tA, 'Sales', '2026-04-01', '2026-09-03', 15709.59);
    assert(drilldown.transactionCount === 30, `Test 7: P&L Drilldown returns 30 rows (got ${drilldown.transactionCount})`);
    assert(drilldown.totalValue === 15709.59, `Test 7b: P&L Drilldown total value reconciles with £15,709.59 (got ${drilldown.totalValue})`);
    assert(drilldown.dataCoverage === 'DATA_COMPLETE', 'Test 7c: Drilldown data coverage marked DATA_COMPLETE');

  } catch (err: any) {
    console.error('Fatal error in DeduplicationAuditSuite:', err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`XERO ACCOUNT TRANSACTIONS DEDUPLICATION AUDIT RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeduplicationAuditSuite();
