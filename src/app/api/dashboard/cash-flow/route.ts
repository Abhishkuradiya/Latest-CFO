import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================================
// UNIFIED CASH EVENT MODEL
// ============================================================================
export interface UnifiedCashEvent {
  id: string;
  source: 'Payment' | 'BankTransaction' | 'Prepayment' | 'Overpayment';
  direction: 'IN' | 'OUT';
  amount: number;
  date: Date;
  currency: string;
  contact: string;
  linkedInvoice?: string;
  linkedPayment?: string;
  linkedBankTransaction?: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  isDuplicate: boolean;
  isVerified: boolean;
}

// Helper to parse dates
function parseDate(val: any): Date | null {
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

// ============================================================================
// DEDUPLICATION RESOLVER
// ============================================================================
export class DeduplicationResolver {
  private processedPaymentIDs = new Set<string>();
  private processedInvoiceIDs = new Set<string>();
  private processedBankTxnIDs = new Set<string>();
  private processedPrepaymentIDs = new Set<string>();
  private processedOverpaymentIDs = new Set<string>();
  
  // Track composite keys (date_amount_contact) to prevent ad-hoc duplicate reporting
  private processedCompositeKeys = new Set<string>();

  public registerPayment(paymentId: string, invoiceId?: string) {
    if (paymentId) this.processedPaymentIDs.add(paymentId);
    if (invoiceId) this.processedInvoiceIDs.add(invoiceId);
  }

  public registerBankTransaction(txnId: string) {
    if (txnId) this.processedBankTxnIDs.add(txnId);
  }

  public registerPrepayment(prepId: string) {
    if (prepId) this.processedPrepaymentIDs.add(prepId);
  }

  public registerOverpayment(opId: string) {
    if (opId) this.processedOverpaymentIDs.add(opId);
  }

  public registerComposite(date: Date, amount: number, contact: string) {
    const key = `${date.toISOString().split('T')[0]}_${amount.toFixed(2)}_${contact.toLowerCase().trim()}`;
    this.processedCompositeKeys.add(key);
  }

  public isPaymentDuplicate(paymentId: string): boolean {
    return this.processedPaymentIDs.has(paymentId);
  }

  public isBankTxnDuplicate(txn: any): boolean {
    const txnId = txn.BankTransactionID || '';
    if (txnId && this.processedBankTxnIDs.has(txnId)) return true;

    // Check linked payments
    const embeddedPayments: any[] = txn.Payments || [];
    for (const ep of embeddedPayments) {
      if (ep.PaymentID && this.processedPaymentIDs.has(ep.PaymentID)) {
        return true;
      }
    }

    // Check line items for linked invoices
    const lineItems: any[] = txn.LineItems || [];
    for (const li of lineItems) {
      if (li.Tracking && Array.isArray(li.Tracking)) {
        for (const t of li.Tracking) {
          if (t.InvoiceID && this.processedInvoiceIDs.has(t.InvoiceID)) {
            return true;
          }
        }
      }
    }

    // Composite check to prevent duplicate ad-hoc matches
    const date = parseDate(txn.Date);
    const amount = txn.Total || 0;
    const contact = txn.Contact?.Name || '';
    if (date && amount && contact) {
      const key = `${date.toISOString().split('T')[0]}_${amount.toFixed(2)}_${contact.toLowerCase().trim()}`;
      if (this.processedCompositeKeys.has(key)) {
        return true;
      }
    }

    return false;
  }

  public isPrepaymentDuplicate(prep: any): boolean {
    const prepId = prep.PrepaymentID || '';
    if (prepId && this.processedPrepaymentIDs.has(prepId)) return true;

    // Check linked payments
    const embeddedPayments: any[] = prep.Payments || [];
    for (const ep of embeddedPayments) {
      if (ep.PaymentID && this.processedPaymentIDs.has(ep.PaymentID)) {
        return true;
      }
    }

    return false;
  }

  public isOverpaymentDuplicate(op: any): boolean {
    const opId = op.OverpaymentID || '';
    if (opId && this.processedOverpaymentIDs.has(opId)) return true;

    // Check linked payments
    const embeddedPayments: any[] = op.Payments || [];
    for (const ep of embeddedPayments) {
      if (ep.PaymentID && this.processedPaymentIDs.has(ep.PaymentID)) {
        return true;
      }
    }

    return false;
  }
}

// ============================================================================
// VERIFICATION RESOLVER
// ============================================================================
export class VerificationResolver {
  public resolveVerification(record: any): boolean {
    // If the record has a native isReconciled / IsReconciled flag
    if (record.isReconciled === true || record.IsReconciled === true) {
      return true;
    }
    // Alternatively, if the status is marked as reconciled
    const status = (record.Status || '').toUpperCase();
    if (status === 'RECONCILED') {
      return true;
    }
    // Bank transactions with matched statements
    if (record.HasAttachments === true && record.BankTransactionID) {
      return true;
    }
    return false;
  }
}

// ============================================================================
// INDIVIDUAL SOURCE RESOLVERS (SOLID Interfaces & Implementations)
// ============================================================================
export interface SourceResolver {
  resolve(rawRecords: any[], dedup: DeduplicationResolver, verifier: VerificationResolver): UnifiedCashEvent[];
}

export class PaymentResolver implements SourceResolver {
  public resolve(payments: any[], dedup: DeduplicationResolver, verifier: VerificationResolver): UnifiedCashEvent[] {
    const events: UnifiedCashEvent[] = [];

    for (const pay of payments) {
      const date = parseDate(pay.Date);
      if (!date) continue;

      const status = (pay.Status || '').toUpperCase();
      if (status !== 'AUTHORISED') continue;

      const paymentId = pay.PaymentID || '';
      const amount = pay.Amount || 0;
      const payType = (pay.PaymentType || '').toUpperCase();
      const isVerified = verifier.resolveVerification(pay);

      let direction: 'IN' | 'OUT' | null = null;
      if (payType === 'ACCRECPAYMENT') direction = 'IN';
      else if (payType === 'ACCPAYPAYMENT') direction = 'OUT';

      if (!direction) continue;

      const invoiceId = pay.Invoice?.InvoiceID || '';
      const contactName = pay.Invoice?.Contact?.Name || pay.ContactName || 'Unknown Contact';

      const isDuplicate = dedup.isPaymentDuplicate(paymentId);

      // Register IDs & composite keys if this is a primary unique event
      if (!isDuplicate) {
        dedup.registerPayment(paymentId, invoiceId);
        dedup.registerComposite(date, amount, contactName);
      }

      events.push({
        id: paymentId,
        source: 'Payment',
        direction,
        amount,
        date,
        currency: pay.Invoice?.CurrencyCode || 'USD',
        contact: contactName,
        linkedInvoice: invoiceId,
        linkedPayment: paymentId,
        verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
        isDuplicate,
        isVerified
      });
    }

    return events;
  }
}

export class BankTransactionResolver implements SourceResolver {
  public resolve(bankTxns: any[], dedup: DeduplicationResolver, verifier: VerificationResolver): UnifiedCashEvent[] {
    const events: UnifiedCashEvent[] = [];

    for (const txn of bankTxns) {
      const status = (txn.Status || '').toUpperCase();
      if (status !== 'AUTHORISED') continue;

      const txnType = (txn.Type || '').toUpperCase();
      let direction: 'IN' | 'OUT' | null = null;
      if (txnType === 'RECEIVE') direction = 'IN';
      else if (txnType === 'SPEND') direction = 'OUT';

      // Ignore Transfers and internal transactions
      if (!direction) continue;

      const txnId = txn.BankTransactionID || '';
      const amount = txn.Total || 0;
      const date = parseDate(txn.Date);
      if (!date) continue;

      const contactName = txn.Contact?.Name || 'Unknown Contact';
      const isVerified = verifier.resolveVerification(txn);
      const isDuplicate = dedup.isBankTxnDuplicate(txn);

      if (!isDuplicate) {
        dedup.registerBankTransaction(txnId);
        dedup.registerComposite(date, amount, contactName);
      }

      events.push({
        id: txnId,
        source: 'BankTransaction',
        direction,
        amount,
        date,
        currency: txn.CurrencyCode || 'USD',
        contact: contactName,
        linkedBankTransaction: txnId,
        verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
        isDuplicate,
        isVerified
      });
    }

    return events;
  }
}

export class PrepaymentResolver implements SourceResolver {
  public resolve(prepList: any[], dedup: DeduplicationResolver, verifier: VerificationResolver): UnifiedCashEvent[] {
    const events: UnifiedCashEvent[] = [];

    for (const prep of prepList) {
      const status = (prep.Status || '').toUpperCase();
      if (status !== 'AUTHORISED') continue;

      const prepType = (prep.Type || '').toUpperCase();
      let direction: 'IN' | 'OUT' | null = null;
      if (prepType === 'RECEIVE-PREPAYMENT') direction = 'IN';
      else if (prepType === 'SPEND-PREPAYMENT') direction = 'OUT';

      if (!direction) continue;

      const prepId = prep.PrepaymentID || '';
      const amount = prep.Total || 0;
      const date = parseDate(prep.Date);
      if (!date) continue;

      const contactName = prep.Contact?.Name || 'Unknown Contact';
      const isVerified = verifier.resolveVerification(prep);
      const isDuplicate = dedup.isPrepaymentDuplicate(prep);

      if (!isDuplicate) {
        dedup.registerPrepayment(prepId);
        dedup.registerComposite(date, amount, contactName);
      }

      events.push({
        id: prepId,
        source: 'Prepayment',
        direction,
        amount,
        date,
        currency: prep.CurrencyCode || 'USD',
        contact: contactName,
        verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
        isDuplicate,
        isVerified
      });
    }

    return events;
  }
}

export class OverpaymentResolver implements SourceResolver {
  public resolve(opList: any[], dedup: DeduplicationResolver, verifier: VerificationResolver): UnifiedCashEvent[] {
    const events: UnifiedCashEvent[] = [];

    for (const op of opList) {
      const status = (op.Status || '').toUpperCase();
      if (status !== 'AUTHORISED') continue;

      const opType = (op.Type || '').toUpperCase();
      let direction: 'IN' | 'OUT' | null = null;
      if (opType === 'RECEIVE-OVERPAYMENT') direction = 'IN';
      else if (opType === 'SPEND-OVERPAYMENT') direction = 'OUT';

      if (!direction) continue;

      const opId = op.OverpaymentID || '';
      const amount = op.Total || 0;
      const date = parseDate(op.Date);
      if (!date) continue;

      const contactName = op.Contact?.Name || 'Unknown Contact';
      const isVerified = verifier.resolveVerification(op);
      const isDuplicate = dedup.isOverpaymentDuplicate(op);

      if (!isDuplicate) {
        dedup.registerOverpayment(opId);
        dedup.registerComposite(date, amount, contactName);
      }

      events.push({
        id: opId,
        source: 'Overpayment',
        direction,
        amount,
        date,
        currency: op.CurrencyCode || 'USD',
        contact: contactName,
        verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
        isDuplicate,
        isVerified
      });
    }

    return events;
  }
}

// ============================================================================
// FINANCIAL EVENT RESOLVER (Main Coordinator)
// ============================================================================
export class FinancialEventResolver {
  private paymentResolver = new PaymentResolver();
  private bankTxnResolver = new BankTransactionResolver();
  private prepaymentResolver = new PrepaymentResolver();
  private overpaymentResolver = new OverpaymentResolver();
  private dedup = new DeduplicationResolver();
  private verifier = new VerificationResolver();

  public resolveAll(
    payments: any[],
    bankTxns: any[],
    prepList: any[],
    opList: any[]
  ): UnifiedCashEvent[] {
    // Process according to priorities to establish correct precedence
    const paymentEvents = this.paymentResolver.resolve(payments, this.dedup, this.verifier);
    const bankTxnEvents = this.bankTxnResolver.resolve(bankTxns, this.dedup, this.verifier);
    const prepEvents = this.prepaymentResolver.resolve(prepList, this.dedup, this.verifier);
    const opEvents = this.overpaymentResolver.resolve(opList, this.dedup, this.verifier);

    // Merge all events together into a unified stream
    return [...paymentEvents, ...bankTxnEvents, ...prepEvents, ...opEvents];
  }
}

// ============================================================================
// MAIN GET ROUTE HANDLER
// ============================================================================
export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({
        connected: false,
        summary: {
          cashIn: 0,
          cashOut: 0,
          netCashFlow: 0,
          incomingPaymentsCount: 0,
          outgoingPaymentsCount: 0,
          verifiedCashIn: 0,
          verifiedCashOut: 0,
          pendingVerificationAmount: 0,
          verificationPercentage: 0
        },
        breakdown: { cashInFromPayments: 0, cashInFromBankTxns: 0, cashInFromPrepayments: 0, cashInFromOverpayments: 0, duplicatesSkipped: 0 },
        sources: {
          payments: { count: 0, total: 0, enabled: false },
          bankTransactions: { count: 0, total: 0, enabled: false },
          prepayments: { count: 0, total: 0, enabled: false },
          overpayments: { count: 0, total: 0, enabled: false },
          bankTransfers: { count: 0, total: 0, enabled: false, reason: 'Internal movement' }
        },
        reconciliation: { reconciledCount: 0, pendingCount: 0, reconciledPercentage: 0, reconciledAmount: 0, pendingAmount: 0 },
        dataQuality: { paymentsImported: false, bankFeedImported: false, reconciliationRate: 0, duplicatesDetected: 0, pendingReview: 0, confidenceScore: 0 },
        meta: { calculatedAt: new Date().toISOString(), dataSourcesUsed: [], deduplicationMethod: 'None', totalRecordsProcessed: 0, totalRecordsSkipped: 0 },
        history: [],
        historyDetailed: []
      });
    }

    const calculatedAt = new Date().toISOString();

    // 1. Fetch raw API data from warehouse
    let payments = await db.getPayments(tenantId);
    let bankTransactions = await db.getBankTransactions(tenantId);
    let prepayments = await db.getPrepayments(tenantId);
    let overpayments = await db.getOverpayments(tenantId);

    // Dynamic Self-Healing Auto-Hydration fallback if database is empty but connected
    if (tokenInfo) {
      let hydratedAny = false;
      try {
        if (payments.length === 0) {
          console.log(`[Widget AutoSync] Payments empty. Hydrating for tenant ${tenantId}...`);
          const xeroPayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Payments');
          if (xeroPayments && xeroPayments.length > 0) {
            await db.saveCachedRecords(tenantId, 'payments', xeroPayments);
            payments = await db.getPayments(tenantId);
            hydratedAny = true;
          }
        }

        if (bankTransactions.length === 0) {
          console.log(`[Widget AutoSync] BankTransactions empty. Hydrating for tenant ${tenantId}...`);
          const xeroBankTxns = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BankTransactions');
          if (xeroBankTxns && xeroBankTxns.length > 0) {
            await db.saveReport(tenantId, 'BankTransactions', xeroBankTxns);
            bankTransactions = await db.getBankTransactions(tenantId);
            hydratedAny = true;
          }
        }

        if (prepayments.length === 0) {
          console.log(`[Widget AutoSync] Prepayments empty. Hydrating for tenant ${tenantId}...`);
          const xeroPrepayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Prepayments');
          if (xeroPrepayments && xeroPrepayments.length > 0) {
            await db.saveReport(tenantId, 'Prepayments', xeroPrepayments);
            prepayments = await db.getPrepayments(tenantId);
            hydratedAny = true;
          }
        }

        if (overpayments.length === 0) {
          console.log(`[Widget AutoSync] Overpayments empty. Hydrating for tenant ${tenantId}...`);
          const xeroOverpayments = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Overpayments');
          if (xeroOverpayments && xeroOverpayments.length > 0) {
            await db.saveReport(tenantId, 'Overpayments', xeroOverpayments);
            overpayments = await db.getOverpayments(tenantId);
            hydratedAny = true;
          }
        }

        if (hydratedAny) {
          console.log(`[Widget AutoSync] Hydration complete!`);
        }
      } catch (err: any) {
        console.error('[Widget AutoSync] Error during automated fallback hydration:', err.message);
      }
    }

    // 2. Resolve raw items into Unified Cash Events with duplicate checks and precedence rules
    const resolver = new FinancialEventResolver();
    const allEvents = resolver.resolveAll(payments, bankTransactions, prepayments, overpayments);

    // 3. Setup monthly aggregation buckets for past 12 months
    const now = new Date();
    const monthsData: {
      label: string;
      year: number;
      month: number;
      cashIn: number;
      cashOut: number;
      verifiedCashIn: number;
      verifiedCashOut: number;
      cashInFromPayments: number;
      cashInFromBankTxns: number;
      cashInFromPrepayments: number;
      cashInFromOverpayments: number;
      incomingCount: number;
      outgoingCount: number;
    }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' });
      monthsData.push({
        label,
        year: d.getFullYear(),
        month: d.getMonth(),
        cashIn: 0,
        cashOut: 0,
        verifiedCashIn: 0,
        verifiedCashOut: 0,
        cashInFromPayments: 0,
        cashInFromBankTxns: 0,
        cashInFromPrepayments: 0,
        cashInFromOverpayments: 0,
        incomingCount: 0,
        outgoingCount: 0
      });
    }

    // 4. Sort and assign only non-duplicate unique cash events into monthly buckets
    let duplicatesCount = 0;
    let totalIncomingUnique = 0;
    let totalOutgoingUnique = 0;

    for (const event of allEvents) {
      if (event.isDuplicate) {
        duplicatesCount++;
        continue;
      }

      const year = event.date.getFullYear();
      const month = event.date.getMonth();
      const matchedBucket = monthsData.find(m => m.year === year && m.month === month);

      if (matchedBucket) {
        if (event.direction === 'IN') {
          totalIncomingUnique++;
          matchedBucket.cashIn += event.amount;
          matchedBucket.incomingCount++;

          // Track specific sources
          if (event.source === 'Payment') matchedBucket.cashInFromPayments += event.amount;
          else if (event.source === 'BankTransaction') matchedBucket.cashInFromBankTxns += event.amount;
          else if (event.source === 'Prepayment') matchedBucket.cashInFromPrepayments += event.amount;
          else if (event.source === 'Overpayment') matchedBucket.cashInFromOverpayments += event.amount;

          // Track verification
          if (event.isVerified) {
            matchedBucket.verifiedCashIn += event.amount;
          }
        } else {
          totalOutgoingUnique++;
          matchedBucket.cashOut += event.amount;
          matchedBucket.outgoingCount++;

          if (event.isVerified) {
            matchedBucket.verifiedCashOut += event.amount;
          }
        }
      }
    }

    // 5. Aggregate final totals
    const totalCashIn = monthsData.reduce((sum, m) => sum + m.cashIn, 0);
    const totalCashOut = monthsData.reduce((sum, m) => sum + m.cashOut, 0);
    const totalVerifiedIn = monthsData.reduce((sum, m) => sum + m.verifiedCashIn, 0);
    const totalVerifiedOut = monthsData.reduce((sum, m) => sum + m.verifiedCashOut, 0);

    const pendingVerificationIn = totalCashIn - totalVerifiedIn;
    const pendingVerificationOut = totalCashOut - totalVerifiedOut;
    const totalPendingVerification = pendingVerificationIn + pendingVerificationOut;

    const verificationPercentage = totalCashIn > 0 ? Math.round((totalVerifiedIn / totalCashIn) * 100) : 100;

    const sourcePaymentTotal = allEvents.filter(e => !e.isDuplicate && e.source === 'Payment' && e.direction === 'IN').reduce((sum, e) => sum + e.amount, 0);
    const sourceBankTxnTotal = allEvents.filter(e => !e.isDuplicate && e.source === 'BankTransaction' && e.direction === 'IN').reduce((sum, e) => sum + e.amount, 0);
    const sourcePrepaymentTotal = allEvents.filter(e => !e.isDuplicate && e.source === 'Prepayment' && e.direction === 'IN').reduce((sum, e) => sum + e.amount, 0);
    const sourceOverpaymentTotal = allEvents.filter(e => !e.isDuplicate && e.source === 'Overpayment' && e.direction === 'IN').reduce((sum, e) => sum + e.amount, 0);

    const dataSourcesUsed = ['Payments', 'BankTransactions', 'Prepayments', 'Overpayments'];

    // 6. Build response
    const history = monthsData.map(m => ({
      month: m.label,
      cashIn: Math.round(m.cashIn * 100) / 100,
      cashOut: Math.round(m.cashOut * 100) / 100,
      netCashFlow: Math.round((m.cashIn - m.cashOut) * 100) / 100
    }));

    const historyDetailed = monthsData.map(m => ({
      month: m.label,
      cashIn: Math.round(m.cashIn * 100) / 100,
      cashOut: Math.round(m.cashOut * 100) / 100,
      netCashFlow: Math.round((m.cashIn - m.cashOut) * 100) / 100,
      cashInFromPayments: Math.round(m.cashInFromPayments * 100) / 100,
      cashInFromBankTxns: Math.round(m.cashInFromBankTxns * 100) / 100,
      cashInFromPrepayments: Math.round(m.cashInFromPrepayments * 100) / 100,
      cashInFromOverpayments: Math.round(m.cashInFromOverpayments * 100) / 100,
      reconciledIn: Math.round(m.verifiedCashIn * 100) / 100,
      pendingIn: Math.round((m.cashIn - m.verifiedCashIn) * 100) / 100
    }));

    // If no payment data exists, just return the real zero-valued data
    // (no fake/demo data — the UI will show actual zeros)

    return NextResponse.json({
      connected: true,
      summary: {
        cashIn: Math.round(totalCashIn * 100) / 100,
        cashOut: Math.round(totalCashOut * 100) / 100,
        netCashFlow: Math.round((totalCashIn - totalCashOut) * 100) / 100,
        incomingPaymentsCount: totalIncomingUnique,
        outgoingPaymentsCount: totalOutgoingUnique,
        verifiedCashIn: Math.round(totalVerifiedIn * 100) / 100,
        verifiedCashOut: Math.round(totalVerifiedOut * 100) / 100,
        pendingVerificationAmount: Math.round(totalPendingVerification * 100) / 100,
        verificationPercentage
      },
      breakdown: {
        cashInFromPayments: Math.round(sourcePaymentTotal * 100) / 100,
        cashInFromBankTxns: Math.round(sourceBankTxnTotal * 100) / 100,
        cashInFromPrepayments: Math.round(sourcePrepaymentTotal * 100) / 100,
        cashInFromOverpayments: Math.round(sourceOverpaymentTotal * 100) / 100,
        duplicatesSkipped: duplicatesCount
      },
      sources: {
        payments: { count: allEvents.filter(e => !e.isDuplicate && e.source === 'Payment' && e.direction === 'IN').length, total: Math.round(sourcePaymentTotal * 100) / 100, enabled: true },
        bankTransactions: { count: allEvents.filter(e => !e.isDuplicate && e.source === 'BankTransaction' && e.direction === 'IN').length, total: Math.round(sourceBankTxnTotal * 100) / 100, enabled: true },
        prepayments: { count: allEvents.filter(e => !e.isDuplicate && e.source === 'Prepayment' && e.direction === 'IN').length, total: Math.round(sourcePrepaymentTotal * 100) / 100, enabled: true },
        overpayments: { count: allEvents.filter(e => !e.isDuplicate && e.source === 'Overpayment' && e.direction === 'IN').length, total: Math.round(sourceOverpaymentTotal * 100) / 100, enabled: true },
        bankTransfers: { count: 0, total: 0, enabled: false, reason: 'Internal movement' }
      },
      reconciliation: {
        reconciledCount: allEvents.filter(e => !e.isDuplicate && e.isVerified).length,
        pendingCount: allEvents.filter(e => !e.isDuplicate && !e.isVerified).length,
        reconciledPercentage: verificationPercentage,
        reconciledAmount: Math.round((totalVerifiedIn + totalVerifiedOut) * 100) / 100,
        pendingAmount: Math.round(totalPendingVerification * 100) / 100
      },
      dataQuality: {
        paymentsImported: payments.length > 0,
        bankFeedImported: bankTransactions.length > 0,
        reconciliationRate: verificationPercentage,
        duplicatesDetected: duplicatesCount,
        pendingReview: allEvents.filter(e => !e.isDuplicate && !e.isVerified).length,
        confidenceScore: verificationPercentage
      },
      meta: {
        calculatedAt,
        dataSourcesUsed,
        deduplicationMethod: 'PaymentID + BankTransactionID + LinkedTransaction + CompositeKey',
        totalRecordsProcessed: allEvents.length,
        totalRecordsSkipped: duplicatesCount
      },
      events: allEvents.filter(e => !e.isDuplicate).map(e => ({
        id: e.id,
        source: e.source,
        direction: e.direction,
        amount: e.amount,
        date: e.date,
        contact: e.contact,
        isVerified: e.isVerified,
        currency: e.currency
      })),
      history,
      historyDetailed
    });

  } catch (err: any) {
    console.error('Cash Flow endpoint error:', err);
    return NextResponse.json({ connected: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
