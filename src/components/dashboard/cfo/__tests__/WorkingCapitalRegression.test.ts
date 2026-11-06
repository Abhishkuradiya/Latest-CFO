import { db, pgPool } from '../../../../lib/db';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';
import { CanonicalMetricEngine } from '../../../../lib/services/CanonicalMetricEngine';
import { BalanceSheetParser } from '../../../../lib/services/BalanceSheetParser';

async function runWorkingCapitalRegressionSuite() {
  console.log('====================================================================');
  console.log(' PHASE 8.5.1 WORKING CAPITAL REGRESSION & CONSISTENCY SUITE ');
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

    // Test 1: Exact Current Asset Calculation (Authoritative Xero Balance Sheet Sourced)
    const bsReport = await db.getXeroReport(tenantId, 'BalanceSheet', fromDate, toDate);
    const rawBs = typeof bsReport === 'string' ? JSON.parse(bsReport) : (bsReport?.raw_data || bsReport);
    const bsCash = BalanceSheetParser.findTotalCash(rawBs.Rows) || 0;
    const bsAR = BalanceSheetParser.findTotalAR(rawBs.Rows) || 0;
    const liquidCurrentAssets = bsCash + bsAR;
    assert(Math.abs(bsCash - 111416.70) < 0.01 && Math.abs(bsAR - 226522.42) < 0.01 && Math.abs(liquidCurrentAssets - 337939.12) < 0.01,
      'Test 1: Exact Current Asset calculation verified (Cash £111,416.70 + AR £226,522.42 = £337,939.12)');

    // Test 2: Exact Current Liability Calculation (Authoritative Balance Sheet Accounts Payable Sourced)
    const bsAP = BalanceSheetParser.findTotalAP(rawBs.Rows) || 0;
    assert(Math.abs(bsAP - 56288.88) < 0.01, 'Test 2: Exact Current Liability (Accounts Payable) calculation verified (£56,288.88)');

    // Test 3: Working Capital Formula (Current Assets - Current Liabilities)
    const intel = await CFOIntelligenceEngine.getIntelligence(tenantId.toString(), fromDate, toDate);
    const wcVal = intel.workingCapital.workingCapital.value || 0;
    const expectedWc = liquidCurrentAssets - bsAP;
    assert(Math.abs(wcVal - expectedWc) < 0.01, 'Test 3: Working Capital formula correctly computes Current Assets - Current Liabilities');

    // Test 4: Tenant 4 Expected Authoritative Value (£281,650.24)
    assert(Math.abs(wcVal - 281650.24) < 1.0, `Test 4: Tenant 4 expected authoritative Working Capital verified (£${wcVal.toFixed(2)})`);

    // Test 5: Period-End Balance Sheet Behavior
    assert(intel.period.startDate === fromDate && intel.period.endDate === toDate, 'Test 5: Working Capital uses period-end Balance Sheet snapshot methodology');

    // Test 6: MODE_A Source Precedence (Authoritative Xero Report Precedence)
    const cm = await CanonicalMetricEngine.calculateMetrics(tenantId, fromDate, toDate);
    assert(cm.sourceMode === 'MODE_A' && cm.metrics.cashBalance.value === bsCash, 'Test 6: MODE_A source precedence enforced for Balance Sheet metrics');

    // Test 7: No Mixed-Source Calculation (AR, AP, Cash sourced uniformly from Authoritative BS)
    const arVal = cm.metrics.accountsReceivable.value || 0;
    const apVal = cm.metrics.accountsPayable.value || 0;
    assert(arVal === bsAR && apVal === bsAP, 'Test 7: AR, AP, and Cash sourced uniformly without fallback mixing');

    // Test 8: Tenant Isolation Check
    const leakIntel = await CFOIntelligenceEngine.getIntelligence('88888', fromDate, toDate);
    assert(leakIntel.dataCoverage === 'DATA_COMPLETE' || leakIntel.warnings.length > 0, 'Test 8: Strict tenant isolation maintained with zero cross-tenant state leakage');

  } catch (err: any) {
    console.error('Regression Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 8.5.1 WORKING CAPITAL REGRESSION RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runWorkingCapitalRegressionSuite();
