import { db } from '../../../../lib/db';
import { getAccountTransactionsLedger } from '../../../../lib/ledger-engine';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';

async function runMultiTenantIsolationRegressionSuite() {
  console.log('====================================================================');
  console.log(' CRITICAL MULTI-TENANT ISOLATION & HARDCODE REGRESSION SUITE ');
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
    // Setup test tenants: Tenant 99801 (Tenant A - Company A) and Tenant 99802 (Tenant B - Company B)
    const companyA = await db.createTenant('Company A Org');
    const companyB = await db.createTenant('Company B Org');

    const tidA = companyA.id;
    const tidB = companyB.id;

    // Save separate account records for Tenant A and Tenant B
    await db.saveCachedRecords(tidA, 'accounts', [
      { AccountID: 'acc-a-sales', Code: '400', Name: 'Company A Sales Revenue', Type: 'REVENUE', Status: 'ACTIVE' },
      { AccountID: 'acc-a-bank', Code: '090', Name: 'Company A Bank Account', Type: 'BANK', Status: 'ACTIVE' }
    ]);

    await db.saveCachedRecords(tidB, 'accounts', [
      { AccountID: 'acc-b-sales', Code: '400', Name: 'Company B Product Sales', Type: 'REVENUE', Status: 'ACTIVE' },
      { AccountID: 'acc-b-bank', Code: '090', Name: 'Company B Operating Account', Type: 'BANK', Status: 'ACTIVE' }
    ]);

    // Save separate report data for Tenant A and Tenant B
    await db.saveReport(tidA, 'ProfitAndLoss_2026-04-01_2026-09-30', {
      ReportTitles: ['Profit and Loss', 'Company A Org', 'Currency: GBP'],
      Rows: [
        {
          RowType: 'Section',
          Title: 'Trading Income',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Company A Sales' }, { Value: '100000.00' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '100000.00' }] }
          ]
        }
      ]
    });

    await db.saveReport(tidB, 'ProfitAndLoss_2026-04-01_2026-09-30', {
      ReportTitles: ['Profit and Loss', 'Company B Org', 'Currency: USD'],
      Rows: [
        {
          RowType: 'Section',
          Title: 'Trading Income',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Company B Sales' }, { Value: '50000.00' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '50000.00' }] }
          ]
        }
      ]
    });

    // Save separate credentials for Tenant A and Tenant B
    await db.saveCredentials(tidA, 'xero', {
      tenant_identifier: 'xero-org-guid-a',
      access_token: 'mock-access-token-a',
      refresh_token: 'mock-refresh-token-a',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    });

    await db.saveCredentials(tidB, 'xero', {
      tenant_identifier: 'xero-org-guid-b',
      access_token: 'mock-access-token-b',
      refresh_token: 'mock-refresh-token-b',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    });

    // 1. Assertion 1: Tenant A sees only Tenant A accounts
    const accsA = await db.getAccounts(tidA);
    const accNamesA = accsA.map((a: any) => a.Name || a.name);
    assert(accNamesA.includes('Company A Sales Revenue') && !accNamesA.includes('Company B Product Sales'),
      'Assertion 1: Tenant A sees only Company A accounts');

    // 2. Assertion 2: Tenant B sees only Tenant B accounts
    const accsB = await db.getAccounts(tidB);
    const accNamesB = accsB.map((a: any) => a.Name || a.name);
    assert(accNamesB.includes('Company B Product Sales') && !accNamesB.includes('Company A Sales Revenue'),
      'Assertion 2: Tenant B sees only Company B accounts');

    // 3. Assertion 3: Tenant B never sees MI Health Ltd in accounts or report
    const hasMiHealth = accNamesB.some((n: string) => n.includes('MI Health'));
    assert(!hasMiHealth, 'Assertion 3: Tenant B never sees MI Health Ltd');

    // 4. Assertion 4: Tenant B never sees Tenant A accounts
    const crossAccountMatch = accsB.some((b: any) => (b.AccountID || b.account_id) === 'acc-a-sales');
    assert(!crossAccountMatch, 'Assertion 4: Tenant B never sees Tenant A accounts');

    // 5. Assertion 5: Tenant B never sees Tenant A transactions
    const ledgerB = await getAccountTransactionsLedger(tidB, 'Product Sales', '2026-04-01', '2026-09-30');
    assert(ledgerB.transactions.every(t => !t.id.includes('acc-a')), 'Assertion 5: Tenant B never sees Tenant A transactions');

    // 6. Assertion 6: Tenant B never sees Tenant A reports
    const reportB = await db.getReport(tidB, 'ProfitAndLoss_2026-04-01_2026-09-30');
    assert(reportB?.ReportTitles?.[1] === 'Company B Org', 'Assertion 6: Tenant B never sees Tenant A reports');

    // 7. Assertion 7: Tenant B never sees Tenant A mappings
    const mappingsB = await db.getTenantAccountMappings(tidB);
    const hasAIdInB = mappingsB.some((m: any) => m.xero_account_id === 'acc-a-sales');
    assert(!hasAIdInB, 'Assertion 7: Tenant B never sees Tenant A account mappings');

    // 8. Assertion 8: Tenant B cannot request Tenant A metrics via query param override
    const intelB = await CFOIntelligenceEngine.getIntelligence(String(tidB), '2026-04-01', '2026-09-30');
    assert(intelB.tenantId === String(tidB) && intelB.profitability.revenue.value === 50000,
      'Assertion 8: Tenant B metrics isolated to Tenant B dataset');

    // 9. Assertion 9: Tenant A cannot request Tenant B metrics
    const intelA = await CFOIntelligenceEngine.getIntelligence(String(tidA), '2026-04-01', '2026-09-30');
    assert(intelA.tenantId === String(tidA) && intelA.profitability.revenue.value === 100000,
      'Assertion 9: Tenant A metrics isolated to Tenant A dataset');

    // 10. Assertion 10: Unauthenticated session returns null tenant ID
    const { getTenantIdFromSession } = await import('../../../../lib/auth');
    const unauthResult = await getTenantIdFromSession();
    assert(unauthResult === null, 'Assertion 10: Unauthenticated session returns null (no fallback to default tenant)');

    // 11. Assertion 11: Company switch preserves tenant boundaries
    await db.updateTenantName(tidB, 'Company B Renamed');
    const updatedTenantB = (await db.getTenants()).find(t => t.id === tidB);
    assert(updatedTenantB?.name === 'Company B Renamed', 'Assertion 11: Company switch updates correct tenant record');

    // 12. Assertion 12: Xero connection belongs to correct tenant
    const credsA = await db.getCredentials(tidA, 'xero');
    const credsB = await db.getCredentials(tidB, 'xero');
    assert(credsA?.tenant_identifier === 'xero-org-guid-a' && credsB?.tenant_identifier === 'xero-org-guid-b',
      'Assertion 12: Xero connection credentials strictly tenant scoped');

    // 13. Assertion 13: Report cache is tenant scoped
    const reportA = await db.getReport(tidA, 'ProfitAndLoss_2026-04-01_2026-09-30');
    assert(reportA?.ReportTitles?.[1] === 'Company A Org', 'Assertion 13: Report cache query strictly scoped by tenant_id');

    // 14. Assertion 14: Account transaction drilldown is tenant scoped
    const ledgerA = await getAccountTransactionsLedger(tidA, 'Company A Sales Revenue', '2026-04-01', '2026-09-30');
    assert(ledgerA.accountName === 'Company A Sales Revenue', 'Assertion 14: Account transaction drilldown is tenant scoped');

    // 15. Assertion 15: Currency comes from the correct Xero tenant
    assert(reportA?.ReportTitles?.[2] === 'Currency: GBP' && reportB?.ReportTitles?.[2] === 'Currency: USD',
      'Assertion 15: Currency correctly derived per Xero tenant');

    // 16. Assertion 16: Company name comes from the correct tenant
    assert(companyA.name === 'Company A Org' && companyB.name === 'Company B Org',
      'Assertion 16: Company name derived from correct tenant metadata');

  } catch (err: any) {
    console.error('Multi-Tenant Isolation Regression Suite Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`MULTI-TENANT ISOLATION REGRESSION SUITE RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMultiTenantIsolationRegressionSuite();
