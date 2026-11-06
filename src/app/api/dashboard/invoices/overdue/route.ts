import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { db, parseXeroDate } from '@/lib/db';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const search = searchParams.get('search') || '';
  const customer = searchParams.get('customer') || '';
  const statusFilter = searchParams.get('status') || '';
  const overdueBucket = searchParams.get('overdue_bucket') || '';
  const showFullyPaid = searchParams.get('show_fully_paid') === 'true';
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    const orgReport = isConnected
      ? await getOrFetchManagementReport(
          tenantId,
          'Organisation',
          async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null,
        )
      : await db.getPostgresReport(tenantId, 'Organisation');
    const currency = orgReport?.raw_data?.BaseCurrency || orgReport?.BaseCurrency || orgReport?.CurrencyCode || null;

    const storedInvoices = isConnected
      ? await getOrFetchManagementReport(
          tenantId,
          'Invoices',
          () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Invoices'),
        )
      : await db.getPostgresReport(tenantId, 'Invoices');
    const rawInvoicesList: any[] = Array.isArray(storedInvoices)
      ? storedInvoices.filter((inv: any) => {
        const t = (inv.Type || inv.type || '').toUpperCase();
        return t === 'ACCREC';
      })
      : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let allInvoices = rawInvoicesList.map((inv: any) => {
      const invNumber = inv.invoice_number || inv.InvoiceNumber || inv.reference || inv.Reference || 'INV-000';
      const contactName = inv.contact_name || inv.ContactName || inv.Contact?.Name || 'Unknown Customer';
      const invDate = inv.invoice_date || inv.Date || inv.DateString;
      const dueDate = inv.due_date || inv.DueDate || inv.DueDateString || invDate;

      const total = parseFloat(inv.total ?? inv.Total ?? 0);
      const amountPaid = parseFloat(inv.amount_paid ?? inv.AmountPaid ?? 0);
      const amountDue = inv.amount_due !== undefined && inv.amount_due !== null ? parseFloat(inv.amount_due) : (inv.AmountDue !== undefined && inv.AmountDue !== null ? parseFloat(inv.AmountDue) : Math.max(0, total - amountPaid));

      const status = (inv.status || inv.Status || 'AUTHORISED').toUpperCase();
      const invoiceCurrency = inv.currency || inv.CurrencyCode || currency;
      const rawLineItems = inv.line_items || inv.LineItems || [];

      let subTotal = inv.sub_total ?? inv.SubTotal;
      let totalTax = inv.total_tax ?? inv.TotalTax;

      if (subTotal === undefined || subTotal === null) {
        if (Array.isArray(rawLineItems) && rawLineItems.length > 0) {
          subTotal = rawLineItems.reduce((acc: number, item: any) => {
            const lAmt = parseFloat(item.LineAmount ?? item.lineAmount ?? item.line_amount ?? item.UnitAmount ?? 0);
            return acc + lAmt;
          }, 0);
        } else {
          subTotal = total;
        }
      } else {
        subTotal = parseFloat(subTotal);
      }

      if (totalTax === undefined || totalTax === null) {
        if (Array.isArray(rawLineItems) && rawLineItems.length > 0) {
          totalTax = rawLineItems.reduce((acc: number, item: any) => {
            const tAmt = parseFloat(item.TaxAmount ?? item.taxAmount ?? item.tax_amount ?? 0);
            return acc + tAmt;
          }, 0);
        } else {
          totalTax = Math.max(0, total - subTotal);
        }
      } else {
        totalTax = parseFloat(totalTax);
      }

      let overdueDays = 0;
      const parsedDueDate = parseXeroDate(dueDate);
      if (parsedDueDate) {
        const dObj = new Date(parsedDueDate);
        dObj.setHours(0, 0, 0, 0);
        const diffMs = today.getTime() - dObj.getTime();
        overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        id: inv.id || inv.external_id || inv.InvoiceID || invNumber,
        invoice_number: invNumber,
        contact_name: contactName,
        invoice_date: invDate,
        due_date: dueDate,
        total,
        sub_total: subTotal,
        total_tax: totalTax,
        amount_due: amountDue,
        amount_paid: amountPaid,
        status,
        currency: invoiceCurrency,
        line_items: typeof rawLineItems === 'string' ? JSON.parse(rawLineItems) : (rawLineItems || []),
        attachments: inv.attachments || inv.Attachments || [],
        overdue_days: overdueDays
      };
    });

    // Filter out deleted/voided/draft
    allInvoices = allInvoices.filter((inv: any) => inv.status !== 'DELETED' && inv.status !== 'VOIDED' && inv.status !== 'DRAFT');

    // Filter by Date Range if provided
    if (fromDate || toDate) {
      allInvoices = allInvoices.filter((inv: any) => {
        if (!inv.invoice_date) return false;
        const parsedDate = parseXeroDate(inv.invoice_date);
        if (!parsedDate) return false;
        const invDateStr = parsedDate.toISOString().slice(0, 10);
        if (fromDate && invDateStr < fromDate) return false;
        if (toDate && invDateStr > toDate) return false;
        return true;
      });
    }

    const overdueInvoices = allInvoices.filter((inv: any) => {
      const isUnpaid = inv.amount_due > 0.001;
      const isOverdue = inv.overdue_days > 0;
      return isUnpaid && isOverdue;
    });

    const totalOverdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + inv.amount_due, 0);
    const totalOverdueCount = overdueInvoices.length;
    const totalAccrecCount = allInvoices.length;
    const overduePercentage = totalAccrecCount > 0 ? (totalOverdueCount / totalAccrecCount) * 100 : 0;

    // Historical display trend derived from the stored invoice balances and due dates.
    // No synthetic/demo points are used.
    const trendEndDate = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();
    const trendLabels: string[] = [];
    const trendValues: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(trendEndDate);
      day.setUTCDate(day.getUTCDate() - i);
      trendLabels.push(day.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }));
      const dayEnd = day.getTime();
      trendValues.push(overdueInvoices.reduce((sum: number, inv: any) => {
        const dueDate = parseXeroDate(inv.due_date);
        return dueDate && dueDate.getTime() <= dayEnd ? sum + inv.amount_due : sum;
      }, 0));
    }

    const avgOverdueDays = totalOverdueCount > 0
      ? Math.round(overdueInvoices.reduce((sum: number, inv: any) => sum + inv.overdue_days, 0) / totalOverdueCount)
      : 0;

    const sortedByOverdue = [...overdueInvoices].sort((a: any, b: any) => b.overdue_days - a.overdue_days);
    const oldestInvoice = sortedByOverdue[0] || null;

    const uniqueCustomers = Array.from(new Set(overdueInvoices.map((inv: any) => inv.contact_name).filter(Boolean)));

    const agingBuckets = {
      b0_30: { amount: 0, count: 0 },
      b31_60: { amount: 0, count: 0 },
      b61_90: { amount: 0, count: 0 },
      b91_180: { amount: 0, count: 0 },
      b181_plus: { amount: 0, count: 0 },
    };

    overdueInvoices.forEach((inv: any) => {
      const dueAmt = inv.amount_due;
      const days = inv.overdue_days;
      if (days <= 30) {
        agingBuckets.b0_30.amount += dueAmt;
        agingBuckets.b0_30.count += 1;
      } else if (days <= 60) {
        agingBuckets.b31_60.amount += dueAmt;
        agingBuckets.b31_60.count += 1;
      } else if (days <= 90) {
        agingBuckets.b61_90.amount += dueAmt;
        agingBuckets.b61_90.count += 1;
      } else if (days <= 180) {
        agingBuckets.b91_180.amount += dueAmt;
        agingBuckets.b91_180.count += 1;
      } else {
        agingBuckets.b181_plus.amount += dueAmt;
        agingBuckets.b181_plus.count += 1;
      }
    });

    const customerTotals: Record<string, number> = {};
    overdueInvoices.forEach((inv: any) => {
      const cName = inv.contact_name || 'Unknown Customer';
      customerTotals[cName] = (customerTotals[cName] || 0) + inv.amount_due;
    });

    const topCustomers = Object.entries(customerTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    let filteredTable = showFullyPaid ? allInvoices : overdueInvoices;

    if (search.trim()) {
      const q = search.toLowerCase();
      filteredTable = filteredTable.filter((inv: any) =>
        (inv.invoice_number || '').toLowerCase().includes(q) ||
        (inv.contact_name || '').toLowerCase().includes(q)
      );
    }

    if (customer) {
      filteredTable = filteredTable.filter((inv: any) => (inv.contact_name || '').toLowerCase() === customer.toLowerCase());
    }

    if (statusFilter) {
      filteredTable = filteredTable.filter((inv: any) => (inv.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    if (overdueBucket) {
      filteredTable = filteredTable.filter((inv: any) => {
        const d = inv.overdue_days;
        if (overdueBucket === '0_30') return d <= 30;
        if (overdueBucket === '31_60') return d > 30 && d <= 60;
        if (overdueBucket === '61_90') return d > 60 && d <= 90;
        if (overdueBucket === '91_180') return d > 90 && d <= 180;
        if (overdueBucket === '181_plus') return d > 180;
        return true;
      });
    }

    filteredTable.sort((a: any, b: any) => b.overdue_days - a.overdue_days);

    const totalFilteredCount = filteredTable.length;
    const startIndex = (page - 1) * limit;
    const paginatedInvoices = filteredTable.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      summary: {
        totalOverdueAmount,
        totalOverdueCount,
        avgOverdueDays,
        oldestInvoice: oldestInvoice ? {
          invoiceNumber: oldestInvoice.invoice_number,
          overdueDays: oldestInvoice.overdue_days,
          customerName: oldestInvoice.contact_name
        } : null,
        uniqueCustomersCount: uniqueCustomers.length,
        overduePercentage
      },
      meta: { currency, dataAvailable: storedInvoices !== null },
      trend: { labels: trendLabels, values: trendValues },
      agingBuckets,
      topCustomers,
      customersList: uniqueCustomers,
      pagination: {
        page,
        limit,
        totalRecords: totalFilteredCount,
        totalPages: Math.ceil(totalFilteredCount / limit) || 1
      },
      invoices: paginatedInvoices.map((inv: any) => ({
        id: inv.id || inv.invoice_number,
        invoiceNumber: inv.invoice_number,
        customerName: inv.contact_name || 'N/A',
        contactName: inv.contact_name || 'N/A',
        issueDate: inv.invoice_date ? (parseXeroDate(inv.invoice_date)?.toISOString().slice(0, 10) || 'N/A') : 'N/A',
        dueDate: inv.due_date ? (parseXeroDate(inv.due_date)?.toISOString().slice(0, 10) || 'N/A') : 'N/A',
        totalAmount: inv.total,
        amountPaid: inv.amount_paid,
        amountDue: inv.amount_due,
        subTotal: inv.sub_total,
        totalTax: inv.total_tax,
        overdueDays: inv.overdue_days,
        status: inv.overdue_days > 0 && inv.amount_due > 0 ? 'OVERDUE' : (inv.status || 'PAID'),
        rawStatus: inv.status || 'AUTHORISED',
        currency: inv.currency || currency,
        lineItems: inv.line_items || [],
        attachments: inv.attachments || []
      }))
    });
  } catch (err: any) {
    console.error('Overdue Invoices API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

