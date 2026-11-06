"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebarStore } from '@/store/sidebar-store';
import { useUserStore } from '@/store/user-store';
import {
  LayoutGrid,
  BarChart3,
  BarChart2,
  LineChart,
  TrendingUp,
  PieChart,
  Users,
  Package,
  Layers,
  Activity,
  Wallet,
  FileText,
  CreditCard,
  Landmark,
  Calculator,
  Scale,
  ShoppingBag,
  Database,
  Cpu,
  Settings,
  ChevronDown,
  ChevronLeft,
  X,
  Lock,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
  BookOpen,
  Contact,
  SlidersHorizontal,
  Save,
  RefreshCw,
  Bot,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CONNECTOR_NAMES } from '@/lib/connector-guard';
import { ALL_SYSTEM_ROLES } from '@/lib/menu-definitions';

interface SubItem {
  name: string;
  href: string;
  connectorId?: string;
}

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  connectorId?: string;
  badge?: string;
  hasDropdown?: boolean;
  subItems?: SubItem[];
}

interface NavSection {
  title?: string;
  items: MenuItem[];
}

interface PermissionEntry {
  role: string;
  menu_key: string;
  is_enabled: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar, setCollapsed, isOpenMobile, setOpenMobile } = useSidebarStore();
  const { user } = useUserStore();

  // Session-resolved state from API
  const [activeUserEmail, setActiveUserEmail] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState<boolean>(false);
  
  // Synchronous localStorage cache initialization on mount to prevent ANY flickering
  const [menuPermissions, setMenuPermissions] = useState<PermissionEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cfo_menu_permissions_')) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      }
    } catch (e) {}
    return [];
  });

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'Ecommerce Stores': false,
    'Payment Gateways': false
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredItemTop, setHoveredItemTop] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Dynamic drawer state
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [drawerRole, setDrawerRole] = useState<string>('ALL');
  const [drawerPermissionsMap, setDrawerPermissionsMap] = useState<Record<string, boolean>>({});
  const [savingDrawer, setSavingDrawer] = useState<boolean>(false);

  // Dynamic connector connection status
  const [connectorStatus, setConnectorStatus] = useState<Record<string, boolean>>({
    xero: true,
    amazon: false,
    ebay: false,
    shopify: false,
    woocommerce: false,
    etsy: false,
    stripe: false,
    paypal: false,
    square: false,
    razorpay: false
  });

  // Fetch connectors status
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/connectors/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          setConnectorStatus(data);
        }
      } catch (err) { }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch Session Menu Permissions directly from API & Sync with LocalStorage Cache
  const fetchMenuPermissions = async (overrideEmail?: string) => {
    try {
      const emailToUse = (overrideEmail || user?.email || activeUserEmail || '').trim().toLowerCase();
      
      // Load instant cache from localStorage if available
      if (emailToUse && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`cfo_menu_permissions_${emailToUse}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMenuPermissions(parsed);
              setIsPermissionsLoaded(true);
            }
          } catch (e) {}
        }
      }

      const emailParam = emailToUse ? `&user_email=${encodeURIComponent(emailToUse)}` : '';
      const res = await fetch(`/api/admin/menu-permissions?t=${Date.now()}${emailParam}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.userEmail) setActiveUserEmail(data.userEmail.toLowerCase().trim());
          if (typeof data.isSuperAdmin === 'boolean') setIsSuperAdmin(data.isSuperAdmin);

          if (Array.isArray(data.permissions)) {
            setMenuPermissions(data.permissions);
            setIsPermissionsLoaded(true);
            
            const targetEmail = (data.userEmail || emailToUse).toLowerCase().trim();
            if (targetEmail && typeof window !== 'undefined') {
              localStorage.setItem(`cfo_menu_permissions_${targetEmail}`, JSON.stringify(data.permissions));
            }

            const map: Record<string, boolean> = {};
            data.permissions.forEach((p: PermissionEntry) => {
              map[`${p.role}:${p.menu_key}`] = p.is_enabled;
            });
            setDrawerPermissionsMap(map);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching menu permissions in sidebar:', err);
    } finally {
      setIsPermissionsLoaded(true);
    }
  };

  useEffect(() => {
    fetchMenuPermissions();

    const handlePermissionsUpdate = () => {
      fetchMenuPermissions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cfo-menu-permissions-updated', handlePermissionsUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cfo-menu-permissions-updated', handlePermissionsUpdate);
      }
    };
  }, [user?.email]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio('/woosh.mp3');
      audio.volume = 0.25;
      audio.preload = 'auto';
      audioRef.current = audio;
    }
  }, []);

  const playWoosh = () => {
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
      } catch (e) { }
    }
  };

  const toggleSubmenu = (name: string) => {
    setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleItemClick = (e: React.MouseEvent, item: { name: string; href: string; connectorId?: string }, parentConnectorId?: string) => {
    const connectorId = item.connectorId || parentConnectorId;
    if (connectorId && connectorStatus[connectorId] === false) {
      e.preventDefault();
      const connectorName = CONNECTOR_NAMES[connectorId] || connectorId;
      toast.error(`${connectorName} is Not Connected`, {
        description: `Please connect your account first to access ${item.name}.`,
        id: `lock-click-${connectorId}`
      });
      router.push(`/data-sources?connector=${connectorId}&error=locked`);
      setOpenMobile(false);
      return;
    }
    setOpenMobile(false);
  };

  const rawNavSections: NavSection[] = [
    {
      items: [
        { name: 'Dashboard Overview', href: '/overview', icon: LayoutGrid }
      ]
    },
    {
      title: 'CFO Intelligence',
      items: [
        { name: 'AI Financial Copilot', href: '/cfo-copilot', icon: Bot, connectorId: 'xero', badge: 'AI' },
        { name: 'CFO Command Center', href: '/cfo', icon: BarChart3, connectorId: 'xero' },
        { name: 'Executive Overview', href: '/xero-dashboard', icon: BarChart2, connectorId: 'xero' },
        { name: 'Management Accounts', href: '/management-accounts', icon: FileSpreadsheet, connectorId: 'xero' },
        { name: 'Forecast & Scenario', href: '/forecast', icon: LineChart, connectorId: 'xero' },
        { name: 'Budgeting & Variances', href: '/budgeting', icon: Calculator, connectorId: 'xero' },
        { name: 'Financial KPI Scorecard', href: '/kpi-scorecard', icon: Activity, connectorId: 'xero' },
        { name: 'Profitability Analysis', href: '/profitability', icon: PieChart, connectorId: 'xero' },
        { name: '13-Week Cash Forecast', href: '/cash-flow/13-week', icon: TrendingUp, connectorId: 'xero' },
        { name: 'Bookkeeping Health', href: '/bookkeeping-health', icon: ShieldCheck, connectorId: 'xero' }
      ]
    },
    {
      title: 'Xero Core & Sales',
      items: [
        { name: 'Revenue Dashboard', href: '/sales', icon: TrendingUp, connectorId: 'xero' },
        { name: 'Unified AP & AR Analytics', href: '/ap-ar-analytics', icon: BarChart2, connectorId: 'xero' },
        { name: 'Accounts Receivable', href: '/invoices', icon: FileText, connectorId: 'xero' },
        { name: 'Top Overdue Invoices', href: '/invoices/overdue', icon: AlertCircle, connectorId: 'xero' },
        { name: 'Accounts Payable', href: '/bills', icon: CreditCard, connectorId: 'xero' },
        { name: 'Purchases & Expenses', href: '/expenses', icon: PieChart, connectorId: 'xero' }
      ]
    },
    {
      title: 'Financial Statements & Reports',
      items: [
        { name: 'Profit & Loss Statement', href: '/reports/profit-and-loss', icon: FileText, connectorId: 'xero' },
        { name: 'Balance Sheet', href: '/reports/balance-sheet', icon: Scale, connectorId: 'xero' },
        { name: 'Cash Flow Statement', href: '/reports/cash-flow', icon: Wallet, connectorId: 'xero' },
        { name: 'Trial Balance', href: '/reports/trial-balance', icon: FileSpreadsheet, connectorId: 'xero' },
        { name: 'Budget vs Actual Report', href: '/reports/budget-actual', icon: Calculator, connectorId: 'xero' },
        { name: 'Tax Center', href: '/reports/tax-center', icon: Receipt, connectorId: 'xero' }
      ]
    },
    {
      title: 'Banking, Ledger & Directory',
      items: [
        { name: 'Bank Accounts', href: '/banking/accounts', icon: Landmark, connectorId: 'xero' },
        { name: 'Chart of Accounts', href: '/chart-of-accounts', icon: BookOpen, connectorId: 'xero' },
        { name: 'Tracking Categories', href: '/tracking-categories', icon: Layers, connectorId: 'xero' },
        { name: 'Customers Directory', href: '/reports/customers', icon: Users, connectorId: 'xero' },
        { name: 'Vendors Directory', href: '/reports/vendors', icon: Users, connectorId: 'xero' },
        { name: 'Contacts Management', href: '/contacts', icon: Contact, connectorId: 'xero' },
        { name: 'Products & Inventory', href: '/products', icon: Package, connectorId: 'xero' }
      ]
    },
    {
      title: 'Integrations',
      items: [
        {
          name: 'Ecommerce Stores',
          href: '/amazon',
          icon: ShoppingBag,
          hasDropdown: true,
          subItems: [
            { name: 'Amazon Store', href: '/amazon', connectorId: 'amazon' },
            { name: 'eBay Store', href: '/ebay', connectorId: 'ebay' },
            { name: 'Shopify Store', href: '/shopify', connectorId: 'shopify' },
            { name: 'WooCommerce', href: '/woocommerce', connectorId: 'woocommerce' },
            { name: 'Etsy Seller', href: '/etsy', connectorId: 'etsy' }
          ]
        },
        {
          name: 'Payment Gateways',
          href: '/stripe',
          icon: Wallet,
          hasDropdown: true,
          subItems: [
            { name: 'Stripe Payments', href: '/stripe', connectorId: 'stripe' },
            { name: 'PayPal Account', href: '/paypal', connectorId: 'paypal' },
            { name: 'Square Terminal', href: '/square', connectorId: 'square' },
            { name: 'Razorpay Global', href: '/razorpay', connectorId: 'razorpay' }
          ]
        }
      ]
    },
    {
      title: 'System & Automation',
      items: [
        { name: 'Automation Cockpit', href: '/automation', icon: Cpu },
        { name: 'Subscription & Billing', href: '/subscription', icon: CreditCard },
        { name: 'Connectors & Sources', href: '/data-sources', icon: Database },
        { name: 'Settings', href: '/settings', icon: Settings },
        ...(isSuperAdmin ? [{ name: 'Menu Control Center', href: '/admin/menu-control', icon: SlidersHorizontal }] : [])
      ]
    }
  ];

  // Permission resolution helper (User Specific -> Global ALL -> Default Granted)
  const isItemAllowed = (href: string): boolean => {
    const storeEmail = (user?.email || '').toLowerCase().trim();
    const sessionEmail = (activeUserEmail || '').toLowerCase().trim();
    const currentEmail = storeEmail || sessionEmail;
    const userRole = (user?.role || '').toUpperCase().trim();

    // Superadmin users (from server session flag or SUPERADMIN role)
    const isSuperAdminUser = isSuperAdmin || userRole === 'SUPERADMIN';
    if (isSuperAdminUser) return true;

    // IF PERMISSIONS ARE STILL LOADING & NO CACHE EXISTS:
    if (!isPermissionsLoaded && (!menuPermissions || menuPermissions.length === 0)) {
      return true;
    }

    if (!menuPermissions || menuPermissions.length === 0) {
      return true;
    }

    // 1. User-specific lookup: match exact email
    const userPermissions = menuPermissions.filter(p => {
      const roleLower = p.role.toLowerCase().trim();
      if (!roleLower.startsWith('user:')) return false;
      const roleEmail = roleLower.replace('user:', '').trim();
      return roleEmail && currentEmail && roleEmail === currentEmail;
    });

    const normalizedHref = href.startsWith('/cfo-copilot') ? '/cfo-copilot' 
      : href.startsWith('/settings') ? '/settings'
      : href.startsWith('/data-sources') ? '/data-sources'
      : href.startsWith('/subscription') ? '/subscription'
      : href.startsWith('/support') ? '/support'
      : href;

    if (userPermissions.length > 0) {
      // User has custom permissions configured!
      const itemEntry = userPermissions.find(p => p.menu_key === normalizedHref);
      if (itemEntry !== undefined) {
        return itemEntry.is_enabled;
      }
      // Default new/un-mapped routes to true unless explicitly disabled
      return true;
    }

    // 2. Global 'ALL' default entry lookup
    const globalEntry = menuPermissions.find(p => p.role.toUpperCase() === 'ALL' && p.menu_key === normalizedHref);
    if (globalEntry !== undefined) {
      return globalEntry.is_enabled;
    }
    
    // Default fallback: allow routes by default
    return true;
  };

  // Filter navSections dynamically based on permissions
  const navSections: NavSection[] = useMemo(() => {
    return rawNavSections.map(sec => {
      const validItems = sec.items.filter(item => {
        const parentAllowed = isItemAllowed(item.href);
        if (!parentAllowed) return false;

        if (item.subItems && item.subItems.length > 0) {
          const validSubItems = item.subItems.filter(sub => isItemAllowed(sub.href));
          if (validSubItems.length === 0) {
            return false;
          }
        }
        return true;
      }).map(item => {
        if (item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter(sub => isItemAllowed(sub.href))
          };
        }
        return item;
      });

      return {
        ...sec,
        items: validItems
      };
    }).filter(sec => sec.items.length > 0);
  }, [rawNavSections, menuPermissions, activeUserEmail, user?.email, isSuperAdmin]);

  // Drawer permission toggle handler
  const handleDrawerToggle = (menuKey: string) => {
    const key = `${drawerRole}:${menuKey}`;
    const currentValue = drawerPermissionsMap[key] ?? drawerPermissionsMap[`ALL:${menuKey}`] ?? true;
    setDrawerPermissionsMap(prev => ({
      ...prev,
      [key]: !currentValue
    }));
  };

  // Drawer Save handler
  const handleSaveDrawerPermissions = async () => {
    setSavingDrawer(true);
    try {
      const payload = Object.entries(drawerPermissionsMap).map(([key, is_enabled]) => {
        const [role, ...rest] = key.split(':');
        return { role, menu_key: rest.join(':'), is_enabled };
      });

      const res = await fetch('/api/admin/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: payload })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Sidebar menu permissions updated successfully!');
        fetchMenuPermissions();
      } else {
        toast.error('Failed to save permissions');
      }
    } catch (err) {
      toast.error('Network error saving permissions');
    } finally {
      setSavingDrawer(false);
    }
  };

  const sidebarContent = (
    <div className={cn(
      "flex h-full min-h-0 flex-col overflow-hidden bg-sidebar-background text-sidebar-foreground select-none border-r border-sidebar-border no-scrollbar",
    )}>
      {/* Brand Header */}
      <div className={cn(
        "flex h-16 shrink-0 items-center border-b border-sidebar-border/30",
        isCollapsed ? "justify-center px-2" : "justify-between px-5"
      )}>
        <div
          onClick={isCollapsed ? toggleSidebar : undefined}
          className={cn("flex items-center gap-3 font-semibold text-white", isCollapsed && "cursor-pointer")}
          title={isCollapsed ? "Expand Sidebar" : undefined}
        >
          {/* Cyan Circular Xero Logo */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00b7e2] shrink-0 shadow-sm hover:scale-105 transition-transform duration-200">
            <span className="font-sans text-[13px] font-light tracking-tighter text-white lowercase">xero</span>
          </div>
          {!isCollapsed && (
            <Link href="/overview" className="text-[15px] font-semibold tracking-tight text-white">
              Virtual CFO
            </Link>
          )}
        </div>

        {/* Toggle Collapse for Desktop */}
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border/40 bg-sidebar-accent/30 text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent transition cursor-pointer outline-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Menu List */}
      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3 no-scrollbar">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && !isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-slate-400/90 uppercase select-none">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isSubActive = item.subItems?.some(sub => pathname === sub.href);
              const isActive = item.href === '/overview'
                ? pathname === '/overview'
                : isSubActive || pathname === item.href;
              const isLocked = item.connectorId ? connectorStatus[item.connectorId] === false : false;

              if (isCollapsed) {
                return (
                  <div
                    key={item.name}
                    className="py-0.5 relative"
                    onMouseEnter={(event) => {
                      setHoveredItem(item.name);
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setHoveredItemTop(bounds.top + bounds.height / 2);
                      playWoosh();
                    }}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Link
                      href={item.href}
                      onClick={(e) => {
                        if (isLocked) {
                          handleItemClick(e, item);
                          return;
                        }
                        if (isCollapsed) {
                          setCollapsed(false);
                          if (item.hasDropdown) {
                            setExpandedMenus(prev => ({ ...prev, [item.name]: true }));
                          }
                        }
                        setOpenMobile(false);
                      }}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-all duration-200 outline-none hover:bg-sidebar-accent hover:text-white",
                        isActive ? "bg-[#133863] text-white" : "text-sidebar-foreground/80",
                        isLocked && "opacity-75"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.75 bg-[#00b7e2] rounded-r" />
                      )}
                      <Icon className={cn("h-4.5 w-4.5 shrink-0 transition-colors", isActive ? "text-[#00b7e2]" : "text-sidebar-foreground/60")} />
                      {isLocked && (
                        <Lock className="absolute -top-0.5 -right-0.5 h-3 w-3 text-amber-400 bg-slate-900 rounded-full p-0.5 border border-slate-700" />
                      )}
                    </Link>

                    {/* Tooltip on hover */}
                    {hoveredItem === item.name && (
                      <div style={{ top: hoveredItemTop }} className="fixed left-[72px] z-50 -translate-y-1/2 pointer-events-none whitespace-nowrap animate-tooltip-swipe">
                        <div className="bg-[#0b1329]/95 backdrop-blur-xs text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-lg border border-slate-700/50 shadow-md flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", isLocked ? "bg-amber-400" : "bg-[#00b7e2]")} />
                          <span>{item.name}</span>
                          {isLocked && (
                            <span className="text-[10px] text-amber-400 font-normal flex items-center gap-0.5">
                              <Lock className="h-2.5 w-2.5 inline" /> Locked
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.name} className="space-y-0.5">
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      if (item.hasDropdown && !isCollapsed) {
                        e.preventDefault();
                        toggleSubmenu(item.name);
                      } else if (isLocked) {
                        handleItemClick(e, item);
                      } else {
                        setOpenMobile(false);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3.5 py-2 text-[13px] font-normal transition-all duration-200 outline-none hover:bg-sidebar-accent hover:text-white",
                      isActive
                        ? "bg-[#133863] text-white font-medium shadow-sm border-l-3 border-[#00b7e2]"
                        : "text-sidebar-foreground/80"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-[#00b7e2]" : "text-sidebar-foreground/60")} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLocked && !item.hasDropdown && (
                        <span title="Connector not connected">
                          <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        </span>
                      )}
                      {item.hasDropdown && (
                        <ChevronDown className={cn("h-3 w-3 text-sidebar-foreground/40 transition-transform duration-200", expandedMenus[item.name] && "rotate-180")} />
                      )}
                    </div>
                  </Link>

                  {/* Dropdown subItems rendering */}
                  {item.hasDropdown && expandedMenus[item.name] && item.subItems && (
                    <div className="relative ml-6 pl-3 space-y-0.5 my-1 border-l border-slate-750/50 animate-in slide-in-from-top-1 duration-200">
                      {item.subItems.map((sub) => {
                        const isSubItemActive = pathname === sub.href;
                        const subConnectorId = sub.connectorId;
                        const isSubLocked = subConnectorId ? connectorStatus[subConnectorId] === false : false;

                        return (
                          <div key={sub.href} className="relative flex items-center h-8">
                            <div className="absolute -left-3 top-[14px] w-3 h-3 border-l border-b border-slate-750/50 rounded-bl-lg pointer-events-none" />
                            <Link
                              href={sub.href}
                              onClick={(e) => handleItemClick(e, sub)}
                              className={cn(
                                "text-[12.5px] pl-2 select-none truncate hover:text-white transition duration-150 outline-none w-full flex items-center justify-between pr-2",
                                isSubItemActive ? "text-[#00b7e2] font-semibold" : isSubLocked ? "text-slate-400" : "text-sidebar-foreground/60"
                              )}
                            >
                              <span className="truncate">{sub.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSubLocked && (
                                  <span title="Connector not connected">
                                    <Lock className="h-3 w-3 text-amber-400/90 shrink-0" />
                                  </span>
                                )}
                                {isSubItemActive && <span className="h-1.5 w-1.5 rounded-full bg-[#00b7e2] shrink-0" />}
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Blocks */}
      {!isCollapsed && (
        <div className="p-4 space-y-3 border-t border-sidebar-border/30 bg-black/10 shrink-0">
          {/* Plan Card */}
          <div className="rounded-lg border border-sidebar-border/35 bg-sidebar-accent/10 p-3 space-y-2">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-sidebar-foreground/40">Organization Subscription</div>
              <div className="text-[11px] text-[#00b7e2] font-semibold truncate">Active Plan & Billing</div>
            </div>
            <Link href="/subscription" className="block w-full text-center py-1.5 px-2.5 rounded border border-sidebar-border/50 text-[11px] font-medium text-sidebar-foreground hover:text-white hover:bg-sidebar-accent hover:border-white transition cursor-pointer outline-none">
              Manage Subscription
            </Link>
          </div>

          {/* Help Block */}
          <Link href="/support" className="flex items-center gap-2.5 text-[12px] text-sidebar-foreground/70 hover:text-white transition py-1">
            <HelpCircle className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
            <span>Need Help? Go to Support</span>
          </Link>
        </div>
      )}

      {/* Dynamic Keyframe Injection */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes tooltipSwipe {
          0% {
            opacity: 0;
            transform: translate(0px, -35%) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translate(8px, -50%) scale(1);
          }
        }
        .animate-tooltip-swipe {
          animation: tooltipSwipe 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 hidden md:block min-h-0 shrink-0 transition-all duration-300",
        isCollapsed ? "w-16 overflow-visible" : "w-64"
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpenMobile(false)}
          />
          {/* Content panel */}
          <div className="relative flex h-dvh max-h-dvh w-64 max-w-xs flex-col animate-in slide-in-from-left duration-250">
            {sidebarContent}
            {/* Close button inside panel */}
            <div className="absolute top-3.5 right-3.5 flex items-center justify-center z-50">
              <button
                onClick={() => setOpenMobile(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full border border-sidebar-border bg-sidebar-background text-sidebar-foreground hover:text-white cursor-pointer outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Superadmin Slide-Over Quick Menu Control Drawer */}
      {showDrawer && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowDrawer(false)} 
          />
          
          <div className="relative w-full max-w-xl bg-slate-900 text-slate-100 h-full border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Quick Sidebar Menu Control</h2>
                  <p className="text-xs text-slate-400">Toggle live sidebar visibility per role in 1-click</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Select Bar */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Target Role:</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SYSTEM_ROLES.map(roleObj => (
                  <button
                    key={roleObj.id}
                    onClick={() => setDrawerRole(roleObj.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      drawerRole === roleObj.id
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {roleObj.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Menus List inside Drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
              {rawNavSections.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    {sec.title || 'General'}
                  </div>
                  <div className="space-y-2">
                    {sec.items.map((item, iIdx) => {
                      const key = `${drawerRole}:${item.href}`;
                      const globalKey = `ALL:${item.href}`;
                      const enabled = drawerPermissionsMap[key] ?? drawerPermissionsMap[globalKey] ?? true;

                      return (
                        <div key={iIdx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-slate-200">{item.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">{item.href}</div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDrawerToggle(item.href)}
                            className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                              enabled
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            }`}
                          >
                            {enabled ? 'VISIBLE' : 'HIDDEN'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <Link
                href="/admin/menu-control"
                onClick={() => setShowDrawer(false)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
              >
                Open Full Menu Management Center →
              </Link>

              <button
                onClick={handleSaveDrawerPermissions}
                disabled={savingDrawer}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
              >
                {savingDrawer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingDrawer ? 'Saving...' : 'Apply & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
