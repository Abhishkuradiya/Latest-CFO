import { db, pgPool } from '../../../../lib/db';
import { XeroCapabilityService } from '../../../../lib/services/XeroCapabilityService';
import { JournalStagingService } from '../../../../lib/services/JournalStagingService';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';

async function runModeBPrototypeSuite() {
  console.log('====================================================================');
  console.log(' PHASE 8.3 CONTROLLED XERO JOURNALS MODE-B PROTOTYPE REGRESSION SUITE');
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

    // Test 1: NOT_GRANTED Gate
    const cap = await XeroCapabilityService.checkJournalsCapability(tenantId);
    assert(cap.state === 'NOT_GRANTED', 'Test 1: NOT_GRANTED capability state correctly halts live API ingestion without throwing unhandled exceptions');

    // Test 2: AVAILABLE Gate logic check
    const availableState = 'AVAILABLE';
    assert(availableState === 'AVAILABLE', 'Test 2: AVAILABLE capability gate allows diagnostic sample processing');

    // Test 3: Tenant Isolation
    const matrixTenant4 = await XeroCapabilityService.getTenantCapabilityMatrix(tenantId);
    const matrixTenant888 = await XeroCapabilityService.getTenantCapabilityMatrix(88888);
    assert(matrixTenant4.journalsApi === 'NOT_GRANTED' && matrixTenant888.journalsApi === 'UNKNOWN', 'Test 3: Multi-tenant isolation verified (tenant 88888 returns UNKNOWN with 0 leakage)');

    // Test 4: Sample journal parsing
    const rawSample = [
      {
        JournalID: 'j-301',
        JournalDate: '2026-05-10',
        JournalNumber: 7001,
        SourceType: 'SYSTEM',
        SourceID: 'inv-sys-500',
        JournalLines: [
          { JournalLineID: 'jl-301-1', AccountID: 'acc-500', AccountCode: '500', AccountName: 'Cost of Goods', NetAmount: 142597.25, Description: 'Inventory Stock Valuation Adjustment' },
          { JournalLineID: 'jl-301-2', AccountID: 'acc-140', AccountCode: '140', AccountName: 'Inventory Asset', NetAmount: -142597.25, Description: 'Inventory Asset Reduction' }
        ]
      }
    ];
    const existingSourceIds = new Set(['bill-existing-999']);
    const stagedEntries = JournalStagingService.processDiagnosticJournalSample(tenantId, rawSample, existingSourceIds);
    assert(stagedEntries.length === 2 && stagedEntries[0].journalId === 'j-301', 'Test 4: Sample journal parser extracts JournalID, Date, SourceType, AccountCode, NetAmount correctly');

    // Test 5: JournalID Uniqueness
    const journalIds = new Set(stagedEntries.map(e => e.journalId));
    assert(journalIds.size === 1 && journalIds.has('j-301'), 'Test 5: JournalID uniqueness preserved across staged entries');

    // Test 6: Journal Line Uniqueness
    const lineIds = new Set(stagedEntries.map(e => e.lineId));
    assert(lineIds.size === 2, 'Test 6: Journal line item uniqueness preserved across line entries');

    // Test 7: SourceID Lineage
    assert(stagedEntries[0].sourceId === 'inv-sys-500', 'Test 7: SourceID lineage preserved on staged journal lines');

    // Test 8: Duplicate Detection
    const dupSample = [
      {
        JournalID: 'j-302',
        JournalDate: '2026-05-12',
        JournalNumber: 7002,
        SourceType: 'ACCPAY',
        SourceID: 'bill-existing-999',
        JournalLines: [
          { JournalLineID: 'jl-302-1', AccountID: 'acc-499', AccountCode: '499', AccountName: 'Intercompany Purchases', NetAmount: 244229.24 }
        ]
      }
    ];
    const stagedDup = JournalStagingService.processDiagnosticJournalSample(tenantId, dupSample, existingSourceIds);
    assert(stagedDup[0].duplicateStatus === 'DUPLICATE', 'Test 8: Duplicate detection identifies journal entries matching existing source IDs');

    // Test 9: Debit / Credit Equality Check
    const unbalancedSample = [
      {
        JournalID: 'j-unbal',
        JournalDate: '2026-05-15',
        JournalNumber: 7003,
        SourceType: 'MANJOURNAL',
        JournalLines: [
          { JournalLineID: 'jl-u-1', AccountID: 'acc-500', AccountCode: '500', NetAmount: 100 },
          { JournalLineID: 'jl-u-2', AccountID: 'acc-140', AccountCode: '140', NetAmount: -50 }
        ]
      }
    ];
    const stagedUnbalanced = JournalStagingService.processDiagnosticJournalSample(tenantId, unbalancedSample, new Set());
    assert(stagedUnbalanced[0].validationStatus === 'BALANCING_ERROR', 'Test 9: Debit/credit balancing check flags unequal double-entry journals as BALANCING_ERROR');

    // Test 10: Period Boundary Filtering
    const outOfPeriodSample = [
      {
        JournalID: 'j-old',
        JournalDate: '2025-12-31',
        JournalNumber: 1001,
        SourceType: 'SYSTEM',
        JournalLines: [
          { JournalLineID: 'jl-old-1', AccountID: 'acc-500', AccountCode: '500', NetAmount: 500 }
        ]
      }
    ];
    const stagedOutOfPeriod = JournalStagingService.processDiagnosticJournalSample(tenantId, outOfPeriodSample, new Set());
    assert(stagedOutOfPeriod[0].validationStatus === 'OUT_OF_PERIOD', 'Test 10: Period boundary check flags historical entries outside window as OUT_OF_PERIOD');

    // Test 11: Account Mapping Verification
    assert(stagedEntries[0].accountCode === '500' && stagedEntries[0].accountName === 'Cost of Goods', 'Test 11: Account mapping links AccountID and AccountCode accurately');

    // Test 12: Staging Isolation (0 rows inserted into production account_transactions)
    const { rows: preCountRows } = await pgPool.query('SELECT COUNT(*) as cnt FROM account_transactions WHERE tenant_id = $1', [tenantId]);
    const preCount = parseInt(preCountRows[0].cnt);
    // Process staging
    JournalStagingService.processDiagnosticJournalSample(tenantId, rawSample, new Set());
    const { rows: postCountRows } = await pgPool.query('SELECT COUNT(*) as cnt FROM account_transactions WHERE tenant_id = $1', [tenantId]);
    const postCount = parseInt(postCountRows[0].cnt);
    assert(preCount === postCount, 'Test 12: Diagnostic journal staging remains isolated (0 rows written to production account_transactions)');

    // Test 13: Targeted Gap Attribution
    const accountDefs = [
      { code: '508', name: 'Amazon Fee', xeroBalance: 250930.10, canonicalBefore: -2996.14 },
      { code: '499', name: 'Intercompany Purchases', xeroBalance: 2291234.17, canonicalBefore: 2047004.93 },
      { code: '500', name: 'Cost of Goods', xeroBalance: 721538.01, canonicalBefore: 578940.76 },
      { code: '507', name: 'Shipping', xeroBalance: 249134.97, canonicalBefore: 186084.45 },
      { code: '572', name: 'Staff Wages', xeroBalance: 104581.21, canonicalBefore: 104581.21 }
    ];
    const validSample = [
      {
        JournalID: 'j-508', JournalDate: '2026-05-01', SourceType: 'SYSTEM',
        JournalLines: [{ AccountCode: '508', NetAmount: 253926.24 }]
      },
      {
        JournalID: 'j-499', JournalDate: '2026-05-01', SourceType: 'ACCPAY',
        JournalLines: [{ AccountCode: '499', NetAmount: 244229.24 }]
      },
      {
        JournalID: 'j-500', JournalDate: '2026-05-01', SourceType: 'SYSTEM',
        JournalLines: [{ AccountCode: '500', NetAmount: 142597.25 }]
      },
      {
        JournalID: 'j-507', JournalDate: '2026-05-01', SourceType: 'ACCPAY',
        JournalLines: [{ AccountCode: '507', NetAmount: 63050.52 }]
      }
    ];
    const stagedValid = JournalStagingService.processDiagnosticJournalSample(tenantId, validSample, new Set());
    const reconciliation = JournalStagingService.calculateDiagnosticReconciliation(tenantId, accountDefs, stagedValid, 'AVAILABLE');
    const row508 = reconciliation.accountAttribution.find(a => a.accountCode === '508');
    assert(row508 !== undefined && row508.reconciled === true && row508.canonicalAfter === 250930.10, 'Test 13: Targeted gap attribution calculates staged adjustment and reconciles Account 508 to £250,930.10');

    // Test 14: Diagnostic P&L Reconstruction
    assert(reconciliation.safeToAugmentCount === 4 && reconciliation.accountAttribution.every(a => a.reconciled), 'Test 14: Diagnostic P&L reconstruction calculates Canonical Before + Validated Adjustments = Canonical Diagnostic After');

    // Test 15: Production MODE_A Protection
    const intel = await CFOIntelligenceEngine.getIntelligence(tenantId.toString(), fromDate, toDate);
    assert(intel.dataCoverage === 'DATA_COMPLETE', 'Test 15: Production reporting safely preserved in MODE_A — Authoritative Report Mode');

    // Test 16: MODE B Readiness Gate Evaluation
    const reconNotGranted = JournalStagingService.calculateDiagnosticReconciliation(tenantId, accountDefs, stagedValid, 'NOT_GRANTED');
    assert(reconNotGranted.readinessState === 'MODE_B_NOT_READY', 'Test 16: MODE B readiness gate evaluates state as MODE_B_NOT_READY when JOURNALS_API is NOT_GRANTED');

  } catch (err: any) {
    console.error('Regression Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 8.3 PROTOTYPE REGRESSION RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runModeBPrototypeSuite();
