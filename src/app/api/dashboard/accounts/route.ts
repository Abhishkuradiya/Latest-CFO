import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';

function getAccountGroup(type: string, cls?: string): 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses' | null {
  const c = (cls || '').toUpperCase();
  if (c === 'ASSET') return 'Assets';
  if (c === 'LIABILITY') return 'Liabilities';
  if (c === 'EQUITY') return 'Equity';
  if (c === 'REVENUE') return 'Revenue';
  if (c === 'EXPENSE') return 'Expenses';

  const t = (type || '').toUpperCase();
  if (['BANK', 'CURRENT', 'FIXED', 'INVENTORY', 'PREPAYMENT', 'ASSET'].includes(t)) {
    return 'Assets';
  }
  if (['CURRLIAB', 'TERMLIAB', 'LIABILITY', 'PAYMENT'].includes(t)) {
    return 'Liabilities';
  }
  if (t === 'EQUITY') {
    return 'Equity';
  }
  if (['REVENUE', 'SALES', 'OTHERINCOME'].includes(t)) {
    return 'Revenue';
  }
  if (['EXPENSE', 'DEPRECIATN', 'DIRECTCOSTS', 'OVERHEADS'].includes(t)) {
    return 'Expenses';
  }
  return null;
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. First fetch Accounts_metadata from report storage
    let rawAccounts = await db.getReport(tenantId, 'Accounts_metadata');
    if ((!rawAccounts || !Array.isArray(rawAccounts) || rawAccounts.length === 0) && isConnected) {
      try {
        const fetchedAccounts = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Accounts');
        if (fetchedAccounts && fetchedAccounts.length > 0) {
          rawAccounts = fetchedAccounts;
          await db.saveReport(tenantId, 'Accounts_metadata', rawAccounts);
          await db.saveCachedRecords(tenantId, 'accounts', rawAccounts);
        }
      } catch (err: any) {
        console.error('Failed to sync Accounts in /api/dashboard/accounts route:', err.message);
      }
    }

    // 2. Fallback to cached records if report is not available
    if (!rawAccounts || !Array.isArray(rawAccounts) || rawAccounts.length === 0) {
      const cachedAccounts = await db.getAccounts(tenantId);
      if (cachedAccounts && Array.isArray(cachedAccounts) && cachedAccounts.length > 0) {
        rawAccounts = cachedAccounts;
      }
    }

    const accountsList = Array.isArray(rawAccounts) ? rawAccounts : [];

    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expenses = 0;

    for (const acc of accountsList) {
      const status = (acc.Status || acc.status || 'ACTIVE').toUpperCase();
      if (status === 'ACTIVE') {
        const group = getAccountGroup(acc.Type || acc.type || '', acc.Class || acc.class || '');
        if (group === 'Assets') assets++;
        else if (group === 'Liabilities') liabilities++;
        else if (group === 'Equity') equity++;
        else if (group === 'Revenue') revenue++;
        else if (group === 'Expenses') expenses++;
      }
    }

    const totalAccounts = assets + liabilities + equity + revenue + expenses;

    return NextResponse.json({
      totalAccounts,
      distribution: {
        assets,
        liabilities,
        equity,
        revenue,
        expenses
      }
    });
  } catch (err: any) {
    console.error('Accounts distribution KPI error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

