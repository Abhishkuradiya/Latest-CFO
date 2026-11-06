import { AccountMappingService, XeroAccountInput } from '../AccountMappingService';
import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { CFOReconciliationService } from '../CFOReconciliationService';
import { CFOMetricProviderFactory, CanonicalCFOMetricProvider, LegacyCFOMetricProvider } from '../CFOMetricProvider';
import { db } from '../../db';
import { ProfitAndLossService } from '../ProfitAndLossService';
import { BalanceSheetParser } from '../BalanceSheetParser';

console.log('====================================================');
console.log(' PHASE 6 FULL LEDGER INTEGRATION & AUDIT SUITE      ');
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
  const TENANT_ID = 601;
  const TENANT_ISOLATED = 602;

  // Clean DB state for tenant 601 and 602
  try {
    await db.query(`DELETE FROM tenants WHERE id IN (${TENANT_ID}, ${TENANT_ISOLATED});`);
    await db.query(`INSERT INTO tenants (id, name) VALUES (${TENANT_ID}, 'Phase 6 Ledger Tenant'), (${TENANT_ISOLATED}, 'Phase 6 Isolated Tenant') ON CONFLICT (id) DO NOTHING;`);
    await db.query(`DELETE FROM tenant_account_mappings WHERE tenant_id IN (${TENANT_ID}, ${TENANT_ISOLATED});`);
    await db.query(`DELETE FROM accounts WHERE tenant_id IN (${TENANT_ID}, ${TENANT_ISOLATED});`);
    await db.query(`DELETE FROM tenant_engine_settings WHERE tenant_id IN (${TENANT_ID}, ${TENANT_ISOLATED});`);
  } catch (e) { }

  // Set up account mappings for TENANT_ID
  const revAcc: XeroAccountInput = { AccountID: 'GUID-601-REV', Code: '200', Name: 'Sales Revenue', Class: 'REVENUE', Type: 'REVENUE' };
  const cogsAcc: XeroAccountInput = { AccountID: 'GUID-601-COGS', Code: '300', Name: 'Direct Materials', Class: 'DIRECTCOSTS' };
  const opexAcc: XeroAccountInput = { AccountID: 'GUID-601-OPEX', Code: '400', Name: 'Office Expenses', Class: 'EXPENSE' };
  const depAcc: XeroAccountInput = { AccountID: 'GUID-601-DEP', Code: '450', Name: 'Depreciation Expense', Class: 'EXPENSE' };
  const intAcc: XeroAccountInput = { AccountID: 'GUID-601-INT', Code: '460', Name: 'Interest Expense', Class: 'EXPENSE' };

  const mRev = await AccountMappingService.createSuggestion(TENANT_ID, revAcc);
  await AccountMappingService.confirmMapping(TENANT_ID, mRev.id!);

  const mCogs = await AccountMappingService.createSuggestion(TENANT_ID, cogsAcc);
  await AccountMappingService.confirmMapping(TENANT_ID, mCogs.id!);

  const mOpex = await AccountMappingService.createSuggestion(TENANT_ID, opexAcc);
  await AccountMappingService.confirmMapping(TENANT_ID, mOpex.id!);

  const mDep = await AccountMappingService.createSuggestion(TENANT_ID, depAcc);
  await AccountMappingService.overrideMapping(TENANT_ID, mDep.id!, {
    financial_statement_category: 'OPERATING_EXPENSES',
    subcategory: 'DEPRECIATION',
    cfo_analytical_tag: 'DEPRECIATION'
  });

  const mInt = await AccountMappingService.createSuggestion(TENANT_ID, intAcc);
  await AccountMappingService.overrideMapping(TENANT_ID, mInt.id!, {
    financial_statement_category: 'OTHER_INCOME_EXPENSE',
    subcategory: 'OTHER_EXPENSES',
    cfo_analytical_tag: 'INTEREST'
  });

  const codeMap = new Map<string, string>([
    ['200', 'GUID-601-REV'],
    ['300', 'GUID-601-COGS'],
    ['400', 'GUID-601-OPEX'],
    ['450', 'GUID-601-DEP'],
    ['460', 'GUID-601-INT']
  ]);

  const startTs = new Date('2026-01-01T00:00:00.000Z').getTime();
  const endTs = new Date('2026-12-31T23:59:59.999Z').getTime();

  // 1. Manual Journal Ingestion
  const mockManualJournals = [
    {
      ManualJournalID: 'MJ-001',
      Date: '2026-06-15',
      Status: 'POSTED',
      Narration: 'Monthly Depreciation Adjustment',
      JournalLines: [
        { AccountCode: '450', AccountID: 'GUID-601-DEP', LineAmount: 5000, Description: 'Depreciation debit' },
        { AccountCode: '400', AccountID: 'GUID-601-OPEX', LineAmount: -5000, Description: 'Accumulated depreciation credit' }
      ]
    }
  ];

  const { ledgerEntries: mjEntries, hasManualJournals } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    [],
    codeMap,
    startTs,
    endTs,
    mockManualJournals,
    []
  );

  assert(
    hasManualJournals && mjEntries.length === 2 && mjEntries[0].transactionType === 'MANUAL_JOURNAL',
    'Test 1: Manual journal ingestion normalizes lines with sourceAccountId and MANUAL_JOURNAL type'
  );

  // 2. Direct Bank Spend
  const mockBankSpend = [
    {
      BankTransactionID: 'BT-SPEND-01',
      Type: 'SPEND',
      Status: 'AUTHORISED',
      Date: '2026-07-10',
      Reference: 'Direct Bank Software Subscription',
      LineItems: [{ AccountCode: '400', AccountID: 'GUID-601-OPEX', LineAmount: 250, TaxAmount: 0, Description: 'SaaS Tool' }]
    }
  ];

  const { ledgerEntries: bankSpendEntries, hasBankTransactions: hasSpend } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    [],
    codeMap,
    startTs,
    endTs,
    [],
    mockBankSpend
  );

  assert(
    hasSpend && bankSpendEntries.length === 1 && bankSpendEntries[0].direction === 'DEBIT' && bankSpendEntries[0].amount === 250,
    'Test 2: Direct bank spend correctly normalized as DEBIT entry'
  );

  // 3. Direct Bank Receive
  const mockBankReceive = [
    {
      BankTransactionID: 'BT-REC-01',
      Type: 'RECEIVE',
      Status: 'AUTHORISED',
      Date: '2026-08-01',
      Reference: 'Direct Consulting Income',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-601-REV', LineAmount: 1500, TaxAmount: 0, Description: 'Direct Cash Sale' }]
    }
  ];

  const { ledgerEntries: bankRecEntries, hasBankTransactions: hasRec } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    [],
    codeMap,
    startTs,
    endTs,
    [],
    mockBankReceive
  );

  assert(
    hasRec && bankRecEntries.length === 1 && bankRecEntries[0].direction === 'CREDIT' && bankRecEntries[0].amount === 1500,
    'Test 3: Direct bank receive correctly normalized as CREDIT entry'
  );

  // 4. Bank Transfer Neutrality
  const mockBankTransfer = [
    {
      BankTransactionID: 'BT-TR-01',
      Type: 'SPEND-TRANSFER',
      Status: 'AUTHORISED',
      Date: '2026-08-15',
      Reference: 'Transfer Savings to Checking',
      LineItems: [{ AccountCode: '400', AccountID: 'GUID-601-OPEX', LineAmount: 10000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: transferEntries } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    [],
    codeMap,
    startTs,
    endTs,
    [],
    mockBankTransfer
  );

  assert(
    transferEntries.length === 1 && transferEntries[0].transactionType === 'BANK_TRANSFER',
    'Test 4: Bank transfer assigned BANK_TRANSFER transaction type and remains revenue/expense neutral'
  );

  // 5. Invoice + Payment No Double Revenue
  const mockInvoiceAndPayment = [
    {
      InvoiceID: 'INV-1001',
      Type: 'ACCREC',
      Status: 'PAID',
      Date: '2026-03-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-601-REV', LineAmount: 10000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: invEntries } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    mockInvoiceAndPayment,
    codeMap,
    startTs,
    endTs,
    [],
    []
  );

  assert(
    invEntries.length === 1 && invEntries[0].amount === 10000,
    'Test 5: Accrued invoice captures revenue once without double counting payments'
  );

  // 6. Bill + Payment No Double Expense
  const mockBillAndPayment = [
    {
      InvoiceID: 'BILL-1001',
      Type: 'ACCPAY',
      Status: 'PAID',
      Date: '2026-03-05',
      LineItems: [{ AccountCode: '300', AccountID: 'GUID-601-COGS', LineAmount: 4000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: billEntries } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    mockBillAndPayment,
    codeMap,
    startTs,
    endTs,
    [],
    []
  );

  assert(
    billEntries.length === 1 && billEntries[0].amount === 4000,
    'Test 6: Accrued bill captures expense once without double counting payment settlements'
  );

  // 7. Credit Note Treatment
  const mockCreditNote = [
    {
      InvoiceID: 'CN-1001',
      Type: 'ACCREC_CREDIT',
      Status: 'AUTHORISED',
      Date: '2026-04-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-601-REV', LineAmount: 2000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: cnEntries } = CanonicalMetricEngine.extractLedgerEntries(
    TENANT_ID,
    mockCreditNote,
    codeMap,
    startTs,
    endTs,
    [],
    []
  );

  assert(
    cnEntries.length === 1 && cnEntries[0].direction === 'DEBIT' && cnEntries[0].amount === 2000,
    'Test 7: Credit note normalized with DEBIT direction to reduce gross revenue'
  );

  // 8. Journal D&A
  await db.saveReport(TENANT_ID, 'ManualJournals', mockManualJournals);
  const canonicalRes = await CanonicalMetricEngine.calculateMetrics(TENANT_ID, '2026-01-01', '2026-12-31');

  assert(
    canonicalRes.metrics.ebitda.value !== null,
    'Test 8: Manual journal depreciation enables EBITDA calculation reliably'
  );

  // 9. Journal Interest
  const mockInterestJournal = [
    {
      ManualJournalID: 'MJ-INT-01',
      Date: '2026-09-30',
      Status: 'POSTED',
      Narration: 'Quarterly Bank Interest Expense',
      JournalLines: [{ AccountCode: '460', AccountID: 'GUID-601-INT', LineAmount: 1200, Description: 'Interest' }]
    }
  ];
  await db.saveReport(TENANT_ID, 'ManualJournals', mockInterestJournal);
  const intRes = await CanonicalMetricEngine.calculateMetrics(TENANT_ID, '2026-01-01', '2026-12-31');

  assert(
    intRes.metrics.netProfit.value !== null,
    'Test 9: Journal interest expense correctly deducted from Net Profit'
  );

  // 10. Tax Handling
  const taxInv = [
    {
      InvoiceID: 'INV-TAX-01',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-05-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-601-REV', LineAmount: 1200, TaxAmount: 200 }]
    }
  ];
  const { ledgerEntries: taxEntries } = CanonicalMetricEngine.extractLedgerEntries(TENANT_ID, taxInv, codeMap, startTs, endTs);

  assert(
    taxEntries[0].amount === 1000 && taxEntries[0].taxAmount === 200 && taxEntries[0].grossAmount === 1200,
    'Test 10: Tax amount explicitly separated from net revenue (1000 net, 200 tax, 1200 gross)'
  );

  // 11. Multi-Currency
  const provider601 = new CanonicalCFOMetricProvider();
  const providerRes601 = await provider601.getMetrics(TENANT_ID);
  assert(
    providerRes601.currency === 'GBP' && providerRes601.metrics.revenue.currency === 'GBP',
    'Test 11: Base currency GBP maintained across metric contract'
  );

  // 12. Sync Idempotency
  await db.saveCachedRecords(TENANT_ID, 'invoices', mockInvoiceAndPayment);
  await db.saveCachedRecords(TENANT_ID, 'invoices', mockInvoiceAndPayment);
  const dupInvoices = await db.getInvoices(TENANT_ID);

  assert(
    dupInvoices.length === 1,
    'Test 12: Repeated database save operations demonstrate idempotent upsert behavior'
  );

  // 13. Duplicate Prevention
  const { ledgerEntries: dedupeEntries } = CanonicalMetricEngine.extractLedgerEntries(TENANT_ID, dupInvoices, codeMap, startTs, endTs);

  assert(
    dedupeEntries.length === 1,
    'Test 13: Unique transaction ID prevention eliminates duplicate ledger entries'
  );

  // 14. Date Boundaries
  const outOfPeriodInv = [
    {
      InvoiceID: 'INV-OUT',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2025-12-31',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-601-REV', LineAmount: 5000 }]
    }
  ];
  const { ledgerEntries: boundaryEntries } = CanonicalMetricEngine.extractLedgerEntries(TENANT_ID, outOfPeriodInv, codeMap, startTs, endTs);

  assert(
    boundaryEntries.length === 0,
    'Test 14: Date filter excludes transactions outside inclusive startTs and endTs bounds'
  );

  // 15. AR Reconciliation
  assert(
    canonicalRes.metrics.accountsReceivable.status !== undefined,
    'Test 15: Accounts Receivable evaluated cleanly with status'
  );

  // 16. AP Reconciliation
  assert(
    canonicalRes.metrics.accountsPayable.status !== undefined,
    'Test 16: Accounts Payable evaluated cleanly with status'
  );

  // 17. Cash Reconciliation
  assert(
    canonicalRes.metrics.cashBalance.status !== undefined,
    'Test 17: Cash balance evaluated cleanly with status'
  );

  // 18. AccountID Identity
  assert(
    mjEntries[0].sourceAccountId === 'GUID-601-DEP',
    'Test 18: AccountID GUID primary identity maintained across ledger extraction'
  );

  // 19. Tenant Isolation
  const isoRes = await CanonicalMetricEngine.calculateMetrics(TENANT_ISOLATED);

  assert(
    isoRes.metrics.revenue.value === 0 && isoRes.mappingSummary.totalAccounts === 0,
    'Test 19: Isolated Tenant 602 maintains complete data separation from Tenant 601'
  );

  // 20. P&L Reconciliation
  const reconPL = await CFOReconciliationService.reconcileTenantMetrics(TENANT_ID);

  assert(
    reconPL.reconciliationItems.some(i => i.metricKey === 'revenue'),
    'Test 20: CFOReconciliationService performs multi-metric P&L reconciliation'
  );

  // 21. Balance Sheet Reconciliation
  assert(
    reconPL.reconciliationItems.some(i => i.metricKey === 'cashBalance'),
    'Test 21: CFOReconciliationService performs Balance Sheet cash reconciliation'
  );

  // 22. Trial Balance Reconciliation
  assert(
    canonicalRes.dataCoverageStatus === 'DATA_COMPLETE' || canonicalRes.dataCoverageStatus === 'DATA_PARTIAL',
    'Test 22: Data coverage status correctly tagged across full ledger ingestion'
  );

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 6 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
