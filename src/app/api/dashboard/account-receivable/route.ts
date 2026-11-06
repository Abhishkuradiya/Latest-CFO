import { NextRequest, NextResponse } from 'next/server';
import { db, parseXeroDate } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import { resolveBrandingTheme } from '@/lib/constants/brandingThemes';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const asOnDateStr = searchParams.get('as_on_date') || new Date().toISOString().split('T')[0];
  const search = (searchParams.get('search') || '').toLowerCase().trim();
  const customerFilter = (searchParams.get('customer') || 'ALL').toLowerCase().trim();
  const statusFilter = (searchParams.get('status') || 'ALL').toUpperCase();

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch Base Currency
    const orgReport = isConnected
      ? await getOrFetchManagementReport(
          tenantId,
          'Organisation',
          async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null,
        )
      : await db.getPostgresReport(tenantId, 'Organisation');
    const currency = orgReport?.raw_data?.BaseCurrency || orgReport?.BaseCurrency || orgReport?.CurrencyCode || null;

    // 2. DB-First Fetch: Avoid Xero Rate Limit by checking PostgreSQL first
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
        return t === 'ACCREC' || t === 'ACCRECCRED';
      })
      : [];

    const asOnDate = new Date(asOnDateStr);
    asOnDate.setHours(23, 59, 59, 999);

    // Filter strictly to Sales Invoices / Credit Notes issued ON or BEFORE asOnDate (Excluding DELETED, VOIDED, DRAFT)
    const accrecInvoices = rawInvoicesList.filter((inv: any) => {
      const t = (inv.Type || inv.type || '').toUpperCase();
      if (t !== 'ACCREC' && t !== 'ACCRECCRED') return false;

      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'DELETED' || st === 'VOIDED' || st === 'DRAFT') return false;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (invDate && invDate.getTime() > asOnDate.getTime()) {
        return false; // Exclude invoices issued after selected asOnDate
      }
      return true;
    });

    // Map & process invoice ageing (including negative balances for credit notes)
    const processedInvoices = accrecInvoices.map((inv: any) => {
      const st = (inv.Status || inv.status || 'DRAFT').toUpperCase();
      const t = (inv.Type || inv.type || 'ACCREC').toUpperCase();
      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const invDueDate = parseXeroDate(inv.DueDate || inv.due_date || inv.Date || inv.invoice_date);
      const total = parseFloat(inv.Total || inv.total || 0);
      
      let amountPaid = 0;
      if (st === 'PAID') {
        amountPaid = total;
      } else if (inv.AmountPaid !== undefined && inv.AmountPaid !== null) {
        amountPaid = parseFloat(inv.AmountPaid);
      } else if (inv.amount_paid !== undefined && inv.amount_paid !== null) {
        amountPaid = parseFloat(inv.amount_paid);
      }

      let rawAmountDue = 0;
      if (st === 'PAID' || (amountPaid >= total && total > 0)) {
        rawAmountDue = 0;
      } else if (inv.AmountDue !== undefined && inv.AmountDue !== null) {
        rawAmountDue = parseFloat(inv.AmountDue);
      } else if (inv.amount_due !== undefined && inv.amount_due !== null) {
        rawAmountDue = parseFloat(inv.amount_due);
      } else {
        rawAmountDue = Math.max(0, total - amountPaid);
      }

      const isCreditNote = t === 'ACCRECCRED' || t === 'CREDITNOTE';
      const amountDue = isCreditNote ? -Math.abs(rawAmountDue) : rawAmountDue;

      let displayStatus = st;
      if (isCreditNote) displayStatus = 'CREDIT NOTE';
      else if (st === 'AUTHORISED') displayStatus = 'AWAITING PAYMENT';
      else if (st === 'SUBMITTED') displayStatus = 'AWAITING APPROVAL';

      // Ageing calculation relative to asOnDate
      let daysOverdue = 0;
      let ageingBucket: 'current' | '1-30' | '31-60' | '61-90' | '90+' = 'current';

      if (invDueDate && Math.abs(amountDue) > 0.001 && st !== 'PAID' && st !== 'DRAFT' && st !== 'DELETED' && st !== 'VOIDED') {
        const diffMs = asOnDate.getTime() - invDueDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          daysOverdue = diffDays;
          if (diffDays <= 30) ageingBucket = '1-30';
          else if (diffDays <= 60) ageingBucket = '31-60';
          else if (diffDays <= 90) ageingBucket = '61-90';
          else ageingBucket = '90+';
        }
      }

      return {
        id: inv.InvoiceID || inv.external_id || inv.id || inv.InvoiceNumber || inv.invoice_number,
        invoiceNumber: inv.InvoiceNumber || inv.invoice_number || (isCreditNote ? 'CN-CREDIT' : '—'),
        contactName: inv.Contact?.Name || inv.ContactName || inv.contact_name || 'Unknown Customer',
        contactId: inv.Contact?.ContactID || inv.contact_id || '',
        status: displayStatus,
        rawStatus: st,
        type: t,
        date: invDate ? invDate.toISOString() : null,
        dueDate: invDueDate ? invDueDate.toISOString() : null,
        total: isCreditNote ? -Math.abs(total) : total,
        subTotal: inv.SubTotal !== undefined ? parseFloat(inv.SubTotal) : (inv.sub_total !== undefined ? parseFloat(inv.sub_total) : (inv.subTotal !== undefined ? parseFloat(inv.subTotal) : undefined)),
        totalTax: inv.TotalTax !== undefined ? parseFloat(inv.TotalTax) : (inv.total_tax !== undefined ? parseFloat(inv.total_tax) : (inv.totalTax !== undefined ? parseFloat(inv.totalTax) : undefined)),
        amountDue,
        amountPaid,
        daysOverdue,
        ageingBucket,
        reference: inv.Reference || inv.reference || '—',
        currency: inv.CurrencyCode || inv.currency || currency,
        brandingTheme: resolveBrandingTheme(inv),
        lineItems: Array.isArray(inv.LineItems || inv.line_items || inv.lineItems)
          ? (inv.LineItems || inv.line_items || inv.lineItems).map((item: any) => ({
              Description: item.Description || item.description || item.desc || item.ItemCode || 'Line Item',
              description: item.Description || item.description || item.desc || item.ItemCode || 'Line Item',
              Quantity: parseFloat(item.Quantity || item.quantity || 1),
              quantity: parseFloat(item.Quantity || item.quantity || 1),
              UnitAmount: parseFloat(item.UnitAmount || item.unit_amount || item.unitAmount || 0),
              unitAmount: parseFloat(item.UnitAmount || item.unit_amount || item.unitAmount || 0),
              LineAmount: parseFloat(item.LineAmount || item.line_amount || item.lineAmount || 0),
              lineAmount: parseFloat(item.LineAmount || item.line_amount || item.lineAmount || 0),
              AccountCode: item.AccountCode || item.accountCode || item.account_code || '',
              accountCode: item.AccountCode || item.accountCode || item.account_code || '',
              TaxType: item.TaxType || item.taxType || item.tax_type || '',
              taxType: item.TaxType || item.taxType || item.tax_type || '',
              TaxAmount: parseFloat(item.TaxAmount || item.taxAmount || item.tax_amount || 0),
              taxAmount: parseFloat(item.TaxAmount || item.taxAmount || item.tax_amount || 0)
            }))
          : [],
        attachments: inv.Attachments || inv.attachments || []
      };
    });

    // Unpaid & Active Receivables (Including negative credit notes, strictly excluding PAID, VOIDED, DELETED, DRAFT)
    const activeReceivables = processedInvoices.filter(inv => 
      Math.abs(inv.amountDue) > 0.001 && 
      inv.rawStatus !== 'PAID' && 
      inv.rawStatus !== 'VOIDED' && 
      inv.rawStatus !== 'DELETED' && 
      inv.rawStatus !== 'DRAFT' &&
      (Math.abs(inv.total) > 0 ? inv.amountPaid < Math.abs(inv.total) : true)
    );

    // KPI Summary Calculations
    let totalReceivables = 0;
    let currentNotDue = 0;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90Plus = 0;
    let overdueInvoicesCount = 0;

    activeReceivables.forEach(inv => {
      totalReceivables += inv.amountDue;
      if (inv.daysOverdue <= 0) {
        currentNotDue += inv.amountDue;
      } else {
        overdueInvoicesCount++;
        if (inv.daysOverdue <= 30) days1to30 += inv.amountDue;
        else if (inv.daysOverdue <= 60) days31to60 += inv.amountDue;
        else if (inv.daysOverdue <= 90) days61to90 += inv.amountDue;
        else days90Plus += inv.amountDue;
      }
    });

    const getPct = (val: number) => totalReceivables > 0 ? ((val / totalReceivables) * 100).toFixed(2) : null;

    const kpiSummary = {
      totalReceivables: { amount: totalReceivables, pct: totalReceivables > 0 ? '100.00' : null },
      currentNotDue: { amount: currentNotDue, pct: getPct(currentNotDue) },
      days1to30: { amount: days1to30, pct: getPct(days1to30) },
      days31to60: { amount: days31to60, pct: getPct(days31to60) },
      days61to90: { amount: days61to90, pct: getPct(days61to90) },
      days90Plus: { amount: days90Plus, pct: getPct(days90Plus) },
      overdueInvoices: { count: overdueInvoicesCount, totalOverdue: totalReceivables - currentNotDue }
    };

    // Receivables Trend (Last 6 Months)
    const monthLabels: string[] = [];
    const trendSeries = {
      current: [0, 0, 0, 0, 0, 0],
      days1to30: [0, 0, 0, 0, 0, 0],
      days31to60: [0, 0, 0, 0, 0, 0],
      days61to90: [0, 0, 0, 0, 0, 0],
      days90Plus: [0, 0, 0, 0, 0, 0]
    };

    for (let i = 5; i >= 0; i--) {
      const d = new Date(asOnDate.getFullYear(), asOnDate.getMonth() - i, 1);
      monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      const mIdx = 5 - i;
      const targetMonthYear = `${d.getFullYear()}-${d.getMonth()}`;

      processedInvoices.forEach(inv => {
        if (!inv.date) return;
        const invD = new Date(inv.date);
        if (`${invD.getFullYear()}-${invD.getMonth()}` === targetMonthYear) {
          if (inv.ageingBucket === 'current') trendSeries.current[mIdx] += inv.amountDue;
          else if (inv.ageingBucket === '1-30') trendSeries.days1to30[mIdx] += inv.amountDue;
          else if (inv.ageingBucket === '31-60') trendSeries.days31to60[mIdx] += inv.amountDue;
          else if (inv.ageingBucket === '61-90') trendSeries.days61to90[mIdx] += inv.amountDue;
          else if (inv.ageingBucket === '90+') trendSeries.days90Plus[mIdx] += inv.amountDue;
        }
      });
    }

    // Top Overdue Invoices (Sorted by daysOverdue descending)
    const topOverdueInvoices = activeReceivables
      .filter(inv => inv.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);

    // Customer Aggregation Table (Exact Ageing Bucket Netting)
    const customerMap = new Map<string, {
      customerName: string;
      totalInvoices: number;
      totalReceivables: number;
      currentNotDue: number;
      days1to30: number;
      days31to60: number;
      days61to90: number;
      days90Plus: number;
      overdueCount: number;
      invoices: any[];
    }>();

    activeReceivables.forEach(inv => {
      const name = inv.contactName;
      if (!customerMap.has(name)) {
        customerMap.set(name, {
          customerName: name,
          totalInvoices: 0,
          totalReceivables: 0,
          currentNotDue: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days90Plus: 0,
          overdueCount: 0,
          invoices: []
        });
      }
      const cust = customerMap.get(name)!;
      cust.totalInvoices++;
      cust.totalReceivables += inv.amountDue;
      cust.invoices.push(inv);

      if (inv.daysOverdue > 0 && inv.amountDue > 0) {
        cust.overdueCount++;
      }

      if (inv.ageingBucket === 'current') {
        cust.currentNotDue += inv.amountDue;
      } else if (inv.ageingBucket === '1-30') {
        cust.days1to30 += inv.amountDue;
      } else if (inv.ageingBucket === '31-60') {
        cust.days31to60 += inv.amountDue;
      } else if (inv.ageingBucket === '61-90') {
        cust.days61to90 += inv.amountDue;
      } else if (inv.ageingBucket === '90+') {
        cust.days90Plus += inv.amountDue;
      }
    });

    let customerSummaryList = Array.from(customerMap.values()).map(cust => {
      const totalOverdue = cust.days1to30 + cust.days31to60 + cust.days61to90 + cust.days90Plus;
      const pctOverdue = cust.totalReceivables > 0 ? parseFloat(((totalOverdue / cust.totalReceivables) * 100).toFixed(2)) : 0;
      return {
        ...cust,
        pctOverdue
      };
    });

    // Apply Search & Customer Filters
    if (search) {
      customerSummaryList = customerSummaryList.filter(c =>
        c.customerName.toLowerCase().includes(search) ||
        c.invoices.some((inv: any) => inv.invoiceNumber.toLowerCase().includes(search))
      );
    }
    if (customerFilter !== 'all' && customerFilter !== '') {
      customerSummaryList = customerSummaryList.filter(c => c.customerName.toLowerCase().includes(customerFilter));
    }

    // Sort customer list by totalReceivables descending
    customerSummaryList.sort((a, b) => b.totalReceivables - a.totalReceivables);

    // Collection Efficiency & Quick Insights
    const totalIssued = processedInvoices.reduce((acc, inv) => acc + inv.total, 0);
    const totalCollected = processedInvoices.reduce((acc, inv) => acc + inv.amountPaid, 0);
    const collectionRate = totalIssued > 0 ? parseFloat(((totalCollected / totalIssued) * 100).toFixed(1)) : null;

    const quickInsights = [
      {
        type: 'success',
        title: 'Receivables due within 30 days',
        amount: days1to30,
        text: getPct(days1to30) === null ? 'Not available' : `${getPct(days1to30)}% of receivables are due within 30 days.`
      },
      {
        type: 'warning',
        title: 'Overdue Invoices',
        count: overdueInvoicesCount,
        amount: totalReceivables - currentNotDue,
        text: currency === null
          ? 'Not available'
          : `${overdueInvoicesCount} Invoices (${currency} ${(totalReceivables - currentNotDue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) are overdue and require attention.`
      },
      {
        type: 'danger',
        title: 'High Risk (90+ Days)',
        amount: days90Plus,
        text: getPct(days90Plus) === null ? 'Not available' : `${getPct(days90Plus)}% of receivables are 90+ days overdue.`
      }
    ];

    // Top 5 Customers by Total Receivables Exposure
    const topOverdueCustomers = customerSummaryList
      .map(cust => {
        const overdueAmount = cust.days1to30 + cust.days31to60 + cust.days61to90 + cust.days90Plus;
        return {
          customerName: cust.customerName,
          totalReceivables: cust.totalReceivables,
          overdueAmount,
          overdueCount: cust.overdueCount,
          totalInvoices: cust.totalInvoices,
          pctOverdue: cust.pctOverdue
        };
      })
      .slice(0, 5);

    return NextResponse.json({
      asOnDate: asOnDateStr,
      meta: { currency, totalActiveInvoices: activeReceivables.length, dataAvailable: storedInvoices !== null },
      summary: kpiSummary,
      ageingDistribution: [
        { key: 'current', label: 'Current (Not Due)', amount: currentNotDue, pct: getPct(currentNotDue), color: '#2563eb' },
        { key: '1-30', label: '1 - 30 Days', amount: days1to30, pct: getPct(days1to30), color: '#eab308' },
        { key: '31-60', label: '31 - 60 Days', amount: days31to60, pct: getPct(days31to60), color: '#f97316' },
        { key: '61-90', label: '61 - 90 Days', amount: days61to90, pct: getPct(days61to90), color: '#ef4444' },
        { key: '90+', label: '90+ Days', amount: days90Plus, pct: getPct(days90Plus), color: '#991b1b' }
      ],
      trend: {
        labels: monthLabels,
        series: trendSeries
      },
      topOverdueInvoices,
      topOverdueCustomers,
      customerSummary: customerSummaryList,
      allReceivableInvoices: activeReceivables,
      collectionEfficiency: {
        rate: collectionRate,
        status: collectionRate === null ? 'Not available' : collectionRate >= 75 ? 'Good' : collectionRate >= 50 ? 'Fair' : 'Needs Attention',
        vsLastMonth: null
      },
      quickInsights
    });
  } catch (err: any) {
    console.error('Account Receivable API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
