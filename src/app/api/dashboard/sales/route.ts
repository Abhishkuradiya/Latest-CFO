import { NextRequest, NextResponse } from 'next/server';
import { db, parseXeroDate } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';
import { getXeroAccessToken, fetchXeroResource, fetchXeroReport } from '@/lib/xero';
import { ProfitAndLossService } from '@/lib/services/ProfitAndLossService';
import { getDefaultDateRange } from '@/lib/date-defaults';
import { getOrFetchManagementReport } from '@/lib/managementAccountsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paramFromDate = searchParams.get('from_date') || searchParams.get('fromDate');
  const paramToDate = searchParams.get('to_date') || searchParams.get('toDate');

  try {
    const tokenInfo = await getXeroAccessToken(tenantId);
    const isConnected = !!tokenInfo;

    // Fetch Base Currency
    const orgReport = isConnected
      ? await getOrFetchManagementReport(tenantId, 'Organisation', async () => (await fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Organisations'))[0] ?? null)
      : await db.getPostgresReport(tenantId, 'Organisation');
    const currency = orgReport?.raw_data?.BaseCurrency || orgReport?.BaseCurrency || orgReport?.CurrencyCode || null;

    // Dynamic Date Calculation: If query parameters are missing, inspect database invoices
    let startDate: Date;
    let endDate: Date;

    if (paramFromDate && paramToDate) {
      const cleanFrom = paramFromDate.split('T')[0];
      const cleanTo = paramToDate.split('T')[0];
      startDate = new Date(`${cleanFrom}T00:00:00.000Z`);
      endDate = new Date(`${cleanTo}T23:59:59.999Z`);
    } else {
      const defaultDates = getDefaultDateRange();
      startDate = new Date(`${defaultDates.startDate}T00:00:00.000Z`);
      endDate = new Date(`${defaultDates.endDate}T23:59:59.999Z`);
    }

    const fromStr = paramFromDate || startDate.toISOString().split('T')[0];
    const toStr = paramToDate || endDate.toISOString().split('T')[0];

    const fromDate = startDate;
    const toDate = endDate;

    // Compute Previous Period Dates
    let prevFromDate: Date;
    let prevToDate: Date;

    const monthsCount = (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 + (toDate.getUTCMonth() - fromDate.getUTCMonth()) + 1;

    if (monthsCount >= 1 && fromDate.getUTCDate() === 1) {
      prevToDate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 0, 23, 59, 59, 999));
      prevFromDate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() - monthsCount, 1, 0, 0, 0, 0));
    } else {
      const diffMs = toDate.getTime() - fromDate.getTime();
      prevToDate = new Date(fromDate.getTime() - 1);
      prevFromDate = new Date(prevToDate.getTime() - diffMs);
    }

    const prevFromStr = prevFromDate.toISOString().split('T')[0];
    const prevToStr = prevToDate.toISOString().split('T')[0];

    const formatPeriodLabel = (d1: Date, d2: Date) => {
      const f1 = d1.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: d1.getUTCFullYear() !== d2.getUTCFullYear() ? 'numeric' : undefined, timeZone: 'UTC' });
      const f2 = d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      return `vs ${f1} - ${f2}`;
    };
    const prevPeriodLabel = formatPeriodLabel(prevFromDate, prevToDate);

    // DB-First Fetch: Avoid Xero Rate Limit issues by checking PostgreSQL first
    let rawInvoicesList: any[] = [];
    const storedInvoices = isConnected
      ? await getOrFetchManagementReport(tenantId, 'Invoices', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Invoices'))
      : await db.getPostgresReport(tenantId, 'Invoices');
    if (Array.isArray(storedInvoices)) {
      rawInvoicesList = storedInvoices.filter((inv: any) => {
        const t = (inv.Type || inv.type || '').toUpperCase();
        return t === 'ACCREC' || t === 'ACCRECCRED';
      });
    }

    let invoicesCount = 0;
    let outstandingAR = 0;
    let prevInvoicesCount = 0;
    let prevOutstandingAR = 0;

    rawInvoicesList.forEach((inv) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate) return;

      const total = parseFloat(inv.Total || inv.total || 0);
      let rawAmountDue = 0;
      if (st === 'PAID') {
        rawAmountDue = 0;
      } else if (inv.AmountDue !== undefined && inv.AmountDue !== null) {
        rawAmountDue = parseFloat(inv.AmountDue);
      } else if (inv.amount_due !== undefined && inv.amount_due !== null) {
        rawAmountDue = parseFloat(inv.amount_due);
      } else {
        rawAmountDue = total;
      }

      if (invDate >= fromDate && invDate <= toDate) {
        invoicesCount += 1;
        outstandingAR += rawAmountDue;
      } else if (invDate >= prevFromDate && invDate <= prevToDate) {
        prevInvoicesCount += 1;
        prevOutstandingAR += rawAmountDue;
      }
    });

    // 100% PURE DYNAMIC PROFIT & LOSS INTEGRATION USING ProfitAndLossService
    const pnlReport = isConnected
      ? await getOrFetchManagementReport(tenantId, `ProfitAndLoss_${fromStr}_${toStr}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${fromStr}&toDate=${toStr}`))
      : await db.getPostgresReport(tenantId, `ProfitAndLoss_${fromStr}_${toStr}`);
    const prevPnlReport = isConnected
      ? await getOrFetchManagementReport(tenantId, `ProfitAndLoss_${prevFromStr}_${prevToStr}`, () => fetchXeroReport(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'ProfitAndLoss', `fromDate=${prevFromStr}&toDate=${prevToStr}`))
      : await db.getPostgresReport(tenantId, `ProfitAndLoss_${prevFromStr}_${prevToStr}`);

    let totalRevenue = 0;
    let netSales = 0;
    let grossProfit = 0;
    let grossMarginPct = 0;

    let prevTotalRevenue = 0;
    let prevNetSales = 0;
    let prevGrossProfit = 0;
    let prevGrossMarginPct = 0;
    let prevNetProfit = 0;

    let cogsVal = 0;
    let operatingExpensesVal = 0;
    let otherIncomeVal = 0;
    let netProfitVal = 0;
    let pnlAccounts = {
      turnoverStreams: [] as any[],
      cogsStreams: [] as any[],
      expenseStreams: [] as any[],
      otherIncomeStreams: [] as any[]
    };

    if (pnlReport) {
      const pnlSummary = ProfitAndLossService.parseReport(pnlReport);
      totalRevenue = pnlSummary.revenue;
      netSales = pnlSummary.revenue;
      grossProfit = pnlSummary.grossProfit;
      cogsVal = pnlSummary.cogs;
      operatingExpensesVal = pnlSummary.operatingExpenses;
      otherIncomeVal = pnlSummary.otherIncome;
      netProfitVal = pnlSummary.netProfit;
      grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Extract granular account-level streams
      const parsePnlAccounts = (report: any) => {
        const turnoverStreams: any[] = [];
        const cogsStreams: any[] = [];
        const expenseStreams: any[] = [];
        const otherIncomeStreams: any[] = [];

        if (!report || !report.Rows || !Array.isArray(report.Rows)) {
          return { turnoverStreams, cogsStreams, expenseStreams, otherIncomeStreams };
        }

        const traverse = (items: any[], currentSection: string) => {
          for (const item of items) {
            if (item.RowType === 'Section') {
              const secTitle = (item.Title || '').toLowerCase();
              traverse(item.Rows || [], secTitle || currentSection);
            } else if (item.RowType === 'Row' && Array.isArray(item.Cells) && item.Cells.length >= 2) {
              const name = (item.Cells[0]?.Value || '').trim();
              const valStr = (item.Cells[1]?.Value || '0').replace(/,/g, '').replace(/\(/g, '-').replace(/\)/g, '');
              const value = parseFloat(valStr);
              if (!name || isNaN(value)) continue;

              const nameLow = name.toLowerCase();
              if (nameLow.includes('total') || nameLow.includes('gross profit') || nameLow.includes('net profit') || nameLow.includes('operating profit')) continue;

              const accountId = item.Cells[0]?.Attributes?.find((a: any) => a.Id === 'account')?.Value || '';
              const sec = currentSection.toLowerCase();

              if (sec.includes('turnover') || sec.includes('income') || sec.includes('revenue') || sec.includes('trading income')) {
                if (sec.includes('other income')) {
                  otherIncomeStreams.push({ name, amount: value, accountId });
                } else {
                  turnoverStreams.push({ name, revenue: value, accountId });
                }
              } else if (sec.includes('cost of sales') || sec.includes('cogs') || sec.includes('cost of goods') || sec.includes('direct costs')) {
                cogsStreams.push({ name, amount: value, accountId });
              } else if (sec.includes('expense') || sec.includes('administrative') || sec.includes('overhead') || sec.includes('costs')) {
                expenseStreams.push({ name, amount: value, accountId });
              } else if (sec.includes('other income')) {
                otherIncomeStreams.push({ name, amount: value, accountId });
              } else {
                if (nameLow.includes('sales') || nameLow.includes('revenue') || nameLow.includes('income')) {
                  turnoverStreams.push({ name, revenue: value, accountId });
                } else if (nameLow.includes('fee') || nameLow.includes('cogs') || nameLow.includes('shipping') || nameLow.includes('purchases') || nameLow.includes('stock') || nameLow.includes('materials')) {
                  cogsStreams.push({ name, amount: value, accountId });
                } else {
                  expenseStreams.push({ name, amount: value, accountId });
                }
              }
            } else if (item.Rows) {
              traverse(item.Rows, currentSection);
            }
          }
        };

        traverse(report.Rows, '');
        return { turnoverStreams, cogsStreams, expenseStreams, otherIncomeStreams };
      };

      pnlAccounts = parsePnlAccounts(pnlReport);
    }

    // Dynamic Database Fallback from cached invoices if P&L report is missing
    if (totalRevenue === 0) {
      let invSum = 0;
      rawInvoicesList.forEach((inv) => {
        const st = (inv.Status || inv.status || '').toUpperCase();
        if (st === 'VOIDED' || st === 'DELETED') return;
        const invDate = parseXeroDate(inv.Date || inv.invoice_date);
        if (!invDate) return;
        if (invDate >= fromDate && invDate <= toDate) {
          invSum += parseFloat(inv.Total || inv.total || 0);
        }
      });
      totalRevenue = invSum;
      netSales = invSum;
      grossProfit = invSum;
      grossMarginPct = totalRevenue > 0 ? 100 : 0;
    }

    if (pnlAccounts.turnoverStreams.length === 0 && rawInvoicesList.length > 0) {
      const streamTotals: Record<string, number> = {};
      rawInvoicesList.forEach((inv) => {
        const st = (inv.Status || inv.status || '').toUpperCase();
        if (st === 'VOIDED' || st === 'DELETED') return;
        const type = (inv.Type || inv.type || '').toUpperCase();
        if (type !== 'ACCREC') return;

        const invDate = parseXeroDate(inv.Date || inv.invoice_date);
        if (!invDate || invDate < fromDate || invDate > toDate) return;

        const cName = (inv.ContactName || inv.Contact?.Name || inv.contact_name || 'Sales Income').trim();
        const total = parseFloat(inv.Total || inv.total || 0);

        let streamKey = 'Sales Income';
        const low = cName.toLowerCase();
        if (low.includes('amazon')) streamKey = 'Amazon Sales';
        else if (low.includes('ebay')) streamKey = 'eBay Sales';
        else if (low.includes('groupon')) streamKey = 'Groupon Sales';
        else if (low.includes('berkeley care') || low.includes('bc ltd')) streamKey = 'Berkeley Care LTD';
        else if (low.includes('stripe')) streamKey = 'Stripe / Online Sales';
        else if (low.includes('clarity')) streamKey = 'Clarity Pharma';
        else if (low.includes('laxmico') || low.includes('lexmico')) streamKey = 'Laxmico Ltd (B&S)';
        else if (low.includes('rajja')) streamKey = 'Rajja Chemist';
        else if (low.includes('sharma')) streamKey = 'Arun Sharma Chemists';
        else if (low.includes('qmed')) streamKey = 'Qmed Pharmaceuticals';
        else if (low.includes('core')) streamKey = 'Core Pharmaceuticals';
        else if (low.includes('sangers')) streamKey = 'Sangers (Maidstone) Ltd';
        else if (low.includes('tri pharma') || low.includes('vessey')) streamKey = 'TRI PHARMA LTD';
        else if (low.includes('vu chem')) streamKey = 'Vu Chem Ltd';
        else streamKey = cName;

        streamTotals[streamKey] = (streamTotals[streamKey] || 0) + total;
      });

      pnlAccounts.turnoverStreams = Object.entries(streamTotals)
        .filter(([_, rev]) => rev > 0)
        .map(([name, revenue]) => ({
          name,
          revenue: Math.round(revenue * 100) / 100
        }))
        .sort((a, b) => b.revenue - a.revenue);
    }

    if (prevPnlReport) {
      const prevPnlSummary = ProfitAndLossService.parseReport(prevPnlReport);
      prevTotalRevenue = prevPnlSummary.revenue;
      prevNetSales = prevPnlSummary.revenue;
      prevGrossProfit = prevPnlSummary.grossProfit;
      prevNetProfit = prevPnlSummary.netProfit;
      prevGrossMarginPct = prevTotalRevenue > 0 ? (prevGrossProfit / prevTotalRevenue) * 100 : 0;
    }

    if (prevTotalRevenue === 0) {
      let prevInvSum = 0;
      rawInvoicesList.forEach((inv) => {
        const st = (inv.Status || inv.status || '').toUpperCase();
        if (st === 'VOIDED' || st === 'DELETED') return;
        const invDate = parseXeroDate(inv.Date || inv.invoice_date);
        if (!invDate) return;
        if (invDate >= prevFromDate && invDate <= prevToDate) {
          prevInvSum += parseFloat(inv.Total || inv.total || 0);
        }
      });
      prevTotalRevenue = prevInvSum;
      prevNetSales = prevInvSum;
      prevGrossProfit = prevInvSum;
      prevNetProfit = prevInvSum;
      prevGrossMarginPct = prevTotalRevenue > 0 ? 100 : 0;
    }

    const collectionRatePct = totalRevenue > 0 ? Math.min(100, Math.max(0, ((totalRevenue - outstandingAR) / totalRevenue) * 100)) : 0.0;
    const prevCollectionRatePct = prevTotalRevenue > 0 ? Math.min(100, Math.max(0, ((prevTotalRevenue - prevOutstandingAR) / prevTotalRevenue) * 100)) : 0.0;

    // Fetch & Calculate Credit Notes summary
    const cachedCreditNotes = isConnected
      ? await getOrFetchManagementReport(tenantId, 'CreditNotes', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'CreditNotes'))
      : await db.getPostgresReport(tenantId, 'CreditNotes');

    let creditNotesCount = 0;
    let creditNotesTotal = 0;
    if (Array.isArray(cachedCreditNotes)) {
      for (const cnItem of cachedCreditNotes) {
        if (cnItem.Status !== 'DELETED' && cnItem.Status !== 'VOIDED') {
          const cnDate = parseXeroDate(cnItem.Date || cnItem.invoice_date);
          if (cnDate && cnDate >= startDate && cnDate <= endDate) {
            creditNotesCount++;
            creditNotesTotal += (cnItem.Total || cnItem.RemainingCredit || 0);
          }
        }
      }
    }

    if (creditNotesTotal > 0 && totalRevenue > 0) {
      netSales = Math.max(0, totalRevenue - creditNotesTotal);
    }

    // Calc % Change helper
    const calcPctChange = (curr: number, prev: number) => {
      if (prev === 0) return { pct: '+0.0%', isUp: true, pts: '+0.0 pts' };
      const diff = curr - prev;
      const pctVal = (diff / prev) * 100;
      const isUp = pctVal >= 0;
      const sign = isUp ? '+' : '-';
      return {
        pct: `${sign}${Math.abs(pctVal).toFixed(1)}%`,
        pts: `${sign}${Math.abs(pctVal).toFixed(1)} pts`,
        isUp
      };
    };

    const revChange = calcPctChange(totalRevenue, prevTotalRevenue);
    const netSalesChange = calcPctChange(netSales, prevNetSales);
    const gpChange = calcPctChange(grossProfit, prevGrossProfit);
    const invCountChange = calcPctChange(invoicesCount, prevInvoicesCount);
    const arChange = calcPctChange(outstandingAR, prevOutstandingAR);
    const collChange = calcPctChange(collectionRatePct, prevCollectionRatePct);

    // Gross Margin Percentage Points Difference
    const gmDiff = grossMarginPct - prevGrossMarginPct;
    const gmChange = {
      pts: `${gmDiff >= 0 ? '+' : ''}${gmDiff.toFixed(1)} pts`,
      isUp: gmDiff >= 0
    };

    // Format metrics snapshot object
    const salesSnapshot = {
      totalRevenue: {
        value: totalRevenue,
        prevValue: prevTotalRevenue,
        change: `${revChange.pct} ${prevPeriodLabel}`,
        isPositive: revChange.isUp
      },
      netSales: {
        value: netSales,
        prevValue: prevNetSales,
        change: `${netSalesChange.pct} ${prevPeriodLabel}`,
        isPositive: netSalesChange.isUp
      },
      creditNotesTotal,
      creditNotesCount,
      grossProfit: {
        value: grossProfit,
        prevValue: prevGrossProfit,
        change: `${gpChange.pct} ${prevPeriodLabel}`,
        isPositive: gpChange.isUp
      },
      grossMargin: {
        value: grossMarginPct,
        prevValue: prevGrossMarginPct,
        change: `${gmChange.pts} ${prevPeriodLabel}`,
        isPositive: gmChange.isUp
      },
      cogs: {
        value: cogsVal || Math.max(0, totalRevenue - grossProfit)
      },
      expenses: {
        value: operatingExpensesVal
      },
      otherIncome: {
        value: otherIncomeVal
      },
      netProfit: {
        value: netProfitVal || ((grossProfit + otherIncomeVal) - operatingExpensesVal),
        prevValue: prevNetProfit || prevGrossProfit
      },
      invoices: {
        value: invoicesCount,
        change: `${invCountChange.pct} ${prevPeriodLabel}`,
        isPositive: invCountChange.isUp
      },
      accountsReceivable: {
        value: outstandingAR,
        change: `${arChange.pts} ${prevPeriodLabel}`,
        isPositive: arChange.isUp
      },
      collectionRate: {
        value: collectionRatePct,
        change: `${collChange.pts} ${prevPeriodLabel}`,
        isPositive: collChange.isUp
      }
    };

    // Compute Top 10 Customers by Revenue from rawInvoicesList (including previous period comparison)
    const customerMap: Record<string, {
      name: string;
      revenue: number;
      prevRevenue: number;
      ar: number;
      invoiceCount: number;
    }> = {};

    rawInvoicesList.forEach((inv) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate) return;

      const isCurrent = invDate >= fromDate && invDate <= toDate;
      const isPrev = invDate >= prevFromDate && invDate <= prevToDate;
      if (!isCurrent && !isPrev) return;

      const contactName = inv.ContactName || inv.contact_name || inv.Contact?.Name || 'Unknown Customer';
      const total = parseFloat(inv.Total || inv.total || 0);

      let rawAmountDue = 0;
      if (st === 'PAID') {
        rawAmountDue = 0;
      } else if (inv.AmountDue !== undefined && inv.AmountDue !== null) {
        rawAmountDue = parseFloat(inv.AmountDue);
      } else if (inv.amount_due !== undefined && inv.amount_due !== null) {
        rawAmountDue = parseFloat(inv.amount_due);
      } else {
        rawAmountDue = total;
      }

      if (!customerMap[contactName]) {
        customerMap[contactName] = {
          name: contactName,
          revenue: 0,
          prevRevenue: 0,
          ar: 0,
          invoiceCount: 0
        };
      }

      if (isCurrent) {
        customerMap[contactName].revenue += total;
        customerMap[contactName].ar += rawAmountDue;
        customerMap[contactName].invoiceCount += 1;
      } else if (isPrev) {
        customerMap[contactName].prevRevenue += total;
      }
    });

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => {
        let growthVal = 0;
        if (c.prevRevenue > 0) {
          growthVal = ((c.revenue - c.prevRevenue) / c.prevRevenue) * 100;
        } else if (c.revenue > 0) {
          growthVal = 100.0;
        }
        const sharePct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
        return {
          name: c.name,
          revenue: c.revenue,
          growth: Number(growthVal.toFixed(1)),
          sharePct: Number(sharePct.toFixed(1)),
          gpMargin: grossMarginPct > 0 ? Number(grossMarginPct.toFixed(1)) : 100.0,
          ar: c.ar,
          dso: c.revenue > 0 ? Math.round((c.ar / c.revenue) * 30) : 0
        };
      });

    // 1. Fetch registered Xero Inventory Items catalog from DB
    let rawInventoryItems: any[] = [];
    try {
      rawInventoryItems = await db.getInventoryItems(tenantId);
    } catch (err) { }

    const inventoryCodeMap = new Map<string, any>();
    const inventoryIdMap = new Map<string, any>();

    if (Array.isArray(rawInventoryItems)) {
      rawInventoryItems.forEach((item: any) => {
        const code = (item.code || item.Code || '').trim().toLowerCase();
        const id = (item.item_id || item.ItemID || '').trim().toLowerCase();
        if (code) inventoryCodeMap.set(code, item);
        if (id) inventoryIdMap.set(id, item);
      });
    }

    // 2. Compute Top Products / Services by strictly matching Invoice Line Items with Registered Xero Inventory Items
    const productMap: Record<string, {
      name: string;
      code: string;
      revenue: number;
      prevRevenue: number;
      units: number;
      prevUnits: number;
    }> = {};

    rawInvoicesList.forEach((inv) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      const type = (inv.Type || inv.type || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return;
      if (type !== 'ACCREC' && type !== 'ACCRECCRED') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate) return;

      const isCurrent = invDate >= fromDate && invDate <= toDate;
      const isPrev = invDate >= prevFromDate && invDate <= prevToDate;
      if (!isCurrent && !isPrev) return;

      const lineItems = inv.LineItems || inv.line_items || [];
      lineItems.forEach((line: any) => {
        const lineCode = (line.ItemCode || line.item_code || line.Item?.Code || '').trim().toLowerCase();
        const lineId = (line.Item?.ItemID || '').trim().toLowerCase();

        // STRICT MATCH: Match line item against Xero registered Inventory Items catalog
        const matchedItem = (lineCode && inventoryCodeMap.get(lineCode)) ||
          (lineId && inventoryIdMap.get(lineId));

        // If registered inventory_items exist in DB, strictly require a match!
        if (inventoryCodeMap.size > 0 && !matchedItem) {
          return;
        }

        const code = matchedItem?.code || matchedItem?.Code || line.ItemCode || line.Item?.Code || '';
        const itemName = matchedItem?.name || matchedItem?.Name || line.Item?.Name || line.Description || line.description || code || 'General Item';

        const displayName = code && itemName && !itemName.toLowerCase().includes(code.toLowerCase())
          ? `${code} - ${itemName}`
          : itemName || code;

        const lineTotal = Math.abs(parseFloat(line.LineAmount || line.line_amount || 0));
        const qty = Math.abs(parseFloat(line.Quantity || line.quantity || 1));

        if (!productMap[displayName]) {
          productMap[displayName] = {
            name: displayName,
            code,
            revenue: 0,
            prevRevenue: 0,
            units: 0,
            prevUnits: 0
          };
        }

        if (isCurrent) {
          productMap[displayName].revenue += lineTotal;
          productMap[displayName].units += qty;
        } else if (isPrev) {
          productMap[displayName].prevRevenue += lineTotal;
          productMap[displayName].prevUnits += qty;
        }
      });
    });

    const topProducts = Object.values(productMap)
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map((p) => {
        let growthVal = 0;
        if (p.prevRevenue > 0) {
          growthVal = ((p.revenue - p.prevRevenue) / p.prevRevenue) * 100;
        } else if (p.revenue > 0) {
          growthVal = 100.0;
        }
        const sharePct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
        return {
          name: p.name,
          revenue: p.revenue,
          units: Math.round(p.units) || 1,
          sharePct: Number(sharePct.toFixed(1)),
          gpMargin: grossMarginPct > 0 ? Number(grossMarginPct.toFixed(1)) : 100.0,
          growth: Number(growthVal.toFixed(1))
        };
      });

    if (topProducts.length === 0 && topCustomers.length > 0) {
      topCustomers.forEach(c => {
        topProducts.push({
          name: `${c.name} Sales`,
          revenue: c.revenue,
          units: (c as any).invoiceCount || 1,
          sharePct: c.sharePct,
          gpMargin: grossMarginPct || 100,
          growth: c.growth
        });
      });
    }

    // Compute Executive Row 4 Metrics: Gross Profit Analysis, Revenue Quality & Customer Concentration
    if (cogsVal === 0) cogsVal = Math.max(0, totalRevenue - grossProfit);

    // Customer Concentration
    const top1Rev = topCustomers[0]?.revenue || 0;
    const largestContributionPct = totalRevenue > 0 ? (top1Rev / totalRevenue) * 100 : 0;
    const top5SumRev = topCustomers.slice(0, 5).reduce((acc, c) => acc + c.revenue, 0);
    const top5ContributionPct = totalRevenue > 0 ? (top5SumRev / totalRevenue) * 100 : 0;
    const concentrationRisk = top5ContributionPct > 50 ? 'High Risk' : top5ContributionPct > 30 ? 'Moderate Risk' : 'Low Risk';

    // Revenue Quality Metrics
    const collectableRev = Math.max(0, totalRevenue - outstandingAR);
    const collectablePct = totalRevenue > 0 ? (collectableRev / totalRevenue) * 100 : 0;
    const profitableRev = totalRevenue;
    const profitablePct = totalRevenue > 0 ? (profitableRev / totalRevenue) * 100 : 0;
    const sustainableRev = totalRevenue * 0.75;
    const sustainablePct = 75.0;
    const qualityScore = totalRevenue > 0 ? Math.min(99, Math.max(10, Math.round((collectablePct * 0.5) + (profitablePct * 0.3) + 15))) : 0;

    const executiveRow4 = {
      grossProfitAnalysis: {
        revenue: totalRevenue,
        discounts: 0,
        returns: 0,
        netSales,
        cogs: cogsVal,
        grossProfit,
        grossMarginPct,
        prevGrossMarginPct,
        gmChangePts: gmChange.pts,
        gmChangeIsUp: gmChange.isUp
      },
      revenueQuality: {
        qualityScore,
        profitableRevenue: profitableRev,
        profitablePct,
        collectableRevenue: collectableRev,
        collectablePct,
        sustainableRevenue: sustainableRev,
        sustainablePct
      },
      customerConcentration: {
        top5ContributionPct,
        largestContributionPct,
        riskLevel: concentrationRisk
      }
    };

    // Compute Receivables Aging Buckets dynamically (As On toDate)
    let arCurrent = 0;
    let arDays1_30 = 0;
    let arDays31_60 = 0;
    let arDays61_90 = 0;
    let arDays90Plus = 0;
    let totalARVal = 0;
    let overdueVal = 0;

    rawInvoicesList.forEach((inv) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED' || st === 'DRAFT' || st === 'PAID') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate || invDate > toDate) return; // As On toDate: Include all unpaid invoices issued on or before toDate

      const invDueDate = parseXeroDate(inv.DueDate || inv.due_date || inv.Date || inv.invoice_date) || invDate;

      let amountDue = 0;
      if (inv.AmountDue !== undefined && inv.AmountDue !== null) {
        amountDue = parseFloat(inv.AmountDue);
      } else if (inv.amount_due !== undefined && inv.amount_due !== null) {
        amountDue = parseFloat(inv.amount_due);
      } else {
        amountDue = parseFloat(inv.Total || inv.total || 0);
      }

      if (amountDue <= 0.001) return;

      totalARVal += amountDue;

      const diffMs = toDate.getTime() - invDueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        arCurrent += amountDue;
      } else {
        overdueVal += amountDue;
        if (diffDays <= 30) arDays1_30 += amountDue;
        else if (diffDays <= 60) arDays31_60 += amountDue;
        else if (diffDays <= 90) arDays61_90 += amountDue;
        else arDays90Plus += amountDue;
      }
    });

    const asOnDateFormatted = toDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const agingSummary = {
      asOnDate: asOnDateFormatted,
      totalAR: totalARVal,
      current: arCurrent,
      days1_30: arDays1_30,
      days31_60: arDays31_60,
      days61_90: arDays61_90,
      days90Plus: arDays90Plus
    };

    // DSO Summary
    const periodDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
    const currentDso = totalRevenue > 0 ? Math.round((totalARVal / totalRevenue) * periodDays) : 0;
    const prevDso = prevTotalRevenue > 0 ? Math.round((prevOutstandingAR / prevTotalRevenue) * periodDays) : 0;
    const dsoChange = Math.abs(currentDso - prevDso);

    const dsoSummary = {
      currentDso,
      prevDso,
      dsoChange
    };

    // Cash Conversion Funnel
    const invoicedVal = totalRevenue;
    const collectedVal = Math.max(0, totalRevenue - totalARVal);
    const cashConversionRate = totalRevenue > 0 ? ((collectedVal / totalRevenue) * 100) : 0;

    const prevCollectedVal = Math.max(0, prevTotalRevenue - prevOutstandingAR);
    const prevCashConversionRate = prevTotalRevenue > 0 ? ((prevCollectedVal / prevTotalRevenue) * 100) : 0;
    const rateDiff = cashConversionRate - prevCashConversionRate;
    const rateChangePts = `${rateDiff >= 0 ? '+' : ''}${rateDiff.toFixed(1)} pts`;

    const cashConversion = {
      revenue: totalRevenue,
      invoiced: invoicedVal,
      collected: collectedVal,
      outstanding: totalARVal,
      overdue: overdueVal,
      rate: cashConversionRate,
      prevRate: prevCashConversionRate,
      rateChangePts,
      isImproving: rateDiff >= 0
    };

    const salesForecast = {
      projectedRevenue: 0,
      confidencePct: 0,
      downside: 0,
      downsideChange: '-0.0%',
      baseCase: 0,
      upside: 0,
      upsideChange: '+0.0%'
    };

    // Compute Customer Risk Overview dynamically from customer invoice aging
    let lowRiskCount = 0;
    let medRiskCount = 0;
    let highRiskCount = 0;

    const customerRiskMap: Record<string, { totalRev: number; ar: number; maxOverdueDays: number }> = {};

    rawInvoicesList.forEach((inv: any) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED' || st === 'DRAFT') return;

      const custName = inv.Contact?.Name || inv.contact_name || inv.ContactName || 'Customer';
      if (!customerRiskMap[custName]) {
        customerRiskMap[custName] = { totalRev: 0, ar: 0, maxOverdueDays: 0 };
      }

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const invTotal = parseFloat(inv.Total || inv.total || 0);

      if (invDate && invDate >= fromDate && invDate <= toDate) {
        customerRiskMap[custName].totalRev += invTotal;
      }

      if (st !== 'PAID' && invDate && invDate <= toDate) {
        let amountDue = parseFloat(inv.AmountDue ?? inv.amount_due ?? invTotal);
        if (amountDue > 0.001) {
          customerRiskMap[custName].ar += amountDue;
          const dueDate = parseXeroDate(inv.DueDate || inv.due_date || inv.Date || inv.invoice_date) || invDate;
          const diffMs = toDate.getTime() - dueDate.getTime();
          const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (overdueDays > customerRiskMap[custName].maxOverdueDays) {
            customerRiskMap[custName].maxOverdueDays = overdueDays;
          }
        }
      }
    });

    const activeCustomersList = Object.values(customerRiskMap);
    const totalCustCount = activeCustomersList.length;

    activeCustomersList.forEach((cust) => {
      if (cust.maxOverdueDays > 60) {
        highRiskCount++;
      } else if (cust.maxOverdueDays > 0) {
        medRiskCount++;
      } else {
        lowRiskCount++;
      }
    });

    const lowRiskPct = totalCustCount > 0 ? Math.round((lowRiskCount / totalCustCount) * 100) : 0;
    const medRiskPct = totalCustCount > 0 ? Math.round((medRiskCount / totalCustCount) * 100) : 0;
    const highRiskPct = totalCustCount > 0 ? Math.round((highRiskCount / totalCustCount) * 100) : 0;

    const customerRiskOverview = {
      lowRisk: lowRiskCount,
      lowRiskPct,
      mediumRisk: medRiskCount,
      mediumRiskPct: medRiskPct,
      highRisk: highRiskCount,
      highRiskPct
    };

    // Compute Margin Risk Overview dynamically from product line item trends
    let improvingCount = 0;
    let stableCount = 0;
    let decliningCount = 0;

    const currProductMap: Record<string, number> = {};
    const prevProductMap: Record<string, number> = {};

    rawInvoicesList.forEach((inv: any) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED' || st === 'DRAFT') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate) return;

      const lineItems = inv.LineItems || inv.line_items || [];
      const isCurrent = invDate >= fromDate && invDate <= toDate;
      const isPrev = invDate >= prevFromDate && invDate <= prevToDate;

      if (!isCurrent && !isPrev) return;

      lineItems.forEach((line: any) => {
        const name = line.ItemCode || line.Description || line.item_code || line.description || 'General Service';
        const lineTotal = parseFloat(line.LineAmount || line.line_amount || 0);

        if (isCurrent) {
          currProductMap[name] = (currProductMap[name] || 0) + lineTotal;
        } else if (isPrev) {
          prevProductMap[name] = (prevProductMap[name] || 0) + lineTotal;
        }
      });
    });

    const allProductNames = Array.from(new Set([...Object.keys(currProductMap), ...Object.keys(prevProductMap)]));
    const totalProdCount = allProductNames.length;

    allProductNames.forEach((name) => {
      const curr = currProductMap[name] || 0;
      const prev = prevProductMap[name] || 0;

      if (prev === 0) {
        if (curr > 0) improvingCount++;
        else stableCount++;
      } else {
        const changePct = ((curr - prev) / prev) * 100;
        if (changePct > 5) improvingCount++;
        else if (changePct < -5) decliningCount++;
        else stableCount++;
      }
    });

    const improvingPct = totalProdCount > 0 ? Math.round((improvingCount / totalProdCount) * 100) : 0;
    const stablePct = totalProdCount > 0 ? Math.round((stableCount / totalProdCount) * 100) : 0;
    const decliningPct = totalProdCount > 0 ? Math.round((decliningCount / totalProdCount) * 100) : 0;

    const marginRiskOverview = {
      improving: improvingCount,
      improvingPct,
      stable: stableCount,
      stablePct,
      declining: decliningCount,
      decliningPct
    };

    // Format Date string utility
    const formatDateStr = (d: Date | null) => {
      if (!d) return '';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    };

    // Extract Recent Invoices and allInvoices for Selected Date Period ONLY
    const periodInvoicesOnly = rawInvoicesList.filter((inv: any) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      const t = (inv.Type || inv.type || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return false;
      if (t !== 'ACCREC' && t.includes('CRED')) return false;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate) return false;
      return invDate >= fromDate && invDate <= toDate;
    });

    periodInvoicesOnly.sort((a: any, b: any) => {
      const d1 = parseXeroDate(a.Date || a.invoice_date)?.getTime() || 0;
      const d2 = parseXeroDate(b.Date || b.invoice_date)?.getTime() || 0;
      return d2 - d1;
    });

    const todayNow = new Date();
    todayNow.setUTCHours(0, 0, 0, 0);

    const recentInvoices = periodInvoicesOnly.slice(0, 8).map((inv: any) => {
      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const invDueDate = parseXeroDate(inv.DueDate || inv.due_date || inv.Date || inv.invoice_date) || invDate;
      const st = (inv.Status || inv.status || '').toUpperCase();
      let statusLabel = 'Paid';
      let statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';

      if (st !== 'PAID') {
        if (invDueDate && invDueDate < todayNow) {
          statusLabel = 'Overdue';
          statusColor = 'bg-rose-50 text-rose-600 border-rose-100';
        } else if (st === 'DRAFT') {
          statusLabel = 'Draft';
          statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
        } else if (st === 'SUBMITTED') {
          statusLabel = 'Submitted';
          statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        } else {
          statusLabel = 'Authorised';
          statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
        }
      }

      const invTotal = parseFloat(inv.Total || inv.total || 0);
      const invSubTotal = inv.SubTotal !== undefined && inv.SubTotal !== null ? parseFloat(inv.SubTotal) : inv.sub_total !== undefined && inv.sub_total !== null ? parseFloat(inv.sub_total) : (invTotal / 1.2);
      const invTotalTax = inv.TotalTax !== undefined && inv.TotalTax !== null ? parseFloat(inv.TotalTax) : inv.total_tax !== undefined && inv.total_tax !== null ? parseFloat(inv.total_tax) : Math.max(0, invTotal - invSubTotal);

      return {
        number: inv.InvoiceNumber || inv.invoice_number || inv.id || 'INV-001',
        customer: inv.Contact?.Name || inv.contact_name || inv.ContactName || 'Customer',
        date: formatDateStr(invDate),
        amount: invTotal,
        subTotal: Math.round(invSubTotal * 100) / 100,
        totalTax: Math.round(invTotalTax * 100) / 100,
        status: statusLabel,
        statusColor
      };
    });

    const allInvoices = periodInvoicesOnly.map((inv: any) => {
      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const invDueDate = parseXeroDate(inv.DueDate || inv.due_date || inv.Date || inv.invoice_date) || invDate;
      const st = (inv.Status || inv.status || '').toUpperCase();

      const invTotal = parseFloat(inv.Total || inv.total || 0);
      const invSubTotal = inv.SubTotal !== undefined && inv.SubTotal !== null ? parseFloat(inv.SubTotal) : inv.sub_total !== undefined && inv.sub_total !== null ? parseFloat(inv.sub_total) : (invTotal / 1.2);
      const invTotalTax = inv.TotalTax !== undefined && inv.TotalTax !== null ? parseFloat(inv.TotalTax) : inv.total_tax !== undefined && inv.total_tax !== null ? parseFloat(inv.total_tax) : Math.max(0, invTotal - invSubTotal);

      let rawAmountDue = 0;
      if (st === 'PAID') {
        rawAmountDue = 0;
      } else if (inv.AmountDue !== undefined && inv.AmountDue !== null) {
        rawAmountDue = parseFloat(inv.AmountDue);
      } else if (inv.amount_due !== undefined && inv.amount_due !== null) {
        rawAmountDue = parseFloat(inv.amount_due);
      } else {
        rawAmountDue = invTotal;
      }

      let statusLabel = 'Authorised';
      let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';

      if (st === 'PAID') {
        statusLabel = 'Paid';
        statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      } else if (st === 'DRAFT') {
        statusLabel = 'Draft';
        statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
      } else if (st === 'SUBMITTED') {
        statusLabel = 'Submitted';
        statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      } else if (invDueDate && invDueDate < todayNow && rawAmountDue > 0) {
        statusLabel = 'Overdue';
        statusColor = 'bg-rose-50 text-rose-700 border-rose-200';
      } else if (st === 'AUTHORISED') {
        statusLabel = 'Authorised';
        statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
      }

      return {
        id: inv.InvoiceID || inv.id || inv.InvoiceNumber || inv.invoice_number,
        number: inv.InvoiceNumber || inv.invoice_number || inv.id || 'INV-001',
        customer: inv.Contact?.Name || inv.contact_name || inv.ContactName || 'Customer',
        date: formatDateStr(invDate),
        dueDate: formatDateStr(invDueDate),
        amount: invTotal,
        subTotal: Math.round(invSubTotal * 100) / 100,
        totalTax: Math.round(invTotalTax * 100) / 100,
        amountDue: rawAmountDue,
        amountPaid: Math.max(0, invTotal - rawAmountDue),
        status: statusLabel,
        rawStatus: st,
        statusColor,
        reference: inv.Reference || inv.reference || '',
        currencyCode: inv.CurrencyCode || inv.currency || currency,
        lineItems: typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.LineItems || inv.line_items || []),
        type: inv.Type || inv.type || 'ACCREC'
      };
    });

    // Extract All Credit Notes for selected period
    const creditNotesOnly = (Array.isArray(cachedCreditNotes) ? cachedCreditNotes : []).filter((cnItem: any) => {
      const st = (cnItem.Status || cnItem.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return false;
      const cnDate = parseXeroDate(cnItem.Date || cnItem.invoice_date);
      if (!cnDate) return false;
      return cnDate >= fromDate && cnDate <= toDate;
    });

    creditNotesOnly.sort((a: any, b: any) => {
      const d1 = parseXeroDate(a.Date || a.invoice_date)?.getTime() || 0;
      const d2 = parseXeroDate(b.Date || b.invoice_date)?.getTime() || 0;
      return d2 - d1;
    });

    const allCreditNotes = creditNotesOnly.map((cnItem: any) => {
      const cnDate = parseXeroDate(cnItem.Date || cnItem.invoice_date);
      const cnDueDate = parseXeroDate(cnItem.DueDate || cnItem.due_date || cnItem.Date);
      const cnTotal = Math.abs(parseFloat(cnItem.Total || cnItem.total || 0));
      const cnSubTotal = cnItem.SubTotal !== undefined ? Math.abs(parseFloat(cnItem.SubTotal)) : (cnTotal / 1.2);
      const cnTotalTax = cnItem.TotalTax !== undefined ? Math.abs(parseFloat(cnItem.TotalTax)) : (cnTotal - cnSubTotal);
      const remainingCredit = cnItem.RemainingCredit !== undefined ? Math.abs(parseFloat(cnItem.RemainingCredit)) : Math.abs(parseFloat(cnItem.AmountDue || cnItem.amount_due || 0));

      const st = (cnItem.Status || cnItem.status || '').toUpperCase();
      let statusLabel = 'Authorised';
      let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';

      if (st === 'PAID') {
        statusLabel = 'Applied';
        statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      } else if (st === 'DRAFT') {
        statusLabel = 'Draft';
        statusColor = 'bg-slate-100 text-slate-700 border-slate-200';
      } else if (st === 'SUBMITTED') {
        statusLabel = 'Submitted';
        statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      } else if (st === 'AUTHORISED') {
        statusLabel = remainingCredit > 0 ? 'Active Credit' : 'Applied';
        statusColor = remainingCredit > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      }

      return {
        id: cnItem.CreditNoteID || cnItem.id || cnItem.CreditNoteNumber || 'CN-001',
        number: cnItem.CreditNoteNumber || cnItem.InvoiceNumber || cnItem.invoice_number || cnItem.id || 'CN-001',
        customer: cnItem.Contact?.Name || cnItem.contact_name || cnItem.ContactName || 'Customer',
        date: formatDateStr(cnDate),
        dueDate: formatDateStr(cnDueDate),
        amount: cnTotal,
        subTotal: Math.round(cnSubTotal * 100) / 100,
        totalTax: Math.round(cnTotalTax * 100) / 100,
        amountDue: remainingCredit,
        remainingCredit,
        status: statusLabel,
        rawStatus: st,
        statusColor,
        reference: cnItem.Reference || cnItem.reference || '',
        currencyCode: cnItem.CurrencyCode || cnItem.currency || currency
      };
    });

    const recentCreditNotes = allCreditNotes.slice(0, 8);

    // Extract Recent Payments
    const paymentsList: any[] = [];
    rawInvoicesList.forEach((inv: any) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return;

      const payments = inv.Payments || inv.payments || [];
      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      const custName = inv.Contact?.Name || inv.contact_name || inv.ContactName || 'Customer';
      const invNumber = inv.InvoiceNumber || inv.invoice_number || inv.id || 'INV-001';

      if (Array.isArray(payments) && payments.length > 0) {
        payments.forEach((p: any) => {
          const pDate = parseXeroDate(p.Date || p.date) || invDate;
          paymentsList.push({
            number: invNumber,
            customer: custName,
            date: pDate,
            dateStr: formatDateStr(pDate),
            amount: parseFloat(p.Amount || p.amount || inv.Total || inv.total || 0)
          });
        });
      } else if (st === 'PAID') {
        paymentsList.push({
          number: invNumber,
          customer: custName,
          date: invDate,
          dateStr: formatDateStr(invDate),
          amount: parseFloat(inv.Total || inv.total || 0)
        });
      }
    });

    paymentsList.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    const recentPayments = paymentsList.slice(0, 8).map((p) => ({
      number: p.number,
      customer: p.customer,
      date: p.dateStr,
      amount: p.amount
    }));

    // Compute Dynamic Monthly Revenue Trend for selected date range (fromDate to toDate)
    const trendLabels: string[] = [];
    const trendCurrentData: number[] = [];
    const trendPrevData: number[] = [];

    let currTrendMonth = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
    const endTrendMonth = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));

    while (currTrendMonth <= endTrendMonth) {
      const monthLabel = currTrendMonth.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      trendLabels.push(monthLabel);

      const monthStart = new Date(Date.UTC(currTrendMonth.getUTCFullYear(), currTrendMonth.getUTCMonth(), 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(currTrendMonth.getUTCFullYear(), currTrendMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      let monthTotal = 0;
      rawInvoicesList.forEach((inv) => {
        const st = (inv.Status || inv.status || '').toUpperCase();
        if (st === 'VOIDED' || st === 'DELETED') return;
        const invDate = parseXeroDate(inv.Date || inv.invoice_date);
        if (invDate && invDate >= monthStart && invDate <= monthEnd) {
          monthTotal += parseFloat(inv.Total || inv.total || 0);
        }
      });
      trendCurrentData.push(monthTotal);

      const prevMonthStart = new Date(Date.UTC(currTrendMonth.getUTCFullYear(), currTrendMonth.getUTCMonth() - monthsCount, 1, 0, 0, 0));
      const prevMonthEnd = new Date(Date.UTC(currTrendMonth.getUTCFullYear(), currTrendMonth.getUTCMonth() - monthsCount + 1, 0, 23, 59, 59, 999));

      let prevMonthTotal = 0;
      rawInvoicesList.forEach((inv) => {
        const st = (inv.Status || inv.status || '').toUpperCase();
        if (st === 'VOIDED' || st === 'DELETED') return;
        const invDate = parseXeroDate(inv.Date || inv.invoice_date);
        if (invDate && invDate >= prevMonthStart && invDate <= prevMonthEnd) {
          prevMonthTotal += parseFloat(inv.Total || inv.total || 0);
        }
      });
      trendPrevData.push(prevMonthTotal);

      currTrendMonth = new Date(Date.UTC(currTrendMonth.getUTCFullYear(), currTrendMonth.getUTCMonth() + 1, 1));
    }

    const revenueTrend = {
      labels: trendLabels,
      currentData: trendCurrentData,
      prevData: trendPrevData
    };

    // Compute Dynamic Regional Sales Distribution from Contacts addresses & Invoices
    let rawContacts: any[] = [];
    try {
      const contactsReport = isConnected
        ? await getOrFetchManagementReport(tenantId, 'Contacts', () => fetchXeroResource(tokenInfo.accessToken, tokenInfo.xeroTenantId, 'Contacts'))
        : await db.getPostgresReport(tenantId, 'Contacts');
      if (contactsReport) {
        rawContacts = contactsReport.raw_data || contactsReport.reports || contactsReport;
        if (!Array.isArray(rawContacts) && (rawContacts as any).Contacts) rawContacts = (rawContacts as any).Contacts;
      }
    } catch (e) {}

    const mapToMacroRegion = (city?: string, region?: string, country?: string) => {
      const c = (city || '').trim();
      const r = (region || '').trim();
      const cntry = (country || '').trim().toUpperCase();
      const text = `${c} ${r}`.toLowerCase();

      if (cntry === 'GAUTENG' || cntry === 'SOUTH AFRICA' || text.includes('johannesburg')) {
        return { name: 'International / South Africa', code: 'ZA', countryCode: 'ZA', flag: '🇿🇦', continent: 'Africa' };
      }
      if (text.includes('london') || text.includes('lambeth') || text.includes('islington') || text.includes('tower hamlets') || text.includes('enfield') || text.includes('harrow') || text.includes('wembley') || text.includes('hillingdon')) {
        return { name: 'Greater London', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
      }
      if (text.includes('oxford') || text.includes('berkshire') || text.includes('marlow') || text.includes('henley') || text.includes('windsor') || text.includes('maidenhead') || text.includes('southend') || text.includes('hayes')) {
        return { name: 'South East England', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
      }
      if (text.includes('manchester') || text.includes('liverpool') || text.includes('merseyside') || text.includes('cheshire') || text.includes('lancashire')) {
        return { name: 'North West England', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
      }
      if (text.includes('york') || text.includes('leeds') || text.includes('bradford') || text.includes('sheffield') || text.includes('yorkshire')) {
        return { name: 'Yorkshire & Humber', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
      }
      if (text.includes('shrewsbury') || text.includes('shropshire') || text.includes('birmingham') || text.includes('midlands')) {
        return { name: 'West Midlands', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
      }
      return { name: 'UK General / South East', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' };
    };

    const contactLocationMap = new Map<string, { macro: ReturnType<typeof mapToMacroRegion>; city: string; name: string }>();

    if (Array.isArray(rawContacts)) {
      rawContacts.forEach((c: any) => {
        const id = (c.ContactID || c.contact_id || '').trim().toLowerCase();
        const name = (c.Name || c.name || '').trim().toLowerCase();
        const addrs = c.Addresses || c.addresses || [];

        let city = '';
        let region = '';
        let country = '';

        if (Array.isArray(addrs)) {
          addrs.forEach((a: any) => {
            if (a.City || a.city) city = a.City || a.city;
            if (a.Region || a.region) region = a.Region || a.region;
            if (a.Country || a.country) country = a.Country || a.country;
          });
        }

        const macro = mapToMacroRegion(city, region, country);
        const info = { macro, city: city || 'Main District', name: c.Name || c.name || 'Client' };
        if (id) contactLocationMap.set(id, info);
        if (name) contactLocationMap.set(name, info);
      });
    }

    const regionalBreakdownMap: Record<string, {
      name: string;
      code: string;
      countryCode: string;
      flag: string;
      continent: string;
      revenue: number;
      invoiceCount: number;
      citiesMap: Record<string, { name: string; revenue: number; count: number }>;
    }> = {};

    let totalRegionalCalculatedRev = 0;

    rawInvoicesList.forEach((inv: any) => {
      const st = (inv.Status || inv.status || '').toUpperCase();
      const type = (inv.Type || inv.type || '').toUpperCase();
      if (st === 'VOIDED' || st === 'DELETED') return;
      if (type !== 'ACCREC') return;

      const invDate = parseXeroDate(inv.Date || inv.invoice_date);
      if (!invDate || invDate < fromDate || invDate > toDate) return;

      const total = Math.abs(parseFloat(inv.Total || inv.total || 0));
      const cId = (inv.Contact?.ContactID || inv.contact_id || '').trim().toLowerCase();
      const cName = (inv.ContactName || inv.contact_name || inv.Contact?.Name || '').trim().toLowerCase();

      const info = (cId && contactLocationMap.get(cId)) ||
                   (cName && contactLocationMap.get(cName)) ||
                   { macro: { name: 'Greater London', code: 'GB', countryCode: 'GB', flag: '🇬🇧', continent: 'Europe' }, city: 'London', name: cName || 'Client' };

      const macro = info.macro;
      const cityName = info.city || 'Central Region';

      if (!regionalBreakdownMap[macro.name]) {
        regionalBreakdownMap[macro.name] = {
          name: macro.name,
          code: macro.code,
          countryCode: macro.countryCode,
          flag: macro.flag,
          continent: macro.continent,
          revenue: 0,
          invoiceCount: 0,
          citiesMap: {}
        };
      }

      regionalBreakdownMap[macro.name].revenue += total;
      regionalBreakdownMap[macro.name].invoiceCount += 1;
      totalRegionalCalculatedRev += total;

      if (!regionalBreakdownMap[macro.name].citiesMap[cityName]) {
        regionalBreakdownMap[macro.name].citiesMap[cityName] = { name: cityName, revenue: 0, count: 0 };
      }
      regionalBreakdownMap[macro.name].citiesMap[cityName].revenue += total;
      regionalBreakdownMap[macro.name].citiesMap[cityName].count += 1;
    });

    const regions = Object.values(regionalBreakdownMap)
      .filter(r => r.revenue > 0)
      .map(r => ({
        name: r.name,
        code: r.code,
        countryCode: r.countryCode,
        flag: r.flag,
        continent: r.continent,
        revenue: r.revenue,
        invoiceCount: r.invoiceCount,
        pct: totalRegionalCalculatedRev > 0 ? Number(((r.revenue / totalRegionalCalculatedRev) * 100).toFixed(1)) : 100,
        cities: Object.values(r.citiesMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map(c => ({
            name: c.name,
            revenue: c.revenue,
            count: c.count,
            pct: r.revenue > 0 ? Number(((c.revenue / r.revenue) * 100).toFixed(1)) : 0
          }))
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      meta: {
        currency,
        fromDate: fromStr,
        toDate: toStr,
        prevPeriodLabel
      },
      salesSnapshot,
      revenueTrend,
      topCustomers,
      topProducts,
      regions,
      executiveRow4,
      agingSummary,
      dsoSummary,
      cashConversion,
      salesForecast,
      customerRiskOverview,
      marginRiskOverview,
      recentInvoices,
      allInvoices,
      allCreditNotes,
      recentCreditNotes,
      recentPayments,
      pnlAccounts,
      turnoverStreams: pnlAccounts.turnoverStreams,
      cogsStreams: pnlAccounts.cogsStreams,
      expenseStreams: pnlAccounts.expenseStreams
    });

  } catch (err: any) {
    console.error('Sales API handler error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
