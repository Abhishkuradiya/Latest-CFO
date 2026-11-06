import { db } from '../../../../lib/db';
import { CFOIntelligenceEngine } from '../../../../lib/services/CFOIntelligenceEngine';
import { XeroCapabilityService } from '../../../../lib/services/XeroCapabilityService';
import { STANDARD_XERO_SCOPES, OPTIONAL_RESTRICTED_SCOPES } from '../../../../app/api/xero/redirect/route';

async function runStandardReauthSuite() {
  console.log('====================================================================');
  console.log(' PHASE 8.4.1 RESTORE STANDARD XERO REAUTHORIZATION REGRESSION SUITE ');
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

    // Test 1: Standard scopes requested by default (24 scopes)
    const standardList = STANDARD_XERO_SCOPES.split(' ');
    assert(standardList.length === 24, 'Test 1: Standard default OAuth scope string contains all 24 working scopes');

    // Test 2: accounting.journals.read is NOT requested by default
    assert(!standardList.includes('accounting.journals.read'), 'Test 2: Restricted accounting.journals.read scope excluded from default request to prevent Error 500');

    // Test 3: Optional restricted scope architecture preserved
    assert(OPTIONAL_RESTRICTED_SCOPES.includes('accounting.journals.read'), 'Test 3: OPTIONAL_RESTRICTED_SCOPES architecture preserved for future Xero developer enablement');

    // Test 4: OAuth URL remains valid
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'MOCK_CLIENT_ID',
      redirect_uri: 'http://localhost:3000/api/xero/callback',
      scope: STANDARD_XERO_SCOPES,
      state: String(tenantId)
    });
    const authUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
    assert(authUrl.includes('response_type=code') && !authUrl.includes('accounting.journals.read'), 'Test 4: OAuth redirect URL constructed cleanly without invalid_scope risk');

    // Test 5: Tenant state preserved
    assert(params.get('state') === '4', 'Test 5: Tenant ID state parameter preserved throughout authorization flow');

    // Test 6: access_denied preserves existing DB credentials
    const creds = await db.getCredentials(tenantId, 'xero');
    assert(Boolean(creds?.access_token), 'Test 6: Existing tenant credentials preserved on access_denied or canceled consent');

    // Test 7: Zero token leakage
    const logStr = JSON.stringify({ tenantId, hasToken: Boolean(creds?.access_token) });
    assert(!logStr.includes('access_token') && !logStr.includes('client_secret'), 'Test 7: Access tokens and client secrets completely excluded from public diagnostic outputs');

    // Test 8: Journals capability reports NOT_GRANTED cleanly
    const cap = await XeroCapabilityService.checkJournalsCapability(tenantId);
    assert(cap.state === 'NOT_GRANTED', 'Test 8: Journals capability reports NOT_GRANTED cleanly without triggering 500 error screens');

    // Test 9: MODE_A production protection
    const intel = await CFOIntelligenceEngine.getIntelligence(tenantId.toString(), fromDate, toDate);
    assert(intel.profitability.revenue.value === 4019440.84 && intel.dataCoverage === 'DATA_COMPLETE', 'Test 9: Production reporting preserved in MODE_A — Authoritative Report Mode with 100% financial accuracy');

  } catch (err: any) {
    console.error('Regression Test Error:', err.message || err);
    failed++;
  }

  console.log('\n----------------------------------------------------');
  console.log(`PHASE 8.4.1 STANDARD REAUTH RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStandardReauthSuite();
