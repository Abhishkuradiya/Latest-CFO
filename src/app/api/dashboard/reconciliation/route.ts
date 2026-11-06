import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken } from '@/lib/xero';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({
        reconciliationPercentage: null,
        unreconciledTransactions: null,
        pendingTransactions: null,
        lastReconciliation: null
      });
    }

    const credentials = await db.getCredentials(tenantId, 'xero');
    let lastReconciliationDate: Date | null = null;
    if (credentials?.last_synced_at) {
      const d = new Date(credentials.last_synced_at);
      if (!isNaN(d.getTime())) {
        lastReconciliationDate = d;
      }
    }

    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    const lastReconciliation = lastReconciliationDate?.toLocaleDateString('en-US', options) || null;

    // 1. Fetch DB records
    const payments = await db.getPayments(tenantId);
    const invoices = await db.getInvoices(tenantId);

    let unreconciledBankItems: any[] = [];
    let arOutstandingItems: any[] = [];
    let apOutstandingItems: any[] = [];

    let totalBankTxns = 0;
    let reconciledBankTxns = 0;
    let unreconciledBankTxns = 0;
    let unreconciledBankValue = 0;

    let arTotalOutstanding = 0;
    let arOverdueCount = 0;

    let apTotalOutstanding = 0;
    let apOverdueCount = 0;

    if (payments.length > 0 || invoices.length > 0) {
      // Real DB Data Path
      const pendingPaymentsList = payments.filter((p: any) => 
        p.is_reconciled !== true && p.IsReconciled !== true && p.status !== 'PAID' && p.Status !== 'PAID'
      );

      unreconciledBankItems = pendingPaymentsList.map((pmt: any, idx: number) => ({
        id: pmt.external_id || `PAY-${3000 + idx}`,
        type: 'Bank Payment',
        contact: pmt.contact_name || 'Direct Debit / Transfer',
        date: pmt.created_at ? new Date(pmt.created_at).toISOString().split('T')[0] : '',
        amount: parseFloat(pmt.amount || '0'),
        status: 'Unreconciled',
        reference: pmt.reference || `BANK-TXN-${idx + 1}`
      }));

      totalBankTxns = payments.length;
      unreconciledBankTxns = pendingPaymentsList.length;
      reconciledBankTxns = Math.max(0, totalBankTxns - unreconciledBankTxns);
      unreconciledBankValue = unreconciledBankItems.reduce((sum: number, item: any) => sum + item.amount, 0);

      // AR Invoices
      const arInvoices = invoices.filter((i: any) => 
        (i.type === 'ACCREC' || i.type === 'SALES' || !i.type) &&
        (i.Status === 'AUTHORISED' || i.status === 'AUTHORISED' || i.Status === 'SUBMITTED' || i.status === 'SUBMITTED') &&
        (i.amount_due === undefined || parseFloat(i.amount_due || '0') > 0)
      );

      arOutstandingItems = arInvoices.map((inv: any, idx: number) => ({
        id: inv.invoice_number || inv.external_id || `INV-${1000 + idx}`,
        type: 'Sales Invoice',
        contact: inv.contact_name || inv.contact || 'Customer',
        date: inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : '',
        amount: parseFloat(inv.amount_due || inv.total || '0'),
        status: 'Unpaid',
        reference: inv.invoice_number || `REF-${2000 + idx}`
      }));

      arTotalOutstanding = arOutstandingItems.reduce((sum: number, item: any) => sum + item.amount, 0);
      arOverdueCount = arOutstandingItems.filter((i: any) => i.due_date && new Date(i.due_date) < new Date()).length;

      // AP Bills
      const apBills = invoices.filter((i: any) => 
        (i.type === 'ACCPAY' || i.type === 'BILL') &&
        (i.Status === 'AUTHORISED' || i.status === 'AUTHORISED' || i.Status === 'SUBMITTED' || i.status === 'SUBMITTED') &&
        (i.amount_due === undefined || parseFloat(i.amount_due || '0') > 0)
      );

      apOutstandingItems = apBills.map((inv: any, idx: number) => ({
        id: inv.invoice_number || inv.external_id || `BILL-${8000 + idx}`,
        type: 'Supplier Bill',
        contact: inv.contact_name || inv.contact || 'Supplier',
        date: inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : '',
        amount: parseFloat(inv.amount_due || inv.total || '0'),
        status: 'Unpaid',
        reference: inv.invoice_number || `PO-${4000 + idx}`
      }));

      apTotalOutstanding = apOutstandingItems.reduce((sum: number, item: any) => sum + item.amount, 0);
      apOverdueCount = apOutstandingItems.filter((i: any) => i.due_date && new Date(i.due_date) < new Date()).length;
    }

    const bankRecPercentage = totalBankTxns > 0 ? Math.round((reconciledBankTxns / totalBankTxns) * 100) : null;

    return NextResponse.json({
      bank: {
        reconciliationPercentage: bankRecPercentage,
        totalTransactions: totalBankTxns,
        reconciledCount: reconciledBankTxns,
        unreconciledCount: unreconciledBankTxns,
        unreconciledBankValue,
        lastReconciliation
      },
      ar: {
        outstandingCount: arOutstandingItems.length,
        totalOutstandingAmount: arTotalOutstanding,
        overdueCount: arOverdueCount,
        items: arOutstandingItems
      },
      ap: {
        outstandingCount: apOutstandingItems.length,
        totalOutstandingAmount: apTotalOutstanding,
        overdueCount: apOverdueCount,
        items: apOutstandingItems
      },
      // Backward compatibility fields
      reconciliationPercentage: bankRecPercentage,
      unreconciledTransactions: unreconciledBankTxns,
      pendingTransactions: unreconciledBankTxns,
      lastReconciliation,
      unreconciledItems: [
        ...unreconciledBankItems,
        ...arOutstandingItems,
        ...apOutstandingItems
      ]
    });
  } catch (err: any) {
    console.error('Reconciliation KPI error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
