import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getXeroAccessToken, fetchXeroReport, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';
import { BankAccountMergeService } from '@/lib/services/BankAccountMergeService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const accountType = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';

  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const fromDateStr = searchParams.get('from_date') || searchParams.get('fromDate') || currentMonthStart;
  const toDateStr = searchParams.get('to_date') || searchParams.get('toDate') || searchParams.get('as_of_date') || currentMonthEnd;

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch raw accounts metadata from DB or Xero API
    const rawAccounts = tokenInfo
      ? (await getOrFetchManagementReport(
          tenantId,
          'Accounts_metadata',
          () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Accounts'),
        ) as any[] | null) ?? []
      : (await db.getPostgresReport(tenantId, 'Accounts_metadata') as any[] | null) ?? [];
    const activeRawAccounts = rawAccounts.filter((account) => {
      const status = String(account.Status ?? account.status ?? 'ACTIVE').toUpperCase();
      return status === 'ACTIVE';
    });

    const org = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          'Organisation',
          async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null,
        ) as { BaseCurrency?: string } | null
      : await db.getPostgresReport(tenantId, 'Organisation') as { BaseCurrency?: string } | null;
    const baseCurrency = org?.BaseCurrency ?? null;

    // 2. Fetch Balance Sheet as of `toDateStr` to get point-in-time closing bank balances
    const bsReport = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          `BalanceSheet_${toDateStr}`,
          () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${toDateStr}`),
        )
      : await db.getPostgresReport(tenantId, `BalanceSheet_${toDateStr}`);

    // 3. Extract bank account closing balances as of `toDateStr`
    let balanceSheetAccounts: { name: string; balance: number }[] = [];
    if (bsReport && bsReport.Rows) {
      balanceSheetAccounts = BalanceSheetParser.findBankAccounts(bsReport.Rows);
    }

    // 4. Merge accounts metadata with closing balances as of date
    let mergedAccounts = BankAccountMergeService.mergeAccounts(activeRawAccounts, balanceSheetAccounts);

    // If balances are 0 or unassigned, try matching by BankSummary report or fallback realistic balances for demo stability
    const bankSummaryReport = tokenInfo
      ? await getOrFetchManagementReport(
          tenantId,
          `BankSummary_${fromDateStr}_${toDateStr}`,
          () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BankSummary', `fromDate=${fromDateStr}&toDate=${toDateStr}`),
        )
      : await db.getPostgresReport(tenantId, `BankSummary_${fromDateStr}_${toDateStr}`);

    if (bankSummaryReport && bankSummaryReport.Rows) {
      const summaryAccounts: Record<string, number> = {};
      for (const section of bankSummaryReport.Rows) {
        if (section.RowType === 'Section' && section.Rows) {
          for (const r of section.Rows) {
            if (r.RowType === 'Row' && r.Cells && r.Cells.length >= 5) {
              const name = (r.Cells[0]?.Value || '').toLowerCase().trim();
              const closing = parseFloat(r.Cells[4]?.Value || '0') || 0;
              if (name) summaryAccounts[name] = closing;
            }
          }
        }
      }
      mergedAccounts = mergedAccounts.map((acc) => {
        const normName = acc.accountName.toLowerCase().trim();
        const foundVal = Object.keys(summaryAccounts).find((k) => k.includes(normName) || normName.includes(k));
        if (foundVal !== undefined) {
          return { ...acc, balance: summaryAccounts[foundVal] };
        }
        return acc;
      });
    }

    // Format output DTO for frontend
    const formattedAccounts = mergedAccounts.map((acc, index) => {
      const bal = acc.balance || 0;

      return {
        id: index + 1,
        externalId: acc.accountId || `ACC-${index + 1}`,
        accountName: acc.accountName,
        accountCode: acc.accountCode || 'BANK',
        accountType: 'Bank Account',
        balance: parseFloat(bal.toFixed(2)),
        status: acc.status === 'DELETED' || acc.status === 'ARCHIVED' ? 'Inactive' : 'Active',
        lastUpdated: new Date(toDateStr).toLocaleDateString('en-GB'),
        currency: acc.currency || baseCurrency
      };
    });

    const totalAccounts = formattedAccounts.length;
    const positiveAccounts = formattedAccounts.filter((a) => a.balance > 0);
    const negativeAccounts = formattedAccounts.filter((a) => a.balance < 0);

    const positiveSum = positiveAccounts.reduce((sum, a) => sum + a.balance, 0);
    const negativeSum = negativeAccounts.reduce((sum, a) => sum + a.balance, 0);
    const netTotalCash = positiveSum + negativeSum;

    // Filter table by search, type, and status
    let filteredAccounts = formattedAccounts;
    if (search) {
      filteredAccounts = filteredAccounts.filter(
        (a) => a.accountName.toLowerCase().includes(search) || a.accountCode.toLowerCase().includes(search)
      );
    }

    if (accountType) {
      filteredAccounts = filteredAccounts.filter((a) => a.accountType.toLowerCase() === accountType.toLowerCase());
    }

    if (statusFilter) {
      filteredAccounts = filteredAccounts.filter((a) => a.status.toLowerCase() === statusFilter.toLowerCase());
    }

    const totalFilteredCount = filteredAccounts.length;
    const startIndex = (page - 1) * limit;
    const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      summary: {
        totalCash: parseFloat(netTotalCash.toFixed(2)),
        totalAccountsCount: totalAccounts,
        positiveBalanceSum: parseFloat(positiveSum.toFixed(2)),
        positiveAccountsCount: positiveAccounts.length,
        negativeBalanceSum: parseFloat(negativeSum.toFixed(2)),
        negativeAccountsCount: negativeAccounts.length,
        activeAccountsCount: formattedAccounts.filter((a) => a.status === 'Active').length,
        activePercentage:
          totalAccounts > 0
            ? Math.round((formattedAccounts.filter((a) => a.status === 'Active').length / totalAccounts) * 100)
            : 0
      },
      cashPosition: formattedAccounts
        .map((a) => ({
          name: a.accountName,
          balance: a.balance
        }))
        .sort((a, b) => b.balance - a.balance),
      pagination: {
        page,
        limit,
        totalRecords: totalFilteredCount,
        totalPages: Math.ceil(totalFilteredCount / limit) || 1
      },
      accounts: paginatedAccounts,
      meta: { currency: baseCurrency, xeroConnected: isConnected }
    });
  } catch (err: any) {
    console.error('Bank Accounts API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
