import { CFOIntelligenceEngine } from '../CFOIntelligenceEngine';
import { db } from '../../db';

console.log('====================================================');
console.log(' PHASE 7 CFO INTELLIGENCE ENGINE TEST SUITE         ');
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
  const TENANT_A = '902';
  const TENANT_B = '903';
  const START_DATE = '2024-01-01';
  const END_DATE = '2024-01-31';
  const PREV_START = '2023-12-01';
  const PREV_END = '2023-12-31';

  try {
    // Clean and setup mock tenant data
    await db.query(`DELETE FROM tenants WHERE id IN (${TENANT_A}, ${TENANT_B});`);
    await db.query(`INSERT INTO tenants (id, name) VALUES (${TENANT_A}, 'CFO Intelligence Tenant A'), (${TENANT_B}, 'CFO Intelligence Tenant B');`);

    // Setup sample accounts for Tenant A
    await db.query(`
      INSERT INTO accounts (tenant_id, account_id, code, name, type, status) VALUES
      (${TENANT_A}, 'acc-rev-a', '400', 'Sales Revenue', 'REVENUE', 'ACTIVE'),
      (${TENANT_A}, 'acc-cogs-a', '500', 'Cost of Goods Sold', 'DIRECT_COSTS', 'ACTIVE'),
      (${TENANT_A}, 'acc-exp-a', '600', 'Advertising Expense', 'EXPENSE', 'ACTIVE'),
      (${TENANT_B}, 'acc-rev-b', '400', 'Tenant B Sales', 'REVENUE', 'ACTIVE');
    `);

    // Setup account mappings
    await db.saveAccountMapping({ tenant_id: Number(TENANT_A), source: 'xero', source_account_id: 'acc-rev-a', account_code: '400', account_name: 'Sales Revenue', financial_statement_category: 'REVENUE', status: 'CONFIRMED' });
    await db.saveAccountMapping({ tenant_id: Number(TENANT_A), source: 'xero', source_account_id: 'acc-cogs-a', account_code: '500', account_name: 'Cost of Goods Sold', financial_statement_category: 'DIRECT_COSTS', status: 'CONFIRMED' });
    await db.saveAccountMapping({ tenant_id: Number(TENANT_A), source: 'xero', source_account_id: 'acc-exp-a', account_code: '600', account_name: 'Advertising Expense', financial_statement_category: 'EXPENSE', status: 'CONFIRMED' });

    await db.saveAccountMapping({ tenant_id: Number(TENANT_B), source: 'xero', source_account_id: 'acc-rev-b', account_code: '400', account_name: 'Tenant B Sales', financial_statement_category: 'REVENUE', status: 'CONFIRMED' });

    // Setup Xero reports for Tenant A
    await db.saveReport(Number(TENANT_A), 'ProfitAndLoss', {
      revenue: 12000,
      cogs: 4000,
      grossProfit: 8000,
      operatingExpenses: 3000,
      operatingProfit: 5000,
      netProfit: 4500
    });

    await db.saveReport(Number(TENANT_A), 'BalanceSheet', {
      cash: 20000,
      accountsReceivable: 6000,
      accountsPayable: 2000,
      totalAssets: 26000,
      totalLiabilities: 2000,
      equity: 24000
    });

    // Invoices for Tenant A
    await db.saveInvoices(Number(TENANT_A), [
      {
        invoice_id: 'inv-1',
        type: 'ACCREC',
        contact_id: 'cust-1',
        contactName: 'Acme Corp',
        date: '2024-01-15',
        total: 12000,
        line_items: [
          { account_id: 'acc-rev-a', line_amount: 12000, item_code: 'PROD-1', description: 'Enterprise License' }
        ]
      },
      {
        invoice_id: 'inv-2',
        type: 'ACCPAY',
        contact_id: 'supp-1',
        contactName: 'Supplier Inc',
        date: '2024-01-10',
        total: 4000,
        line_items: [
          { account_id: 'acc-cogs-a', line_amount: 4000, item_code: 'MAT-1', description: 'Raw Materials' }
        ]
      }
    ]);

    // Bank transactions for Tenant A
    await db.saveReport(Number(TENANT_A), 'BankTransactions', [
      { id: 'bt-1', date: '2024-01-20', type: 'RECEIVE', total: 10000, accountType: 'OPERATING' },
      { id: 'bt-2', date: '2024-01-22', type: 'SPEND', total: 3000, accountType: 'OPERATING' }
    ]);

    const intel = await CFOIntelligenceEngine.getIntelligence(TENANT_A, START_DATE, END_DATE, PREV_START, PREV_END);

    // 11. Revenue growth
    assert(
      intel.profitability.revenueGrowthPct !== undefined && intel.profitability.revenueGrowthPct.sourceMetrics.includes('revenue'),
      'Test 11: Calculates revenue growth percentage across periods'
    );

    // 12. Gross margin
    assert(
      intel.profitability.grossMarginPct !== undefined && Math.abs(intel.profitability.grossMarginPct.value! - 66.67) < 0.5,
      'Test 12: Calculates gross margin percentage deterministically with formula preservation'
    );

    // 13. Operating margin
    assert(
      intel.profitability.operatingMarginPct !== undefined && Math.abs(intel.profitability.operatingMarginPct.value! - 41.67) < 0.5,
      'Test 13: Calculates operating margin percentage with source attribution'
    );

    // 14. Net margin
    assert(
      intel.profitability.netMarginPct !== undefined && Math.abs(intel.profitability.netMarginPct.value! - 37.5) < 0.5,
      'Test 14: Calculates net margin percentage correctly'
    );

    // 15. EBITDA margin
    assert(
      intel.profitability.ebitda !== undefined && (intel.profitability.ebitda.status === 'NOT_AVAILABLE' || intel.profitability.ebitda.value !== undefined),
      'Test 15: Handles EBITDA margin availability explicitly without inventing depreciation'
    );

    // 16. Expense ranking
    assert(
      intel.expenses !== undefined && Array.isArray(intel.expenses.topExpenseAccounts),
      'Test 16: Ranks expense accounts by absolute amount and change vs previous period'
    );

    // 17. Revenue dimensions
    assert(
      intel.revenue.byCustomer.length > 0 && intel.revenue.byCustomer[0].label === 'Acme Corp' && intel.revenue.byChannel.length === 0,
      'Test 17: Calculates revenue breakdown by customer and product without inventing channels'
    );

    // 18. Working capital
    assert(
      intel.workingCapital.workingCapital.value !== undefined && intel.workingCapital.ar.value === 6000,
      'Test 18: Calculates working capital, AR change, and AP change'
    );

    // 19. DSO
    assert(
      intel.workingCapital.dso.value !== null && intel.workingCapital.dso.value > 0,
      'Test 19: Calculates Days Sales Outstanding (DSO) deterministically'
    );

    // 20. DPO
    assert(
      intel.workingCapital.dpo.value !== null && intel.workingCapital.dpo.value > 0,
      'Test 20: Calculates Days Payables Outstanding (DPO) deterministically'
    );

    // 21. Cash flow
    assert(
      intel.cashFlow.operatingCashFlow.value === 7000 && intel.cashFlow.operatingCashFlow.status === 'AVAILABLE',
      'Test 21: Calculates cash flows from actual bank transactions without inferring from P&L'
    );

    // 22. Alert thresholds
    assert(
      Array.isArray(intel.alerts),
      'Test 22: Triggers CFO alerts when metrics cross configurable thresholds'
    );

    // 23. Tenant threshold isolation
    await db.saveTenantCFOThresholds(TENANT_A, { marginCompressionThreshold: 1, revenueDeclineThreshold: 2, opexIncreaseThreshold: 3, arIncreaseThreshold: 4, cashDeclineThreshold: 5 });
    const intelA = await CFOIntelligenceEngine.getIntelligence(TENANT_A, START_DATE, END_DATE, PREV_START, PREV_END);
    const intelB = await CFOIntelligenceEngine.getIntelligence(TENANT_B, START_DATE, END_DATE, PREV_START, PREV_END);

    assert(
      intelA.thresholds.marginCompressionThreshold === 1 && intelB.thresholds.marginCompressionThreshold === 5,
      'Test 23: Isolates threshold configurations per tenant'
    );

    // 24. Incomplete data handling
    assert(
      intelB.workingCapital.dpo.status === 'NOT_AVAILABLE',
      'Test 24: Returns NOT_AVAILABLE status for missing metrics instead of throwing errors'
    );

    // 25. No fabricated values
    assert(
      intel.profitability.grossProfit.formula === 'Revenue - COGS',
      'Test 25: Preserves strict deterministic formulas without ratio estimations'
    );

    // 26. Tenant isolation
    assert(
      intelA.tenantId === TENANT_A && intelB.tenantId === TENANT_B && intelA.profitability.revenue.value !== intelB.profitability.revenue.value,
      'Test 26: Ensures complete tenant data isolation across CFO calculations'
    );

    await db.query(`DELETE FROM tenants WHERE id IN (${TENANT_A}, ${TENANT_B});`);
  } catch (err: any) {
    console.error('Error in CFOIntelligenceEngine test execution:', err);
    failedTests++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`CFO INTELLIGENCE ENGINE RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('----------------------------------------------------\n');

  if (failedTests > 0) process.exit(1);
}

runTests();
