"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getRequiredConnector } from '@/lib/connector-guard';
import { SYSTEM_NAV_DEFINITIONS } from '@/lib/menu-definitions';
import { useUserStore } from '@/store/user-store';
import { toast } from 'sonner';
import { Lock, ShieldAlert, SlidersHorizontal } from 'lucide-react';

interface ConnectorRouteGuardProps {
  children: React.ReactNode;
}

interface PermissionEntry {
  role: string;
  menu_key: string;
  is_enabled: boolean;
}

function getNormalizedMenuKey(href: string): string {
  if (href.startsWith('/cfo-copilot')) return '/cfo-copilot';
  if (href.startsWith('/settings/business-health-score')) return '/settings/business-health-score';
  if (href.startsWith('/settings')) return '/settings';
  if (href.startsWith('/data-sources')) return '/data-sources';
  if (href.startsWith('/subscription')) return '/subscription';
  if (href.startsWith('/support')) return '/support';
  return href;
}

function isMenuAllowed(href: string, permissions: PermissionEntry[], userEmail: string, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;

  const email = (userEmail || '').toLowerCase().trim();

  // Normalize path (e.g. /settings/account-mappings -> /settings, /cfo-copilot/chat_123 -> /cfo-copilot)
  const normalizedHref = getNormalizedMenuKey(href);

  if (!permissions || permissions.length === 0) return true;

  const userPermissions = permissions.filter(p => {
    const roleLower = (p.role || '').toLowerCase().trim();
    if (!roleLower.startsWith('user:')) return false;
    const roleEmail = roleLower.replace('user:', '').trim();
    return roleEmail && email && roleEmail === email;
  });

  if (userPermissions.length > 0) {
    const itemEntry = userPermissions.find(p => p.menu_key === normalizedHref);
    if (itemEntry !== undefined) {
      return itemEntry.is_enabled;
    }
    // Fallback to global setting if this specific key isn't explicitly set for user
    const globalEntry = permissions.find(p => p.role.toUpperCase() === 'ALL' && p.menu_key === normalizedHref);
    if (globalEntry !== undefined) {
      return globalEntry.is_enabled;
    }
    return true;
  }

  const globalEntry = permissions.find(p => p.role.toUpperCase() === 'ALL' && p.menu_key === normalizedHref);
  if (globalEntry !== undefined) {
    return globalEntry.is_enabled;
  }

  return true;
}

function findFirstAllowedRoute(permissions: PermissionEntry[], userEmail: string, isSuperAdmin: boolean): string {
  for (const sec of SYSTEM_NAV_DEFINITIONS) {
    for (const item of sec.items) {
      if (item.href && isMenuAllowed(item.href, permissions, userEmail, isSuperAdmin)) {
        return item.href;
      }
      if (item.subItems) {
        for (const sub of item.subItems) {
          if (sub.href && isMenuAllowed(sub.href, permissions, userEmail, isSuperAdmin)) {
            return sub.href;
          }
        }
      }
    }
  }
  return '/settings';
}

export function ConnectorRouteGuard({ children }: ConnectorRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUserStore();

  const [status, setStatus] = useState<Record<string, boolean> | null>(null);
  const [menuPermissions, setMenuPermissions] = useState<PermissionEntry[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState<boolean>(false);

  // Fetch connector status
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/connectors/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch connector status for route guard:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch menu permissions
  useEffect(() => {
    let isMounted = true;
    const emailToUse = (user?.email || '').trim().toLowerCase();

    // Check localStorage cache
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

    const fetchPermissions = async () => {
      try {
        const emailParam = emailToUse ? `&user_email=${encodeURIComponent(emailToUse)}` : '';
        const res = await fetch(`/api/admin/menu-permissions?t=${Date.now()}${emailParam}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success) {
            if (typeof data.isSuperAdmin === 'boolean') setIsSuperAdmin(data.isSuperAdmin);
            if (Array.isArray(data.permissions)) {
              setMenuPermissions(data.permissions);
              setIsPermissionsLoaded(true);
              const targetEmail = (data.userEmail || emailToUse).toLowerCase().trim();
              if (targetEmail && typeof window !== 'undefined') {
                localStorage.setItem(`cfo_menu_permissions_${targetEmail}`, JSON.stringify(data.permissions));
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching menu permissions in route guard:', err);
      } finally {
        if (isMounted) setIsPermissionsLoaded(true);
      }
    };

    fetchPermissions();

    const handlePermissionsUpdate = () => {
      fetchPermissions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cfo-menu-permissions-updated', handlePermissionsUpdate);
    }
    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('cfo-menu-permissions-updated', handlePermissionsUpdate);
      }
    };
  }, [user?.email]);

  const required = getRequiredConnector(pathname);
  const isLocked = Boolean(required && status && status[required.connector] === false);

  // Connector route lock redirect
  useEffect(() => {
    if (isLocked && required) {
      toast.error(`Access Restricted: ${required.name} is not connected`, {
        description: `Redirecting you to the Connectors management page to connect your account.`,
        id: `guard-locked-${required.connector}`
      });
      router.replace(`/data-sources?connector=${required.connector}&error=locked`);
    }
  }, [isLocked, required, router]);

  // Menu Permission Route Protection & Smart Auto-Redirect
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isRouteAllowed = useMemo(() => {
    // Specifically protect Business Health Score configuration route!
    if (pathname.startsWith('/settings/business-health-score')) {
      if (!isPermissionsLoaded) return true;
      return isMenuAllowed('/settings/business-health-score', menuPermissions, userEmail, isSuperAdmin);
    }
    // Standard system utility routes & CFO Copilot always accessible
    if (
      pathname.startsWith('/data-sources') || 
      pathname.startsWith('/settings') || 
      pathname.startsWith('/support') || 
      pathname.startsWith('/subscription') ||
      pathname.startsWith('/cfo-copilot')
    ) {
      return true;
    }
    if (!isPermissionsLoaded) return true;
    return isMenuAllowed(pathname, menuPermissions, userEmail, isSuperAdmin);
  }, [pathname, menuPermissions, userEmail, isSuperAdmin, isPermissionsLoaded]);

  useEffect(() => {
    if (isPermissionsLoaded && !isRouteAllowed && !isLocked) {
      if (pathname.startsWith('/settings/business-health-score')) {
        toast.error('Access Restricted', {
          description: 'Business Health Score configuration has been disabled by your administrator.',
          id: 'guard-health-score-disabled'
        });
        router.replace('/settings');
        return;
      }
      const firstAllowed = findFirstAllowedRoute(menuPermissions, userEmail, isSuperAdmin);
      router.replace(firstAllowed);
    }
  }, [isPermissionsLoaded, isRouteAllowed, isLocked, pathname, menuPermissions, userEmail, isSuperAdmin, router]);

  // Locked connector view
  if (isLocked) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center space-y-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg animate-pulse">
          <Lock className="h-8 w-8" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-lg font-bold text-white">Connector Not Connected</h3>
          <p className="text-xs text-slate-400">
            {required?.name} connector is currently not connected or requires re-authentication. Redirecting to Connectors page...
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Redirecting to Connectors Page</span>
        </div>
      </div>
    );
  }

  // Professional Animated Typing Workspace Loader View while redirecting
  if (isPermissionsLoaded && !isRouteAllowed) {
    return <WorkspaceLoader />;
  }

  return <>{children}</>;
}

function WorkspaceLoader() {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Opening active workspace...";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayText(fullText.slice(0, index + 1));
      index = (index + 1) % (fullText.length + 1);
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-[70vh] w-full flex-col items-center justify-center space-y-6 text-center select-none">
      {/* Cyan Circular Glowing Logo Loader */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-[#00b7e2]/20 animate-ping opacity-75" />
        <div className="absolute h-16 w-16 rounded-full bg-[#00b7e2]/30 animate-pulse" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#00b7e2] shadow-xl shadow-[#00b7e2]/30">
          <span className="font-sans text-base font-light tracking-tighter text-white lowercase">xero</span>
        </div>
      </div>

      {/* Typing Text Animation */}
      <div className="space-y-2 max-w-sm">
        <div className="flex items-center justify-center gap-1 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span>{displayText}</span>
          <span className="w-1.5 h-4 bg-[#00b7e2] animate-pulse inline-block" />
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Synchronizing tenant workspace...
        </p>
      </div>
    </div>
  );
}
