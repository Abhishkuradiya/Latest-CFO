"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/user-store';

export interface PermissionItem {
  role: string;
  menu_key: string;
  is_enabled: boolean;
}

export function useFeaturePermissions() {
  const { user } = useUserStore();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userRole = (user?.role || '').toUpperCase().trim();

  const loadFromCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    const emailKey = userEmail || 'default';
    const cached = localStorage.getItem(`cfo_menu_permissions_${emailKey}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPermissions(parsed);
          setIsLoaded(true);
        }
      } catch (e) {}
    }
  }, [userEmail]);

  const fetchPermissions = useCallback(async () => {
    try {
      const emailParam = userEmail ? `&user_email=${encodeURIComponent(userEmail)}` : '';
      const res = await fetch(`/api/admin/menu-permissions?t=${Date.now()}${emailParam}`, { 
        cache: 'no-store' 
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (typeof data.isSuperAdmin === 'boolean') {
            setIsSuperAdmin(data.isSuperAdmin);
          }
          if (Array.isArray(data.permissions)) {
            setPermissions(data.permissions);
            const targetEmail = (data.userEmail || userEmail).toLowerCase().trim();
            if (targetEmail && typeof window !== 'undefined') {
              localStorage.setItem(`cfo_menu_permissions_${targetEmail}`, JSON.stringify(data.permissions));
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching feature permissions:', err);
    } finally {
      setIsLoaded(true);
    }
  }, [userEmail]);

  useEffect(() => {
    loadFromCache();
    fetchPermissions();

    const handleUpdate = () => {
      fetchPermissions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cfo-menu-permissions-updated', handleUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cfo-menu-permissions-updated', handleUpdate);
      }
    };
  }, [loadFromCache, fetchPermissions]);

  const isAllowed = useCallback((key: string): boolean => {
    if (isSuperAdmin || userRole === 'SUPERADMIN') return true;
    if (!permissions || permissions.length === 0) return true;

    // 1. User specific lookup: match role == USER:email
    const userEntries = permissions.filter(p => {
      const r = (p.role || '').toLowerCase().trim();
      return r.startsWith('user:') && r.replace('user:', '').trim() === userEmail;
    });

    if (userEntries.length > 0) {
      const found = userEntries.find(p => p.menu_key === key);
      if (found !== undefined) {
        return Boolean(found.is_enabled);
      }
    }

    // 2. Specific role match (e.g. CFO, ADMIN, FINANCE_MANAGER)
    if (userRole) {
      const roleFound = permissions.find(p => p.role?.toUpperCase() === userRole && p.menu_key === key);
      if (roleFound !== undefined) {
        return Boolean(roleFound.is_enabled);
      }
    }

    // 3. Global 'ALL' override lookup
    const globalFound = permissions.find(p => p.role?.toUpperCase() === 'ALL' && p.menu_key === key);
    if (globalFound !== undefined) {
      return Boolean(globalFound.is_enabled);
    }

    // Default to true
    return true;
  }, [permissions, isSuperAdmin, userRole, userEmail]);

  const isHealthScoreEnabled = useMemo(() => {
    return isAllowed('/settings/business-health-score');
  }, [isAllowed]);

  return {
    permissions,
    isLoaded,
    isSuperAdmin,
    isAllowed,
    isHealthScoreEnabled,
    refetch: fetchPermissions
  };
}
