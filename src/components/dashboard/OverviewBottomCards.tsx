'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckSquare,
  Users,
  Building,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
  CreditCard,
  Receipt,
  Landmark,
  BookOpen,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================================================
// SKELETON LOADER
// ==================================================
function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-4 animate-pulse select-none min-h-[395px] flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="h-4 w-28 bg-slate-100 rounded" />
        <div className="h-4 w-4 bg-slate-100 rounded" />
      </div>
      <div className="space-y-3 flex-1 pt-2">
        <div className="h-4.5 w-40 bg-slate-100 rounded" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <div className="h-9 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

// ==================================================
// ERROR STATE
// ==================================================
function CardErrorState({ title, desc, onRetry }: { title: string; desc: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px]">
      <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3 animate-bounce">
        <AlertCircle className="h-4.5 w-4.5 stroke-[1.8]" />
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal mb-3.5">{desc}</p>
      <button 
        onClick={onRetry} 
        className="px-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[10px] font-bold transition flex items-center gap-1.5"
      >
        <RefreshCw className="h-3 w-3" />
        <span>Retry</span>
      </button>
    </div>
  );
}

// ==================================================
// EMPTY STATE
// ==================================================
function CardEmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px]">
      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Activity className="h-4.5 w-4.5 stroke-[1.5]" />
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal">{desc}</p>
    </div>
  );
}

// ==================================================
// DISCONNECTED STATE
// ==================================================
function CardDisconnectedState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[395px]">
      <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
        <svg className="h-4.5 w-4.5 text-slate-450" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
      <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">{title}</h4>
      <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal">{desc}</p>
    </div>
  );
}

// ==================================================
// HELPER FOR CURRENCY FORMATTING
// ==================================================
function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency || '$'}${amount.toLocaleString()}`;
  }
}

// ==================================================
// CARD 1: RECENT ACTIVITY CARD
// ==================================================
interface ActivityItem {
  type: string;
  title: string;
  subtitle: string;
  amount: number | null;
  currency: string;
  time: string;
  icon: string;
  color: string;
}

function ActivityIcon({ icon, color }: { icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-500 border-blue-100',
    green: 'bg-emerald-50 text-emerald-500 border-emerald-100',
    orange: 'bg-orange-50 text-orange-500 border-orange-100',
    red: 'bg-red-50 text-red-500 border-red-100',
    purple: 'bg-purple-50 text-purple-500 border-purple-100',
    teal: 'bg-teal-50 text-teal-500 border-teal-100',
    gray: 'bg-slate-50 text-slate-500 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-500 border-indigo-100'
  };

  const iconMap: Record<string, React.ReactNode> = {
    invoice: <FileText className="h-3 w-3" />,
    payment: <CreditCard className="h-3 w-3" />,
    bill: <Receipt className="h-3 w-3" />,
    creditnote: <Receipt className="h-3 w-3" />,
    bank: <Landmark className="h-3 w-3" />,
    journal: <BookOpen className="h-3 w-3" />,
    contact: <UserPlus className="h-3 w-3" />
  };

  return (
    <div className={cn('h-6 w-6 rounded-full border flex items-center justify-center shrink-0', colorMap[color] || colorMap.gray)}>
      {iconMap[icon] || <Activity className="h-3 w-3" />}
    </div>
  );
}

function RecentActivityCard({ 
  activities, 
  loading, 
  error, 
  onRetry,
  onNavigate 
}: { 
  activities: ActivityItem[]; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Failed to Load Activities" desc="We couldn't retrieve the activity list." onRetry={onRetry} />;
  if (activities.length === 0) return <CardEmptyState title="No Recent Activity" desc="No recent transactions found." />;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Recent Activity</h3>
        </div>
      </div>

      {/* Direct layout list fitting exactly 8 items without scroll */}
      <div className="flex-1 space-y-1.5 py-3.5">
        {activities.slice(0, 8).map((act, idx) => (
          <div key={idx} className="flex items-center gap-2 text-[10px]">
            <ActivityIcon icon={act.icon} color={act.color} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-700 truncate">{act.title}</div>
              <div className="text-[8px] text-slate-400 font-semibold">{act.subtitle}</div>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end">
              {act.amount !== null && (
                <span className="font-bold text-slate-700">{formatCurrency(act.amount, act.currency)}</span>
              )}
              <span className="text-[7.5px] font-bold text-slate-400">{act.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================================================
// CARD 2: PENDING APPROVALS CARD
// ==================================================
interface ApprovalSection {
  count: number;
  amount: number;
}

interface ApprovalsData {
  totalPending: number;
  invoices: ApprovalSection;
  bills: ApprovalSection;
  purchaseOrders: ApprovalSection;
}

function PendingApprovalsCard({ 
  data, 
  loading, 
  error, 
  onRetry,
  onNavigate,
  currency = 'USD'
}: { 
  data: ApprovalsData | null; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
  currency?: string;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Failed to Load Approvals" desc="We couldn't retrieve pending approvals." onRetry={onRetry} />;
  if (!data) return <CardEmptyState title="No Pending Approvals" desc="Your approval workload is empty." />;

  const sections = [
    { label: 'Invoices Awaiting Approval', count: data.invoices.count, amount: data.invoices.amount, color: 'text-blue-600 bg-blue-50 border-blue-100', icon: <FileText className="h-3.5 w-3.5" /> },
    { label: 'Bills Awaiting Approval', count: data.bills.count, amount: data.bills.amount, color: 'text-orange-600 bg-orange-50 border-orange-100', icon: <Receipt className="h-3.5 w-3.5" /> },
    { label: 'Purchase Orders Pending', count: data.purchaseOrders.count, amount: data.purchaseOrders.amount, color: 'text-slate-600 bg-slate-50 border-slate-200', icon: <BookOpen className="h-3.5 w-3.5" /> }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Pending Approvals</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {data.totalPending} items
        </span>
      </div>

      <div className="flex-1 py-4 space-y-4">
        {sections.map((sec, idx) => (
          <div key={idx} className="flex justify-between items-center text-[10.5px]">
            <div className="flex items-center gap-2.5">
              <div className={cn("h-7 w-7 rounded-full border flex items-center justify-center shrink-0", sec.color)}>
                {sec.icon}
              </div>
              <div>
                <span className="font-extrabold text-slate-700 block">{sec.label}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{sec.count} Awaiting Approval</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-extrabold text-slate-700 block">{formatCurrency(sec.amount, currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================================================
// CARD 3: TOP CUSTOMERS CARD
// ==================================================
interface CustomerItem {
  name: string;
  revenue: number;
  avatar: string;
}

function TopCustomersCard({ 
  customers, 
  loading, 
  error, 
  onRetry,
  onNavigate,
  currency = 'USD'
}: { 
  customers: CustomerItem[]; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
  currency?: string;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Failed to Load Customers" desc="We couldn't retrieve top customers." onRetry={onRetry} />;
  if (customers.length === 0) return <CardEmptyState title="No Customers This Month" desc="No paid customer revenue this month." />;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Top Customers (MTD)</h3>
        </div>
      </div>

      <div className="flex-1 py-3.5 space-y-3">
        {customers.map((c, idx) => (
          <div key={idx} className="flex justify-between items-center text-[10.5px]">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
              <div className="h-7 w-7 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                {c.avatar}
              </div>
              <span className="font-extrabold text-slate-700 truncate block" title={c.name}>{c.name}</span>
            </div>
            <span className="font-extrabold text-emerald-600 shrink-0 whitespace-nowrap">{formatCurrency(c.revenue, currency)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onNavigate || (() => window.location.href = '/reports/customers')} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// CARD 4: TOP VENDORS CARD
// ==================================================
interface VendorItem {
  name: string;
  amount: number;
  avatar: string;
}

function TopVendorsCard({ 
  vendors, 
  loading, 
  error, 
  onRetry,
  onNavigate,
  currency = 'USD'
}: { 
  vendors: VendorItem[]; 
  loading: boolean; 
  error: boolean; 
  onRetry: () => void;
  onNavigate: () => void;
  currency?: string;
}) {
  if (loading) return <CardSkeleton />;
  if (error) return <CardErrorState title="Failed to Load Vendors" desc="We couldn't retrieve top vendors." onRetry={onRetry} />;
  if (vendors.length === 0) return <CardEmptyState title="No Vendors Paid" desc="No payments processed for vendors this month." />;

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition duration-300 flex flex-col justify-between select-none min-h-[395px]">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Building className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Top Vendors (MTD)</h3>
        </div>
      </div>

      <div className="flex-1 py-3.5 space-y-3">
        {vendors.map((v, idx) => (
          <div key={idx} className="flex justify-between items-center text-[10.5px]">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
              <div className="h-7 w-7 rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-extrabold text-[9px] flex items-center justify-center shrink-0">
                {v.avatar}
              </div>
              <span className="font-extrabold text-slate-700 truncate block" title={v.name}>{v.name}</span>
            </div>
            <span className="font-extrabold text-slate-700 shrink-0 whitespace-nowrap">{formatCurrency(v.amount, currency)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 shrink-0">
        <button onClick={onNavigate || (() => window.location.href = '/reports/vendors')} className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer">
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ==================================================
// MAIN ROW CONTAINER COMPONENT
// ==================================================
export function OverviewBottomCardsRow({ currency, connected = false, loading = false }: { currency?: string; connected?: boolean; loading?: boolean }) {
  const activeCurrency = currency || 'USD';
  const [actData, setActData] = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading] = useState(true);
  const [actError, setActError] = useState(false);

  const [appData, setAppData] = useState<ApprovalsData | null>(null);
  const [appLoading, setAppLoading] = useState(true);
  const [appError, setAppError] = useState(false);

  const [custData, setCustData] = useState<CustomerItem[]>([]);
  const [custLoading, setCustLoading] = useState(true);
  const [custError, setCustError] = useState(false);

  const [vendData, setVendData] = useState<VendorItem[]>([]);
  const [vendLoading, setVendLoading] = useState(true);
  const [vendError, setVendError] = useState(false);

  const fetchActivities = async () => {
    try {
      setActLoading(true);
      setActError(false);
      const res = await fetch('/api/dashboard/recent-activities');
      if (res.ok) {
        const data = await res.json();
        setActData(data.activities || []);
      } else {
        setActError(true);
      }
    } catch {
      setActError(true);
    } finally {
      setActLoading(false);
    }
  };

  const fetchApprovals = async () => {
    try {
      setAppLoading(true);
      setAppError(false);
      const res = await fetch('/api/dashboard/pending-approvals');
      if (res.ok) {
        setAppData(await res.json());
      } else {
        setAppError(true);
      }
    } catch {
      setAppError(true);
    } finally {
      setAppLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setCustLoading(true);
      setCustError(false);
      const res = await fetch('/api/dashboard/top-customers');
      if (res.ok) {
        const data = await res.json();
        setCustData(data.customers || []);
      } else {
        setCustError(true);
      }
    } catch {
      setCustError(true);
    } finally {
      setCustLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      setVendLoading(true);
      setVendError(false);
      const res = await fetch('/api/dashboard/top-vendors');
      if (res.ok) {
        const data = await res.json();
        setVendData(data.vendors || []);
      } else {
        setVendError(true);
      }
    } catch {
      setVendError(true);
    } finally {
      setVendLoading(false);
    }
  };

  const loadAll = () => {
    fetchActivities();
    fetchApprovals();
    fetchCustomers();
    fetchVendors();
  };

  useEffect(() => {
    if (connected) {
      loadAll();
    }

    // Re-fetch on custom sync events
    const handleSyncComplete = () => {
      if (connected) {
        loadAll();
      }
    };

    window.addEventListener('xero-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
    };
  }, [connected]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <CardDisconnectedState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view recent activity feed." 
        />
        <CardDisconnectedState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view pending approvals." 
        />
        <CardDisconnectedState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view top customers." 
        />
        <CardDisconnectedState 
          title="Xero Disconnected" 
          desc="Please connect your Xero organization to view top vendors." 
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      <RecentActivityCard 
        activities={actData}
        loading={actLoading}
        error={actError}
        onRetry={fetchActivities}
        onNavigate={() => window.location.href = '/reports'}
      />
      <PendingApprovalsCard 
        data={appData}
        loading={appLoading}
        error={appError}
        onRetry={fetchApprovals}
        onNavigate={() => window.location.href = '/reports'}
        currency={activeCurrency}
      />
      <TopCustomersCard 
        customers={custData}
        loading={custLoading}
        error={custError}
        onRetry={fetchCustomers}
        onNavigate={() => window.location.href = '/invoices'}
        currency={activeCurrency}
      />
      <TopVendorsCard 
        vendors={vendData}
        loading={vendLoading}
        error={vendError}
        onRetry={fetchVendors}
        onNavigate={() => window.location.href = '/purchases'}
        currency={activeCurrency}
      />
    </div>
  );
}
