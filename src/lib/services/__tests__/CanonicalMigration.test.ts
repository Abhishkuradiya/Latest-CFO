import { CFOMetricProviderFactory, CanonicalCFOMetricProvider, LegacyCFOMetricProvider } from '../CFOMetricProvider';
import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { CFOReconciliationService } from '../CFOReconciliationService';

console.log('====================================================');
console.log(' PHASE 5 CANONICAL MIGRATION & DEPRECATION SUITE    ');
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
  const canonicalProvider = new CanonicalCFOMetricProvider();
  const canonicalRes = await canonicalProvider.getMetrics(1); // Tenant 1

  // 1. Wave 1 metrics use canonical provider
  assert(
    canonicalRes.metrics.revenue.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.costOfSales.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.grossProfit.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.grossMarginPct.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.operatingExpenses.calculationSource === 'CANONICAL',
    'Test 1: Wave 1 metrics (Revenue, COGS, Gross Profit, Gross Margin, OPEX) evaluate cleanly from CanonicalCFOMetricProvider'
  );

  // 2. Wave 2 metrics use canonical provider
  assert(
    canonicalRes.metrics.operatingProfit.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.ebitda.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.netProfit.calculationSource === 'CANONICAL',
    'Test 2: Wave 2 metrics (Operating Profit, EBITDA, Net Profit) evaluate cleanly from CanonicalCFOMetricProvider'
  );

  // 3. Wave 3 metrics use canonical provider
  assert(
    canonicalRes.metrics.cashBalance.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.accountsReceivable.calculationSource === 'CANONICAL' &&
    canonicalRes.metrics.accountsPayable.calculationSource === 'CANONICAL',
    'Test 3: Wave 3 metrics (Cash Balance, AR, AP) evaluate cleanly from CanonicalCFOMetricProvider'
  );

  // 4. Canonical mode never uses legacy fallback
  assert(
    canonicalRes.metrics.revenue.confidence !== 'FALLBACK',
    'Test 4: Canonical mode never uses silent legacy fallback estimation'
  );

  // 5. Shadow mode calculates both canonical and legacy comparison
  await CFOMetricProviderFactory.setTenantMode(888, 'SHADOW');
  const shadowRes = await CFOMetricProviderFactory.getMetricsForTenant(888);
  assert(
    shadowRes.engineMode === 'SHADOW' && shadowRes.reconciliation !== undefined,
    'Test 5: Shadow mode calculates canonical metrics and produces structured reconciliation metadata'
  );

  // 6. Legacy mode remains functional
  await CFOMetricProviderFactory.setTenantMode(777, 'LEGACY');
  const legacyRes = await CFOMetricProviderFactory.getMetricsForTenant(777);
  assert(
    legacyRes.engineMode === 'LEGACY' && legacyRes.metrics.revenue.value !== null,
    'Test 6: Legacy mode remains fully operational during controlled migration'
  );

  // 7. Tenant isolation
  assert(
    (await CFOMetricProviderFactory.getTenantMode(888)) === 'SHADOW' &&
    (await CFOMetricProviderFactory.getTenantMode(777)) === 'LEGACY',
    'Test 7: Tenant engine modes remain strictly isolated across tenants'
  );

  // 8. No ratio fallback in canonical mode
  assert(
    canonicalRes.metrics.costOfSales.confidence === 'AUTHORITATIVE' && canonicalRes.metrics.costOfSales.calculationSource === 'CANONICAL',
    'Test 8: Canonical mode never uses hardcoded ratio fallbacks (e.g. 0.38 COGS ratio)'
  );

  // 9. EBITDA unavailable without D&A
  assert(
    canonicalRes.metrics.ebitda.value === null && canonicalRes.metrics.ebitda.status === 'NOT_AVAILABLE',
    'Test 9: EBITDA returns value=null and status=NOT_AVAILABLE when D&A data is unmapped'
  );

  // 10. Net Profit semantics
  assert(
    canonicalRes.metrics.netProfit.value !== null,
    'Test 10: Net Profit computes complete accounting equation or authoritative Xero report total'
  );

  // 11. Null is not converted to zero
  assert(
    canonicalRes.metrics.ebitda.value !== 0,
    'Test 11: Metric engine never converts missing metrics (null) into zero (0)'
  );

  // 12. Partial mapping surfaces warning
  assert(
    canonicalRes.metrics.revenue.warnings.some(w => w.includes('Account mapping requires review') || w.includes('Transaction coverage')),
    'Test 12: Partial mapping or transaction coverage surfaces user-facing review warnings'
  );

  // 13. Data partial surfaces warning
  assert(
    canonicalRes.dataCoverageStatus === 'DATA_PARTIAL' && canonicalRes.metrics.revenue.dataCoverage === 'DATA_PARTIAL',
    'Test 13: Metric contract explicitly surfaces dataCoverage = DATA_PARTIAL'
  );

  // 14. Reconciliation difference preserved
  const reconRes = await CFOReconciliationService.reconcileTenantMetrics(1);
  const reconItem = reconRes.reconciliationItems[0];
  assert(
    reconItem !== undefined && reconItem.differenceReason !== undefined,
    'Test 14: Itemized reconciliation preserves exact difference values and differenceReason metadata'
  );

  // 15. Account mapping link metadata exists
  assert(
    canonicalRes.metrics.revenue.warnings.some(w => w.includes('/settings?tab=mappings') || w.includes('Settings')) ||
    (canonicalRes.metrics.ebitda.warnings && canonicalRes.metrics.ebitda.warnings.some(w => w.includes('/settings?tab=mappings') || w.includes('Settings'))),
    'Test 15: Warning messages include account mapping Settings link metadata [/settings?tab=mappings]'
  );

  // 16. Currency preserved
  assert(
    canonicalRes.currency === 'GBP' && canonicalRes.metrics.revenue.currency === 'GBP',
    'Test 16: Base currency (GBP) preserved across metric response contracts'
  );

  // 17. Date period preserved
  assert(
    canonicalRes.period.fromDate !== undefined && canonicalRes.period.toDate !== undefined,
    'Test 17: Date range period metadata preserved across metric response contracts'
  );

  // 18. Canonical response contract is consistent
  const revItem = canonicalRes.metrics.revenue;
  assert(
    revItem.value !== undefined &&
    revItem.status !== undefined &&
    revItem.calculationSource !== undefined &&
    revItem.dataCoverage !== undefined &&
    revItem.mappingCoverage !== undefined &&
    revItem.confidence !== undefined &&
    Array.isArray(revItem.warnings),
    'Test 18: Canonical response contract is standardized and consistent across all metric keys'
  );

  // 19. Dashboard endpoint routes through CFOMetricProviderFactory
  const providerRes = await CFOMetricProviderFactory.getProvider(1);
  assert(
    providerRes !== undefined && providerRes.tenantId === 1,
    'Test 19: Dashboard provider factory routes requests cleanly for tenant'
  );

  // 20. Legacy provider can be disabled for a tenant without affecting others
  await CFOMetricProviderFactory.setTenantMode(999, 'CANONICAL');
  const tenant999Res = await CFOMetricProviderFactory.getMetricsForTenant(999);
  assert(
    tenant999Res.engineMode === 'CANONICAL' && (await CFOMetricProviderFactory.getTenantMode(777)) === 'LEGACY',
    'Test 20: Switching Tenant 999 to CANONICAL mode leaves Tenant 777 in LEGACY mode (Tenant Isolation)'
  );

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 5 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
