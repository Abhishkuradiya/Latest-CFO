import { db, pgPool } from '../../../../lib/db';
import { BalanceSheetParser } from '../../../../lib/services/BalanceSheetParser';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';
import { CanonicalMetricEngine } from '../../../../lib/services/CanonicalMetricEngine';

async function runBalanceSheetMetricContractSuite() {
  console.log('====================================================================');
  console.log(' PHASE 8.5.2 AUTHORITATIVE BALANCE SHEET METRIC CONTRACT AUDIT SUITE ');
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
    const tenantId = 4;
    const fromDate = '2026-04-01';
    const toDate = '2026-09-30';

    const bsReport = await db.getXeroReport(tenantId, 'BalanceSheet', fromDate, toDate);
    assert(bsReport !== null && bsReport !== undefined, 'Pre-check: Balance Sheet report retrieved for Tenant 4');

    const rawBs = typeof bsReport === 'string' ? JSON.parse(bsReport) : (bsReport?.raw_data || bsReport);
    const rows = rawBs.Rows || [];

    // Test 1: Authoritative Cash
    const cash = BalanceSheetParser.findTotalCash(rows);
    assert(cash !== null && Math.abs(cash - 111416.70) < 0.01, `Test 1: Authoritative Cash parsed directly from Xero Balance Sheet (£${cash?.toFixed(2)})`);

    // Test 2: Authoritative Accounts Receivable (AR)
    const ar = BalanceSheetParser.findTotalAR(rows);
    assert(ar !== null && Math.abs(ar - 226522.42) < 0.01, `Test 2: Authoritative AR parsed directly from Xero Balance Sheet (£${ar?.toFixed(2)})`);

    // Test 3: Authoritative Accounts Payable (AP)
    const ap = BalanceSheetParser.findTotalAP(rows);
    assert(ap !== null && Math.abs(ap - 56288.88) < 0.01, `Test 3: Authoritative AP parsed directly from Xero Balance Sheet (£${ap?.toFixed(2)})`);

    // Test 4: Current Assets
    const currentAssets = BalanceSheetParser.findCurrentAssets(rows);
    assert(currentAssets !== null && Math.abs(currentAssets - 951142.86) < 0.01, `Test 4: Authoritative Current Assets parsed directly (£${currentAssets?.toFixed(2)})`);

    // Test 5: Current Liabilities
    const currentLiabilities = BalanceSheetParser.findCurrentLiabilities(rows);
    assert(currentLiabilities !== null && Math.abs(currentLiabilities - 619110.68) < 0.01, `Test 5: Authoritative Current Liabilities parsed directly (£${currentLiabilities?.toFixed(2)})`);

    // Test 6: Total Assets
    const totalAssets = BalanceSheetParser.findTotalAssets(rows);
    assert(totalAssets !== null && Math.abs(totalAssets - 1074183.29) < 0.01, `Test 6: Authoritative Total Assets parsed directly (£${totalAssets?.toFixed(2)})`);

    // Test 7: Total Liabilities
    const totalLiabilities = BalanceSheetParser.findTotalLiabilities(rows);
    assert(totalLiabilities !== null && Math.abs(totalLiabilities - 619110.68) < 0.01, `Test 7: Authoritative Total Liabilities parsed directly (£${totalLiabilities?.toFixed(2)})`);

    // Test 8: Equity
    const equity = BalanceSheetParser.findTotalEquity(rows);
    assert(equity !== null && Math.abs(equity - 455072.61) < 0.01, `Test 8: Authoritative Equity parsed directly (£${equity?.toFixed(2)})`);

    // Test 9: Standard Working Capital Definition (Current Assets - Current Liabilities)
    const standardWc = (currentAssets || 0) - (currentLiabilities || 0);
    assert(Math.abs(standardWc - 332032.18) < 0.01, `Test 9: Standard Working Capital definition verified (Current Assets - Current Liabilities = £${standardWc.toFixed(2)})`);

    // Test 10: Liquid Working Capital Definition (Cash + AR - AP)
    const liquidWc = (cash || 0) + (ar || 0) - (ap || 0);
    assert(Math.abs(liquidWc - 281650.24) < 0.01, `Test 10: Liquid Working Capital definition verified (Cash + AR - AP = £${liquidWc.toFixed(2)})`);

    // Test 11: Balance Sheet Equation (Total Assets = Total Liabilities + Equity)
    const liabPlusEquity = (totalLiabilities || 0) + (equity || 0);
    const equationDiff = Math.abs((totalAssets || 0) - liabPlusEquity);
    assert(equationDiff < 0.01, `Test 11: Balance Sheet accounting equation verified: Total Assets (£${totalAssets?.toFixed(2)}) = Total Liabilities (£${totalLiabilities?.toFixed(2)}) + Equity (£${equity?.toFixed(2)}), Diff = £${equationDiff.toFixed(2)}`);

    // Test 12: No Invoice Fallback when Authoritative Balance Sheet AR is available
    const cm = await CanonicalMetricEngine.calculateMetrics(tenantId, fromDate, toDate);
    const cmAR = cm.metrics.accountsReceivable.value;
    assert(cmAR === ar, `Test 12: AR equals authoritative Balance Sheet AR (£${cmAR}) with 0 invoice fallback replacement`);

    // Test 13: No Bill Fallback when Authoritative Balance Sheet AP is available
    const cmAP = cm.metrics.accountsPayable.value;
    assert(cmAP === ap, `Test 13: AP equals authoritative Balance Sheet AP (£${cmAP}) with 0 bill fallback replacement`);

    // Test 14: Tenant Isolation Check
    const leakCm = await CanonicalMetricEngine.calculateMetrics(88888, fromDate, toDate);
    assert(leakCm.metrics.cashBalance.value === 0 || leakCm.metrics.cashBalance.value === null, 'Test 14: Strict tenant isolation verified with zero cross-tenant state leakage');

    // Test 15: Period-End Snapshot Behavior (No Averaging for Working Capital)
    const intel = await CFOIntelligenceEngine.getIntelligence(tenantId.toString(), fromDate, toDate);
    const intelWc = intel.workingCapital.workingCapital.value;
    assert(Math.abs((intelWc || 0) - liquidWc) < 0.01, 'Test 15: Working Capital uses period-end balances (not averaged AR/AP)');

    // Test 16: MODE_A Source Precedence Enforced
    assert(cm.sourceMode === 'MODE_A', 'Test 16: MODE_A source precedence enforced when canonical ledger coverage is partial');

  } catch (err: any) {
    console.error('Balance Sheet Metric Contract Audit Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 8.5.2 BALANCE SHEET METRIC CONTRACT SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBalanceSheetMetricContractSuite();
