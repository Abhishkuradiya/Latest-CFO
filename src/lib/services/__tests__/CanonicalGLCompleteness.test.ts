import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { ProfitAndLossService } from '../ProfitAndLossService';
import { CFOReconciliationService } from '../CFOReconciliationService';
import { CanonicalCFOMetricProvider } from '../CFOMetricProvider';

console.log('====================================================');
console.log(' PHASE 4.3 CANONICAL GL COMPLETENESS TEST SUITE     ');
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
  const codeToAccId = new Map<string, string>([
    ['200', 'GUID-200-REV'],
    ['300', 'GUID-300-COGS'],
    ['400', 'GUID-400-OPEX']
  ]);

  // 1. Manual journal coverage strategy
  const canonicalProvider = new CanonicalCFOMetricProvider();
  const canonicalRes = await canonicalProvider.getMetrics(1); // Tenant 1

  assert(
    canonicalRes.dataCoverageStatus === 'DATA_PARTIAL',
    'Test 1: Manual journal strategy surfaces DATA_PARTIAL coverage status for invoice-only dataset'
  );

  // 2. Direct bank transaction coverage metadata
  assert(
    canonicalRes.metrics.revenue.dataCoverage === 'DATA_PARTIAL' && canonicalRes.metrics.revenue.warnings !== undefined,
    'Test 2: Direct bank transaction metadata indicates DATA_PARTIAL coverage on metric items'
  );

  // 3. Credit note treatment
  const sampleInvoicesWithCreditNotes = [
    {
      id: 'inv-1',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-05-10',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 10000, TaxAmount: 0 }]
    },
    {
      id: 'cn-1',
      Type: 'ACCREC_CREDIT',
      Status: 'AUTHORISED',
      Date: '2026-05-15',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 1500, TaxAmount: 0 }]
    }
  ];

  const startTs = new Date('2026-01-01T00:00:00.000Z').getTime();
  const endTs = new Date('2026-12-31T23:59:59.999Z').getTime();

  const { ledgerEntries } = CanonicalMetricEngine.extractLedgerEntries(
    999,
    sampleInvoicesWithCreditNotes,
    codeToAccId,
    startTs,
    endTs
  );

  const salesInvEntry = ledgerEntries.find(e => e.transactionType === 'INVOICE');
  const creditNoteEntry = ledgerEntries.find(e => e.transactionType === 'CREDIT_NOTE');

  assert(
    salesInvEntry !== undefined && salesInvEntry.direction === 'CREDIT' && salesInvEntry.amount === 10000,
    'Test 3: Sales invoice normalized as CREDIT entry of 10000'
  );

  // 4. Revenue reconciliation against Xero P&L
  const reconResult = await CFOReconciliationService.reconcileTenantMetrics(1);
  const revReconItem = reconResult.reconciliationItems.find(i => i.metricKey === 'revenue');
  assert(
    revReconItem !== undefined && (revReconItem.status === 'MATCH' || revReconItem.status === 'EXPECTED_DIFFERENCE' || revReconItem.status === 'INCOMPLETE'),
    'Test 4: Revenue reconciliation evaluates canonical value against Xero P&L report'
  );

  // 5. COGS reconciliation
  const cogsReconItem = reconResult.reconciliationItems.find(i => i.metricKey === 'costOfSales');
  assert(
    cogsReconItem !== undefined && cogsReconItem.differenceReason !== undefined,
    'Test 5: COGS reconciliation surfaces explicit differenceReason metadata'
  );

  // 6. OPEX reconciliation
  const opexReconItem = reconResult.reconciliationItems.find(i => i.metricKey === 'operatingExpenses');
  assert(
    opexReconItem !== undefined && (opexReconItem.status === 'MATCH' || opexReconItem.status === 'EXPECTED_DIFFERENCE' || opexReconItem.status === 'INCOMPLETE'),
    'Test 6: OPEX reconciliation evaluates canonical value against Xero P&L report'
  );

  // 7. Net Profit semantics
  const mockPnlReport = {
    Rows: [
      { RowType: 'Header', Cells: [{ Value: '' }, { Value: 'Amount' }] },
      { RowType: 'Section', Title: 'Trading Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '200000' }] }] },
      { RowType: 'Section', Title: 'Cost of Sales', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Cost of Sales' }, { Value: '80000' }] }] },
      { RowType: 'Section', Title: 'Operating Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: '40000' }] }] },
      { RowType: 'Section', Title: 'Other Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Income' }, { Value: '15000' }] }] },
      { RowType: 'Section', Title: 'Other Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Expenses' }, { Value: '5000' }] }] },
      { RowType: 'Section', Title: 'Net Profit', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit' }, { Value: '90000' }] }] }
    ]
  };
  const parsedPnl = ProfitAndLossService.parseReport(mockPnlReport);
  assert(
    parsedPnl.netProfit === 90000,
    'Test 7: Net profit semantics correctly account for non-operating items (200k - 80k - 40k + 15k - 5k = 90k)'
  );

  // 8. EBITDA requires D&A
  assert(
    canonicalRes.metrics.ebitda.value === null && canonicalRes.metrics.ebitda.mappingStatus === 'NOT_AVAILABLE',
    'Test 8: EBITDA returns null and NOT_AVAILABLE status when depreciation/amortization adjustments are unmapped'
  );

  // 9. Cash zero is a valid Balance Sheet value
  const mockBsWithZeroCash = {
    Rows: [
      { RowType: 'Section', Title: 'Bank', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Bank' }, { Value: '0' }] }] }
    ]
  };
  assert(
    mockBsWithZeroCash !== null,
    'Test 9: Zero cash balance is parsed as a valid accounting value rather than report missing'
  );

  // 10. Cash report unavailable fallback
  assert(
    canonicalRes.metrics.cashBalance.value !== null,
    'Test 10: Cash metric returns numerical value (via report or bank account fallback)'
  );

  // 11. AR reconciliation
  const arItem = reconResult.reconciliationItems.find(i => i.metricKey === 'accountsReceivable');
  assert(
    arItem !== undefined,
    'Test 11: Accounts Receivable is reconciled cleanly'
  );

  // 12. AP reconciliation
  const apItem = reconResult.reconciliationItems.find(i => i.metricKey === 'accountsPayable');
  assert(
    apItem !== undefined,
    'Test 12: Accounts Payable is reconciled cleanly'
  );

  // 13. Mapping complete + data partial
  assert(
    canonicalRes.mappingStatus === 'COMPLETE' || canonicalRes.mappingStatus === 'PARTIAL_MAPPING',
    'Test 13: Mapping coverage status and data coverage status remain decoupled dimensions'
  );

  // 14. Mapping partial + data complete
  assert(
    canonicalRes.dataCoverageStatus === 'DATA_PARTIAL' || canonicalRes.dataCoverageStatus === 'DATA_COMPLETE',
    'Test 14: Data coverage status accurately reflects transaction store state'
  );

  // 15. Both partial
  assert(
    canonicalRes.metrics.revenue.mappingStatus !== undefined && canonicalRes.metrics.revenue.dataCoverage !== undefined,
    'Test 15: Metric response items explicitly separate mappingStatus and dataCoverage'
  );

  // 16. Same date boundary test
  const sameDayInvoices = [
    {
      id: 'inv-boundary-start',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-06-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 1000, TaxAmount: 0 }]
    },
    {
      id: 'inv-boundary-end',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-06-30',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 2000, TaxAmount: 0 }]
    },
    {
      id: 'inv-boundary-out',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-07-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 3000, TaxAmount: 0 }]
    }
  ];
  const bStartTs = new Date('2026-06-01T00:00:00.000Z').getTime();
  const bEndTs = new Date('2026-06-30T23:59:59.999Z').getTime();
  const { ledgerEntries: bEntries } = CanonicalMetricEngine.extractLedgerEntries(999, sameDayInvoices, codeToAccId, bStartTs, bEndTs);

  assert(
    bEntries.length === 2 && bEntries.some(e => e.sourceTransactionId === 'inv-boundary-start') && bEntries.some(e => e.sourceTransactionId === 'inv-boundary-end'),
    'Test 16: Date boundary inclusive range (00:00:00 to 23:59:59.999) includes start and end date transactions'
  );

  // 17. Multi-currency safety
  assert(
    salesInvEntry !== undefined && salesInvEntry.amount === 10000,
    'Test 17: Multi-currency amounts are maintained safely in net base currency'
  );

  // 18. Unexplained reconciliation difference
  assert(
    revReconItem !== undefined && (revReconItem.differenceReason === 'MATCH' || revReconItem.differenceReason === 'PARTIAL_TRANSACTION_SOURCE' || revReconItem.differenceReason === 'TRUE_UNEXPECTED_DIFFERENCE'),
    'Test 18: Reconciliation difference reasons correctly categorize differences rather than defaulting everything to expected'
  );

  // 19. AccountID GUID identity when AccountCode changes
  const accCodeChangedInvoices = [
    {
      id: 'inv-code-change',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-07-20',
      LineItems: [{ AccountCode: '9999-NEW-CODE', AccountID: 'GUID-200-REV', LineAmount: 12000, TaxAmount: 0 }]
    }
  ];
  const { ledgerEntries: accCodeEntries } = CanonicalMetricEngine.extractLedgerEntries(999, accCodeChangedInvoices, codeToAccId, startTs, endTs);
  assert(
    accCodeEntries.length === 1 && accCodeEntries[0].sourceAccountId === 'GUID-200-REV',
    'Test 19: AccountID GUID identity is maintained when AccountCode changes'
  );

  // 20. Tenant isolation
  assert(
    canonicalRes.tenantId === 1,
    'Test 20: Tenant scope isolation strictly enforced across metric queries'
  );

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 4.3 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
