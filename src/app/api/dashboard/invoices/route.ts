import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken } from '@/lib/xero';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || ''; // ACCREC, ACCPAY
  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({ connected: false });
    }

    const rawInvoices = await db.getReport(tenantId, 'Invoices');
    const invoicesList = Array.isArray(rawInvoices) ? rawInvoices : [];

    // Parse Xero date helper
    const parseXeroDate = (dateStr: string) => {
      const match = dateStr.match(/\/Date\((\d+)/);
      return match ? new Date(parseInt(match[1])) : new Date(dateStr);
    };

    // Calculate dynamic totals for ACCREC (Sales) by default or all depending on filter
    let draftCount = 0;
    let draftValue = 0;
    let awaitingApprovalCount = 0;
    let awaitingApprovalValue = 0;
    let awaitingPaymentCount = 0;
    let awaitingPaymentValue = 0;
    let paidCount = 0;
    let paidValue = 0;
    let overdueCount = 0;
    let overdueValue = 0;

    const filtered = invoicesList.filter((inv: any) => {
      const invStatus = (inv.Status || '').toUpperCase();
      const invType = (inv.Type || '').toUpperCase();
      const invDate = inv.Date ? parseXeroDate(inv.Date) : null;
      const invDueDate = inv.DueDate ? parseXeroDate(inv.DueDate) : null;

      // Group totals based on Type (default to ACCREC/Sales if type is not specified)
      if (invType === 'ACCREC') {
        const totalVal = parseFloat(inv.Total || 0);
        const dueVal = parseFloat(inv.AmountDue || 0);

        if (invStatus === 'DRAFT') {
          draftCount++;
          draftValue += totalVal;
        } else if (invStatus === 'SUBMITTED') {
          awaitingApprovalCount++;
          awaitingApprovalValue += totalVal;
        } else if (invStatus === 'AUTHORISED') {
          awaitingPaymentCount++;
          awaitingPaymentValue += dueVal;

          // Check if overdue
          if (invDueDate && invDueDate < new Date()) {
            overdueCount++;
            overdueValue += dueVal;
          }
        } else if (invStatus === 'PAID') {
          paidCount++;
          paidValue += totalVal;
        }
      }

      // Apply request filters
      if (type && invType !== type.toUpperCase()) return false;
      if (status && invStatus !== status.toUpperCase()) return false;

      if (search) {
        const searchLower = search.toLowerCase();
        const numMatch = (inv.InvoiceNumber || '').toLowerCase().includes(searchLower);
        const contactMatch = (inv.Contact?.Name || '').toLowerCase().includes(searchLower);
        if (!numMatch && !contactMatch) return false;
      }

      if (fromDate) {
        const start = new Date(fromDate);
        if (invDate && invDate < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        if (invDate && invDate > end) return false;
      }

      return true;
    });

    // Sort by Date DESC
    filtered.sort((a: any, b: any) => {
      const dateA = a.Date ? parseXeroDate(a.Date).getTime() : 0;
      const dateB = b.Date ? parseXeroDate(b.Date).getTime() : 0;
      return dateB - dateA;
    });

    const org = await db.getReport(tenantId, 'Organisation');
    const currency = org?.BaseCurrency || 'USD';

    return NextResponse.json({
      connected: true,
      summary: {
        draftCount,
        draftValue,
        awaitingApprovalCount,
        awaitingApprovalValue,
        awaitingPaymentCount,
        awaitingPaymentValue,
        paidCount,
        paidValue,
        overdueCount,
        overdueValue,
        totalCount: draftCount + awaitingApprovalCount + awaitingPaymentCount + paidCount,
        totalValue: draftValue + awaitingApprovalValue + awaitingPaymentValue + paidValue
      },
      invoices: filtered.map((inv: any) => ({
        id: inv.InvoiceID,
        invoiceNumber: inv.InvoiceNumber,
        type: inv.Type,
        status: inv.Status,
        total: parseFloat(inv.Total || 0),
        amountDue: parseFloat(inv.AmountDue || 0),
        amountPaid: parseFloat(inv.AmountPaid || 0),
        currency: inv.CurrencyCode || currency,
        date: inv.Date ? parseXeroDate(inv.Date).toISOString() : null,
        dueDate: inv.DueDate ? parseXeroDate(inv.DueDate).toISOString() : null,
        contactName: inv.Contact?.Name || '',
        lineItems: (inv.LineItems || []).map((li: any) => ({
          description: li.Description || '',
          quantity: parseFloat(li.Quantity || 0),
          unitAmount: parseFloat(li.UnitAmount || 0),
          taxAmount: parseFloat(li.TaxAmount || 0),
          lineAmount: parseFloat(li.LineAmount || 0),
          accountCode: li.AccountCode || '',
          taxType: li.TaxType || ''
        }))
      })),
      meta: { currency }
    });

  } catch (err: any) {
    console.error('Invoices GET API route failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch invoices' }, { status: 500 });
  }
}
