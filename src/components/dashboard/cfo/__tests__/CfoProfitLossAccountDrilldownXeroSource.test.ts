import { db } from '../../../../lib/db';
import { getAccountTransactionsLedger } from '../../../../lib/ledger-engine';

async function runCfoProfitLossAccountDrilldownXeroSourceSuite() {
  console.log('====================================================================');
  console.log(' CFO PROFIT & LOSS DRILLDOWN XERO SOURCE INTEGRATION SUITE ');
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
    const compA = await db.createTenant('Tenant Xero Drilldown A (Demo Co)');
    const compB = await db.createTenant('Tenant Xero Drilldown B (Empty)');

    const tA = compA.id;
    const tB = compB.id;

    const accIdSales = 'd1ebb97b-d207-4ccb-9ab6-8a466a8b4d39';

    // Seed Accounts
    await db.saveCachedRecords(tA, 'accounts', [
      { AccountID: accIdSales, Code: '200', Name: 'Sales', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);
    await db.saveCachedRecords(tB, 'accounts', [
      { AccountID: 'acc-b-99', Code: '200', Name: 'Sales', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);

    // Seed empty line-item invoice summaries for Tenant A (simulating Tenant 5 bulk invoice response)
    await db.saveCachedRecords(tA, 'invoices', [
      { InvoiceID: 'inv-summary-1', InvoiceNumber: 'INV-S1', Type: 'ACCREC', Status: 'AUTHORISED', Total: 15709.59, LineItems: [] }
    ]);

    // Construct 30-row Xero Account Transactions report fixture for Account 200
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
          { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: `inv-xero-id-${pad}` }, { Id: 'AccountID', Value: accIdSales }] },
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

    // Row 29: Invoice £509.59
    running += 509.59;
    rows.push({
      RowType: 'Row',
      Cells: [
        { Value: '2026-05-10', Attributes: [{ Id: 'Date', Value: '2026-05-10' }] },
        { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: 'inv-xero-id-0029' }, { Id: 'AccountID', Value: accIdSales }] },
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

    // Row 30: Credit Note -£200.00 debit
    running -= 200.00;
    rows.push({
      RowType: 'Row',
      Cells: [
        { Value: '2026-05-15', Attributes: [{ Id: 'Date', Value: '2026-05-15' }] },
        { Value: 'Receivable Credit Note', Attributes: [{ Id: 'CreditNoteID', Value: 'cn-xero-id-0030' }, { Id: 'AccountID', Value: accIdSales }] },
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

    // Save report in Tenant A cache
    const reportKey = `AccTxn_${accIdSales}`.slice(0, 48);
    await db.saveReport(tA, reportKey, reportFixture);
    await db.saveReport(tA, 'AccountTransactions', reportFixture);

    // TEST 1: Retrieve drilldown for Tenant A (Sales 200)
    const drilldownA = await getAccountTransactionsLedger(
      tA,
      'Sales',
      '2026-04-01',
      '2026-09-03',
      15709.59
    );

    assert(drilldownA.transactionCount === 30, `Test 1: Drilldown returns exactly 30 real Xero transaction rows (got ${drilldownA.transactionCount})`);
    assert(drilldownA.totalValue === 15709.59, `Test 1b: Drilldown total value reconciles with £15,709.59 (got ${drilldownA.totalValue})`);
    assert(drilldownA.dataCoverage === 'DATA_COMPLETE', 'Test 1c: Drilldown data coverage marked DATA_COMPLETE');

    // TEST 2: Verify transaction details (Receivable Invoices and Credit Notes)
    const creditNoteTxn = drilldownA.transactions.find(t => t.reference === 'CN-0030');
    assert(creditNoteTxn !== undefined, 'Test 2: Receivable Credit Note transaction present in drilldown list');
    assert(creditNoteTxn?.debit === 200 && creditNoteTxn?.credit === 0, 'Test 2b: Credit Note retains debit = £200.00');

    // TEST 3: Zero synthetic JNL-200 rows
    const hasJnl200 = drilldownA.transactions.some(t => t.reference.includes('JNL-200') || t.description.includes('Stock Adjustment'));
    assert(!hasJnl200, 'Test 3: Zero synthetic JNL-200 transactions returned');

    // TEST 4: Multi-Tenant Isolation (Tenant B gets 0 rows from Tenant A report)
    const drilldownB = await getAccountTransactionsLedger(
      tB,
      'Sales',
      '2026-04-01',
      '2026-09-03',
      0
    );
    assert(drilldownB.transactionCount === 0, 'Test 4: Tenant B receives 0 transactions (strict multi-tenant isolation)');
    assert(drilldownB.dataCoverage === 'DATA_COMPLETE', 'Test 4b: Zero balance tenant with 0 txns marked DATA_COMPLETE');

    // TEST 5: DATA_PARTIAL when source unavailable for non-zero balance
    const drilldownBPartial = await getAccountTransactionsLedger(
      tB,
      'Sales',
      '2026-04-01',
      '2026-09-03',
      8888.88
    );
    assert(drilldownBPartial.dataCoverage === 'DATA_PARTIAL', 'Test 5: Non-zero target value without Xero source returns DATA_PARTIAL');
    assert(typeof drilldownBPartial.warning === 'string', 'Test 5b: Warning string present when DATA_PARTIAL');

    // TEST 6: Exact date range filtering
    const drilldownOutOfRange = await getAccountTransactionsLedger(
      tA,
      'Sales',
      '2025-01-01',
      '2025-03-31',
      0
    );
    assert(drilldownOutOfRange.transactionCount === 0, 'Test 6: Out of range date query returns 0 transactions');

    // TEST 7: Source Account ID preserved
    assert(drilldownA.sourceAccountId === accIdSales, `Test 7: sourceAccountId matches Xero AccountID ${accIdSales}`);

  } catch (err: any) {
    console.error('Fatal error in CfoProfitLossAccountDrilldownXeroSource suite:', err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`CFO P&L DRILLDOWN XERO SOURCE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCfoProfitLossAccountDrilldownXeroSourceSuite();
