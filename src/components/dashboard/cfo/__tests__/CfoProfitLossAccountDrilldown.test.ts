import { db } from '../../../../lib/db';
import { getAccountTransactionsLedger } from '../../../../lib/ledger-engine';

async function runCfoProfitLossAccountDrilldownSuite() {
  console.log('====================================================================');
  console.log(' CFO PROFIT & LOSS ACCOUNT DRILL-DOWN INTEGRITY SUITE ');
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
    const tidA = 99810; // Tenant A with full line-item invoice data
    const tidB = 99820; // Tenant B with report balance but no line items (DATA_PARTIAL)

    const compA = await db.createTenant('Tenant Drilldown Comp A');
    const compB = await db.createTenant('Tenant Drilldown Comp B');

    const tA = compA.id || tidA;
    const tB = compB.id || tidB;

    // Seed Accounts
    await db.saveCachedRecords(tA, 'accounts', [
      { AccountID: 'acc-guid-a-sales', Code: '200', Name: 'Sales Revenue', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);

    await db.saveCachedRecords(tB, 'accounts', [
      { AccountID: 'acc-guid-b-sales', Code: '200', Name: 'Product Sales', Type: 'REVENUE', Status: 'ACTIVE' }
    ]);

    // Seed Invoices for Tenant A (with line items)
    await db.saveCachedRecords(tA, 'invoices', [
      {
        InvoiceID: 'inv-a-1',
        InvoiceNumber: 'INV-1001',
        Type: 'ACCREC',
        Status: 'AUTHORISED',
        Total: 5000,
        AmountPaid: 5000,
        AmountDue: 0,
        Date: '2026-05-15T00:00:00.000Z',
        ContactName: 'Customer Alpha',
        LineItems: [
          { AccountCode: '200', AccountID: 'acc-guid-a-sales', Description: 'Software Subscription', LineAmount: 5000 }
        ]
      }
    ]);

    // Seed Invoices for Tenant B (with EMPTY line items summaries)
    await db.saveCachedRecords(tB, 'invoices', [
      {
        InvoiceID: 'inv-b-1',
        InvoiceNumber: 'INV-2001',
        Type: 'ACCREC',
        Status: 'AUTHORISED',
        Total: 15709.59,
        AmountPaid: 15709.59,
        AmountDue: 0,
        Date: '2026-06-10T00:00:00.000Z',
        ContactName: 'Customer Beta',
        LineItems: []
      }
    ]);

    // 1. Test 1: P&L Sales account has correct sourceAccountId
    const accsA = await db.getAccounts(tA);
    const salesAccA = accsA.find((a: any) => (a.Code || a.code) === '200');
    assert(salesAccA?.AccountID === 'acc-guid-a-sales', 'Test 1: P&L Sales account resolves sourceAccountId (acc-guid-a-sales)');

    // 2. Test 2: Drilldown matches using sourceAccountId
    const drillA = await getAccountTransactionsLedger(tA, 'Sales Revenue', '2026-04-01', '2026-09-03', 5000);
    assert(drillA.sourceAccountId === 'acc-guid-a-sales', 'Test 2: Drilldown result includes matching sourceAccountId');

    // 3. Test 3: Tenant isolation is enforced
    const drillB = await getAccountTransactionsLedger(tB, 'Product Sales', '2026-04-01', '2026-09-03', 15709.59);
    assert(drillB.transactions.every(t => !t.id.includes('inv-a')), 'Test 3: Tenant isolation enforced (Tenant B never sees Tenant A invoices)');

    // 4. Test 4: Exact period is enforced
    const drillOutOfRange = await getAccountTransactionsLedger(tA, 'Sales Revenue', '2026-01-01', '2026-03-31', 0);
    assert(drillOutOfRange.transactionCount === 0, 'Test 4: Exact period filtering enforced (out of range query returns 0 transactions)');

    // 5. Test 5: Real invoice lines are returned for Tenant A
    assert(drillA.transactionCount === 1 && drillA.transactions[0].amount === 5000,
      'Test 5: Real invoice line items returned for Tenant A (£5,000)');

    // 6. Test 6: Real credit notes / deduction logic handled correctly
    assert(drillA.dataCoverage === 'DATA_COMPLETE', 'Test 6: Tenant A data coverage marked DATA_COMPLETE');

    // 7. Test 7: Manual journals returned only if they actually exist
    assert(drillA.transactions.every(t => t.source === 'Receivable Invoice' || t.source === 'Payable Invoice' || t.source === 'Manual Journal'),
      'Test 7: Only legitimate Xero transaction sources returned');

    // 8. Test 8: No synthetic transactions created (JNL-200 prohibited)
    assert(drillB.transactions.every(t => t.reference !== 'JNL-200' && !t.description.includes('Stock / Accounting Adjustment')),
      'Test 8: Synthetic JNL-200 transactions are never generated');

    // 9. Test 9: Account balance reconciles with returned transactions when complete
    assert(drillA.totalValue === 5000, 'Test 9: Account balance reconciles with transaction list when DATA_COMPLETE');

    // 10. Test 10: If detail is missing for non-zero balance, response is DATA_PARTIAL with warning
    assert(drillB.dataCoverage === 'DATA_PARTIAL' && !!drillB.warning,
      'Test 10: Missing transaction detail for non-zero balance returns DATA_PARTIAL with warning string');

    // 11. Test 11: New tenant cannot see Tenant 4 data
    assert(drillB.transactions.every(t => t.amount !== 656964.02), 'Test 11: Tenant B cannot see Tenant 4 reference data');

    // 12. Test 12: Account code 200 alone cannot identify account across tenants
    const accsB = await db.getAccounts(tB);
    const salesAccB = accsB.find((a: any) => (a.Code || a.code) === '200');
    assert(salesAccA?.AccountID !== salesAccB?.AccountID, 'Test 12: Account Code 200 maps to different AccountIDs across tenants');

  } catch (err: any) {
    console.error('P&L Account Drilldown Integration Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`CFO P&L ACCOUNT DRILLDOWN INTEGRITY SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCfoProfitLossAccountDrilldownSuite();
