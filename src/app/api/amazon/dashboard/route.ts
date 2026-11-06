import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

// Fetch live exchange rates from Frankfurter (free, no API key)
async function getLiveRates(baseCurrency: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${baseCurrency}`,
      { next: { revalidate: 3600 } } // cache 1 hour
    );
    if (!res.ok) throw new Error('Rate fetch failed');
    const data = await res.json();
    // rates[X] = how many X per 1 baseCurrency
    const rates: Record<string, number> = { [baseCurrency]: 1 };
    Object.assign(rates, data.rates || {});
    return rates;
  } catch {
    // Fallback hardcoded rates vs GBP if API is down
    return {
      GBP: 1,
      USD: 1.2763,
      EUR: 1.1632,
      INR: 106.45,
      CAD: 1.7432,
      AUD: 1.9821
    };
  }
}

export async function GET(request: Request) {
  try {
    let tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      tenantId = 3;
    }

    const { searchParams } = new URL(request.url);
    const marketplace = searchParams.get('marketplace') || 'all';
    // Base/Home currency for unified view — default GBP (British Pound)
    const baseCurrency = (searchParams.get('base') || 'GBP').toUpperCase();

    // Fetch live exchange rates FROM baseCurrency
    const ratesFromBase = await getLiveRates(baseCurrency);
    // ratesFromBase[X] = how many X per 1 baseCurrency
    // So to convert amount_in_X to baseCurrency: amount / ratesFromBase[X]
    function toBase(amount: number, fromCurrency: string): number {
      const rate = ratesFromBase[fromCurrency.toUpperCase()];
      if (!rate || rate === 0) return amount; // unknown currency, keep as-is
      return amount / rate;
    }

    // 1. Check Amazon connection status for THIS tenant strictly
    const creds = await db.getCredentials(tenantId, 'amazon');
    const isConnected = !!creds;

    let lastSyncTimeStr = 'Never synced';
    if (creds?.last_synced_at || creds?.updated_at) {
      const d = new Date(creds.last_synced_at || creds.updated_at);
      if (!isNaN(d.getTime())) {
        const isToday = d.toDateString() === new Date().toDateString();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastSyncTimeStr = isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${timeStr}`;
      }
    }

    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        lastSyncTime: lastSyncTimeStr,
        baseCurrency,
        currencySymbol: '£',
        currencyCode: baseCurrency,
        exchangeRates: {},
        kpis: {
          totalSales: 0,
          orders: 0,
          unitsSold: 0,
          amazonFees: 0,
          refunds: 0,
          netRevenue: 0,
          totalSalesGrowth: 0,
          ordersGrowth: 0,
          unitsGrowth: 0,
          feesGrowth: 0,
          refundsGrowth: 0,
          netRevenueGrowth: 0
        },
        salesBreakdown: { totalSales: 0, items: [] },
        salesTrend: [],
        topSellingProducts: [],
        orderStatusBreakdown: [],
        marketplaceSales: [],
        recentOrders: []
      });
    }

    let whereClause = `WHERE tenant_id = $1`;
    let queryParams: any[] = [tenantId];

    if (marketplace !== 'all') {
      const codeMap: Record<string, string> = {
        'IN': 'IN',
        'US': 'US',
        'UK': 'GB',
        'GB': 'GB',
        'DE': 'DE'
      };
      const country = codeMap[marketplace.toUpperCase()] || marketplace;
      whereClause += ` AND (ship_country ILIKE $2 OR sales_channel ILIKE $3)`;
      queryParams.push(country, `%${marketplace}%`);
    }

    // Query Amazon Orders from PostgreSQL for current tenant only
    const ordersRes = await db.query(
      `SELECT amazon_order_id, purchase_date, buyer_name, order_total_amount, currency, order_status, sales_channel, amazon_fees, refund_amount, number_of_items_shipped, ship_country
       FROM amazon_orders
       ${whereClause}
       ORDER BY id DESC`,
      queryParams
    );

    const orders = ordersRes.rows || [];

    // Query Amazon Order Items from PostgreSQL (filtered by fetched order IDs for current tenant)
    const orderIds = orders.map((o: any) => o.amazon_order_id);
    let itemsRes = { rows: [] as any[] };
    if (orderIds.length > 0) {
      itemsRes = await db.query(
        `SELECT order_item_id, amazon_order_id, asin, seller_sku, title, quantity_ordered, item_price, shipping_price, promotion_discount
         FROM amazon_order_items
         WHERE amazon_order_id = ANY($1::text[])`,
        [orderIds]
      );
    }

    const items = itemsRes.rows || [];

    // Calculate aggregated metrics — all amounts converted to baseCurrency
    let totalSales = 0;
    let totalOrders = orders.length;
    let unitsSold = 0;
    let totalFees = 0;
    let totalRefunds = 0;

    orders.forEach((ord: any) => {
      const currency = (ord.currency || 'GBP').toUpperCase();
      const amt = toBase(parseFloat(ord.order_total_amount || 0), currency);
      const fee = toBase(parseFloat(ord.amazon_fees || 0), currency);
      const ref = toBase(parseFloat(ord.refund_amount || 0), currency);
      totalSales += amt;
      totalFees += fee;
      totalRefunds += ref;
      unitsSold += parseInt(ord.number_of_items_shipped || 1);
    });

    const netRevenue = totalSales - totalFees - totalRefunds;

    // Calculate Sales Breakdown (Product sales, shipping, promotions, refunds) — all in baseCurrency
    let shippingCharges = 0;
    let promotions = 0;
    items.forEach((it: any) => {
      // Join with order to get currency — fallback to GBP
      const ord = orders.find((o: any) => o.amazon_order_id === it.amazon_order_id);
      const currency = (ord?.currency || 'GBP').toUpperCase();
      shippingCharges += toBase(parseFloat(it.shipping_price || 0), currency);
      promotions += toBase(parseFloat(it.promotion_discount || 0), currency);
    });

    const productSales = Math.max(0, totalSales - shippingCharges);
    const denominator = totalSales > 0 ? totalSales : 1;

    const salesBreakdown = {
      totalSales,
      items: [
        { label: 'Product Sales', pct: `${Math.round((productSales / denominator) * 1000) / 10}%`, amount: productSales, color: 'bg-blue-600' },
        { label: 'Shipping Charges', pct: `${Math.round((shippingCharges / denominator) * 1000) / 10}%`, amount: shippingCharges, color: 'bg-blue-400' },
        { label: 'Promotions', pct: `-${Math.round((promotions / denominator) * 1000) / 10}%`, amount: -promotions, color: 'bg-amber-400' },
        { label: 'Refunds', pct: `-${Math.round((totalRefunds / denominator) * 1000) / 10}%`, amount: -totalRefunds, color: 'bg-red-500' }
      ]
    };

    // Calculate Sales Trend grouped by date
    const trendMap: Record<string, { sales: number; orders: number }> = {};
    orders.forEach((o: any) => {
      const d = o.purchase_date ? new Date(o.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent';
      if (!trendMap[d]) {
        trendMap[d] = { sales: 0, orders: 0 };
      }
      const currency = (o.currency || 'GBP').toUpperCase();
      trendMap[d].sales += toBase(parseFloat(o.order_total_amount || 0), currency);
      trendMap[d].orders += 1;
    });

    const salesTrend = Object.keys(trendMap).map(day => ({
      day,
      sales: trendMap[day].sales,
      orders: trendMap[day].orders
    })).reverse();

    // Aggregate Top Selling Products from amazon_order_items
    const productMap: Record<string, { asin: string; title: string; unitsSold: number; revenue: number }> = {};
    items.forEach((it: any) => {
      const asin = it.asin || 'UNKNOWN';
      if (!productMap[asin]) {
        productMap[asin] = {
          asin,
          title: it.title || 'Amazon Product',
          unitsSold: 0,
          revenue: 0
        };
      }
      const ord = orders.find((o: any) => o.amazon_order_id === it.amazon_order_id);
      const currency = (ord?.currency || 'GBP').toUpperCase();
      productMap[asin].unitsSold += parseInt(it.quantity_ordered || 1);
      productMap[asin].revenue += toBase(parseFloat(it.item_price || 0), currency);
    });

    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);

    // Calculate Order Status Breakdown from amazon_orders
    const statusCounts: Record<string, number> = { Shipped: 0, Delivered: 0, Pending: 0, Cancelled: 0, Returned: 0 };
    orders.forEach((o: any) => {
      const st = o.order_status || 'Shipped';
      if (statusCounts[st] !== undefined) {
        statusCounts[st]++;
      } else {
        statusCounts['Shipped']++;
      }
    });

    const totalStatusCount = orders.length || 1;
    const statusColors: Record<string, string> = {
      Shipped: 'bg-emerald-500',
      Delivered: 'bg-blue-500',
      Pending: 'bg-amber-500',
      Cancelled: 'bg-red-500',
      Returned: 'bg-orange-500'
    };

    const orderStatusBreakdown = Object.keys(statusCounts).map(status => ({
      status,
      count: statusCounts[status],
      pct: `${Math.round(((statusCounts[status] / totalStatusCount) * 100) * 10) / 10}%`,
      color: statusColors[status] || 'bg-slate-500'
    }));

    // Calculate Marketplace Wise Sales from amazon_orders for active tenant
    const marketMap: Record<string, { name: string; code: string; amount: number; orders: number; flag: string }> = {
      'IN': { name: 'Amazon India', code: 'IN', amount: 0, orders: 0, flag: '🇮🇳' },
      'US': { name: 'Amazon US', code: 'US', amount: 0, orders: 0, flag: '🇺🇸' },
      'GB': { name: 'Amazon UK', code: 'UK', amount: 0, orders: 0, flag: '🇬🇧' },
      'DE': { name: 'Amazon DE', code: 'DE', amount: 0, orders: 0, flag: '🇩🇪' }
    };

    let overallMarketTotal = 0;
    orders.forEach((o: any) => {
      const currency = (o.currency || 'GBP').toUpperCase();
      const amt = toBase(parseFloat(o.order_total_amount || 0), currency);
      overallMarketTotal += amt;
      const country = (o.ship_country || 'IN').toUpperCase();
      const codeKey = country === 'GB' ? 'GB' : (country === 'UK' ? 'GB' : country);
      if (marketMap[codeKey]) {
        marketMap[codeKey].amount += amt;
        marketMap[codeKey].orders += 1;
      } else {
        marketMap['IN'].amount += amt;
        marketMap['IN'].orders += 1;
      }
    });

    const marketplaceSales = Object.values(marketMap).map(m => ({
      ...m,
      pct: overallMarketTotal > 0 ? `${Math.round(((m.amount / overallMarketTotal) * 100) * 10) / 10}%` : '0%'
    }));

    // Format Recent Orders — amounts converted to baseCurrency
    const recentOrders = orders.slice(0, 10).map((o: any) => {
      const currency = (o.currency || 'GBP').toUpperCase();
      return {
        orderId: o.amazon_order_id,
        date: o.purchase_date ? new Date(o.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        customer: o.buyer_name || 'Amazon Buyer',
        originalAmount: parseFloat(o.order_total_amount || 0),
        originalCurrency: o.currency || 'GBP',
        amount: toBase(parseFloat(o.order_total_amount || 0), currency),
        status: o.order_status || 'Shipped',
        marketplace: o.sales_channel || 'Amazon'
      };
    });

    // Currency symbol map for base currency display
    const currencySymbolMap: Record<string, string> = {
      GBP: '£', USD: '$', EUR: '€', INR: '₹', CAD: 'CA$', AUD: 'A$', JPY: '¥', SGD: 'S$'
    };
    const activeCurrencySymbol = currencySymbolMap[baseCurrency] || baseCurrency;

    // Build exchange rate table to send to frontend for info display
    const exchangeRates: Record<string, number> = {};
    ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'].forEach(c => {
      if (ratesFromBase[c]) exchangeRates[c] = parseFloat((ratesFromBase[c]).toFixed(4));
    });
    exchangeRates[baseCurrency] = 1;

    // Calculate Dynamic Growth Percentages from PostgreSQL orders (current vs previous period)
    const sortedDates = orders.map((o: any) => o.purchase_date ? new Date(o.purchase_date).getTime() : 0).filter((t: number) => t > 0).sort((a: number, b: number) => b - a);
    const maxTime = sortedDates[0] || Date.now();
    const halfPeriodMs = 15 * 24 * 60 * 60 * 1000; // 15 days midpoint for comparison

    let currentSales = 0, prevSales = 0;
    let currentOrders = 0, prevOrders = 0;
    let currentUnits = 0, prevUnits = 0;
    let currentFees = 0, prevFees = 0;
    let currentRefunds = 0, prevRefunds = 0;

    orders.forEach((ord: any) => {
      const pTime = ord.purchase_date ? new Date(ord.purchase_date).getTime() : 0;
      const currency = (ord.currency || 'GBP').toUpperCase();
      const amt = toBase(parseFloat(ord.order_total_amount || 0), currency);
      const fee = toBase(parseFloat(ord.amazon_fees || 0), currency);
      const ref = toBase(parseFloat(ord.refund_amount || 0), currency);
      const uCount = parseInt(ord.number_of_items_shipped || 1);

      if (maxTime - pTime <= halfPeriodMs) {
        currentSales += amt;
        currentOrders += 1;
        currentUnits += uCount;
        currentFees += fee;
        currentRefunds += ref;
      } else {
        prevSales += amt;
        prevOrders += 1;
        prevUnits += uCount;
        prevFees += fee;
        prevRefunds += ref;
      }
    });

    const currentNet = currentSales - currentFees - currentRefunds;
    const prevNet = prevSales - prevFees - prevRefunds;

    function calcGrowth(curr: number, prev: number): number {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
    }

    const totalSalesGrowth = calcGrowth(currentSales, prevSales);
    const ordersGrowth = calcGrowth(currentOrders, prevOrders);
    const unitsGrowth = calcGrowth(currentUnits, prevUnits);
    const feesGrowth = calcGrowth(currentFees, prevFees);
    const refundsGrowth = calcGrowth(currentRefunds, prevRefunds);
    const netRevenueGrowth = calcGrowth(currentNet, prevNet);

    return NextResponse.json({
      connected: isConnected,
      lastSyncTime: lastSyncTimeStr,
      baseCurrency,
      currencySymbol: activeCurrencySymbol,
      currencyCode: baseCurrency,
      exchangeRates,
      kpis: {
        totalSales,
        orders: totalOrders,
        unitsSold,
        amazonFees: totalFees,
        refunds: totalRefunds,
        netRevenue,
        totalSalesGrowth,
        ordersGrowth,
        unitsGrowth,
        feesGrowth,
        refundsGrowth,
        netRevenueGrowth
      },
      salesBreakdown,
      salesTrend,
      topSellingProducts: topProducts,
      orderStatusBreakdown,
      marketplaceSales,
      recentOrders
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch Amazon dashboard data' }, { status: 500 });
  }
}


