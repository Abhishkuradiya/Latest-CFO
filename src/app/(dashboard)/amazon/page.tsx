"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSidebarStore } from '@/store/sidebar-store';
import {
  RefreshCw,
  Globe,
  Calendar,
  DollarSign,
  Clock,
  ChevronDown,
  ShoppingCart,
  BarChart3,
  Package,
  PackageCheck,
  Receipt,
  Wallet,
  Plus,
  TrendingUp,
  ArrowRight,
  Check,
  CalendarDays,
  Lock,
  Download,
  AlertOctagon,
  AlertTriangle,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  PackageX,
  Sparkles,
  Tag,
  Truck,
  Box,
  Unplug
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import WorldMapSvg from '@/components/WorldMapSvg';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register ECharts modules
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer
]);

// Helper function to get currency symbol
const getCurrencySymbol = (curr: string) => {
  switch (curr) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return '£';
  }
};

// Helper function to format currency values (raw, no conversion)
const formatCurrency = (amount: number, curr: string) => {
  const symbol = getCurrencySymbol(curr);
  return `${symbol}${amount.toLocaleString('en-IN')}`;
};

// Base currency for all raw amounts stored in state (GBP)
const BASE_CURRENCY = 'GBP';

// Helper function to format date display (e.g. 1 Aug 2026 - 30 Sep 2026)
const formatDateLabel = (startStr: string, endStr: string) => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return `${startStr} - ${endStr}`;
  const startFmt = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const endFmt = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startFmt} - ${endFmt}`;
};

// Compute timeline labels based on granularity and date range
const computeTimeline = (gran: 'daily' | 'weekly' | 'monthly', startStr: string, endStr: string) => {
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return ['Aug 9', 'Aug 12', 'Aug 15', 'Aug 18', 'Aug 21', 'Aug 24', 'Aug 27', 'Aug 30', 'Sep 2', 'Sep 5', 'Sep 7'];
  }

  if (gran === 'daily') {
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const step = Math.max(1, Math.floor(diffDays / 12));

    const dates: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      curr.setDate(curr.getDate() + step);
    }
    if (dates.length < 2) {
      dates.push(end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return dates;
  }

  if (gran === 'weekly') {
    const diffMs = end.getTime() - start.getTime();
    const diffWeeks = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
    const weeks: string[] = [];
    for (let i = 1; i <= Math.min(diffWeeks, 10); i++) {
      weeks.push(`Week ${i}`);
    }
    return weeks;
  }

  // Monthly
  const months: string[] = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (curr <= endMonth || months.length === 0) {
    months.push(curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    curr.setMonth(curr.getMonth() + 1);
    if (months.length >= 12) break;
  }
  return months;
};

export default function AmazonDashboardPage() {
  const { setCollapsed } = useSidebarStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedMarketplace = searchParams.get('marketplace') || 'all';
  const selectedCurrency = searchParams.get('currency') || 'GBP';
  const customStartDate = searchParams.get('from_date') || '2026-08-01';
  const customEndDate = searchParams.get('to_date') || '2026-09-30';

  const updateUrlParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, val]) => {
      params.set(key, val);
    });
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  };

  const modeParam = searchParams.get('mode') || 'live';
  const [dataMode, setDataMode] = useState<'live' | 'demo'>(modeParam === 'demo' ? 'demo' : 'live');

  // Keep dataMode synchronized with searchParams mode change
  useEffect(() => {
    const currentMode = searchParams.get('mode') === 'demo' ? 'demo' : 'live';
    if (dataMode !== currentMode) {
      setDataMode(currentMode);
    }
  }, [searchParams]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('Today, 10:42 AM');
  const [isAmazonConnected, setIsAmazonConnected] = useState<boolean>(false);

  const [activePreset, setActivePreset] = useState<string>('custom');
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState<boolean>(false);
  const [showFullCalendarModal, setShowFullCalendarModal] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 3-Second Demo Preloader State
  const [isDemoLoading, setIsDemoLoading] = useState<boolean>(false);
  const [demoProgress, setDemoProgress] = useState<number>(0);

  const triggerDemoPreloader = () => {
    setIsDemoLoading(true);
    setDemoProgress(0);

    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setDemoProgress(progress);

      if (elapsed >= duration) {
        clearInterval(interval);
        setDataMode('demo');
        updateUrlParams({ mode: 'demo' });
        setIsDemoLoading(false);
        toast.success('Connected to Virtual CFO Demo Data!');
      }
    }, 30);
  };

  const formatDateLabel = (startStr: string, endStr?: string) => {
    if (!startStr) return '';
    const formatSingle = (s: string) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    if (endStr) {
      return `${formatSingle(startStr)} – ${formatSingle(endStr)}`;
    }
    return formatSingle(startStr);
  };

  // Default exchange rates (GBP base) to guarantee instant calculation even before network fetch
  const DEFAULT_RATES: Record<string, number> = useMemo(() => ({
    GBP: 1.0,
    INR: 127.86,
    USD: 1.35,
    EUR: 1.16,
  }), []);

  // Frankfurter API exchange rates state
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Fetch live exchange rates from Frankfurter API (https://api.frankfurter.dev/v1/latest?base=GBP)
  useEffect(() => {
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${BASE_CURRENCY}`);
        if (!res.ok) throw new Error('Failed to fetch exchange rates from frankfurter.dev');
        const data = await res.json();
        if (data && data.rates) {
          setExchangeRates({ ...DEFAULT_RATES, ...data.rates, GBP: 1.0 });
        }
      } catch (err) {
        console.error('Frankfurter API error, trying fallback endpoint:', err);
        try {
          const resFallback = await fetch(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}`);
          if (resFallback.ok) {
            const dataFallback = await resFallback.json();
            if (dataFallback && dataFallback.rates) {
              setExchangeRates({ ...DEFAULT_RATES, ...dataFallback.rates, GBP: 1.0 });
            }
          }
        } catch (e) {
          console.error('Fallback Frankfurter API also failed, using default rates:', e);
        }
      } finally {
        setRatesLoading(false);
      }
    };
    fetchRates();
  }, [DEFAULT_RATES]);

  // Convert amount from base currency (GBP) to selected display currency using live rates
  const convertAmount = (amountInBase: number, targetCurrency: string): number => {
    if (!amountInBase) return 0;
    if (targetCurrency === BASE_CURRENCY) return amountInBase;
    const rate = exchangeRates[targetCurrency] || DEFAULT_RATES[targetCurrency] || 1;
    return Math.round(amountInBase * rate * 100) / 100;
  };

  // Format with conversion: converts from GBP base to target currency, then formats
  const formatConvertedCurrency = (amountInBase: number, targetCurrency: string): string => {
    const converted = convertAmount(amountInBase, targetCurrency);
    const symbol = getCurrencySymbol(targetCurrency);
    return `${symbol}${converted.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Fetch live Amazon data from PostgreSQL APIs (/api/amazon/dashboard and /api/amazon/raw-data)
  const fetchLiveData = useCallback(async () => {
    if (dataMode === 'demo') return;
    try {
      const [dashRes, rawRes] = await Promise.all([
        fetch(`/api/amazon/dashboard?marketplace=${selectedMarketplace}&base=${selectedCurrency}`),
        fetch('/api/amazon/raw-data')
      ]);

      let dashData: any = null;
      if (dashRes.ok) {
        dashData = await dashRes.json();
        setIsAmazonConnected(!!dashData.connected);
        if (dashData.lastSyncTime) {
          setLastSyncTime(dashData.lastSyncTime);
        }
        if (dashData && dashData.kpis) {
          setKpiMetrics({
            gmv: dashData.kpis.totalSales || 0,
            netRevenue: dashData.kpis.netRevenue || 0,
            orders: dashData.kpis.orders || 0,
            unitsSold: dashData.kpis.unitsSold || 0,
            amazonFees: dashData.kpis.amazonFees || 0,
            payouts: dashData.kpis.netRevenue || 0,
          });

          setMoneyFlowData({
            customerSales: dashData.kpis.totalSales || 0,
            discounts: 0,
            refunds: dashData.kpis.refunds || 0,
            amazonFees: dashData.kpis.amazonFees || 0,
            netProceeds: dashData.kpis.netRevenue || 0,
            payouts: dashData.kpis.netRevenue || 0,
          });

          if (dashData.salesTrend && dashData.salesTrend.length > 0) {
            setSalesTrendList(dashData.salesTrend);
          }

          if (dashData.marketplaceSales && dashData.marketplaceSales.length > 0) {
            setMarketplaceData((prev) => {
              const next: Record<string, any> = { ...prev };
              dashData.marketplaceSales.forEach((m: any) => {
                if (next[m.code]) {
                  next[m.code] = { 
                    ...next[m.code], 
                    sales: m.amount, 
                    orders: m.orders !== undefined ? m.orders : (m.amount > 0 ? Math.round(m.amount / 35) : 0) 
                  };
                }
              });
              return next as any;
            });
          }

          if (dashData.kpis.amazonFees || dashData.kpis.totalSales) {
            const tot = dashData.kpis.totalSales || 1;
            const fee = dashData.kpis.amazonFees || 0;
            const refFee = Math.round(fee * 0.6);
            const fbaFee = Math.round(fee * 0.35);
            const storFee = Math.round(fee * 0.05);
            setFeesData({
              referralFees: refFee,
              referralPct: `${((refFee / tot) * 100).toFixed(1)}%`,
              fbaFees: fbaFee,
              fbaPct: `${((fbaFee / tot) * 100).toFixed(1)}%`,
              storageFees: storFee,
              storagePct: `${((storFee / tot) * 100).toFixed(1)}%`,
              shippingFees: 0,
              shippingPct: '0.0%',
              otherFees: 0,
              otherPct: '0.0%',
              contributionProfit: dashData.kpis.netRevenue || 0,
              contributionMargin: `${((dashData.kpis.netRevenue / tot) * 100).toFixed(1)}%`,
            });
          }
        }
      }

      if (rawRes.ok) {
        const rawData = await rawRes.json();
        if (rawData.ordersFulfillmentSummary && rawData.ordersFulfillmentSummary[0]) {
          const sum = rawData.ordersFulfillmentSummary[0];
          const tot = parseInt(sum.shipped_count || 0) + parseInt(sum.pending_count || 0) + parseInt(sum.delivered_count || 0) || 1;
          setFulfillmentMetrics({
            pendingCount: parseInt(sum.pending_count || 0),
            pendingPct: `${((parseInt(sum.pending_count || 0) / tot) * 100).toFixed(1)}%`,
            unshippedCount: parseInt(sum.unshipped_count || 0),
            unshippedPct: `${((parseInt(sum.unshipped_count || 0) / tot) * 100).toFixed(1)}%`,
            shippedCount: parseInt(sum.shipped_count || 0),
            shippedPct: `${((parseInt(sum.shipped_count || 0) / tot) * 100).toFixed(1)}%`,
            deliveredCount: parseInt(sum.delivered_count || 0),
            deliveredPct: `${((parseInt(sum.delivered_count || 0) / tot) * 100).toFixed(1)}%`,
            returnedCount: parseInt(sum.returned_count || 0),
            returnedPct: `${((parseInt(sum.returned_count || 0) / tot) * 100).toFixed(1)}%`,
            lateShipmentRate: '0.0%',
            lateShipmentTrend: '0.0%',
            cancellationRate: '0.0%',
            cancellationTrend: '0.0%',
            ontimeDeliveryRate: '98.5%',
            ontimeDeliveryTrend: '+0.5%',
          });
        }

        const fba = rawData.tables?.fba_inventory_summary || 
                    rawData.fba_inventory_summary || 
                    (Array.isArray(rawData.fbaSummary) ? rawData.fbaSummary[0] : rawData.fbaSummary);

        if (fba && (fba.total_sellable_units !== undefined || fba.total_reserved_units !== undefined)) {
          const sellable = parseInt(fba.total_sellable_units ?? 0) || 0;
          const reserved = parseInt(fba.total_reserved_units ?? 0) || 0;
          const inbound = parseInt(fba.total_inbound_units ?? 0) || 0;
          const unfulfillable = parseInt(fba.total_unfulfillable_units ?? 0) || 0;
          let daysCover = parseFloat(fba.avg_days_of_cover ?? 0) || 0;
          
          if (daysCover === 0 && sellable > 0) {
            const unitsSold = dashData?.kpis?.unitsSold || 0;
            const avgDaily = unitsSold / 30;
            if (avgDaily > 0) {
              daysCover = Math.round((sellable / avgDaily) * 10) / 10;
            }
          }

          setInventoryMetrics({
            sellableUnits: sellable,
            reservedUnits: reserved,
            inboundUnits: inbound,
            unfulfillableUnits: unfulfillable,
            daysOfCover: daysCover,
            lowStockSkus: parseInt(fba.low_stock_skus_count ?? 0) || 0,
          });
        }

        const alertsList = rawData.tables?.amazon_inventory_alerts || rawData.amazon_inventory_alerts || [];
        const invList = rawData.tables?.amazon_inventory || rawData.amazon_inventory || [];

        if (alertsList && alertsList.length > 0) {
          setLowStockAlerts(
            alertsList.map((al: any) => ({
              id: String(al.id),
              sku: al.seller_sku,
              title: al.title || al.seller_sku,
              unitsLeft: parseInt(al.current_stock || 0),
              image: al.image_url || '/Amazon_icon.png',
            }))
          );
        } else if (invList && invList.length > 0) {
          const lowStockItems = invList.filter((inv: any) => 
            parseInt(inv.fulfillable_quantity || 0) <= 15 || parseFloat(inv.days_of_cover || 0) < 14 || inv.is_low_stock
          );
          setLowStockAlerts(
            lowStockItems.map((inv: any) => ({
              id: String(inv.id),
              sku: inv.seller_sku,
              title: inv.seller_sku,
              unitsLeft: parseInt(inv.fulfillable_quantity || 0),
              image: '/Amazon_icon.png',
            }))
          );
        }

        if (rawData.productIntelligence && rawData.productIntelligence.length > 0) {
          setProductIntelligenceList(
            rawData.productIntelligence.map((p: any, idx: number) => {
              const reviewItem = (rawData.itemReviewTrends || []).find((r: any) => r.asin === p.asin);
              return {
                rank: idx + 1,
                title: p.title || 'Amazon Product',
                asin: p.asin,
                sku: p.seller_sku || p.asin,
                unitsSold: parseInt(p.units_sold || 0),
                revenue: parseFloat(p.gross_revenue || 0),
                fees: parseFloat(p.amazon_fees || 0),
                margin: parseFloat(p.margin_percentage || 35),
                marginWarning: parseFloat(p.margin_percentage || 35) < 20,
                inventory: parseInt(p.inventory_units || 100),
                bsrRank: `#${p.sales_rank || idx + 1} in Category`,
                trend: 'up',
                image: p.image_url || '/Amazon_icon.png',
                rating: parseFloat(reviewItem?.average_rating || 4.75),
                reviewsCount: parseInt(reviewItem?.total_reviews || 342)
              };
            })
          );
        } else if (rawData.products && rawData.products.length > 0) {
          setProductIntelligenceList(
            rawData.products.map((p: any, idx: number) => ({
              rank: idx + 1,
              title: p.title || 'Amazon Product',
              asin: p.asin,
              sku: p.seller_sku || p.asin,
              unitsSold: parseInt(p.units_sold || 10),
              revenue: parseFloat(p.price || 29.99) * 10,
              fees: parseFloat(p.price || 29.99) * 1.5,
              margin: 35.0,
              marginWarning: false,
              inventory: 150,
              bsrRank: `#${p.sales_rank || idx + 1} in Category`,
              trend: 'up',
              image: p.image_url || '/Amazon_icon.png',
              rating: 4.75,
              reviewsCount: 342
            }))
          );
        }

        if (rawData.payoutsSummary && rawData.payoutsSummary[0]) {
          const pay = rawData.payoutsSummary[0];
          setPayoutsCashData({
            nextPayout: parseFloat(pay.available_balance || 0),
            nextPayoutDate: pay.next_payout_estimated_date ? new Date(pay.next_payout_estimated_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Sep 2026',
            unsettledBalance: parseFloat(pay.unsettled_balance || 0),
            releasedBalance: parseFloat(pay.total_payouts_received || 0),
            recentPayouts: (rawData.settlements || []).slice(0, 5).map((s: any) => ({
              id: s.settlement_id || `SETTLE-${s.id}`,
              date: s.deposit_date ? new Date(s.deposit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
              amount: parseFloat(s.total_amount || 0),
              status: 'Completed'
            }))
          });
        }
      }
    } catch (err) {
      console.error('Error fetching live Amazon data:', err);
    }
  }, [selectedMarketplace, selectedCurrency, dataMode]);

  useEffect(() => {
    const handleSyncComplete = () => {
      const now = new Date();
      const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setLastSyncTime(timeStr);
      fetchLiveData();
    };
    window.addEventListener('amazon-sync-complete', handleSyncComplete);
    return () => window.removeEventListener('amazon-sync-complete', handleSyncComplete);
  }, [fetchLiveData]);

  // Business Performance Graph Granularity & Sales Trend State
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [salesTrendList, setSalesTrendList] = useState<Array<{ day: string; sales: number; orders: number }>>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const moneyFlowRef = useRef<HTMLDivElement>(null);
  const inventoryChartRef = useRef<HTMLDivElement>(null);
  const refundChartRef = useRef<HTMLDivElement>(null);
  const feesDonutRef = useRef<HTMLDivElement>(null);

  // Returns & Refunds metrics state - initialized to 0 default values
  const [refundMetrics, setRefundMetrics] = useState({
    refundRate: '0.0%',
    refundRateTrend: '0.0%',
    returnUnits: 0,
    returnUnitsTrend: '0.0%',
    refundValue: 0,
    refundValueTrend: '0.0%',
  });

  // Top Returned Products list - empty default
  const [topReturnedProducts, setTopReturnedProducts] = useState<Array<{ id: string; title: string; count: number; image: string }>>([]);

  // Inventory & FBA metrics state - initialized to 0 default values for future integration
  const [inventoryMetrics, setInventoryMetrics] = useState({
    sellableUnits: 0,
    reservedUnits: 0,
    inboundUnits: 0,
    unfulfillableUnits: 0,
    daysOfCover: 0,
    lowStockSkus: 0,
  });

  // Low Stock Alerts items list - empty default
  const [lowStockAlerts, setLowStockAlerts] = useState<Array<{ id: string; sku: string; title: string; unitsLeft: number; image: string }>>([]);

  // Orders & Fulfillment metrics state - initialized to 0 default values
  const [fulfillmentMetrics, setFulfillmentMetrics] = useState({
    pendingCount: 0,
    pendingPct: '0.0%',
    unshippedCount: 0,
    unshippedPct: '0.0%',
    shippedCount: 0,
    shippedPct: '0.0%',
    deliveredCount: 0,
    deliveredPct: '0.0%',
    returnedCount: 0,
    returnedPct: '0.0%',
    lateShipmentRate: '0.0%',
    lateShipmentTrend: '0.0%',
    cancellationRate: '0.0%',
    cancellationTrend: '0.0%',
    ontimeDeliveryRate: '0.0%',
    ontimeDeliveryTrend: '0.0%',
  });

  // Marketplace filter state
  const [mpMetricFilter, setMpMetricFilter] = useState<'sales' | 'orders' | 'growth'>('sales');

  // KPI metrics state - initialized to 0 default values for future integration
  const [kpiMetrics, setKpiMetrics] = useState({
    gmv: 0,
    netRevenue: 0,
    orders: 0,
    unitsSold: 0,
    amazonFees: 0,
    payouts: 0,
  });

  // Money Flow breakdown state - initialized to 0 default values
  const [moneyFlowData, setMoneyFlowData] = useState({
    customerSales: 0,
    discounts: 0,
    refunds: 0,
    amazonFees: 0,
    netProceeds: 0,
    payouts: 0,
  });

  // Marketplace performance data - initialized to 0 default values
  const [marketplaceData, setMarketplaceData] = useState({
    IN: { id: 'IN', name: 'Amazon India', flag: '🇮🇳', sales: 0, orders: 0, growth: '+0.0%' },
    US: { id: 'US', name: 'Amazon US', flag: '🇺🇸', sales: 0, orders: 0, growth: '+0.0%' },
    UK: { id: 'GB', name: 'Amazon UK', flag: '🇬🇧', sales: 0, orders: 0, growth: '+0.0%' },
    DE: { id: 'DE', name: 'Amazon DE', flag: '🇩🇪', sales: 0, orders: 0, growth: '+0.0%' },
  });

  // Product Intelligence tab filter state
  const [productTab, setProductTab] = useState<'best_sellers' | 'low_margin' | 'low_stock' | 'fast_growing'>('best_sellers');

  // Product Intelligence list state - initialized to empty default
  const [productIntelligenceList, setProductIntelligenceList] = useState<Array<{
    rank: number;
    title: string;
    asin: string;
    sku: string;
    unitsSold: number;
    revenue: number;
    fees: number;
    margin: number;
    marginWarning: boolean;
    inventory: number;
    bsrRank: string;
    trend: string;
    image: string;
    rating?: number;
    reviewsCount?: number;
  }>>([]);

  // Fees & Profitability data state - initialized to 0 default values
  const [feesData, setFeesData] = useState({
    referralFees: 0,
    referralPct: '0.0%',
    fbaFees: 0,
    fbaPct: '0.0%',
    storageFees: 0,
    storagePct: '0.0%',
    shippingFees: 0,
    shippingPct: '0.0%',
    otherFees: 0,
    otherPct: '0.0%',
    contributionProfit: 0,
    contributionMargin: '0.0%',
  });

  // Payouts & Cash data state - initialized to 0 default values
  const [payoutsCashData, setPayoutsCashData] = useState({
    nextPayout: 0,
    nextPayoutDate: '-',
    unsettledBalance: 0,
    releasedBalance: 0,
    recentPayouts: [] as Array<{ id: string; date: string; amount: number; status: string }>,
  });

  // AI CFO Insights data state - initialized to empty default
  const [aiInsightsList, setAiInsightsList] = useState<Array<{
    id: number;
    type: string;
    title: string;
    subtitle: string;
  }>>([]);

  // Compute filtered product intelligence list
  const filteredProducts = useMemo(() => {
    switch (productTab) {
      case 'low_margin':
        return [...productIntelligenceList].sort((a, b) => a.margin - b.margin);
      case 'low_stock':
        return [...productIntelligenceList].sort((a, b) => a.inventory - b.inventory);
      case 'fast_growing':
        return [...productIntelligenceList].filter((p) => p.trend === 'up');
      case 'best_sellers':
      default:
        return productIntelligenceList;
    }
  }, [productTab, productIntelligenceList]);

  // Fetch live Amazon data on component mount & when parameters change
  useEffect(() => {
    if (dataMode !== 'demo') {
      fetchLiveData();
    }
  }, [dataMode, fetchLiveData]);

  // Populate or reset sample demo data based on dataMode switch
  useEffect(() => {
    if (dataMode === 'demo') {
      setKpiMetrics({
        gmv: 42850,
        netRevenue: 35410,
        orders: 1420,
        unitsSold: 1890,
        amazonFees: 7440,
        payouts: 27970,
      });

      setMoneyFlowData({
        customerSales: 42850,
        discounts: 1200,
        refunds: 1800,
        amazonFees: 7440,
        netProceeds: 32410,
        payouts: 27970,
      });

      setMarketplaceData({
        IN: { id: 'IN', name: 'Amazon India', flag: '🇮🇳', sales: 15400, orders: 580, growth: '+14.2%' },
        US: { id: 'US', name: 'Amazon US', flag: '🇺🇸', sales: 18200, orders: 610, growth: '+18.5%' },
        UK: { id: 'GB', name: 'Amazon UK', flag: '🇬🇧', sales: 6850, orders: 170, growth: '+8.1%' },
        DE: { id: 'DE', name: 'Amazon DE', flag: '🇩🇪', sales: 2400, orders: 60, growth: '+3.4%' },
      });

      setFulfillmentMetrics({
        pendingCount: 42,
        pendingPct: '3.0%',
        unshippedCount: 18,
        unshippedPct: '1.2%',
        shippedCount: 1360,
        shippedPct: '95.8%',
        deliveredCount: 1290,
        deliveredPct: '90.8%',
        returnedCount: 38,
        returnedPct: '2.7%',
        lateShipmentRate: '0.4%',
        lateShipmentTrend: '-0.1%',
        cancellationRate: '0.2%',
        cancellationTrend: '0.0%',
        ontimeDeliveryRate: '98.6%',
        ontimeDeliveryTrend: '+0.5%',
      });

      setInventoryMetrics({
        sellableUnits: 4250,
        reservedUnits: 320,
        inboundUnits: 850,
        unfulfillableUnits: 45,
        daysOfCover: 28,
        lowStockSkus: 3,
      });

      setFeesData({
        referralFees: 3850,
        referralPct: '9.0%',
        fbaFees: 2400,
        fbaPct: '5.6%',
        storageFees: 690,
        storagePct: '1.6%',
        shippingFees: 500,
        shippingPct: '1.2%',
        otherFees: 0,
        otherPct: '0.0%',
        contributionProfit: 27970,
        contributionMargin: '65.3%',
      });

      setPayoutsCashData({
        nextPayout: 6450,
        nextPayoutDate: '15 Sep 2026',
        unsettledBalance: 2420,
        releasedBalance: 19100,
        recentPayouts: [
          { id: 'PAY-8921', date: '01 Sep 2026', amount: 8920, status: 'Completed' },
          { id: 'PAY-8840', date: '18 Aug 2026', amount: 10180, status: 'Completed' },
        ],
      });

      setProductIntelligenceList([
        {
          rank: 1,
          title: 'Wireless Ergonomic Keyboard - Matte Black',
          asin: 'B09X1K89L',
          sku: 'KB-WL-01',
          unitsSold: 420,
          revenue: 14700,
          fees: 2205,
          margin: 42.5,
          marginWarning: false,
          inventory: 850,
          bsrRank: '#12 in Electronics',
          trend: 'up',
          image: '/Amazon_icon.png',
        },
        {
          rank: 2,
          title: 'USB-C Fast Charging Cable 2m (Pack of 2)',
          asin: 'B08Y2M45K',
          sku: 'CB-USBC-2M',
          unitsSold: 610,
          revenue: 9150,
          fees: 1830,
          margin: 18.2,
          marginWarning: true,
          inventory: 140,
          bsrRank: '#45 in Accessories',
          trend: 'down',
          image: '/Amazon_icon.png',
        },
        {
          rank: 3,
          title: 'Noise Cancelling Headphones Pro',
          asin: 'B07Z3N78P',
          sku: 'HP-NC-PRO',
          unitsSold: 180,
          revenue: 12600,
          fees: 2142,
          margin: 38.0,
          marginWarning: false,
          inventory: 420,
          bsrRank: '#8 in Audio',
          trend: 'up',
          image: '/Amazon_icon.png',
        },
      ]);

      setAiInsightsList([
        {
          id: 1,
          type: 'profit',
          title: 'FBA Fee Spike Detected on USB-C Cables',
          subtitle: 'Dimensional weight calculation increased FBA fee by £0.80 per unit. Request remeasurement to save ~£480/month.',
        },
        {
          id: 2,
          type: 'inventory',
          title: 'Low Stock Risk: USB-C Fast Cable 2m',
          subtitle: 'Current inventory (140 units) covers only 7 days at current sales velocity. Reorder 500 units to avoid stockout.',
        },
      ]);

      setLowStockAlerts([
        {
          id: '1',
          sku: 'CB-USBC-2M',
          title: 'USB-C Fast Cable 2m',
          unitsLeft: 14,
          image: '/Amazon_icon.png',
        },
        {
          id: '2',
          sku: 'KB-WL-01',
          title: 'Ergonomic Keyboard',
          unitsLeft: 8,
          image: '/Amazon_icon.png',
        },
      ]);

      setRefundMetrics({
        refundRate: '4.2%',
        refundRateTrend: '-0.5%',
        returnUnits: 38,
        returnUnitsTrend: '-12.0%',
        refundValue: 1800,
        refundValueTrend: '-8.4%',
      });

      setTopReturnedProducts([
        { id: '1', title: 'USB-C Fast Cable 2m', count: 24, image: '/Amazon_icon.png' },
        { id: '2', title: 'Ergonomic Keyboard', count: 9, image: '/Amazon_icon.png' },
        { id: '3', title: 'Headphones Pro', count: 5, image: '/Amazon_icon.png' },
      ]);
    }
  }, [dataMode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePickerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute timeline dates based on granularity and custom date range
  const datesList = useMemo(() => {
    return computeTimeline(granularity, customStartDate, customEndDate);
  }, [granularity, customStartDate, customEndDate]);

  // Compute chart series data (Demo data converted with Frankfurter API rates, or live DB series)
  const chartSeriesData = useMemo(() => {
    if (dataMode === 'demo') {
      const baseSales = [1200, 1450, 1100, 1800, 2100, 1600, 1950, 2300, 2150, 2500, 2800, 3100];
      const baseNetRevenue = [980, 1200, 910, 1490, 1730, 1320, 1610, 1900, 1770, 2060, 2310, 2560];
      const baseFees = [220, 250, 190, 310, 370, 280, 340, 400, 380, 440, 490, 540];
      const baseOrders = [42, 51, 38, 62, 74, 56, 68, 80, 75, 88, 98, 108];

      // Convert GBP base amounts to selected currency using Frankfurter rates
      return {
        sales: baseSales.map(v => convertAmount(v, selectedCurrency)),
        netRevenue: baseNetRevenue.map(v => convertAmount(v, selectedCurrency)),
        amazonFees: baseFees.map(v => convertAmount(v, selectedCurrency)),
        orders: baseOrders,
      };
    }

    if (salesTrendList && salesTrendList.length > 0) {
      const len = datesList.length || 7;
      const salesArr = new Array(len).fill(0);
      const ordersArr = new Array(len).fill(0);

      salesTrendList.forEach(item => {
        const itemDate = new Date(item.day + ', ' + new Date().getFullYear());
        let bestIdx = len - 1;
        let minDiff = Infinity;

        datesList.forEach((d, idx) => {
          const dDate = new Date(d + ', ' + new Date().getFullYear());
          if (!isNaN(dDate.getTime()) && !isNaN(itemDate.getTime())) {
            const diff = Math.abs(itemDate.getTime() - dDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              bestIdx = idx;
            }
          }
        });

        const amt = convertAmount(item.sales, selectedCurrency);
        salesArr[bestIdx] = Math.round((salesArr[bestIdx] + amt) * 100) / 100;
        ordersArr[bestIdx] += item.orders;
      });

      const feesArr = salesArr.map(s => Math.round(s * 0.15 * 100) / 100);
      const netArr = salesArr.map((s, idx) => Math.round((s - feesArr[idx]) * 100) / 100);

      return {
        sales: salesArr,
        netRevenue: netArr,
        amazonFees: feesArr,
        orders: ordersArr,
      };
    }

    if (kpiMetrics.gmv > 0) {
      const len = datesList.length || 7;
      const lastIdx = len - 1;
      const salesArr = new Array(len).fill(0);
      const ordersArr = new Array(len).fill(0);
      const feesArr = new Array(len).fill(0);
      const netArr = new Array(len).fill(0);

      const baseSale = convertAmount(kpiMetrics.gmv, selectedCurrency);
      const baseFee = convertAmount(kpiMetrics.amazonFees, selectedCurrency);
      const baseNet = convertAmount(kpiMetrics.netRevenue, selectedCurrency);

      salesArr[lastIdx] = Math.round(baseSale * 0.6 * 100) / 100;
      salesArr[Math.max(0, lastIdx - 1)] = Math.round(baseSale * 0.4 * 100) / 100;

      feesArr[lastIdx] = Math.round(baseFee * 0.6 * 100) / 100;
      feesArr[Math.max(0, lastIdx - 1)] = Math.round(baseFee * 0.4 * 100) / 100;

      netArr[lastIdx] = Math.round(baseNet * 0.6 * 100) / 100;
      netArr[Math.max(0, lastIdx - 1)] = Math.round(baseNet * 0.4 * 100) / 100;

      ordersArr[lastIdx] = Math.ceil(kpiMetrics.orders * 0.6);
      ordersArr[Math.max(0, lastIdx - 1)] = Math.ceil(kpiMetrics.orders * 0.4);

      return {
        sales: salesArr,
        netRevenue: netArr,
        amazonFees: feesArr,
        orders: ordersArr,
      };
    }

    const zeros = new Array(datesList.length).fill(0);
    return {
      sales: zeros,
      netRevenue: zeros,
      amazonFees: zeros,
      orders: zeros,
    };
  }, [datesList, dataMode, selectedCurrency, exchangeRates, salesTrendList, kpiMetrics]);

  // Auto-collapse sidebar when opening Amazon Dashboard
  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  // Preset Date Handlers
  const handleApplyPreset = (preset: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);

    switch (preset) {
      case '30d':
        start.setDate(today.getDate() - 30);
        break;
      case '7d':
        start.setDate(today.getDate() - 7);
        break;
      case 'today':
        break;
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'ytd':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case 'custom':
        start = new Date('2026-08-01');
        end = new Date('2026-09-30');
        break;
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    updateUrlParams({ from_date: startStr, to_date: endStr });
    setActivePreset(preset);
    setShowDatePickerDropdown(false);
  };

  // Handle Business Performance ECharts initialization and updates
  useEffect(() => {
    if (!chartRef.current) return;
    const chartInstance = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        axisPointer: { type: 'cross', crossStyle: { color: '#94a3b8' } },
        formatter: (params: any) => {
          let date = params[0]?.name || '';
          let res = `<div style="padding: 4px 6px;"><div style="font-weight:700; color:#F8FAFC; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:6px;">${date}</div>`;
          params.forEach((item: any) => {
            const isOrders = item.seriesName === 'Orders';
            const valStr = isOrders ? item.value : formatConvertedCurrency(item.value, selectedCurrency);
            res += `<div style="display:flex; justify-content:space-between; gap:14px; font-size:11px; margin-top:3px;">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="background-color: ${item.color}; width:8px; height:8px; border-radius:50%; inline-block;"></span>
                <span style="color:#CBD5E1;">${item.seriesName}</span>
              </span>
              <span style="font-weight:600; color:#FFFFFF;">${valStr}</span>
            </div>`;
          });
          res += `</div>`;
          return res;
        }
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '2%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: datesList,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 10, margin: 10 },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          name: '',
          min: 0,
          max: (value: any) => (value.max === 0 ? 1000 : undefined),
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            formatter: (val: number) => {
              if (val === 0) return '0';
              const sym = getCurrencySymbol(selectedCurrency);
              if (val >= 100000) return `${sym}${(val / 100000).toFixed(0)}L`;
              if (val >= 1000) return `${sym}${(val / 1000).toFixed(0)}K`;
              return `${sym}${val}`;
            }
          }
        },
        {
          type: 'value',
          name: '',
          min: 0,
          max: (value: any) => (value.max === 0 ? 100 : undefined),
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: '#64748b', fontSize: 10 }
        }
      ],
      series: [
        {
          name: 'Sales (GMV)',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#2563eb' },
          lineStyle: { width: 2.2, color: '#2563eb' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37, 99, 235, 0.22)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.0)' }
            ])
          },
          data: chartSeriesData.sales
        },
        {
          name: 'Net Revenue',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.2, color: '#10b981' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.18)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
            ])
          },
          data: chartSeriesData.netRevenue
        },
        {
          name: 'Amazon Fees',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#f97316' },
          lineStyle: { width: 2.2, color: '#f97316' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(249, 115, 22, 0.14)' },
              { offset: 1, color: 'rgba(249, 115, 22, 0.0)' }
            ])
          },
          data: chartSeriesData.amazonFees
        },
        {
          name: 'Orders',
          type: 'bar',
          yAxisIndex: 1,
          barWidth: '35%',
          itemStyle: {
            color: 'rgba(192, 132, 252, 0.45)',
            borderRadius: [4, 4, 0, 0]
          },
          data: chartSeriesData.orders
        }
      ]
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [chartSeriesData, datesList, selectedCurrency, exchangeRates]);

  // Handle Money Flow Waterfall ECharts initialization and updates
  useEffect(() => {
    if (!moneyFlowRef.current) return;
    const chartInstance = echarts.init(moneyFlowRef.current);

    const cSales = convertAmount(moneyFlowData.customerSales, selectedCurrency);
    const cDiscounts = convertAmount(moneyFlowData.discounts, selectedCurrency);
    const cRefunds = convertAmount(moneyFlowData.refunds, selectedCurrency);
    const cFees = convertAmount(moneyFlowData.amazonFees, selectedCurrency);
    const cProceeds = convertAmount(moneyFlowData.netProceeds, selectedCurrency);
    const cPayouts = convertAmount(moneyFlowData.payouts, selectedCurrency);

    // Waterfall offsets and values
    const placeholderData = [
      0,
      Math.max(0, cSales - cDiscounts),
      Math.max(0, cSales - cDiscounts - cRefunds),
      Math.max(0, cSales - cDiscounts - cRefunds - cFees),
      0,
      0
    ];

    const barValues = [
      cSales,
      cDiscounts,
      cRefunds,
      cFees,
      cProceeds,
      cPayouts
    ];

    const categories = [
      'Customer\nSales',
      'Discounts\n& Promos',
      'Refunds',
      'Amazon\nFees (FBA etc.)',
      'Net\nProceeds',
      'Payouts\n(Received)'
    ];

    const barColors = ['#3B82F6', '#F87171', '#F87171', '#EF4444', '#4ADE80', '#10B981'];

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        formatter: (params: any) => {
          const item = params[1] || params[0];
          if (!item) return '';
          const name = item.name.replace('\n', ' ');
          const isNegative = item.dataIndex >= 1 && item.dataIndex <= 3;
          const valStr = formatConvertedCurrency(item.value, selectedCurrency);
          const prefix = isNegative && item.value > 0 ? '-' : '';
          return `<div style="padding:4px 6px;">
            <div style="font-weight:700; color:#F8FAFC; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:6px;">${name}</div>
            <div style="font-size:12px; font-weight:600; color:${item.color}">${prefix}${valStr}</div>
          </div>`;
        }
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '2%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 9.5,
          interval: 0,
          lineHeight: 12
        },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: (value: any) => (value.max === 0 ? 1000 : undefined),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (val: number) => {
            if (val === 0) return '0';
            const sym = getCurrencySymbol(selectedCurrency);
            if (val >= 100000) return `${sym}${(val / 100000).toFixed(0)}L`;
            if (val >= 1000) return `${sym}${(val / 1000).toFixed(0)}K`;
            return `${sym}${val}`;
          }
        }
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent'
          },
          emphasis: {
            itemStyle: {
              borderColor: 'transparent',
              color: 'transparent'
            }
          },
          data: placeholderData
        },
        {
          name: 'Amount',
          type: 'bar',
          stack: 'Total',
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            fontWeight: 'bold',
            color: (param: any) => {
              if (param.dataIndex >= 1 && param.dataIndex <= 3) return '#EF4444';
              return '#0F172A';
            },
            formatter: (param: any) => {
              const val = param.value;
              const isNegative = param.dataIndex >= 1 && param.dataIndex <= 3;
              const sym = getCurrencySymbol(selectedCurrency);
              const prefix = isNegative && val > 0 ? '-' : '';
              return `${prefix}${sym}${val.toLocaleString('en-IN')}`;
            }
          },
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (param: any) => barColors[param.dataIndex] || '#3B82F6'
          },
          data: barValues
        }
      ]
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [moneyFlowData, selectedCurrency, exchangeRates]);

  // Handle Inventory Trend ECharts initialization and updates
  useEffect(() => {
    if (!inventoryChartRef.current) return;
    const chartInstance = echarts.getInstanceByDom(inventoryChartRef.current) || echarts.init(inventoryChartRef.current);

    const sellableVal = inventoryMetrics.sellableUnits || 0;
    const inboundVal = inventoryMetrics.inboundUnits || 0;
    const reservedVal = inventoryMetrics.reservedUnits || 0;

    const sellableSeries = dataMode === 'demo'
      ? datesList.map((_, i) => [3800, 3950, 4100, 4050, 4200, 4150, 4250, 4300, 4220, 4180, 4250, 4310][i % 12])
      : datesList.map(() => sellableVal);

    const inboundSeries = dataMode === 'demo'
      ? datesList.map((_, i) => [600, 750, 800, 850, 700, 850, 900, 820, 870, 790, 840, 890][i % 12])
      : datesList.map(() => inboundVal);

    const reservedSeries = dataMode === 'demo'
      ? datesList.map((_, i) => [250, 280, 300, 310, 320, 315, 330, 325, 340, 335, 320, 350][i % 12])
      : datesList.map(() => reservedVal);

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        axisPointer: { type: 'cross', crossStyle: { color: '#94a3b8' } },
        formatter: (params: any) => {
          let date = params[0]?.name || '';
          let res = `<div style="padding: 4px 6px;"><div style="font-weight:700; color:#F8FAFC; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:6px;">${date}</div>`;
          params.forEach((item: any) => {
            res += `<div style="display:flex; justify-content:space-between; gap:14px; font-size:11px; margin-top:3px;">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="background-color: ${item.color}; width:8px; height:8px; border-radius:50%; inline-block;"></span>
                <span style="color:#CBD5E1;">${item.seriesName}</span>
              </span>
              <span style="font-weight:600; color:#FFFFFF;">${item.value.toLocaleString()}</span>
            </div>`;
          });
          res += `</div>`;
          return res;
        }
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '2%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: datesList,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 10, margin: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: (value: any) => (value.max === 0 ? 1000 : undefined),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: (val: number) => {
            if (val === 0) return '0';
            if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
            return val.toString();
          }
        }
      },
      series: [
        {
          name: 'Sellable',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#3B82F6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.25)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
            ])
          },
          itemStyle: { color: '#3B82F6' },
          data: sellableSeries
        },
        {
          name: 'Inbound',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#10B981' },
          itemStyle: { color: '#10B981' },
          data: inboundSeries
        },
        {
          name: 'Reserved',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          data: reservedSeries
        }
      ]
    };

    chartInstance.setOption(option, true);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [datesList, dataMode, inventoryMetrics]);

  // Handle Refund Trend ECharts initialization and updates
  useEffect(() => {
    if (!refundChartRef.current) return;
    const chartInstance = echarts.getInstanceByDom(refundChartRef.current) || echarts.init(refundChartRef.current);

    const trendValues = dataMode === 'demo'
      ? datesList.map((_, i) => [4.8, 4.5, 4.2, 4.0, 3.8, 4.1, 4.3, 4.0, 3.9, 4.2, 4.1, 4.2][i % 12])
      : datesList.map(() => 0);

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        formatter: (params: any) => {
          let date = params[0]?.name || '';
          let val = params[0]?.value || 0;
          return `<div style="padding: 4px 6px;">
            <div style="font-weight:700; color:#F8FAFC; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">${date}</div>
            <div style="font-size:11px; font-weight:600; color:#EF4444;">Refund Rate: ${val}%</div>
          </div>`;
        }
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '2%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: datesList,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', fontSize: 10, margin: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 6,
        interval: 2,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 10,
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: 'Refund Rate',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: '#EF4444' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239, 68, 68, 0.25)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }
            ])
          },
          itemStyle: { color: '#EF4444' },
          data: trendValues
        }
      ]
    };

    chartInstance.setOption(option, true);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [datesList, dataMode]);

  // Handle Fees & Profitability ECharts Donut Chart initialization and updates
  useEffect(() => {
    if (!feesDonutRef.current) return;

    let chartInstance = echarts.getInstanceByDom(feesDonutRef.current);
    if (!chartInstance) {
      chartInstance = echarts.init(feesDonutRef.current);
    }

    const refVal = feesData.referralFees > 0 ? feesData.referralFees : (dataMode === 'demo' ? 3850 : 0);
    const fbaVal = feesData.fbaFees > 0 ? feesData.fbaFees : (dataMode === 'demo' ? 2400 : 0);
    const storageVal = feesData.storageFees > 0 ? feesData.storageFees : (dataMode === 'demo' ? 690 : 0);
    const shippingVal = feesData.shippingFees > 0 ? feesData.shippingFees : (dataMode === 'demo' ? 500 : 0);
    const otherVal = feesData.otherFees || 0;

    const referralAmt = convertAmount(refVal, selectedCurrency);
    const fbaAmt = convertAmount(fbaVal, selectedCurrency);
    const storageAmt = convertAmount(storageVal, selectedCurrency);
    const shippingAmt = convertAmount(shippingVal, selectedCurrency);
    const otherAmt = convertAmount(otherVal, selectedCurrency);

    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        formatter: (params: any) => {
          const valStr = formatConvertedCurrency(params.value, selectedCurrency);
          return `<div style="padding: 4px 6px;">
            <div style="font-weight:700; color:#F8FAFC; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">${params.name}</div>
            <div style="font-size:11px; font-weight:600; color:${params.color}">${valStr} (${params.percent}%)</div>
          </div>`;
        }
      },
      legend: {
        orient: 'vertical',
        right: '4%',
        top: 'center',
        textStyle: { color: '#334155', fontSize: 11, fontWeight: '700' },
        itemGap: 12,
        icon: 'circle'
      },
      series: [
        {
          name: 'Amazon Fees',
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#ffffff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            scale: true,
            scaleSize: 6
          },
          labelLine: { show: false },
          data: [
            { value: referralAmt || 3850, name: 'Referral Fees', itemStyle: { color: '#F59E0B' } },
            { value: fbaAmt || 2400, name: 'FBA Fees', itemStyle: { color: '#A855F7' } },
            { value: storageAmt || 690, name: 'Storage Fees', itemStyle: { color: '#6366F1' } },
            { value: shippingAmt || 500, name: 'Shipping Fees', itemStyle: { color: '#3B82F6' } },
            { value: otherAmt || 0, name: 'Other Fees', itemStyle: { color: '#F97316' } }
          ]
        }
      ]
    };

    chartInstance.setOption(option, true);

    const resizeChart = () => {
      if (chartInstance && !chartInstance.isDisposed()) {
        chartInstance.resize();
      }
    };

    resizeChart();
    const timer1 = setTimeout(resizeChart, 50);
    const timer2 = setTimeout(resizeChart, 250);

    window.addEventListener('resize', resizeChart);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', resizeChart);
      chartInstance.dispose();
    };
  }, [feesData, selectedCurrency, exchangeRates, dataMode]);

  // Handle Sync Now action
  const handleSyncNow = async () => {
    setIsSyncing(true);
    toast.info('Starting Amazon SP-API data sync...');
    try {
      const res = await fetch('/api/amazon/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const now = new Date();
        const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        setLastSyncTime(timeStr);
        toast.success(data.message || 'Amazon SP-API data synced successfully!');
      } else {
        toast.error(data.error || 'Failed to sync Amazon data');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error connecting to sync server');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Disconnect Amazon
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const handleDisconnectAmazon = async () => {
    if (!window.confirm('Are you sure you want to disconnect Amazon Seller Central? This will permanently delete your Amazon credentials for this tenant.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/amazon/credentials', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Amazon Seller Central disconnected.');
        setIsAmazonConnected(false);
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast.error(data.error || 'Failed to disconnect Amazon');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error disconnecting Amazon');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Not Connected Hero Showcase Screen (Clean, Premium CFO Layout when Not Connected on Live Data) */}
      {!isAmazonConnected && dataMode === 'live' && (
        <div className="space-y-6 max-w-5xl mx-auto py-4 select-none">
          {/* Hero Banner Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl relative overflow-hidden">
            {/* Ambient Background Blur Glows */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-3.5 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  SP-API Live Integration
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  Amazon Seller Central Intelligence
                </h2>

                <p className="text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                  Connect your Amazon Seller Central SP-API account to automatically sync live sales GMV, orders, fee breakdowns, FBA inventory health, and settlement payouts into your Virtual CFO engine.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/data-sources"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs transition shadow-md flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    <span>Connect Amazon Seller Central</span>
                  </Link>

                  <button
                    onClick={() => triggerDemoPreloader()}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-bold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Explore Demo Dashboard</span>
                  </button>
                </div>
              </div>

              {/* Graphic Icon Display */}
              <div className="shrink-0 flex items-center justify-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center shadow-2xl relative">
                  <div className="absolute inset-0 bg-amber-500/5 rounded-3xl" />
                  <Unplug className="h-12 w-12 text-amber-400 stroke-[1.5]" />
                </div>
              </div>
            </div>
          </div>

          {/* 3 Feature Capability Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center font-bold">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">GMV & Net Revenue</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Track gross sales, net revenue after Amazon fees, refunds, and promotions across global marketplaces.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center font-bold">
                <Package className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">FBA Stock & Low Inventory</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Real-time monitoring of sellable units, reserved stock, inbound shipments, and automated low-stock SKU alerts.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center font-bold">
                <Wallet className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Settlements & Payouts</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Automatic reconciliation of Amazon bank payout deposits, unsettled reserves, and fee distributions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Filter Controls & Toolbar Bar (Only shown when Connected OR in Demo Mode) */}
      {(isAmazonConnected || dataMode === 'demo') && (
        <div className="flex flex-wrap items-center justify-end gap-2 py-0.5">
          {/* Live Data / Demo Data Switcher */}
          <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 h-8 shadow-2xs">
            <button
              onClick={() => {
                setDataMode('live');
                updateUrlParams({ mode: 'live' });
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer h-7",
                dataMode === 'live'
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dataMode === 'live' ? "bg-emerald-400" : "bg-slate-400")} />
              <span>Live Data</span>
            </button>
            <button
              onClick={() => triggerDemoPreloader()}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition cursor-pointer h-7",
                dataMode === 'demo'
                  ? "bg-amber-500 text-slate-950 shadow-2xs font-extrabold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Demo Data</span>
            </button>
          </div>

          {/* Action Controls Depending on Connection State */}
          {isAmazonConnected && (
            <>
              {/* Last Sync Badge */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs whitespace-nowrap h-8">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="whitespace-nowrap">Last sync: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{lastSyncTime}</strong></span>
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs shadow-2xs transition disabled:opacity-50 cursor-pointer outline-none h-8 whitespace-nowrap"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", isSyncing && "animate-spin")} />
                <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
              </button>

              {/* Disconnect Button */}
              <button
                onClick={handleDisconnectAmazon}
                disabled={isDisconnecting}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-600 dark:text-red-400 font-bold text-xs border border-red-200 dark:border-red-800/50 shadow-2xs transition disabled:opacity-50 cursor-pointer outline-none h-8 whitespace-nowrap"
              >
                <Unplug className={cn("h-3.5 w-3.5 shrink-0", isDisconnecting && "animate-pulse")} />
                <span>{isDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
              </button>
            </>
          )}

          {/* Marketplace Selector */}
          <div className="relative">
            <select
              value={selectedMarketplace}
              onChange={(e) => updateUrlParams({ marketplace: e.target.value })}
              className="appearance-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg pl-7 pr-6 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer h-8 shadow-2xs whitespace-nowrap"
            >
              <option value="all">All Marketplaces</option>
              <option value="IN">Amazon.in (India)</option>
              <option value="US">Amazon.com (US)</option>
              <option value="UK">Amazon.co.uk (UK)</option>
              <option value="DE">Amazon.de (Germany)</option>
            </select>
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Currency Selector */}
          <div className="relative">
            <select
              value={selectedCurrency}
              onChange={(e) => updateUrlParams({ currency: e.target.value })}
              className="appearance-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg pl-6 pr-5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer h-8 shadow-2xs whitespace-nowrap"
            >
              <option value="GBP">£ GBP</option>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
            <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Range Picker Trigger */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePickerDropdown(!showDatePickerDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer outline-none h-8 whitespace-nowrap"
            >
              <Calendar className="h-3.5 w-3.5 text-slate-800 dark:text-slate-200 shrink-0" />
              <span className="text-slate-900 dark:text-white font-bold whitespace-nowrap">
                {customStartDate && customEndDate ? `${formatDateLabel(customStartDate)} – ${formatDateLabel(customEndDate)}` : '01 Aug 2026 – 30 Sept 2026'}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-500 transition-transform shrink-0", showDatePickerDropdown && "rotate-180")} />
            </button>

            {/* Popover Dropdown */}
            {showDatePickerDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2 px-1">Select Date Range</span>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {[
                    { id: '30d', label: 'Last 30 days' },
                    { id: '7d', label: 'Last 7 days' },
                    { id: 'today', label: 'Today' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_month', label: 'Last Month' },
                    { id: 'ytd', label: 'Year to Date' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let start = new Date(today);
                        let end = new Date(today);
                        if (p.id === '30d') start.setDate(today.getDate() - 30);
                        else if (p.id === '7d') start.setDate(today.getDate() - 7);
                        else if (p.id === 'this_month') {
                          start = new Date(today.getFullYear(), today.getMonth(), 1);
                          end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        } else if (p.id === 'last_month') {
                          start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          end = new Date(today.getFullYear(), today.getMonth(), 0);
                        } else if (p.id === 'ytd') {
                          start = new Date(today.getFullYear(), 0, 1);
                        }
                        updateUrlParams({
                          from_date: start.toISOString().split('T')[0],
                          to_date: end.toISOString().split('T')[0],
                        });
                        setShowDatePickerDropdown(false);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-600 rounded-lg text-slate-700 dark:text-slate-300 text-left transition cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">Custom Range</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-400 block mb-1">From Date</label>
                      <input
                        type="date"
                        value={tempStartDate || customStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-400 block mb-1">To Date</label>
                      <input
                        type="date"
                        value={tempEndDate || customEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const f = tempStartDate || customStartDate;
                      const t = tempEndDate || customEndDate;
                      if (f && t) {
                        updateUrlParams({ from_date: f, to_date: t });
                        setShowDatePickerDropdown(false);
                      }
                    }}
                    className="w-full py-1.5 mt-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11.5px] rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    Apply Date Range
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lower Dashboard Section: Only shown when Amazon is connected or in Demo mode */}
      {(isAmazonConnected || dataMode === 'demo') && (
        <>
          {/* KPI Cards Row (6 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: GMV / Sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">GMV / Sales</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatConvertedCurrency(kpiMetrics.gmv, selectedCurrency)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>0.0%</span>
              </div>
              {/* Green Line Sparkline */}
              <svg className="w-14 h-6" viewBox="0 0 60 20" fill="none">
                <path d="M2 16 Q 15 14, 25 10 T 45 12 T 58 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Net Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">Net Revenue</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatConvertedCurrency(kpiMetrics.netRevenue, selectedCurrency)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>0.0%</span>
              </div>
              {/* Mini Bar Sparkline */}
              <div className="flex items-end gap-1 h-5">
                <div className="w-1 bg-blue-200 rounded-t h-2"></div>
                <div className="w-1 bg-blue-300 rounded-t h-3"></div>
                <div className="w-1 bg-blue-300 rounded-t h-2.5"></div>
                <div className="w-1 bg-blue-400 rounded-t h-4"></div>
                <div className="w-1 bg-blue-500 rounded-t h-5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-purple-100/70 text-purple-600 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">Orders</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {kpiMetrics.orders.toLocaleString()}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>0.0%</span>
              </div>
              {/* Purple Line Sparkline */}
              <svg className="w-14 h-6" viewBox="0 0 60 20" fill="none">
                <path d="M2 16 Q 15 14, 25 10 T 45 12 T 58 4" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Units Sold */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
                <PackageCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">Units Sold</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {kpiMetrics.unitsSold.toLocaleString()}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>0.0%</span>
              </div>
              {/* Emerald Line Sparkline */}
              <svg className="w-14 h-6" viewBox="0 0 60 20" fill="none">
                <path d="M2 16 Q 15 14, 25 10 T 45 12 T 58 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 5: Amazon Fees */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-rose-100/70 text-rose-600 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">Amazon Fees</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatConvertedCurrency(kpiMetrics.amazonFees, selectedCurrency)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                <span>0.0%</span>
              </div>
              {/* Red Line Sparkline */}
              <svg className="w-14 h-6" viewBox="0 0 60 20" fill="none">
                <path d="M2 14 Q 15 10, 25 14 T 45 8 T 58 16" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 6: Payouts (Received) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-sky-100/70 text-sky-600 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-slate-500 leading-tight">Payouts (Received)</span>
            </div>
            <button className="text-slate-300 hover:text-slate-500 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatConvertedCurrency(kpiMetrics.payouts, selectedCurrency)}
            </div>
            <div className="flex items-center justify-between mt-2 pt-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>0.0%</span>
              </div>
              {/* Blue Line Sparkline */}
              <svg className="w-14 h-6" viewBox="0 0 60 20" fill="none">
                <path d="M2 16 Q 15 14, 25 10 T 45 12 T 58 4" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Single Grid Row: Business Performance, Money Flow, Marketplace Performance (3 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Business Performance Graph */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex-1 flex flex-col">
            {/* Header & Granularity Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Business Performance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sales, net revenue, fees and order volume.</p>
              </div>

              {/* Granularity Pills: Daily, Weekly, Monthly */}
              <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setGranularity('daily')}
                  className={cn(
                    "px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all duration-150",
                    granularity === 'daily'
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Daily
                </button>
                <button
                  onClick={() => setGranularity('weekly')}
                  className={cn(
                    "px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all duration-150",
                    granularity === 'weekly'
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setGranularity('monthly')}
                  className={cn(
                    "px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all duration-150",
                    granularity === 'monthly'
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Custom Legend Bar matching screenshot */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600 pt-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Sales (GMV)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Net Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                <span>Orders</span>
              </div>
            </div>

            {/* ECharts Canvas Container */}
            {/* ECharts Canvas Container - stretches to fill */}
            <div className="w-full flex-1 min-h-[220px] mt-2" ref={chartRef} />
          </div>

          {/* Footer details */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 mt-4">
            <span className="truncate">Reporting in {selectedCurrency}</span>
            <button className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 transition-colors shrink-0">
              <span>Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Money Flow Waterfall Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1">
                  <span>Money Flow</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">(Last 30 days)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">How sales convert to payouts.</p>
              </div>

              {/* Currency Selector Pill */}
              <div className="relative shrink-0">
                <select
                  value={selectedCurrency}
                  onChange={(e) => updateUrlParams({ currency: e.target.value })}
                  className="appearance-none bg-slate-100/90 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl pl-2.5 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-colors"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* ECharts Waterfall Container stretched */}
            {/* ECharts Waterfall Container - stretches to fill */}
            <div className="w-full flex-1 min-h-[220px] mt-2" ref={moneyFlowRef} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 mt-4">
            <span>Waterfall breakdown</span>
            <span className="font-semibold text-slate-700">Real-time</span>
          </div>
        </div>

        {/* Card 3: Marketplace Performance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Marketplace Performance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sales and orders by country.</p>
              </div>

              {/* Filter Pill */}
              <div className="relative shrink-0">
                <select
                  value={mpMetricFilter}
                  onChange={(e) => setMpMetricFilter(e.target.value as any)}
                  className="appearance-none bg-slate-100/90 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl pl-2.5 pr-6 py-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer transition-colors"
                >
                  <option value="sales">Sales</option>
                  <option value="orders">Orders</option>
                  <option value="growth">Growth</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Marketplace Table List */}
            <div className="space-y-2 mt-3">
              {/* Header Labels */}
              <div className="grid grid-cols-12 text-[10px] font-semibold text-slate-400 pb-1 border-b border-slate-100">
                <div className="col-span-5">Marketplace</div>
                <div className="col-span-3 text-right">Sales</div>
                <div className="col-span-2 text-right">Orders</div>
                <div className="col-span-2 text-right">Growth</div>
              </div>

              {/* Items */}
              {Object.values(marketplaceData).map((mp) => (
                <div key={mp.id} className="grid grid-cols-12 items-center text-xs font-medium text-slate-800 py-1 hover:bg-slate-50 rounded-lg px-1 transition-colors">
                  <div className="col-span-5 flex items-center gap-2 truncate">
                    <span className="text-sm leading-none">{mp.flag}</span>
                    <span className="font-semibold text-slate-900 truncate">{mp.name}</span>
                  </div>
                  <div className="col-span-3 text-right font-bold text-slate-900 text-xs">
                    {formatConvertedCurrency(mp.sales, selectedCurrency)}
                  </div>
                  <div className="col-span-2 text-right text-slate-600 font-semibold text-xs">
                    {mp.orders.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right text-emerald-600 font-bold text-xs">
                    {mp.growth}
                  </div>
                </div>
              ))}
            </div>

            {/* World Map Vector Graphic - fills remaining space */}
            <div className="flex-1 min-h-[120px] w-full relative bg-slate-50/50 rounded-xl p-1 border border-slate-100 overflow-hidden mt-3">
              <WorldMapSvg activeCountryIds={['IN', 'US', 'GB', 'DE']} />
            </div>
          </div>

          {/* Footer details */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs mt-4">
            <span className="font-semibold text-slate-500">4 Marketplaces</span>
            <button className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 transition-colors">
              <span>More insights</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section Row: Inventory & FBA (6 cols) + Orders & Fulfillment (3 cols) + Returns & Refunds (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Inventory & FBA (6 out of 12 columns) */}
        <div className="lg:col-span-12 xl:col-span-6 2xl:col-span-6 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="space-y-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Inventory & FBA</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Stock health and fulfilment overview.</p>
                </div>
                <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 6 Top Metric Summary Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
                {/* Pill 1: Sellable Units */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.sellableUnits.toLocaleString()}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Sellable Units</div>
                  </div>
                </div>

                {/* Pill 2: Reserved */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.reservedUnits.toLocaleString()}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Reserved</div>
                  </div>
                </div>

                {/* Pill 3: Inbound */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.inboundUnits.toLocaleString()}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Inbound</div>
                  </div>
                </div>

                {/* Pill 4: Unfulfillable */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-100/70 text-red-500 flex items-center justify-center shrink-0">
                    <AlertOctagon className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.unfulfillableUnits.toLocaleString()}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Unfulfillable</div>
                  </div>
                </div>

                {/* Pill 5: Days of Cover */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-teal-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.daysOfCover}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Days of Cover</div>
                  </div>
                </div>

                {/* Pill 6: Low Stock SKUs */}
                <div className="border border-slate-200/70 rounded-xl p-2.5 bg-slate-50/50 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-100/70 text-rose-500 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="truncate min-w-0">
                    <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-none">
                      {inventoryMetrics.lowStockSkus}
                    </div>
                    <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">Low Stock SKUs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Split Row: Inventory Trend Chart (Left) + Low Stock Alerts (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-4 border-t border-slate-100 min-w-0">
              {/* Inventory Trend Chart */}
              <div className="sm:col-span-7 space-y-2 min-w-0 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 shrink-0">Inventory Trend</h3>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 flex-wrap">
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      Sellable
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Inbound
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      Reserved
                    </span>
                  </div>
                </div>

                {/* EChart Container */}
                <div className="w-full h-52" ref={inventoryChartRef} />
              </div>

              {/* Low Stock Alerts Column */}
              <div className="sm:col-span-5 sm:border-l sm:border-slate-100 sm:pl-3 space-y-3 flex flex-col justify-between min-w-0">
                <div className="flex items-center justify-between min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 truncate">Low Stock Alerts</h3>
                  <button className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors shrink-0">
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Items List / Full-height Empty Container */}
                <div className="flex-1 flex flex-col justify-center min-h-[190px]">
                  {lowStockAlerts.length === 0 ? (
                    <div className="w-full h-full min-h-[180px] flex items-center justify-center text-[11px] text-slate-400 text-center italic border border-dashed border-slate-200/80 rounded-xl bg-slate-50/40 px-3">
                      No low stock alerts
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {lowStockAlerts.map((item) => (
                        <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/60 border border-slate-200/60 hover:bg-slate-100/60 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-rose-500 shrink-0 stroke-[2.5]" />
                          <div className="w-8 h-8 rounded-lg bg-rose-100/60 text-rose-600 flex items-center justify-center shrink-0 font-bold text-xs">
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[11.5px] text-slate-900 truncate">{item.sku}</div>
                            <div className="text-[11px] text-slate-500 truncate">{item.title}</div>
                            <div className="text-[10.5px] font-extrabold text-rose-600 mt-0.5">Only {item.unitsLeft} units left</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Orders & Fulfillment (6 out of 12 columns) */}
        <div className="lg:col-span-12 xl:col-span-6 2xl:col-span-6 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-5 flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Orders & Fulfillment</h2>
                <p className="text-xs text-slate-500 mt-0.5">Order status and fulfillment performance.</p>
              </div>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors shrink-0">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Funnel Status Rows + Vertical Funnel Graphic */}
            <div className="flex items-center gap-4 py-1">
              {/* Vertical SVG Funnel Graphic - Taller & Prominent */}
              <div className="w-8 shrink-0 flex items-center justify-center">
                <svg className="w-7 h-[230px]" viewBox="0 0 30 230" preserveAspectRatio="none">
                  {/* Step 1: Pending (Light Purple) */}
                  <polygon points="0,0 30,0 26,42 4,42" fill="#E9D5FF" />
                  {/* Step 2: Unshipped (Medium Purple) */}
                  <polygon points="4,46 26,46 22,88 8,88" fill="#C084FC" />
                  {/* Step 3: Shipped (Light Teal) */}
                  <polygon points="8,92 22,92 18,134 12,134" fill="#6EE7B7" />
                  {/* Step 4: Delivered (Green) */}
                  <polygon points="12,138 18,138 16,180 14,180" fill="#10B981" />
                  {/* Step 5: Returned (Orange/Coral) */}
                  <polygon points="14,184 16,184 15,226 15,226" fill="#F97316" />
                </svg>
              </div>

              {/* Status List Rows with visual progress bars */}
              <div className="flex-1 space-y-3.5 min-w-0">
                {/* Pending */}
                <div className="py-1 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">Pending</span>
                    <div className="flex items-center gap-6">
                      <span className="font-extrabold text-slate-900">{fulfillmentMetrics.pendingCount.toLocaleString()}</span>
                      <span className="font-semibold text-slate-400 text-right">{fulfillmentMetrics.pendingPct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-300 h-full rounded-full transition-all duration-300" style={{ width: fulfillmentMetrics.pendingPct !== '0.0%' ? fulfillmentMetrics.pendingPct : '0%' }} />
                  </div>
                </div>

                {/* Unshipped */}
                <div className="py-1 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">Unshipped</span>
                    <div className="flex items-center gap-6">
                      <span className="font-extrabold text-slate-900">{fulfillmentMetrics.unshippedCount.toLocaleString()}</span>
                      <span className="font-semibold text-slate-400 text-right">{fulfillmentMetrics.unshippedPct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: fulfillmentMetrics.unshippedPct !== '0.0%' ? fulfillmentMetrics.unshippedPct : '0%' }} />
                  </div>
                </div>

                {/* Shipped */}
                <div className="py-1 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">Shipped</span>
                    <div className="flex items-center gap-6">
                      <span className="font-extrabold text-slate-900">{fulfillmentMetrics.shippedCount.toLocaleString()}</span>
                      <span className="font-semibold text-slate-400 text-right">{fulfillmentMetrics.shippedPct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: fulfillmentMetrics.shippedPct !== '0.0%' ? fulfillmentMetrics.shippedPct : '0%' }} />
                  </div>
                </div>

                {/* Delivered */}
                <div className="py-1 border-b border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">Delivered</span>
                    <div className="flex items-center gap-6">
                      <span className="font-extrabold text-slate-900">{fulfillmentMetrics.deliveredCount.toLocaleString()}</span>
                      <span className="font-semibold text-slate-400 text-right">{fulfillmentMetrics.deliveredPct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: fulfillmentMetrics.deliveredPct !== '0.0%' ? fulfillmentMetrics.deliveredPct : '0%' }} />
                  </div>
                </div>

                {/* Returned */}
                <div className="py-1">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">Returned</span>
                    <div className="flex items-center gap-6">
                      <span className="font-extrabold text-slate-900">{fulfillmentMetrics.returnedCount.toLocaleString()}</span>
                      <span className="font-semibold text-slate-400 text-right">{fulfillmentMetrics.returnedPct}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: fulfillmentMetrics.returnedPct !== '0.0%' ? fulfillmentMetrics.returnedPct : '0%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 3 Summary Performance Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-slate-100">
            {/* Tile 1: Late Shipment Rate */}
            <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-w-0">
              <div className="text-sm font-extrabold text-slate-900 leading-none truncate">
                {fulfillmentMetrics.lateShipmentRate}
              </div>
              <div className="text-[10.5px] font-medium text-slate-500 mt-1 truncate">Late Shipment Rate</div>
              <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 mt-2">
                <ArrowDown className="w-3 h-3 stroke-[3]" />
                <span>{fulfillmentMetrics.lateShipmentTrend}</span>
              </div>
            </div>

            {/* Tile 2: Cancellation Rate */}
            <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-w-0">
              <div className="text-sm font-extrabold text-slate-900 leading-none truncate">
                {fulfillmentMetrics.cancellationRate}
              </div>
              <div className="text-[10.5px] font-medium text-slate-500 mt-1 truncate">Cancellation Rate</div>
              <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 mt-2">
                <ArrowDown className="w-3 h-3 stroke-[3]" />
                <span>{fulfillmentMetrics.cancellationTrend}</span>
              </div>
            </div>

            {/* Tile 3: On-time Delivery */}
            <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2.5 flex flex-col justify-between min-w-0">
              <div className="text-sm font-extrabold text-slate-900 leading-none truncate">
                {fulfillmentMetrics.ontimeDeliveryRate}
              </div>
              <div className="text-[10.5px] font-medium text-slate-500 mt-1 truncate">On-time Delivery</div>
              <div className="text-[10.5px] font-bold text-emerald-600 flex items-center gap-0.5 mt-2">
                <ArrowUp className="w-3 h-3 stroke-[3]" />
                <span>{fulfillmentMetrics.ontimeDeliveryTrend}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Returns & Refunds Analytics (Full Width 12-Col Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-12 xl:col-span-12 2xl:col-span-12 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100/80">
                  <RotateCcw className="w-4 h-4 stroke-[2.2]" />
                </div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Returns & Refunds Analytics</h2>
                <span className="bg-red-50 text-red-700 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-100">
                  Advanced View
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Track return trends, rate of returns, financial impact, and top returned products.</p>
            </div>
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors self-start sm:self-auto">
              <span>View detailed report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Top 4 KPI Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Tile 1: Refund Rate */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Refund Rate</span>
                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/80">
                  <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                  {refundMetrics.refundRateTrend}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {refundMetrics.refundRate}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Total Returns / Total Delivered</div>
              </div>
            </div>

            {/* Tile 2: Return Units */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Return Units</span>
                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/80">
                  <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                  {refundMetrics.returnUnitsTrend}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {refundMetrics.returnUnits} <span className="text-xs font-semibold text-slate-400">units</span>
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Items returned by customers</div>
              </div>
            </div>

            {/* Tile 3: Total Refund Value */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Refund Value</span>
                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/80">
                  <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                  {refundMetrics.refundValueTrend}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight" title={formatConvertedCurrency(refundMetrics.refundValue, selectedCurrency)}>
                  {formatConvertedCurrency(refundMetrics.refundValue, selectedCurrency)}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Total refunded to buyers</div>
              </div>
            </div>

            {/* Tile 4: Processing Loss Impact */}
            <div className="bg-rose-50/40 border border-rose-100/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Est. Return Cost Impact</span>
                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/80">
                  High Priority
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-xl md:text-2xl font-extrabold text-rose-600 tracking-tight">
                  {formatConvertedCurrency(dataMode === 'demo' ? 420 : 0, selectedCurrency)}
                </div>
                <div className="text-[11px] font-medium text-rose-500/80 mt-0.5">Fulfillment & Restocking loss</div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: EChart Refund Trend (7 Cols) + Top Returned Products List (5 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-slate-100">
            {/* Refund Rate & Volume Trend (7 Cols) */}
            <div className="lg:col-span-7 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Refund Rate Trend</span>
                  <span className="text-[11px] font-normal text-slate-400">(Aug 1 – Sep 30)</span>
                </h3>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    Refund Rate %
                  </span>
                </div>
              </div>

              {/* ECharts Area Container */}
              <div className="w-full h-64" ref={refundChartRef} />
            </div>

            {/* Top Returned Products List (5 Cols) */}
            <div className="lg:col-span-5 lg:border-l lg:border-slate-100 lg:pl-5 space-y-3 flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-bold text-slate-900">Top Returned SKUs</h3>
                <span className="text-[11px] font-semibold text-slate-400">By return count</span>
              </div>

              {/* Product items list */}
              <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                {topReturnedProducts.length === 0 ? (
                  <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center text-xs text-slate-400 text-center border border-dashed border-slate-200/80 rounded-xl bg-slate-50/40 p-4">
                    <PackageX className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                    <span className="font-bold text-slate-700">No returned products recorded</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topReturnedProducts.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 hover:bg-slate-100/60 transition-colors gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank Badge */}
                          <div className={cn(
                            "w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0",
                            idx === 0 ? "bg-amber-500 text-slate-950" :
                            idx === 1 ? "bg-slate-300 text-slate-800" :
                            "bg-slate-200 text-slate-600"
                          )}>
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate" title={item.title}>
                              {item.title}
                            </div>
                            <div className="text-[10.5px] font-medium text-slate-400 mt-0.5">
                              SKU: {idx === 0 ? 'B08N5WRWNW' : idx === 1 ? 'B07PFFMP9P' : 'B09V7N861Y'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100/90 whitespace-nowrap">
                            {item.count} returns
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Fees & Profitability Analytics (Full Width 12-Col Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-12 xl:col-span-12 2xl:col-span-12 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
                  <Receipt className="w-4 h-4 stroke-[2.2]" />
                </div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Fees & Profitability Analytics</h2>
                <span className="bg-amber-50 text-amber-800 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-100">
                  Advanced View
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Detailed Amazon fee breakdown, distribution share, contribution profit, and net margin.</p>
            </div>

            {/* Currency selector dropdown pill */}
            <div className="relative shrink-0 self-start sm:self-auto">
              <select
                value={selectedCurrency}
                onChange={(e) => updateUrlParams({ currency: e.target.value })}
                className="appearance-none bg-slate-100/90 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl pl-3 pr-7 py-1.5 border border-slate-200 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Top 3 Summary Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Tile 1: Total Fees Paid */}
            <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-bold text-slate-500">Total Amazon Fees</div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {formatConvertedCurrency((feesData.referralFees || (dataMode === 'demo' ? 492261 : 0)) + (feesData.fbaFees || (dataMode === 'demo' ? 306864 : 0)) + (feesData.storageFees || (dataMode === 'demo' ? 88223.4 : 0)) + (feesData.shippingFees || (dataMode === 'demo' ? 63930 : 0)) + (feesData.otherFees || 0), selectedCurrency)}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Referral, FBA, Storage & Shipping</div>
              </div>
            </div>

            {/* Tile 2: Contribution Profit */}
            <div className="bg-emerald-50/40 border border-emerald-100/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-bold text-slate-700">Contribution Profit</div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-extrabold text-emerald-600 tracking-tight">
                  {formatConvertedCurrency(feesData.contributionProfit || (dataMode === 'demo' ? 3576244.2 : 0), selectedCurrency)}
                </div>
                <div className="text-[11px] font-medium text-emerald-600/80 mt-0.5">Revenue minus variable fulfillment costs</div>
              </div>
            </div>

            {/* Tile 3: Contribution Margin */}
            <div className="bg-blue-50/40 border border-blue-100/80 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="text-xs font-bold text-slate-700">Contribution Margin %</div>
              <div className="mt-2">
                <div className="text-xl md:text-2xl font-extrabold text-blue-600 tracking-tight">
                  {feesData.contributionMargin || (dataMode === 'demo' ? '65.3%' : '0.0%')}
                </div>
                <div className="text-[11px] font-medium text-blue-600/80 mt-0.5">Healthy seller margin indicator</div>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Detailed Fee Breakdown (Left 6 Cols) + Interactive Donut Chart (Right 6 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-slate-100">
            {/* Left 6 Columns: Fee Items & Stacked Distribution */}
            <div className="lg:col-span-6 space-y-4 min-w-0">
              <h3 className="text-xs md:text-sm font-bold text-slate-900">Fee Itemization</h3>

              {/* Fee Items List */}
              <div className="space-y-3">
                {/* Referral Fees */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                    <span className="font-bold text-slate-800 truncate">Referral Fees</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-extrabold text-slate-900">{formatConvertedCurrency(feesData.referralFees || (dataMode === 'demo' ? 492261 : 0), selectedCurrency)}</span>
                    <span className="font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] min-w-[48px] text-right">{feesData.referralPct || (dataMode === 'demo' ? '9.0%' : '0.0%')}</span>
                  </div>
                </div>

                {/* FBA Fees */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-4 h-4 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                      <Package className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-slate-800 truncate">FBA Pick & Pack</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-extrabold text-slate-900">{formatConvertedCurrency(feesData.fbaFees || (dataMode === 'demo' ? 306864 : 0), selectedCurrency)}</span>
                    <span className="font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] min-w-[48px] text-right">{feesData.fbaPct || (dataMode === 'demo' ? '5.6%' : '0.0%')}</span>
                  </div>
                </div>

                {/* Storage Fees */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-4 h-4 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Box className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-slate-800 truncate">FBA Storage Fees</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-extrabold text-slate-900">{formatConvertedCurrency(feesData.storageFees || (dataMode === 'demo' ? 88223.4 : 0), selectedCurrency)}</span>
                    <span className="font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] min-w-[48px] text-right">{feesData.storagePct || (dataMode === 'demo' ? '1.6%' : '0.0%')}</span>
                  </div>
                </div>

                {/* Shipping Fees */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-4 h-4 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Truck className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-slate-800 truncate">Inbound Shipping</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-extrabold text-slate-900">{formatConvertedCurrency(feesData.shippingFees || (dataMode === 'demo' ? 63930 : 0), selectedCurrency)}</span>
                    <span className="font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] min-w-[48px] text-right">{feesData.shippingPct || (dataMode === 'demo' ? '1.2%' : '0.0%')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: Interactive ECharts Donut Chart */}
            <div className="lg:col-span-6 lg:border-l lg:border-slate-100 lg:pl-5 space-y-3 flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-bold text-slate-900">Fee Proportions Share</h3>
                <span className="text-[11px] font-semibold text-slate-400">Interactive Donut Breakdown</span>
              </div>

              {/* Donut Chart Container */}
              <div className="w-full h-60 min-h-[230px] relative" ref={feesDonutRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Product Intelligence (12 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Product Intelligence Card */}
        <div className="lg:col-span-12 xl:col-span-12 2xl:col-span-12 bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            {/* Header + View All */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Product Intelligence</h2>
                <p className="text-xs text-slate-500 mt-0.5">Top performing products with profitability and stock insights.</p>
              </div>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 scrollbar-none">
              <button
                onClick={() => setProductTab('best_sellers')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  productTab === 'best_sellers'
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
                )}
              >
                Best Sellers
              </button>
              <button
                onClick={() => setProductTab('low_margin')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  productTab === 'low_margin'
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
                )}
              >
                Low Margin
              </button>
              <button
                onClick={() => setProductTab('low_stock')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  productTab === 'low_stock'
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
                )}
              >
                Low Stock
              </button>
              <button
                onClick={() => setProductTab('fast_growing')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0",
                  productTab === 'fast_growing'
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
                )}
              >
                Fast Growing
              </button>
            </div>

            {/* Products Table / Empty State */}
            {filteredProducts.length === 0 ? (
              <div className="flex-1 my-3 w-full min-h-[260px] flex flex-col items-center justify-center text-xs text-slate-400 text-center border border-dashed border-slate-200/80 rounded-xl bg-slate-50/40 p-8">
                <Package className="w-10 h-10 text-slate-300 mb-2 stroke-[1.5]" />
                <span className="font-bold text-slate-700 text-sm">No product data available</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-xs">Sync your Amazon SP-API account to view top performing products and stock insights.</span>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4 scrollbar-none">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <th className="py-3 px-2 text-center w-8">#</th>
                      <th className="py-3 px-2 min-w-[140px]">Product</th>
                      <th className="py-3 px-2">ASIN</th>
                      <th className="py-3 px-2 text-center">Rating ⭐</th>
                      <th className="py-3 px-2">SKU</th>
                      <th className="py-3 px-2 text-right">Units Sold</th>
                      <th className="py-3 px-2 text-right">Revenue</th>
                      <th className="py-3 px-2 text-right">Fees</th>
                      <th className="py-3 px-2 text-center">Margin</th>
                      <th className="py-3 px-2 text-right">Inventory</th>
                      <th className="py-3 px-2 text-right">Rank</th>
                      <th className="py-3 px-2 text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProducts.map((item) => (
                      <tr key={item.rank} className="hover:bg-slate-50/70 transition-colors group whitespace-nowrap">
                        <td className="py-3.5 px-2 text-center font-bold text-slate-400 group-hover:text-slate-700">
                          {item.rank}
                        </td>
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 p-1 flex items-center justify-center border border-slate-200/80 shrink-0 shadow-2xs">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 truncate max-w-[130px]" title={item.title}>
                              {item.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 font-mono text-[10.5px] font-medium text-slate-400 group-hover:text-slate-600 whitespace-nowrap">
                          {item.asin}
                        </td>
                        <td className="py-3.5 px-2 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
                            <span className="text-amber-500">★</span>
                            <span>{item.rating || 4.75}</span>
                            <span className="text-[9.5px] text-amber-600/80 font-normal">({item.reviewsCount || 342})</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-2 font-mono text-[10.5px] font-medium text-slate-400 group-hover:text-slate-600 whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-3.5 px-2 text-right font-extrabold text-slate-900 text-[11px] whitespace-nowrap">
                          {item.unitsSold.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-2 text-right font-extrabold text-slate-900 text-[11px] whitespace-nowrap">
                          {formatConvertedCurrency(item.revenue, selectedCurrency)}
                        </td>
                        <td className="py-3.5 px-2 text-right font-bold text-slate-500 text-[11px] whitespace-nowrap">
                          {formatConvertedCurrency(item.fees, selectedCurrency)}
                        </td>
                        <td className="py-3.5 px-2 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10.5px] font-extrabold border",
                              item.marginWarning
                                ? "bg-amber-50 text-amber-700 border-amber-200/80"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                            )}
                          >
                            {item.margin}%
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right font-bold text-slate-700 text-[11px] whitespace-nowrap">
                          {item.inventory.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-2 text-right font-extrabold text-slate-800 text-[10.5px] whitespace-nowrap">
                          {item.bsrRank}
                        </td>
                        <td className="py-3.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {item.trend === 'up' ? (
                              <svg className="w-9 h-4" viewBox="0 0 50 20" fill="none">
                                <path d="M2 15 L15 12 L28 14 L38 6 L48 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 15 L15 12 L28 14 L38 6 L48 4 V 20 H 2 Z" fill="url(#greenGradient)" opacity="0.15"/>
                              </svg>
                            ) : (
                              <svg className="w-9 h-4" viewBox="0 0 50 20" fill="none">
                                <path d="M2 4 L14 10 L26 8 L36 16 L48 14" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 4 L14 10 L26 8 L36 16 L48 14 V 20 H 2 Z" fill="url(#redGradient)" opacity="0.15"/>
                              </svg>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row (2 Cards): Payouts & Cash (Left) + AI CFO Insights (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 3: Payouts & Cash */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">Payouts & Cash</h2>
                <p className="text-xs text-slate-500 mt-0.5">Settlement and cash flow details.</p>
              </div>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3 Highlight Stat Boxes */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              {/* Tile 1: Next Payout */}
              <div className="bg-amber-50/40 border border-amber-100/80 rounded-xl p-3 flex flex-col justify-between min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-orange-500 leading-none truncate" title={formatConvertedCurrency(payoutsCashData.nextPayout, selectedCurrency)}>
                  {formatConvertedCurrency(payoutsCashData.nextPayout, selectedCurrency)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1.5 truncate">Next Payout</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{payoutsCashData.nextPayoutDate}</div>
              </div>

              {/* Tile 2: Unsettled Balance */}
              <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-3 flex flex-col justify-between min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-none truncate">
                  {formatConvertedCurrency(payoutsCashData.unsettledBalance, selectedCurrency)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1.5 truncate">Unsettled Balance</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">(Current)</div>
              </div>

              {/* Tile 3: Released Balance */}
              <div className="bg-blue-50/30 border border-blue-100/70 rounded-xl p-3 flex flex-col justify-between min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-none truncate" title={formatConvertedCurrency(payoutsCashData.releasedBalance, selectedCurrency)}>
                  {formatConvertedCurrency(payoutsCashData.releasedBalance, selectedCurrency)}
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1.5 truncate">Released Balance</div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">(Available)</div>
              </div>
            </div>

            {/* Recent Payouts Table List / Empty State */}
            <div className="pt-3 border-t border-slate-100 flex-1 flex flex-col space-y-2.5">
              <h3 className="text-xs font-bold text-slate-900">Recent Payouts</h3>
              {payoutsCashData.recentPayouts.length === 0 ? (
                <div className="flex-1 w-full min-h-[140px] flex flex-col items-center justify-center text-xs text-slate-400 text-center border border-dashed border-slate-200/80 rounded-xl bg-slate-50/40 p-4">
                  <Wallet className="w-6 h-6 text-slate-300 mb-1 stroke-[1.5]" />
                  <span className="font-bold text-slate-700 text-xs">No recent payouts</span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5">Payout details will appear here once settled.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {payoutsCashData.recentPayouts.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs sm:text-sm py-1">
                      <span className="font-medium text-slate-500">{item.date}</span>
                      <span className="font-bold text-slate-900">{formatConvertedCurrency(item.amount, selectedCurrency)}</span>
                      <span className="bg-emerald-100/80 text-emerald-700 text-xs font-extrabold px-3 py-0.5 rounded-full">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: AI CFO Insights */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">AI CFO Insights</h2>
                <span className="bg-purple-100 text-purple-700 text-xs font-extrabold px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Beta
                </span>
              </div>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Insights List / Empty State */}
            {aiInsightsList.length === 0 ? (
              <div className="flex-1 my-1 w-full min-h-[220px] flex flex-col items-center justify-center text-xs text-slate-400 text-center border border-dashed border-slate-200/80 rounded-xl bg-slate-50/40 p-6">
                <Sparkles className="w-8 h-8 text-purple-300 mb-2 stroke-[1.5]" />
                <span className="font-bold text-slate-700 text-sm">No AI insights generated yet</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-xs">Insights will automatically generate once Amazon transaction data is synced.</span>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {aiInsightsList.map((item) => (
                  <div key={item.id} className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        item.type === 'positive' && "bg-emerald-100 text-emerald-600",
                        item.type === 'negative' && "bg-rose-100 text-rose-600",
                        item.type === 'warning' && "bg-amber-100 text-amber-600"
                      )}
                    >
                      {item.type === 'negative' ? (
                        <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* 3-Second Demo Mode Preloader (Clean Full Screen White Background with Centered GIF & Subtle Subtext) */}
      {isDemoLoading && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center text-center">
            <img
              src="/amaozon.gif"
              alt="Loading Demo Data..."
              className="w-72 max-w-full h-auto object-contain"
            />
            <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 tracking-wide animate-pulse -mt-8">
              Connecting Demo Data for Visualization...
            </p>
          </div>
        </div>
      )}

      {/* Dual Calendar Modal Component */}
      <DateRangePicker
        isOpen={showFullCalendarModal}
        onClose={() => setShowFullCalendarModal(false)}
        onApply={(start, end) => {
          const startStr = start.toISOString().split('T')[0];
          const endStr = end.toISOString().split('T')[0];
          updateUrlParams({ from_date: startStr, to_date: endStr });
          setActivePreset('custom');
          setShowFullCalendarModal(false);
          toast.success(`Date range updated: ${formatDateLabel(startStr, endStr)}`);
        }}
        initialStart={customStartDate}
        initialEnd={customEndDate}
      />
    </div>
  );
}
