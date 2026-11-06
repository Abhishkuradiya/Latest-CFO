"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Download,
  Copy,
  Check,
  Package,
  Layers,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  DollarSign,
  PieChart,
  ArrowRight,
  ChevronDown,
  Info,
  Filter,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import AccountTransactionsDrawer from './AccountTransactionsDrawer';

export interface ProductItem {
  name: string;
  code?: string;
  revenue: number;
  units: number;
  sharePct: number;
  gpMargin?: number;
  growth: number;
}

interface ProductBreakdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  products?: ProductItem[];
  salesData?: any;
  formatAmount: (val: number) => string;
}

export default function ProductBreakdownPanel({
  isOpen,
  onClose,
  products: initialProducts = [],
  salesData = null,
  formatAmount
}: ProductBreakdownPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'CLASS_A' | 'HIGH_VOLUME' | 'GROWTH'>('ALL');
  const [copied, setCopied] = useState(false);
  const [selectedProductForTransactions, setSelectedProductForTransactions] = useState<any | null>(null);

  // ESC Key Listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !selectedProductForTransactions) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedProductForTransactions, onClose]);

  // Derive products list from props or salesData
  const activeProducts: ProductItem[] = useMemo(() => {
    if (initialProducts && initialProducts.length > 0) return initialProducts;
    if (salesData?.topProducts && salesData.topProducts.length > 0) return salesData.topProducts;
    return [];
  }, [initialProducts, salesData]);

  // Total Revenue & Units
  const totalRevenue = useMemo(() => {
    return activeProducts.reduce((acc, p) => acc + (p.revenue || 0), 0);
  }, [activeProducts]);

  const totalUnits = useMemo(() => {
    return activeProducts.reduce((acc, p) => acc + (p.units || 0), 0);
  }, [activeProducts]);

  const avgUnitPrice = useMemo(() => {
    return totalUnits > 0 ? totalRevenue / totalUnits : 0;
  }, [totalRevenue, totalUnits]);

  // Enrich products with SKU parsing, ASP & ABC Analysis
  const enrichedProducts = useMemo(() => {
    let cumulativeRev = 0;
    return activeProducts.map((p, idx) => {
      const rev = p.revenue || 0;
      const units = p.units || 1;
      const asp = units > 0 ? rev / units : rev;
      const sharePct = p.sharePct !== undefined ? p.sharePct : (totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0);

      cumulativeRev += rev;
      const cumPct = totalRevenue > 0 ? (cumulativeRev / totalRevenue) * 100 : 0;

      // Extract SKU Code & Clean Name
      let skuCode = p.code || '';
      let cleanName = p.name || 'Product Item';
      if (!skuCode && p.name.includes(' - ')) {
        const parts = p.name.split(' - ');
        skuCode = parts[0].trim();
        cleanName = parts.slice(1).join(' - ').trim();
      }

      // ABC Classification Rule
      let abcClass: 'Class A' | 'Class B' | 'Class C' = 'Class C';
      if (cumPct <= 80 || idx < 3) abcClass = 'Class A';
      else if (cumPct <= 95) abcClass = 'Class B';

      return {
        ...p,
        cleanName,
        skuCode: skuCode || `SKU-${idx + 1}`,
        asp,
        sharePct: Number(sharePct.toFixed(1)),
        cumPct: Number(cumPct.toFixed(1)),
        abcClass
      };
    });
  }, [activeProducts, totalRevenue]);

  const topProduct = useMemo(() => {
    return enrichedProducts[0] || null;
  }, [enrichedProducts]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = enrichedProducts;

    if (filterCategory === 'CLASS_A') {
      list = list.filter(p => p.abcClass === 'Class A');
    } else if (filterCategory === 'HIGH_VOLUME') {
      list = list.filter(p => p.units >= 100);
    } else if (filterCategory === 'GROWTH') {
      list = list.filter(p => p.growth > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.cleanName.toLowerCase().includes(q) || p.skuCode.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }

    return list;
  }, [enrichedProducts, filterCategory, searchQuery]);

  // Export & Copy Handlers
  const handleCopy = () => {
    try {
      const text = enrichedProducts.map((p, idx) => `${idx + 1}\t${p.skuCode}\t${p.cleanName}\t${p.revenue}\t${p.units}\t${p.sharePct}%\t${p.abcClass}`).join('\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Products breakdown copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Rank,SKU Code,Product Name,Revenue (£),Units Sold,Avg Unit Price (£),Share (%),Growth (%),ABC Category"];
      const rows = enrichedProducts.map((p, idx) =>
        `${idx + 1},"${p.skuCode}","${p.cleanName}",${p.revenue},${p.units},${p.asp.toFixed(2)},${p.sharePct}%,${p.growth}%,${p.abcClass}`
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Products_Services_Breakdown_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Exported CSV successfully");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            
            {/* Semi-transparent Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs cursor-pointer"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Right Slide-Over Drawer Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-4xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-sans"
            >

              {/* DRAWER HEADER */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                        Products & Services Breakdown
                      </h2>
                      <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                        {activeProducts.length} SKU Items
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      SKU-level turnover, unit volume distribution & ASP performance audit
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-semibold"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    <span>CSV Export</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer outline-none ml-1"
                    aria-label="Close drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* TOP 4 KPI METRICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 shrink-0">
                
                {/* CARD 1: TOTAL PRODUCT REVENUE */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-3xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Product Sales</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-sans tracking-tight">
                    {formatAmount(totalRevenue)}
                  </div>
                  <div className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>Across {activeProducts.length} Product SKUs</span>
                  </div>
                </div>

                {/* CARD 2: TOTAL UNITS SOLD */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-3xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Volume / Units</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-sans tracking-tight">
                    {totalUnits.toLocaleString()} Units
                  </div>
                  <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                    Recognized quantity delivered
                  </div>
                </div>

                {/* CARD 3: AVERAGE SELLING PRICE (ASP) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-3xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Selling Price (ASP)</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-sans tracking-tight">
                    {formatAmount(avgUnitPrice)} / unit
                  </div>
                  <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                    Weighted unit price realization
                  </div>
                </div>

                {/* CARD 4: TOP PRODUCT DRIVER */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-3xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Product SKU</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 font-sans tracking-tight truncate" title={topProduct?.cleanName || '-'}>
                    {topProduct ? topProduct.cleanName : '-'}
                  </div>
                  {topProduct && (
                    <div className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                      <span>{formatAmount(topProduct.revenue)}</span>
                      <span className="bg-blue-50 dark:bg-blue-950 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900">
                        {topProduct.sharePct}% share
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* MAIN CONTENT SCROLL AREA */}
              <div className="flex-1 overflow-y-auto custom-table-scrollbar p-6 space-y-6">

                {/* TOP PRODUCTS GRAPHICAL DISTRIBUTION CHART */}
                <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Top Product Revenue Contribution Bars (ABC Pareto)
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Visual revenue share & unit volume breakdown per SKU
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      SKU Distribution
                    </span>
                  </div>

                  <div className="space-y-3 font-sans pt-1">
                    {enrichedProducts.slice(0, 5).map((p, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2 max-w-[320px] truncate">
                            <span className="font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[10px] border border-blue-100 dark:border-blue-900">
                              {p.skuCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {p.cleanName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 dark:text-white">{formatAmount(p.revenue)}</span>
                            <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                              ({p.units.toLocaleString()} units @ {formatAmount(p.asp)})
                            </span>
                            <span className="text-[10.5px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900">
                              {p.sharePct}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full ${idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-emerald-500' : idx === 2 ? 'bg-purple-600' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, p.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DETAILED PRODUCTS & SERVICES AUDIT SCHEDULE TABLE */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
                  
                  {/* Table Toolbar: Search & Filter Pills */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                        Product & SKU Audit Ledger
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        PostgreSQL registered inventory & service items ranked by revenue
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Filter Pills */}
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10.5px] font-bold">
                        <button
                          onClick={() => setFilterCategory('ALL')}
                          className={`px-2.5 py-1 rounded-lg transition ${filterCategory === 'ALL' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-slate-500'}`}
                        >
                          All ({enrichedProducts.length})
                        </button>
                        <button
                          onClick={() => setFilterCategory('CLASS_A')}
                          className={`px-2.5 py-1 rounded-lg transition ${filterCategory === 'CLASS_A' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-slate-500'}`}
                        >
                          Class A
                        </button>
                        <button
                          onClick={() => setFilterCategory('GROWTH')}
                          className={`px-2.5 py-1 rounded-lg transition ${filterCategory === 'GROWTH' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-slate-500'}`}
                        >
                          Growth (+)
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search product or SKU..."
                          className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Audit Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-3"># Rank</th>
                          <th className="py-3 px-3">SKU Code</th>
                          <th className="py-3 px-3">Product / Service Name</th>
                          <th className="py-3 px-3 text-right">Revenue (£)</th>
                          <th className="py-3 px-3 text-right">Units</th>
                          <th className="py-3 px-3 text-right">ASP (£)</th>
                          <th className="py-3 px-3 text-right">% Share</th>
                          <th className="py-3 px-3 text-right">Growth (%)</th>
                          <th className="py-3 px-3 text-center">ABC Class</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-10 text-center text-slate-400 font-medium">
                              No matching product records found in PostgreSQL database
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition cursor-pointer group"
                              onClick={() => setSelectedProductForTransactions(p)}
                            >
                              <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3 font-extrabold text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                                {p.skuCode}
                              </td>
                              <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white max-w-[220px] truncate" title={p.cleanName}>
                                {p.cleanName}
                              </td>
                              <td className="py-3 px-3 text-right font-black font-sans text-slate-900 dark:text-white">
                                {formatAmount(p.revenue)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-300 font-sans">
                                {p.units.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-500 font-sans">
                                {formatAmount(p.asp)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                {p.sharePct}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className={`inline-block px-2 py-0.5 rounded font-black text-[10.5px] ${
                                  p.growth >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                }`}>
                                  {p.growth >= 0 ? `+${p.growth}%` : `${p.growth}%`}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  p.abcClass === 'Class A'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : p.abcClass === 'Class B'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {p.abcClass}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedProductForTransactions(p)}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-[10.5px] font-extrabold hover:underline"
                                >
                                  View Ledger →
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LEVEL 2 ACCOUNT TRANSACTIONS DRAWER FOR SELECTED PRODUCT */}
      {selectedProductForTransactions && (
        <AccountTransactionsDrawer
          isOpen={!!selectedProductForTransactions}
          onClose={() => setSelectedProductForTransactions(null)}
          onBack={() => setSelectedProductForTransactions(null)}
          streamName={selectedProductForTransactions.cleanName || selectedProductForTransactions.name}
          totalRevenue={selectedProductForTransactions.revenue || 0}
        />
      )}
    </>
  );
}
