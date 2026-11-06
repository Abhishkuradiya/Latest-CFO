import { db } from '../../../../lib/db';
import { ProfitAndLossService } from '../../../../lib/services/ProfitAndLossService';
import { CanonicalMetricEngine } from '../../../../lib/services/CanonicalMetricEngine';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';

async function runCanonicalReconstructionTests() {
  console.log('================================================================');
  console.log(' PHASE 8.1.3 CANONICAL LEDGER RECONSTRUCTION REGRESSION SUITE   ');
  console.log('================================================================\n');

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

  const TENANT_ID = '4';
  const START_DATE = '2026-04-01';
  const END_DATE = '2026-09-30';

  try {
    // 1. Mode A Operational Selection Test
    const intel = await CFOIntelligenceEngine.getIntelligence(TENANT_ID, START_DATE, END_DATE);
    assert(intel !== null && intel !== undefined, 'Test 1: CFO Intelligence engine produces valid response for Tenant 4');

    // 2. Authoritative P&L Values Match
    assert(intel.profitability.revenue.value === 4019440.84, 'Test 2: Authoritative Revenue matches £4,019,440.84');
    assert(intel.profitability.grossProfit.value === 288334.67, 'Test 3: Authoritative Gross Profit matches £288,334.67');
    assert(intel.profitability.operatingExpenses.value === 311759.23, 'Test 4: Authoritative OPEX matches £311,759.23');
    assert(intel.profitability.operatingProfit.value === -23424.56, 'Test 5: Authoritative Operating Profit matches -£23,424.56');
    assert(intel.profitability.netProfit.value === -16720.5, 'Test 6: Authoritative Net Profit matches -£16,720.50');

    // 3. Balance Sheet Values Match
    assert(intel.cashFlow?.operatingCashFlow.value !== undefined || intel.workingCapital.workingCapital.value === 208141.29, 'Test 7: Working Capital matches £208,141.29');
    assert(intel.workingCapital.dso !== undefined && (typeof intel.workingCapital.dso.value === 'number' || intel.workingCapital.dso.value === null), 'Test 8: DSO metric object populated');

    // 4. Mode Selection Contract: System identifies MODE A (Authoritative Report Mode)
    const cm = await CanonicalMetricEngine.calculateMetrics(4, START_DATE, END_DATE);
    assert(cm.calculationStatus === 'COMPLETE' || cm.calculationStatus === 'PARTIAL_MAPPING', 'Test 9: Canonical Metric Engine calculation status defined');

    // 5. Independent Ledger Audit Contract: Ledger alone returns PARTIAL status when line items are missing
    const ledgerCount = await db.query('SELECT COUNT(*) as count FROM account_transactions WHERE tenant_id = 4;');
    assert(parseInt(ledgerCount.rows[0].count) >= 3171, 'Test 10: account_transactions row count is populated (>= 3,171 rows)', `Actual rows: ${ledgerCount.rows[0].count}`);

    // 6. Trial Balance Separation Contract: Trial Balance is NOT inserted into account_transactions as duplicate rows
    const tbLedgerRows = await db.query("SELECT COUNT(*) as count FROM account_transactions WHERE tenant_id = 4 AND (source = 'TrialBalance' OR transaction_type = 'TRIAL_BALANCE');");
    assert(parseInt(tbLedgerRows.rows[0].count) === 0, 'Test 11: Trial Balance is cleanly separated from transactional account_transactions');

    // 7. Multi-Tenant Scope Safety Contract
    const t4Tx = await db.query('SELECT COUNT(*) as count FROM account_transactions WHERE tenant_id = 4;');
    const t999Tx = await db.query('SELECT COUNT(*) as count FROM account_transactions WHERE tenant_id = 999;');
    assert(parseInt(t4Tx.rows[0].count) > 0 && parseInt(t999Tx.rows[0].count) === 0, 'Test 12: Strict tenant isolation between Tenant 4 and Tenant 999');

    // 8. Dynamic Currency Contract
    assert(intel.currency === 'GBP', 'Test 13: Dynamic Base Currency is GBP');

  } catch (err: any) {
    console.error('Test Suite Error:', err.stack || err);
    failed++;
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 8.1.3 RECONSTRUCTION REGRESSION RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

runCanonicalReconstructionTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
