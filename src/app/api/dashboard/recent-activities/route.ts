import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// ─── Xero date helpers ───
function parseXeroDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val === 'string') {
    // /Date(1234567890000+0000)/ format
    const match = val.match(/\/Date\((\d+)/);
    if (match) return new Date(parseInt(match[1]));
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Activity types ───
interface NormalizedActivity {
  type: string;
  title: string;
  subtitle: string;
  amount: number | null;
  currency: string;
  time: string;
  sortDate: number;
  icon: string;
  color: string;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
  } catch {
    return `${currency || '$'}${Math.abs(amount).toLocaleString()}`;
  }
}

// ─── GET handler ───
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activities: NormalizedActivity[] = [];

    // 1. Invoices (ACCREC = customer invoices, ACCPAY = bills)
    const invoices = await db.getInvoices(tenantId);
    for (const inv of invoices) {
      const updatedDate = parseXeroDate(inv.UpdatedDateUTC) || parseXeroDate(inv.Date);
      if (!updatedDate) continue;

      const isInvoice = inv.Type === 'ACCREC';
      const contactName = inv.Contact?.Name || inv.ContactName || 'Unknown';
      const invNumber = inv.InvoiceNumber || inv.InvoiceID?.substring(0, 8) || '';
      const amount = inv.Total || 0;
      const currency = inv.CurrencyCode || 'USD';
      const amountStr = formatCurrency(amount, currency);

      if (isInvoice) {
        // Customer Invoice
        if (inv.Status === 'PAID') {
          activities.push({
            type: 'invoice_paid',
            title: `Invoice ${invNumber} paid`,
            subtitle: `${amountStr} from ${contactName}`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'invoice', color: 'green'
          });
        } else if (inv.Status === 'AUTHORISED') {
          const dueDate = parseXeroDate(inv.DueDate);
          const isOverdue = dueDate && dueDate.getTime() < Date.now();
          if (isOverdue) {
            activities.push({
              type: 'invoice_overdue',
              title: `Invoice ${invNumber} overdue`,
              subtitle: `${amountStr} from ${contactName}`,
              amount, currency,
              time: relativeTime(updatedDate),
              sortDate: updatedDate.getTime(),
              icon: 'invoice', color: 'red'
            });
          } else {
            activities.push({
              type: 'invoice_created',
              title: `Invoice ${invNumber} created`,
              subtitle: `${amountStr} for ${contactName}`,
              amount, currency,
              time: relativeTime(updatedDate),
              sortDate: updatedDate.getTime(),
              icon: 'invoice', color: 'blue'
            });
          }
        } else if (inv.Status === 'DRAFT') {
          activities.push({
            type: 'invoice_created',
            title: `Draft invoice ${invNumber}`,
            subtitle: `${amountStr} for ${contactName}`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'invoice', color: 'blue'
          });
        } else if (inv.Status === 'SUBMITTED') {
          activities.push({
            type: 'invoice_updated',
            title: `Invoice ${invNumber} awaiting approval`,
            subtitle: `${amountStr} for ${contactName}`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'invoice', color: 'blue'
          });
        }
      } else {
        // Bill (ACCPAY)
        if (inv.Status === 'PAID') {
          activities.push({
            type: 'bill_paid',
            title: `Bill paid to ${contactName}`,
            subtitle: `${amountStr} settled`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'bill', color: 'orange'
          });
        } else if (inv.Status === 'AUTHORISED' || inv.Status === 'SUBMITTED') {
          activities.push({
            type: 'bill_created',
            title: `Bill from ${contactName}`,
            subtitle: `${amountStr} awaiting payment`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'bill', color: 'orange'
          });
        } else if (inv.Status === 'DRAFT') {
          activities.push({
            type: 'bill_created',
            title: `Draft bill from ${contactName}`,
            subtitle: `${amountStr} pending`,
            amount, currency,
            time: relativeTime(updatedDate),
            sortDate: updatedDate.getTime(),
            icon: 'bill', color: 'orange'
          });
        }
      }
    }

    // 2. Payments
    const payments = await db.getPayments(tenantId);
    for (const pay of payments) {
      const updatedDate = parseXeroDate(pay.UpdatedDateUTC) || parseXeroDate(pay.Date);
      if (!updatedDate) continue;

      const amount = pay.Amount || 0;
      const currency = pay.CurrencyCode || pay.Invoice?.CurrencyCode || 'USD';
      const amountStr = formatCurrency(amount, currency);
      const contactName = pay.Invoice?.Contact?.Name || 'Unknown';
      const isReceive = pay.PaymentType === 'ACCRECPAYMENT' || (pay.Invoice && pay.Invoice.Type === 'ACCREC');

      if (isReceive) {
        activities.push({
          type: 'payment_received',
          title: `Payment received from ${contactName}`,
          subtitle: `${amountStr} collected`,
          amount, currency,
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'payment', color: 'green'
        });
      } else {
        activities.push({
          type: 'payment_sent',
          title: `Payment sent to ${contactName}`,
          subtitle: `${amountStr} disbursed`,
          amount, currency,
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'payment', color: 'green'
        });
      }
    }

    // 3. Credit Notes (from cached reports)
    const creditNotes = await db.getReport(tenantId, 'CreditNotes');
    if (creditNotes && Array.isArray(creditNotes)) {
      for (const cn of creditNotes) {
        const updatedDate = parseXeroDate(cn.UpdatedDateUTC) || parseXeroDate(cn.Date);
        if (!updatedDate) continue;
        const amount = cn.Total || 0;
        const currency = cn.CurrencyCode || 'USD';
        const amountStr = formatCurrency(amount, currency);
        const contactName = cn.Contact?.Name || 'Unknown';
        const cnNumber = cn.CreditNoteNumber || '';

        activities.push({
          type: 'credit_note_created',
          title: `Credit Note ${cnNumber} issued`,
          subtitle: `${amountStr} to ${contactName}`,
          amount, currency,
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'creditnote', color: 'purple'
        });
      }
    }

    // 4. Bank Transactions (from cached reports)
    const bankTxns = await db.getReport(tenantId, 'BankTransactions');
    if (bankTxns && Array.isArray(bankTxns)) {
      for (const txn of bankTxns) {
        const updatedDate = parseXeroDate(txn.UpdatedDateUTC) || parseXeroDate(txn.Date);
        if (!updatedDate) continue;
        const amount = txn.Total || 0;
        const currency = txn.CurrencyCode || 'USD';
        const amountStr = formatCurrency(amount, currency);
        const contactName = txn.Contact?.Name || '';

        activities.push({
          type: 'bank_transaction',
          title: `Bank transaction${contactName ? ` — ${contactName}` : ''}`,
          subtitle: `${amountStr} processed`,
          amount, currency,
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'bank', color: 'teal'
        });
      }
    }

    // 5. Purchase Orders (from cached reports)
    const purchaseOrders = await db.getReport(tenantId, 'PurchaseOrders');
    if (purchaseOrders && Array.isArray(purchaseOrders)) {
      for (const po of purchaseOrders) {
        const updatedDate = parseXeroDate(po.UpdatedDateUTC) || parseXeroDate(po.Date);
        if (!updatedDate) continue;
        const amount = po.Total || 0;
        const currency = po.CurrencyCode || 'USD';
        const amountStr = formatCurrency(amount, currency);
        const contactName = po.Contact?.Name || 'Unknown';
        const poNumber = po.PurchaseOrderNumber || '';

        activities.push({
          type: 'purchase_order_created',
          title: `PO ${poNumber} created`,
          subtitle: `${amountStr} for ${contactName}`,
          amount, currency,
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'bill', color: 'orange'
        });
      }
    }

    // 6. Manual Journals (from cached reports)
    const manualJournals = await db.getReport(tenantId, 'ManualJournals');
    if (manualJournals && Array.isArray(manualJournals)) {
      for (const mj of manualJournals) {
        const updatedDate = parseXeroDate(mj.UpdatedDateUTC) || parseXeroDate(mj.Date);
        if (!updatedDate) continue;

        activities.push({
          type: 'manual_journal',
          title: `Journal entry posted`,
          subtitle: mj.Narration || 'Manual adjustment',
          amount: null, currency: 'USD',
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'journal', color: 'gray'
        });
      }
    }

    // 7. Contacts (from cached contacts table)
    const contacts = await db.getReport(tenantId, 'Contacts');
    if (contacts && Array.isArray(contacts)) {
      for (const c of contacts.slice(0, 20)) {
        const updatedDate = parseXeroDate(c.UpdatedDateUTC);
        if (!updatedDate) continue;

        activities.push({
          type: 'contact_created',
          title: `Contact ${c.Name || 'Unknown'} added`,
          subtitle: c.EmailAddress || 'No email',
          amount: null, currency: 'USD',
          time: relativeTime(updatedDate),
          sortDate: updatedDate.getTime(),
          icon: 'contact', color: 'indigo'
        });
      }
    }

    // Sort by most recent first, return top 8
    activities.sort((a, b) => b.sortDate - a.sortDate);
    const top8 = activities.slice(0, 8).map(({ sortDate, ...rest }) => rest);

    return NextResponse.json({ activities: top8 });

  } catch (err: any) {
    console.error('Recent Activities error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
