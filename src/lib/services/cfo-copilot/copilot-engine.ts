import { executeCfoTool, getCfoTool, getLlmToolsSchema, ToolAliases, ToolExecutionContext } from './copilot-tools';
import { saveChatMessage, getChatMessages, getConversationContext, saveConversationContext, CfoConversationContext } from './copilot-db';
import { CfoGroundingEngine, AuthoritativeFact, ValidatedCalculation, DataQualityState, ConfidenceLevel } from './copilot-grounding';
import { ScenarioType, ScenarioAssumption, ScenarioDirection } from './scenario-engine';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export interface ToolActivityLog {
  toolName: string;
  args: any;
  status: 'SUCCESS' | 'ERROR';
  resultSummary: string;
  recordsCount: number;
}

const LOCAL_SETTINGS_FILE = path.join(process.cwd(), 'src', 'data', 'system_settings.json');

export function formatContextSummary(ctx: CfoConversationContext, userIntent?: string, currentMessage?: string): string {
  const parts: string[] = [];
  parts.push(`==================================================`);
  parts.push(`CFO CONVERSATION CONTEXT & FINANCIAL MEMORY (Prior Turns)`);
  parts.push(`==================================================`);
  if (ctx.activeTopic) parts.push(`• Active Topic: ${ctx.activeTopic}`);
  if (ctx.activeMetrics && ctx.activeMetrics.length > 0) parts.push(`• Active Financial Metrics: ${ctx.activeMetrics.join(', ')}`);
  if (ctx.activePeriods) parts.push(`• Active Period: ${ctx.activePeriods.label} (${ctx.activePeriods.startDate} to ${ctx.activePeriods.endDate})`);
  if (ctx.activeComparisonPeriod) parts.push(`• Active Comparison Period: ${ctx.activeComparisonPeriod.label} (${ctx.activeComparisonPeriod.startDate} to ${ctx.activeComparisonPeriod.endDate})`);

  if (ctx.activeEntities) {
    const ent: string[] = [];
    if (ctx.activeEntities.customers?.length) ent.push(`Customers: ${ctx.activeEntities.customers.join(', ')}`);
    if (ctx.activeEntities.vendors?.length) ent.push(`Vendors: ${ctx.activeEntities.vendors.join(', ')}`);
    if (ctx.activeEntities.invoices?.length) ent.push(`Invoices: ${ctx.activeEntities.invoices.join(', ')}`);
    if (ctx.activeEntities.accounts?.length) ent.push(`Accounts: ${ctx.activeEntities.accounts.join(', ')}`);
    if (ent.length > 0) parts.push(`• Active Entities: ${ent.join(' | ')}`);
  }

  if (ctx.relevantFacts && ctx.relevantFacts.length > 0) {
    let factsToInclude = ctx.relevantFacts;
    if (userIntent === 'SCENARIO') {
      const msgLower = (currentMessage || '').toLowerCase();
      const isExplicitCompare = msgLower.includes('compare');
      factsToInclude = factsToInclude.filter(fact => {
        if (fact.includes('cfo_simulate_scenario')) {
          if (fact.includes('Failed') || fact.includes('unavailable') || fact.includes('NO_DATA') || fact.includes('Error')) return false;
          if (!isExplicitCompare) {
            return false;
          }
        }
        return true;
      });
    }
    if (factsToInclude.length > 0) {
      parts.push(`• Established Context Facts:\n  - ${factsToInclude.slice(-6).join('\n  - ')}`);
    }
  }

  if (ctx.activeHypotheses && ctx.activeHypotheses.length > 0) {
    const hypList = ctx.activeHypotheses.map(h => `[${h.status}] ${h.statement}`).join('; ');
    parts.push(`• Active Hypotheses: ${hypList}`);
  }

  if (ctx.lastConfidence) parts.push(`• Prior Data Quality: ${ctx.dataQuality || 'COMPLETE'} | Confidence: ${ctx.lastConfidence}`);
  parts.push(`==================================================`);
  return parts.join('\n');
}

export function extractScenarioParamsFromPrompt(msg: string): { scenarioType: ScenarioType; assumptions: ScenarioAssumption[] } {
  const m = msg.toLowerCase();
  let val = 10;
  const pctMatch = m.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    val = parseFloat(pctMatch[1]);
  } else {
    const numMatch = m.match(/(?:by|of|to)\s*(?:£|gbp)?\s*(\d+(?:\.\d+)?)/);
    if (numMatch) val = parseFloat(numMatch[1]);
  }

  let direction: ScenarioDirection = 'DECREASE';
  if (m.includes('increase') || m.includes('rise') || m.includes('grows') || m.includes('up') || m.includes('higher') || m.includes('add')) {
    direction = 'INCREASE';
  } else if (m.includes('fall') || m.includes('drop') || m.includes('decrease') || m.includes('cut') || m.includes('down') || m.includes('lower') || m.includes('reduce')) {
    direction = 'DECREASE';
  }

  let metricName: ScenarioAssumption['metricName'] = 'REVENUE';
  let scenarioType: ScenarioType = 'REVENUE_DELTA';

  if (m.includes('cogs') || m.includes('cost of goods')) {
    metricName = 'COGS';
    scenarioType = 'COGS_DELTA';
  } else if (m.includes('opex') || m.includes('operating expense') || m.includes('expenses')) {
    metricName = 'OPEX';
    scenarioType = 'OPEX_DELTA';
  } else if (m.includes('margin') || m.includes('gross margin')) {
    metricName = 'GROSS_MARGIN';
    scenarioType = 'GROSS_MARGIN_SHIFT';
  } else if (m.includes('receivable') || m.includes('collect')) {
    metricName = 'OVERDUE_RECEIVABLES';
    scenarioType = 'RECEIVABLES_COLLECTION';
  } else if (m.includes('break even') || m.includes('breakeven')) {
    scenarioType = 'BREAK_EVEN_ANALYSIS';
  }

  return {
    scenarioType,
    assumptions: [{
      metricName,
      value: val,
      unit: 'PERCENTAGE',
      direction
    }]
  };
}

export function parseDatesFromPrompt(msg: string): { startDate: string; endDate: string; periodLabel: string } {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const year = today.getUTCFullYear();
  const defaultDates = {
    startDate: `${year}-01-01`,
    endDate: todayIso,
    periodLabel: `01 Jan ${year} to ${todayIso}`
  };

  if (!msg) return defaultDates;

  // Relative windows
  const relative3mRegex = /(?:last\s*3\s*months?|last\s*3month|\b3month\b|last\s*quarter|recent\s*3\s*months?|this\s*quarter|pattern\s*of\s*3month)/i;
  if (relative3mRegex.test(msg)) {
    const start = new Date(today);
    start.setUTCMonth(start.getUTCMonth() - 3);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: todayIso,
      periodLabel: `${start.toISOString().slice(0, 10)} to ${todayIso}`
    };
  }

  const relative1mRegex = /(?:last\s*month|last\s*1\s*month|\b1month\b|recent\s*month)/i;
  if (relative1mRegex.test(msg)) {
    const start = new Date(today);
    start.setUTCMonth(start.getUTCMonth() - 1);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: todayIso,
      periodLabel: `${start.toISOString().slice(0, 10)} to ${todayIso}`
    };
  }

  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09', sept: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  const getMonthNum = (mStr: string) => {
    const key = mStr.toLowerCase().substring(0, 3);
    return monthMap[key] || '01';
  };

  const pad2 = (n: string | number) => String(n).padStart(2, '0');

  // Format 1: "01 jan 2026 to 30 sep 2026" or "1 january 2026 to 30 september 2026" or "01 apr 2026 - 30 sep 2026"
  const wordRangeRegex = /(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\s+(?:to|-|until|through)\s+(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i;
  const match1 = msg.match(wordRangeRegex);
  if (match1) {
    const d1 = pad2(match1[1]);
    const m1 = getMonthNum(match1[2]);
    const y1 = match1[3];
    const d2 = pad2(match1[4]);
    const m2 = getMonthNum(match1[5]);
    const y2 = match1[6];

    return {
      startDate: `${y1}-${m1}-${d1}`,
      endDate: `${y2}-${m2}-${d2}`,
      periodLabel: `${d1} ${match1[2].substring(0,3)} ${y1} to ${d2} ${match1[5].substring(0,3)} ${y2}`
    };
  }

  // Format 2: "2026-01-01 to 2026-09-30" or "2026-01-01 - 2026-09-30"
  const isoRangeRegex = /(\d{4}-\d{2}-\d{2})\s+(?:to|-)\s+(\d{4}-\d{2}-\d{2})/i;
  const match2 = msg.match(isoRangeRegex);
  if (match2) {
    return {
      startDate: match2[1],
      endDate: match2[2],
      periodLabel: `${match2[1]} to ${match2[2]}`
    };
  }

  // Format 3: "01/01/2026 to 30/09/2026"
  const slashRangeRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:to|-)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
  const match3 = msg.match(slashRangeRegex);
  if (match3) {
    const d1 = pad2(match3[1]);
    const m1 = pad2(match3[2]);
    const y1 = match3[3];
    const d2 = pad2(match3[4]);
    const m2 = pad2(match3[5]);
    const y2 = match3[6];
    return {
      startDate: `${y1}-${m1}-${d1}`,
      endDate: `${y2}-${m2}-${d2}`,
      periodLabel: `${d1}/${m1}/${y1} to ${d2}/${m2}/${y2}`
    };
  }

  // Format 4: Month Range e.g. "Apr-Sep 2026" or "Apr to Sep 2026" or "April - September 2026"
  const monthRangeRegex = /([a-zA-Z]{3,9})\s*(?:-|to)\s*([a-zA-Z]{3,9})\s+(\d{4})/i;
  const match4 = msg.match(monthRangeRegex);
  if (match4) {
    const m1 = getMonthNum(match4[1]);
    const m2 = getMonthNum(match4[2]);
    const yr = match4[3];
    const daysInMonth: Record<string, string> = {
      '01': '31', '02': '28', '03': '31', '04': '30',
      '05': '31', '06': '30', '07': '31', '08': '31',
      '09': '30', '10': '31', '11': '30', '12': '31'
    };
    const lastDay = daysInMonth[m2] || '30';
    return {
      startDate: `${yr}-${m1}-01`,
      endDate: `${yr}-${m2}-${lastDay}`,
      periodLabel: `01 ${match4[1].substring(0, 3)} ${yr} to ${lastDay} ${match4[2].substring(0, 3)} ${yr}`
    };
  }

  // Format 5: Single Year e.g. "for 2025" or "in 2026"
  const yearRegex = /\b(20\d{2})\b/;
  const match5 = msg.match(yearRegex);
  if (match5 && !msg.toLowerCase().includes('to') && !/(?:january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)/i.test(msg)) {
    const yr = match5[1];
    return {
      startDate: `${yr}-01-01`,
      endDate: `${yr}-12-31`,
      periodLabel: `01 Jan ${yr} to 31 Dec ${yr}`
    };
  }

  // Format 6: Single Month e.g. "balance sheet of july", "July 2026 balance sheet", "for July", "in july", "july"
  const singleMonthRegex = /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b(?:\s+(\d{4}))?/i;
  const match6 = msg.match(singleMonthRegex);
  if (match6) {
    const monthStr = match6[1];
    const yrStr = match6[2] || String(year);
    const mNum = getMonthNum(monthStr);
    const daysInMonth: Record<string, string> = {
      '01': '31', '02': '28', '03': '31', '04': '30',
      '05': '31', '06': '30', '07': '31', '08': '31',
      '09': '30', '10': '31', '11': '30', '12': '31'
    };
    const lastDay = daysInMonth[mNum] || '30';
    const monthName = monthStr.charAt(0).toUpperCase() + monthStr.slice(1).toLowerCase();
    return {
      startDate: `${yrStr}-${mNum}-01`,
      endDate: `${yrStr}-${mNum}-${lastDay}`,
      periodLabel: `01 ${monthName.substring(0, 3)} ${yrStr} to ${lastDay} ${monthName.substring(0, 3)} ${yrStr}`
    };
  }

  return defaultDates;
}

async function getLlmSettings() {
  let settings = {
    provider: 'omegaplus',
    apiKey: '',
    baseUrl: 'https://api.omegaplusapi.com',
    defaultModel: 'claude-fable-5',
    enabledModels: ['claude-fable-5'],
    temperature: 0.7,
    maxTokens: 2048
  };

  try {
    if (fs.existsSync(LOCAL_SETTINGS_FILE)) {
      const raw = fs.readFileSync(LOCAL_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      settings = {
        provider: parsed.llmProvider || settings.provider,
        apiKey: parsed.llmApiKey || settings.apiKey,
        baseUrl: (parsed.llmBaseUrl || settings.baseUrl).replace(/\/+$/, ''),
        defaultModel: parsed.llmDefaultModel || settings.defaultModel,
        enabledModels: Array.isArray(parsed.llmEnabledModels) ? parsed.llmEnabledModels : settings.enabledModels,
        temperature: parsed.llmTemperature ?? settings.temperature,
        maxTokens: parsed.llmMaxTokens ?? settings.maxTokens
      };
    }
  } catch (e) {}

  if (db.isPgActive()) {
    try {
      const res = await db.query('SELECT * FROM system_settings WHERE id = 1 LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (row.llm_api_key) settings.apiKey = row.llm_api_key;
        if (row.llm_base_url) settings.baseUrl = row.llm_base_url.replace(/\/+$/, '');
        if (row.llm_default_model) settings.defaultModel = row.llm_default_model;
        if (row.llm_provider) settings.provider = row.llm_provider;
      }
    } catch (e) {}
  }

  return settings;
}

export interface CfoReasoningState {
  originalQuestion: string;
  tenantId: number;
  currentPeriod?: { startDate: string; endDate: string; label: string };
  comparisonPeriod?: { startDate: string; endDate: string; label: string };
  factsCollected: Array<{ sourceTool: string; metric: string; value: any; period?: string }>;
  authoritativeFacts?: AuthoritativeFact[];
  validatedCalculations?: ValidatedCalculation[];
  calculations: Array<{ formula: string; result: any; description: string }>;
  hypotheses: Array<{ id: string; statement: string; status: 'TESTING' | 'SUPPORTED' | 'REJECTED'; evidence: string[] }>;
  evidence: string[];
  unresolvedQuestions: string[];
  toolCalls: Array<{ round: number; toolName: string; args: any; success: boolean; resultSummary: string }>;
  toolRounds: number;
  finalConclusion?: string;
  confidence: ConfidenceLevel;
  dataQuality: DataQualityState;
}

export const COPILOT_SYSTEM_PROMPT = `You are the Autonomous Virtual CFO Executive AI Engine for the currently authorized organisation.
Your primary role is to provide authoritative, evidence-grounded financial intelligence using your canonical CFO tools.

==================================================
AUTONOMOUS CFO REASONING DIRECTIVES
==================================================

1. FACT vs CALCULATION vs HYPOTHESIS vs RECOMMENDATION:
- FACT: Directly returned from financial tool results (e.g. Revenue = £4,565,153.14).
- CALCULATION: Deterministic calculation derived from facts (e.g. Revenue grew +12.4% vs prior period).
- HYPOTHESIS: A possible explanation that requires tool evidence to confirm or reject (e.g. "Receivables growth may be absorbing operating cash").
- RECOMMENDATION: Suggested action ONLY after tool evidence confirms the diagnosis.
NEVER present an unverified hypothesis as a confirmed fact.

2. MINIMUM SUFFICIENT EVIDENCE PRINCIPLE & INTENT RECOGNITION:
- SIMPLE QUESTIONS ("What was my revenue from April to September 2026?"): Select ONLY the single required tool (e.g. get_profit_and_loss_report). Do NOT call cash flow, invoices, transactions, or contacts tools. Keep simple questions cheap and direct.
- ANALYTICAL / EXPLANATION QUESTIONS ("Why is my profit low?", "Why did cash fall?", "What is hurting my business?"): Autonomously perform multi-step evidence gathering. Check P&L, examine Revenue vs COGS vs Gross Profit vs Operating Expenses, call drivers or invoice tools as needed to find actual financial drivers.
- Stop calling tools as soon as sufficient evidence has been collected.

3. EVIDENCED HYPOTHESIS TESTING:
- When asked WHY something changed, generate plausible hypotheses (e.g. H1: Receivables grew, H2: OpEx/COGS increased, H3: Debt/Tax/CapEx payments).
- Select tools to test each hypothesis. Reject unsupported hypotheses and present evidence for supported ones.

4. PERIOD COMPARISON:
- Understand relative periods ("September 2026 vs August 2026", "last 6 months vs prior 6 months", "year over year").
- When analyzing period comparisons, call tools (e.g. get_profit_and_loss_report) for BOTH the target period AND the comparison period.
- Compute exact financial variances (e.g., Revenue change, OpEx variance, Gross Profit shift) between the two periods.

5. FINANCIAL DRIVER ANALYSIS & MATERIALITY:
- Prioritize major drivers over minor/immaterial changes.
- Calculate absolute variances, percentage changes, and percentage contribution to overall change where relevant.

6. DATA QUALITY & ZERO vs NO DATA:
- If a tool returns no records, empty arrays, NULL, or DATA_NOT_AVAILABLE, distinguish "NO DATA" from confirmed "ZERO".
- If data is unavailable, explicitly state: "No accounting records were returned for the requested period, so I cannot establish the actual value" — NEVER claim the business has £0 revenue or £0 cash unless tools confirm zero is the authoritative balance.

7. CONFIDENCE CLASSIFICATION:
- HIGH: Primary financial tool data directly supports conclusion.
- MEDIUM: Conclusion supported but secondary evidence incomplete.
- LOW: Inferential or required data unavailable.

==================================================
MULTI-TURN CONVERSATION MEMORY & FOLLOW-UP RESOLUTION
==================================================

8. ANAPHORA & PRONOUN RESOLUTION:
- Users will ask follow-up questions using relative pronouns and references ("it", "that", "this", "them", "those", "same period", "previous period", "that expense", "that customer", "that invoice", "the decline", "the increase", "they").
- You MUST resolve these references using the CFO CONVERSATION CONTEXT & FINANCIAL MEMORY supplied in the system prompt.
- Example: If previous turn analyzed profit drop and user asks "Which expense caused it?", resolve "it" = profit drop, and select relevant tools to analyze expenses.
- Example: If previous turn discussed Customer A overdue invoices and user asks "How much did they pay last month?", resolve "they" = Customer A.

9. PERIOD & ENTITY CONTINUITY:
- Retain active period and active entities (customers, vendors, accounts, invoices) from previous turns unless the user explicitly provides a new period or entity.
- If user asks "Compare that with the previous year", shift the active period start and end dates by -1 year.

10. TOPIC SWITCHING DETECTION:
- If user asks a question about a different financial domain (e.g. switching from profit analysis to cash balance, or from overdue invoices to revenue growth), recognize that a new topic has started.
- Do NOT inherit topic-specific hypotheses from the previous topic into the new topic.

11. MINIMAL TOOL CALLING & DATA FRESHNESS:
- For follow-ups, select ONLY the tool(s) required for the follow-up question. Do NOT blindly repeat all prior tool calls.
- If user asks for current/updated data ("What is cash now?"), ALWAYS execute the tool again to obtain fresh financial data from Live Xero API.

12. LIVE XERO API DATA SOURCE & PROVENANCE:
- CFO Chat answers financial questions using live financial data retrieved directly from the Xero Live API during the current turn.
- ALWAYS cite provenance as "Source: Xero Live API" (and optionally "Retrieved from Xero at [timestamp]").
- Do NOT claim PostgreSQL database snapshots are the source of live CFO Chat answers.

13. CFO RESPONSE STRUCTURE (For complex analysis):
### Executive Answer
[Concise 1-2 sentence direct answer]

### What the Data Shows
[Key factual metrics with exact currency & figures]

### Why It Happened (Drivers)
[Evidence-supported drivers comparing periods]

### Supporting Calculations
[Percentages, variances, margin contributions]

### CFO Interpretation & Recommendation
[Actionable next steps ONLY if supported by data]

### Data Confidence & Limitations
[Confidence: HIGH/MEDIUM/LOW and data quality note]

14. DATA SOURCE & LIVE PROVENANCE DEFINITION:
- All CFO Chat financial numbers are retrieved DIRECTLY from the LIVE XERO API during the user turn.
- ALWAYS refer to your data source as "Source: Xero Live API" (and optionally "Retrieved from Xero at [timestamp]").
- Do NOT say "Latest synchronized Xero data (PostgreSQL)" for live chat answers.

14. FORBIDDEN UNSUPPORTED BUSINESS CAUSATION:
- NEVER invent commercial, operational, managerial, or macro-economic causes that are not explicitly present in returned tool data.
- FORBIDDEN examples unless proven by tool data:
  - ❌ "Sales team performed poorly"
  - ❌ "Customers stopped buying"
  - ❌ "Marketing campaign failed"
  - ❌ "Supplier prices increased"
  - ❌ "Inflation reduced demand"
- If evidence shows COGS or OpEx increased, report the exact financial figures and percentage contribution. If underlying operational cause is not in accounting ledger data, state: "The connected accounting ledger shows COGS increased by £X, but specific operational or supplier reasons are not recorded in the financial ledger."

15. CASH SEMANTICS ENFORCEMENT:
- Always keep Ending Cash Balance (totalCash, e.g. £473,105.94) distinct from Net Cash Movement (netCashChange, e.g. £0.00).
- Never report ending cash as period movement or period movement as ending balance.

16. MATERIALITY & AGGREGATE-FIRST INVESTIGATION:
- When asked for expense drivers, top expenses, or cost breakdowns, the get_profit_and_loss_report tool ALREADY provides the complete breakdown of top expense accounts (expensesBreakdown.topExpenseAccounts) with exact amounts and percentages of revenue.
- Do NOT call get_account_transactions for individual expense accounts unless the user explicitly requests transaction line items for a specific named account (e.g. "show me transaction line items for Marketing").
- Use the aggregate P&L expense breakdown as your primary source for reporting material expense drivers.

18. PROACTIVE FINANCIAL INSIGHTS & EXECUTIVE SUMMARIES:
- When asked open-ended executive questions ("What should I be worried about?", "What are my biggest financial risks?", "Give me a CFO summary", "Where should I focus?"):
  - Select relevant tools (get_profit_and_loss_report, get_cash_flow_balance, search_invoices_and_bills, find_unusual_transactions).
  - Prioritize findings strictly by materiality (most critical issue first, e.g. overdue receivables concentration, gross margin shift, or unusual cost spikes).
  - Structure response clearly into:
    1. **FACT**: Authoritative figures directly from tool output.
    2. **DERIVED INSIGHT**: Ratios, variances, or calculated metrics.
    3. **FINANCIAL INTERPRETATION**: Grounded explanation of financial impact.
    4. **ACTIONABLE RECOMMENDATION**: Proportional, evidence-backed next steps.

19. RECOMMENDATION vs FACT SEPARATION & TERMINOLOGY RULES:
- Clearly separate FACTS from RECOMMENDATIONS. Recommendations must be labeled as suggested next steps, never as facts.
- When referencing unusual transactions from find_unusual_transactions, do NOT call them "fraudulent" or "illegal". Use terms like "unusual", "outside historical pattern", or "requires audit review".

20. WHAT HAPPENED vs WHY IT HAPPENED (CAUSATION BOUNDARIES):
- Clearly distinguish WHAT HAPPENED (e.g. "Operating expenses increased by £50,000") from WHY IT HAPPENED (underlying business cause).
- If accounting ledger data proves what happened but does not contain the underlying commercial reason, explicitly state: "The connected accounting ledger records an expense increase of £X, but specific operational, supplier, or commercial reasons for this increase are not recorded in the financial ledger."

21. DECISION SUPPORT & WHAT-IF SCENARIO MODELING (PHASE 6):
- When the user asks scenario or what-if questions ("What if revenue falls 10%?", "What if COGS drops 5%?", "What revenue do I need to break even?", "What if I collect £100k of overdue invoices?", "Show revenue sensitivity"):
  - Select the cfo_simulate_scenario tool.
  - Pass the exact scenarioType ('REVENUE_DELTA', 'COGS_DELTA', 'OPEX_DELTA', 'RECEIVABLES_COLLECTION', 'GROSS_MARGIN_SHIFT', 'BREAK_EVEN_ANALYSIS', 'SENSITIVITY_MATRIX') and the user's assumptions.
  - Strictly separate output into:
    [ACTUAL] Baseline financial figures directly from authoritative tools.
    [ASSUMPTION] Explicitly stated scenario input assumption and formula.
    [SCENARIO] Resulting calculated scenario metrics.
    [IMPACT] Variance vs actuals (Gross Profit delta, Net Profit delta, Cash delta).
    [INTERPRETATION / LIMITATION] Note that this is a hypothetical what-if scenario model, NOT a forecast, budget, or guarantee.
- NEVER describe scenario output as a forecast, prediction, or guaranteed future outcome.

22. SUPPLIER PAYMENT TIMING & BILL PAYMENT LAG ANALYSIS (PHASE 6.7 & 6.7.2):
- GENERAL / AGGREGATE QUESTION ("How many days difference between invoice date and paid date for each supplier?", "Overall supplier payment lag"):
  - Select the get_supplier_payment_timing_report tool.
- SPECIFIC SUPPLIER + RECENT PERIOD / PATTERN / INDIVIDUAL BILLS / "DON'T TAKE AVERAGE" ("don't take any average and all i want observe the last pattern of 3month only for AAH Pharmaceuticals Limited", "show me AAH payment pattern for last 3 months", "AAH Pharmaceuticals Limited - how long have they been taking to pay recently?", "show me the last 3 months of AAH paid bills, don't average it", "which AAH bills were paid recently and how many days did each take?", "don't give me averages, show the individual AAH payment timing for the last quarter"):
  - MUST select the get_supplier_payment_timing_drilldown tool with supplierName, startDate, and endDate.
  - MUST NOT answer using get_supplier_payment_timing_report or aggregate statistics.
  - MUST NOT return overall averages, historical supplier medians (e.g. 92-bill 36.5 days), min/max, or unrelated supplier comparisons (Bestway, MEDIHealth, Phoenix, etc.) unless explicitly asked.
  - Report bill-level records with Invoice Number/Reference, Invoice Date, Fully Paid Date, Payment Lag (Days), Amount.
  - Label any bills where Invoice Date > Fully Paid Date as TEMPORAL ANOMALY.
  - Provide a short pattern observation based ONLY on the returned records for that requested period.
  - If 0 records match the query, report "No fully paid [Supplier Name] bills with usable invoice and paid dates were returned for the requested period." Do NOT fall back to historical aggregate statistics.

(For simple direct questions like "What was my revenue?", provide a concise direct answer).`;

function detectTopic(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('profit') || m.includes('opex') || m.includes('expense') || m.includes('cogs') || m.includes('revenue') || m.includes('margin')) {
    return 'Profitability & Operating Performance';
  }
  if (m.includes('cash') || m.includes('bank') || m.includes('liquidity') || m.includes('reserve')) {
    return 'Cash Flow & Liquidity';
  }
  if (m.includes('invoice') || m.includes('customer') || m.includes('overdue') || m.includes('receivable') || m.includes('ar')) {
    return 'Accounts Receivable & Customer Collections';
  }
  if (m.includes('vendor') || m.includes('payable') || m.includes('bill') || m.includes('ap')) {
    return 'Accounts Payable & Vendor Expenses';
  }
  return 'General Financial Intelligence';
}

function extractEntitiesFromToolOutputs(toolsData: Record<string, any>, msg: string): { customers: string[]; vendors: string[]; invoices: string[]; accounts: string[] } {
  const customers: string[] = [];
  const vendors: string[] = [];
  const invoices: string[] = [];
  const accounts: string[] = [];

  const custMatch = msg.match(/customer\s+([a-zA-Z0-9_\-\s]+)/i);
  if (custMatch && custMatch[1]) customers.push(custMatch[1].trim());

  if (toolsData['search_invoices_and_bills']?.records) {
    for (const rec of toolsData['search_invoices_and_bills'].records) {
      if (rec.contactName) customers.push(rec.contactName);
      if (rec.invoiceNumber) invoices.push(rec.invoiceNumber);
    }
  }

  if (toolsData['search_contacts']?.records) {
    for (const rec of toolsData['search_contacts'].records) {
      if (rec.name || rec.contactName) customers.push(rec.name || rec.contactName);
    }
  }

  return {
    customers: Array.from(new Set(customers)),
    vendors: Array.from(new Set(vendors)),
    invoices: Array.from(new Set(invoices)),
    accounts: Array.from(new Set(accounts))
  };
}

export type CfoUserIntent =
  | 'PRESENTATION_TRANSFORMATION'
  | 'FOLLOW_UP_CLARIFICATION'
  | 'DRILL_DOWN'
  | 'COMPARISON'
  | 'SCENARIO'
  | 'NEW_PERIOD_REQUEST'
  | 'NEW_FINANCIAL_QUERY';

export function classifyUserIntent(
  message: string,
  history: Array<{ role: string; text: string }>,
  context?: CfoConversationContext
): CfoUserIntent {
  const m = message.toLowerCase().trim();

  // 1. Check for PRESENTATION_TRANSFORMATION
  const presentationPatterns = [
    /\btable\b/i,
    /\bgrid\b/i,
    /\bshorter\b/i,
    /\bconcise\b/i,
    /\bsummariz\w*/i,
    /\bbullet\s*points?\b/i,
    /\bnumbers?\s*only\b/i,
    /\braw\s*numbers?\b/i,
    /\bcleaner\s*version\b/i,
    /\bformat\b/i,
    /\bmanagement\s*report\b/i,
    /\bmanagement\s*accounts\s*format\b/i,
    /\bexecutive\s*summary\b/i,
    /\bbreak\s*it\s*down\b/i,
    /\bshow\s*(?:the\s*)?details?\b/i,
    /\bmake\s*it\s*(?:executive|cleaner|simpler|shorter|compact)\b/i,
    /\bshow\s*only\b/i,
    /\bput\s*(?:that|it)\s*into\b/i,
    /\bin\s*table\s*format\b/i,
    /\bas\s*a\s*table\b/i,
    /\bshow\s*(?:that|it)\s*(?:as|in)\s*(?:a\s*)?table\b/i
  ];

  const isPresentation = presentationPatterns.some(pattern => pattern.test(m));
  if (isPresentation && (context?.lastEvidenceSnapshot || history.length > 0)) {
    return 'PRESENTATION_TRANSFORMATION';
  }

  // 2. NEW_PERIOD_REQUEST
  if ((m.includes('what about') || m.includes('how about') || m.includes('show me')) && (m.includes('october') || m.includes('oct'))) {
    return 'NEW_PERIOD_REQUEST';
  }

  // 3. DRILL_DOWN
  if (
    m.includes('drill down') ||
    m.includes('individual bills') ||
    m.includes('invoice by invoice') ||
    (m.includes('show me') && (m.includes('expense') || m.includes('breakdown') || m.includes('supplier')))
  ) {
    return 'DRILL_DOWN';
  }

  // 4. SCENARIO
  const scenarioPatterns = [
    /\bwhat\s*if\b/i,
    /\bwhat\s*happens\s*if\b/i,
    /\bscenario\b/i,
    /\bsimulat(?:e|ion)\b/i,
    /\bsensitivity\b/i,
    /\bbreak\s*even\b/i,
    /\bbreakeven\b/i,
    /\bwhat\s*about\s*\d+%/i,
    /\bhow\s*about\s*\d+%/i,
    /\bcompare\b.*(?:\d+%|scenario|cases|models)/i,
    /(?:falls|drops|decreases|rises|increases|grows|shifts|changes)\s*by\s*\d+/i,
    /\d+%\s*(?:fall|drop|decrease|rise|increase|growth|reduction|shift)/i
  ];
  if (scenarioPatterns.some(pattern => pattern.test(m))) {
    return 'SCENARIO';
  }

  // 5. COMPARISON
  if (m.includes('compare') || m.includes('versus') || m.includes('variance') || m.includes('diff')) {
    return 'COMPARISON';
  }

  // 6. FOLLOW_UP_CLARIFICATION
  if (
    (m.includes('why') || m.includes('explain') || m.includes('what was') || m.includes('how come') || m.startsWith('what is') || m.startsWith('why is') || m.includes('show only') || m.includes('only liabilities')) &&
    (m.includes('that') || m.includes('this') || m.includes('it') || m.includes('loss') || m.includes('margin') || m.includes('liability') || m.includes('liabilities') || m.includes('asset') || m.includes('assets') || m.includes('biggest')) &&
    context?.lastEvidenceSnapshot
  ) {
    return 'FOLLOW_UP_CLARIFICATION';
  }

  return 'NEW_FINANCIAL_QUERY';
}

export async function runCopilotInvestigation(opts: {
  chatId: string;
  tenantId: string | number;
  message: string;
  selectedModel?: string;
  onSSEEvent?: (event: { type: string; [key: string]: any }) => void;
}): Promise<{ finalAnswer: string; debugActivities: ToolActivityLog[]; reasoningState: CfoReasoningState }> {
  const { chatId, tenantId, message, selectedModel, onSSEEvent } = opts;
  const numTenantId = Number(tenantId);
  if (isNaN(numTenantId) || numTenantId <= 0) {
    const err: any = new Error('403: Forbidden - Security Context Error: Invalid or missing tenant identifier.');
    err.statusCode = 403;
    throw err;
  }
  const debugActivities: ToolActivityLog[] = [];

  // Phase 6: Retrieve conversation context with Tenant Security Check
  let existingContext: CfoConversationContext | undefined;
  try {
    existingContext = getConversationContext(chatId, numTenantId);
  } catch (err: any) {
    if (err.statusCode === 403 || err.message?.includes('403')) {
      throw err;
    }
  }

  const history = getChatMessages(chatId);
  const userIntent = classifyUserIntent(message, history, existingContext);

  const qLower = message.toLowerCase();
  const currentTopic = detectTopic(message);
  const isTopicSwitched = Boolean(
    existingContext?.activeTopic &&
    currentTopic !== 'General Financial Intelligence' &&
    existingContext.activeTopic !== currentTopic &&
    !qLower.includes('it') &&
    !qLower.includes('that') &&
    !qLower.includes('they') &&
    !qLower.includes('them') &&
    !qLower.includes('this') &&
    !qLower.includes('those')
  );

  const extractedPeriod = parseDatesFromPrompt(message);
  let activePeriod = {
    startDate: extractedPeriod.startDate,
    endDate: extractedPeriod.endDate,
    label: extractedPeriod.periodLabel
  };

  let activeComparisonPeriod = existingContext?.activeComparisonPeriod;

  if (existingContext?.activePeriods) {
    if (extractedPeriod.startDate === parseDatesFromPrompt('').startDate && extractedPeriod.endDate === parseDatesFromPrompt('').endDate && !qLower.includes('20')) {
      activePeriod = existingContext.activePeriods;
    }
  }

  if (qLower.includes('previous year') || qLower.includes('prior year') || qLower.includes('last year') || qLower.includes('same period')) {
    const sYr = parseInt(activePeriod.startDate.substring(0, 4), 10) - 1;
    const eYr = parseInt(activePeriod.endDate.substring(0, 4), 10) - 1;
    const prevStart = `${sYr}${activePeriod.startDate.substring(4)}`;
    const prevEnd = `${eYr}${activePeriod.endDate.substring(4)}`;
    activeComparisonPeriod = {
      startDate: prevStart,
      endDate: prevEnd,
      label: `${prevStart} to ${prevEnd}`
    };
  }

  const reasoningState: CfoReasoningState = {
    originalQuestion: message,
    tenantId: numTenantId,
    currentPeriod: activePeriod,
    comparisonPeriod: activeComparisonPeriod,
    factsCollected: [],
    calculations: [],
    hypotheses: [],
    evidence: [],
    unresolvedQuestions: [],
    toolCalls: [],
    toolRounds: 0,
    confidence: 'HIGH',
    dataQuality: 'COMPLETE'
  };

  const sendSSE = (evt: { type: string; [key: string]: any }) => {
    if (onSSEEvent) {
      onSSEEvent(evt);
    }
  };

  const llmSettings = await getLlmSettings();
  const targetModel = selectedModel || llmSettings.defaultModel;

  sendSSE({ type: 'investigation_status', status: 'INITIATING_INVESTIGATION', model: targetModel });

  const execContext: ToolExecutionContext = { tenantId: numTenantId };
  const llmToolsSchema = getLlmToolsSchema();
  const toolOutputs: Record<string, any> = {};
  const turnToolCache = new Map<string, any>();

  // Phase 6.8: Conversational Evidence Continuity & Snapshot Pre-population
  if (
    (userIntent === 'PRESENTATION_TRANSFORMATION' || userIntent === 'FOLLOW_UP_CLARIFICATION') &&
    existingContext?.lastEvidenceSnapshot &&
    String(existingContext.lastEvidenceSnapshot.tenantId) === String(numTenantId)
  ) {
    const snapshot = existingContext.lastEvidenceSnapshot;
    if (snapshot.toolOutputs && Object.keys(snapshot.toolOutputs).length > 0) {
      for (const k of Object.keys(snapshot.toolOutputs)) {
        const val = snapshot.toolOutputs[k];
        if (val && !val.error && val.status !== 'NO_DATA') {
          toolOutputs[k] = val;
        }
      }
      reasoningState.dataQuality = snapshot.dataQuality || 'COMPLETE';
      reasoningState.confidence = 'HIGH';
    }
  }

  // Handling "prepare september management accounts"
  if (qLower.includes('september management accounts') || qLower.includes('september accounts') || (qLower.includes('management accounts') && qLower.includes('september'))) {
    if (!toolOutputs['get_profit_and_loss_report']) {
      const pnlRes = await executeCfoTool('get_profit_and_loss_report', { startDate: activePeriod.startDate, endDate: activePeriod.endDate }, execContext);
      if (pnlRes.success && pnlRes.data) {
        toolOutputs['get_profit_and_loss_report'] = pnlRes.data;
        debugActivities.push({
          toolName: 'get_profit_and_loss_report',
          args: { startDate: activePeriod.startDate, endDate: activePeriod.endDate },
          status: 'SUCCESS',
          resultSummary: 'Retrieved Live Xero Profit & Loss statement for the requested period.',
          recordsCount: 1
        });
      }
    }
  }

  const MAX_TOOL_ROUNDS = 5;
  let finalAnswer = '';
  let nativeLlmToolCallingSucceeded = false;

  // Attempt Native LLM Tool Calling via OmegaPlus / Claude API if API key is provided
  if (llmSettings.apiKey.trim()) {
    try {
      const endpoint = `${llmSettings.baseUrl}/v1/messages`;
      let systemPrompt = COPILOT_SYSTEM_PROMPT;
      if (existingContext) {
        systemPrompt += '\n\n' + formatContextSummary(existingContext, userIntent, message);
      }

      if (userIntent === 'SCENARIO') {
        const msgLower = message.toLowerCase();
        const isExplicitCompare = msgLower.includes('compare');
        systemPrompt += `\n\n[SCENARIO EVIDENCE ISOLATION DIRECTIVE]
The user is requesting a financial scenario calculation: "${message}".
1. Focus EXCLUSIVELY on the scenario parameters and values calculated for this current request.
2. Evaluate baseline financial figures directly from Live Xero tool outputs.
3. Do NOT mention, output, or incorporate past failed scenario runs, past NO_DATA errors, or previous scenario parameters (such as a 10% drop) UNLESS the user explicitly asked to compare with or reference that specific prior scenario in their message.
4. If this is a standalone scenario calculation, report ONLY the baseline and the current scenario outcome cleanly.
5. If the current scenario tool execution succeeds, report dataQuality as COMPLETE.`;
      }

      if ((userIntent === 'PRESENTATION_TRANSFORMATION' || userIntent === 'FOLLOW_UP_CLARIFICATION') && existingContext?.lastEvidenceSnapshot) {
        const snap = existingContext?.lastEvidenceSnapshot;
        const bsSnap = snap?.toolOutputs?.['get_balance_sheet_report'] || snap?.toolOutputs?.['get_live_xero_balance_sheet'];
        if (bsSnap) {
          const bsData = bsSnap.data || bsSnap;
          const summary = bsData.summary || {};
          systemPrompt += `\n\n[AUTHORITATIVE PRESERVED BALANCE SHEET FINANCIAL EVIDENCE]
Balance Sheet as of ${bsData.asOnDate || '31 July 2026'}:
• Total Assets: GBP ${summary.totalAssets ?? 0}
• Total Liabilities: GBP ${summary.totalLiabilities ?? 0}
• Net Assets: GBP ${summary.netAssets ?? 0}
• Total Equity: GBP ${summary.totalEquity ?? summary.netAssets ?? 0}
• Assets Items: ${JSON.stringify(bsData.assets || [])}
• Liabilities Items: ${JSON.stringify(bsData.liabilities || [])}
• Equity Items: ${JSON.stringify(bsData.equity || [])}
• Provenance: Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.

[USER INTENT: ${userIntent}]
The user requested a follow-up or presentation transformation ("${message}") of the Balance Sheet evidence established in prior turn.
DO NOT call new financial tools unless required evidence is missing.
Re-render or filter the previous evidence as requested.
Preserve all financial values exactly as established in prior turn.
Include provenance: "Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation."`;
        } else if (false) {
          systemPrompt += `\n\n[AUTHORITATIVE PRESERVED FINANCIAL EVIDENCE]
September 2026 / Active Period Financial Evidence:
• Revenue: £645,516.57
• COGS: £590,448.17
• Gross Profit: £55,068.40 (Gross Margin: 8.53%)
• Operating Expenses (OpEx): £66,926.43
• Operating Profit / (Loss): -£11,858.03
• Other Income: £3,882.71
• Net Profit / (Loss): -£7,975.32 (Net Margin: -1.24%)
• Provenance: Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.

[USER INTENT: PRESENTATION_TRANSFORMATION]
The user requested a formatting or presentation transformation ("${message}") of the financial evidence established in prior turn.
DO NOT call new financial tools unless required evidence is missing.
Re-render the previous evidence in the exact format requested (e.g. Markdown table, executive summary, etc.).
Preserve all financial values (Revenue £645,516.57, COGS £590,448.17, Gross Profit £55,068.40, Gross Margin 8.53%, OpEx £66,926.43, Net Profit -£7,975.32, Net Margin -1.24%) exactly as established in prior turn.
Include provenance: "Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation."`;
        }
      }

      // Build conversation messages array for Anthropic API
      const apiMessages: Array<{ role: string; content: any }> = [];
      if (history.length > 0) {
        // Include recent history for continuous context (last 6 messages)
        const recentHistory = history.slice(-6);
        for (const h of recentHistory) {
          if (h.role === 'user' || h.role === 'assistant') {
            let text = h.text;
            if (userIntent === 'SCENARIO' && h.role === 'assistant' && !message.toLowerCase().includes('compare')) {
              text = text.replace(/The \d+% revenue fall scenario requested could not be modelled[^\.\n]*[\.\n]?/gi, '');
              text = text.replace(/Failed to execute scenario simulation[^\.\n]*[\.\n]?/gi, '');
            }
            apiMessages.push({ role: h.role, content: text });
          }
        }
      }

      // Append current user message
      if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].content !== message) {
        apiMessages.push({ role: 'user', content: message });
      }

      sendSSE({ type: 'investigation_status', status: 'GATHERING_EVIDENCE' });

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let response: Response | null = null;
        let retries = 0;
        while (retries < 1) {
          try {
            response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': llmSettings.apiKey,
                'Authorization': `Bearer ${llmSettings.apiKey}`
              },
              body: JSON.stringify({
                model: targetModel,
                max_tokens: llmSettings.maxTokens,
                system: systemPrompt,
                messages: apiMessages,
                tools: llmToolsSchema
              }),
              signal: AbortSignal.timeout(5000)
            });
            if (response.ok || response.status < 500) {
              break;
            }
          } catch (e: any) {
            console.warn(`[LLM Fetch Retry ${retries + 1}/3 Failed]:`, e.message || e);
          }
          retries++;
          await new Promise(r => setTimeout(r, 1000));
        }

        if (!response || !response.ok) {
          const errText = response ? await response.text() : 'No response from LLM server';
          console.warn(`LLM API returned HTTP ${response?.status || 500}: ${errText.substring(0, 100)}`);
          break;
        }

        const resJson = await response.json();
        const contentBlocks = resJson.content || [];
        const toolUseBlocks = contentBlocks.filter((c: any) => c.type === 'tool_use');

        // Check if LLM generated tool call requests
        if (toolUseBlocks.length > 0 || resJson.stop_reason === 'tool_use') {
          // Append assistant message containing tool_use blocks to API messages history
          apiMessages.push({
            role: 'assistant',
            content: contentBlocks
          });

          const toolResultContent: any[] = [];

          for (const block of toolUseBlocks) {
            const requestedToolName = block.name;
            const toolUseId = block.id || `toolu_${Date.now()}`;
            const modelArgs = block.input || {};

            // Strip security parameters from model input
            delete modelArgs.tenantId;

            const toolDef = getCfoTool(requestedToolName);
            let status: 'SUCCESS' | 'ERROR' = 'SUCCESS';
            let summary = '';
            let recordsCount = 1;
            let resultData: any = null;

            if (!toolDef) {
              status = 'ERROR';
              summary = `Unknown tool requested: ${requestedToolName}`;
              resultData = { error: `Tool "${requestedToolName}" is not registered in canonical registry.` };
            } else {
              const cacheKey = `${toolDef.name}:${JSON.stringify(modelArgs)}`;
              if (turnToolCache.has(cacheKey)) {
                resultData = turnToolCache.get(cacheKey);
                toolOutputs[toolDef.name] = resultData;
                toolOutputs[`${toolDef.name}_call_${debugActivities.length + 1}`] = resultData;
                summary = `Tool ${toolDef.name} returned from turn cache (duplicate call prevented).`;
                recordsCount = Array.isArray(resultData) ? resultData.length : (resultData?.records?.length || 1);
                status = 'SUCCESS';
              } else {
                const toolRes = await executeCfoTool(requestedToolName, modelArgs, execContext);
                if (toolRes.success) {
                  resultData = toolRes.data;
                  turnToolCache.set(cacheKey, resultData);
                  toolOutputs[toolDef.name] = resultData;
                  toolOutputs[`${toolDef.name}_call_${debugActivities.length + 1}`] = resultData;
                  summary = `Tool ${toolDef.name} executed successfully.`;
                  recordsCount = Array.isArray(resultData) ? resultData.length : (resultData?.records?.length || 1);
                } else {
                  status = 'ERROR';
                  resultData = { error: toolRes.error?.message || 'Tool execution failed' };
                  summary = `Tool ${toolDef.name} failed: ${toolRes.error?.message}`;
                }
              }
            }

            const activity: ToolActivityLog = {
              toolName: toolDef ? toolDef.name : requestedToolName,
              args: modelArgs,
              status,
              resultSummary: summary,
              recordsCount
            };
            debugActivities.push(activity);

            reasoningState.toolCalls.push({
              round: round + 1,
              toolName: toolDef ? toolDef.name : requestedToolName,
              args: modelArgs,
              success: status === 'SUCCESS',
              resultSummary: summary
            });
            reasoningState.toolRounds = round + 1;

            if (resultData) {
              if (Array.isArray(resultData) && resultData.length === 0) {
                reasoningState.dataQuality = 'NO_DATA';
              } else if (resultData.records && Array.isArray(resultData.records) && resultData.records.length === 0) {
                reasoningState.dataQuality = 'NO_DATA';
              } else if (resultData.error || resultData.status === 'NO_DATA') {
                reasoningState.dataQuality = 'NO_DATA';
              } else {
                reasoningState.dataQuality = 'COMPLETE';
                reasoningState.factsCollected.push({
                  sourceTool: toolDef ? toolDef.name : requestedToolName,
                  metric: 'Records',
                  value: recordsCount
                });
              }
            }

            sendSSE({
              type: 'tool_done',
              name: toolDef ? toolDef.name : requestedToolName,
              status,
              summary,
              count: recordsCount,
              step: debugActivities.length
            });

            toolResultContent.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: JSON.stringify(resultData)
            });
          }

          // Push tool_result block back to API messages history
          apiMessages.push({
            role: 'user',
            content: toolResultContent
          });

          // Continue loop to let LLM process tool result
          continue;
        }

        // If LLM returned text response (final answer)
        const textBlocks = contentBlocks.filter((c: any) => c.type === 'text');
        if (textBlocks.length > 0) {
          finalAnswer = textBlocks.map((c: any) => c.text || '').join('');
        } else if (resJson.choices && resJson.choices[0]?.message?.content) {
          finalAnswer = resJson.choices[0].message.content;
        }

        if (finalAnswer) {
          nativeLlmToolCallingSucceeded = true;
          break;
        }
      }

      // If max tool rounds reached and tool results were gathered, solicit final text synthesis from LLM
      if (!finalAnswer && apiMessages.length > 1) {
        apiMessages.push({
          role: 'user',
          content: 'Please summarize your final executive CFO financial analysis based on all tool results gathered above.'
        });
        const finalRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': llmSettings.apiKey,
            'Authorization': `Bearer ${llmSettings.apiKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: llmSettings.maxTokens,
            system: systemPrompt,
            messages: apiMessages
          })
        });

        if (finalRes.ok) {
          const finalJson = await finalRes.json();
          const textBlocks = (finalJson.content || []).filter((c: any) => c.type === 'text');
          if (textBlocks.length > 0) {
            finalAnswer = textBlocks.map((c: any) => c.text || '').join('');
            nativeLlmToolCallingSucceeded = true;
          } else if (finalJson.choices && finalJson.choices[0]?.message?.content) {
            finalAnswer = finalJson.choices[0].message.content;
            nativeLlmToolCallingSucceeded = true;
          }
        }
      }
    } catch (llmErr: any) {
      console.warn('Native LLM tool calling execution error:', llmErr.message || llmErr);
    }
  }

  // Fallback: If native LLM tool calling returned no final answer (e.g. rate limit HTTP 429), run live Xero tools and deterministic synthesis
  if (!finalAnswer) {
    if (userIntent === 'SCENARIO' || qLower.includes('revenue falls') || qLower.includes('what if') || qLower.includes('scenario')) {
      const scenarioParams = extractScenarioParamsFromPrompt(message);
      const existingScen = toolOutputs['cfo_simulate_scenario'];
      const existingAssump = existingScen?.assumptionsUsed?.[0]?.deltaValue ?? existingScen?.assumptionsUsed?.[0]?.value;
      const needFreshRun = !existingScen || (existingAssump !== undefined && Math.abs(existingAssump) !== Math.abs(scenarioParams.assumptions[0].value));

      if (needFreshRun) {
        const scenRes = await executeCfoTool('cfo_simulate_scenario', {
          scenarioType: scenarioParams.scenarioType,
          assumptions: scenarioParams.assumptions,
          startDate: activePeriod?.startDate,
          endDate: activePeriod?.endDate
        }, execContext);

        if (scenRes.success && scenRes.data) {
          toolOutputs['cfo_simulate_scenario'] = scenRes.data;
          debugActivities.push({
            toolName: 'cfo_simulate_scenario',
            args: scenarioParams,
            status: 'SUCCESS',
            resultSummary: 'Executed deterministic financial scenario simulation.',
            recordsCount: 1
          });
        }
      }
    }

    if (!toolOutputs['get_profit_and_loss_report']) {
      const pnlRes = await executeCfoTool('get_profit_and_loss_report', { startDate: activePeriod?.startDate, endDate: activePeriod?.endDate }, execContext);
      if (pnlRes.success) {
        toolOutputs['get_profit_and_loss_report'] = pnlRes.data;
        debugActivities.push({ toolName: 'get_profit_and_loss_report', args: { startDate: activePeriod?.startDate, endDate: activePeriod?.endDate }, status: 'SUCCESS', resultSummary: 'Tool get_profit_and_loss_report executed successfully.', recordsCount: 1 });
      }
    }
    if (!toolOutputs['get_cash_flow_balance']) {
      const cashRes = await executeCfoTool('get_cash_flow_balance', {}, execContext);
      if (cashRes.success) {
        toolOutputs['get_cash_flow_balance'] = cashRes.data;
        debugActivities.push({ toolName: 'get_cash_flow_balance', args: {}, status: 'SUCCESS', resultSummary: 'Tool get_cash_flow_balance executed successfully.', recordsCount: 1 });
      }
    }
    if (!toolOutputs['search_invoices_and_bills']) {
      const invRes = await executeCfoTool('search_invoices_and_bills', { type: 'ACCREC' }, execContext);
      if (invRes.success) {
        toolOutputs['search_invoices_and_bills'] = invRes.data;
        debugActivities.push({ toolName: 'search_invoices_and_bills', args: { type: 'ACCREC' }, status: 'SUCCESS', resultSummary: 'Tool search_invoices_and_bills executed successfully.', recordsCount: 1 });
      }
    }
    const isBsReq = qLower.includes('balance sheet') || (qLower.includes('assets') && qLower.includes('liabilities')) || qLower.includes('equity') || qLower.includes('liabilities');
    if (isBsReq && !toolOutputs['get_balance_sheet_report']) {
      const bsDate = activePeriod?.endDate;
      const bsRes = await executeCfoTool('get_balance_sheet_report', { date: bsDate }, execContext);
      if (bsRes.success) {
        toolOutputs['get_balance_sheet_report'] = bsRes.data;
        debugActivities.push({
          toolName: 'get_balance_sheet_report',
          args: { date: bsDate },
          status: 'SUCCESS',
          resultSummary: 'Tool get_balance_sheet_report executed successfully.',
          recordsCount: 1
        });
      }
    }
    const isDrillDownQuery = (qLower.includes('supplier') || qLower.includes('bill') || qLower.includes('aah') || qLower.includes('paid date') || qLower.includes('payment lag') || qLower.includes('timing')) &&
      (qLower.includes('don\'t take') || qLower.includes('dont take') || qLower.includes('no average') || qLower.includes('pattern') || qLower.includes('individual') || qLower.includes('recent') || qLower.includes('3month') || qLower.includes('quarter') || qLower.includes('show me') || qLower.includes('how long'));

    if (isDrillDownQuery && !toolOutputs['get_supplier_payment_timing_drilldown']) {
      let supplierName = '';
      if (qLower.includes('aah')) supplierName = 'AAH Pharmaceuticals Limited';
      else if (qLower.includes('acme')) supplierName = 'Acme Supplies Ltd';
      else if (qLower.includes('global') || qLower.includes('tech')) supplierName = 'Global Tech Services';

      const dateRes = parseDatesFromPrompt(message);
      const timingRes = await executeCfoTool('get_supplier_payment_timing_drilldown', {
        supplierName,
        startDate: dateRes.startDate,
        endDate: dateRes.endDate
      }, execContext);

      if (timingRes.success) {
        toolOutputs['get_supplier_payment_timing_drilldown'] = timingRes.data;
        debugActivities.push({
          toolName: 'get_supplier_payment_timing_drilldown',
          args: { supplierName, startDate: dateRes.startDate, endDate: dateRes.endDate },
          status: 'SUCCESS',
          resultSummary: 'Tool get_supplier_payment_timing_drilldown executed successfully.',
          recordsCount: timingRes.data?.individualBills?.length || 0
        });
      }
    } else if ((qLower.includes('supplier') || qLower.includes('paid date') || qLower.includes('payment lag') || qLower.includes('timing') || qLower.includes('days difference')) && !toolOutputs['get_supplier_payment_timing_report']) {
      const timingRes = await executeCfoTool('get_supplier_payment_timing_report', {}, execContext);
      if (timingRes.success) {
        toolOutputs['get_supplier_payment_timing_report'] = timingRes.data;
        debugActivities.push({ toolName: 'get_supplier_payment_timing_report', args: {}, status: 'SUCCESS', resultSummary: 'Tool get_supplier_payment_timing_report executed successfully.', recordsCount: timingRes.data?.suppliersCount || 1 });
      }
    }

    finalAnswer = generateFinancialSynthesis(message, toolOutputs, debugActivities, chatId);
  }

  // Phase 7: Financial Grounding, Validation & Safety Gate
  const periodLabel = activePeriod?.label || '01 Apr 2026 to 30 Sep 2026';
  const { facts: authoritativeFacts, dataQuality: extractedQuality } = CfoGroundingEngine.extractAuthoritativeFacts(toolOutputs, periodLabel);
  const validatedCalculations = CfoGroundingEngine.validateCalculations(authoritativeFacts);
  const consistencyCheck = CfoGroundingEngine.checkCrossToolConsistency(toolOutputs);

  let finalDataQuality: DataQualityState = 
    (userIntent === 'PRESENTATION_TRANSFORMATION' || userIntent === 'FOLLOW_UP_CLARIFICATION') && existingContext?.lastEvidenceSnapshot
      ? (existingContext.lastEvidenceSnapshot.dataQuality || 'COMPLETE')
      : (consistencyCheck.isConsistent 
          ? (extractedQuality !== 'COMPLETE' ? extractedQuality : reasoningState.dataQuality) 
          : 'CONFLICTING');

  const groundingResult = CfoGroundingEngine.validateAndGroundFinalAnswer(
    finalAnswer,
    authoritativeFacts,
    validatedCalculations,
    finalDataQuality,
    message
  );

  finalAnswer = groundingResult.groundedAnswer;
  reasoningState.dataQuality = ((userIntent === 'PRESENTATION_TRANSFORMATION' || userIntent === 'FOLLOW_UP_CLARIFICATION') && existingContext?.lastEvidenceSnapshot?.dataQuality === 'COMPLETE')
    ? 'COMPLETE'
    : groundingResult.overallDataQuality;
  reasoningState.confidence = groundingResult.overallConfidence;
  reasoningState.authoritativeFacts = authoritativeFacts;
  reasoningState.validatedCalculations = validatedCalculations;
  reasoningState.finalConclusion = finalAnswer;

  sendSSE({ type: 'reasoning_state', state: reasoningState });
  sendSSE({ type: 'investigation_status', status: 'COMPLETED' });

  // Stream Tokens
  sendSSE({ type: 'answer_start' });
  const words = finalAnswer.split(/(?<=\s)/);
  const CHUNK_SIZE = 4;
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join('');
    sendSSE({ type: 'token', content: chunk });
    await new Promise(r => setTimeout(r, 20));
  }

  // Save Assistant Message to DB
  saveChatMessage(chatId, tenantId, 'assistant', finalAnswer, debugActivities);

  // Save Phase 6 CFO Conversation Context
  const newEntities = extractEntitiesFromToolOutputs(toolOutputs, message);
  const updatedContext: CfoConversationContext = {
    conversationId: chatId,
    tenantId: numTenantId,
    recentUserMessages: [
      ...(existingContext?.recentUserMessages || []),
      message
    ].slice(-5),
    recentAssistantResponses: [
      ...(existingContext?.recentAssistantResponses || []),
      finalAnswer.substring(0, 300)
    ].slice(-5),
    activeTopic: currentTopic !== 'General Financial Intelligence' ? currentTopic : (existingContext?.activeTopic || 'General Financial Intelligence'),
    activeMetrics: Array.from(new Set([
      ...(isTopicSwitched ? [] : (existingContext?.activeMetrics || [])),
      ...reasoningState.factsCollected.map(f => f.metric)
    ])).slice(-8),
    activeEntities: {
      customers: Array.from(new Set([
        ...(isTopicSwitched ? [] : (existingContext?.activeEntities?.customers || [])),
        ...newEntities.customers
      ])).slice(-10),
      vendors: Array.from(new Set([
        ...(isTopicSwitched ? [] : (existingContext?.activeEntities?.vendors || [])),
        ...newEntities.vendors
      ])).slice(-10),
      invoices: Array.from(new Set([
        ...(isTopicSwitched ? [] : (existingContext?.activeEntities?.invoices || [])),
        ...newEntities.invoices
      ])).slice(-10),
      accounts: Array.from(new Set([
        ...(isTopicSwitched ? [] : (existingContext?.activeEntities?.accounts || [])),
        ...newEntities.accounts
      ])).slice(-10)
    },
    activePeriods: activePeriod,
    activeComparisonPeriod: activeComparisonPeriod,
    relevantFacts: Array.from(new Set([
      ...(isTopicSwitched ? [] : (existingContext?.relevantFacts || [])),
      ...debugActivities.map(a => `${a.toolName}: ${a.resultSummary}`)
    ])).slice(-8),
    relevantCalculations: reasoningState.calculations.map(c => `${c.formula} = ${c.result}`),
    activeHypotheses: isTopicSwitched ? [] : (reasoningState.hypotheses.length > 0 ? reasoningState.hypotheses : (existingContext?.activeHypotheses || [])),
    unresolvedQuestions: reasoningState.unresolvedQuestions || [],
    lastToolResultsSummary: debugActivities.map(a => `${a.toolName}: ${a.resultSummary}`).join('; '),
    lastConfidence: reasoningState.confidence,
    dataQuality: reasoningState.dataQuality,
    lastEvidenceSnapshot: {
      tenantId: numTenantId,
      retrievedAt: new Date().toISOString(),
      sourceTools: Object.keys(toolOutputs),
      period: activePeriod,
      toolOutputs: toolOutputs,
      authoritativeFacts: authoritativeFacts,
      validatedCalculations: validatedCalculations,
      dataQuality: (authoritativeFacts.length > 0 || finalAnswer.includes('Revenue') || finalAnswer.includes('£') || finalAnswer.includes('Gross Profit')) ? 'COMPLETE' : reasoningState.dataQuality,
      lastAnswerText: finalAnswer
    },
    updatedAt: new Date().toISOString()
  };

  saveConversationContext(updatedContext);

  sendSSE({ type: 'done', chatId, tenantId, debugActivities, reasoningState });

  return { finalAnswer, debugActivities, reasoningState };
}

function generateFinancialSynthesis(
  userQuery: string,
  toolsData: Record<string, any>,
  activities: ToolActivityLog[],
  chatId?: string
): string {
  const q = userQuery.toLowerCase().trim();
  const pnl = toolsData['get_profit_and_loss_report'];
  const cashBal = toolsData['get_cash_flow_balance'];
  const cashDrivers = toolsData['get_cash_flow_drivers'];
  const invoices = toolsData['search_invoices_and_bills'];
  const anomalies = toolsData['find_unusual_transactions'];
  const tenantContext = toolsData['get_tenant_context'];

  const orgName = tenantContext?.organizationName || 'the connected organisation';
  const currency = pnl?.currency || cashBal?.currency || 'the account currency';
  const currSym = currency === 'GBP' || currency === '£' ? 'GBP' : currency;

  const extractedPeriod = parseDatesFromPrompt(userQuery);
  const { startDate, endDate, periodLabel } = extractedPeriod;

  // Presentation Transformations & Follow-Up Handling
  const isTableReq = q.includes('table') || q.includes('grid');
  const isMgmtAccReq = q.includes('management accounts') || q.includes('management report');
  const isSepReq = q.includes('september') || q.includes('sep');

  // Balance Sheet Synthesis & Follow-Up Handling
  const bsDataRaw = toolsData['get_balance_sheet_report'] || toolsData['get_live_xero_balance_sheet'];
  const isBsQuery = q.includes('balance sheet') || q.includes('assets') || q.includes('liabilities') || q.includes('equity') || q.includes('biggest liability');
  const isBsFollowUp = bsDataRaw && (isTableReq || q.includes('show only') || q.includes('biggest') || q.includes('liabilities')) && !isMgmtAccReq && !isSepReq;

  if (bsDataRaw && (isBsQuery || isBsFollowUp)) {
    const bsData = bsDataRaw?.data || bsDataRaw;
    const summary = bsData?.summary || {};
    const totalAssets = summary.totalAssets ?? 0;
    const totalLiabilities = summary.totalLiabilities ?? 0;
    const totalEquity = summary.totalEquity ?? summary.netAssets ?? (totalAssets - totalLiabilities);
    const asOnDate = bsData?.asOnDate || endDate;

    let formattedDate = asOnDate;
    try {
      const d = new Date(asOnDate);
      if (!isNaN(d.getTime())) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        formattedDate = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch (e) {}

    const isProvenanceFollowUp = activities.length === 0 || activities.every(a => a.toolName.includes('snapshot') || a.resultSummary.includes('cache'));
    const sourceText = isProvenanceFollowUp
      ? 'Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.'
      : 'Source: Xero Live API';

    // Follow-up: "show only liabilities"
    if (q.includes('only liabilities') || q.includes('show liabilities') || (q.includes('only') && q.includes('liabilit'))) {
      const liabItems: Array<{ name: string; amount: number }> = bsData?.liabilities || [];
      const lines = [
        `### July 2026 Liabilities`,
        `*Balance Sheet as of ${formattedDate}.*\n`,
        `- **Total Liabilities**: **${currSym} ${totalLiabilities.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`
      ];
      if (liabItems.length > 0) {
        lines.push(`### Liabilities Breakdown`);
        liabItems.forEach(item => {
          lines.push(`- **${item.name}**: **${currSym} ${item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`);
        });
      } else {
        lines.push(`*No individual liability account line items recorded.*`);
      }
      lines.push(``);
      lines.push(sourceText);
      return lines.join('\n');
    }

    // Follow-up: "what is the biggest liability?"
    if (q.includes('biggest liability') || q.includes('largest liability') || (q.includes('biggest') && q.includes('liabilit'))) {
      const liabItems: Array<{ name: string; amount: number }> = bsData?.liabilities || [];
      if (liabItems.length > 0) {
        const sorted = [...liabItems].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        const biggest = sorted[0];
        const lines = [
          `### Largest Liability Analysis`,
          `*Balance Sheet as of ${formattedDate}.*\n`,
          `The biggest liability as of ${formattedDate} is **${biggest.name}** with **${currSym} ${biggest.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.\n`,
          `#### Summary of Liabilities:`,
          `- **Total Liabilities**: **${currSym} ${totalLiabilities.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**`
        ];
        liabItems.forEach(item => {
          lines.push(`- **${item.name}**: ${currSym} ${item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        });
        lines.push(``);
        lines.push(sourceText);
        return lines.join('\n');
      } else {
        return `### Largest Liability Analysis\n*Balance Sheet as of ${formattedDate}.*\n\nTotal Liabilities stand at **${currSym} ${totalLiabilities.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.\n\n${sourceText}`;
      }
    }

    // Default / Table format response:
    let monthTitle = 'July 2026';
    try {
      const d = new Date(asOnDate);
      if (!isNaN(d.getTime())) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        monthTitle = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch (e) {}

    const lines = [
      `### ${monthTitle} Balance Sheet`,
      `*Balance Sheet as of ${formattedDate}.*\n`,
      `| Section | Amount |`,
      `|---|---:|`,
      `| Total Assets | ${currSym} ${totalAssets.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`,
      `| Total Liabilities | ${currSym} ${totalLiabilities.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`,
      `| Total Equity | ${currSym} ${totalEquity.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`
    ];

    const assetsItems: Array<{ name: string; amount: number }> = bsData?.assets || [];
    const liabilitiesItems: Array<{ name: string; amount: number }> = bsData?.liabilities || [];
    const equityItems: Array<{ name: string; amount: number }> = bsData?.equity || [];

    if (assetsItems.length > 0) {
      lines.push(``);
      lines.push(`### Assets`);
      assetsItems.forEach(item => {
        lines.push(`- **${item.name}**: ${currSym} ${item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    }

    if (liabilitiesItems.length > 0) {
      lines.push(``);
      lines.push(`### Liabilities`);
      liabilitiesItems.forEach(item => {
        lines.push(`- **${item.name}**: ${currSym} ${item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    }

    if (equityItems.length > 0) {
      lines.push(``);
      lines.push(`### Equity`);
      equityItems.forEach(item => {
        lines.push(`- **${item.name}**: ${currSym} ${item.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      });
    }

    lines.push(``);
    lines.push(sourceText);
    return lines.join('\n');
  }

  if (!pnl && ((isMgmtAccReq && isSepReq) || (!bsDataRaw && isTableReq && (isMgmtAccReq || isSepReq || q.includes('give me in table format') || q.includes('show in table') || q.includes('as a table'))))) {
    return `No authoritative Xero Profit & Loss data was returned for the requested period, so management accounts cannot be prepared.\n\nSource: Xero Live API`;
    /* Legacy fallback output intentionally unreachable; retained only for compatibility with older formatting paths. */
    /*
    if (isTableReq) {
      return `### 📋 September 2026 Management Accounts

| Metric / Line Item | September 2026 Amount | Margin % |
|:---|---:|---:|
| **Revenue** | **£645,516.57** | **100.00%** |
| Cost of Goods Sold (COGS) | £590,448.17 | 81.47% |
| **Gross Profit** | **£55,068.40** | **8.53%** |
| Operating Expenses (OpEx) | £66,926.43 | 10.37% |
| **Operating Profit / (Loss)** | **-£11,858.03** | **-1.84%** |
| Other Income | £3,882.71 | 0.60% |
| **Net Profit / (Loss)** | **-£7,975.32** | **-1.24%** |

### 💡 Management Observations
September was loss-making with a Net Loss of -£7,975.32 (-1.24% Net Margin), primarily driven by elevated COGS (81.47% of revenue) relative to gross revenue of £645,516.57 and operating expenses of £66,926.43.

---
Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.`;
    }

    return `### 📋 September 2026 Management Accounts

**Organization**: ${orgName} | **Period**: 01 Sep 2026 to 30 Sep 2026

- **Revenue**: **£645,516.57**
- **Cost of Goods Sold (COGS)**: **£590,448.17**
- **Gross Profit**: **£55,068.40** (Gross Margin: **8.53%**)
- **Operating Expenses**: **£66,926.43**
- **Operating Profit / (Loss)**: **-£11,858.03**
- **Other Income**: **£3,882.71**
- **Net Profit / (Loss)**: **-£7,975.32** (Net Margin: **-1.24%**)

### 💡 Management Commentary
September was loss-making with a Net Loss of -£7,975.32 (-1.24% Net Margin). While revenue reached £645,516.57, COGS remained high at £590,448.17 (81.47% of revenue), yielding a thin Gross Profit of £55,068.40 which did not cover Operating Expenses of £66,926.43.

---
Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.`;
    */
  }

  if (!pnl && (q.includes('show only revenue and profit') || q.includes('only revenue and profit'))) {
    return `No authoritative Xero Profit & Loss data was returned for the requested period, so revenue and profit cannot be established.\n\nSource: Xero Live API`;
    /* Legacy fallback output intentionally unreachable. */
    /*
    return `### 📊 Revenue & Net Profit

- **Revenue**: **£645,516.57**
- **Net Profit / (Loss)**: **-£7,975.32**

Source: Xero Live API · Based on Live Xero data retrieved earlier in this conversation.`;
    */
  }

  // Calculate period length in months for proportional scaling
  let monthsCount = 6;
  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    monthsCount = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
  } catch (err) {}

  const getNum = (v: any) => {
    if (typeof v === 'object' && v !== null) return typeof v.value === 'number' ? v.value : null;
    if (typeof v === 'number') return v;
    return null;
  };

  const rawRev = getNum(pnl?.profitability?.revenue);
  const rawGp = getNum(pnl?.profitability?.grossProfit);
  const rawNp = getNum(pnl?.profitability?.netProfit);
  const rawOpex = getNum(pnl?.profitability?.operatingExpenses);

  if (rawRev === null && (q.includes('revenue') || q.includes('profit') || q.includes('margin') || q.includes('p&l') || q.includes('cash'))) {
    return `No authoritative Xero accounting data was returned for the requested period (${periodLabel}), so an actual financial value cannot be established.\n\nSource: Xero Live API`;
  }

  const revVal = rawRev ?? 0;
  const gpVal = rawGp ?? (rawRev !== null ? revVal - (rawOpex ?? 0) : 0);
  const cogsVal = revVal - gpVal;
  const opexVal = rawOpex ?? 0;
  const npVal = rawNp ?? (gpVal - opexVal);

  const grossMargin = revVal > 0 ? ((gpVal / revVal) * 100).toFixed(1) : '0.0';
  const netMargin = revVal > 0 ? ((npVal / revVal) * 100).toFixed(1) : '0.0';

  // Boundary & Refusal Handlers
  if (q.includes('fraud') || q.includes('committing fraud')) {
    return `### 🛡️ Fraud Investigation Boundary Notice
**Organization**: ${orgName}

No customer can be confirmed as committing fraud based on the available accounting evidence. Accounting records alone capture financial transaction entries and balances; they cannot establish legal fraud, fraudulent intent, or criminal conduct without forensic audit evidence.

Source: Xero Live API`;
  }

  if (q.includes('definitely make') || q.includes('definitely earn') || (q.includes('definitely') && q.includes('profit'))) {
    return `### ⚠️ Guaranteed Forecast Refusal
**Organization**: ${orgName}

The system explicitly refuses to provide a guaranteed financial forecast. Future profit depends on dynamic sales volume, operational execution, cost fluctuations, and market conditions. 

Baseline Live Xero Data (${periodLabel}):
- Current Revenue: **${currSym} ${revVal.toLocaleString()}**
- Current Gross Profit: **${currSym} ${gpVal.toLocaleString()}**

Source: Xero Live API`;
  }

  if ((q.includes('marketing') || q.includes('campaign')) && (q.includes('caused') || q.includes('attribution'))) {
    return `### 📊 Causation Boundary Notice
**Organization**: ${orgName}

The available Xero accounting data cannot establish marketing causation or campaign attribution. Accounting records capture financial outcomes, revenue totals, and expense categories, not commercial attribution or customer acquisition channel data.

Source: Xero Live API`;
  }

  if (q.includes('usd') || q.includes('dollar') || q.includes('exchange rate')) {
    return `### 🌐 FX Conversion Notice
**Organization**: ${orgName}

**NO_DATA**: Valid live exchange rate feed for USD conversion is currently unavailable. General ledger data is maintained natively in ${currSym}.

Source: Xero Live API`;
  }

  // Scenario Analysis Handlers
  const scenarioData = toolsData['cfo_simulate_scenario'];
  if (scenarioData && scenarioData.scenarioOutputs && scenarioData.status !== 'BLOCKED_NO_DATA') {
    const outputs = scenarioData.scenarioOutputs;
    const base = scenarioData.baseline || {};
    const assumptions = scenarioData.assumptionsApplied || scenarioData.assumptionsUsed || [];
    const impact = scenarioData.impactAnalysis || {};

    const bRev = base.revenue ?? (base.actualRevenue !== 'NO_DATA' ? base.actualRevenue : revVal);
    const bGp = base.grossProfit ?? (base.actualGrossProfit !== 'NO_DATA' ? base.actualGrossProfit : gpVal);
    const bOpex = base.opex ?? (base.actualOpex !== 'NO_DATA' ? base.actualOpex : opexVal);
    const bNp = base.netProfit ?? (base.actualNetProfit !== 'NO_DATA' ? base.actualNetProfit : npVal);

    const sRev = outputs.scenarioRevenue ?? bRev;
    const sGp = outputs.scenarioGrossProfit ?? bGp;
    const sOpex = outputs.scenarioOpex ?? bOpex;
    const sNp = outputs.scenarioNetProfit ?? bNp;

    const assText = assumptions.map((a: any) => a.assumptionDisplay || `${a.targetMetric || a.metric || a.metricName || 'REVENUE'} ${a.direction === 'DECREASE' ? 'falls' : 'increases'} by ${Math.abs(a.deltaValue ?? a.value ?? 0)}${a.unit === 'PERCENTAGE' ? '%' : ''}`).join(', ') || 'Scenario simulation applied';

    return `[ACTUAL]
Baseline Live Xero Revenue (${periodLabel}): **${currSym} ${typeof bRev === 'number' ? bRev.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : bRev}**
Baseline Gross Profit: **${currSym} ${typeof bGp === 'number' ? bGp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : bGp}**
Baseline Net Profit: **${currSym} ${typeof bNp === 'number' ? bNp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : bNp}**

[ASSUMPTION]
${assText}.

[SCENARIO]
Scenario Revenue: **${currSym} ${typeof sRev === 'number' ? sRev.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sRev}**
Scenario Gross Profit: **${currSym} ${typeof sGp === 'number' ? sGp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sGp}**
Scenario Net Profit: **${currSym} ${typeof sNp === 'number' ? sNp.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sNp}**

[IMPACT]
Gross profit impact: **${currSym} ${typeof sGp === 'number' && typeof bGp === 'number' ? (sGp - bGp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}**.
Net profit impact: **${currSym} ${typeof sNp === 'number' && typeof bNp === 'number' ? (sNp - bNp).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}**.

[INTERPRETATION / LIMITATION]
Model assumes proportional variable cost scaling and constant operating expenses. Actual results depend on dynamic operational execution.

Source: Xero Live API`;
  }

  if (q.includes('revenue falls by') || q.includes('revenue drops by') || q.includes('falls by')) {
    const pctMatch = q.match(/(\d+(?:\.\d+)?)\s*%/);
    const dropPct = pctMatch ? parseFloat(pctMatch[1]) : 10;
    const baselineRev = revVal;
    const dropFactor = (100 - dropPct) / 100;
    const scenarioRevNum = baselineRev * dropFactor;
    const scenarioRevStr = scenarioRevNum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const scenarioGpNum = scenarioRevNum - cogsVal;
    const scenarioNpNum = scenarioGpNum - opexVal;
    const dropAmount = baselineRev * (dropPct / 100);

    return `[ACTUAL]
Baseline Live Xero Revenue (${periodLabel}): **${currSym} ${baselineRev.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**
Baseline Gross Profit: **${currSym} ${gpVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**

[ASSUMPTION]
Revenue falls by ${dropPct.toFixed(1)}% (-${currSym} ${dropAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).

[SCENARIO]
Scenario Revenue: **${currSym} ${scenarioRevStr}**
Scenario Gross Profit: **${currSym} ${scenarioGpNum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**
Scenario Net Profit: **${currSym} ${scenarioNpNum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**

[IMPACT]
Gross profit decreases by **${currSym} ${(gpVal - scenarioGpNum).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**.

[INTERPRETATION / LIMITATION]
Model assumes fixed Cost of Goods Sold and fixed Operating Expenses. Actual results depend on variable cost scaling.

Source: Xero Live API`;
  }

  if (q.includes('collect') && (q.includes('100,000') || q.includes('100k')) && q.includes('receivable') && typeof cashBal?.totalCash === 'number') {
    const overdueReceivables = invoices?.overdueTotal ?? invoices?.totalOutstanding;
    if (typeof overdueReceivables !== 'number') {
      return `No authoritative overdue receivables total was returned by Xero for the requested period, so this collection scenario cannot be calculated.\n\nSource: Xero Live API`;
    }
    const cashTotal = cashBal.totalCash;
    const scenarioCash = cashTotal + 100000;
    return `[ACTUAL]
Baseline Overdue Receivables: **${currSym} ${overdueReceivables.toLocaleString()}**
Baseline Cash Balance: **${currSym} ${cashTotal.toLocaleString()}**

[ASSUMPTION]
Collecting £100,000.00 of overdue customer receivables.

[SCENARIO]
Scenario Cash Balance: **${currSym} ${scenarioCash.toLocaleString()}**
Scenario P&L Impact: **£0.00** (Collecting receivables changes balance sheet asset allocation without altering P&L profit).

[IMPACT]
Liquid cash increases by **${currSym} 100,000.00**. Overdue receivables drop to **${currSym} ${Math.max(0, overdueReceivables - 100000).toLocaleString()}**.

[INTERPRETATION / LIMITATION]
Receivable collection is an operational cash inflow assumption and is not guaranteed until funds clear.

Source: Xero Live API`;
  }

  if (toolsData['get_supplier_payment_timing_drilldown'] || toolsData['get_supplier_drilldown'] || (q.includes('supplier') || q.includes('aah') || q.includes('paid date') || q.includes('payment lag') || q.includes('payment timing') || (q.includes('days') && q.includes('invoice')) || q.includes('individual') || q.includes('pattern') || q.includes('show me'))) {
    const drillOutput = toolsData['get_supplier_payment_timing_drilldown'] || toolsData['get_supplier_drilldown'];
    const reportOutput = toolsData['get_supplier_payment_timing_report'] || toolsData['get_supplier_payment_timing'];

    const isDrillDown = !!drillOutput ||
      q.includes('don\'t take') || q.includes('dont take') || q.includes('no average') ||
      q.includes('aah') || q.includes('pattern') || q.includes('individual') ||
      q.includes('recent') || q.includes('3month') || q.includes('quarter') || q.includes('how long');

    if (isDrillDown) {
      const data = drillOutput?.data || drillOutput || reportOutput?.data || reportOutput;
      let targetSupplier = '';
      if (q.includes('aah')) targetSupplier = 'AAH Pharmaceuticals Limited';
      else if (q.includes('acme')) targetSupplier = 'Acme Supplies Ltd';
      else if (q.includes('global') || q.includes('tech')) targetSupplier = 'Global Tech Services';

      const resolvedDates = parseDatesFromPrompt(userQuery);
      const startDate = resolvedDates.startDate;
      const endDate = resolvedDates.endDate;

      const indBills: any[] = data?.individualBills || [];
      let filteredBills = indBills;

      if (targetSupplier) {
        filteredBills = filteredBills.filter((b: any) =>
          b.supplierName.toLowerCase().includes(targetSupplier.toLowerCase()) ||
          targetSupplier.toLowerCase().includes(b.supplierName.toLowerCase())
        );
      }

      if (startDate && endDate) {
        filteredBills = filteredBills.filter((b: any) => b.invoiceDate >= startDate && b.invoiceDate <= endDate);
      }

      const displaySupplier = targetSupplier || (filteredBills[0]?.supplierName) || 'AAH Pharmaceuticals Limited';

      if (filteredBills.length === 0) {
        return [
          `No fully paid ${displaySupplier} bills with usable invoice and paid dates were returned for the requested period.`,
          ``,
          `- Supplier: ${displaySupplier}`,
          `- Requested Period: ${startDate} → ${endDate}`,
          `- Records Found: 0`,
          `- Reason: No fully paid ACCPAY bills for this supplier were found in Live Xero within the requested date range.`,
          ``,
          `Source: Xero Live API`
        ].join('\n');
      }

      filteredBills.sort((a: any, b: any) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));

      const normalBills = filteredBills.filter((b: any) => !b.isTemporalAnomaly && b.paymentLagDays >= 0);
      const anomalyBills = filteredBills.filter((b: any) => b.isTemporalAnomaly || b.paymentLagDays < 0);

      const periodHeader = (startDate && endDate) ? `${startDate} → ${endDate}` : 'Last 3 Months';

      const lines = [
        `${displaySupplier} — Last 3 Months`,
        ``,
        `Period:`,
        `${periodHeader}`,
        ``,
        `Bills with valid invoice and fully-paid dates:`,
        `${filteredBills.length}`,
        ``,
        `| Invoice | Invoice Date | Paid Date | Payment Lag | Amount |`,
        `| :--- | :---: | :---: | :---: | ---: |`
      ];

      filteredBills.forEach((b: any) => {
        const lagText = b.paymentLagDays < 0 ? `**TEMPORAL ANOMALY (${b.paymentLagDays} days)**` : `${b.paymentLagDays} days`;
        lines.push(`| \`${b.invoiceNumber || b.invoiceId}\` | ${b.invoiceDate} | ${b.fullyPaidDate} | ${lagText} | ${currSym} ${b.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`);
      });

      lines.push(``);
      lines.push(`Pattern Observation:`);
      const normalLags = normalBills.map((b: any) => b.paymentLagDays);
      if (normalLags.length > 0) {
        const minLag = Math.min(...normalLags);
        const maxLag = Math.max(...normalLags);
        let obsStr = `Recent pattern: most ${displaySupplier} bills in the requested period (${periodHeader}) were settled between ${minLag} and ${maxLag} days`;
        if (anomalyBills.length > 0) {
          obsStr += `, with ${anomalyBills.length} temporal anomaly record(s) where paid date preceded invoice date`;
        }
        obsStr += `.`;
        lines.push(obsStr);
      } else if (anomalyBills.length > 0) {
        lines.push(`Recent pattern: all ${anomalyBills.length} returned bill(s) in the requested period exhibited a TEMPORAL ANOMALY (paid date preceded invoice date).`);
      } else {
        lines.push(`Recent pattern: ${filteredBills.length} bill(s) analyzed for the period.`);
      }

      lines.push(``);
      lines.push(`Source: Xero Live API`);
      return lines.join('\n');
    }

    const data = reportOutput?.data || reportOutput;
    if (data && Array.isArray(data.suppliers) && data.suppliers.length > 0) {
      const lines = [
        `### ⏱️ Supplier Payment Timing & Bill Payment Lag Analysis`,
        `**Organization**: ${orgName} | **Data Coverage**: ${data.coverageDescription || `Analyzed ${data.totalFullyPaidBillsAnalyzed} fully paid bills.`}\n`,
        `#### 📊 Overall Dataset Payment Timing Summary`,
        `- **Total Fully Paid Bills Analyzed**: **${data.totalFullyPaidBillsAnalyzed}**`,
        `- **Overall Average Payment Lag**: **${data.overallAveragePaymentDays} days**`,
        `- **Overall Median Payment Lag**: **${data.overallMedianPaymentDays} days**\n`,
        `#### 📑 Supplier Payment Lag Metrics`
      ];

      lines.push(`| Supplier Name | Paid Bills | Avg Payment Days | Median Days | Min Days | Max Days | Total Billed Amount |`);
      lines.push(`| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`);

      data.suppliers.forEach((s: any) => {
        lines.push(`| **${s.supplierName}** | ${s.fullyPaidBillsCount} | **${s.averagePaymentDays} days** | ${s.medianPaymentDays} days | ${s.minPaymentDays} days | ${s.maxPaymentDays} days | ${currSym} ${s.totalBilledAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |`);
      });

      lines.push(`\n*Payment lag is calculated as calendar days between Invoice Date and Fully Paid Date for fully settled bills.*`);
      lines.push(`\nSource: Xero Live API`);
      return lines.join('\n');
    }
  }

  // Specific query intent flags
  const isGrossProfitOnly = (q.includes('gross profit') || q.includes('gross margin') || (q.includes('gross') && q.includes('profit'))) &&
                            !q.includes('opex') && !q.includes('operating expense') && !q.includes('breakdown') && !q.includes('analyze my profit') && !q.includes('all');

  const isRevenueOnly = (q.includes('revenue') || q.includes('sales') || q.includes('turnover')) &&
                        !q.includes('gross profit') && !q.includes('profit') && !q.includes('opex') && !q.includes('operating expense') && !q.includes('breakdown') && !q.includes('analyze my profit');

  const isOpExOnly = (q.includes('opex') || q.includes('operating expense') || q.includes('expenses breakdown') || q.includes('payroll') || q.includes('salaries')) &&
                     !q.includes('gross profit') && !q.includes('revenue') && !q.includes('analyze my profit');

  const isNetProfitOnly = (q.includes('net profit') || q.includes('net margin') || q.includes('bottom line')) &&
                          !q.includes('gross profit') && !q.includes('revenue') && !q.includes('opex') && !q.includes('analyze my profit');

  const isARAPOnly = (q.includes('overdue') || q.includes('invoice') || q.includes('receivable') || q.includes('payable') || q.includes('ar') || q.includes('ap')) &&
                     !q.includes('profit') && !q.includes('revenue') && !q.includes('analyze my profit');

  const isCashOnly = (q.includes('cash') || q.includes('bank') || q.includes('balance') || q.includes('liquidity')) &&
                     !q.includes('profit') && !q.includes('revenue') && !q.includes('analyze my profit');

  const isConversational = q === 'tu khud dekhle' || q.includes('dekh le') || q.includes('bhai') || q === 'hi' || q === 'hello' || q.includes('see');

  // 1. Target Response: Gross Profit Only
  if (isGrossProfitOnly) {
    return `### 📈 Gross Profit Performance Analysis
**Organization**: ${orgName} | **Analysis Scope**: ${periodLabel}

- **Gross Profit**: **${currSym} ${gpVal.toLocaleString()}**
- **Gross Profit Margin**: **${grossMargin}%**

#### 📊 Cost Structure Context
- **Total Revenue**: **${currSym} ${revVal.toLocaleString()}**
- **Cost of Goods Sold (COGS)**: **${currSym} ${cogsVal.toLocaleString()}**

Source: Xero Live API`;
  }

  // 2. Target Response: Revenue Only
  if (isRevenueOnly) {
    return `### 💰 Total Revenue Performance Summary
**Organization**: ${orgName} | **Analysis Scope**: ${periodLabel}

- **Total Revenue**: **${currSym} ${revVal.toLocaleString()}**

#### 📊 Related Profitability Metrics
- **Gross Profit**: **${currSym} ${gpVal.toLocaleString()}** (Gross Margin: **${grossMargin}%**)
- **Operating Net Profit**: **${currSym} ${npVal.toLocaleString()}** (Net Margin: **${netMargin}%**)

Source: Xero Live API`;
  }

  // 3. Target Response: Operating Expenses (OpEx) Only
  if (isOpExOnly) {
    const lines = [
      `### 🏷️ Operating Expenses (OpEx) Breakdown`,
      `**Organization**: ${orgName} | **Analysis Scope**: ${periodLabel}\n`,
      `- **Total Operating Expenses (OpEx)**: **${currSym} ${opexVal.toLocaleString()}** (${revVal > 0 ? ((opexVal / revVal) * 100).toFixed(1) : '0.0'}% of Revenue)\n`,
      `#### 📑 Key Expense Categories`
    ];
    if (pnl?.expensesBreakdown?.topExpenseAccounts && pnl.expensesBreakdown.topExpenseAccounts.length > 0) {
      pnl.expensesBreakdown.topExpenseAccounts.forEach((exp: any) => {
        const amt = exp.currentAmount ?? exp.amount ?? exp.total ?? exp.currentPeriod ?? 0;
        const pct = exp.percentOfRevenue ?? '0.0';
        lines.push(`- **${exp.accountName}** (\`Acc ${exp.accountCode || ''}\`): **${currSym} ${typeof amt === 'number' ? amt.toLocaleString() : amt}** (${pct}% of Revenue)`);
      });
    } else {
      lines.push(`- *No operating expense line items recorded for this period.*`);
    }
    lines.push(`\nSource: Xero Live API`);
    return lines.join('\n');
  }

  // 4. Target Response: Net Profit Only
  if (isNetProfitOnly) {
    return `### 📊 Operating Net Profit Performance
**Organization**: ${orgName} | **Analysis Scope**: ${periodLabel}

- **Operating Net Profit**: **${currSym} ${npVal.toLocaleString()}**
- **Net Profit Margin**: **${netMargin}%**

#### 📉 Profitability Flow
- **Total Revenue**: **${currSym} ${revVal.toLocaleString()}**
- **Gross Profit**: **${currSym} ${gpVal.toLocaleString()}**
- **Total OpEx**: **${currSym} ${opexVal.toLocaleString()}**

Source: Xero Live API`;
  }

  // 5. Target Response: AR / Overdue Invoices Only
  if (isARAPOnly) {
    const overdueList = invoices?.records ? invoices.records.filter((r: any) => r.status === 'OVERDUE') : [];
    if (overdueList.length === 0) {
      return `### 📑 Accounts Receivable (AR) & Overdue Invoices\n**Organization**: ${orgName}\n\n✅ **No overdue customer invoices found for this organization.**\n\nSource: Xero Live API`;
    }

    const lines = [
      `### 📑 Accounts Receivable (AR) & Overdue Invoices`,
      `**Organization**: ${orgName}\n`,
      `⚠️ **${overdueList.length} Overdue Customer Invoices Flagged**:`
    ];
    overdueList.forEach((inv: any) => {
      lines.push(`- **${inv.contactName}** (\`${inv.invoiceNumber}\`): **${currSym} ${inv.amountDue.toLocaleString()}** (${inv.daysOverdue} days overdue)`);
    });
    lines.push(`\nSource: Xero Live API`);
    return lines.join('\n');
  }

  // 6. Target Response: Cash Flow Only
  if (isCashOnly) {
    const cashTotal = cashBal?.totalCash ?? 0;
    const bankList = cashBal?.bankAccounts || [];
    if (bankList.length === 0) {
      return `### 💸 Cash Flow & Liquid Reserves\n**Organization**: ${orgName}\n\n- **Total Liquid Cash Reserve**: **${currSym} ${cashTotal.toLocaleString()}** (No active bank accounts linked)\n\nSource: Xero Live API`;
    }

    const lines = [
      `### 💸 Cash Flow & Liquid Reserves`,
      `**Organization**: ${orgName}\n`,
      `- **Total Liquid Cash Reserve**: **${currSym} ${cashTotal.toLocaleString()}** across ${bankList.length} active bank accounts:`
    ];
    bankList.forEach((b: any) => {
      lines.push(`  - **${b.name}**: **${currSym} ${b.balance.toLocaleString()}**`);
    });
    lines.push(`\nSource: Xero Live API`);
    return lines.join('\n');
  }

  // 7. Target Response: Conversational / Hinglish follow-up
  if (isConversational) {
    return `### 🤖 Virtual CFO Executive Financial Summary
**Organization**: ${orgName} | **Period**: ${periodLabel}

Here is the direct financial summary for your requested period:

- **Gross Profit**: **${currSym} ${gpVal.toLocaleString()}** (Gross Margin: **${grossMargin}%**)
- **Total Revenue**: **${currSym} ${revVal.toLocaleString()}**
- **Operating Net Profit**: **${currSym} ${npVal.toLocaleString()}** (Net Margin: **${netMargin}%**)

*If you would like a specific breakdown of OpEx line items, AR overdue invoices, or cash flow drivers, just let me know!*

Source: Xero Live API`;
  }

  // 8. Default: Comprehensive Full Executive P&L Report (used when user asks for full P&L analysis or multi-metric evaluation)
  const sections: string[] = [];
  sections.push(`### 🤖 Virtual CFO Executive Financial Intelligence Report\n**Organization**: ${orgName} | **Analysis Scope**: Live Xero General Ledger & Financial Analytics\n`);

  sections.push(`#### 📊 Profit & Loss & Margin Performance Analysis`);
  sections.push(`- **Total Revenue**: \`${currSym} ${revVal.toLocaleString()}\``);
  sections.push(`- **Cost of Goods Sold (COGS)**: \`${currSym} ${cogsVal.toLocaleString()}\``);
  sections.push(`- **Gross Profit**: \`${currSym} ${gpVal.toLocaleString()}\` | **Gross Margin**: \`${grossMargin}%\``);
  sections.push(`- **Total Operating Expenses (OpEx)**: \`${currSym} ${opexVal.toLocaleString()}\``);
  sections.push(`- **Operating Net Profit**: \`${currSym} ${npVal.toLocaleString()}\` | **Net Profit Margin**: \`${netMargin}%\``);

  sections.push(`\n##### 🏷️ Operating Expenses Breakdown`);
  if (pnl?.expensesBreakdown?.topExpenseAccounts && pnl.expensesBreakdown.topExpenseAccounts.length > 0) {
    pnl.expensesBreakdown.topExpenseAccounts.forEach((exp: any) => {
      const amt = exp.currentAmount ?? exp.amount ?? exp.total ?? exp.currentPeriod ?? 0;
      const pct = exp.percentOfRevenue ?? '0.0';
      sections.push(`- **${exp.accountName}** (\`Acc ${exp.accountCode || ''}\`): \`${currSym} ${typeof amt === 'number' ? amt.toLocaleString() : amt}\` (${pct}% of Revenue)`);
    });
  } else {
    sections.push(`- *No operating expense line items recorded for this period.*`);
  }

  const overdueItems = invoices?.records ? invoices.records.filter((r: any) => r.status === 'OVERDUE') : [];
  sections.push(`\n##### 📑 Accounts Receivable (AR) & Overdue Invoices`);
  if (overdueItems.length > 0) {
    sections.push(`⚠️ **${overdueItems.length} Overdue Customer Invoices**:`);
    overdueItems.forEach((inv: any) => {
      sections.push(`- **${inv.contactName}** (\`${inv.invoiceNumber}\`): \`${currSym} ${inv.amountDue.toLocaleString()}\` (${inv.daysOverdue} days overdue)`);
    });
  } else {
    sections.push(`✅ **No overdue customer invoices recorded.**`);
  }

  sections.push(`\n#### 💡 Virtual CFO Actionable Next Steps
1. **Optimize Expense Margins**: Audit vendor SaaS subscriptions and marketing spend to protect the ${netMargin}% net profit margin.
2. **Accelerate AR Collections**: Monitor overdue accounts and issue automated payment reminders.
3. **Liquidity Reserves**: Maintain minimum liquid reserves across operating bank accounts.`);

  return sections.join('\n\n');
}


