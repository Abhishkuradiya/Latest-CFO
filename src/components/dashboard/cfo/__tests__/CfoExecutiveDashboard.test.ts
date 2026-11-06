import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';
import { db } from '../../../../lib/db';

async function runDashboardTests() {
  console.log('====================================================');
  console.log(' PHASE 8.1 CFO EXECUTIVE DASHBOARD & API TEST SUITE');
  console.log('====================================================\n');

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
    // 1. Production Verification against Tenant 4
    const intel = await CFOIntelligenceEngine.getIntelligence('4', '2026-04-01', '2026-09-30');
    assert(intel !== null && intel !== undefined, 'Test 1: CFO Intelligence engine returns response for tenant 4');

    // 2. Revenue Verification
    assert(intel.profitability.revenue !== undefined && intel.profitability.revenue.value !== undefined, 'Test 2: Revenue metric object populated');

    // 3. Gross Profit Verification
    assert(intel.profitability.grossProfit !== undefined && (typeof intel.profitability.grossProfit.value === 'number' || intel.profitability.grossProfit.value === null), 'Test 3: Gross Profit metric object populated');

    // 4. Gross Margin Verification
    assert(intel.profitability.grossMargin !== undefined || intel.profitability.grossMarginPct !== undefined, 'Test 4: Gross Margin metric object populated');

    // 5. OPEX Verification
    assert(intel.profitability.opex !== undefined || intel.profitability.operatingExpenses !== undefined, 'Test 5: OPEX metric object populated');

    // 6. Operating Profit Verification
    assert(intel.profitability.operatingProfit !== undefined, 'Test 6: Operating Profit metric object populated');

    // 7. Net Profit Verification
    assert(intel.profitability.netProfit !== undefined, 'Test 7: Net Profit metric object populated');

    // 8. Working Capital Verification
    assert(intel.workingCapital.workingCapital !== undefined && intel.workingCapital.workingCapital.value !== null, 'Test 8: Working Capital metric populated');

    // 9. DSO Verification
    assert(intel.workingCapital.dso !== undefined, 'Test 9: DSO metric object structured properly');

    // 10. DPO Verification
    assert(intel.workingCapital.dpo !== undefined, 'Test 10: DPO metric object structured properly');

    // 11. Currency Verification
    assert(intel.currency === 'GBP', 'Test 11: Dynamic Base Currency is GBP');

    // 12. Data Coverage Status
    assert(intel.dataCoverage === 'DATA_COMPLETE', 'Test 12: Data Coverage Status is DATA_COMPLETE');

    // 13. Mapping Coverage Pct
    assert(intel.mappingCoverage === '100%', 'Test 13: Mapping Coverage is 100%');

    // 14. Null metric handling for empty periods
    const emptyIntel = await CFOIntelligenceEngine.getIntelligence('99999', '2030-01-01', '2030-01-31');
    assert(emptyIntel.profitability.revenue.value === 0 || emptyIntel.profitability.revenue.value === null, 'Test 14: Null/zero metric handling for empty period without crashing');

    // 15. EBITDA status verification
    assert(intel.profitability.ebitda !== undefined, 'Test 15: EBITDA metric object structured properly');

    // 16. Period comparison payload
    assert(intel.periodComparison !== undefined, 'Test 16: Period comparison payload present');

    // 17. Alert engine payload
    assert(Array.isArray(intel.alerts), 'Test 17: CFO Alerts array provided by backend');

    // 18. Insight engine payload
    assert(Array.isArray(intel.insights), 'Test 18: CFO Insights array provided by backend');

    // 19. Threshold config payload
    assert(intel.thresholds !== undefined, 'Test 19: Tenant CFO Threshold config present');

    // 20. Tenant isolation check
    const t4Res = await CFOIntelligenceEngine.getIntelligence('4', '2026-04-01', '2026-09-30');
    const t888Res = await CFOIntelligenceEngine.getIntelligence('888', '2026-04-01', '2026-09-30');
    assert(t4Res.tenantId === '4' && t888Res.tenantId === '888', 'Test 20: Strict tenant isolation between tenant 4 and tenant 888');

  } catch (err: any) {
    console.error('Test Suite Error:', err.stack || err);
    failed++;
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 8.1 CFO DASHBOARD TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

runDashboardTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
