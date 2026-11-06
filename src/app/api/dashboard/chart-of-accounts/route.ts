import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

// Helper to determine Account Group and Class
function getAccountDetails(type: string, cls?: string) {
  const t = (type || '').toUpperCase();
  const c = (cls || '').toUpperCase();

  let accountGroup: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses' = 'Expenses';
  let accountClass = c || 'EXPENSE';

  if (c === 'ASSET' || ['BANK', 'CURRENT', 'FIXED', 'INVENTORY', 'PREPAYMENT', 'ASSET'].includes(t)) {
    accountGroup = 'Assets';
    accountClass = 'ASSET';
  } else if (c === 'LIABILITY' || ['CURRLIAB', 'TERMLIAB', 'LIABILITY', 'PAYMENT'].includes(t)) {
    accountGroup = 'Liabilities';
    accountClass = 'LIABILITY';
  } else if (c === 'EQUITY' || t === 'EQUITY') {
    accountGroup = 'Equity';
    accountClass = 'EQUITY';
  } else if (c === 'REVENUE' || ['REVENUE', 'SALES', 'OTHERINCOME'].includes(t)) {
    accountGroup = 'Revenue';
    accountClass = 'REVENUE';
  } else {
    accountGroup = 'Expenses';
    accountClass = 'EXPENSE';
  }

  return { accountGroup, accountClass };
}



export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const typeFilter = searchParams.get('type') || 'ALL';
  const statusFilter = searchParams.get('status') || 'ALL';
  const taxFilter = searchParams.get('taxType') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    let accountsList: any[] = [];
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch Organisation details to get true Base Currency
    const orgReport = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          'Organisation',
          async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null,
        )
      : await db.getPostgresReport(tenantId, 'Organisation');
    const orgBaseCurrency = orgReport?.BaseCurrency || orgReport?.CurrencyCode || null;

    // 2. Fetch full Accounts_metadata from report storage or Xero API
    const rawAccounts = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          'Accounts_metadata',
          () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Accounts'),
        ) as any[] | null
      : await db.getPostgresReport(tenantId, 'Accounts_metadata') as any[] | null;

    // 3. Process rawAccounts if available (Full Xero accounts with exact CurrencyCode, Class, TaxType, Description)
    if (Array.isArray(rawAccounts) && rawAccounts.length > 0) {
      accountsList = rawAccounts.map(acc => {
        const { accountGroup, accountClass } = getAccountDetails(acc.Type || acc.type, acc.Class || acc.class);
        const codeVal = acc.Code || acc.code || (acc.BankAccountNumber ? acc.BankAccountNumber.slice(-6) : '') || '—';
        const currencyVal = acc.CurrencyCode || acc.currency || orgBaseCurrency;

        return {
          id: acc.AccountID || acc.id || codeVal,
          code: codeVal,
          name: acc.Name || acc.name || 'Unnamed Account',
          type: (acc.Type || acc.type || 'EXPENSE').toUpperCase(),
          class: (acc.Class || acc.class || accountClass).toUpperCase(),
          taxType: (acc.TaxType || acc.taxType || acc.TaxRate || 'NONE').toUpperCase(),
          status: (acc.Status || acc.status || 'ACTIVE').toUpperCase(),
          currency: currencyVal,
          description: acc.Description || acc.description || acc.ReportingCodeName || acc.Name || 'Standard ledger account',
          group: accountGroup
        };
      });
    } else if (isConnected) {
      // Fallback to db.getAccounts(tenantId)
      const cached = await db.getAccounts(tenantId);
      if (cached && cached.length > 0) {
        accountsList = cached.map(acc => {
          const { accountGroup, accountClass } = getAccountDetails(acc.Type, acc.Class);
          return {
            id: acc.AccountID || acc.id || acc.Code,
            code: acc.Code || '—',
            name: acc.Name || 'Unnamed Account',
            type: (acc.Type || 'EXPENSE').toUpperCase(),
            class: accountClass,
            taxType: (acc.TaxType || acc.TaxRate || 'NONE').toUpperCase(),
            status: (acc.Status || 'ACTIVE').toUpperCase(),
            currency: acc.CurrencyCode || orgBaseCurrency,
            description: acc.Description || acc.Name || 'Standard ledger account',
            group: accountGroup
          };
        });
      }
    }

    // 4. Fallback if empty or disconnected
    if (accountsList.length === 0) {
      accountsList = [];
    }

    // Overall KPI distribution calculation across all active accounts
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const acc of accountsList) {
      if (acc.status === 'ACTIVE') {
        if (acc.group === 'Assets') totalAssets++;
        else if (acc.group === 'Liabilities') totalLiabilities++;
        else if (acc.group === 'Equity') totalEquity++;
        else if (acc.group === 'Revenue') totalRevenue++;
        else if (acc.group === 'Expenses') totalExpenses++;
      }
    }

    const totalAccountsCount = totalAssets + totalLiabilities + totalEquity + totalRevenue + totalExpenses || accountsList.length;

    // Filter accounts list for table display
    let filtered = accountsList;

    if (search) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(search) ||
        a.code.toLowerCase().includes(search) ||
        a.type.toLowerCase().includes(search) ||
        a.description.toLowerCase().includes(search)
      );
    }

    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(a => a.group.toLowerCase() === typeFilter.toLowerCase() || a.type.toLowerCase() === typeFilter.toLowerCase());
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(a => a.status.toLowerCase() === statusFilter.toLowerCase());
    }

    if (taxFilter !== 'ALL') {
      filtered = filtered.filter(a => a.taxType.toLowerCase() === taxFilter.toLowerCase());
    }

    // Pagination
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / limit) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * limit;
    const paginatedAccounts = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      summary: {
        totalAccounts: totalAccountsCount,
        distribution: {
          assets: totalAssets,
          assetsPct: totalAccountsCount > 0 ? ((totalAssets / totalAccountsCount) * 100).toFixed(1) : '0',
          liabilities: totalLiabilities,
          liabilitiesPct: totalAccountsCount > 0 ? ((totalLiabilities / totalAccountsCount) * 100).toFixed(1) : '0',
          equity: totalEquity,
          equityPct: totalAccountsCount > 0 ? ((totalEquity / totalAccountsCount) * 100).toFixed(1) : '0',
          revenue: totalRevenue,
          revenuePct: totalAccountsCount > 0 ? ((totalRevenue / totalAccountsCount) * 100).toFixed(1) : '0',
          expenses: totalExpenses,
          expensesPct: totalAccountsCount > 0 ? ((totalExpenses / totalAccountsCount) * 100).toFixed(1) : '0',
        }
      },
      pagination: {
        totalItems: totalFiltered,
        totalPages,
        currentPage,
        limit,
        startIndex: totalFiltered > 0 ? startIndex + 1 : 0,
        endIndex: Math.min(startIndex + limit, totalFiltered)
      },
      accounts: paginatedAccounts
    });
  } catch (err: any) {
    console.error('Chart of Accounts API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
