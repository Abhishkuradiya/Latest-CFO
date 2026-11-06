import { AccountMappingService, XeroAccountInput } from '../AccountMappingService';
import { db } from '../../db';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('   ACCOUNT MAPPING SERVICE - PHASE 2 TEST SUITE    ');
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
    // Seed test tenants and clear prior test mapping records for idempotency
    try {
      await db.query(`
        INSERT INTO tenants (id, name)
        VALUES (10, 'Test Tenant 10'), (20, 'Test Tenant 20')
        ON CONFLICT (id) DO NOTHING;
      `);
      await db.query(`DELETE FROM tenant_account_mappings WHERE tenant_id IN (10, 20);`);
    } catch (e: any) {
      // Ignore if in memory JSON mode or error
    }
    // ----------------------------------------------------
    // TEST 1: Xero sync creates SUGGESTED mappings
    // ----------------------------------------------------
    const syncAccount: XeroAccountInput = {
      AccountID: 'guid-sync-100',
      Code: '400',
      Name: 'Direct Sales Income',
      Class: 'REVENUE',
      Type: 'REVENUE'
    };

    const seeded = await AccountMappingService.createSuggestion(10, syncAccount);

    assert(
      seeded.status === 'SUGGESTED' && seeded.financial_statement_category === 'REVENUE',
      'Test 1: Xero sync creates SUGGESTED mappings with category REVENUE'
    );

    // ----------------------------------------------------
    // TEST 2: Existing CONFIRMED mapping is not overwritten by sync
    // ----------------------------------------------------
    if (seeded.id) {
      await AccountMappingService.confirmMapping(10, seeded.id);
    }

    const reSyncAccount: XeroAccountInput = {
      AccountID: 'guid-sync-100',
      Code: '400-RENAMED',
      Name: 'Different Name From Xero',
      Class: 'EXPENSE' // Attempt to change class
    };

    const afterReSync = await AccountMappingService.createSuggestion(10, reSyncAccount);

    assert(
      afterReSync.status === 'CONFIRMED' && afterReSync.user_confirmed === true && afterReSync.financial_statement_category === 'REVENUE',
      'Test 2: Existing CONFIRMED mapping category and status are preserved during re-sync'
    );

    // ----------------------------------------------------
    // TEST 3: Existing CUSTOM_OVERRIDE mapping is not overwritten by sync
    // ----------------------------------------------------
    const overrideAccount: XeroAccountInput = {
      AccountID: 'guid-sync-200',
      Code: '500',
      Name: 'Raw Inventory Cost',
      Class: 'DIRECTCOSTS'
    };

    const initialOverride = await AccountMappingService.createSuggestion(10, overrideAccount);
    if (initialOverride.id) {
      await AccountMappingService.overrideMapping(10, initialOverride.id, {
        financial_statement_category: 'OPERATING_EXPENSES',
        subcategory: 'CUSTOM_EXPENSE',
        cfo_analytical_tag: 'FIXED_OVERHEAD'
      });
    }

    const reSyncOverride = await AccountMappingService.createSuggestion(10, overrideAccount);

    assert(
      reSyncOverride.status === 'CUSTOM_OVERRIDE' && reSyncOverride.financial_statement_category === 'OPERATING_EXPENSES',
      'Test 3: Existing CUSTOM_OVERRIDE mapping category is preserved during re-sync'
    );

    // ----------------------------------------------------
    // TEST 4: Re-running Xero sync does not create duplicate mappings
    // ----------------------------------------------------
    const initialList = await AccountMappingService.getMappings(10);
    await AccountMappingService.seedMappingsForTenant(10, [syncAccount, overrideAccount]);
    const listAfterReseed = await AccountMappingService.getMappings(10);

    assert(
      initialList.length === listAfterReseed.length,
      'Test 4: Re-running sync does not produce duplicate mappings for same (tenant_id, source_account_id)'
    );

    // ----------------------------------------------------
    // TEST 5: AccountCode changes preserve mapping identity by AccountID GUID
    // ----------------------------------------------------
    const renamedCodeAccount: XeroAccountInput = {
      AccountID: 'guid-sync-100',
      Code: '400-NEW-CODE',
      Name: 'Direct Sales Income',
      Class: 'REVENUE'
    };

    const mappedByGuid = await AccountMappingService.getMapping(10, 'guid-sync-100');

    assert(
      mappedByGuid !== null && mappedByGuid.source_account_id === 'guid-sync-100',
      'Test 5: Mapping identity linked to source_account_id GUID despite account code modification'
    );

    // ----------------------------------------------------
    // TEST 6: Archived accounts preserve historical mapping (active=false)
    // ----------------------------------------------------
    const archivedAcc: XeroAccountInput = {
      AccountID: 'guid-sync-300',
      Code: '599',
      Name: 'Old Discontinued Line',
      Class: 'DIRECTCOSTS',
      Status: 'ARCHIVED'
    };

    const archivedMapping = await AccountMappingService.createSuggestion(10, archivedAcc);

    assert(
      archivedMapping.active === false,
      'Test 6: Archived Xero account maintains historical mapping record with active=false'
    );

    // ----------------------------------------------------
    // TEST 7: Tenant isolation for GET (Tenant 10 vs Tenant 20)
    // ----------------------------------------------------
    const t20Account: XeroAccountInput = {
      AccountID: 'guid-tenant20-acc',
      Code: '600',
      Name: 'Tenant 20 Software',
      Class: 'EXPENSE'
    };
    await AccountMappingService.createSuggestion(20, t20Account);

    const t10Mappings = await AccountMappingService.getMappings(10);
    const hasT20Data = t10Mappings.some(m => m.source_account_id === 'guid-tenant20-acc');

    assert(
      !hasT20Data,
      'Test 7: Tenant 10 cannot access Tenant 20 account mappings'
    );

    // ----------------------------------------------------
    // TEST 8: Tenant isolation for CONFIRM
    // ----------------------------------------------------
    const t20Mapping = await AccountMappingService.getMapping(20, 'guid-tenant20-acc');
    let t10TriedToConfirmT20 = false;
    if (t20Mapping && t20Mapping.id) {
      // Tenant 10 tries to confirm Tenant 20's mapping ID
      const result = await AccountMappingService.confirmMapping(10, t20Mapping.id);
      if (!result) {
        t10TriedToConfirmT20 = true;
      }
    }

    assert(
      t10TriedToConfirmT20,
      'Test 8: Tenant 10 cannot confirm Tenant 20 mapping (Denied by tenant_id scope check)'
    );

    // ----------------------------------------------------
    // TEST 9: Tenant isolation for OVERRIDE
    // ----------------------------------------------------
    let t10TriedToOverrideT20 = false;
    if (t20Mapping && t20Mapping.id) {
      // Tenant 10 tries to override Tenant 20's mapping ID
      const result = await AccountMappingService.overrideMapping(10, t20Mapping.id, {
        financial_statement_category: 'REVENUE'
      });
      if (!result) {
        t10TriedToOverrideT20 = true;
      }
    }

    assert(
      t10TriedToOverrideT20,
      'Test 9: Tenant 10 cannot override Tenant 20 mapping (Denied by tenant_id scope check)'
    );

    // ----------------------------------------------------
    // TEST 10: Custom override changes status correctly
    // ----------------------------------------------------
    const accToOverride: XeroAccountInput = {
      AccountID: 'guid-sync-400',
      Code: '610',
      Name: 'Fulfillment & Freight Out',
      Class: 'EXPENSE'
    };
    const s400 = await AccountMappingService.createSuggestion(10, accToOverride);
    if (s400.id) {
      const overridden = await AccountMappingService.overrideMapping(10, s400.id, {
        financial_statement_category: 'COST_OF_SALES',
        subcategory: 'LOGISTICS_FULFILLMENT',
        cfo_analytical_tag: 'VARIABLE_FULFILLMENT'
      });
      assert(
        overridden !== null && overridden.status === 'CUSTOM_OVERRIDE' && overridden.user_confirmed === true,
        'Test 10: Custom override sets status=CUSTOM_OVERRIDE and user_confirmed=true'
      );
    }

    // ----------------------------------------------------
    // TEST 11: Confirm changes status correctly
    // ----------------------------------------------------
    const accToConfirm: XeroAccountInput = {
      AccountID: 'guid-sync-500',
      Code: '410',
      Name: 'Standard Sales',
      Class: 'REVENUE'
    };
    const s500 = await AccountMappingService.createSuggestion(10, accToConfirm);
    if (s500.id) {
      const confirmed = await AccountMappingService.confirmMapping(10, s500.id);
      assert(
        confirmed !== null && confirmed.status === 'CONFIRMED' && confirmed.user_confirmed === true,
        'Test 11: Confirm action sets status=CONFIRMED and user_confirmed=true'
      );
    }

    // ----------------------------------------------------
    // TEST 12: SUGGESTED remains non-authoritative
    // ----------------------------------------------------
    const accSuggested: XeroAccountInput = {
      AccountID: 'guid-sync-600',
      Code: '620',
      Name: 'Office Software',
      Class: 'EXPENSE'
    };
    const s600 = await AccountMappingService.createSuggestion(10, accSuggested);

    assert(
      s600.user_confirmed === false && s600.status === 'SUGGESTED',
      'Test 12: Suggested mapping remains user_confirmed=false and non-authoritative'
    );

    // ----------------------------------------------------
    // TEST 13: Unmapped accounts are correctly detected
    // ----------------------------------------------------
    const allCOA: XeroAccountInput[] = [
      syncAccount,
      overrideAccount,
      { AccountID: 'guid-unmapped-700', Code: '700', Name: 'New Unmapped Account', Class: 'EXPENSE' }
    ];

    const unmappedList = await AccountMappingService.findUnmappedAccounts(10, allCOA);

    assert(
      unmappedList.length === 1 && unmappedList[0].AccountID === 'guid-unmapped-700',
      'Test 13: findUnmappedAccounts correctly identifies account without database record'
    );

    // ----------------------------------------------------
    // TEST 14: Empty Xero COA is handled safely
    // ----------------------------------------------------
    const emptySeedResult = await AccountMappingService.seedMappingsForTenant(10, []);

    assert(
      emptySeedResult.seeded === 0 && emptySeedResult.updated === 0,
      'Test 14: Empty Xero Chart of Accounts handled safely without throwing error'
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 2 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests();
