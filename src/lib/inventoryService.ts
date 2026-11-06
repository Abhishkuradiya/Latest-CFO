import { db } from './db';

export interface InventorySummary {
  inventory_value: number;
  inventory_items: number;
  low_stock_items: number;
  dead_stock_items: number;
  last_synced: string;
  mode?: 'TRACKED' | 'COA_PERIODIC';
  opening_stock?: number;
  closing_stock?: number;
  net_stock_change?: number;
}

export interface LowStockItem {
  itemId: string;
  name: string;
  code: string;
  currentQty: number;
  minimumQty: number;
}

export interface DeadStockItem {
  itemId: string;
  name: string;
  code: string;
  quantity: number;
  lastSold: string;
  daysUnsold: number;
}

export const XeroInventoryService = {
  /**
   * Fetches Opening Stock and Closing Stock values from Xero P&L Report
   */
  fetchStockFromPL: async (accessToken: string, xeroTenantId: string, fromDate?: string, toDate?: string): Promise<{ openingStock: number; closingStock: number; netStockChange: number }> => {
    try {
      let reportEndpoint = 'ProfitAndLoss';
      if (fromDate && toDate) {
        reportEndpoint = `ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`;
      }

      const { fetchXeroReport } = await import('./xero');
      const report = await fetchXeroReport(accessToken, xeroTenantId, reportEndpoint);

      let openingStock = 0;
      let closingStock = 0;

      if (report && report.Rows && Array.isArray(report.Rows)) {
        const parseRows = (rows: any[]) => {
          for (const row of rows) {
            if (!row) continue;
            if (row.Cells && row.Cells.length >= 2) {
              const label = (row.Cells[0].Value || '').trim().toLowerCase();
              const valStr = row.Cells[1].Value || '0';
              // Stock values are positive asset figures
              const val = Math.abs(parseFloat(valStr.replace(/,/g, '')) || 0);

              if (label.includes('opening stock') || label.includes('opening inventory') || label.includes('start stock')) {
                openingStock = val;
              } else if (label.includes('closing stock') || label.includes('closing inventory') || label.includes('end stock')) {
                closingStock = val;
              }
            }
            if (row.Rows && Array.isArray(row.Rows)) {
              parseRows(row.Rows);
            }
          }
        };

        parseRows(report.Rows);
      }

      // Net Stock Movement = Closing Stock - Opening Stock
      const netStockChange = closingStock - openingStock;

      return {
        openingStock: parseFloat(openingStock.toFixed(2)),
        closingStock: parseFloat(closingStock.toFixed(2)),
        netStockChange: parseFloat(netStockChange.toFixed(2))
      };
    } catch (err) {
      console.warn('Failed to parse stock from Xero P&L report:', err);
    }
    return { openingStock: 0, closingStock: 0, netStockChange: 0 };
  },

  /**
   * Calculates overall inventory value
   */
  calculateInventoryValue: (items: any[]) => {
    const trackedItems = items.filter(item => item.IsTrackedAsInventory === true);
    let totalValue = 0;
    let totalItems = 0;

    for (const item of trackedItems) {
      if (item.QuantityOnHand === undefined || item.QuantityOnHand === null) continue;
      const qty = parseFloat(item.QuantityOnHand) || 0;
      const unitPrice = parseFloat(item.PurchaseDetails?.UnitPrice) || 0;
      totalValue += qty * unitPrice;
      totalItems++;
    }

    return {
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalItems
    };
  },

  /**
   * Evaluates low stock items against database thresholds
   */
  calculateLowStock: async (tenantId: number, items: any[]): Promise<LowStockItem[]> => {
    const trackedItems = items.filter(item => item.IsTrackedAsInventory === true);
    const thresholds = await db.getThresholds(tenantId);
    const thresholdMap = new Map(thresholds.map(t => [t.item_id, parseFloat(t.minimum_stock)]));

    const lowStockList: LowStockItem[] = [];
    for (const item of trackedItems) {
      if (item.QuantityOnHand === undefined || item.QuantityOnHand === null) continue;
      const currentQty = parseFloat(item.QuantityOnHand) || 0;
      const minStock = thresholdMap.has(item.ItemID) ? thresholdMap.get(item.ItemID)! : 0;

      // If stock is below or equal to the minimum threshold, classify as Low Stock
      if (currentQty <= minStock) {
        lowStockList.push({
          itemId: item.ItemID,
          name: item.Name || 'Unnamed Item',
          code: item.Code,
          currentQty,
          minimumQty: minStock
        });
      }
    }

    return lowStockList;
  },

  /**
   * Identifies dead stock items unsold for more than N days
   */
  calculateDeadStock: async (tenantId: number, items: any[], deadStockDays = 90): Promise<DeadStockItem[]> => {
    const trackedItems = items.filter(item => item.IsTrackedAsInventory === true);
    const sales = await db.getSalesHistory(tenantId);
    const now = new Date();

    // Map item last sold date
    const lastSoldMap = new Map<string, Date>();
    for (const s of sales) {
      if (s.sold_at) {
        const d = new Date(s.sold_at);
        const prev = lastSoldMap.get(s.item_id);
        if (!prev || d > prev) {
          lastSoldMap.set(s.item_id, d);
        }
      }
    }

    const deadStockList: DeadStockItem[] = [];
    for (const item of trackedItems) {
      if (item.QuantityOnHand === undefined || item.QuantityOnHand === null) continue;
      const qty = parseFloat(item.QuantityOnHand) || 0;

      // Rule: QuantityOnHand > 0 AND unsold for N days
      if (qty > 0) {
        const lastSoldDate = lastSoldMap.get(item.ItemID);
        let daysUnsold = 999; // Default if never sold
        let lastSoldStr = 'Never Sold';

        if (lastSoldDate) {
          const diffTime = now.getTime() - lastSoldDate.getTime();
          daysUnsold = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
          lastSoldStr = lastSoldDate.toISOString().split('T')[0];
        }

        if (daysUnsold >= deadStockDays) {
          deadStockList.push({
            itemId: item.ItemID,
            name: item.Name || 'Unnamed Item',
            code: item.Code,
            quantity: qty,
            lastSold: lastSoldStr,
            daysUnsold
          });
        }
      }
    }

    // Sort by longest unsold first
    deadStockList.sort((a, b) => b.daysUnsold - a.daysUnsold);
    return deadStockList;
  },

  /**
   * Aggregates inventory dashboard summary checking cache
   */
  getDashboard: async (tenantId: number, deadStockDays = 90, fromDate?: string, toDate?: string, forceSync = false): Promise<InventorySummary> => {
    const cacheKey = `InventoryDashboard_${deadStockDays}_${fromDate || ''}_${toDate || ''}`;
    
    if (!forceSync) {
      const cached = await db.getInventoryCache(tenantId, cacheKey);
      if (cached && (cached.inventory_value > 0 || cached.opening_stock > 0 || cached.closing_stock > 0)) {
        return cached;
      }
    }

    const items = await db.getInventoryItems(tenantId);
    const { totalValue, totalItems } = XeroInventoryService.calculateInventoryValue(items);
    const lowStock = await XeroInventoryService.calculateLowStock(tenantId, items);
    const deadStock = await XeroInventoryService.calculateDeadStock(tenantId, items, deadStockDays);

    // Also fetch COA / P&L Opening & Closing Stock metrics
    let plStock = { openingStock: 0, closingStock: 0, netStockChange: 0 };
    try {
      const { getXeroAccessToken } = await import('./xero');
      const tokenInfo = await getXeroAccessToken(tenantId);
      if (tokenInfo) {
        plStock = await XeroInventoryService.fetchStockFromPL(tokenInfo.accessToken, tokenInfo.xeroTenantId, fromDate, toDate);
      }
    } catch (plErr) {
      console.warn('Failed to fetch P&L stock metrics:', plErr);
    }

    const credentials = await db.getCredentials(tenantId, 'xero');
    const lastSynced = credentials?.last_synced_at 
      ? new Date(credentials.last_synced_at).toISOString().replace('T', ' ').substring(0, 16)
      : new Date().toISOString().replace('T', ' ').substring(0, 16);

    const isCoaMode = totalValue === 0 && (plStock.openingStock > 0 || plStock.closingStock > 0);

    const summary: InventorySummary = {
      inventory_value: totalValue > 0 ? totalValue : (plStock.closingStock > 0 ? plStock.closingStock : plStock.openingStock),
      inventory_items: totalItems,
      low_stock_items: lowStock.length,
      dead_stock_items: deadStock.length,
      last_synced: lastSynced,
      mode: isCoaMode ? 'COA_PERIODIC' : 'TRACKED',
      opening_stock: plStock.openingStock,
      closing_stock: plStock.closingStock,
      net_stock_change: plStock.netStockChange
    };

    // Cache results for 10 minutes (600 seconds)
    await db.saveInventoryCache(tenantId, cacheKey, summary, 600);

    return summary;
  }
};
