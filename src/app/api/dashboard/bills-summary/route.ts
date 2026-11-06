import { NextRequest, NextResponse } from 'next/server';
import { db, parseXeroDate } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const statusFilter = (searchParams.get('status') || 'ALL').toUpperCase();
  const rawVendor = searchParams.get('vendor') || 'ALL';
  const vendorFilter = rawVendor.trim().toLowerCase();
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch Organisation details for true BaseCurrency
    let orgReport = await db.getReport(tenantId, 'Organisation');
    if (!orgReport && isConnected) {
      try {
        const rawOrg = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisation');
        if (rawOrg && rawOrg.length > 0) {
          orgReport = rawOrg[0];
          await db.saveReport(tenantId, 'Organisation', orgReport);
        }
      } catch (err: any) {
        console.error('Failed to sync Organisation report in bills-summary:', err.message);
      }
    }
    const currency = orgReport?.raw_data?.BaseCurrency || orgReport?.BaseCurrency || orgReport?.CurrencyCode || 'USD';

    // 2. Fetch Bills from PostgreSQL (Table: `invoices` & Report: `Invoices`)
    let rawBillsList: any[] = [];

    const pgInvoices = await db.getInvoices(tenantId);
    if (Array.isArray(pgInvoices) && pgInvoices.length > 0) {
      rawBillsList = pgInvoices;
    } else {
      const reportInvoices = await db.getReport(tenantId, 'Invoices');
      if (Array.isArray(reportInvoices) && reportInvoices.length > 0) {
        rawBillsList = reportInvoices;
      }
    }

    // 3. If PostgreSQL cache is empty and Xero is connected, fetch live from Xero API & cache into PostgreSQL
    if (rawBillsList.length === 0 && isConnected) {
      try {
        const xeroInvoices = await fetchXeroResource(
          tokenInfo.accessToken,
          tokenInfo.xeroTenantId,
          'Invoices',
          'where=Type=="ACCPAY"'
        );
        if (Array.isArray(xeroInvoices) && xeroInvoices.length > 0) {
          await db.saveCachedRecords(tenantId, 'invoices', xeroInvoices);
          await db.saveReport(tenantId, 'Invoices', xeroInvoices);
          rawBillsList = await db.getInvoices(tenantId);
        }
      } catch (err: any) {
        console.error('Failed to fetch Xero bills in bills-summary route:', err.message);
      }
    }

    // 4. Map real PostgreSQL bills (Focus strictly on ACCPAY / Vendor Bills)
    const vendorBillsList = rawBillsList.filter((inv: any) => {
      const t = (inv.Type || inv.type || 'ACCPAY').toUpperCase();
      return t === 'ACCPAY';
    });

    const allBills = vendorBillsList.map((inv: any) => {
      const st = (inv.Status || inv.status || 'DRAFT').toUpperCase();
      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const invDueDate = parseXeroDate(inv.DueDate || inv.due_date);

      let displayStatus = st;
      if (st === 'AUTHORISED') displayStatus = 'AWAITING PAYMENT';
      else if (st === 'SUBMITTED') displayStatus = 'AWAITING APPROVAL';

      return {
        id: inv.InvoiceID || inv.external_id || inv.id || inv.InvoiceNumber || inv.invoice_number,
        invoiceNumber: inv.InvoiceNumber || inv.invoice_number || '—',
        vendorName: inv.Contact?.Name || inv.ContactName || inv.contact_name || 'Unknown Vendor',
        status: displayStatus,
        rawStatus: st,
        type: 'ACCPAY',
        date: invDate ? invDate.toISOString() : null,
        dueDate: invDueDate ? invDueDate.toISOString() : null,
        total: parseFloat(inv.Total || inv.total || 0),
        amountDue: parseFloat(inv.AmountDue || inv.amount_due || 0),
        amountPaid: parseFloat(inv.AmountPaid || inv.amount_paid || 0),
        currency: inv.CurrencyCode || inv.currency || currency
      };
    });

    // Apply Date Range Filter if provided
    let dateFilteredBills = allBills;
    if (fromDate) {
      const start = new Date(fromDate);
      dateFilteredBills = dateFilteredBills.filter(bill => bill.date && new Date(bill.date) >= start);
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      dateFilteredBills = dateFilteredBills.filter(bill => bill.date && new Date(bill.date) <= end);
    }

    // 5. Calculate real dynamic KPI summary totals purely from PostgreSQL bills
    let draftCount = 0;
    let draftTotal = 0;
    let awaitingApprovalCount = 0;
    let awaitingApprovalTotal = 0;
    let awaitingPaymentCount = 0;
    let awaitingPaymentTotal = 0;
    let paidCount = 0;
    let paidTotal = 0;

    for (const bill of dateFilteredBills) {
      const st = bill.status.toUpperCase();
      if (st === 'DRAFT') {
        draftCount++;
        draftTotal += bill.total;
      } else if (st === 'AWAITING APPROVAL' || st === 'SUBMITTED') {
        awaitingApprovalCount++;
        awaitingApprovalTotal += bill.total;
      } else if (st === 'AWAITING PAYMENT' || st === 'AUTHORISED') {
        awaitingPaymentCount++;
        awaitingPaymentTotal += bill.amountDue || bill.total;
      } else if (st === 'PAID') {
        paidCount++;
        paidTotal += bill.total;
      }
    }

    const totalBills = draftCount + awaitingApprovalCount + awaitingPaymentCount + paidCount;

    // 6. Calculate Top Vendors by Payables from PostgreSQL
    const vendorMap: { [key: string]: number } = {};
    const vendorsSet = new Set<string>();

    for (const bill of dateFilteredBills) {
      if (bill.vendorName && bill.vendorName !== 'Unknown Vendor') {
        vendorsSet.add(bill.vendorName);
        if (bill.amountDue > 0) {
          vendorMap[bill.vendorName] = (vendorMap[bill.vendorName] || 0) + bill.amountDue;
        }
      }
    }

    const topVendors = Object.entries(vendorMap)
      .map(([name, amountDue]) => ({ name, amountDue }))
      .sort((a, b) => b.amountDue - a.amountDue)
      .slice(0, 5);

    const vendorsList = Array.from(vendorsSet).sort();

    // 7. Filter Bills table list
    let filtered = dateFilteredBills;

    if (search) {
      filtered = filtered.filter(b =>
        b.invoiceNumber.toLowerCase().includes(search) ||
        b.vendorName.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(b => {
        const s = b.status.toUpperCase();
        const raw = (b.rawStatus || '').toUpperCase();
        const sf = statusFilter.toUpperCase();

        if (sf === 'DRAFT') return s === 'DRAFT' || raw === 'DRAFT';
        if (sf === 'AWAITING APPROVAL' || sf === 'SUBMITTED') return s === 'AWAITING APPROVAL' || raw === 'SUBMITTED';
        if (sf === 'AWAITING PAYMENT' || sf === 'AUTHORISED') return s === 'AWAITING PAYMENT' || raw === 'AUTHORISED';
        if (sf === 'PAID') return s === 'PAID' || raw === 'PAID';
        return s === sf || raw === sf;
      });
    }

    if (vendorFilter !== 'all' && vendorFilter !== '') {
      filtered = filtered.filter(b => b.vendorName.toLowerCase().includes(vendorFilter));
    }

    // Sort by Date DESC
    filtered.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / limit) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * limit;
    const paginatedBills = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      summary: {
        totalBills,
        draft: { count: draftCount, pct: totalBills > 0 ? ((draftCount / totalBills) * 100).toFixed(2) : '0' },
        awaitingApproval: { count: awaitingApprovalCount, pct: totalBills > 0 ? ((awaitingApprovalCount / totalBills) * 100).toFixed(2) : '0' },
        awaitingPayment: { count: awaitingPaymentCount, pct: totalBills > 0 ? ((awaitingPaymentCount / totalBills) * 100).toFixed(2) : '0' },
        paid: { count: paidCount, pct: totalBills > 0 ? ((paidCount / totalBills) * 100).toFixed(2) : '0' }
      },
      chartData: {
        draft: draftCount,
        awaitingApproval: awaitingApprovalCount,
        awaitingPayment: awaitingPaymentCount,
        paid: paidCount
      },
      pagination: {
        totalItems: totalFiltered,
        totalPages,
        currentPage,
        limit,
        startIndex: totalFiltered > 0 ? startIndex + 1 : 0,
        endIndex: Math.min(startIndex + limit, totalFiltered)
      },
      bills: paginatedBills,
      recentBills: filtered.slice(0, 5),
      topVendors,
      meta: { currency, vendors: vendorsList }
    });
  } catch (err: any) {
    console.error('Bill Status Summary API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
