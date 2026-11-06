import { ToolActivityLog } from './copilot-engine';

export type DataQualityState = 'COMPLETE' | 'PARTIAL' | 'NO_DATA' | 'ZERO_CONFIRMED' | 'INCOMPLETE_DATA' | 'CONFLICTING';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AuthoritativeFact {
  name: string;
  value: number;
  formattedValue: string;
  currency: string;
  period: string;
  sourceTool: string;
  sourceField?: string;
  dataQuality: DataQualityState;
}

export interface ValidatedCalculation {
  formulaName: string;
  formula: string;
  operands: Record<string, number>;
  result: number;
  formattedResult: string;
  isValid: boolean;
}

export interface GroundingValidationResult {
  isGrounded: boolean;
  groundedAnswer: string;
  extractedFacts: AuthoritativeFact[];
  validatedCalculations: ValidatedCalculation[];
  overallDataQuality: DataQualityState;
  overallConfidence: ConfidenceLevel;
  discrepancies: string[];
  groundingWarnings: string[];
}

export class CfoGroundingEngine {
  /**
   * Extracts authoritative facts from canonical CFO tool outputs gathered in the current turn.
   */
  public static extractAuthoritativeFacts(
    toolOutputs: Record<string, any>,
    periodLabel: string
  ): { facts: AuthoritativeFact[]; dataQuality: DataQualityState } {
    const facts: AuthoritativeFact[] = [];
    let overallQuality: DataQualityState = 'COMPLETE';

    // 1. Profit & Loss Reports
    for (const toolKey of Object.keys(toolOutputs)) {
      const pnlRaw = toolOutputs[toolKey];
      const pnl = pnlRaw?.data || pnlRaw;
      if (pnl && (pnl.profitability || pnl.revenue !== undefined || pnl.grossProfit !== undefined)) {
        const currency = pnl.currency || 'GBP';
        const period = pnl.period || periodLabel;
        const prof = pnl.profitability || pnl;

        const addFact = (name: string, val: any, field: string) => {
          let numVal: number | null = null;
          if (typeof val === 'number') {
            numVal = val;
          } else if (typeof val === 'object' && val !== null) {
            if (typeof val.value === 'number') numVal = val.value;
            else if (typeof val.currentAmount === 'number') numVal = val.currentAmount;
            else if (typeof val.amount === 'number') numVal = val.amount;
          }

          if (numVal !== null && !isNaN(numVal)) {
            facts.push({
              name,
              value: numVal,
              formattedValue: `${currency} ${numVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              currency,
              period,
              sourceTool: toolKey,
              sourceField: field,
              dataQuality: 'COMPLETE'
            });
          }
        };

        if (prof.revenue !== undefined) addFact('Revenue', prof.revenue, 'profitability.revenue');
        if (prof.cogs !== undefined) addFact('COGS', prof.cogs, 'profitability.cogs');
        if (prof.grossProfit !== undefined) addFact('Gross Profit', prof.grossProfit, 'profitability.grossProfit');
        if (prof.operatingExpenses !== undefined) addFact('Operating Expenses', prof.operatingExpenses, 'profitability.operatingExpenses');
        if (prof.operatingProfit !== undefined) addFact('Operating Profit', prof.operatingProfit, 'profitability.operatingProfit');
        if (prof.netProfit !== undefined) addFact('Net Profit', prof.netProfit, 'profitability.netProfit');

        const expList = pnl.expensesBreakdown?.topExpenseAccounts || pnl.expensesBreakdown?.topExpenses || pnl.expensesBreakdown?.categories || pnl.expenses?.topExpenses || [];
        if (Array.isArray(expList)) {
          for (const exp of expList) {
            const name = exp.accountName || exp.name || exp.category || 'Expense Line Item';
            const amt = typeof exp.currentAmount === 'number' ? exp.currentAmount : (typeof exp.value === 'number' ? exp.value : (typeof exp.amount === 'number' ? exp.amount : null));
            if (amt !== null && !isNaN(amt)) {
              facts.push({
                name: `OpEx Line Item: ${name}`,
                value: amt,
                formattedValue: `${currency} ${amt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                currency,
                period,
                sourceTool: toolKey,
                sourceField: `expensesBreakdown.${name}`,
                dataQuality: 'COMPLETE'
              });
            }
          }
        }
      }
    }

    // 2. Cash Flow Balance & Summary
    const cashBalRaw = toolOutputs['get_cash_flow_balance'] || toolOutputs['get_live_xero_bank_summary'] || toolOutputs['cfo_get_canonical_metrics'];
    if (cashBalRaw) {
      const cashBal = cashBalRaw.data || cashBalRaw;
      const currency = cashBal.currency || 'GBP';
      const period = periodLabel;

      if (cashBal.status === 'NO_DATA' || (cashBal.bankAccounts && cashBal.bankAccounts.length === 0)) {
        overallQuality = 'NO_DATA';
      } else if (cashBal.totalCash !== undefined && cashBal.totalCash !== null) {
        const bankAccSum = (cashBal.bankAccounts || []).reduce((sum: number, acc: any) => sum + (acc.closingBalance ?? acc.balance ?? acc.currentBalance ?? acc.amount ?? 0), 0);
        const hasCashConflict = cashBal.totalCash === 0 && Math.abs(bankAccSum) > 5.0;
        const isGenuineZero = cashBal.totalCash === 0 && cashBal.bankAccounts && cashBal.bankAccounts.length > 0 && Math.abs(bankAccSum) <= 5.0;
        
        const quality: DataQualityState = hasCashConflict 
          ? 'CONFLICTING' 
          : (isGenuineZero ? 'ZERO_CONFIRMED' : (cashBal.isPartial ? 'INCOMPLETE_DATA' : 'COMPLETE'));
        
        facts.push({
          name: 'Total Cash Balance',
          value: cashBal.totalCash,
          formattedValue: `${currency} ${cashBal.totalCash.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          currency,
          period,
          sourceTool: 'get_cash_flow_balance',
          sourceField: 'totalCash',
          dataQuality: quality
        });

        if (quality === 'ZERO_CONFIRMED') {
          overallQuality = 'ZERO_CONFIRMED';
        } else if (quality === 'CONFLICTING') {
          overallQuality = 'CONFLICTING';
        }
      }
    }

    // 3. Invoices & AR
    const invoicesRaw = toolOutputs['search_invoices_and_bills'];
    const invoices = invoicesRaw?.data || invoicesRaw;
    if (invoices && (invoices.records || invoices.invoices)) {
      const recs = invoices.records || invoices.invoices || [];
      const totalOverdue = recs
        .filter((r: any) => r.status === 'OVERDUE')
        .reduce((sum: number, r: any) => sum + (r.amountDue || 0), 0);
      
      facts.push({
        name: 'Overdue Invoices Total',
        value: totalOverdue,
        formattedValue: `GBP ${totalOverdue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currency: invoices.currency || undefined,
        period: periodLabel,
        sourceTool: 'search_invoices_and_bills',
        sourceField: 'overdueInvoicesTotal',
        dataQuality: recs.length === 0 ? 'NO_DATA' : 'COMPLETE'
      });
    }

    // 4. Scenario Simulation Tool Output
    const scenarioData = toolOutputs['cfo_simulate_scenario'];
    if (scenarioData) {
      const outputs = scenarioData.scenarioOutputs || {};
      const currency = scenarioData.currency || scenarioData.baseline?.currency || undefined;
      const period = periodLabel;

      if (scenarioData.status === 'BLOCKED_NO_DATA') {
        overallQuality = 'NO_DATA';
      } else if (scenarioData.status === 'BLOCKED_CONFLICT') {
        overallQuality = 'CONFLICTING';
      } else {
        const addScenarioFact = (name: string, val?: number) => {
          if (val !== undefined && val !== null && !isNaN(val)) {
            facts.push({
              name,
              value: val,
              formattedValue: `${currency} ${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              currency,
              period,
              sourceTool: 'cfo_simulate_scenario',
              sourceField: name,
              dataQuality: 'COMPLETE'
            });
          }
        };

        if (outputs.scenarioRevenue !== undefined) addScenarioFact('Scenario Revenue', outputs.scenarioRevenue);
        if (outputs.scenarioCogs !== undefined) addScenarioFact('Scenario COGS', outputs.scenarioCogs);
        if (outputs.scenarioGrossProfit !== undefined) addScenarioFact('Scenario Gross Profit', outputs.scenarioGrossProfit);
        if (outputs.scenarioOpex !== undefined) addScenarioFact('Scenario Operating Expenses', outputs.scenarioOpex);
        if (outputs.scenarioNetProfit !== undefined) addScenarioFact('Scenario Net Profit', outputs.scenarioNetProfit);
        if (outputs.scenarioEndingCash !== undefined) addScenarioFact('Scenario Ending Cash', outputs.scenarioEndingCash);
        if (outputs.breakEvenRevenueRequired !== undefined) addScenarioFact('Break-Even Revenue Required', outputs.breakEvenRevenueRequired);
      }
    }

    // 5. Supplier Payment Timing Tool Output
    const timingData = toolOutputs['get_supplier_payment_timing_report'] || toolOutputs['get_supplier_payment_timing'] || toolOutputs['get_supplier_payment_timing_drilldown'] || toolOutputs['get_supplier_drilldown'];
    if (timingData) {
      const data = timingData.data || timingData;
      const period = periodLabel;

      if (typeof data.totalFullyPaidBillsAnalyzed === 'number') {
        facts.push({
          name: 'Total Fully Paid Bills Analyzed',
          value: data.totalFullyPaidBillsAnalyzed,
          formattedValue: `${data.totalFullyPaidBillsAnalyzed}`,
          currency: 'QTY',
          period,
          sourceTool: 'get_supplier_payment_timing_report',
          sourceField: 'totalFullyPaidBillsAnalyzed',
          dataQuality: 'COMPLETE'
        });
      }

      if (typeof data.overallAveragePaymentDays === 'number') {
        facts.push({
          name: 'Overall Average Payment Days',
          value: data.overallAveragePaymentDays,
          formattedValue: `${data.overallAveragePaymentDays} days`,
          currency: 'DAYS',
          period,
          sourceTool: 'get_supplier_payment_timing_report',
          sourceField: 'overallAveragePaymentDays',
          dataQuality: 'COMPLETE'
        });
      }

      if (Array.isArray(data.individualBills)) {
        facts.push({
          name: 'Individual Paid Bills Count',
          value: data.individualBills.length,
          formattedValue: `${data.individualBills.length}`,
          currency: 'QTY',
          period,
          sourceTool: 'get_supplier_payment_timing_drilldown',
          sourceField: 'individualBills.length',
          dataQuality: 'COMPLETE'
        });
      }

      if (Array.isArray(data.suppliers)) {
        for (const sup of data.suppliers) {
          if (typeof sup.averagePaymentDays === 'number') {
            facts.push({
              name: `Average Payment Days: ${sup.supplierName}`,
              value: sup.averagePaymentDays,
              formattedValue: `${sup.averagePaymentDays} days`,
              currency: 'DAYS',
              period,
              sourceTool: 'get_supplier_payment_timing_report',
              sourceField: `suppliers.${sup.supplierName}.averagePaymentDays`,
              dataQuality: 'COMPLETE'
            });
          }
        }
      }
    }

    // 6. Balance Sheet Reports
    const bsRaw = toolOutputs['get_balance_sheet_report'] || toolOutputs['get_live_xero_balance_sheet'];
    if (bsRaw) {
      const bs = bsRaw.data || bsRaw;
      if (bs && (bs.summary || bs.totalAssets !== undefined || bs.totalLiabilities !== undefined || bs.netAssets !== undefined)) {
        const currency = bs.currency || 'GBP';
        const period = bs.asOnDate ? `as of ${bs.asOnDate}` : periodLabel;
        const summary = bs.summary || bs;

        const addBsFact = (name: string, val: any, field: string) => {
          let numVal: number | null = null;
          if (typeof val === 'number') numVal = val;
          else if (typeof val === 'object' && val !== null && typeof val.value === 'number') numVal = val.value;

          if (numVal !== null && !isNaN(numVal)) {
            facts.push({
              name,
              value: numVal,
              formattedValue: `${currency} ${numVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              currency,
              period,
              sourceTool: 'get_balance_sheet_report',
              sourceField: field,
              dataQuality: 'COMPLETE'
            });
          }
        };

        if (summary.totalAssets !== undefined) addBsFact('Total Assets', summary.totalAssets, 'summary.totalAssets');
        if (summary.totalLiabilities !== undefined) addBsFact('Total Liabilities', summary.totalLiabilities, 'summary.totalLiabilities');
        if (summary.netAssets !== undefined) addBsFact('Net Assets', summary.netAssets, 'summary.netAssets');
        if (summary.totalEquity !== undefined) addBsFact('Total Equity', summary.totalEquity, 'summary.totalEquity');
        else if (summary.netAssets !== undefined) addBsFact('Total Equity', summary.netAssets, 'summary.netAssets');

        if (Array.isArray(bs.assets)) {
          for (const item of bs.assets) {
            if (item.name && typeof item.amount === 'number') {
              addBsFact(`Asset: ${item.name}`, item.amount, `assets.${item.name}`);
            }
          }
        }
        if (Array.isArray(bs.liabilities)) {
          for (const item of bs.liabilities) {
            if (item.name && typeof item.amount === 'number') {
              addBsFact(`Liability: ${item.name}`, item.amount, `liabilities.${item.name}`);
            }
          }
        }
        if (Array.isArray(bs.equity)) {
          for (const item of bs.equity) {
            if (item.name && typeof item.amount === 'number') {
              addBsFact(`Equity: ${item.name}`, item.amount, `equity.${item.name}`);
            }
          }
        }
      }
    }

    if (facts.length === 0 && overallQuality !== 'NO_DATA') {
      overallQuality = 'NO_DATA';
    }

    return { facts, dataQuality: overallQuality };
  }

  /**
   * Deterministically validates financial calculations server-side.
   */
  public static validateCalculations(facts: AuthoritativeFact[]): ValidatedCalculation[] {
    const calculations: ValidatedCalculation[] = [];
    const getVal = (name: string) => facts.find(f => f.name === name)?.value;

    const rev = getVal('Revenue');
    const gp = getVal('Gross Profit');
    const opex = getVal('Operating Expenses');
    const opProfit = getVal('Operating Profit');
    const np = getVal('Net Profit');

    if (rev !== undefined && gp !== undefined) {
      const cogs = rev - gp;
      calculations.push({
        formulaName: 'COGS Calculation',
        formula: 'COGS = Revenue - Gross Profit',
        operands: { Revenue: rev, GrossProfit: gp },
        result: cogs,
        formattedResult: `GBP ${cogs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        isValid: true
      });

      if (rev > 0) {
        const gmPct = Number(((gp / rev) * 100).toFixed(2));
        calculations.push({
          formulaName: 'Gross Margin Percentage',
          formula: 'Gross Margin % = (Gross Profit / Revenue) * 100',
          operands: { GrossProfit: gp, Revenue: rev },
          result: gmPct,
          formattedResult: `${gmPct}%`,
          isValid: true
        });
      }
    }

    if (gp !== undefined && opex !== undefined) {
      const expectedOpProfit = gp - opex;
      const targetOp = opProfit !== undefined ? opProfit : expectedOpProfit;
      const isOpValid = Math.abs(expectedOpProfit - targetOp) < 1.0;
      
      calculations.push({
        formulaName: 'Operating Profit Calculation',
        formula: 'Operating Profit = Gross Profit - Operating Expenses',
        operands: { GrossProfit: gp, OperatingExpenses: opex, OperatingProfit: targetOp },
        result: expectedOpProfit,
        formattedResult: `GBP ${expectedOpProfit.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        isValid: isOpValid
      });
    }

    if (np !== undefined && rev !== undefined && rev > 0) {
      const nmPct = Number(((np / rev) * 100).toFixed(2));
      calculations.push({
        formulaName: 'Net Margin Percentage',
        formula: 'Net Margin % = (Net Profit / Revenue) * 100',
        operands: { NetProfit: np, Revenue: rev },
        result: nmPct,
        formattedResult: `${nmPct}%`,
        isValid: true
      });
    }

    return calculations;
  }

  /**
   * Cross-tool consistency check to detect conflicting source outputs.
   */
  public static checkCrossToolConsistency(toolOutputs: Record<string, any>): { isConsistent: boolean; discrepancies: string[]; dataQuality: DataQualityState } {
    const discrepancies: string[] = [];
    const pnl = toolOutputs['get_profit_and_loss_report'];
    const invoices = toolOutputs['search_invoices_and_bills'];
    const cashBal = toolOutputs['get_cash_flow_balance'];
    const bs = toolOutputs['get_balance_sheet_report'];

    // Check 1: Revenue vs Sales Invoices (if both present)
    if (pnl && pnl.profitability && invoices && invoices.records) {
      const rev = typeof pnl.profitability.revenue === 'object' ? pnl.profitability.revenue?.value : pnl.profitability.revenue;
      const invSum = invoices.records
        .filter((r: any) => r.type === 'ACCREC' || r.type === 'INVOICE')
        .reduce((s: number, r: any) => s + (r.total || r.amountDue || 0), 0);

      if (rev > 0 && invSum > 0) {
        const diff = Math.abs(rev - invSum);
        const pctDiff = (diff / rev) * 100;
        if (pctDiff > 10.0) {
          discrepancies.push(`Discrepancy detected between P&L Revenue (GBP ${rev.toLocaleString()}) and Invoiced Sales (GBP ${invSum.toLocaleString()}) variance = ${pctDiff.toFixed(1)}%. Reconciliation required.`);
        }
      }
    }

    // Check 2: Cash Flow Balance vs Balance Sheet Bank Cash
    if (cashBal && cashBal.totalCash !== undefined && bs && bs.assets?.cashAndEquivalents) {
      const cfCash = cashBal.totalCash;
      const bsCash = bs.assets.cashAndEquivalents;
      if (cfCash !== bsCash && Math.abs(cfCash - bsCash) > 5.0) {
        discrepancies.push(`Cash balance discrepancy: Cash Flow tool reports GBP ${cfCash.toLocaleString()} while Balance Sheet reports GBP ${bsCash.toLocaleString()}.`);
      }
    }

    const isConsistent = discrepancies.length === 0;
    return {
      isConsistent,
      discrepancies,
      dataQuality: isConsistent ? 'COMPLETE' : 'CONFLICTING'
    };
  }

  /**
   * Evaluates overall data quality and evidence-based confidence level.
   */
  public static calculateConfidence(
    dataQuality: DataQualityState,
    hasDiscrepancies: boolean,
    toolCount: number
  ): ConfidenceLevel {
    if (dataQuality === 'NO_DATA' || toolCount === 0) {
      return 'LOW';
    }
    if (dataQuality === 'CONFLICTING' || hasDiscrepancies || dataQuality === 'INCOMPLETE_DATA') {
      return 'MEDIUM';
    }
    if (dataQuality === 'ZERO_CONFIRMED') {
      return 'HIGH';
    }
    return 'HIGH';
  }

  /**
   * Final Answer Grounding Gate: Validates that every financial number in LLM response text is grounded in authoritative facts.
   */
  public static validateAndGroundFinalAnswer(
    llmText: string,
    facts: AuthoritativeFact[],
    calculations: ValidatedCalculation[],
    dataQuality: DataQualityState,
    userQuery: string
  ): GroundingValidationResult {
    const groundingWarnings: string[] = [];
    const discrepancies: string[] = [];
    let groundedAnswer = llmText;
    const qLower = userQuery.toLowerCase();

    // 1. UNSUPPORTED QUESTION CHECK (e.g. Employee Productivity, Headcount performance)
    const isUnsupportedCategory = qLower.includes('employee productivity') || 
                                   (qLower.includes('employee') && qLower.includes('productiv')) ||
                                   qLower.includes('headcount expense') || 
                                   qLower.includes('staff efficiency') || 
                                   qLower.includes('csat score');

    if (isUnsupportedCategory) {
      groundedAnswer = `⚠️ **Financial Data Limitation Notice**: I cannot determine employee productivity or non-financial headcount metrics from the connected Xero accounting data. Connected general ledger tools provide P&L, Cash Flow, AR/AP, and bank transactions only.`;
      return {
        isGrounded: true,
        groundedAnswer,
        extractedFacts: facts,
        validatedCalculations: calculations,
        overallDataQuality: 'NO_DATA',
        overallConfidence: 'LOW',
        discrepancies: ['Requested metric (Employee Productivity) is not tracked in connected financial accounting databases.'],
        groundingWarnings: ['Unsupported metric requested by user.']
      };
    }

    // 2. NO_DATA vs ZERO PROTECTION GATE
    const isPresentationTransformation = 
      qLower.includes('table') || qLower.includes('format') || qLower.includes('shorter') || 
      qLower.includes('concise') || qLower.includes('summariz') || qLower.includes('bullet') ||
      qLower.includes('management accounts') || qLower.includes('executive summary') || qLower.includes('raw numbers');

    let effectiveDataQuality = ((facts.length > 0 || isPresentationTransformation) && dataQuality === 'NO_DATA') 
      ? 'COMPLETE' 
      : dataQuality;

    if (effectiveDataQuality === 'NO_DATA') {
      if (groundedAnswer.includes('£0') || groundedAnswer.includes('0.00') || groundedAnswer.includes('$0') || groundedAnswer.includes('zero revenue') || groundedAnswer.includes('zero cash')) {
        groundedAnswer = `⚠️ **Data Availability Notice**: Accounting records were not found or not synchronized for the requested query period. I cannot determine authoritative values. Please connect or synchronize your accounting data for this period rather than assuming a zero balance.`;
        groundingWarnings.push('Prevented model from reporting missing data (NO_DATA) as £0 zero balance.');
      }
    }

    // 3. ZERO_CONFIRMED ENFORCEMENT
    if (effectiveDataQuality === 'ZERO_CONFIRMED' && (qLower.includes('cash') || qLower.includes('balance'))) {
      if (!groundedAnswer.includes('0') && !groundedAnswer.includes('zero')) {
        groundedAnswer = `### 💸 Cash Flow & Liquid Reserves\n- **Total Liquid Cash Reserve**: **GBP 0.00**\n\n*Authoritative bank accounting data confirms active bank accounts hold a verified zero balance.*`;
      }
    }

    // 4. FORBIDDEN UNSUPPORTED COMMERCIAL/OPERATIONAL CAUSATION CHECK
    const forbiddenPhrases = [
      'sales team performed poorly',
      'sales team underperformed',
      'customers stopped buying',
      'marketing campaign failed',
      'supplier prices increased',
      'suppliers raised prices',
      'inflation reduced demand'
    ];
    for (const phrase of forbiddenPhrases) {
      if (llmText.toLowerCase().includes(phrase)) {
        groundingWarnings.push(`Flagged unsupported commercial/operational causation in LLM response: "${phrase}"`);
      }
    }

    // 5. HALLUCINATION & UNGROUNDED NUMBER DETECTION GATE
    const numberMatches = llmText.match(/(?:£|\$|GBP\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi) || [];
    const validValues = new Set([
      ...facts.map(f => f.value.toFixed(2)),
      ...facts.map(f => f.value.toFixed(0)),
      ...calculations.map(c => c.result.toFixed(2)),
      ...calculations.map(c => c.result.toFixed(0)),
      '0.00', '0'
    ]);

    for (const match of numberMatches) {
      const cleanNum = parseFloat(match.replace(/[^0-9.]/g, '')).toFixed(2);
      const isKnown = Array.from(validValues).some(v => Math.abs(parseFloat(v) - parseFloat(cleanNum)) < 100.0);
      if (!isKnown && parseFloat(cleanNum) > 10.0) {
        groundingWarnings.push(`Flagged ungrounded figure in LLM response: ${match}`);
      }
    }

    // 6. TERMINOLOGY GUARD: PREVENT FRAUDULENT / ILLEGAL CLAIMS
    if (groundedAnswer.toLowerCase().includes('fraudulent') || groundedAnswer.toLowerCase().includes('illegal transaction')) {
      groundedAnswer = groundedAnswer.replace(/fraudulent/gi, 'unusual').replace(/illegal transaction/gi, 'transaction requiring audit review');
      groundingWarnings.push('Replaced unsubstantiated legal/fraud terminology with standard financial audit phrasing.');
    }

    // 7. FORECAST vs SCENARIO TERMINOLOGY GUARD
    const forbiddenForecastTerms = ['we forecast', 'our forecast', 'future prediction', 'guaranteed revenue', 'projected budget'];
    for (const term of forbiddenForecastTerms) {
      if (groundedAnswer.toLowerCase().includes(term)) {
        groundedAnswer = groundedAnswer.replace(new RegExp(term, 'gi'), 'hypothetical scenario analysis');
        groundingWarnings.push(`Replaced forecast terminology ("${term}") with hypothetical scenario phrasing.`);
      }
    }

    const confidence = this.calculateConfidence(dataQuality, discrepancies.length > 0, facts.length);

    return {
      isGrounded: groundingWarnings.length === 0,
      groundedAnswer,
      extractedFacts: facts,
      validatedCalculations: calculations,
      overallDataQuality: effectiveDataQuality,
      overallConfidence: confidence,
      discrepancies,
      groundingWarnings
    };
  }
}
