'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  FileText, 
  FileSpreadsheet, 
  ChevronDown, 
  SlidersHorizontal,
  RefreshCw, 
  BookOpen,
  Clock,
  Building,
  HelpCircle,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  Users,
  UserPlus,
  FileDown,
  FileUp,
  MoreVertical,
  Plus,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/common/page-container';
import { toast } from 'sonner';

interface ContactItem {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  email: string;
  phone: string;
  outstanding: number;
}

interface ContactsData {
  connected: boolean;
  summary: {
    customers: number;
    suppliers: number;
    totalOutstanding: number;
    arTotal: number;
    apTotal: number;
  };
  contacts: ContactItem[];
  meta: {
    currency: string;
    calculatedAt: string;
  };
}

export default function ContactsPage() {
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  
  const [data, setData] = useState<ContactsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tabs & Search & Filters
  const [activeTab, setActiveTab] = useState<'All' | 'Customer' | 'Supplier'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/contacts?date=${date}`);
      if (!res.ok) {
        throw new Error('Failed to load Contacts');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load Contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [date]);

  const currencyCode = data?.meta?.currency;
  const currencySymbol = currencyCode === 'GBP' ? '£' : (currencyCode === 'EUR' ? '€' : (currencyCode === 'INR' ? '₹' : currencyCode || ''));

  const formatAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined || !currencyCode) return '—';
    return `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filter contacts by active Tab and Search term
  const filteredContacts = (data?.contacts || []).filter(c => {
    if (activeTab === 'Customer' && c.type !== 'Customer') return false;
    if (activeTab === 'Supplier' && c.type !== 'Supplier') return false;
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchEmail = c.email ? c.email.toLowerCase().includes(q) : false;
      const matchPhone = c.phone ? c.phone.toLowerCase().includes(q) : false;
      return matchName || matchEmail || matchPhone;
    }
    return true;
  });

  return (
    <PageContainer>
      <div className="space-y-6 max-w-full pb-12 select-none">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
              <Link href="/overview" className="hover:text-slate-700 transition">Dashboard</Link>
              <span>&gt;</span>
              <span className="text-slate-700 font-bold">Contacts</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Contacts Directory</h1>
                <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                  Manage all connected Xero customers, suppliers, and outstanding balances.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchContacts}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-2xs text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => toast.success('Contacts directory exported!')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg shadow-2xs text-[11.5px] font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL CUSTOMERS</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">{data?.summary?.customers ?? 0}</span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Active Xero Customers</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL SUPPLIERS</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">{data?.summary?.suppliers ?? 0}</span>
            <span className="text-[10px] text-blue-600 font-bold mt-1 block">Active Vendors</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OUTSTANDING RECEIVABLES</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">{formatAmount(data?.summary?.arTotal ?? 0)}</span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Accounts Receivable</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OUTSTANDING PAYABLES</span>
            <span className="text-xl font-black text-rose-600 mt-1 block">{formatAmount(data?.summary?.apTotal ?? 0)}</span>
            <span className="text-[10px] text-rose-600 font-bold mt-1 block">Accounts Payable</span>
          </div>
        </div>

        {/* Contacts Table & Controls */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab('All')}
                className={cn("px-3 py-1 rounded text-xs font-bold transition cursor-pointer", activeTab === 'All' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600")}
              >
                All ({data?.contacts?.length ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('Customer')}
                className={cn("px-3 py-1 rounded text-xs font-bold transition cursor-pointer", activeTab === 'Customer' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600")}
              >
                Customers ({data?.summary?.customers ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('Supplier')}
                className={cn("px-3 py-1 rounded text-xs font-bold transition cursor-pointer", activeTab === 'Supplier' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600")}
              >
                Suppliers ({data?.summary?.suppliers ?? 0})
              </button>
            </div>

            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] font-medium text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-[11.5px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">CONTACT NAME</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">PHONE</th>
                  <th className="py-3 px-4 text-right">OUTSTANDING</th>
                  <th className="py-3 px-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-36 rounded shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-16 rounded shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-28 rounded shimmer-effect" /></td>
                      <td className="py-3.5 px-4"><div className="h-3.5 w-20 rounded shimmer-effect" /></td>
                      <td className="py-3.5 px-4 text-right"><div className="h-3.5 w-16 rounded shimmer-effect ml-auto" /></td>
                      <td className="py-3.5 px-4 text-center"><div className="h-4 w-4 rounded shimmer-effect mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                      No contacts found matching search filter.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{c.name}</td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 text-[9.5px] font-extrabold rounded uppercase tracking-wider border",
                          c.type === 'Customer' ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-purple-50 text-purple-600 border-purple-200"
                        )}>
                          {c.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{c.email || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{c.phone || '—'}</td>
                      <td className={cn("py-3.5 px-4 font-black text-right", c.outstanding > 0 ? "text-rose-600" : "text-slate-500")}>
                        {formatAmount(c.outstanding)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer">
                          <MoreVertical className="h-4 w-4" />
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
    </PageContainer>
  );
}
