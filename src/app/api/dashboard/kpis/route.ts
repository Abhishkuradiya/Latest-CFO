import { NextRequest, NextResponse } from 'next/server';
import { db, parseXeroDate } from '@/lib/db';
import { getXeroAccessToken, fetchXeroReport } from '@/lib/xero';
import { BalanceSheetParser } from '@/lib/services/BalanceSheetParser';
import { getTenantIdFromSession } from '@/lib/auth';
import { getDefaultDateRange } from '@/lib/date-defaults';

function findCurrentLiabilities(rows: any[]): number {
  return BalanceSheetParser.findSummary(rows, 'total current liabilities') ||
         BalanceSheetParser.findSummary(rows, 'current liabilities') ||
         BalanceSheetParser.findSummary(rows, 'total liabilities') || 0;
}

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    if (!tokenInfo) {
      return NextResponse.json({
        workingCapital: { value: 0, trend: 0, history: [] },
        overdueReceivables: { value: 0, percentage: 0, history: [] },
        outstandingBills: { value: 0, percentage: 0, history: [] },
        collectionRate: { value: 0, trend: 0, history: [] },
        averageCollectionDays: { value: 0, difference: 0, history: [] },
        averagePaymentDays: { value: 0, difference: 0, history: [] }
      });
    }
    const cachedInvoices = await db.getInvoices(tenantId);
    const cachedPayments = await db.getPayments(tenantId);

    // 1. Dates Logic
    const fromDateParam = searchParams.get('from_date');
    const toDateParam = searchParams.get('to_date');

    let startDate: Date;
    let endDate: Date;

    if (fromDateParam && toDateParam) {
      startDate = new Date(fromDateParam);
      endDate = new Date(toDateParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const defaultDates = getDefaultDateRange();
      startDate = new Date(defaultDates.startDate);
      endDate = new Date(defaultDates.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const toDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Comparison period logic
    const durationMs = endDate.getTime() - startDate.getTime();
    const compEndDate = new Date(startDate.getTime() - 1);
    const compStartDate = new Date(compEndDate.getTime() - durationMs);
    const compDateStr = `${compEndDate.getFullYear()}-${String(compEndDate.getMonth() + 1).padStart(2, '0')}-${String(compEndDate.getDate()).padStart(2, '0')}`;

    // Balance Sheets
    let bsReport = await db.getReport(tenantId, `BalanceSheet_${toDateStr}`);
    if (!bsReport && tokenInfo) {
      try {
        bsReport = await fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${toDateStr}`);
        if (bsReport) await db.saveReport(tenantId, `BalanceSheet_${toDateStr}`, bsReport);
      } catch (e) {}
    }

    let compBsReport = await db.getReport(tenantId, `BalanceSheet_${compDateStr}`);
    if (!compBsReport && tokenInfo) {
      try {
        compBsReport = await fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${compDateStr}`);
        if (compBsReport) await db.saveReport(tenantId, `BalanceSheet_${compDateStr}`, compBsReport);
      } catch (e) {}
    }

    // ==================================================
    // KPI 1: Working Capital
    // ==================================================
    const totalBank = bsReport ? (BalanceSheetParser.findTotalCash(bsReport.Rows) || 0) : 0;
    const currentAssets = bsReport ? (BalanceSheetParser.findCurrentAssets(bsReport.Rows) || 0) : 0;
    const currentLiabilities = bsReport ? findCurrentLiabilities(bsReport.Rows) : 0;
    const workingCapitalValue = (totalBank + currentAssets) - currentLiabilities;

    const compTotalBank = compBsReport ? (BalanceSheetParser.findTotalCash(compBsReport.Rows) || 0) : 0;
    const compAssets = compBsReport ? (BalanceSheetParser.findCurrentAssets(compBsReport.Rows) || 0) : 0;
    const compLiabilities = compBsReport ? findCurrentLiabilities(compBsReport.Rows) : 0;
    const compWorkingCapital = (compTotalBank + compAssets) - compLiabilities;

    let workingCapitalTrend = 0;
    if (compWorkingCapital !== 0) {
      workingCapitalTrend = parseFloat((((workingCapitalValue - compWorkingCapital) / Math.abs(compWorkingCapital)) * 100).toFixed(1));
    }

    // Last 6 Months Working Capital History
    const workingCapitalHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const dStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      let histReport = await db.getReport(tenantId, `BalanceSheet_${dStr}`);
      if (!histReport && tokenInfo) {
        try {
          histReport = await fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'BalanceSheet', `date=${dStr}`);
          if (histReport) await db.saveReport(tenantId, `BalanceSheet_${dStr}`, histReport);
        } catch (e) {}
      }
      const bank = histReport ? (BalanceSheetParser.findTotalCash(histReport.Rows) || 0) : 0;
      const assets = histReport ? (BalanceSheetParser.findCurrentAssets(histReport.Rows) || 0) : 0;
      const liabilities = histReport ? findCurrentLiabilities(histReport.Rows) : 0;
      workingCapitalHistory.push((bank + assets) - liabilities);
    }

    // ==================================================
    // KPI 2: Overdue Receivables
    // ==================================================
    const overdueInvoices = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCREC' || inv.Status !== 'AUTHORISED') return false;
      const invDate = parseXeroDate(inv.Date);
      const invDueDate = parseXeroDate(inv.DueDate);
      return invDate && invDate <= endDate && invDueDate && invDueDate < endDate && (inv.AmountDue || 0) > 0;
    });

    const overdueReceivablesValue = overdueInvoices.reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);

    const totalAR = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCREC' || inv.Status !== 'AUTHORISED') return false;
      const invDate = parseXeroDate(inv.Date);
      return invDate && invDate <= endDate;
    }).reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);

    const overdueReceivablesPercentage = totalAR > 0 ? parseFloat(((overdueReceivablesValue / totalAR) * 100).toFixed(0)) : 0;

    // Last 6 Months Overdue Receivables History
    const overdueHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const val = cachedInvoices.filter(inv => {
        if (inv.Type !== 'ACCREC' || inv.Status !== 'AUTHORISED') return false;
        const invDate = parseXeroDate(inv.Date);
        const invDueDate = parseXeroDate(inv.DueDate);
        return invDate && invDate <= lastDay && invDueDate && invDueDate < lastDay && (inv.AmountDue || 0) > 0;
      }).reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);
      overdueHistory.push(val);
    }

    // ==================================================
    // KPI 3: Outstanding Bills
    // ==================================================
    const outstandingBillsValue = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCPAY' || inv.Status !== 'AUTHORISED') return false;
      const invDate = parseXeroDate(inv.Date);
      return invDate && invDate <= endDate && (inv.AmountDue || 0) > 0;
    }).reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);

    const totalAP = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCPAY') return false;
      const invDate = parseXeroDate(inv.Date);
      return invDate && invDate <= endDate;
    }).reduce((sum, inv) => sum + (inv.Total || 0), 0);

    const outstandingBillsPercentage = totalAP > 0 ? parseFloat(((outstandingBillsValue / totalAP) * 100).toFixed(0)) : 0;

    // Last 6 Months Outstanding Bills History
    const outstandingBillsHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const val = cachedInvoices.filter(inv => {
        if (inv.Type !== 'ACCPAY' || inv.Status !== 'AUTHORISED') return false;
        const invDate = parseXeroDate(inv.Date);
        return invDate && invDate <= lastDay && (inv.AmountDue || 0) > 0;
      }).reduce((sum, inv) => sum + (inv.AmountDue || 0), 0);
      outstandingBillsHistory.push(val);
    }

    // ==================================================
    // KPI 4: Invoice Collection Rate
    // ==================================================
    const currentInvoices = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCREC') return false;
      const invDate = parseXeroDate(inv.Date);
      return invDate && invDate >= startDate && invDate <= endDate;
    });
    const currentTotal = currentInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
    const currentPaid = currentInvoices.reduce((sum, inv) => sum + (inv.AmountPaid || 0), 0);
    const collectionRateValue = currentTotal > 0 ? parseFloat(((currentPaid / currentTotal) * 100).toFixed(1)) : 0;

    const compInvoices = cachedInvoices.filter(inv => {
      if (inv.Type !== 'ACCREC') return false;
      const invDate = parseXeroDate(inv.Date);
      return invDate && invDate >= compStartDate && invDate <= compEndDate;
    });
    const compTotal = compInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
    const compPaid = compInvoices.reduce((sum, inv) => sum + (inv.AmountPaid || 0), 0);
    const compCollectionRate = compTotal > 0 ? parseFloat(((compPaid / compTotal) * 100).toFixed(1)) : 0;
    const collectionRateTrend = parseFloat((collectionRateValue - compCollectionRate).toFixed(1));

    // Last 6 Months Collection Rate History
    const collectionRateHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const startM = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const endM = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mInvs = cachedInvoices.filter(inv => {
        if (inv.Type !== 'ACCREC') return false;
        const invDate = parseXeroDate(inv.Date);
        return invDate && invDate >= startM && invDate <= endM;
      });
      const mTotal = mInvs.reduce((sum, inv) => sum + (inv.Total || 0), 0);
      const mPaid = mInvs.reduce((sum, inv) => sum + (inv.AmountPaid || 0), 0);
      collectionRateHistory.push(mTotal > 0 ? parseFloat(((mPaid / mTotal) * 100).toFixed(1)) : 0);
    }

    // ==================================================
    // Helpers for DSO / DPO
    // ==================================================
    const getPaymentDiffDaysList = (type: 'ACCREC' | 'ACCPAY', periodStart: Date, periodEnd: Date) => {
      const diffs: number[] = [];
      for (const p of cachedPayments) {
        const pDate = parseXeroDate(p.Date);
        if (!pDate || pDate < periodStart || pDate > periodEnd) continue;

        const invRef = p.Invoice;
        if (!invRef || invRef.Type !== type) continue;

        const fullInv = cachedInvoices.find(inv => inv.InvoiceID === invRef.InvoiceID);
        if (!fullInv) continue;

        const invDate = parseXeroDate(fullInv.Date);
        if (!invDate) continue;

        const diffTime = pDate.getTime() - invDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays >= 0) {
          diffs.push(diffDays);
        }
      }
      return diffs;
    };

    const getAverage = (list: number[]) => {
      if (list.length === 0) return 0;
      const sum = list.reduce((s, v) => s + v, 0);
      return Math.round(sum / list.length);
    };

    // ==================================================
    // KPI 5: Average Collection Days (DSO)
    // ==================================================
    const dsoDaysList = getPaymentDiffDaysList('ACCREC', startDate, endDate);
    const dsoValue = getAverage(dsoDaysList);

    const compDsoDaysList = getPaymentDiffDaysList('ACCREC', compStartDate, compEndDate);
    const compDsoValue = getAverage(compDsoDaysList);
    const dsoDifference = dsoValue - compDsoValue;

    // Last 6 Months DSO History
    const dsoHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const startM = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const endM = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mDsoDaysList = getPaymentDiffDaysList('ACCREC', startM, endM);
      dsoHistory.push(getAverage(mDsoDaysList));
    }

    // ==================================================
    // KPI 6: Average Payment Days (DPO)
    // ==================================================
    const dpoDaysList = getPaymentDiffDaysList('ACCPAY', startDate, endDate);
    const dpoValue = getAverage(dpoDaysList);

    const compDpoDaysList = getPaymentDiffDaysList('ACCPAY', compStartDate, compEndDate);
    const compDpoValue = getAverage(compDpoDaysList);
    const dpoDifference = dpoValue - compDpoValue;

    // Last 6 Months DPO History
    const dpoHistory: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(endDate);
      d.setMonth(endDate.getMonth() - i);
      const startM = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const endM = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mDpoDaysList = getPaymentDiffDaysList('ACCPAY', startM, endM);
      dpoHistory.push(getAverage(mDpoDaysList));
    }

    // ==================================================
    // Response
    // ==================================================
    return NextResponse.json({
      workingCapital: {
        value: workingCapitalValue,
        trend: workingCapitalTrend,
        history: workingCapitalHistory
      },
      overdueReceivables: {
        value: overdueReceivablesValue,
        percentage: overdueReceivablesPercentage,
        history: overdueHistory
      },
      outstandingBills: {
        value: outstandingBillsValue,
        percentage: outstandingBillsPercentage,
        history: outstandingBillsHistory
      },
      collectionRate: {
        value: collectionRateValue,
        trend: collectionRateTrend,
        history: collectionRateHistory
      },
      averageCollectionDays: {
        value: dsoValue,
        difference: dsoDifference,
        history: dsoHistory
      },
      averagePaymentDays: {
        value: dpoValue,
        difference: dpoDifference,
        history: dpoHistory
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (err: any) {
    console.error('KPIs API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
