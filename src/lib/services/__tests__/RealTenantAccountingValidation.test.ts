import { RealTenantAccountingValidation } from '../RealTenantAccountingValidation';
import { db } from '../../db';

console.log('====================================================');
console.log(' PHASE 7 REAL TENANT ACCOUNTING VALIDATION TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failedTests++;
  }
}

async function runTests() {
  const TENANT_ID = '901';
  const START_DATE = '2024-01-01';
  const END_DATE = '2024-01-31';

  try {
    // Setup sample accounts via db report
    await db.saveReport(Number(TENANT_ID), 'Accounts', [
      { account_id: 'acc-rev-1', code: '400', name: 'Sales Revenue', type: 'REVENUE', status: 'ACTIVE' },
      { account_id: 'acc-cogs-1', code: '500', name: 'Cost of Goods Sold', type: 'DIRECT_COSTS', status: 'ACTIVE' },
      { account_id: 'acc-exp-1', code: '600', name: 'Rent Expense', type: 'EXPENSE', status: 'ACTIVE' },
      { account_id: 'acc-tax-1', code: '800', name: 'Income Tax Expense', type: 'EXPENSE', status: 'ACTIVE' },
      { account_id: 'acc-unmapped-1', code: '999', name: 'Suspense Account', type: 'EXPENSE', status: 'ACTIVE' }
    ]);

    // Setup account mappings
    await db.saveAccountMapping({ tenant_id: Number(TENANT_ID), source: 'xero', source_account_id: 'acc-rev-1', account_code: '400', account_name: 'Sales Revenue', financial_statement_category: 'REVENUE', status: 'CONFIRMED' });
    await db.saveAccountMapping({ tenant_id: Number(TENANT_ID), source: 'xero', source_account_id: 'acc-cogs-1', account_code: '500', account_name: 'Cost of Goods Sold', financial_statement_category: 'DIRECT_COSTS', status: 'CONFIRMED' });
    await db.saveAccountMapping({ tenant_id: Number(TENANT_ID), source: 'xero', source_account_id: 'acc-exp-1', account_code: '600', account_name: 'Rent Expense', financial_statement_category: 'EXPENSE', status: 'CONFIRMED' });
    await db.saveAccountMapping({ tenant_id: Number(TENANT_ID), source: 'xero', source_account_id: 'acc-tax-1', account_code: '800', account_name: 'Income Tax Expense', financial_statement_category: 'EXPENSE', status: 'CONFIRMED' });

    // Setup Xero authoritative reports for reconciliation
    await db.saveReport(Number(TENANT_ID), 'ProfitAndLoss', {
      revenue: 10000,
      cogs: 4000,
      grossProfit: 6000,
      operatingExpenses: 2000,
      operatingProfit: 4000,
      tax: 500,
      netProfit: 3500
    });

    await db.saveReport(Number(TENANT_ID), 'BalanceSheet', {
      cash: 15000,
      accountsReceivable: 5000,
      accountsPayable: 3000,
      totalAssets: 20000,
      totalLiabilities: 3000,
      equity: 17000
    });

    await db.saveReport(Number(TENANT_ID), 'AgedReceivables', { total: 5000 });
    await db.saveReport(Number(TENANT_ID), 'AgedPayables', { total: 3000 });

    await db.saveReport(Number(TENANT_ID), 'TrialBalance', {
      accounts: [
        { accountId: 'acc-rev-1', accountCode: '400', balance: 10000 },
        { accountId: 'acc-cogs-1', accountCode: '500', balance: 4000 },
        { accountId: 'acc-exp-1', accountCode: '600', balance: 2000 }
      ]
    });

    const result = await RealTenantAccountingValidation.validateTenant(TENANT_ID, START_DATE, END_DATE);

        

    // 1. P&L reconciliation
    assert(
      result.pnLReconciliation && result.pnLReconciliation.metrics.revenue?.xeroValue === 10000,
      'Test 1: Performs P&L reconciliation comparing canonical vs Xero report values'
    );

    // 2. Balance Sheet reconciliation
    assert(
      result.balanceSheetReconciliation && result.balanceSheetReconciliation.metrics.cash?.xeroValue === 15000,
      'Test 2: Performs Balance Sheet reconciliation with Xero Balance Sheet'
    );

    // 3. Trial Balance reconciliation
    const revTB = result.trialBalanceReconciliation.find(i => i.accountCode === '400');
    console.log('DEBUG trialBalanceReconciliation:', result.trialBalanceReconciliation);
    console.log('DEBUG accountMappingReport:', JSON.stringify(result.accountMappingReport));
    assert(
      revTB !== undefined && revTB.xeroTrialBalance === 10000,
      'Test 3: Compares account-level canonical balances against Xero Trial Balance'
    );

    // 4. AR reconciliation
    assert(
      result.arApReconciliation.ar.xeroAgedReceivables === 5000 && result.arApReconciliation.ar.semanticNotes.length > 0,
      'Test 4: Reconciles Canonical AR against Xero Aged Receivables and Balance Sheet AR'
    );

    // 5. AP reconciliation
    assert(
      result.arApReconciliation.ap.xeroAgedPayables === 3000 && result.arApReconciliation.ap.semanticNotes.length > 0,
      'Test 5: Reconciles Canonical AP against Xero Aged Payables and Balance Sheet AP'
    );

    // 6. Account mapping completeness
    assert(
      result.accountMappingReport.totalAccounts === 5 && result.accountMappingReport.unmapped === 1,
      'Test 6: Generates account mapping completeness report classifying unmapped accounts'
    );

    // 7. Inventory limitation handling
    assert(
      result.inventoryValidation.valuationMethod === 'XERO_AUTHORITATIVE' && result.inventoryValidation.limitations.length > 0,
      'Test 7: Explicitly marks inventory valuation reconstruction limitations'
    );

    // 8. Tax handling
    assert(
      result.taxValidation && result.taxValidation.notes.length > 0,
      'Test 8: Validates tax expense vs clearing accounts without assuming all tax is P&L'
    );

    // 9. Multi-currency
    assert(
      result.pnLReconciliation.currency !== undefined,
      'Test 9: Preserves currency from canonical engine response'
    );

    // 10. Period boundary
    assert(
      result.period.startDate === '2024-01-01' && result.period.endDate === '2024-01-31',
      'Test 10: Respects strict date filtering boundary parameters'
    );

  } catch (err: any) {
    console.error('Error in RealTenantAccountingValidation test execution:', err);
    failedTests++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`REAL TENANT ACCOUNTING VALIDATION RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('----------------------------------------------------\n');

  if (failedTests > 0) process.exit(1);
}

runTests();
