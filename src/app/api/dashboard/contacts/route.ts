import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';

interface ContactItem {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  email: string;
  phone: string;
  outstanding: number;
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;
    const org = tokenInfo
      ? await getOrFetchManagementReport(tenantId, 'Organisation', async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null) as any
      : await db.getPostgresReport(tenantId, 'Organisation');
    const orgCurrency = org?.BaseCurrency ?? null;

    const rawContacts = tokenInfo
      ? await getOrFetchManagementReport(tenantId, 'Contacts', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Contacts'))
      : await db.getPostgresReport(tenantId, 'Contacts');

    // Default empty response if Xero has no data
    if (!rawContacts || !Array.isArray(rawContacts) || rawContacts.length === 0) {
      return NextResponse.json({
        connected: isConnected,
        summary: {
          customers: 0,
          suppliers: 0,
          totalOutstanding: 0,
          arTotal: 0,
          apTotal: 0
        },
        contacts: [],
        meta: { currency: orgCurrency, calculatedAt: new Date().toISOString() }
      });
    }

    const contacts: ContactItem[] = [];
    let customersCount = 0;
    let suppliersCount = 0;
    let arTotal = 0;
    let apTotal = 0;

    rawContacts.forEach((c: any) => {
      const isCustomer = c.IsCustomer === true;
      const isSupplier = c.IsSupplier === true;

      if (!isCustomer && !isSupplier) return;

      if (isCustomer) customersCount++;
      if (isSupplier) suppliersCount++;

      const arOutstanding = parseFloat(c.Balances?.AccountsReceivable?.Outstanding) || 0;
      const apOutstanding = parseFloat(c.Balances?.AccountsPayable?.Outstanding) || 0;

      arTotal += arOutstanding;
      apTotal += apOutstanding;

      // Extract primary phone if Xero supplied one.
      let phone = '';
      if (Array.isArray(c.Phones)) {
        const primary = c.Phones.find((p: any) => p.PhoneType === 'DEFAULT') || c.Phones[0];
        if (primary) {
          const area = primary.PhoneAreaCode ? `+${primary.PhoneAreaCode} ` : '';
          const num = primary.PhoneNumber || '';
          phone = `${area}${num}`.trim();
        }
      }

      const email = c.EmailAddress || '';

      // Push as Customer if flagged as customer
      if (isCustomer) {
        contacts.push({
          id: `${c.ContactID}-customer`,
          name: c.Name,
          type: 'Customer',
          email,
          phone,
          outstanding: arOutstanding
        });
      }

      // Push as Supplier if flagged as supplier
      if (isSupplier) {
        contacts.push({
          id: `${c.ContactID}-supplier`,
          name: c.Name,
          type: 'Supplier',
          email,
          phone,
          outstanding: -apOutstanding
        });
      }
    });

    const totalOutstanding = arTotal + apTotal;

    return NextResponse.json({
      connected: true,
      summary: {
        customers: customersCount,
        suppliers: suppliersCount,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        arTotal: Math.round(arTotal * 100) / 100,
        apTotal: Math.round(apTotal * 100) / 100
      },
      contacts,
      meta: {
        currency: orgCurrency,
        calculatedAt: new Date().toISOString()
      }
    });

  } catch (err: any) {
    console.error('Contacts API handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
