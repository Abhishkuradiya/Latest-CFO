"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UserMenu } from './user-menu';
import { useSidebarStore } from '@/store/sidebar-store';
import { Bell, Calendar, RefreshCw, Menu, Filter, ChevronDown, Trash2, Building2, Check, Loader2, Clock, Globe, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { DateRangePicker } from '../ui/date-range-picker';
import { CFOAiDrawer } from '../common/cfo-ai-drawer';
import { cn } from '@/lib/utils';
import { getDefaultDateRange } from '@/lib/date-defaults';

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never synced";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

export function Header() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar, setOpenMobile } = useSidebarStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [syncTime, setSyncTime] = useState("Never synced");
  const lastSyncedRef = useRef<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [tempFromDate, setTempFromDate] = useState<string>('');
  const [tempToDate, setTempToDate] = useState<string>('');

  // Xero connections and organisation switcher state
  const [connections, setConnections] = useState<{ xeroTenantId: string; name: string }[]>([]);
  const [activeXeroTenantId, setActiveXeroTenantId] = useState<string | null>(null);
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Default computed date ranges from API fallback
  const [defaultStart, setDefaultStart] = useState<string | null>(null);
  const [defaultEnd, setDefaultEnd] = useState<string | null>(null);

  // Amazon specific states
  const isAmazon = pathname === '/amazon' || pathname?.startsWith('/amazon');
  const isStripe = pathname === '/stripe' || pathname?.startsWith('/stripe');
  const [showAmazonDatePicker, setShowAmazonDatePicker] = useState(false);
  const [amazonTempFrom, setAmazonTempFrom] = useState('');
  const [amazonTempTo, setAmazonTempTo] = useState('');
  const [isAmazonSyncing, setIsAmazonSyncing] = useState(false);
  const [amazonSyncTime, setAmazonSyncTime] = useState('Today, 10:42 AM');
  const amazonDatePickerRef = useRef<HTMLDivElement>(null);

  // Close switcher and date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowOrgSwitcher(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
      if (amazonDatePickerRef.current && !amazonDatePickerRef.current.contains(event.target as Node)) {
        setShowAmazonDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSidebar]);

  const fromDate = searchParams.get('from_date');
  const toDate = searchParams.get('to_date');

  const formatDateLabel = (dStr: string) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const defaults = getDefaultDateRange();
  const activeStart = fromDate || defaultStart || defaults.startDate;
  const activeEnd = toDate || defaultEnd || defaults.endDate;

  const dateRangeLabel = `${formatDateLabel(activeStart)} – ${formatDateLabel(activeEnd)}`;

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const updateUrlStr = (fromStr: string, toStr: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('from_date', fromStr);
    params.set('to_date', toStr);
    params.set('fromDate', fromStr);
    params.set('toDate', toStr);
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  };

  // Amazon URL search params & handlers
  const activeMarketplace = searchParams.get('marketplace') || 'all';
  const activeCurrency = searchParams.get('currency') || 'GBP';
  const activeAmazonFrom = searchParams.get('from_date') || '2026-08-01';
  const activeAmazonTo = searchParams.get('to_date') || '2026-09-30';

  const amazonDateRangeLabel = (activeAmazonFrom && activeAmazonTo)
    ? `${formatDateLabel(activeAmazonFrom)} – ${formatDateLabel(activeAmazonTo)}`
    : '1 Aug 2026 – 30 Sep 2026';

  const updateAmazonParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, val]) => {
      params.set(key, val);
    });
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  };

  const handleAmazonSync = async () => {
    setIsAmazonSyncing(true);
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
        setAmazonSyncTime(timeStr);
        toast.success(data.message || 'Amazon SP-API data synced successfully!');
        window.dispatchEvent(new CustomEvent('amazon-sync-complete'));
      } else {
        toast.error(data.error || 'Failed to sync Amazon data');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error connecting to sync server');
    } finally {
      setIsAmazonSyncing(false);
    }
  };

  const updateSyncLabel = () => {
    if (lastSyncedRef.current) {
      setSyncTime(formatTimeAgo(lastSyncedRef.current));
    } else {
      setSyncTime("Never synced");
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/xero', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setConnections(data.connections || []);
          setActiveXeroTenantId(data.activeXeroTenantId || null);
          setActiveOrgName(data.organisation || null);

          setDefaultStart(data.startDate || null);
          setDefaultEnd(data.endDate || null);

          if (data.lastSyncedAt) {
            lastSyncedRef.current = data.lastSyncedAt;
            setSyncTime(formatTimeAgo(data.lastSyncedAt));
          } else {
            lastSyncedRef.current = null;
            setSyncTime("Never synced");
          }
        } else {
          setConnections([]);
          setActiveXeroTenantId(null);
          setActiveOrgName(null);
          setDefaultStart(null);
          setDefaultEnd(null);
          lastSyncedRef.current = null;
          setSyncTime("Never synced");
        }
      }
    } catch (err) { }
  };

  const handleSwitchOrg = async (id: string, name: string) => {
    if (id === activeXeroTenantId) return;
    setIsSwitchingOrg(true);
    setShowOrgSwitcher(false);
    toast.loading(`Switching organization to ${name}...`, { id: "switch-toast" });

    try {
      const res = await fetch('/api/xero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ switchXeroTenantId: id, organisationName: name })
      });

      if (res.ok) {
        toast.success(`Switched to ${name}. Loading its financial data...`, { id: "switch-toast" });
        setActiveXeroTenantId(id);
        setActiveOrgName(name);

        // Rebuild the cleared organization cache in rate-safe request batches,
        // then let the active page reload its own selected-period data.
        const syncCompleted = await handleSync();
        if (!syncCompleted) {
          window.dispatchEvent(new CustomEvent('xero-sync-complete'));
        }

        // Refresh router/server page data
        router.refresh();
      } else {
        toast.error("Failed to switch organization.", { id: "switch-toast" });
      }
    } catch (err) {
      toast.error("Error switching organization.", { id: "switch-toast" });
    } finally {
      setIsSwitchingOrg(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();

    const handleSyncComplete = () => {
      fetchSyncStatus();
    };

    window.addEventListener('xero-sync-complete', handleSyncComplete);
    const interval = setInterval(updateSyncLabel, 15000);

    return () => {
      window.removeEventListener('xero-sync-complete', handleSyncComplete);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    toast.loading("Syncing latest transactions from Xero...", { id: "sync-toast" });

    try {
      const res = await fetch('/api/xero', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : null;

      if (res.ok && data?.success) {
        toast.success(data.message || "Xero sync completed successfully!", { id: "sync-toast" });
        setSyncTime("Just now");
        window.dispatchEvent(new CustomEvent('xero-sync-complete'));
        router.refresh();
        return true;
      } else if (res.status === 504 || contentType.includes('text/html')) {
        toast.error("The sync request timed out. Check the sync status before starting another sync.", { id: "sync-toast" });
      } else {
        toast.error(data?.message || "Xero sync failed. Please check credentials or try again.", { id: "sync-toast" });
        return false;
      }
    } catch (err: any) {
      toast.error(err?.message || "Error triggering Xero sync.", { id: "sync-toast" });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    toast.loading("Purging local report cache...", { id: "cache-toast" });
    try {
      const res = await fetch('/api/xero/clear-cache', { method: 'POST' });
      if (res.ok) {
        toast.success("Cache purged successfully! Pulling fresh data from Live Xero API...", { id: "cache-toast" });
        window.dispatchEvent(new CustomEvent('xero-sync-complete'));
        router.refresh();
      } else {
        toast.error("Failed to clear cache.", { id: "cache-toast" });
      }
    } catch (err) {
      toast.error("Error clearing cache.", { id: "cache-toast" });
    } finally {
      setIsClearingCache(false);
    }
  };

  const isSales = pathname === '/sales';
  const isManagementAccounts = pathname === '/management-accounts';

  const isDemoMode = searchParams.get('mode') === 'demo';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-200">
      {/* Demo Mode Top Banner Strip ("Patti") - Placed ABOVE the header bar */}
      {isAmazon && isDemoMode && (
        <div className="bg-amber-500 text-slate-950 px-4 sm:px-6 py-1.5 text-[11.5px] sm:text-xs font-extrabold flex items-center justify-center shadow-2xs border-b border-amber-600/40">
          <div className="flex items-center gap-2.5 max-w-full overflow-hidden px-1">
            <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950" />
            </span>
            <span className="truncate">
              <strong>DEMO DATA MODE</strong> — You are viewing sample store analytics & preview data. Switch to Live Data to connect your Amazon account.
            </span>
          </div>
        </div>
      )}

      <div className="w-full px-4 md:px-6 flex h-20 items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {/* Responsive Hamburger / Sidebar Toggle Menu Button */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setOpenMobile(true);
              } else {
                toggleSidebar();
              }
            }}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer outline-none transition shrink-0 shadow-2xs md:flex",
              isCollapsed && "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800"
            )}
            aria-label="Toggle navigation menu"
            title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          >
            <Menu className="h-5 w-5" />
          </button>

        </div>

        {(isAmazon || isStripe) ? (
          /* Amazon & Stripe Header Right Section: Bell + User Menu */
          <div className="flex items-center gap-3 shrink-0">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-650 cursor-pointer outline-none transition shadow-2xs">
              <Bell className="h-3.5 w-3.5 text-slate-500" />
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[7.5px] font-bold text-white border border-white">
                5
              </span>
            </button>

            <span className="h-5 w-px bg-slate-200 dark:bg-slate-700 my-auto shrink-0" />

            <UserMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 md:gap-3 shrink-0 flex-nowrap">
            {/* Organisation Switcher */}
            {connections.length > 0 && (
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => !isSwitchingOrg && setShowOrgSwitcher(!showOrgSwitcher)}
                  disabled={isSwitchingOrg}
                  aria-label={activeOrgName || "Select organisation"}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-750 shadow-2xs transition cursor-pointer outline-none h-9.5 disabled:opacity-60"
                >
                  {isSwitchingOrg ? (
                    <Loader2 className="h-3.5 w-3.5 text-slate-500 animate-spin" />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 text-slate-450" />
                  )}
                  <span className={cn("truncate max-w-[130px] font-bold text-slate-700", isManagementAccounts && "max-lg:hidden")}>{activeOrgName || "Select Company"}</span>
                  {connections.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                </button>

                {showOrgSwitcher && connections.length > 1 && (
                  <div className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-2.5 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                      Switch Organisation
                    </div>
                    <div className="space-y-0.5 max-h-60 overflow-y-auto">
                      {connections.map((conn) => {
                        const isActive = conn.xeroTenantId === activeXeroTenantId;
                        return (
                          <button
                            key={conn.xeroTenantId}
                            onClick={() => handleSwitchOrg(conn.xeroTenantId, conn.name)}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-lg transition-colors cursor-pointer outline-none ${isActive
                              ? "bg-slate-50 font-bold text-slate-900"
                              : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-900"
                              }`}
                          >
                            <span className="truncate pr-2">{conn.name}</span>
                            {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date Range Picker for Overview / Reports (Hidden on pages with dedicated report date pickers like Balance Sheet, P&L, Trial Balance & Cash Flow) */}
            {(pathname === '/overview' || isSales || (pathname.startsWith('/reports') && pathname !== '/reports/balance-sheet' && pathname !== '/reports/trial-balance' && pathname !== '/reports/profit-and-loss' && pathname !== '/reports/cash-flow')) && (
              <div className="relative shrink-0" ref={datePickerRef}>
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer outline-none h-9.5"
                >
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span>{dateRangeLabel}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", showDatePicker && "rotate-180")} />
                </button>

                {/* Dropdown Menu */}
                {showDatePicker && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2 px-1">Quick Select</span>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      <button
                        onClick={() => {
                          const now = new Date();
                          const from = new Date(now.getFullYear(), now.getMonth(), 1);
                          const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          updateUrlStr(formatYMD(from), formatYMD(to));
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition cursor-pointer"
                      >
                        This Month
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                          const to = new Date(now.getFullYear(), now.getMonth(), 0);
                          updateUrlStr(formatYMD(from), formatYMD(to));
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition cursor-pointer"
                      >
                        Last Month
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                          const to = now;
                          updateUrlStr(formatYMD(from), formatYMD(to));
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition cursor-pointer"
                      >
                        Last 3 Months
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const from = new Date(now.getFullYear(), 0, 1);
                          const to = new Date(now.getFullYear(), 11, 31);
                          updateUrlStr(formatYMD(from), formatYMD(to));
                          setShowDatePicker(false);
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 text-left transition cursor-pointer"
                      >
                        This Year
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-2.5">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">Custom Range</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9.5px] font-bold text-slate-400 block mb-1">From Date</label>
                          <input
                            type="date"
                            value={tempFromDate || activeStart}
                            onChange={(e) => setTempFromDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] font-bold text-slate-400 block mb-1">To Date</label>
                          <input
                            type="date"
                            value={tempToDate || activeEnd}
                            onChange={(e) => setTempToDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const f = tempFromDate || activeStart;
                          const t = tempToDate || activeEnd;
                          if (f && t) {
                            updateUrlStr(f, t);
                            setShowDatePicker(false);
                          }
                        }}
                        className="w-full py-2 mt-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11.5px] rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        Apply Date Range
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sync Status Section */}
            <div className={cn("flex items-center gap-1.5 select-none h-9.5", isManagementAccounts && "max-lg:hidden")}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-[11px] text-slate-400 font-semibold leading-none">Updated {syncTime}</span>
            </div>

            {!isSales && (
              <>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-655 bg-white hover:bg-slate-50 transition disabled:opacity-55 cursor-pointer outline-none shadow-2xs h-9.5", isManagementAccounts && "max-lg:hidden")}
                  title="Purges local report cache and fetches fresh live data directly from Xero API"
                >
                  <Trash2 className={`h-3.5 w-3.5 ${isClearingCache ? 'animate-pulse text-red-500' : 'text-slate-450'}`} />
                  <span>Clear Cache</span>
                </button>

                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary text-xs font-bold text-primary bg-white hover:bg-primary/5 active:bg-primary/10 transition disabled:opacity-50 cursor-pointer outline-none shadow-2xs h-9.5", isManagementAccounts && "max-lg:hidden")}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {pathname === '/data-sources' ? 'Sync All' : 'Sync Now'}
                </button>
              </>
            )}

            {/* Funnel/Filter Icon for Sales dashboard */}
            {isSales && (
              <button className="flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 cursor-pointer outline-none transition shadow-2xs">
                <Filter className="h-4 w-4 text-slate-450" />
              </button>
            )}

            {/* Notifications Popover */}
            <button className="relative flex h-9.5 w-9.5 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 cursor-pointer outline-none transition shadow-2xs">
              <Bell className="h-4 w-4 text-slate-500" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8.5px] font-bold text-white border border-white">
                {isSales ? 12 : 5}
              </span>
            </button>

            <span className="h-6 w-px bg-slate-250/70 my-auto mx-1" />

            {/* User Account Menu */}
            <UserMenu />
          </div>
        )}
      </div>
      <CFOAiDrawer />
    </header>
  );
}
