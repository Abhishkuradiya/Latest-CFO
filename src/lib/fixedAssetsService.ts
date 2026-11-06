import { db } from './db';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from './xero';

export interface FixedAssetsSummary {
  total_assets: number;
  accumulated_depreciation: number;
  net_book_value: number;
  asset_count: number;
  last_synced: string;
}

export const XeroFixedAssetsService = {
  /**
   * Helper to fetch fixed assets from the Xero Fixed Assets API (which uses a different base URL).
   */
  fetchXeroAssets: async (accessToken: string, xeroTenantId: string, status: 'DRAFT' | 'REGISTERED' | 'DISPOSED', page = 1, pageSize = 200, retriesLeft = 3): Promise<any[]> => {
    const url = `https://api.xero.com/assets.xro/1.0/Assets?status=${status}&page=${page}&pageSize=${pageSize}`;
    
    // Throttle to naturally pace concurrent requests
    await new Promise(resolve => setTimeout(resolve, 150));

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Xero-Tenant-Id': xeroTenantId,
        'Accept': 'application/json'
      }
    });

    if (res.status === 429) {
      throw new Error(`Xero Assets API Rate Limit (429) Exceeded`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Xero Assets API error (Status ${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.items || (Array.isArray(data) ? data : []);
  },

  /**
   * Fallback method to parse Fixed Assets from Xero Chart of Accounts & Balance Sheet report when Xero Asset Manager API is 403 (disabled) or empty.
   */
  /**
   * Fetches Fixed Assets from Xero Chart of Accounts & Balance Sheet report.
   * Matches active FIXED accounts (e.g. Machinery, Intangibles) and DEPRECIATN accounts.
   */
  fetchFallbackFixedAssetsFromBalanceSheet: async (accessToken: string, xeroTenantId: string): Promise<any[]> => {
    try {
      // 1. Fetch Chart of Accounts to identify active FIXED & DEPRECIATN accounts
      const activeFixedMap = new Map<string, any>();
      const activeDeprecMap = new Map<string, any>();

      try {
        const rawAccounts = await fetchXeroResource(accessToken, xeroTenantId, 'Accounts');
        if (Array.isArray(rawAccounts)) {
          for (const acc of rawAccounts) {
            const status = (acc.Status || acc.status || '').toUpperCase();
            const type = (acc.Type || acc.type || '').toUpperCase();
            const name = (acc.Name || acc.name || '').toLowerCase().trim();

            if (status === 'ACTIVE') {
              if (type === 'FIXED' || (acc.Class === 'ASSET' && type === 'FIXED')) {
                if (name) activeFixedMap.set(name, acc);
              } else if (type === 'DEPRECIATN' || name.includes('depreciation') || name.includes('accumulated')) {
                if (name) activeDeprecMap.set(name, acc);
              }
            }
          }
        }
      } catch (accErr) {
        console.warn('Could not fetch Xero Accounts metadata for Chart of Accounts matching:', accErr);
      }

      // 2. Fetch Balance Sheet report for live account balances
      const report = await fetchXeroReport(accessToken, xeroTenantId, 'BalanceSheet');
      if (!report || !report.Rows || !Array.isArray(report.Rows)) return [];

      const mappedAssets: any[] = [];
      let totalDeprec = 0;

      const parseRows = (rows: any[], currentSectionTitle: string = '') => {
        for (const row of rows) {
          if (!row) continue;
          
          let secTitle = currentSectionTitle;
          if (row.RowType === 'Section' && row.Title) {
            secTitle = row.Title.toLowerCase().trim();
          }

          const isFixedSection = 
            secTitle === 'fixed assets' || 
            secTitle.includes('fixed asset') || 
            secTitle.includes('property, plant') || 
            secTitle.includes('tangible asset');

          if (row.RowType === 'Row' && row.Cells && row.Cells.length >= 2) {
            const label = (row.Cells[0].Value || '').trim();
            const labelLower = label.toLowerCase();
            const valStr = row.Cells[1].Value || '0';
            const val = parseFloat(valStr.replace(/,/g, ''));
            
            if (!isNaN(val) && val !== 0 && !labelLower.startsWith('total')) {
              const matchedFixed = activeFixedMap.get(labelLower);
              const matchedDeprec = activeDeprecMap.get(labelLower);

              const isAccountDeprec = !!matchedDeprec || labelLower.includes('depreciation') || labelLower.includes('accumulated') || labelLower.includes('deprec');
              const isAccountFixed = !!matchedFixed || (isFixedSection && !labelLower.includes('loan') && !labelLower.includes('deposit') && !labelLower.includes('debtor') && !labelLower.includes('receivable') && !isAccountDeprec);

              if (isAccountDeprec) {
                totalDeprec += Math.abs(val);
              } else if (isAccountFixed) {
                if (val > 0) {
                  mappedAssets.push({
                    external_id: matchedFixed?.AccountID || `bs-fa-${labelLower.replace(/\s+/g, '-')}`,
                    name: label,
                    asset_number: matchedFixed?.Code || 'GL-FA',
                    status: 'REGISTERED',
                    purchase_date: null,
                    purchase_price: val,
                    accumulated_depreciation: 0,
                    book_value: val,
                    raw_data: { source: 'Xero Chart of Accounts & Balance Sheet', code: matchedFixed?.Code }
                  });
                }
              }
            }
          }

          if (row.Rows && Array.isArray(row.Rows)) {
            parseRows(row.Rows, secTitle);
          }
        }
      };

      parseRows(report.Rows);

      if (mappedAssets.length > 0 && totalDeprec > 0) {
        // Distribute accumulated depreciation proportionally or attach to first asset
        mappedAssets[0].accumulated_depreciation = totalDeprec;
        mappedAssets[0].book_value = Math.max(0, mappedAssets[0].purchase_price - totalDeprec);
      }

      return mappedAssets;
    } catch (err) {
      console.error('Failed to parse fixed assets from Xero Chart of Accounts & Balance Sheet:', err);
    }
    return [];
  },

  /**
   * Synchronizes fixed assets from Xero and saves them to local database.
   * Uses Chart of Accounts & Balance Sheet GL balances as primary source.
   * Fallback to Xero Asset Manager API (assets.xro) if Balance Sheet returns 0 assets.
   */
  syncFixedAssets: async (tenantId: number): Promise<void> => {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      throw new Error('Xero integration not connected');
    }

    const { accessToken, xeroTenantId } = tokenInfo;
    const allMappedAssets: any[] = [];

    // 1. Primary: Fetch from Chart of Accounts & Balance Sheet report
    try {
      const bsAssets = await XeroFixedAssetsService.fetchFallbackFixedAssetsFromBalanceSheet(accessToken, xeroTenantId);
      if (bsAssets.length > 0) {
        allMappedAssets.push(...bsAssets);
      }
    } catch (bsErr) {
      console.warn('Failed to fetch fixed assets from Balance Sheet, trying Xero Asset Manager API...', bsErr);
    }

    // 2. Secondary: If Balance Sheet returns 0 assets, try Xero Asset Manager API
    if (allMappedAssets.length === 0) {
      const activeStatuses: ('DRAFT' | 'REGISTERED')[] = ['DRAFT', 'REGISTERED'];
      const pageSize = 200;

      try {
        for (const status of activeStatuses) {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const assets = await XeroFixedAssetsService.fetchXeroAssets(accessToken, xeroTenantId, status, page, pageSize);
            
            for (const asset of assets) {
              const purchasePrice = asset.purchasePrice !== undefined && asset.purchasePrice !== null ? parseFloat(asset.purchasePrice) : 0;
              const accumDeprec = asset.bookDepreciationDetail?.currentAccumDepreciationAmount !== undefined && asset.bookDepreciationDetail?.currentAccumDepreciationAmount !== null
                ? parseFloat(asset.bookDepreciationDetail.currentAccumDepreciationAmount)
                : 0;
              const bookValue = asset.accountingBookValue !== undefined && asset.accountingBookValue !== null
                ? parseFloat(asset.accountingBookValue)
                : (purchasePrice - accumDeprec);

              allMappedAssets.push({
                external_id: asset.assetId,
                name: asset.assetName || 'Unnamed Asset',
                asset_number: asset.assetNumber || null,
                status: (asset.assetStatus || 'REGISTERED').toUpperCase(),
                purchase_date: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString() : null,
                purchase_price: purchasePrice,
                accumulated_depreciation: accumDeprec,
                book_value: bookValue,
                raw_data: asset
              });
            }

            if (assets.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          }
        }
      } catch (err: any) {
        console.warn(`Xero Fixed Assets API (assets.xro) error: ${err?.message || err}`);
      }
    }

    // Save mapping directly to db
    await db.saveFixedAssets(tenantId, allMappedAssets);

    // Clear stale cached summary so next getDashboard fetch recalculates fresh totals
    await db.saveFixedAssetsCache(tenantId, 'FixedAssetsDashboardSummary', null, 0);
  },

  /**
   * Computes and returns the Fixed Assets Dashboard summary.
   * Leverages 10 minutes cache (600 seconds).
   */
  getDashboard: async (tenantId: number, forceSync = false): Promise<FixedAssetsSummary> => {
    const cacheKey = 'FixedAssetsDashboardSummary';
    
    if (!forceSync) {
      const cached = await db.getFixedAssetsCache(tenantId, cacheKey);
      if (cached && (cached.total_assets > 0 || cached.net_book_value > 0)) {
        return cached;
      }
    }

    // If cache missed, forceSync is true, or cache was 0, trigger sync
    try {
      await XeroFixedAssetsService.syncFixedAssets(tenantId);
    } catch (e) {
      console.error('Initial/force sync failed for fixed assets:', e);
    }

    // Fetch from database
    const assets = await db.getFixedAssets(tenantId);

    // Filter to double check we ignore archived, disposed or deleted assets
    // Since only DRAFT and REGISTERED were synced, this matches.
    const activeAssets = assets.filter(
      a => (a.status || '').toUpperCase() === 'DRAFT' || (a.status || '').toUpperCase() === 'REGISTERED'
    );

    let totalAssetsSum = 0;
    let accumDeprecSum = 0;
    let netBookValueSum = 0;

    for (const a of activeAssets) {
      const pPrice = a.purchase_price || 0;
      const aDeprec = a.accumulated_depreciation || 0;
      const bVal = a.book_value > 0 ? a.book_value : Math.max(0, pPrice - aDeprec);

      totalAssetsSum += pPrice;
      accumDeprecSum += aDeprec;
      netBookValueSum += bVal;
    }

    if (netBookValueSum === 0 && totalAssetsSum > 0) {
      netBookValueSum = Math.max(0, totalAssetsSum - accumDeprecSum);
    }

    const credentials = await db.getCredentials(tenantId, 'xero');
    const lastSynced = credentials?.last_synced_at
      ? new Date(credentials.last_synced_at).toISOString().replace('T', ' ').substring(0, 16)
      : new Date().toISOString().replace('T', ' ').substring(0, 16);

    const summary: FixedAssetsSummary = {
      total_assets: parseFloat(totalAssetsSum.toFixed(2)),
      accumulated_depreciation: parseFloat(accumDeprecSum.toFixed(2)),
      net_book_value: parseFloat(netBookValueSum.toFixed(2)),
      asset_count: activeAssets.length,
      last_synced: lastSynced
    };

    // Cache summary for 10 minutes (600 seconds)
    await db.saveFixedAssetsCache(tenantId, cacheKey, summary, 600);

    return summary;
  }
};
