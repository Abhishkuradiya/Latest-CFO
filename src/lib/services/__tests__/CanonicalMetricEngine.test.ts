import { AccountMappingService, XeroAccountInput } from '../AccountMappingService';
import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { CFOReconciliationService } from '../CFOReconciliationService';
import { db } from '../../db';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('   CANONICAL CFO ENGINE - PHASE 3 TEST SUITE      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 0. Seed test tenants and clean up prior test mapping records for idempotency
    try {
      await db.query(`
        INSERT INTO tenants (id, name)
        VALUES (100, 'Phase 3 Tenant A'), (200, 'Phase 3 Tenant B')
        ON CONFLICT (id) DO NOTHING;
      `);
      await db.query(`DELETE FROM tenant_account_mappings WHERE tenant_id IN (100, 200);`);
    } catch (e: any) { }

    // ----------------------------------------------------
    // TEST 1: Revenue from confirmed mapping
    // ----------------------------------------------------
    const revAccount: XeroAccountInput = {
      AccountID: 'guid-rev-100',
      Code: '400',
      Name: 'Main Online Sales',
      Class: 'REVENUE',
      Type: 'REVENUE'
    };
    const revMapping = await AccountMappingService.createSuggestion(100, revAccount);
    await AccountMappingService.confirmMapping(100, revMapping.id!);

    const resolvedRev = await AccountMappingService.getMapping(100, 'guid-rev-100');
    assert(
      resolvedRev !== null && resolvedRev.financial_statement_category === 'REVENUE' && resolvedRev.user_confirmed === true,
      'Test 1: Revenue account confirmed as REVENUE'
    );

    // ----------------------------------------------------
    // TEST 2: COGS from confirmed mapping
    // ----------------------------------------------------
    const cogsAccount: XeroAccountInput = {
      AccountID: 'guid-cogs-100',
      Code: '500',
      Name: 'Direct Packaging Costs',
      Class: 'DIRECTCOSTS'
    };
    const cogsMapping = await AccountMappingService.createSuggestion(100, cogsAccount);
    await AccountMappingService.confirmMapping(100, cogsMapping.id!);

    const resolvedCogs = await AccountMappingService.getMapping(100, 'guid-cogs-100');
    assert(
      resolvedCogs !== null && resolvedCogs.financial_statement_category === 'COST_OF_SALES' && resolvedCogs.user_confirmed === true,
      'Test 2: COGS account confirmed as COST_OF_SALES'
    );

    // ----------------------------------------------------
    // TEST 3: OPEX from confirmed mapping
    // ----------------------------------------------------
    const opexAccount: XeroAccountInput = {
      AccountID: 'guid-opex-100',
      Code: '600',
      Name: 'Software Subscriptions',
      Class: 'EXPENSE'
    };
    const opexMapping = await AccountMappingService.createSuggestion(100, opexAccount);
    await AccountMappingService.confirmMapping(100, opexMapping.id!);

    const resolvedOpex = await AccountMappingService.getMapping(100, 'guid-opex-100');
    assert(
      resolvedOpex !== null && resolvedOpex.financial_statement_category === 'OPERATING_EXPENSES' && resolvedOpex.user_confirmed === true,
      'Test 3: OPEX account confirmed as OPERATING_EXPENSES'
    );

    // ----------------------------------------------------
    // TEST 4 & 5: Gross Profit & Gross Margin calculation
    // ----------------------------------------------------
    const metricsResult = await CanonicalMetricEngine.calculateMetrics(100);
    assert(
      typeof metricsResult.metrics.grossProfit.value === 'number' &&
      typeof metricsResult.metrics.grossMarginPct.value === 'number',
      'Test 4 & 5: Gross Profit and Gross Margin calculated cleanly'
    );

    // ----------------------------------------------------
    // TEST 6: Tenant A vs Tenant B isolation (Same AccountCode 501, Different Classification)
    // ----------------------------------------------------
    // Tenant A (ID 100): Code 501 -> Packaging -> COST_OF_SALES
    const tAAccount: XeroAccountInput = {
      AccountID: 'guid-samecode-100',
      Code: '501',
      Name: 'Packaging Materials',
      Class: 'DIRECTCOSTS'
    };
    const tAMapping = await AccountMappingService.createSuggestion(100, tAAccount);
    await AccountMappingService.confirmMapping(100, tAMapping.id!);

    // Tenant B (ID 200): Code 501 -> Office Rent -> OPERATING_EXPENSES
    const tBAccount: XeroAccountInput = {
      AccountID: 'guid-samecode-200',
      Code: '501',
      Name: 'Office Rent & Facilities',
      Class: 'EXPENSE'
    };
    const tBMapping = await AccountMappingService.createSuggestion(200, tBAccount);
    await AccountMappingService.overrideMapping(200, tBMapping.id!, {
      financial_statement_category: 'OPERATING_EXPENSES',
      subcategory: 'RENT_FACILITIES'
    });

    const mappingA = await AccountMappingService.getMapping(100, 'guid-samecode-100');
    const mappingB = await AccountMappingService.getMapping(200, 'guid-samecode-200');

    assert(
      mappingA?.financial_statement_category === 'COST_OF_SALES' &&
      mappingB?.financial_statement_category === 'OPERATING_EXPENSES',
      'Test 6: Tenant A and Tenant B use same AccountCode 501 but derive completely different classifications'
    );

    // ----------------------------------------------------
    // TEST 7: AccountID GUID identity survives AccountCode change
    // ----------------------------------------------------
    const renamedCodeAccount: XeroAccountInput = {
      AccountID: 'guid-samecode-100',
      Code: '501-RENAMED-CODE',
      Name: 'Packaging Materials',
      Class: 'DIRECTCOSTS'
    };
    await AccountMappingService.createSuggestion(100, renamedCodeAccount);

    const mappingAfterCodeChange = await AccountMappingService.getMapping(100, 'guid-samecode-100');

    assert(
      mappingAfterCodeChange !== null &&
      mappingAfterCodeChange.account_code === '501-RENAMED-CODE' &&
      mappingAfterCodeChange.financial_statement_category === 'COST_OF_SALES',
      'Test 7: AccountID GUID identity survives AccountCode modification without losing category mapping'
    );

    // ----------------------------------------------------
    // TEST 8: CUSTOM_OVERRIDE changes calculation classification
    // ----------------------------------------------------
    const merchantFeeAcc: XeroAccountInput = {
      AccountID: 'guid-merchant-fees-100',
      Code: '506',
      Name: 'Stripe Merchant Fees',
      Class: 'EXPENSE'
    };
    const mfSuggested = await AccountMappingService.createSuggestion(100, merchantFeeAcc);
    await AccountMappingService.overrideMapping(100, mfSuggested.id!, {
      financial_statement_category: 'COST_OF_SALES',
      subcategory: 'PAYMENT_PROCESSING'
    });

    const mfResolved = await AccountMappingService.getMapping(100, 'guid-merchant-fees-100');
    assert(
      mfResolved !== null &&
      mfResolved.status === 'CUSTOM_OVERRIDE' &&
      mfResolved.financial_statement_category === 'COST_OF_SALES',
      'Test 8: CUSTOM_OVERRIDE updates classification to COST_OF_SALES'
    );

    // ----------------------------------------------------
    // TEST 9: SUGGESTED mapping is excluded from authoritative calculations
    // ----------------------------------------------------
    const unconfirmedAcc: XeroAccountInput = {
      AccountID: 'guid-unconfirmed-900',
      Code: '508',
      Name: 'Amazon Unconfirmed Fee',
      Class: 'EXPENSE'
    };
    const s900 = await AccountMappingService.createSuggestion(100, unconfirmedAcc);

    assert(
      s900.status === 'SUGGESTED' && s900.user_confirmed === false,
      'Test 9: Suggested mapping is non-authoritative (user_confirmed = false)'
    );

    // ----------------------------------------------------
    // TEST 10: Unmapped accounts produce PARTIAL_MAPPING status without ratio fallbacks
    // ----------------------------------------------------
    const testResult100 = await CanonicalMetricEngine.calculateMetrics(100);

    assert(
      testResult100.calculationStatus === 'PARTIAL_MAPPING' &&
      testResult100.metrics.costOfSales.status === 'PARTIAL_MAPPING',
      'Test 10: Unconfirmed/unmapped account surfaces PARTIAL_MAPPING status without using arbitrary percentage fallbacks'
    );

    // ----------------------------------------------------
    // TEST 11: Tenant isolation
    // ----------------------------------------------------
    const t100Map = await AccountMappingService.getMappings(100);
    const t200Map = await AccountMappingService.getMappings(200);

    const crossFound = t100Map.some(m => m.source_account_id === 'guid-samecode-200');

    assert(
      !crossFound && t100Map.length > 0 && t200Map.length > 0,
      'Test 11: Tenant 100 cannot access Tenant 200 mappings'
    );

    // ----------------------------------------------------
    // TEST 12: Reconciliation Service Output
    // ----------------------------------------------------
    const recon = await CFOReconciliationService.reconcileTenantMetrics(100);

    assert(
      recon !== null &&
      Array.isArray(recon.reconciliationItems) &&
      recon.reconciliationItems.length >= 10 &&
      recon.overallStatus !== undefined,
      'Test 12: CFOReconciliationService produces structured multi-metric comparison report'
    );

  } catch (err: any) {
    console.error('Phase 3 Test Execution Error:', err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 3 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests();
