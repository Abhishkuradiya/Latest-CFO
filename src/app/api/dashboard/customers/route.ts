import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { Pool } from 'pg';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'virtual_cfo',
});

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const status = searchParams.get('status') || '';
  const group = searchParams.get('group') || '';
  const fromDate = searchParams.get('from_date') || null;
  const toDate = searchParams.get('to_date') || null;

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    // Query top customers by total revenue from ACCREC invoices in PostgreSQL
    const queryStr = `
      SELECT 
        contact_name,
        COUNT(*) as invoice_count,
        SUM(total) as total_revenue,
        SUM(amount_due) as total_outstanding
      FROM invoices
      WHERE tenant_id = $1 AND type = 'ACCREC'
        AND ($2::date IS NULL OR invoice_date >= $2::date)
        AND ($3::date IS NULL OR invoice_date < ($3::date + INTERVAL '1 day'))
      GROUP BY contact_name
      ORDER BY total_revenue DESC
    `;

    const result = await pgPool.query(queryStr, [tenantId, fromDate, toDate]);
    let rows = result.rows;
    if (rows.length === 0) {
      const invoices = tokenInfo
        ? await getOrFetchManagementReport(tenantId, 'Invoices', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Invoices')) as any[] | null
        : null;
      const grouped = new Map<string, { invoice_count: number; total_revenue: number; total_outstanding: number }>();
      for (const invoice of invoices ?? []) {
        if (String(invoice.Type ?? '').toUpperCase() !== 'ACCREC') continue;
        const invoiceDate = new Date(invoice.Date || invoice.invoice_date || '');
        const endExclusive = toDate ? new Date(`${toDate}T00:00:00`) : null;
        if (endExclusive) endExclusive.setDate(endExclusive.getDate() + 1);
        if ((fromDate && (Number.isNaN(invoiceDate.getTime()) || invoiceDate < new Date(`${fromDate}T00:00:00`))) ||
            (endExclusive && (Number.isNaN(invoiceDate.getTime()) || invoiceDate >= endExclusive))) continue;
        const name = invoice.Contact?.Name || invoice.contact_name || '';
        if (!name) continue;
        const current = grouped.get(name) ?? { invoice_count: 0, total_revenue: 0, total_outstanding: 0 };
        current.invoice_count += 1;
        current.total_revenue += Number(invoice.Total ?? invoice.total ?? 0) || 0;
        current.total_outstanding += Number(invoice.AmountDue ?? invoice.amount_due ?? 0) || 0;
        grouped.set(name, current);
      }
      rows = Array.from(grouped, ([contact_name, values]) => ({ contact_name, ...values }));
    }

    const grandTotalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.total_revenue || '0'), 0);
    const grandTotalOutstanding = rows.reduce((sum, r) => sum + parseFloat(r.total_outstanding || '0'), 0);

    const formattedCustomers = rows.map((r) => {
      const revenue = parseFloat(r.total_revenue || '0');
      const outstanding = parseFloat(r.total_outstanding || '0');
      const pctOfRevenue = grandTotalRevenue > 0 ? (revenue / grandTotalRevenue) * 100 : 0;
      const groupName = '—';
      const paidOnTime = null;

      const words = r.contact_name.trim().split(' ');
      let avatar = 'CU';
      if (words.length >= 2) {
        avatar = `${words[0][0]}${words[1][0]}`.toUpperCase();
      } else if (words[0]) {
        avatar = words[0].slice(0, 2).toUpperCase();
      }

      return {
        name: r.contact_name,
        group: groupName,
        revenue: parseFloat(revenue.toFixed(2)),
        pctOfRevenue: parseFloat(pctOfRevenue.toFixed(1)),
        outstanding: parseFloat(outstanding.toFixed(2)),
        paidOnTime,
        status: 'Active',
        avatar
      };
    });

    let filtered = formattedCustomers;
    if (search) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(search) || c.group.toLowerCase().includes(search));
    }
    if (status) {
      filtered = filtered.filter(c => c.status.toLowerCase() === status.toLowerCase());
    }
    if (group) {
      filtered = filtered.filter(c => c.group.toLowerCase() === group.toLowerCase());
    }

    const totalFiltered = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    const totalCustomersCount = rows.length;
    const avgRev = totalCustomersCount > 0 ? parseFloat((grandTotalRevenue / totalCustomersCount).toFixed(2)) : null;

    const organisation = tokenInfo
      ? await getOrFetchManagementReport(tenantId, 'Organisation', async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null) as any
      : null;

    return NextResponse.json({
      summary: {
        totalCustomersCount,
        totalRevenue: grandTotalRevenue,
        avgRevenuePerCustomer: avgRev,
        totalOutstanding: grandTotalOutstanding,
        paidOnTimePercentage: null
      },
      topCustomers: formattedCustomers.slice(0, 5),
      customers: paginated,
      meta: { currency: organisation?.BaseCurrency ?? null },
      pagination: {
        page,
        limit,
        totalRecords: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit) || 1
      }
    });
  } catch (err: any) {
    console.error('Customers API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
