"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Check, 
  X, 
  Search, 
  RefreshCw, 
  Save, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Layers, 
  UserCheck, 
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ALL_SYSTEM_ROLES, SYSTEM_NAV_DEFINITIONS, MenuDefinitionSection } from '@/lib/menu-definitions';

interface PermissionEntry {
  role: string;
  menu_key: string;
  is_enabled: boolean;
}

export default function SuperadminMenuControlPage() {
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  
  // Store permissions state as map: `${role}:${menu_key}` -> boolean
  const [permissionMap, setPermissionMap] = useState<Record<string, boolean>>({});
  const [initialPermissionMap, setInitialPermissionMap] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Fetch initial permissions from backend
  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/menu-permissions');
      const data = await res.json();
      if (res.ok && data.success) {
        const map: Record<string, boolean> = {};
        (data.permissions || []).forEach((item: PermissionEntry) => {
          map[`${item.role}:${item.menu_key}`] = item.is_enabled;
        });
        setPermissionMap(map);
        setInitialPermissionMap(map);
      } else {
        toast.error('Failed to load menu permissions');
      }
    } catch (err: any) {
      console.error('Error fetching menu permissions:', err);
      toast.error('Failed to connect to menu permissions service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Check if an item is enabled for selectedRole
  const isItemEnabled = (menuKey: string, role: string = selectedRole): boolean => {
    const key = `${role}:${menuKey}`;
    if (key in permissionMap) {
      return permissionMap[key];
    }
    // If checking specific role and not explicitly set, check 'ALL' global override
    if (role !== 'ALL') {
      const globalKey = `ALL:${menuKey}`;
      if (globalKey in permissionMap) {
        return permissionMap[globalKey];
      }
    }
    // Default to true if not configured
    return true;
  };

  // Toggle single item
  const toggleItem = (menuKey: string) => {
    const key = `${selectedRole}:${menuKey}`;
    const currentValue = isItemEnabled(menuKey, selectedRole);
    setPermissionMap(prev => ({
      ...prev,
      [key]: !currentValue
    }));
  };

  // Has unsaved changes check
  const isDirty = useMemo(() => {
    return JSON.stringify(permissionMap) !== JSON.stringify(initialPermissionMap);
  }, [permissionMap, initialPermissionMap]);

  // Bulk enable / disable for currently selected role
  const bulkSetVisibleRoleItems = (enable: boolean) => {
    const newMap = { ...permissionMap };
    SYSTEM_NAV_DEFINITIONS.forEach(sec => {
      sec.items.forEach(item => {
        const itemMatchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.href.toLowerCase().includes(searchQuery.toLowerCase());
        if (itemMatchesSearch) {
          newMap[`${selectedRole}:${item.href}`] = enable;
          if (item.subItems) {
            item.subItems.forEach(sub => {
              newMap[`${selectedRole}:${sub.href}`] = enable;
            });
          }
        }
      });
    });
    setPermissionMap(newMap);
    toast.success(`${enable ? 'Enabled' : 'Disabled'} all filtered menu items for role: ${selectedRole}`);
  };

  // Bulk toggle whole section
  const toggleSection = (section: MenuDefinitionSection, enable: boolean) => {
    const newMap = { ...permissionMap };
    section.items.forEach(item => {
      newMap[`${selectedRole}:${item.href}`] = enable;
      if (item.subItems) {
        item.subItems.forEach(sub => {
          newMap[`${selectedRole}:${sub.href}`] = enable;
        });
      }
    });
    setPermissionMap(newMap);
  };

  // Reset changes to initial DB state
  const handleReset = () => {
    setPermissionMap(initialPermissionMap);
    toast.info('Reset changes to last saved state');
  };

  // Save to DB
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: PermissionEntry[] = Object.entries(permissionMap).map(([key, is_enabled]) => {
        const [role, ...rest] = key.split(':');
        const menu_key = rest.join(':');
        return { role, menu_key, is_enabled };
      });

      const res = await fetch('/api/admin/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: payload })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Sidebar menu permissions updated successfully!');
        setInitialPermissionMap(permissionMap);
        
        // Notify sidebar components via global window event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cfo-menu-permissions-updated'));
        }
      } else {
        toast.error(data.error || 'Failed to update permissions');
      }
    } catch (err: any) {
      console.error('Error saving menu permissions:', err);
      toast.error('Network error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  // Calculate totals
  const totalConfiguredKeys = useMemo(() => {
    return Object.keys(permissionMap).length;
  }, [permissionMap]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Superadmin Command Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Dynamic Sidebar Menu Control
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              Configure and dynamically toggle sidebar navigation menus per user role. Changes apply immediately across the system.
            </p>
          </div>

          {/* Action Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchPermissions}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {isDirty && (
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-medium transition-all flex items-center gap-2 active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Discard Changes
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg active:scale-95 ${
                isDirty 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-950/50 animate-pulse' 
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
              }`}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : isDirty ? 'Save Permissions' : 'All Changes Saved'}
            </button>
          </div>
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-indigo-400" /> Select Target User Role To Configure
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {ALL_SYSTEM_ROLES.map((roleObj) => {
            const isSelected = selectedRole === roleObj.id;
            return (
              <button
                key={roleObj.id}
                onClick={() => setSelectedRole(roleObj.id)}
                className={`relative flex flex-col items-start p-3.5 rounded-xl border text-left transition-all group ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${roleObj.badgeClass}`}>
                  {roleObj.id}
                </span>
                <span className="mt-2 text-sm font-semibold text-slate-100 group-hover:text-white">
                  {roleObj.label}
                </span>
                {isSelected && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Bulk Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter menus by name or route URL..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => bulkSetVisibleRoleItems(true)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 transition-all"
          >
            <Eye className="w-3.5 h-3.5" /> Enable Visible
          </button>

          <button
            onClick={() => bulkSetVisibleRoleItems(false)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-rose-400 flex items-center gap-1.5 transition-all"
          >
            <EyeOff className="w-3.5 h-3.5" /> Disable Visible
          </button>
        </div>
      </div>

      {/* Nav Sections List */}
      <div className="space-y-6">
        {SYSTEM_NAV_DEFINITIONS.map((section, sIdx) => {
          const sectionTitle = section.title || 'General Dashboard Overview';
          const isSectionCollapsed = collapsedSections[sectionTitle] || false;

          // Filter items by search
          const filteredItems = section.items.filter(item => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const matchesParent = item.name.toLowerCase().includes(q) || item.href.toLowerCase().includes(q);
            const matchesSub = item.subItems?.some(s => s.name.toLowerCase().includes(q) || s.href.toLowerCase().includes(q));
            return matchesParent || matchesSub;
          });

          if (filteredItems.length === 0) return null;

          const enabledCount = filteredItems.filter(item => isItemEnabled(item.href)).length;
          const totalCount = filteredItems.length;
          const allSectionEnabled = enabledCount === totalCount;

          return (
            <div 
              key={sIdx}
              className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-lg transition-all"
            >
              {/* Section Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCollapsedSections(prev => ({ ...prev, [sectionTitle]: !isSectionCollapsed }))}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {isSectionCollapsed ? (
                      <ChevronRight className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-indigo-400" />
                    )}
                  </button>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      {sectionTitle}
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {enabledCount}/{totalCount} Active
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Section Quick Toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleSection(section, !allSectionEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      allSectionEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {allSectionEnabled ? 'Disable Section' : 'Enable All in Section'}
                  </button>
                </div>
              </div>

              {/* Section Content */}
              {!isSectionCollapsed && (
                <div className="divide-y divide-slate-800/40 p-2 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredItems.map((item, iIdx) => {
                    const enabled = isItemEnabled(item.href);

                    return (
                      <div
                        key={iIdx}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                          enabled
                            ? 'bg-slate-900/90 border-slate-700/60 shadow-sm'
                            : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-100">
                                {item.name}
                              </span>
                              {item.connectorId && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                  {item.connectorId}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-slate-500">
                              {item.href}
                            </p>
                          </div>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => toggleItem(item.href)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              enabled ? 'bg-emerald-500' : 'bg-slate-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* SubItems list if present */}
                        {item.subItems && item.subItems.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                              Child Navigation Subitems:
                            </span>
                            <div className="space-y-1.5 pl-2">
                              {item.subItems.map((sub, subIdx) => {
                                const subEnabled = isItemEnabled(sub.href);
                                return (
                                  <div
                                    key={subIdx}
                                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800"
                                  >
                                    <span className="font-medium text-slate-300">
                                      {sub.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleItem(sub.href)}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border transition-all ${
                                        subEnabled
                                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                          : 'bg-slate-800 text-slate-500 border-slate-700'
                                      }`}
                                    >
                                      {subEnabled ? 'ON' : 'OFF'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
