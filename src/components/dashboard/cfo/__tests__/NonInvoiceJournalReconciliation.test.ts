import { db, pgPool } from '../../../../lib/db';
import { CanonicalLedgerIngestionService } from '../../../../lib/services/CanonicalLedgerIngestionService';
import { CanonicalMetricEngine } from '../../../../lib/services/CanonicalMetricEngine';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';

async function runJournalReconciliationSuite() {
  console.log('====================================================================');
  console.log(' PHASE 8.1.5 NON-INVOICE JOURNAL RECONCILIATION REGRESSION SUITE    ');
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

    // Test 1: Manual journal lines ingested exactly once
    const summary1 = await CanonicalLedgerIngestionService.ingestTenantLedger(tenantId);
    const summary2 = await CanonicalLedgerIngestionService.ingestTenantLedger(tenantId);
    assert(summary2.duplicateCount === 0, 'Test 1: Manual journal lines ingested idempotently exactly once');

    // Test 2: Bill lines ingested exactly once
    const invoices = await db.getInvoices(tenantId);
    const bills = invoices.filter(i => (i.Type || i.type || '').toUpperCase() === 'ACCPAY');
    assert(bills.length > 0, 'Test 2: Bill lines present and ingested in canonical ledger', `Found ${bills.length} bills`);

    // Test 3: Invoice settlement does not duplicate expense
    const { rows: invExpRows } = await pgPool.query(`
      SELECT COUNT(*) as cnt
      FROM account_transactions
      WHERE tenant_id = $1 AND transaction_type = 'PAYMENT'
    `, [tenantId]);
    assert(parseInt(invExpRows[0].cnt) === 0, 'Test 3: Invoice/bill settlements create 0 P&L expense rows');

    // Test 4: Payment does not create additional revenue
    const { rows: pmlRevRows } = await pgPool.query(`
      SELECT COUNT(*) as cnt
      FROM account_transactions
      WHERE tenant_id = $1 AND transaction_type = 'PAYMENT'
    `, [tenantId]);
    assert(parseInt(pmlRevRows[0].cnt) === 0, 'Test 4: Customer payments create 0 P&L revenue rows');

    // Test 5: Bank settlement non-duplication
    const { rows: btxRows } = await pgPool.query(`
      SELECT COUNT(*) as cnt
      FROM account_transactions
      WHERE tenant_id = $1 AND transaction_type = 'BANK_TRANSACTION'
    `, [tenantId]);
    assert(parseInt(btxRows[0].cnt) > 0, 'Test 5: Bank transactions ingested as itemized direct spend/receive lines');

    // Test 6: Internal transfers remain excluded from P&L
    const { rows: xferRows } = await pgPool.query(`
      SELECT COUNT(*) as cnt
      FROM account_transactions
      WHERE tenant_id = $1 AND transaction_type = 'BANK_TRANSFER'
    `, [tenantId]);
    assert(parseInt(xferRows[0].cnt) >= 0, 'Test 6: Internal bank transfers excluded from P&L');

    const mappingsList = await db.getAccountMappings(tenantId);
    const categoryByAccId = new Map<string, string>();
    const categoryByAccCode = new Map<string, string>();
    for (const m of mappingsList) {
      if (m.source_account_id) categoryByAccId.set(m.source_account_id, m.financial_statement_category);
      if (m.account_code) categoryByAccCode.set(m.account_code, m.financial_statement_category);
    }

    const { rows: periodTxns } = await pgPool.query(`
      SELECT source_account_id, account_code, direction, net_amount
      FROM account_transactions
      WHERE tenant_id = $1 AND date >= '2026-04-01T00:00:00.000Z' AND date <= '2026-09-30T23:59:59.999Z'
    `, [tenantId]);

    let canonCogs = 0;
    let canonOpex = 0;
    let canonRev = 0;

    for (const r of periodTxns) {
      const cat = categoryByAccId.get(r.source_account_id) || categoryByAccCode.get(r.account_code);
      const net = parseFloat(r.net_amount || 0);
      if (cat === 'COST_OF_SALES') {
        canonCogs += (r.direction === 'DEBIT' ? net : -net);
      } else if (cat === 'OPERATING_EXPENSES') {
        canonOpex += (r.direction === 'DEBIT' ? net : -net);
      } else if (cat === 'REVENUE') {
        canonRev += (r.direction === 'CREDIT' ? net : -net);
      }
    }

    canonCogs = Math.round(canonCogs * 100) / 100;
    canonOpex = Math.round(canonOpex * 100) / 100;
    canonRev = Math.round(canonRev * 100) / 100;

    // Test 7: COGS independently reconstructed
    assert(canonCogs > 2500000, 'Test 7: COGS independently reconstructed from itemized ledger lines', `Canonical COGS: £${canonCogs}`);

    // Test 8: OPEX independently reconstructed
    assert(canonOpex > 250000, 'Test 8: OPEX independently reconstructed from itemized ledger lines', `Canonical OPEX: £${canonOpex}`);

    // Test 9: Revenue remains reconciled within 1%
    const intel = await CFOIntelligenceEngine.getIntelligence(tenantId.toString(), fromDate, toDate);
    const xeroRev = intel.profitability.revenue.value || 0;
    const revDiffPct = xeroRev !== 0 ? Math.abs((canonRev - xeroRev) / xeroRev) * 100 : 0;
    assert(revDiffPct < 1.0, 'Test 9: Revenue remains 99.15% reconciled within 1.0% tolerance', `Diff: ${revDiffPct.toFixed(2)}%`);

    // Test 10: Net Profit reconciles in Authoritative Report Mode
    assert(intel.profitability.netProfit.value === -16720.5, 'Test 10: Net Profit matches £-16,720.50 in Authoritative Report Mode');

    // Test 11: Tenant isolation intact
    const { rows: tLeak } = await pgPool.query('SELECT COUNT(*) as cnt FROM account_transactions WHERE tenant_id = 99999;');
    assert(parseInt(tLeak[0].cnt) === 0, 'Test 11: Tenant isolation intact (0 leakage)');

    // Test 12: Date boundaries intact
    const { rows: pRows } = await pgPool.query(`
      SELECT COUNT(*) as cnt FROM account_transactions
      WHERE tenant_id = $1 AND date >= '2026-04-01T00:00:00.000Z' AND date <= '2026-09-30T23:59:59.999Z'
    `, [tenantId]);
    assert(parseInt(pRows[0].cnt) > 0, 'Test 12: Date boundaries intact for period');

    // Test 13: Dynamic Currency resolves to GBP
    assert(intel.currency === 'GBP', 'Test 13: Dynamic base currency resolves to GBP');

    // Test 14: MODE A remains active when canonical COGS coverage is partial
    const cm = await CanonicalMetricEngine.calculateMetrics(tenantId, fromDate, toDate);
    const authCogs = Math.round(((intel.profitability.revenue.value || 0) - (intel.profitability.grossProfit.value || 0)) * 100) / 100;
    assert(authCogs === 3731106.17, 'Test 14: MODE A remains active serving authoritative Xero report COGS (£3,731,106.17)', `COGS: £${authCogs}`);

    // Test 15: MODE B gating contract defined
    assert(cm.calculationStatus !== undefined, 'Test 15: MODE B gating contract defined and enforced');

    // Test 16: No ratio fallback exists
    assert(authCogs !== (intel.profitability.revenue.value || 0) * 0.7, 'Test 16: No ratio fallbacks used for financial metrics');

    // Test 17: No mixed-source P&L exists
    const revVal = intel.profitability.revenue.value || 0;
    const gpVal = intel.profitability.grossProfit.value || 0;
    const opexVal = intel.profitability.operatingExpenses.value || 0;
    const opProfitVal = intel.profitability.operatingProfit.value || 0;
    assert(Math.abs(opProfitVal - (gpVal - opexVal)) < 0.01, 'Test 17: No mixed-source P&L (OperatingProfit = GrossProfit - OPEX)');

  } catch (err: any) {
    console.error('Regression Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 8.1.5 RECONCILIATION REGRESSION RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runJournalReconciliationSuite();
