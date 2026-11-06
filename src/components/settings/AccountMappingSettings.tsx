"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Check, 
  Sparkles, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  SlidersHorizontal,
  X,
  Filter,
  ShieldCheck,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export interface AccountMappingItem {
  id: number | string;
  source: string;
  sourceAccountId: string;
  accountCode: string;
  accountName: string;
  sourceAccountType: string;
  sourceAccountClass: string;
  financialStatementCategory: 'REVENUE' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_INCOME_EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY';
  subcategory: string;
  cfoAnalyticalTag: string;
  status: 'SUGGESTED' | 'CONFIRMED' | 'CUSTOM_OVERRIDE';
  confidenceScore: number;
  userConfirmed: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function AccountMappingSettings() {
  const [mappings, setMappings] = useState<AccountMappingItem[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    confirmedCount: 0,
    suggestedCount: 0,
    customCount: 0,
    unmappedCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'SUGGESTED' | 'CONFIRMED' | 'CUSTOM_OVERRIDE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [editingItem, setEditingItem] = useState<AccountMappingItem | null>(null);

  // Editable Form State in Modal Drawer
  const [editCategory, setEditCategory] = useState<AccountMappingItem['financialStatementCategory']>('OPERATING_EXPENSES');
  const [editSubcategory, setEditSubcategory] = useState<string>('GENERAL_ADMIN');
  const [editAnalyticalTag, setEditAnalyticalTag] = useState<string>('FIXED_OVERHEAD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMappings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/account-mappings');
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
        if (data.summary) setSummary(data.summary);
      } else {
        toast.error("Failed to load account mappings.");
      }
    } catch (err) {
      toast.error("Network error loading mappings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleQuickConfirm = async (item: AccountMappingItem) => {
    try {
      const res = await fetch('/api/dashboard/account-mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          mappingId: item.id
        })
      });
      if (res.ok) {
        toast.success(`Confirmed mapping for ${item.accountCode} - ${item.accountName}`);
        fetchMappings();
      } else {
        toast.error("Failed to confirm mapping");
      }
    } catch (err) {
      toast.error("Error confirming mapping");
    }
  };

  const handleOpenEditModal = (item: AccountMappingItem) => {
    setEditingItem(item);
    setEditCategory(item.financialStatementCategory);
    setEditSubcategory(item.subcategory || 'GENERAL_ADMIN');
    setEditAnalyticalTag(item.cfoAnalyticalTag || 'FIXED_OVERHEAD');
  };

  const handleSaveOverride = async (actionType: 'confirm' | 'override') => {
    if (!editingItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/account-mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          mappingId: editingItem.id,
          financialStatementCategory: editCategory,
          subcategory: editSubcategory,
          cfoAnalyticalTag: editAnalyticalTag
        })
      });
      if (res.ok) {
        toast.success(actionType === 'confirm' ? `Confirmed suggestion for ${editingItem.accountCode}` : `Saved custom override for ${editingItem.accountCode}`);
        setEditingItem(null);
        fetchMappings();
      } else {
        toast.error("Failed to update mapping");
      }
    } catch (err) {
      toast.error("Error updating mapping");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerSeed = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/account-mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' })
      });
      if (res.ok) {
        toast.success("Resynced Chart of Accounts suggestions!");
        fetchMappings();
      } else {
        toast.error("Failed to resync mappings");
      }
    } catch (err) {
      toast.error("Error resyncing mappings");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMappings = useMemo(() => {
    return mappings.filter(item => {
      if (activeTab !== 'ALL' && item.status !== activeTab) return false;
      if (categoryFilter !== 'ALL' && item.financialStatementCategory !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.accountCode.toLowerCase().includes(q) ||
          item.accountName.toLowerCase().includes(q) ||
          item.sourceAccountType.toLowerCase().includes(q) ||
          item.subcategory.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mappings, activeTab, categoryFilter, searchQuery]);

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case 'REVENUE': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'COST_OF_SALES': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'OPERATING_EXPENSES': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'ASSET': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'LIABILITY': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'EQUITY': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Cockpit */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Chart of Accounts Mapping
            </h2>
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              Multi-Tenant Isolated
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Map tenant-specific Xero general ledger accounts into universal CFO financial categories and analytical tags.
          </p>
        </div>

        <button
          onClick={handleTriggerSeed}
          disabled={isLoading}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Resync Suggestions</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Accounts</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">{summary.totalCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-950/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Needs Review (Suggested)</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{summary.suggestedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-950/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Confirmed Mappings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{summary.confirmedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-950/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Custom Overrides</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{summary.customCount}</p>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
          {(['ALL', 'SUGGESTED', 'CONFIRMED', 'CUSTOM_OVERRIDE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'ALL' && 'All'}
              {tab === 'SUGGESTED' && `Needs Review (${summary.suggestedCount})`}
              {tab === 'CONFIRMED' && `Confirmed (${summary.confirmedCount})`}
              {tab === 'CUSTOM_OVERRIDE' && `Custom (${summary.customCount})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Category Dropdown Filter */}
          <div className="relative w-full md:w-48 shrink-0">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="REVENUE">Revenue</option>
              <option value="COST_OF_SALES">Cost of Sales (COGS)</option>
              <option value="OPERATING_EXPENSES">Operating Expenses</option>
              <option value="OTHER_INCOME_EXPENSE">Other Income / Expense</option>
              <option value="ASSET">Assets</option>
              <option value="LIABILITY">Liabilities</option>
              <option value="EQUITY">Equity</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search code or account..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Account Mappings Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            Loading tenant chart of accounts mappings...
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-slate-500">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No account mappings found</p>
            <p className="mt-1">Try adjusting search filters or click "Resync Suggestions".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Xero Type / Class</th>
                  <th className="py-3 px-4">Financial Statement Category</th>
                  <th className="py-3 px-4">Subcategory & Tag</th>
                  <th className="py-3 px-4 text-center">Confidence</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {filteredMappings.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Code */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {item.accountCode || '—'}
                    </td>

                    {/* Account Name */}
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {item.accountName}
                    </td>

                    {/* Xero Type */}
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {item.sourceAccountType || item.sourceAccountClass || 'EXPENSE'}
                    </td>

                    {/* Category Badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(item.financialStatementCategory)}`}>
                        {item.financialStatementCategory}
                      </span>
                    </td>

                    {/* Subcategory & Tag */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                          {item.subcategory}
                        </span>
                        {item.cfoAnalyticalTag && item.cfoAnalyticalTag !== 'UNSPECIFIED' && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Tag: {item.cfoAnalyticalTag}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Confidence Score */}
                    <td className="py-3 px-4 text-center font-mono text-[11px] font-bold">
                      <span className={item.confidenceScore >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {Math.round(item.confidenceScore * 100)}%
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {item.status === 'SUGGESTED' && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-3 h-3" /> Needs Review
                        </span>
                      )}
                      {item.status === 'CONFIRMED' && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          <Check className="w-3 h-3" /> Confirmed
                        </span>
                      )}
                      {item.status === 'CUSTOM_OVERRIDE' && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                          <Sparkles className="w-3 h-3" /> Custom Override
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right shrink-0">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'SUGGESTED' && (
                          <button
                            onClick={() => handleQuickConfirm(item)}
                            className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                          >
                            Confirm
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          Review / Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Review Modal Drawer */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              onClick={() => setEditingItem(null)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-950 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 font-sans"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Review Account Mapping
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Account Code {editingItem.accountCode} — {editingItem.accountName}
                  </p>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informational Banner */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 dark:text-blue-200">
                  System suggestions are recommendations based on Xero account class and patterns. Confirming locks your decision for multi-tenant CFO metrics.
                </p>
              </div>

              {/* Modal Body / Controls */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Source Metadata Readonly */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Xero AccountID GUID:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[200px]">
                      {editingItem.sourceAccountId}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Xero Type / Class:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {editingItem.sourceAccountType || editingItem.sourceAccountClass || 'EXPENSE'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Suggested Confidence:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(editingItem.confidenceScore * 100)}% Match
                    </span>
                  </div>
                </div>

                {/* Control 1: Financial Statement Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Financial Statement Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="REVENUE">REVENUE (Income / Turnover)</option>
                    <option value="COST_OF_SALES">COST_OF_SALES (COGS / Direct Costs)</option>
                    <option value="OPERATING_EXPENSES">OPERATING_EXPENSES (Opex / Overheads)</option>
                    <option value="OTHER_INCOME_EXPENSE">OTHER_INCOME_EXPENSE (Interest / Taxes)</option>
                    <option value="ASSET">ASSET (Cash / Accounts Receivable / Inventory)</option>
                    <option value="LIABILITY">LIABILITY (Accounts Payable / Loans)</option>
                    <option value="EQUITY">EQUITY (Capital / Dividends / Retained)</option>
                  </select>
                </div>

                {/* Control 2: Subcategory */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    Financial Subcategory
                  </label>
                  <input
                    type="text"
                    value={editSubcategory}
                    onChange={e => setEditSubcategory(e.target.value)}
                    placeholder="e.g. PACKAGING, PAYMENT_PROCESSING, PAYROLL"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Common: PRODUCT_SALES, MARKETPLACE_SALES, PACKAGING, PAYMENT_PROCESSING, LOGISTICS_FULFILLMENT, PAYROLL, RENT_FACILITIES, SOFTWARE_SAAS
                  </span>
                </div>

                {/* Control 3: CFO Analytical Tag */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                    CFO Analytical Tag (Optional)
                  </label>
                  <select
                    value={editAnalyticalTag}
                    onChange={e => setEditAnalyticalTag(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UNSPECIFIED">UNSPECIFIED</option>
                    <option value="DIRECT_PRODUCT_COST">DIRECT_PRODUCT_COST (Packaging, COGS)</option>
                    <option value="VARIABLE_FULFILLMENT">VARIABLE_FULFILLMENT (Shipping, 3PL, Courier)</option>
                    <option value="MERCHANT_CHANNEL_FEE">MERCHANT_CHANNEL_FEE (Stripe, Amazon Fees)</option>
                    <option value="FIXED_OVERHEAD">FIXED_OVERHEAD (Salaries, Rent, Software)</option>
                    <option value="MARKETING_ACQUISITION">MARKETING_ACQUISITION (Ads, CAC)</option>
                    <option value="NON_OPERATING">NON_OPERATING (Interest, Tax)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveOverride('confirm')}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Suggestion
                  </button>

                  <button
                    onClick={() => handleSaveOverride('override')}
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    Save Custom Override
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
