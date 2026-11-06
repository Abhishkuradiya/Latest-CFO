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
      return NextResponse.json({ vendors: [] });
    }
    const invoices = await db.getInvoices(tenantId);
    
    // Use the last 6 months window to match the dashboard header date range
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Filter ACCPAY (Bills), PAID or AUTHORISED in the last 6 months
    const recentBills = invoices.filter(inv => {
      if (inv.Type !== 'ACCPAY') return false;
      if (inv.Status !== 'PAID' && inv.Status !== 'AUTHORISED') return false;
      const date = parseXeroDate(inv.Date);
      if (!date) return false;
      return date >= sixMonthsAgo && date <= now;
    });

    // Group by contact name
    const vendorMap: Record<string, number> = {};
    for (const inv of recentBills) {
      const contactName = inv.ContactName || inv.Contact?.Name || 'Unknown Vendor';
      const total = inv.Total || 0;
      vendorMap[contactName] = (vendorMap[contactName] || 0) + total;
    }

    // Sort and limit to Top 5
    const sortedVendors = Object.entries(vendorMap)
      .map(([name, amount]) => ({
        name,
        amount,
        avatar: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // If database is empty, return empty list (no fake data)
    if (sortedVendors.length === 0) {
      return NextResponse.json({ vendors: [] });
    }

    return NextResponse.json({ vendors: sortedVendors });

  } catch (err: any) {
    console.error('Top Vendors error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
