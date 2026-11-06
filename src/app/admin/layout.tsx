"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CreditCard, 
  Plug, 
  Sparkles, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  Bell, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Crown,
  ChevronLeft,
  ExternalLink,
  Shield,
  Activity,
  FileText,
  User,
  Menu
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(true);
  const [profile, setProfile] = useState<any>({
    name: 'Super Administrator',
    email: 'admin@virtualcfo.com',
    avatarUrl: ''
  });

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/admin/profile');
      const data = await res.json();
      if (res.ok && data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (e) {
      console.warn('Could not load layout profile:', e);
    }
  };

  const isPublicAdminPage = pathname === '/admin/login' || pathname === '/admin/setup-2fa';

  useEffect(() => {
    loadProfile();
    const handleProfileUpdate = () => loadProfile();
    window.addEventListener('adminProfileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('adminProfileUpdated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    if (isPublicAdminPage) {
      setLoading(false);
      return;
    }

    // Verify Super Admin session & 2FA requirement for protected admin dashboard pages
    fetch('/api/admin/auth/me')
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            if (data && data.requires2FA) {
              router.push('/admin/setup-2fa');
            } else {
              router.push('/admin/login');
            }
            return null;
          });
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setAdminUser(data.admin);
        }
      })
      .catch(() => {
        router.push('/admin/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pathname, isPublicAdminPage, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      toast.success('Super Admin logged out');
      window.location.href = '/admin/login';
    } catch (e) {
      window.location.href = '/admin/login';
    }
  };

  const renderLayoutAvatar = (sizeClass = 'h-8 w-8 text-xs') => {
    if (profile.avatarUrl && (profile.avatarUrl.startsWith('data:image') || profile.avatarUrl.startsWith('http'))) {
      return <img src={profile.avatarUrl} alt={profile.name} className={`${sizeClass} rounded-full object-cover shadow-xs border border-white/20`} />;
    }
    const PRESET_ICONS: Record<string, { bg: string; icon: string }> = {
      'av-1': { bg: 'bg-gradient-to-tr from-[#00b7e2] to-blue-600', icon: '👑' },
      'av-2': { bg: 'bg-gradient-to-tr from-purple-600 to-indigo-600', icon: '⚡' },
      'av-3': { bg: 'bg-gradient-to-tr from-emerald-600 to-teal-600', icon: '🛡️' },
      'av-4': { bg: 'bg-gradient-to-tr from-amber-500 to-orange-600', icon: '💼' },
      'av-5': { bg: 'bg-gradient-to-tr from-slate-800 to-slate-950', icon: '🔷' },
      'av-6': { bg: 'bg-gradient-to-tr from-cyan-500 to-blue-600', icon: '✨' },
      'av-7': { bg: 'bg-gradient-to-tr from-emerald-500 to-teal-700', icon: '🌟' },
      'av-8': { bg: 'bg-gradient-to-tr from-amber-600 to-[#00b7e2]', icon: '🏆' },
    };
    const preset = PRESET_ICONS[profile.avatarUrl] || PRESET_ICONS['av-1'];
    return (
      <div className={`${sizeClass} rounded-full ${preset.bg} text-white font-bold flex items-center justify-center shadow-xs shrink-0`}>
        {preset.icon}
      </div>
    );
  };

  if (isPublicAdminPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center font-sans text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Super Admin Control Center...</p>
        </div>
      </div>
    );
  }

  const mainNavItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Tenants / Companies', href: '/admin/tenants', icon: Building2 },
    { label: 'Users & Access', href: '/admin/users', icon: Users },
    { label: 'Subscriptions & Billing', href: '/admin/billing', icon: CreditCard },
  ];

  const secondaryNavItems = [
    { label: 'Profile & Governance', href: '/admin/profile', icon: User },
    { label: 'AI & Insights', href: '/admin/ai-insights', icon: Sparkles },
    { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
    { label: 'Support & Tickets', href: '/admin/support', icon: HelpCircle },
  ];

  return (
    <div className="h-screen w-full bg-[#F4F7FC] text-slate-800 font-sans flex overflow-hidden select-none">
      
      {/* 1. DARK SIDEBAR NAVIGATION (#0b1329 matching user portal) */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-[#0b1329] text-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out flex-shrink-0 z-30 border-r border-slate-800/80 shadow-2xl relative select-none h-full overflow-hidden`}>
        
        {/* Top Header Branding & Toggle */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className={`flex h-16 shrink-0 items-center border-b border-slate-800/60 ${sidebarCollapsed ? 'justify-between px-3' : 'justify-between px-5'}`}>
            <div className="flex items-center gap-3 font-semibold text-white">
              {/* Official 3-Pill Vertical Bars Brand Logo */}
              <button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex items-end gap-1 h-7 p-0.5 shrink-0 group cursor-pointer outline-none"
                title={sidebarCollapsed ? "Expand Sidebar" : "Virtual CFO"}
              >
                <div className="w-1.5 bg-[#2563eb] rounded-full h-3.5 transition-all duration-300 group-hover:bg-blue-400" />
                <div className="w-1.5 bg-[#3b82f6] rounded-full h-5 transition-all duration-300 group-hover:bg-blue-300" />
                <div className="w-1.5 bg-[#00b7e2] rounded-full h-7 transition-all duration-300 group-hover:bg-cyan-300" />
              </button>
              {!sidebarCollapsed && (
                <div className="flex flex-col">
                  <Link href="/admin/dashboard" className="text-[16px] font-black tracking-tight text-white leading-none">
                    Virtual CFO
                  </Link>
                  <span className="text-[8.5px] text-[#00b7e2] font-black tracking-widest uppercase mt-1">SUPER ADMIN PORTAL</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer outline-none"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4 text-[#00b7e2]" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Items List */}
          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto overscroll-contain no-scrollbar min-h-0">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              if (sidebarCollapsed) {
                return (
                  <div key={item.href} className="py-0.5 relative group">
                    <Link
                      href={item.href}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                        isActive ? 'bg-[#133863] text-white' : 'text-slate-400'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.75 bg-[#00b7e2] rounded-r" />
                      )}
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                    </Link>

                    {/* Tooltip Swipe Popup */}
                    <div className="absolute left-[54px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                      <div className="bg-[#0b1329]/95 backdrop-blur-xs text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-lg border border-slate-700/50 shadow-md flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00b7e2]" />
                        <span>{item.label}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-normal transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                    isActive
                      ? 'bg-[#133863] text-white font-medium shadow-sm border-l-3 border-[#00b7e2]'
                      : 'text-slate-300/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}

            {/* Collapsible Integrations Menu */}
            <div className="pt-1">
              {sidebarCollapsed ? (
                <div className="py-0.5 relative group">
                  <Link
                    href="/admin/integrations"
                    className={`relative flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                      pathname.startsWith('/admin/integrations') ? 'bg-[#133863] text-white' : 'text-slate-400'
                    }`}
                  >
                    {pathname.startsWith('/admin/integrations') && (
                      <div className="absolute left-0 top-2 bottom-2 w-0.75 bg-[#00b7e2] rounded-r" />
                    )}
                    <Plug className={`h-4.5 w-4.5 shrink-0 ${pathname.startsWith('/admin/integrations') ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                  </Link>

                  <div className="absolute left-[54px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                    <div className="bg-[#0b1329]/95 backdrop-blur-xs text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-lg border border-slate-700/50 shadow-md flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00b7e2]" />
                      <span>Integrations</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIntegrationsOpen(!integrationsOpen)}
                    className={`w-full flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-normal transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                      pathname.startsWith('/admin/integrations')
                        ? 'bg-[#133863] text-white font-medium border-l-3 border-[#00b7e2]'
                        : 'text-slate-300/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Plug className={`h-4.5 w-4.5 shrink-0 ${pathname.startsWith('/admin/integrations') ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                      <span className="truncate">Integrations</span>
                    </div>
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${integrationsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Sub-items with curved branch lines */}
                  {integrationsOpen && (
                    <div className="relative ml-8 pl-4 space-y-0.5 my-1 border-l border-slate-750/50 animate-in slide-in-from-top-1 duration-200">
                      {[
                        { name: 'Xero API', href: '/admin/integrations?app=xero', color: 'bg-[#00b7e2]' },
                        { name: 'QuickBooks', href: '/admin/integrations?app=quickbooks', color: 'bg-emerald-400' },
                        { name: 'Zoho Books', href: '/admin/integrations?app=zoho', color: 'bg-rose-400' },
                        { name: 'Others', href: '/admin/integrations?app=others', color: 'bg-amber-400' },
                      ].map((sub) => {
                        const isSubActive = pathname === sub.href;
                        return (
                          <div key={sub.href} className="relative flex items-center h-8">
                            <div className="absolute -left-4 top-[14px] w-4 h-4 border-l border-b border-slate-700/60 rounded-bl-lg pointer-events-none" />
                            <Link
                              href={sub.href}
                              className={`text-[12.5px] pl-2 select-none truncate hover:text-white transition duration-150 outline-none w-full flex items-center gap-2 ${
                                isSubActive ? 'text-[#00b7e2] font-semibold' : 'text-slate-400'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${sub.color}`} />
                              <span>{sub.name}</span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Secondary Nav Items */}
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (sidebarCollapsed) {
                return (
                  <div key={item.href} className="py-0.5 relative group">
                    <Link
                      href={item.href}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg mx-auto transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                        isActive ? 'bg-[#133863] text-white' : 'text-slate-400'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.75 bg-[#00b7e2] rounded-r" />
                      )}
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                    </Link>

                    <div className="absolute left-[54px] top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                      <div className="bg-[#0b1329]/95 backdrop-blur-xs text-white text-[11.5px] font-bold py-1.5 px-3.5 rounded-lg border border-slate-700/50 shadow-md flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00b7e2]" />
                        <span>{item.label}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-normal transition-all duration-200 outline-none hover:bg-[#133863]/60 hover:text-white ${
                    isActive
                      ? 'bg-[#133863] text-white font-medium shadow-sm border-l-3 border-[#00b7e2]'
                      : 'text-slate-300/80'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Icon className={`h-4.5 w-4.5 shrink-0 transition-colors ${isActive ? 'text-[#00b7e2]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Footer Section */}
        <div className="p-4 space-y-3.5 border-t border-slate-800/60 bg-black/10 shrink-0">
          {!sidebarCollapsed && (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Platform Management</div>
                <div className="text-[11px] text-[#00b7e2] font-semibold truncate">Multi-Tenant Governance</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Link href="/admin/profile" className="flex items-center gap-2.5 min-w-0 group cursor-pointer">
              {renderLayoutAvatar('h-8 w-8 text-xs')}
              {!sidebarCollapsed && (
                <div className="flex flex-col text-left truncate">
                  <span className="text-xs font-bold text-white leading-tight truncate group-hover:text-[#00b7e2] transition">{profile.name}</span>
                  <span className="text-[10px] text-slate-400 truncate">{profile.email}</span>
                </div>
              )}
            </Link>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer outline-none"
              title="Logout Super Admin"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* 2. RIGHT MAIN BODY */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* TOP HEADER BAR (WHITE) - FIXED TOP SIBLING */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between z-20 shadow-xs">
          
          {/* Left: Hamburger Toggle & Search Input Box */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer outline-none shrink-0"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenants, users, invoices, companies..."
                className="w-full pl-9 pr-16 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 transition relative cursor-pointer">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                3
              </span>
            </button>

            <button className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 transition cursor-pointer">
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* Profile Pill Link */}
            <Link href="/admin/profile" className="flex items-center gap-2.5 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-80 transition group">
              {renderLayoutAvatar('h-8 w-8 text-xs')}
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition">{profile.name}</span>
                <span className="text-[10px] text-blue-600 font-extrabold">Profile & Account</span>
              </div>
            </Link>
          </div>

        </header>

        {/* Page Main Content Area - INDEPENDENT SCROLL */}
        <main className="p-6 sm:p-8 space-y-8 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>

      </div>

    </div>
  );
}
