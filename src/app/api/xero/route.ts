import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchXeroResource, fetchXeroResourcePaginated, fetchXeroReport, refreshXeroToken } from '@/lib/xero';
import { getTenantIdFromSession } from '@/lib/auth';
import { XeroFixedAssetsService } from '@/lib/fixedAssetsService';
import { XeroGeneralLedgerService } from '@/lib/generalLedgerService';
import { TaxSyncService } from '@/lib/services/TaxSyncService';
import { CanonicalLedgerIngestionService } from '@/lib/services/CanonicalLedgerIngestionService';
import { getDefaultDateRange } from '@/lib/date-defaults';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 
// GET retrieves Xero connection status and dynamic record counts for a tenant
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
  }
 
  try {
    const credentials = await db.getCredentials(tenantId, 'xero');
    
    if (credentials && credentials.access_token && credentials.tenant_identifier) {
      // Fetch dynamic record counts from database cache
      const counts = await db.getSyncCounts(tenantId);
      const totalRecords = Object.values(counts).reduce((a: any, b: any) => a + b, 0);
 
      // Fetch active tenant name to display organisation
      const tenantsList = await db.getTenants();
      const activeTenant = tenantsList.find(t => t.id === tenantId);
      let orgName = activeTenant ? activeTenant.name : 'Connected Organization';
 
      // Fetch all connected organisations from Xero
      let connections: any[] = [];
      try {
        let accessToken = credentials.access_token;
        if (new Date(credentials.expires_at) <= new Date()) {
          accessToken = await refreshXeroToken(tenantId, credentials);
        }
        
        const connectionsRes = await fetch('https://api.xero.com/connections', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });
        if (connectionsRes.ok) {
          const allConns = await connectionsRes.json();
          connections = allConns
            .filter((c: any) => c.tenantType === 'ORGANISATION')
            .map((c: any) => ({
              xeroTenantId: c.tenantId,
              name: c.tenantName
            }));
            
          const matchedConn = connections.find(c => c.xeroTenantId === credentials.tenant_identifier);
          if (matchedConn) {
            orgName = matchedConn.name;
            // Update PostgreSQL/JSON database tenant name to sync it if it currently differs
            if (activeTenant && activeTenant.name !== orgName) {
              await db.updateTenantName(tenantId, orgName);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch Xero connections for switcher:', err);
      }

      if (connections.length === 0) {
        connections = [{ xeroTenantId: credentials.tenant_identifier, name: orgName }];
      }

      const parseXeroDate = (dateVal: any) => {
        if (!dateVal) return null;
        if (dateVal instanceof Date) return dateVal;
        if (typeof dateVal !== 'string') return new Date(dateVal);
        const match = dateVal.match(/Date\((\d+)/);
        return match ? new Date(parseInt(match[1])) : new Date(dateVal);
      };

      const defaultDates = getDefaultDateRange();
      const startDateStr = defaultDates.startDate;
      const endDateStr = defaultDates.endDate;

      return NextResponse.json({
        connected: true,
        organisation: orgName,
        records: totalRecords,
        lastSyncedAt: credentials.last_synced_at || null,
        connections,
        activeXeroTenantId: credentials.tenant_identifier,
        startDate: startDateStr,
        endDate: endDateStr,
        ...counts
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }
    
    return NextResponse.json({ connected: false });
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message || 'Error checking connection' });
  }
}
 
// POST saves credentials config OR executes dynamic Xero API synchronization
export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
 
  try {
    let body = null;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => null);
    }
 
    // CASE A: SAVE CONFIG
    if (body && body.clientId && body.clientSecret) {
      await db.saveCredentials(tenantId, 'xero', {
        client_id: body.clientId,
        client_secret: body.clientSecret
      });
      return NextResponse.json({ success: true, message: 'Xero configuration saved.' });
    }

    // CASE C: SWITCH ACTIVE ORGANISATION
    if (body && body.switchXeroTenantId && body.organisationName) {
      const newXeroTenantId = body.switchXeroTenantId;
      const orgName = body.organisationName;

      // 1. Save new active Xero tenant ID in credentials (which clears cache automatically if changed)
      await db.saveCredentials(tenantId, 'xero', {
        tenant_identifier: newXeroTenantId
      });

      // 2. Update the local tenant company name to match the switched organisation
      await db.updateTenantName(tenantId, orgName);

      // 3. Force clean cache database records for this tenant
      await db.clearCachedRecords(tenantId);

      return NextResponse.json({
        success: true,
        message: `Successfully switched to organisation: ${orgName}. Database cache has been cleared, sync required.`
      });
    }
 
    // CASE B: START ACTIVE SYNC FROM XERO API
    const credentials = await db.getCredentials(tenantId, 'xero');
    if (!credentials || !credentials.access_token) {
      return NextResponse.json({
        success: false,
        message: 'No active connection credentials found for this tenant.'
      }, { status: 400 });
    }
 
    let accessToken = credentials.access_token;
    
    // Refresh Xero token if expired
    if (new Date(credentials.expires_at) <= new Date()) {
      try {
        accessToken = await refreshXeroToken(tenantId, credentials);
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          message: 'OAuth Token refresh failed: ' + err.message
        }, { status: 401 });
      }
    }
 
    const xeroTenantId = credentials.tenant_identifier;
    const counts: Record<string, number> = { contacts: 0, invoices: 0, payments: 0, accounts: 0, bankTransactions: 0, prepayments: 0, overpayments: 0, items: 0 };
    const changedCounts: Record<string, number> = {};
    let syncHasErrors = false;
    // A previous implementation could have stored a partial If-Modified-Since
    // response as the full snapshot. If this installation has not completed a
    // verified v2 baseline, rebuild the source snapshots once before enabling
    // incremental mode again. This repairs legacy partial data automatically.
    const syncState = await db.getPostgresReport(tenantId, 'XeroSyncState');
    const requiresFullBaseline = syncState?.version !== 2;
    const modifiedSince = !requiresFullBaseline && credentials.last_synced_at
      ? new Date(new Date(credentials.last_synced_at).getTime() - 1000)
      : undefined;
    let syncQueue = Promise.resolve();
    const queueXeroCall = async <T,>(operation: () => Promise<T>): Promise<T> => {
      let result!: T;
      const previous = syncQueue;
      const current = previous.catch(() => undefined).then(async () => { result = await operation(); });
      syncQueue = current.catch(() => undefined);
      await current;
      return result;
    };
    const resourceId = (resource: string, item: any): string | null => {
      const fields: Record<string, string[]> = {
        Contacts: ['ContactID', 'contact_id'],
        Invoices: ['InvoiceID', 'invoice_id'],
        Payments: ['PaymentID', 'payment_id'],
        Accounts: ['AccountID', 'account_id'],
        Items: ['ItemID', 'item_id'],
        TaxRates: ['TaxType', 'tax_type'],
        Prepayments: ['PrepaymentID', 'prepayment_id'],
        Overpayments: ['OverpaymentID', 'overpayment_id'],
        CreditNotes: ['CreditNoteID', 'credit_note_id'],
        BankTransactions: ['BankTransactionID', 'bank_transaction_id', 'TransactionID', 'transaction_id'],
      };
      for (const field of fields[resource] || []) {
        if (item?.[field]) return String(item[field]);
      }
      return null;
    };
    const mergeResourceRecords = (resource: string, existing: any, changed: any[]): any[] => {
      if (!modifiedSince || !Array.isArray(existing)) return changed;

      const merged = new Map<string, any>();
      const recordsWithoutIds: any[] = [];
      const addRecord = (item: any) => {
        const id = resourceId(resource, item);
        if (id) merged.set(id, item);
        else recordsWithoutIds.push(item);
      };

      existing.forEach(addRecord);
      changed.forEach(addRecord);
      return [...merged.values(), ...recordsWithoutIds];
    };
    const fetchIncrementalResource = async (resource: string, reportType: string, paginated = false): Promise<any[]> => {
      const existing = await db.getPostgresReport(tenantId, reportType);
      const changed = await queueXeroCall(() => paginated
        ? fetchXeroResourcePaginated(accessToken, xeroTenantId, resource, 100, modifiedSince)
        : fetchXeroResource(accessToken, xeroTenantId, resource, undefined, 3, modifiedSince));
      changedCounts[reportType] = changed.length;
      if (!modifiedSince || !Array.isArray(existing) || existing.length === 0) return changed;
      if (!changed.length) return existing;
      return mergeResourceRecords(resource, existing, changed);
    };

    // Verify token validity by calling Xero Organisations API first
    try {
      await fetchXeroResource(accessToken, xeroTenantId, 'Organisations');
    } catch (err: any) {
      if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('TokenExpired')) {
        console.log('[Sync] Cached token is expired or invalid on Xero API. Attempting forced refresh...');
        try {
          accessToken = await refreshXeroToken(tenantId, credentials);
          console.log('[Sync] Force token refresh succeeded.');
        } catch (refreshErr: any) {
          console.error('[Sync] Force token refresh failed:', refreshErr.message);
          return NextResponse.json({
            success: false,
            message: 'Xero session expired or unauthorized. Please disconnect and reconnect your Xero account in Data Sources.'
          }, { status: 401 });
        }
      } else {
        console.error('[Sync] Connection check error:', err.message);
      }
    }

    // Incremental resource syncs are queued to stay within Xero's per-tenant
    // concurrency limit while retaining unchanged records locally.
    try {
      const [
        contactsRes,
        paymentsRes,
        accountsRes,
        itemsRes,
        taxRatesRes,
        prepaymentsRes,
        overpaymentsRes,
        orgsRes,
        plRes
      ] = await Promise.allSettled([
        fetchIncrementalResource('Contacts', 'Contacts'),
        fetchIncrementalResource('Payments', 'Payments', true),
        fetchIncrementalResource('Accounts', 'Accounts_metadata'),
        fetchIncrementalResource('Items', 'Items'),
        fetchIncrementalResource('TaxRates', 'TaxRates'),
        fetchIncrementalResource('Prepayments', 'Prepayments', true),
        fetchIncrementalResource('Overpayments', 'Overpayments', true),
        fetchXeroResource(accessToken, xeroTenantId, 'Organisations'),
        queueXeroCall(() => fetchXeroReport(accessToken, xeroTenantId, 'ProfitAndLoss', undefined, 3, modifiedSince))
      ]);
      if ([contactsRes, paymentsRes, accountsRes, itemsRes, taxRatesRes, prepaymentsRes, overpaymentsRes, orgsRes, plRes]
        .some(result => result.status === 'rejected')) {
        syncHasErrors = true;
      }

      if (contactsRes.status === 'fulfilled' && contactsRes.value) {
        await db.saveCachedRecords(tenantId, 'contacts', contactsRes.value);
        await db.saveReport(tenantId, 'Contacts', contactsRes.value);
        counts.contacts = contactsRes.value.length;
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
        await db.saveCachedRecords(tenantId, 'payments', paymentsRes.value);
        await db.saveReport(tenantId, 'Payments', paymentsRes.value);
        counts.payments = paymentsRes.value.length;
      }
      if (accountsRes.status === 'fulfilled' && accountsRes.value) {
        await db.saveCachedRecords(tenantId, 'accounts', accountsRes.value);
        await db.saveReport(tenantId, 'Accounts_metadata', accountsRes.value);
        counts.accounts = accountsRes.value.length;
      }
      if (itemsRes.status === 'fulfilled' && itemsRes.value) {
        await db.saveInventoryItems(tenantId, itemsRes.value);
        await db.saveReport(tenantId, 'Items', itemsRes.value);
        counts.items = itemsRes.value.length;
      }
      if (taxRatesRes.status === 'fulfilled' && taxRatesRes.value) {
        await db.saveReport(tenantId, 'TaxRates', taxRatesRes.value);
      }
      if (prepaymentsRes.status === 'fulfilled' && prepaymentsRes.value) {
        await db.saveReport(tenantId, 'Prepayments', prepaymentsRes.value);
        counts.prepayments = prepaymentsRes.value.length;
      }
      if (overpaymentsRes.status === 'fulfilled' && overpaymentsRes.value) {
        await db.saveReport(tenantId, 'Overpayments', overpaymentsRes.value);
        counts.overpayments = overpaymentsRes.value.length;
      }
      if (orgsRes.status === 'fulfilled' && orgsRes.value?.[0]) {
        await db.saveReport(tenantId, 'Organisation', orgsRes.value[0]);
      }
      if (plRes.status === 'fulfilled' && plRes.value) {
        await db.saveReport(tenantId, 'ProfitAndLoss', plRes.value);
      }
    } catch (e) {
      syncHasErrors = true;
      console.error('[Sync] Error in master parallel batch:', e);
    }

    // Sync Fixed Assets
    try {
      await XeroFixedAssetsService.syncFixedAssets(tenantId);
      await db.saveFixedAssetsCache(tenantId, 'FixedAssetsDashboardSummary', null, 0);
    } catch (e) {
      syncHasErrors = true;
      console.error('Failed to sync Fixed Assets:', e);
    }

    // Sync General Ledger
    try {
      await XeroGeneralLedgerService.syncGeneralLedger(tenantId);
      await db.saveGlCache(tenantId, 'GeneralLedgerDashboardSummary', null, 0);
    } catch (e) {
      syncHasErrors = true;
      console.error('Failed to sync General Ledger:', e);
    }

    // Sync detailed Invoice Line Items for inventory sales history and tax calculations
    try {
      const allInvoicesWithLines: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 20) { // Limit to 20 pages max for fast response
        try {
          const pageData = await fetchXeroResource(
            accessToken, 
            xeroTenantId, 
            'Invoices', 
            `page=${page}&where=Status=="PAID" OR Status=="AUTHORISED" OR Status=="DRAFT"`,
            3,
            modifiedSince
          );
          if (pageData && pageData.length > 0) {
            allInvoicesWithLines.push(...pageData);
            if (pageData.length < 100) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        } catch (err) {
          syncHasErrors = true;
          console.error(`Error fetching Invoice page ${page}:`, err);
          hasMore = false;
        }
      }

      const existingInvoices = await db.getPostgresReport(tenantId, 'Invoices');
      changedCounts.Invoices = allInvoicesWithLines.length;
      const invoiceRecords = mergeResourceRecords('Invoices', existingInvoices, allInvoicesWithLines);
      if (invoiceRecords.length > 0) {
        await db.saveCachedRecords(tenantId, 'invoices', invoiceRecords);
        await db.saveReport(tenantId, 'Invoices', invoiceRecords);
        counts.invoices = allInvoicesWithLines.length;
      }

      const sales: any[] = [];
      const parseXeroDate = (dateStr: string) => {
        const match = dateStr.match(/\/Date\((\d+)/);
        return match ? new Date(parseInt(match[1])) : new Date(dateStr);
      };

      for (const inv of invoiceRecords) {
        if (inv.Status === 'PAID' || inv.Status === 'AUTHORISED') {
          const soldAt = inv.Date ? parseXeroDate(inv.Date) : null;
          if (Array.isArray(inv.LineItems)) {
            for (const line of inv.LineItems) {
              const itemId = line.Item?.ItemID || line.ItemID;
              if (itemId) {
                sales.push({
                  item_id: itemId,
                  invoice_id: inv.InvoiceID,
                  quantity_sold: parseFloat(line.Quantity) || 0,
                  sold_at: soldAt ? soldAt.toISOString() : null
                });
              }
            }
          }
        }
      }
      await db.saveSalesHistory(tenantId, sales);
    } catch(e) {
      syncHasErrors = true;
      console.error('Failed to sync Invoice Line Items for inventory:', e);
    }

    // Sync CreditNotes for tax adjustments
    try {
      const allCreditNotes: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 5) {
        try {
          const pageData = await fetchXeroResource(accessToken, xeroTenantId, 'CreditNotes', `page=${page}`, 3, modifiedSince);
          if (pageData && pageData.length > 0) {
            allCreditNotes.push(...pageData);
            if (pageData.length < 100) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        } catch (err) {
          syncHasErrors = true;
          console.error(`Error fetching CreditNotes page ${page}:`, err);
          hasMore = false;
        }
      }
      const existingCreditNotes = await db.getPostgresReport(tenantId, 'CreditNotes');
      changedCounts.CreditNotes = allCreditNotes.length;
      const creditNoteRecords = mergeResourceRecords('CreditNotes', existingCreditNotes, allCreditNotes);
      await db.saveReport(tenantId, 'CreditNotes', creditNoteRecords);
    } catch (e) {
      syncHasErrors = true;
      console.error('Failed to sync CreditNotes:', e);
    }

    // Trigger normalization/sync of tax transactions
    try {
      await TaxSyncService.syncTaxTransactions(tenantId);
    } catch (e) {
      syncHasErrors = true;
      console.error('Failed to process TaxSyncService:', e);
    }

    // Cash Flow Sources
    try {
      const bankTxns = await queueXeroCall(() => fetchXeroResourcePaginated(accessToken, xeroTenantId, 'BankTransactions', 100, modifiedSince));
      changedCounts.BankTransactions = bankTxns.length;
      const existingBankTxns = await db.getPostgresReport(tenantId, 'BankTransactions');
      const bankTxnRecords = mergeResourceRecords('BankTransactions', existingBankTxns, bankTxns || []);
      await db.saveReport(tenantId, 'BankTransactions', bankTxnRecords);
      counts.bankTransactions = bankTxnRecords.length;
    } catch(e) {
      syncHasErrors = true;
      console.error('Failed to sync BankTransactions:', e);
    }

    // Clear derived dashboard page caches so that fresh sync data is calculated and displayed
    try {
      await db.clearDerivedCaches(tenantId);
    } catch (e) {
      syncHasErrors = true;
      console.error('Failed to clear derived caches on sync:', e);
    }

    // Save last sync time in credentials database
    if (!syncHasErrors) {
      await db.saveCredentials(tenantId, 'xero', {
        last_synced_at: new Date().toISOString()
      });
      await db.saveReport(tenantId, 'XeroSyncState', {
        version: 2,
        baselineCompletedAt: new Date().toISOString(),
        strategy: 'full baseline followed by If-Modified-Since incremental merges'
      });
    }
 
    return NextResponse.json({
      success: true,
      message: syncHasErrors
        ? 'Accounting sync completed with source errors; the previous sync checkpoint was retained.'
        : 'Accounting data synchronized successfully!',
      counts,
      sync: {
        mode: modifiedSince ? 'incremental' : (requiresFullBaseline ? 'baseline-recovery-full' : 'initial-full'),
        modifiedSince: modifiedSince?.toISOString() ?? null,
        checkpointAdvanced: !syncHasErrors,
        changedCounts,
        strategy: 'PostgreSQL cache + Xero If-Modified-Since + pagination + queued requests'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Synchronization failed' }, { status: 500 });
  }
}
 
// DELETE wipes credentials and drops caches
export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
 
  try {
    await db.deleteCredentials(tenantId, 'xero');
    await db.clearCachedRecords(tenantId);
    return NextResponse.json({ success: true, message: 'Xero integration cleared.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Disconnect failed' }, { status: 500 });
  }
}
