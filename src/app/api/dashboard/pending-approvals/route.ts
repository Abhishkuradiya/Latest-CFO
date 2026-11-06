import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const invoices = await db.getInvoices(tenantId);

    // Invoices awaiting approval (SUBMITTED status in Xero = Awaiting Approval)
    const submittedInvoices = invoices.filter(
      inv => inv.Type === 'ACCREC' && inv.Status === 'SUBMITTED'
    );
    const invoiceCount = submittedInvoices.length;
    const invoiceAmount = submittedInvoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

    // Bills awaiting approval (SUBMITTED status)
    const submittedBills = invoices.filter(
      inv => inv.Type === 'ACCPAY' && inv.Status === 'SUBMITTED'
    );
    const billCount = submittedBills.length;
    const billAmount = submittedBills.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);

    // Purchase Orders pending approval (from cached reports)
    let poCount = 0;
    let poAmount = 0;
    const purchaseOrders = await db.getReport(tenantId, 'PurchaseOrders');
    if (purchaseOrders && Array.isArray(purchaseOrders)) {
      const pendingPOs = purchaseOrders.filter(
        (po: any) => po.Status === 'SUBMITTED' || po.Status === 'DRAFT'
      );
      poCount = pendingPOs.length;
      poAmount = pendingPOs.reduce((sum: number, po: any) => sum + (po.Total || 0), 0);
    }

    const totalPending = invoiceCount + billCount + poCount;

    return NextResponse.json({
      totalPending,
      invoices: { count: invoiceCount, amount: invoiceAmount },
      bills: { count: billCount, amount: billAmount },
      purchaseOrders: { count: poCount, amount: poAmount }
    });

  } catch (err: any) {
    console.error('Pending Approvals error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
