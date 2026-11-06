import { ProfitAndLossService } from '../ProfitAndLossService';
import { CanonicalMetricEngine } from '../CanonicalMetricEngine';
import { CFOMetricProviderFactory, CanonicalCFOMetricProvider } from '../CFOMetricProvider';
import { CFOReconciliationService } from '../CFOReconciliationService';

console.log('====================================================');
console.log(' PHASE 4.1 ACCOUNTING SEMANTICS VALIDATION SUITE   ');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ": " + detail : ""}`);
    failedTests++;
  }
}

async function runTests() {
  // Scenario 1: Operating Profit formula (Gross Profit - Operating Expenses)
  const mockPnlStandard = {
    Rows: [
      { RowType: 'Header', Cells: [{ Value: '' }, { Value: 'Amount' }] },
      { RowType: 'Section', Title: 'Trading Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '100000' }] }] },
      { RowType: 'Section', Title: 'Cost of Sales', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Cost of Sales' }, { Value: '30000' }] }] },
      { RowType: 'Section', Title: 'Gross Profit', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Gross Profit' }, { Value: '70000' }] }] },
      { RowType: 'Section', Title: 'Operating Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: '20000' }] }] },
      { RowType: 'Section', Title: 'Operating Profit', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Operating Profit' }, { Value: '50000' }] }] }
    ]
  };

  const parsedStandard = ProfitAndLossService.parseReport(mockPnlStandard);
  assert(
    parsedStandard.operatingProfit === 50000 && parsedStandard.grossProfit - parsedStandard.operatingExpenses === 50000,
    'Test 1: Operating Profit formula equals Gross Profit - Operating Expenses (70000 - 20000 = 50000)'
  );

  // Scenario 2: Net Profit with Other Income
  const mockPnlWithOtherIncome = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Other Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Income' }, { Value: '5000' }] }] }
    ]
  };

  const parsedOtherIncome = ProfitAndLossService.parseReport(mockPnlWithOtherIncome);
  assert(
    parsedOtherIncome.otherIncome === 5000 && parsedOtherIncome.netProfit === 55000,
    'Test 2: Net Profit correctly includes Other Income (50000 Operating Profit + 5000 Other Income = 55000 Net Profit)'
  );

  // Scenario 3: Net Profit with Other Expenses
  const mockPnlWithOtherExpenses = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Other Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Expenses' }, { Value: '3000' }] }] }
    ]
  };

  const parsedOtherExpenses = ProfitAndLossService.parseReport(mockPnlWithOtherExpenses);
  assert(
    parsedOtherExpenses.otherExpenses === 3000 && parsedOtherExpenses.netProfit === 47000,
    'Test 3: Net Profit correctly deducts Other Expenses (50000 Operating Profit - 3000 Other Expense = 47000 Net Profit)'
  );

  // Scenario 4: Net Profit with Interest / Finance Costs if represented
  const mockPnlWithInterest = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Finance Costs', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Interest Expense' }, { Value: '1500' }] }] }
    ]
  };

  const parsedInterest = ProfitAndLossService.parseReport(mockPnlWithInterest);
  assert(
    parsedInterest.interest === 1500,
    'Test 4: Net Profit parser correctly identifies Interest/Finance Costs row when present'
  );

  // Scenario 5: Net Profit with Tax if represented
  const mockPnlWithTax = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Taxation', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Income Tax' }, { Value: '4000' }] }] }
    ]
  };

  const parsedTax = ProfitAndLossService.parseReport(mockPnlWithTax);
  assert(
    parsedTax.tax === 4000,
    'Test 5: Net Profit parser correctly identifies Income Tax row when present'
  );

  // Scenario 6: EBITDA when depreciation/amortization data is available
  const mockPnlWithDA = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Depreciation', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Depreciation' }, { Value: '8000' }] }] },
      { RowType: 'Section', Title: 'Amortisation', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Amortisation' }, { Value: '2000' }] }] }
    ]
  };

  const parsedDA = ProfitAndLossService.parseReport(mockPnlWithDA);
  assert(
    parsedDA.ebitda === 60000,
    'Test 6: EBITDA is calculated when depreciation (8000) and amortization (2000) are available (50000 + 10000 = 60000)'
  );

  // Scenario 7: EBITDA returns NOT_AVAILABLE/INCOMPLETE when required adjustments are unavailable
  const parsedNoDA = ProfitAndLossService.parseReport(mockPnlStandard);
  assert(
    parsedNoDA.ebitda === null,
    'Test 7: EBITDA returns null (NOT_AVAILABLE) when depreciation/amortization data is unavailable in mapped source data'
  );

  // Scenario 8: EBITDA must never simply be labelled as EBITDA because it equals Operating Profit
  assert(
    parsedNoDA.ebitda !== parsedNoDA.operatingProfit,
    'Test 8: EBITDA is NOT set equal to Operating Profit when D&A is missing'
  );

  // Scenario 9: Net Profit must never simply equal Gross Profit - OPEX when additional P&L categories exist
  const mockPnlComplex = {
    Rows: [
      ...mockPnlStandard.Rows,
      { RowType: 'Section', Title: 'Other Income', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Income' }, { Value: '10000' }] }] },
      { RowType: 'Section', Title: 'Other Expenses', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Other Expenses' }, { Value: '2000' }] }] },
      { RowType: 'Section', Title: 'Net Profit', Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit' }, { Value: '58000' }] }] }
    ]
  };

  const parsedComplex = ProfitAndLossService.parseReport(mockPnlComplex);
  const naiveNetProfit = parsedComplex.grossProfit - parsedComplex.operatingExpenses; // 50000
  assert(
    parsedComplex.netProfit === 58000 && parsedComplex.netProfit !== naiveNetProfit,
    'Test 9: Net Profit (58000) does not collapse into naive Gross Profit - OPEX (50000) when Other Income/Expenses exist'
  );

  console.log("\n----------------------------------------------------");
  console.log(`PHASE 4.1 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log("----------------------------------------------------\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
