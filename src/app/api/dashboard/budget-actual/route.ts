import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroBudgetService } from '@/lib/budgetService';
import { getXeroAccessToken } from '@/lib/xero';
import { fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromDateParam = searchParams.get('from_date');
  const toDateParam = searchParams.get('to_date');
  const forceSync = searchParams.get('force_sync') === 'true';

  let startDate: Date;
  let endDate: Date;

  if (fromDateParam && toDateParam) {
    startDate = new Date(fromDateParam);
    endDate = new Date(toDateParam);
  } else {
    endDate = new Date();
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const summary = await XeroBudgetService.getBudgetVsActual(tenantId, startDate, endDate, forceSync);
    const org = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          'Organisation',
          async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null,
        ) as { BaseCurrency?: string } | null
      : null;
    const currency = org?.BaseCurrency ?? null;
    return NextResponse.json({ ...summary, connected: true, xero_connected: Boolean(tokenInfo), meta: { currency } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch budget vs actual data' }, { status: 500 });
  }
}
