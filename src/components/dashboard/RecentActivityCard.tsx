'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  CreditCard,
  Receipt,
  Landmark,
  BookOpen,
  UserPlus,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───
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

// ─── Reusable sub-components ───

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

  const classes = colorMap[color] || colorMap.gray;
  const ic = iconMap[icon] || <Activity className="h-3 w-3" />;

  return (
    <div className={cn(
      'h-7 w-7 rounded-full border flex items-center justify-center shrink-0',
      classes
    )}>
      {ic}
    </div>
  );
}

function AmountFormatter({ amount, currency }: { amount: number | null; currency: string }) {
  if (amount === null || amount === undefined) return null;
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
    return (
      <span className="text-[10.5px] font-extrabold text-slate-700 whitespace-nowrap shrink-0">
        {formatted}
      </span>
    );
  } catch {
    return (
      <span className="text-[10.5px] font-extrabold text-slate-700 whitespace-nowrap shrink-0">
        {currency}{Math.abs(amount).toLocaleString()}
      </span>
    );
  }
}

function RelativeTime({ time }: { time: string }) {
  return (
    <span className="text-[8.5px] font-semibold text-slate-400 whitespace-nowrap">
      {time}
    </span>
  );
}

function TimelineItem({ activity, isLast }: { activity: ActivityItem; isLast: boolean }) {
  return (
    <div className="flex gap-3 group">
      {/* Timeline column: icon + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <ActivityIcon icon={activity.icon} color={activity.color} />
        {!isLast && (
          <div className="w-px flex-1 bg-slate-100 mt-1 min-h-[12px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast ? 'pb-4' : 'pb-0')}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold text-slate-700 leading-snug truncate">
              {activity.title}
            </div>
            <div className="text-[9px] font-semibold text-slate-400 mt-0.5 truncate">
              {activity.subtitle}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <AmountFormatter amount={activity.amount} currency={activity.currency} />
            <RelativeTime time={activity.time} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ───
function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center shrink-0">
            <div className="h-7 w-7 rounded-full bg-slate-100" />
            {i < 5 && <div className="w-px flex-1 bg-slate-50 mt-1 min-h-[12px]" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex justify-between">
              <div className="space-y-1.5">
                <div className="h-3 w-36 bg-slate-100 rounded" />
                <div className="h-2.5 w-24 bg-slate-50 rounded" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="h-3 w-14 bg-slate-100 rounded" />
                <div className="h-2.5 w-16 bg-slate-50 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───
export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch('/api/dashboard/recent-activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    const handleSync = () => fetchActivities();
    window.addEventListener('xero-sync-complete', handleSync);
    return () => window.removeEventListener('xero-sync-complete', handleSync);
  }, []);

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs flex flex-col select-none">
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-[#0064eb] stroke-[2]" />
          <h3 className="text-[13.5px] font-bold text-slate-800">Recent Activity</h3>
        </div>
        <a href="/reports" className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5">
          <span>View All</span>
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Content */}
      {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3">
            <AlertCircle className="h-4 w-4 stroke-[1.8]" />
          </div>
          <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">Failed to Load Activities</h4>
          <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal mb-3.5">
            We couldn't fetch the recent activity timeline.
          </p>
          <button
            onClick={fetchActivities}
            className="px-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[10px] font-bold transition flex items-center gap-1.5"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Activity className="h-4 w-4 stroke-[1.5]" />
          </div>
          <h4 className="text-[12px] font-bold text-slate-700 mb-0.5">No Recent Activity Found</h4>
          <p className="text-[9.5px] text-slate-400 max-w-[185px] leading-normal">
            Activity from invoices, payments, and other transactions will appear here once synced.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          {activities.map((activity, idx) => (
            <TimelineItem
              key={idx}
              activity={activity}
              isLast={idx === activities.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
