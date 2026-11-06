'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  TrendingDown, 
  Calendar,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================================================
// TYPES
// ==================================================
interface InsightsData {
  revenueTrendPercent: number;
  overdueCount: number;
  cashDays: number;
  expenseGrowthPercent: number;
  taxMonth: string;
  healthScore: number;
  healthStatus: string;
}

// ==================================================
// SKELETON
// ==================================================
function SkeletonRow() {
  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs animate-pulse select-none min-h-[180px] space-y-4">
      <div className="h-4 w-48 bg-slate-100 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border border-slate-100 p-4 rounded-xl space-y-3 h-[120px]">
            <div className="h-4 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-full bg-slate-50 rounded" />
            <div className="h-3 w-12 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================================================
// COMPONENT
// ==================================================
export function AiInsightsWidget({ connected = false, loading = false }: { connected?: boolean; loading?: boolean }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [error, setError] = useState(false);

  const fetchInsights = async () => {
    try {
      setLoadingLocal(true);
      setError(false);
      const res = await fetch('/api/dashboard/insights');
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoadingLocal(false);
    }
  };

  useEffect(() => {
    if (connected) {
      fetchInsights();
    }

    const handleSync = () => {
      if (connected) {
        fetchInsights();
      }
    };
    window.addEventListener('xero-sync-complete', handleSync);
    return () => window.removeEventListener('xero-sync-complete', handleSync);
  }, [connected]);

  if (loading) {
    return <SkeletonRow />;
  }

  if (!connected) {
    return (
      <div className="bg-white rounded-lg border border-slate-200/80 p-8 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[180px]">
        <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-455 mb-3.5 animate-pulse">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <h4 className="text-[12.5px] font-bold text-slate-700 mb-1">Xero Disconnected</h4>
        <p className="text-[10.5px] text-slate-400 max-w-[340px] leading-relaxed font-sans">
          Please connect your Xero organization to view AI Insights & Recommendations.
        </p>
      </div>
    );
  }

  if (loading || loadingLocal) return <SkeletonRow />;
  if (error || !data) {
    return (
      <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col items-center justify-center text-center select-none min-h-[160px]">
        <AlertCircle className="h-5 w-5 text-red-500 mb-2 animate-bounce" />
        <h4 className="text-[12px] font-bold text-slate-700">Failed to Load AI Insights</h4>
        <button 
          onClick={fetchInsights} 
          className="mt-2.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[9.5px] font-bold flex items-center gap-1 transition"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const arcRadius = 30;
  const arcCirc = Math.PI * arcRadius; // 94.25
  const strokeOffset = arcCirc - (data.healthScore / 100) * arcCirc;

  const cards = [
    {
      title: 'Revenue Trend',
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      iconColor: 'bg-emerald-50 text-emerald-600 border-emerald-100/50',
      text: `Revenue increased by ${data.revenueTrendPercent}% compared to last month.`,
      linkText: 'View Details',
      href: '/revenue'
    },
    {
      title: 'Collection Alert',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      iconColor: 'bg-red-50 text-red-600 border-red-100/50',
      text: `${data.overdueCount} invoices are overdue. Follow up with customers.`,
      linkText: 'View Invoices',
      href: '/invoices'
    },
    {
      title: 'Cash Position',
      icon: <DollarSign className="h-3.5 w-3.5" />,
      iconColor: 'bg-teal-50 text-teal-600 border-teal-100/50',
      text: `Cash balance is sufficient for the next ${data.cashDays} days.`,
      linkText: 'View Cash Flow',
      href: '/cash-flow'
    },
    {
      title: 'Expense Alert',
      icon: <TrendingDown className="h-3.5 w-3.5" />,
      iconColor: 'bg-orange-50 text-orange-600 border-orange-100/50',
      text: `Operating expenses increased by ${data.expenseGrowthPercent}%.`,
      linkText: 'View Expenses',
      href: '/revenue' // map expenses to P&L / reports area
    },
    {
      title: 'Tax Reminder',
      icon: <Calendar className="h-3.5 w-3.5" />,
      iconColor: 'bg-indigo-50 text-indigo-600 border-indigo-100/50',
      text: `GST return is due in 4 days for ${data.taxMonth}.`,
      linkText: 'View Tax Center',
      href: '/reports'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs select-none">
      <h3 className="text-[13.5px] font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 shrink-0">
        AI Insights & Recommendations
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Render 5 Advice cards */}
        {cards.map((c, idx) => (
          <div key={idx} className="bg-slate-50/20 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between h-[135px]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-6 w-6 rounded-full border flex items-center justify-center shrink-0", c.iconColor)}>
                  {c.icon}
                </span>
                <span className="text-[10.5px] font-extrabold text-slate-700 truncate">{c.title}</span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-semibold leading-normal line-clamp-3">
                {c.text}
              </p>
            </div>
            
            <a 
              href={c.href}
              className="text-[9.5px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 outline-none mt-2 self-start"
            >
              <span>{c.linkText}</span>
              <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        ))}

        {/* Render Overall Health Gauge */}
        <div className="bg-slate-50/20 border border-slate-200/60 rounded-xl p-4 flex flex-col items-center justify-between h-[135px]">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Overall Health</span>
          
          <div className="relative w-24 h-12 flex items-center justify-center overflow-hidden -mt-1">
            <svg className="w-full h-full" viewBox="0 0 80 40">
              {/* Background semi-circle track */}
              <path 
                d="M 10 40 A 30 30 0 0 1 70 40" 
                fill="none" 
                stroke="#e2e8f0" 
                strokeWidth="5" 
                strokeLinecap="round" 
              />
              {/* Progress gauge stroke */}
              <path 
                d="M 10 40 A 30 30 0 0 1 70 40" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="5" 
                strokeLinecap="round" 
                strokeDasharray={arcCirc}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="absolute bottom-0 text-center flex flex-col items-center">
              <span className="text-[12.5px] font-black text-slate-800 leading-none">{data.healthScore}/100</span>
              <span className="text-[8px] font-bold text-emerald-600 uppercase mt-0.5 leading-none">{data.healthStatus}</span>
            </div>
          </div>

          <span className="text-[9px] text-slate-400 font-bold tracking-tight text-center">
            Keep up the great work!
          </span>
        </div>
      </div>
    </div>
  );
}
