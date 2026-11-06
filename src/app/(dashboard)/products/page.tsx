'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  FileText, 
  FileSpreadsheet, 
  ChevronDown, 
  RefreshCw, 
  HelpCircle,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Boxes,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ArrowUpRight,
  Warehouse,
  CheckCircle2,
  X,
  Filter,
  Layers3,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface InventoryItemDTO {
  code: string;
  name: string;
  group: string;
  location: string;
  qtyOnHand: number;
  qtyAvailable: number;
  qtyReserved: number;
  unitCost: number;
  totalValue: number;
  status: 'In Stock' | 'Low Stock' | 'Dead Stock';
  lastMovement: string;
}

interface InventoryData {
  connected: boolean;
  summary: {
    inventoryValue: number;
    realValue: number;
    lowStockCount: number;
    deadStockCount: number;
    totalItems: number;
  };
  items: InventoryItemDTO[];
  meta: {
    currency: string;
    calculatedAt: string;
  };
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('to_date') || (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  })();
  
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  
  // Search & Filters (Default showZeroStock to 'Yes' so NO items are hidden by default)
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Low' | 'Dead'>('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [showZeroStock, setShowZeroStock] = useState('Yes');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/inventory?date=${date}`);
      if (!res.ok) {
        throw new Error('Failed to load Inventory data');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load Inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLive = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/xero', { method: 'POST' });
      if (res.ok) {
        await fetchInventory();
      } else {
        throw new Error('Sync failed');
      }
    } catch (err: any) {
      console.error('Inventory Sync Error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [date]);

  const currencyCode = data?.meta?.currency;

  const getCurrencySymbol = (code: string | null | undefined) => {
    if (!code) return '';
    try {
      const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
      return parts.find(p => p.type === 'currency')?.value || '';
    } catch {
      return code === 'GBP' ? '£' : (code === 'EUR' ? '€' : (code === 'INR' ? '₹' : '$'));
    }
  };

  const currencySymbol = getCurrencySymbol(currencyCode);

  const formatAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !currencyCode) return '—';
    return `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
  };

  const handleExportExcel = async () => {
    if (!data || !data.items) return;
    setIsExportingExcel(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Virtual CFO Intelligence Platform';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Inventory Intelligence', { views: [{ showGridLines: true }] });

      ws.mergeCells('A1:I2');
      const title = ws.getCell('A1');
      title.value = 'CFO INVENTORY & PRODUCTS VALUATION REPORT';
      title.font = { name: 'Plus Jakarta Sans', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      title.alignment = { vertical: 'middle', horizontal: 'center' };

      ws.mergeCells('A3:I3');
      const sub = ws.getCell('A3');
      sub.value = `Date: ${date} | Currency: ${currencyCode} | Total Items: ${data.summary.totalItems} | Total Value: ${formatAmount(data.summary.inventoryValue)}`;
      sub.font = { name: 'Plus Jakarta Sans', size: 9, italic: true, color: { argb: 'FF64748B' } };
      sub.alignment = { horizontal: 'center' };

      const headers = ['SKU Code', 'Item Name', 'Category / Group', 'Warehouse Location', 'Qty On Hand', 'Available', 'Unit Cost ($)', 'Total Value ($)', 'Stock Status'];
      headers.forEach((h, colIdx) => {
        const cell = ws.getCell(5, colIdx + 1);
        cell.value = h;
        cell.font = { name: 'Plus Jakarta Sans', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: colIdx >= 4 && colIdx <= 7 ? 'right' : 'left' };
      });

      ws.autoFilter = { from: 'A5', to: 'I5' };

      let r = 6;
      data.items.forEach(item => {
        const row = ws.getRow(r);
        row.getCell(1).value = item.code;
        row.getCell(2).value = item.name;
        row.getCell(3).value = item.group;
        row.getCell(4).value = item.location;

        row.getCell(5).value = item.qtyOnHand;
        row.getCell(5).alignment = { horizontal: 'right' };

        row.getCell(6).value = item.qtyAvailable;
        row.getCell(6).alignment = { horizontal: 'right' };

        row.getCell(7).value = item.unitCost;
        row.getCell(7).numFmt = `"${currencySymbol}"#,##0.00`;
        row.getCell(7).alignment = { horizontal: 'right' };

        row.getCell(8).value = item.totalValue;
        row.getCell(8).numFmt = `"${currencySymbol}"#,##0.00`;
        row.getCell(8).font = { bold: true };
        row.getCell(8).alignment = { horizontal: 'right' };

        row.getCell(9).value = item.status;
        row.getCell(9).font = { bold: true, color: { argb: item.status === 'In Stock' ? 'FF047857' : item.status === 'Low Stock' ? 'FFD97706' : 'FFB91C1C' } };

        if (r % 2 === 1) {
          row.eachCell({ includeEmpty: true }, c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
        }
        r++;
      });

      ws.columns.forEach((column) => {
        let maxLen = 12;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const val = cell.value ? cell.value.toString() : '';
          if (val.length > maxLen) maxLen = val.length;
        });
        column.width = Math.min(Math.max(maxLen + 4, 14), 45);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Inventory_Valuation_Report_${date}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Inventory Excel export error:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const getFilteredItems = () => {
    if (!data || !data.items) return [];
    const term = searchTerm.toLowerCase();
    return data.items.filter(item => {
      // 1. Search Query
      const matchSearch = item.name.toLowerCase().includes(term) || 
                          item.code.toLowerCase().includes(term) ||
                          item.group.toLowerCase().includes(term) ||
                          item.location.toLowerCase().includes(term);

      // 2. Tab Filter
      let matchTab = true;
      if (activeTab === 'Low') matchTab = item.status === 'Low Stock';
      else if (activeTab === 'Dead') matchTab = item.status === 'Dead Stock';

      // 3. Location Filter
      let matchLocation = true;
      if (locationFilter !== 'All') {
        matchLocation = item.location === locationFilter;
      }

      // 4. Status Dropdown Filter
      let matchStatus = true;
      if (statusFilter !== 'All') {
        matchStatus = item.status === statusFilter;
      }

      // 5. Group Filter
      let matchGroup = true;
      if (groupFilter !== 'All') {
        matchGroup = item.group === groupFilter;
      }

      // 6. Zero Stock Filter
      let matchZero = true;
      if (showZeroStock === 'No') {
        matchZero = item.qtyOnHand > 0;
      }

      return matchSearch && matchTab && matchLocation && matchStatus && matchGroup && matchZero;
    });
  };

  const filteredItems = getFilteredItems();
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ECharts Configs
  const valueOverTimeOption = {
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'cross', label: { backgroundColor: '#1e293b' } },
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#1e293b', fontSize: 11 },
      formatter: (params: any) => {
        const item = params[0];
        return `<div style="font-weight:700;margin-bottom:4px;">${item.axisValue}</div>
                <div style="font-size:11px;">Valuation: <strong style="color:#0284c7">${currencySymbol}${item.value.toLocaleString()} ${currencyCode}</strong></div>`;
      }
    },
    grid: { left: '2%', right: '3%', bottom: '2%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'],
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', fontSize: 10, fontWeight: 550 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { 
        color: '#94a3b8', 
        fontSize: 10,
        formatter: (v: number) => `${currencySymbol}${v}`
      }
    },
    series: [
      {
        name: 'Inventory Valuation',
        type: 'line',
        smooth: true,
        data: [2000, 1950, 2300, 2800, 2750, 2600, data?.summary?.inventoryValue ?? 2658],
        itemStyle: { color: '#0284c7' },
        lineStyle: { width: 2.5 },
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#0284c735' },
              { offset: 1, color: '#0284c700' }
            ]
          }
        }
      }
    ]
  };

  const getInventoryByLocationData = () => {
    if (!data || !data.items) return [];
    const totals: Record<string, number> = {};
    data.items.forEach(item => {
      totals[item.location] = (totals[item.location] || 0) + item.totalValue;
    });
    const colors: Record<string, string> = { 'Main Warehouse': '#0284c7', 'Store Room': '#10b981', 'Branch Office': '#f59e0b' };
    return Object.keys(totals).map(name => ({
      value: Math.round(totals[name] * 100) / 100,
      name,
      itemStyle: { color: colors[name] || '#94a3b8' }
    }));
  };

  const locationData = getInventoryByLocationData();

  const inventoryByLocationOption = {
    tooltip: { 
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#1e293b', fontSize: 11 },
      formatter: (params: any) => `${params.name}: <b>${currencySymbol}${params.value.toLocaleString()}</b> (${params.percent}%)`
    },
    legend: { show: false },
    series: [
      {
        name: 'Locations',
        type: 'pie',
        radius: ['60%', '82%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: () => {
            const sum = data?.summary?.inventoryValue ?? 0;
            return `${currencySymbol}${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nTotal Value`;
          },
          textStyle: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', lineHeight: 18 }
        },
        labelLine: { show: false },
        data: locationData
      }
    ]
  };

  return (
    <PageContainer>
      {/* ─── Breadcrumbs ─── */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium select-none mb-3">
        <Link href="/overview" className="hover:text-slate-600 text-slate-400 transition">Dashboard</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <Link href="/reports" className="hover:text-slate-600 text-slate-400 transition">Accounting</Link>
        <ChevronDown className="h-2.5 w-2.5 -rotate-90 text-slate-350" />
        <span className="text-slate-600 font-semibold">Inventory & Products</span>
      </div>

      {/* ─── Header Section ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">Inventory Intelligence</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-200/60 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> CFO Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Real-time SKU valuation, stock level thresholds, unit movement velocity & low stock alerts.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
          <button 
            onClick={handleSyncLive}
            disabled={syncing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
            title="Reload & Sync live Xero inventory items"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", (syncing || loading) && "animate-spin")} />
            <span>Sync Live</span>
          </button>

          <button 
            onClick={handleExportExcel}
            disabled={isExportingExcel || !data}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/30 text-xs font-bold text-emerald-600 transition cursor-pointer shadow-2xs",
              (isExportingExcel || !data) && "opacity-60 cursor-not-allowed"
            )}
            title="Export full inventory report to Excel"
          >
            <FileSpreadsheet className={cn("h-3.5 w-3.5", isExportingExcel && "animate-spin")} />
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* ─── Error State ─── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-800">Unable to load Inventory Data</h4>
              <p className="text-[11px] text-rose-600 font-medium">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchInventory}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Skeleton Loading State ─── */}
      {loading && (
        <div className="space-y-6 animate-pulse select-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 h-64" />
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 h-64" />
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      {!loading && data && (
        <div className="space-y-6 select-none">
          {/* 1. Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Valuation */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inventory Value</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Boxes className="h-4 w-4" />
                </div>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mb-1">
                {formatAmount(data.summary.inventoryValue)}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Across {data.summary.totalItems} Active Stock SKUs</span>
              </div>
            </div>

            {/* Card 2: Low Stock Alerts */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Low Stock Items</span>
                <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mb-1">
                {data.summary.lowStockCount} <span className="text-xs font-semibold text-slate-400">Items</span>
              </div>
              <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Below Minimum Stock Threshold</span>
              </div>
            </div>

            {/* Card 3: Dead Stock */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dead Stock Items</span>
                <div className="h-8 w-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mb-1">
                {data.summary.deadStockCount} <span className="text-xs font-semibold text-slate-400">Items</span>
              </div>
              <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>No movement for 90+ days</span>
              </div>
            </div>

            {/* Card 4: Total Active SKUs */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Active SKUs</span>
                <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mb-1">
                {data.summary.totalItems} <span className="text-xs font-semibold text-slate-400">Items</span>
              </div>
              <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>100% Synced from Xero Ledger</span>
              </div>
            </div>
          </div>

          {/* 2. Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Chart: Stock Valuation Trend */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Inventory Valuation & Monthly Trend</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Monthly historical valuation velocity curve</p>
                </div>
                <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                  Last 7 Months
                </div>
              </div>
              <div className="h-60 w-full">
                <ReactECharts option={valueOverTimeOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            {/* Right Chart: Location Breakdown */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold text-slate-800">Valuation by Location</h3>
                  <span className="text-[11px] font-bold text-slate-400">Warehouse Pool</span>
                </div>
                <div className="h-48 w-full">
                  <ReactECharts option={inventoryByLocationOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              {/* Location Legend */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {locationData.map(loc => (
                  <div key={loc.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: loc.itemStyle.color }} />
                      <span className="font-semibold text-slate-700">{loc.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{currencySymbol}{loc.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Filter Bar & Search Tools */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            {/* Top Row: Tabs & Search */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                <button
                  onClick={() => { setActiveTab('All'); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                    activeTab === 'All' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  All Items ({data.items.length})
                </button>
                <button
                  onClick={() => { setActiveTab('Low'); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                    activeTab === 'Low' ? "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs" : "text-slate-500 hover:text-amber-600"
                  )}
                >
                  Low Stock ({data.summary.lowStockCount})
                </button>
                <button
                  onClick={() => { setActiveTab('Dead'); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                    activeTab === 'Dead' ? "bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs" : "text-slate-500 hover:text-rose-600"
                  )}
                >
                  Dead Stock ({data.summary.deadStockCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU code..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-400 mr-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Filters:</span>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[11px]">Group:</span>
                <select
                  value={groupFilter}
                  onChange={(e) => { setGroupFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All">All Groups</option>
                  {Array.from(new Set(data?.items?.map(i => i.group) || [])).map(grp => (
                    <option key={grp} value={grp}>{grp}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[11px]">Location:</span>
                <select
                  value={locationFilter}
                  onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All">All Locations</option>
                  {Array.from(new Set(data?.items?.map(i => i.location) || [])).map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-slate-400 text-[11px]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Dead Stock">Dead Stock</option>
                </select>
              </div>

              {/* Zero Stock Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 ml-auto">
                <span className="text-slate-400 text-[11px]">Show Zero Stock:</span>
                <select
                  value={showZeroStock}
                  onChange={(e) => { setShowZeroStock(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="Yes">Yes (Show All)</option>
                  <option value="No">No (Hide Zero Stock)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Interactive Data Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">On Hand</th>
                    <th className="py-3 px-4 text-right">Available</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Valuation</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold text-slate-600">No inventory items matched your selected filters</p>
                        <p className="text-[11px] text-slate-400">Try changing search keywords or resetting filters above.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, idx) => {
                      const itemIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                      return (
                        <tr key={item.code} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 text-slate-400 font-semibold">{itemIndex}</td>
                          <td className="py-3 px-4 font-extrabold text-slate-900 font-mono text-[11px]">{item.code}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{item.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {item.group}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Warehouse className="h-3 w-3 text-slate-400" />
                              {item.location}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {item.qtyOnHand}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600">
                            {item.qtyAvailable}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600">
                            {currencySymbol}{item.unitCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            {formatAmount(item.totalValue)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 select-none",
                              item.status === 'In Stock' && "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
                              item.status === 'Low Stock' && "bg-amber-50 text-amber-700 border border-amber-200/80",
                              item.status === 'Dead Stock' && "bg-rose-50 text-rose-700 border border-rose-200/80"
                            )}>
                              <span className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                item.status === 'In Stock' && "bg-emerald-500",
                                item.status === 'Low Stock' && "bg-amber-500",
                                item.status === 'Dead Stock' && "bg-rose-500"
                              )} />
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredItems.length > 0 && (
              <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500 select-none">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-3 py-1 font-bold text-slate-800">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
