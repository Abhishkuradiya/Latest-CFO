import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { ProfitAndLossService } from '../ProfitAndLossService';
import { AccountMappingService } from '../AccountMappingService';
import { CFOReconciliationService } from '../CFOReconciliationService';
import { CanonicalCFOMetricProvider } from '../CFOMetricProvider';

console.log('====================================================');
console.log(' PHASE 4.2 DATA-SOURCE CORRECTNESS & P&L TEST SUITE ');
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

  // 1. Revenue from canonical source with credit note subtraction
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
    'Test 1: Sales invoice correctly normalized to CREDIT entry of 10000'
  );

  assert(
    creditNoteEntry !== undefined && creditNoteEntry.direction === 'DEBIT' && creditNoteEntry.amount === 1500,
    'Test 2: Credit note correctly normalized to DEBIT entry of 1500 (reducing Revenue)'
  );

  // 2. Date Range Boundary Filtering
  const boundaryInvoices = [
    {
      id: 'inv-in',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-06-15',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 5000, TaxAmount: 0 }]
    },
    {
      id: 'inv-out-before',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2025-12-31',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 8000, TaxAmount: 0 }]
    },
    {
      id: 'inv-out-after',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2027-01-01',
      LineItems: [{ AccountCode: '200', AccountID: 'GUID-200-REV', LineAmount: 9000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: boundaryEntries } = CanonicalMetricEngine.extractLedgerEntries(
    999,
    boundaryInvoices,
    codeToAccId,
    startTs,
    endTs
  );

  assert(
    boundaryEntries.length === 1 && boundaryEntries[0].sourceTransactionId === 'inv-in',
    'Test 3: Date range boundary correctly includes in-period invoice (2026-06-15) and excludes out-of-period invoices'
  );

  // 3. AccountID GUID Primary Identity over AccountCode
  const accountCodeChangeInvoices = [
    {
      id: 'inv-code-change',
      Type: 'ACCREC',
      Status: 'AUTHORISED',
      Date: '2026-07-20',
      LineItems: [{ AccountCode: '9999-CHANGED-CODE', AccountID: 'GUID-200-REV', LineAmount: 12000, TaxAmount: 0 }]
    }
  ];

  const { ledgerEntries: codeChangeEntries } = CanonicalMetricEngine.extractLedgerEntries(
    999,
    accountCodeChangeInvoices,
    codeToAccId,
    startTs,
    endTs
  );

  assert(
    codeChangeEntries.length === 1 && codeChangeEntries[0].sourceAccountId === 'GUID-200-REV',
    'Test 4: AccountID GUID primary identity maintained despite AccountCode modification'
  );

  // 4. Data Coverage Status (DATA_PARTIAL)
  const canonicalProvider = new CanonicalCFOMetricProvider();
  const canonicalRes = await canonicalProvider.getMetrics(1); // Tenant 1

  assert(
    canonicalRes.dataCoverageStatus === 'DATA_COMPLETE' || canonicalRes.dataCoverageStatus === 'DATA_PARTIAL',
    'Test 5: Canonical metric engine correctly surfaces DATA_PARTIAL/DATA_COMPLETE coverage status'
  );

  assert(
    canonicalRes.metrics.revenue.dataCoverage === 'DATA_COMPLETE' || canonicalRes.metrics.revenue.dataCoverage === 'DATA_PARTIAL',
    'Test 6: Individual metrics explicitly include dataCoverage metadata tag'
  );

  // 5. EBITDA returns null / NOT_AVAILABLE when D&A adjustments missing
  assert(
    canonicalRes.metrics.ebitda.value === null && canonicalRes.metrics.ebitda.mappingStatus === 'NOT_AVAILABLE',
    'Test 7: EBITDA returns null and NOT_AVAILABLE mappingStatus when depreciation/amortization adjustments are unmapped'
  );

  // 6. Net Profit Completeness
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
    parsedPnl.netProfit === 90000 && parsedPnl.netProfit === (parsedPnl.grossProfit + parsedPnl.otherIncome - parsedPnl.operatingExpenses - parsedPnl.otherExpenses),
    'Test 8: Net profit calculation is complete (200k sales - 80k cogs - 40k opex + 15k other income - 5k other expense = 90k net profit)'
  );

  // 7. Multi-metric reconciliation
  const reconResult = await CFOReconciliationService.reconcileTenantMetrics(1);
  assert(
    reconResult.reconciliationItems.length >= 8,
    'Test 9: CFOReconciliationService evaluates full suite of financial metrics against Xero report cache'
  );

  console.log(`\n----------------------------------------------------`);
  console.log(`PHASE 4.2 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log(`----------------------------------------------------\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
