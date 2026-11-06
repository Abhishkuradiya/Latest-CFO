import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

import { getXeroAccessToken } from '@/lib/xero';

function parseXeroDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const match = val.match(/\/Date\((\d+)/);
    if (match) return new Date(parseInt(match[1]));
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
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
    if (!tokenInfo) {
      return NextResponse.json([]);
    }
    const invoices = await db.getInvoices(tenantId);
    
    // Use the last 6 months window to match the dashboard header date range
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Filter ACCREC invoices (PAID or AUTHORISED) in the last 6 months
    const recentInvoices = invoices.filter(inv => {
      if (inv.Type !== 'ACCREC') return false;
      if (inv.Status !== 'PAID' && inv.Status !== 'AUTHORISED') return false;
      const date = parseXeroDate(inv.Date);
      if (!date) return false;
      return date >= sixMonthsAgo && date <= now;
    });

    // Group by contact name
    const customerMap: Record<string, number> = {};
    for (const inv of recentInvoices) {
      const contactName = inv.ContactName || inv.Contact?.Name || 'Unknown Customer';
      const total = inv.Total || 0;
      customerMap[contactName] = (customerMap[contactName] || 0) + total;
    }

    // Sort and limit to Top 5
    const sortedCustomers = Object.entries(customerMap)
      .map(([name, revenue]) => ({
        name,
        revenue,
        avatar: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // If database is empty, return empty list (no fake data)
    if (sortedCustomers.length === 0) {
      return NextResponse.json({ customers: [] });
    }

    return NextResponse.json({ customers: sortedCustomers });

  } catch (err: any) {
    console.error('Top Customers error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
