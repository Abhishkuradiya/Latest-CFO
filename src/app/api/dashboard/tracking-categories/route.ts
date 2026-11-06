import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch TrackingCategories from PostgreSQL
    const trackingReport = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          'TrackingCategories',
          () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'TrackingCategories'),
        )
      : await db.getPostgresReport(tenantId, 'TrackingCategories');

    const rawData = trackingReport?.raw_data || trackingReport || [];
    const categoriesList = Array.isArray(rawData) ? rawData : (rawData.TrackingCategories || []);

    let configuredCategories = categoriesList.length;
    let activeCategories = categoriesList.filter((c: any) => (c.Status || '').toUpperCase() === 'ACTIVE').length;
    let inactiveCategories = configuredCategories - activeCategories;
    let totalOptionsCount = 0;

    const formattedCategories = categoriesList.map((cat: any) => {
      const options = Array.isArray(cat.Options) ? cat.Options : [];
      totalOptionsCount += options.length;

      const formattedOptions = options.map((opt: any, idx: number) => {
        const st = (opt.Status || (opt.IsActive ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
        return {
          id: opt.TrackingOptionID || `opt-${idx}`,
          name: opt.Name || 'Unnamed Option',
        description: null,
          status: st,
          usedInCount: null,
          lastTransaction: null
        };
      });

      return {
        id: cat.TrackingCategoryID || 'cat-1',
        name: cat.Name || 'Trading Name',
        status: (cat.Status || 'ACTIVE').toUpperCase(),
        optionsCount: options.length,
        createdOn: null,
        options: formattedOptions
      };
    });

    return NextResponse.json({
      enabled: formattedCategories.length > 0,
      totalCategories: configuredCategories,
      totalOptions: totalOptionsCount,
      summary: {
        configuredCategories,
        trackingOptions: totalOptionsCount,
        activeCategories,
        inactiveCategories
      },
      categories: formattedCategories.map((cat: any) => ({
        ...cat,
        optionNames: cat.options.map((opt: any) => opt.name)
      }))
    });
  } catch (err: any) {
    console.error('Tracking Categories API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
