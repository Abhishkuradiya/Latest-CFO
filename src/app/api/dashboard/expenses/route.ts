import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  let tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    tenantId = 3; // Fallback demo tenant ID
  }

  const { searchParams } = new URL(req.url);
  const fromDateStr = searchParams.get('fromDate');
  const toDateStr = searchParams.get('toDate');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // 1. Fetch Organisation Base Currency
    let orgReport = await db.getReport(tenantId, 'Organisation');
    if (!orgReport && isConnected) {
      try {
        const rawOrg = await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisation');
        if (rawOrg && rawOrg.length > 0) {
          orgReport = rawOrg[0];
          await db.saveReport(tenantId, 'Organisation', orgReport);
        }
      } catch (err: any) {
        console.error('Failed to sync Organisation report:', err.message);
      }
    }
    const currency = orgReport?.raw_data?.BaseCurrency || orgReport?.BaseCurrency || orgReport?.CurrencyCode || 'GBP';
    const orgName = orgReport?.Name || orgReport?.LegalName || orgReport?.raw_data?.Name || orgReport?.raw_data?.LegalName || 'Connected Organisation';

    // 2. Fetch ACCPAY Invoices (Bills) from Xero API or PostgreSQL Database
    let rawBillsList: any[] = [];
    if (isConnected) {
      try {
        const xeroAuthorisedBills = await fetchXeroResource(
          tokenInfo.accessToken,
          tokenInfo.xeroTenantId,
          'Invoices',
          'where=Type=="ACCPAY"'
        );
        if (Array.isArray(xeroAuthorisedBills) && xeroAuthorisedBills.length > 0) {
          rawBillsList = xeroAuthorisedBills;
        }
      } catch (err: any) {
        console.error('Failed to fetch Xero ACCPAY bills:', err.message);
      }
    }

    // Fallback to PostgreSQL saved reports if API live call has no items
    if (rawBillsList.length === 0) {
      const reportInvoices = await db.getReport(tenantId, 'Invoices');
      if (Array.isArray(reportInvoices)) {
        rawBillsList = reportInvoices.filter((inv: any) => inv.Type === 'ACCPAY' || inv.type === 'ACCPAY');
      }
    }

    // Parse date filter parameters
    let fromDate = fromDateStr ? new Date(fromDateStr) : null;
    let toDate = toDateStr ? new Date(toDateStr) : null;

    // Calculate previous period dates for comparison mode if dates are supplied
    let prevFromDate: Date | null = null;
    let prevToDate: Date | null = null;
    if (fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      const diffMs = toDate.getTime() - fromDate.getTime();
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      prevToDate = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
      prevFromDate = new Date(prevToDate.getTime() - (diffDays * 24 * 60 * 60 * 1000));
    }

    // 3. Process & Categorize Purchases & Expenses
    const expensesList: any[] = [];
    const prevExpensesList: any[] = [];

    let totalPurchasesAmount = 0;
    let directCogsAmount = 0;
    let indirectOpexAmount = 0;
    let recurringSaasAmount = 0;
    let pendingOverdueAmount = 0;

    let prevTotalPurchasesAmount = 0;
    let prevDirectCogsAmount = 0;
    let prevIndirectOpexAmount = 0;
    let prevRecurringSaasAmount = 0;
    let prevPendingOverdueAmount = 0;

    const vendorMap: Record<string, { vendorName: string; totalAmount: number; count: number }> = {};
    const categoryMap: Record<string, number> = {
      'Direct COGS': 0,
      'SaaS & Software': 0,
      'Rent & Facilities': 0,
      'Marketing & Ads': 0,
      'Logistics & Freight': 0,
      'Professional Fees': 0,
      'Utilities & Admin': 0
    };

    const deptMap: Record<string, number> = {
      'Procurement': 0,
      'IT & Engineering': 0,
      'Marketing': 0,
      'Operations': 0,
      'Executive & HR': 0,
      'Sales': 0
    };

    const monthlyTrajectoryMap: Record<string, { cogs: number; opex: number; prevTotal?: number }> = {};

const parseXeroDate = (rawDate: any): { dateObj: Date; dateStr: string } => {
  if (!rawDate) {
    const now = new Date();
    return { dateObj: now, dateStr: now.toISOString().split('T')[0] };
  }
  if (typeof rawDate === 'string' && rawDate.includes('/Date(')) {
    const msStr = rawDate.replace(/[^0-9-]/g, '');
    const ms = parseInt(msStr, 10);
    if (!isNaN(ms)) {
      const d = new Date(ms);
      return { dateObj: d, dateStr: d.toISOString().split('T')[0] };
    }
  }
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return { dateObj: d, dateStr: d.toISOString().split('T')[0] };
  }
  const now = new Date();
  return { dateObj: now, dateStr: now.toISOString().split('T')[0] };
};

    if (rawBillsList.length > 0) {
      rawBillsList.forEach((bill: any, idx: number) => {
        const status = (bill.Status || bill.status || 'AUTHORISED').toUpperCase();
        if (status === 'DELETED' || status === 'VOIDED' || status === 'DRAFT') return;

        const { dateObj, dateStr } = parseXeroDate(bill.DateString || bill.Date || bill.date);
        const { dateStr: dueDateStr } = parseXeroDate(bill.DueDateString || bill.DueDate || bill.dueDate || dateStr);

        const vendorName = bill.Contact?.Name || bill.contactName || 'Vendor Supplier';
        const billNumber = bill.InvoiceNumber || bill.invoiceNumber || `BILL-${1000 + idx}`;
        const reference = bill.Reference || bill.reference || '—';
        const amount = Math.abs(parseFloat(bill.Total || bill.total || bill.AmountDue || bill.amountDue || 0));
        const amountDue = Math.abs(parseFloat(bill.AmountDue || bill.amountDue || bill.Total || bill.total || 0));

        // Check if bill falls within Current Period vs Previous Period
        let isCurrentPeriod = true;
        let isPrevPeriod = false;

        if (fromDate && !isNaN(fromDate.getTime()) && dateObj < fromDate) isCurrentPeriod = false;
        if (toDate && !isNaN(toDate.getTime()) && dateObj > toDate) isCurrentPeriod = false;

        if (prevFromDate && prevToDate) {
          if (dateObj >= prevFromDate && dateObj <= prevToDate) {
            isPrevPeriod = true;
          }
        }

        // Determine if Direct COGS vs Indirect Opex
        let category: 'Direct COGS' | 'SaaS & Software' | 'Rent & Facilities' | 'Marketing & Ads' | 'Logistics & Freight' | 'Professional Fees' | 'Utilities & Admin' = 'Utilities & Admin';
        let department: 'Procurement' | 'IT & Engineering' | 'Marketing' | 'Operations' | 'Executive & HR' | 'Sales' = 'Operations';

        const lineItems = bill.LineItems || bill.lineItems || [];
        const firstAccountType = (lineItems[0]?.AccountType || '').toUpperCase();
        const description = (lineItems[0]?.Description || billNumber + ' ' + vendorName).toLowerCase();

        // Categorization Rules based on AccountType, Vendor Name, Account Code & Description
        const vendorLower = vendorName.toLowerCase();
        const accountCode = (lineItems[0]?.AccountCode || '').toUpperCase();
        
        if (
          firstAccountType === 'DIRECTCOSTS' || 
          firstAccountType === 'INVENTORY' || 
          accountCode.startsWith('3') || 
          vendorLower.includes('sigma') || 
          vendorLower.includes('alliance healthcare') || 
          vendorLower.includes('bestway') || 
          vendorLower.includes('phoenix medical') || 
          description.includes('pharmaceutical') || 
          description.includes('stock') || 
          description.includes('medical') || 
          description.includes('pharma') || 
          description.includes('procurement')
        ) {
          category = 'Direct COGS';
          department = 'Procurement';
        } else if (
          vendorLower.includes('aws') || 
          vendorLower.includes('amazon web services') || 
          vendorLower.includes('microsoft') || 
          vendorLower.includes('salesforce') || 
          description.includes('cloud') || 
          description.includes('software') || 
          description.includes('saas') || 
          description.includes('license') || 
          description.includes('subscription')
        ) {
          category = 'SaaS & Software';
          department = 'IT & Engineering';
        } else if (
          vendorLower.includes('real estate') || 
          vendorLower.includes('canary wharf') || 
          description.includes('rent') || 
          description.includes('lease') || 
          description.includes('facility') || 
          description.includes('estate')
        ) {
          category = 'Rent & Facilities';
          department = 'Executive & HR';
        } else if (
          vendorLower.includes('google') || 
          vendorLower.includes('facebook') || 
          vendorLower.includes('meta') || 
          description.includes('ads') || 
          description.includes('marketing') || 
          description.includes('campaign')
        ) {
          category = 'Marketing & Ads';
          department = 'Marketing';
        } else if (
          vendorLower.includes('dhl') || 
          vendorLower.includes('fedex') || 
          vendorLower.includes('ups') || 
          vendorLower.includes('royal mail') || 
          description.includes('freight') || 
          description.includes('shipping') || 
          description.includes('courier') || 
          description.includes('logistics')
        ) {
          category = 'Logistics & Freight';
          department = 'Operations';
        } else if (
          vendorLower.includes('kpmg') || 
          vendorLower.includes('deloitte') || 
          vendorLower.includes('pwc') || 
          vendorLower.includes('ey') || 
          vendorLower.includes('insurance') || 
          vendorLower.includes('legal') || 
          description.includes('audit') || 
          description.includes('advisory') || 
          description.includes('insurance') || 
          description.includes('consulting')
        ) {
          category = 'Professional Fees';
          department = 'Executive & HR';
        } else {
          category = 'Utilities & Admin';
          department = 'Operations';
        }

        const isRecurring = category === 'SaaS & Software' || category === 'Rent & Facilities' || description.includes('subscription');

        let uiStatus: 'Paid' | 'Pending Approval' | 'Overdue' | 'Scheduled' = 'Paid';
        if (status === 'PAID' || amountDue === 0) {
          uiStatus = 'Paid';
        } else if (status === 'SUBMITTED') {
          uiStatus = 'Pending Approval';
        } else {
          const due = new Date(dueDateStr);
          if (due.getTime() < Date.now()) {
            uiStatus = 'Overdue';
          } else {
            uiStatus = 'Scheduled';
          }
        }

        // Process Previous Period metrics
        if (isPrevPeriod) {
          prevTotalPurchasesAmount += amount;
          if (category === 'Direct COGS') prevDirectCogsAmount += amount;
          else prevIndirectOpexAmount += amount;
          if (isRecurring) prevRecurringSaasAmount += amount;
          if (uiStatus === 'Overdue' || uiStatus === 'Pending Approval') prevPendingOverdueAmount += amount;
          prevExpensesList.push({ id: bill.InvoiceID || `PREV-${idx}`, amount, category, date: dateStr });
        }

        // Process Current Period metrics
        if (isCurrentPeriod) {
          totalPurchasesAmount += amount;
          if (category === 'Direct COGS') {
            directCogsAmount += amount;
          } else {
            indirectOpexAmount += amount;
          }

          if (isRecurring) recurringSaasAmount += amount;
          if (uiStatus === 'Overdue' || uiStatus === 'Pending Approval') pendingOverdueAmount += amount;

          // Vendor aggregation
          if (!vendorMap[vendorName]) {
            vendorMap[vendorName] = { vendorName, totalAmount: 0, count: 0 };
          }
          vendorMap[vendorName].totalAmount += amount;
          vendorMap[vendorName].count += 1;

          // Category & Dept Maps
          categoryMap[category] = (categoryMap[category] || 0) + amount;
          deptMap[department] = (deptMap[department] || 0) + amount;

          // Monthly Trajectory
          const monthKey = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Sep 2026';
          if (!monthlyTrajectoryMap[monthKey]) {
            monthlyTrajectoryMap[monthKey] = { cogs: 0, opex: 0, prevTotal: 0 };
          }
          if (category === 'Direct COGS') {
            monthlyTrajectoryMap[monthKey].cogs += amount;
          } else {
            monthlyTrajectoryMap[monthKey].opex += amount;
          }

          expensesList.push({
            id: bill.InvoiceID || `EXP-${idx + 1}`,
            date: dateStr,
            dueDate: dueDateStr,
            vendorName,
            billNumber,
            reference,
            category,
            department,
            amount,
            status: uiStatus,
            recurring: isRecurring
          });
        }
      });
    }

    // Sort Top Vendors
    const topVendors = Object.values(vendorMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // Calculate Variance Percentages
    const calcVariance = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    };

    return NextResponse.json({
      connected: isConnected,
      currency,
      orgName,
      dateRange: {
        fromDate: fromDateStr || null,
        toDate: toDateStr || null,
        prevFromDate: prevFromDate ? prevFromDate.toISOString().split('T')[0] : null,
        prevToDate: prevToDate ? prevToDate.toISOString().split('T')[0] : null,
      },
      summary: {
        totalExpenses: totalPurchasesAmount,
        directCogs: directCogsAmount,
        indirectOpex: indirectOpexAmount,
        recurringSpend: recurringSaasAmount,
        pendingAmount: pendingOverdueAmount,
        totalCount: expensesList.length
      },
      prevSummary: {
        totalExpenses: prevTotalPurchasesAmount,
        directCogs: prevDirectCogsAmount,
        indirectOpex: prevIndirectOpexAmount,
        recurringSpend: prevRecurringSaasAmount,
        pendingAmount: prevPendingOverdueAmount,
        totalCount: prevExpensesList.length
      },
      variance: {
        totalExpensesPct: calcVariance(totalPurchasesAmount, prevTotalPurchasesAmount),
        directCogsPct: calcVariance(directCogsAmount, prevDirectCogsAmount),
        indirectOpexPct: calcVariance(indirectOpexAmount, prevIndirectOpexAmount),
        recurringSpendPct: calcVariance(recurringSaasAmount, prevRecurringSaasAmount),
        pendingAmountPct: calcVariance(pendingOverdueAmount, prevPendingOverdueAmount)
      },
      categoryBreakdown: categoryMap,
      departmentBreakdown: deptMap,
      topVendors,
      monthlyTrajectory: monthlyTrajectoryMap,
      expenses: expensesList
    });
  } catch (err: any) {
    console.error('Expenses Live API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to query expenses from PostgreSQL' }, { status: 500 });
  }
}
