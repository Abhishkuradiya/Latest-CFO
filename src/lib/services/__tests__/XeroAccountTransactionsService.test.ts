import { db } from '../../db';
import { XeroAccountTransactionsService } from '../XeroAccountTransactionsService';

async function runXeroAccountTransactionsServiceSuite() {
  console.log('====================================================================');
  console.log(' XERO ACCOUNT TRANSACTIONS SERVICE SUITE ');
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
    const comp1 = await db.createTenant('Xero Account Txn Tenant 1');
    const comp2 = await db.createTenant('Xero Account Txn Tenant 2');

    const tid1 = comp1.id || 88710;
    const tid2 = comp2.id || 88720;

    const accId1 = 'd1ebb97b-d207-4ccb-9ab6-8a466a8b4d39';
    const accId2 = '99999999-9999-9999-9999-999999999999';

    // 1. Fixture Data: Xero Account Transactions Report JSON response (30 rows, £15,709.59 closing balance)
    const generate30RowsReport = (accountCode: string = '200', accountName: string = 'Sales') => {
      const rows: any[] = [];
      let running = 0;

      // 28 Receivable Invoices (£550 each = £15,400)
      for (let i = 1; i <= 28; i++) {
        const invAmt = 550.00;
        running += invAmt;
        const padNo = i.toString().padStart(4, '0');
        rows.push({
          RowType: 'Row',
          Cells: [
            { Value: `2026-04-${(i % 28 + 1).toString().padStart(2, '0')}`, Attributes: [{ Id: 'Date', Value: `2026-04-${(i % 28 + 1).toString().padStart(2, '0')}` }] },
            { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: `inv-xero-id-${padNo}` }, { Id: 'AccountID', Value: accId1 }] },
            { Value: `Sales Invoice Client ${i}` },
            { Value: `INV-${padNo}` },
            { Value: '0.00' },
            { Value: invAmt.toFixed(2) },
            { Value: (invAmt * 1.2).toFixed(2) },
            { Value: (invAmt * 0.2).toFixed(2) },
            { Value: 'GBP' },
            { Value: running.toFixed(2) }
          ]
        });
      }

      // 1 Receivable Invoice (£509.59 -> £15,909.59)
      running += 509.59;
      rows.push({
        RowType: 'Row',
        Cells: [
          { Value: '2026-05-10', Attributes: [{ Id: 'Date', Value: '2026-05-10' }] },
          { Value: 'Receivable Invoice', Attributes: [{ Id: 'InvoiceID', Value: 'inv-xero-id-0029' }, { Id: 'AccountID', Value: accId1 }] },
          { Value: 'Enterprise Software Subscription' },
          { Value: 'INV-0029' },
          { Value: '0.00' },
          { Value: '509.59' },
          { Value: '611.51' },
          { Value: '101.92' },
          { Value: 'GBP' },
          { Value: running.toFixed(2) }
        ]
      });

      // 1 Receivable Credit Note (-£200.00 debit -> £15,709.59)
      running -= 200.00;
      rows.push({
        RowType: 'Row',
        Cells: [
          { Value: '2026-05-15', Attributes: [{ Id: 'Date', Value: '2026-05-15' }] },
          { Value: 'Receivable Credit Note', Attributes: [{ Id: 'CreditNoteID', Value: 'cn-xero-id-0030' }, { Id: 'AccountID', Value: accId1 }] },
          { Value: 'Customer Return / Rebate Adjustment' },
          { Value: 'CN-0030' },
          { Value: '200.00' },
          { Value: '0.00' },
          { Value: '240.00' },
          { Value: '40.00' },
          { Value: 'GBP' },
          { Value: running.toFixed(2) }
        ]
      });

      return {
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
            Title: `${accountCode} - ${accountName}`,
            Rows: rows,
            Summary: {
              RowType: 'SummaryRow',
              Cells: [
                { Value: `Total ${accountCode} - ${accountName}` },
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
    };

    const mockReport = generate30RowsReport('200', 'Sales');

    // TEST 1: Parse Xero Report JSON Structure correctly
    const parsedResult = XeroAccountTransactionsService.parseReportData(
      mockReport,
      tid1,
      accId1,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03'
    );

    assert(parsedResult.transactionCount === 30, 'Test 1: Parsed exactly 30 real Xero transaction rows');
    assert(parsedResult.closingBalance === 15709.59, `Test 1b: Closing balance matches £15,709.59 (got ${parsedResult.closingBalance})`);
    assert(parsedResult.dataCoverage === 'DATA_COMPLETE', 'Test 1c: Data coverage marked DATA_COMPLETE');

    // TEST 2: Verify Xero Source Identifiers preserved (XERO_ID vs REPORT_FINGERPRINT)
    const invRow = parsedResult.transactions.find(t => t.reference === 'INV-0001');
    assert(invRow?.sourceTransactionId === 'inv-xero-id-0001', 'Test 2: Original Xero InvoiceID preserved');
    assert(invRow?.sourceIdType === 'XERO_ID', 'Test 2b: Source ID type marked XERO_ID');

    // TEST 3: Credit Notes handled correctly (Debit = 200.00, Credit = 0.00)
    const cnRow = parsedResult.transactions.find(t => t.reference === 'CN-0030');
    assert(cnRow !== undefined && cnRow.debit === 200 && cnRow.credit === 0, 'Test 3: Receivable Credit Note correctly assigned Debit = £200.00');
    assert(cnRow?.transactionType === 'Receivable Credit Note', 'Test 3b: Credit note retains transactionType Receivable Credit Note');

    // TEST 4: No synthetic JNL-200 generated
    const hasJnl200 = parsedResult.transactions.some(t => t.reference.includes('JNL-200') || t.description.includes('Stock Adjustment'));
    assert(!hasJnl200, 'Test 4: Zero synthetic JNL-200 transactions generated');

    // TEST 5: Deterministic Fingerprinting when Xero ID attribute is missing
    const reportWithoutIds = JSON.parse(JSON.stringify(mockReport));
    delete reportWithoutIds.Rows[1].Rows[0].Cells[1].Attributes;
    const parsedNoAttr = XeroAccountTransactionsService.parseReportData(
      reportWithoutIds,
      tid1,
      accId1,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03'
    );
    const rowNoAttr = parsedNoAttr.transactions.find(t => t.reference === 'INV-0001');
    assert(rowNoAttr?.sourceIdType === 'REPORT_FINGERPRINT', 'Test 5: Row without Xero ID generates REPORT_FINGERPRINT');
    assert(rowNoAttr?.sourceTransactionId?.startsWith('fp_') === true, 'Test 5b: Deterministic fingerprint starts with fp_');

    // TEST 6: Persistence to account_transactions and DB report cache
    const reportKey = accId1 ? `AccTxn_${accId1}`.slice(0, 48) : 'AccTxn_200';
    await db.saveReport(tid1, reportKey, mockReport);
    await db.saveReport(tid1, 'AccountTransactions', mockReport);

    const cachedResult = await XeroAccountTransactionsService.fetchAccountTransactions(
      tid1,
      accId1,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      15709.59
    );
    assert(cachedResult.transactionCount === 30, `Test 6: Cached fetch returns 30 transactions (got ${cachedResult.transactionCount})`);
    assert(cachedResult.closingBalance === 15709.59, `Test 6b: Cached fetch balance equals £15,709.59 (got ${cachedResult.closingBalance})`);

    // TEST 7: Multi-Tenant Isolation (Tenant 2 receives 0 transactions from Tenant 1 cache)
    const tenant2Result = await XeroAccountTransactionsService.fetchAccountTransactions(
      tid2,
      accId2,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      0
    );
    assert(tenant2Result.transactionCount === 0, 'Test 7: Multi-tenant isolation enforced (Tenant 2 gets 0 rows)');
    assert(tenant2Result.dataCoverage === 'DATA_COMPLETE', 'Test 7b: Zero balance tenant with 0 txns is DATA_COMPLETE');

    // TEST 8: DATA_PARTIAL status when non-zero target value has no available transactions
    const partialResult = await XeroAccountTransactionsService.fetchAccountTransactions(
      tid2,
      accId2,
      '200',
      'Sales',
      '2026-04-01',
      '2026-09-03',
      9999.99
    );
    assert(partialResult.dataCoverage === 'DATA_PARTIAL', 'Test 8: Missing source transactions for non-zero balance returns DATA_PARTIAL');
    assert(typeof partialResult.warning === 'string' && partialResult.warning.includes('Account balance is available'), 'Test 8b: Warning message provided for DATA_PARTIAL');

    // TEST 9: Exact period filtering
    const outOfRangeResult = await XeroAccountTransactionsService.fetchAccountTransactions(
      tid1,
      accId1,
      '200',
      'Sales',
      '2025-01-01',
      '2025-03-31',
      0
    );
    assert(outOfRangeResult.transactionCount === 0, 'Test 9: Querying out-of-range dates returns 0 transactions');

    // TEST 10: Idempotent Sync / Duplicate Protection
    const persistedCount1 = await XeroAccountTransactionsService.persistTransactions(tid1, parsedResult.transactions);
    const persistedCount2 = await XeroAccountTransactionsService.persistTransactions(tid1, parsedResult.transactions);
    assert(persistedCount1 === 30 && persistedCount2 === 30, 'Test 10: Idempotent transaction sync executes cleanly without PK violation errors');

  } catch (err: any) {
    console.error('Fatal error in XeroAccountTransactionsService test suite:', err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`XERO ACCOUNT TRANSACTIONS SERVICE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runXeroAccountTransactionsServiceSuite();
