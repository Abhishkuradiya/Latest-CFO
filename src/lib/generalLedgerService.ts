import { db, parseXeroDate } from './db';
import { getXeroAccessToken } from './xero';

type XeroLedgerRecord = Record<string, unknown>;

export interface GeneralLedgerSummary {
  total_transactions: number;
  this_month: number;
  last_entry: string;
}

export const XeroGeneralLedgerService = {
  /**
   * Fetch system journals using the offset-based pagination.
   */
  fetchXeroJournals: async (accessToken: string, xeroTenantId: string, offset = 0): Promise<XeroLedgerRecord[]> => {
    const url = `https://api.xero.com/api.xro/2.0/Journals?offset=${offset}`;
    
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
      throw new Error(`Xero Journals API Rate Limit (429) Exceeded`);
    }

    if (!res.ok) {
      const text = await res.text();
      // Preserve the distinction between an empty ledger and an endpoint the
      // connected Xero app is not permitted to read.
      if (res.status === 403 || res.status === 401) {
        throw new Error(`Xero journal access is unavailable (HTTP ${res.status}). The app may need the Journals endpoint approval and required Xero plan/scope.`);
      }
      throw new Error(`Xero Journals API error (Status ${res.status}): ${text}`);
    }

    const data = await res.json();
    return (data.Journals || []) as XeroLedgerRecord[];
  },

  /**
   * Fetch manual journals using page-based pagination.
   */
  fetchXeroManualJournals: async (accessToken: string, xeroTenantId: string, page = 1): Promise<XeroLedgerRecord[]> => {
    const url = `https://api.xero.com/api.xro/2.0/ManualJournals?page=${page}`;
    
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
      throw new Error(`Xero Manual Journals API Rate Limit (429) Exceeded`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Xero Manual Journals API error (Status ${res.status}): ${text}`);
    }

    const data = await res.json();
    return (data.ManualJournals || []) as XeroLedgerRecord[];
  },

  /** Refresh manual journals independently when the restricted system Journals
   * endpoint is not enabled for this Xero connection. */
  syncManualJournals: async (tenantId: number, strictPostgres = false): Promise<void> => {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) return;

    let existing: XeroLedgerRecord[] = [];
    try {
      const cached = strictPostgres
        ? await db.getPostgresReport(tenantId, 'ManualJournals')
        : await db.getReport(tenantId, 'ManualJournals');
      if (Array.isArray(cached)) existing = cached as XeroLedgerRecord[];
    } catch (error) {
      console.warn('Unable to read cached Xero manual journals before refresh:', error);
    }

    const refreshed: XeroLedgerRecord[] = [];
    let page = 1;
    while (page <= 100) {
      const batch = await XeroGeneralLedgerService.fetchXeroManualJournals(tokenInfo.accessToken, tokenInfo.xeroTenantId, page);
      refreshed.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    const merged = new Map<string, XeroLedgerRecord>();
    for (const journal of [...existing, ...refreshed]) {
      const identity = String(journal.ManualJournalID ?? `${journal.Date ?? ''}|${journal.Narration ?? ''}`);
      merged.set(identity, journal);
    }
    const data = [...merged.values()];
    if (strictPostgres) await db.savePostgresReport(tenantId, 'ManualJournals', data);
    else await db.saveReport(tenantId, 'ManualJournals', data);
  },

  /**
   * Synchronizes general ledger journals and manual journals.
   */
  syncGeneralLedger: async (tenantId: number, strictPostgres = false): Promise<void> => {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) return;

    const { accessToken, xeroTenantId } = tokenInfo;

    // 1. Fetch Manual Journals (all pages)
    const allManual: XeroLedgerRecord[] = [];
    let page = 1;
    let manualHasMore = true;
    let manualSyncError: unknown = null;
    while (manualHasMore) {
      try {
        const batch = await XeroGeneralLedgerService.fetchXeroManualJournals(accessToken, xeroTenantId, page);
        allManual.push(...batch);
        if (batch.length < 100) {
          manualHasMore = false;
        } else {
          page++;
        }
      } catch (e) {
        console.error(`Error syncing manual journals page ${page}:`, e);
        manualSyncError = e;
        manualHasMore = false;
      }
    }
    // Never replace a complete local snapshot with a partial page sequence.
    // If Xero stopped paging because of an error, retain the previous snapshot
    // and let the caller report the failed sync without advancing its checkpoint.
    if (!manualSyncError) {
      if (strictPostgres) await db.savePostgresReport(tenantId, 'ManualJournals', allManual);
      else await db.saveReport(tenantId, 'ManualJournals', allManual);
    }

    // 2. Fetch system journals incrementally. The API's offset is a JournalNumber,
    // so continue from the newest cached number instead of repeatedly reading only
    // the first 1,000 journals (which can leave recent account activity missing).
    let existingSystem: XeroLedgerRecord[] = [];
    try {
      const cached = strictPostgres
        ? await db.getPostgresReport(tenantId, 'Journals')
        : await db.getReport(tenantId, 'Journals');
      if (Array.isArray(cached)) existingSystem = cached as XeroLedgerRecord[];
    } catch (error) {
      console.warn('Unable to read cached Xero journals before refresh:', error);
    }
    const allSystem: XeroLedgerRecord[] = [...existingSystem];
    const knownJournalIds = new Set(existingSystem.map((journal) => String(journal.JournalID ?? journal.JournalNumber ?? '')).filter(Boolean));
    let offset = existingSystem.reduce((max, journal) => Math.max(max, Number(journal.JournalNumber) || 0), 0);
    let systemHasMore = true;
    let calls = 0;
    // Xero notes that a partial page may still be followed by more results, so
    // continue until it returns an empty page or the safety limit is reached.
    let systemSyncError: unknown = null;
    while (systemHasMore && calls < 100) {
      try {
        const batch = await XeroGeneralLedgerService.fetchXeroJournals(accessToken, xeroTenantId, offset);
        if (batch.length === 0) {
          systemHasMore = false;
        } else {
          for (const journal of batch) {
            const id = String(journal.JournalID ?? journal.JournalNumber ?? '');
            if (!id || !knownJournalIds.has(id)) allSystem.push(journal);
            if (id) knownJournalIds.add(id);
          }
          const maxNum = Math.max(...batch.map(j => Number(j.JournalNumber) || 0));
          if (maxNum > offset) {
            offset = maxNum;
          } else {
            systemHasMore = false;
          }
        }
        calls++;
      } catch (e) {
        console.error(`Error syncing system journals offset ${offset}:`, e);
        systemSyncError = e;
        systemHasMore = false;
      }
    }
    if (calls >= 100 && systemHasMore) {
      console.warn(`Xero journal refresh stopped at the safety limit for tenant ${tenantId}.`);
    }
    if (strictPostgres) await db.savePostgresReport(tenantId, 'Journals', allSystem);
    else await db.saveReport(tenantId, 'Journals', allSystem);
    if (systemSyncError instanceof Error && systemSyncError.message.includes('Xero journal access is unavailable')) {
      throw systemSyncError;
    }
    if (manualSyncError) throw manualSyncError;
  },

  /**
   * Get General Ledger summary.
   * Leverages 10 minutes cache (600 seconds).
   */
  getGeneralLedger: async (tenantId: number, forceSync = false): Promise<GeneralLedgerSummary> => {
    const cacheKey = 'GeneralLedgerDashboardSummary';

    if (!forceSync) {
      const cached = await db.getGlCache(tenantId, cacheKey);
      if (cached) {
        return cached;
      }
    }

    const tokenInfo = await getXeroAccessToken(tenantId);
    let manualJournals = await db.getReport(tenantId, 'ManualJournals') || [];
    let systemJournals = await db.getReport(tenantId, 'Journals') || [];

    // Trigger sync if empty or forceSync
    if (forceSync || (tokenInfo && manualJournals.length === 0 && systemJournals.length === 0)) {
      try {
        await XeroGeneralLedgerService.syncGeneralLedger(tenantId);
        manualJournals = await db.getReport(tenantId, 'ManualJournals') || [];
        systemJournals = await db.getReport(tenantId, 'Journals') || [];
      } catch (e) {
        console.error('Failed to sync general ledger records:', e);
      }
    }

    // Combine journals and track dates
    const allEntries: { date: Date; raw: XeroLedgerRecord }[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Process system journals
    for (const j of systemJournals) {
      const d = j.CreatedDateUTC ? parseXeroDate(j.CreatedDateUTC) : (j.JournalDate ? parseXeroDate(j.JournalDate) : null);
      if (d) {
        allEntries.push({ date: d, raw: j });
      }
    }

    // Process manual journals
    for (const mj of manualJournals) {
      // Manual journals typically have 'Date' or 'UpdatedDateUTC'
      const d = mj.Date ? parseXeroDate(mj.Date) : (mj.UpdatedDateUTC ? parseXeroDate(mj.UpdatedDateUTC) : null);
      if (d) {
        allEntries.push({ date: d, raw: mj });
      }
    }

    // Calculate metrics
    const totalTransactions = allEntries.length;
    let thisMonthCount = 0;
    let latestDate: Date | null = null;

    for (const entry of allEntries) {
      // Check if entry belongs to the current calendar month and year
      if (entry.date.getFullYear() === currentYear && entry.date.getMonth() === currentMonth) {
        thisMonthCount++;
      }
      if (!latestDate || entry.date > latestDate) {
        latestDate = entry.date;
      }
    }

    let lastEntryStr = 'No transactions';
    if (latestDate) {
      const pad = (n: number) => String(n).padStart(2, '0');
      lastEntryStr = `${latestDate.getFullYear()}-${pad(latestDate.getMonth() + 1)}-${pad(latestDate.getDate())} ${pad(latestDate.getHours())}:${pad(latestDate.getMinutes())}`;
    }

    const summary: GeneralLedgerSummary = {
      total_transactions: totalTransactions,
      this_month: thisMonthCount,
      last_entry: lastEntryStr
    };

    // Cache summary for 10 minutes (600 seconds)
    await db.saveGlCache(tenantId, cacheKey, summary, 600);

    return summary;
  }
};
