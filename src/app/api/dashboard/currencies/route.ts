import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({
        baseCurrency: "N/A",
        baseCurrencyDescription: "No base currency configured",
        allCurrencies: [],
        otherCurrencies: [],
        totalCurrencies: 0,
        multiCurrencyEnabled: false,
        exchangeRateUpdated: "Never"
      });
    }
    let baseCurrency = 'INR';
    let rawCurrencies: { code: string; description: string }[] = [];

    // 1. Fetch Organisation details (for BaseCurrency)
    const org = await db.getReport(tenantId, 'Organisation');
    if (org && org.BaseCurrency) {
      baseCurrency = org.BaseCurrency;
    }

    // 2. Fetch Currencies from Xero (with descriptions)
    if (tokenInfo) {
      try {
        const fetched = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Currencies');
        if (fetched && Array.isArray(fetched)) {
          rawCurrencies = fetched.map((c: any) => ({
            code: c.Code,
            description: c.Description || ''
          }));
          await db.saveReport(tenantId, 'Currencies', rawCurrencies);
        }
      } catch (err: any) {
        console.error('Failed to fetch Currencies live:', err.message);
      }
    }

    // 3. Fallback to cache
    if (rawCurrencies.length === 0) {
      const cached = await db.getReport(tenantId, 'Currencies');
      if (cached && Array.isArray(cached)) {
        // Handle both old format (string[]) and new format ({code, description}[])
        rawCurrencies = cached.map((c: any) =>
          typeof c === 'string'
            ? { code: c, description: '' }
            : { code: c.code || c.Code, description: c.description || c.Description || '' }
        );
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const allCurrencies: { code: string; description: string }[] = [];
    for (const cur of rawCurrencies) {
      if (!seen.has(cur.code)) {
        seen.add(cur.code);
        allCurrencies.push(cur);
      }
    }

    // Find base currency description
    const baseCurrencyObj = allCurrencies.find(c => c.code === baseCurrency);
    const baseCurrencyDescription = baseCurrencyObj?.description || '';

    // Non-base currencies
    const otherCurrencies = allCurrencies.filter(c => c.code !== baseCurrency);
    const multiCurrencyEnabled = otherCurrencies.length > 0;
    const totalCurrencies = allCurrencies.length;

    // Updated timestamp
    const credentials = await db.getCredentials(tenantId, 'xero');
    const lastSync = credentials?.last_synced_at || new Date().toISOString();
    const updatedDate = new Date(lastSync);
    const timeStr = updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return NextResponse.json({
      baseCurrency,
      baseCurrencyDescription,
      allCurrencies: allCurrencies.map(c => c.code),
      otherCurrencies: otherCurrencies.map(c => c.code),
      totalCurrencies,
      multiCurrencyEnabled,
      exchangeRateUpdated: `Updated: ${timeStr}`
    });

  } catch (err: any) {
    console.error('Currencies KPI error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
