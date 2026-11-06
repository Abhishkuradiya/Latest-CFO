"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  Copy, 
  Send, 
  Trash2, 
  X,
  Check,
  Building2,
  ExternalLink,
  SlidersHorizontal,
  Save,
  CheckSquare,
  Square,
  RotateCcw,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SYSTEM_NAV_DEFINITIONS, MenuDefinitionSection } from '@/lib/menu-definitions';

export default function SuperAdminUsersPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal State for Invitation
  const [showModal, setShowModal] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form fields for invitation
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState('CFO');
  const [invitedBy, setInvitedBy] = useState('Rajan Goswami');
  const [expiryHours, setExpiryHours] = useState('6');

  // Per-User Menu Permission Drawer State
  const [selectedManageUser, setSelectedManageUser] = useState<any | null>(null);
  const [userPermissionMap, setUserPermissionMap] = useState<Record<string, boolean>>({});
  const [initialUserPermissionMap, setInitialUserPermissionMap] = useState<Record<string, boolean>>({});
  const [loadingUserPermissions, setLoadingUserPermissions] = useState<boolean>(false);
  const [savingUserPermissions, setSavingUserPermissions] = useState<boolean>(false);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [collapsedUserSections, setCollapsedUserSections] = useState<Record<string, boolean>>({});

  const handleQuickToggleHealthScore = async (userObj: any) => {
    setTogglingId(userObj.id);
    const newStatus = !(userObj.healthScoreEnabled !== false);
    try {
      const res = await fetch('/api/admin/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: userObj.email,
          permissions: [
            {
              user_email: userObj.email,
              menu_key: '/settings/business-health-score',
              is_enabled: newStatus
            }
          ]
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(prev => prev.map(u => u.id === userObj.id ? { ...u, healthScoreEnabled: newStatus } : u));
        toast.success(`Business Health Score ${newStatus ? 'enabled' : 'disabled'} for ${userObj.name}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cfo-menu-permissions-updated'));
        }
      } else {
        toast.error(data.error || 'Failed to update feature setting');
      }
    } catch (e) {
      toast.error('Network error updating health score setting');
    } finally {
      setTogglingId(null);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/admin/invitations');
      const data = await res.json();
      if (res.ok && data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (e) {
      console.error('Error fetching invitations:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, []);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !organizationName.trim()) {
      toast.error('First Name, Email, and Organization Name are required.');
      return;
    }

    setSendingInvite(true);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          email,
          organizationName,
          role,
          invitedBy,
          expiryHours: parseInt(expiryHours, 10)
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Invitation email sent to ${email}`);
        setShowModal(false);
        setFirstName('');
        setEmail('');
        setOrganizationName('');
        fetchInvitations();
      } else {
        toast.error(data.error || 'Failed to send invitation email');
      }
    } catch (e: any) {
      toast.error('Network error sending invitation email');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResend = async (inv: any) => {
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: inv.first_name,
          email: inv.email,
          organizationName: inv.organization_name,
          role: inv.role,
          invitedBy: inv.invited_by || 'Superadmin',
          expiryHours: 6
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Resent invitation email to ${inv.email}`);
        fetchInvitations();
      } else {
        toast.error('Failed to resend invitation');
      }
    } catch (e) {
      toast.error('Error resending invitation');
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/invitations?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Invitation revoked successfully');
        fetchInvitations();
      } else {
        toast.error('Failed to revoke invitation');
      }
    } catch (e) {
      toast.error('Error revoking invitation');
    }
  };

  const handleCopyLink = (inv: any) => {
    const link = `${window.location.origin}/register?token=${inv.token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(inv.id);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open User Menu Permission Manager Drawer
  const openUserPermissionManager = async (userObj: any) => {
    setSelectedManageUser(userObj);
    setLoadingUserPermissions(true);
    setMenuSearch('');
    
    try {
      const res = await fetch(`/api/admin/menu-permissions?user_email=${encodeURIComponent(userObj.email)}&role=${encodeURIComponent(userObj.role || 'CFO')}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const map: Record<string, boolean> = {};
        
        // Priority loading: ALL defaults -> Role defaults -> User specific overrides
        (data.permissions || []).forEach((p: any) => {
          if (p.role === `USER:${userObj.email.toLowerCase().trim()}`) {
            map[p.menu_key] = p.is_enabled;
          } else if (!(p.menu_key in map)) {
            map[p.menu_key] = p.is_enabled;
          }
        });
        
        setUserPermissionMap(map);
        setInitialUserPermissionMap(map);
      } else {
        toast.error('Failed to load menu permissions for user');
      }
    } catch (err) {
      console.error('Error loading user permissions:', err);
      toast.error('Error connecting to permission service');
    } finally {
      setLoadingUserPermissions(false);
    }
  };

  // Toggle single user item tick
  const toggleUserMenuItem = (menuKey: string) => {
    const current = userPermissionMap[menuKey] ?? true;
    setUserPermissionMap(prev => ({
      ...prev,
      [menuKey]: !current
    }));
  };

  // Bulk tick all visible
  const bulkTickUserItems = (enable: boolean) => {
    const newMap = { ...userPermissionMap };
    SYSTEM_NAV_DEFINITIONS.forEach(sec => {
      sec.items.forEach(item => {
        newMap[item.href] = enable;
        if (item.subItems) {
          item.subItems.forEach(sub => {
            newMap[sub.href] = enable;
          });
        }
      });
    });
    setUserPermissionMap(newMap);
    toast.success(`${enable ? 'Ticked' : 'Unticked'} all menu items for ${selectedManageUser?.name}`);
  };

  // Bulk section toggle
  const toggleUserSection = (section: MenuDefinitionSection, enable: boolean) => {
    const newMap = { ...userPermissionMap };
    section.items.forEach(item => {
      newMap[item.href] = enable;
      if (item.subItems) {
        item.subItems.forEach(sub => {
          newMap[sub.href] = enable;
        });
      }
    });
    setUserPermissionMap(newMap);
  };

  // Save User Permissions
  const handleSaveUserPermissions = async () => {
    if (!selectedManageUser) return;
    setSavingUserPermissions(true);

    try {
      const permissionsPayload = Object.entries(userPermissionMap).map(([menu_key, is_enabled]) => ({
        user_email: selectedManageUser.email,
        menu_key,
        is_enabled
      }));

      const res = await fetch('/api/admin/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: selectedManageUser.email,
          permissions: permissionsPayload
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Custom menu permissions saved for ${selectedManageUser.name}!`);
        setInitialUserPermissionMap(userPermissionMap);
        
        // Update user state in table as well
        const currentHsStatus = userPermissionMap['/settings/business-health-score'] ?? true;
        setUsers(prev => prev.map(u => u.id === selectedManageUser.id ? { ...u, healthScoreEnabled: currentHsStatus } : u));

        // Sync local storage cache for instant update
        const formattedCache = Object.entries(userPermissionMap).map(([menu_key, is_enabled]) => ({
          role: `USER:${selectedManageUser.email.toLowerCase().trim()}`,
          menu_key,
          is_enabled
        }));

        if (typeof window !== 'undefined') {
          localStorage.setItem(`cfo_menu_permissions_${selectedManageUser.email.toLowerCase().trim()}`, JSON.stringify(formattedCache));
          window.dispatchEvent(new CustomEvent('cfo-menu-permissions-updated'));
        }
      } else {
        toast.error(data.error || 'Failed to save user permissions');
      }
    } catch (err) {
      toast.error('Network error saving user permissions');
    } finally {
      setSavingUserPermissions(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredInvitations = invitations.filter(i => 
    i.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.email?.toLowerCase().includes(search.toLowerCase()) ||
    i.organization_name?.toLowerCase().includes(search.toLowerCase())
  );

  const isUserDirty = useMemo(() => {
    return JSON.stringify(userPermissionMap) !== JSON.stringify(initialUserPermissionMap);
  }, [userPermissionMap, initialUserPermissionMap]);

  return (
    <div className="space-y-6 select-none pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Users & Access Management</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage tenant customer users, custom menu permissions per user, and active email invitations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button 
            onClick={() => { fetchUsers(); fetchInvitations(); }} 
            className="p-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowModal(true)} 
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
        {/* Navigation Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-500">
            {['all', 'admins', 'finance users', 'invitations'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`px-4 py-1.5 rounded-xl capitalize transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {tab}
                {tab === 'invitations' && invitations.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px]">
                    {invitations.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name, email, or org..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-600" 
            />
          </div>
        </div>

        {/* Content Views */}
        {activeTab === 'invitations' ? (
          /* Invitations View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvitations.length > 0 ? (
                  filteredInvitations.map((inv) => {
                    const isExpired = new Date(inv.expires_at) < new Date() && inv.status === 'Pending';
                    const displayStatus = isExpired ? 'Expired' : inv.status;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="block font-bold text-slate-900">{inv.first_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{inv.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">{inv.organization_name}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            displayStatus === 'Accepted' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : displayStatus === 'Revoked'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : displayStatus === 'Expired'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            ● {displayStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {new Date(inv.expires_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleCopyLink(inv)}
                              title="Copy Registration Link"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                            >
                              {copiedId === inv.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => handleResend(inv)}
                              title="Resend Invitation Email"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                            {inv.status === 'Pending' && (
                              <button
                                onClick={() => handleRevoke(inv.id)}
                                title="Revoke Invitation"
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No invitations dispatched yet. Click <strong>"Invite User"</strong> above to send one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Registered Users Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Health Score</th>
                  <th className="py-3 px-4">Created / Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>
                          <span className="block font-bold text-slate-900">{u.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{u.company}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button 
                          onClick={() => handleQuickToggleHealthScore(u)} 
                          disabled={togglingId === u.id}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-2xs outline-none",
                            u.healthScoreEnabled !== false
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          )}
                          title={`Click to ${u.healthScoreEnabled !== false ? 'disable' : 'enable'} Business Health Score for ${u.name}`}
                        >
                          <Activity className={cn("w-3.5 h-3.5", togglingId === u.id ? "animate-spin" : "")} />
                          <span>{u.healthScoreEnabled !== false ? "Score: Enabled" : "Score: Disabled"}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{u.lastLogin}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button 
                          onClick={() => openUserPermissionManager(u)} 
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[11px] cursor-pointer shadow-sm flex items-center gap-1.5 ml-auto"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Manage Access
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      {loading ? 'Loading users...' : 'No active users found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Send Virtual CFO Invitation</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Dispatches direct registration link via Gmail SMTP</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">First Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address *</label>
                  <input
                    type="email"
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Organization Name *</label>
                  <input
                    type="text"
                    placeholder="Acme Technologies"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Access Level / Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="Founder / Owner">Founder / Owner</option>
                    <option value="CEO">CEO</option>
                    <option value="CFO">CFO</option>
                    <option value="Finance Manager">Finance Manager</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Finance Team">Finance Team</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Invited By</label>
                  <input
                    type="text"
                    value={invitedBy}
                    onChange={(e) => setInvitedBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Token Expiration</label>
                  <select
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="2">2 Hours</option>
                    <option value="6">6 Hours (Recommended)</option>
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours</option>
                    <option value="48">48 Hours</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-blue-900 block flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-600" /> Subject: Invitation to Join Virtual CFO
                </span>
                <p className="text-slate-500 leading-tight">
                  This will email <strong>{email || 'recipient'}</strong> with the official branded Virtual CFO template including a secure <strong>{expiryHours}-hour registration token link</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendingInvite ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Sending Email...
                    </span>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Send Invitation Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-User Dynamic Menu Control Slide-Over Drawer */}
      {selectedManageUser && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setSelectedManageUser(null)} 
          />

          <div className="relative w-full max-w-2xl bg-slate-900 text-slate-100 h-full border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-900/50 uppercase">
                  {selectedManageUser.name ? selectedManageUser.name.charAt(0) : 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedManageUser.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {selectedManageUser.role || 'User'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedManageUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedManageUser(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Permissions Sub-Banner & Controls */}
            <div className="p-5 bg-slate-950/40 border-b border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search menu name or URL path..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bulkTickUserItems(true)}
                    className="px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Tick All
                  </button>

                  <button
                    onClick={() => bulkTickUserItems(false)}
                    className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" /> Untick All
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Tick <strong className="text-white">[x]</strong> the menus you want to grant to <strong>{selectedManageUser.name}</strong>. Unticked menus will be hidden from their sidebar immediately upon saving.
                </p>
              </div>
            </div>

            {/* Menu Checkboxes List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
              {loadingUserPermissions ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-medium">Loading user custom menu permissions...</span>
                </div>
              ) : (
                <>
                  {/* Featured Module Highlight: Business Health Score */}
                  <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">Business Health Score Module</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Overview & Config
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            Control whether <strong>{selectedManageUser.name}</strong> can see the Health Score gauge on Dashboard Overview, Xero Dashboard, and access Target Configuration in Settings.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleUserMenuItem('/settings/business-health-score')}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition cursor-pointer shrink-0 self-start sm:self-center shadow-xs",
                          (userPermissionMap['/settings/business-health-score'] ?? true)
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25"
                        )}
                      >
                        {(userPermissionMap['/settings/business-health-score'] ?? true) ? (
                          <>
                            <Eye className="w-4 h-4 text-emerald-400" />
                            <span>Module: Enabled</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 text-rose-400" />
                            <span>Module: Disabled</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {SYSTEM_NAV_DEFINITIONS.map((sec, sIdx) => {
                  const sectionTitle = sec.title || 'General Dashboard Overview';
                  const isCollapsed = collapsedUserSections[sectionTitle] || false;

                  const filteredItems = sec.items.filter(item => {
                    if (!menuSearch) return true;
                    const q = menuSearch.toLowerCase();
                    return item.name.toLowerCase().includes(q) || item.href.toLowerCase().includes(q) ||
                      item.subItems?.some(s => s.name.toLowerCase().includes(q) || s.href.toLowerCase().includes(q));
                  });

                  if (filteredItems.length === 0) return null;

                  const enabledCount = filteredItems.filter(item => userPermissionMap[item.href] ?? true).length;
                  const totalCount = filteredItems.length;
                  const allTicked = enabledCount === totalCount;

                  return (
                    <div key={sIdx} className="rounded-2xl bg-slate-950/60 border border-slate-800 overflow-hidden shadow-sm">
                      {/* Section Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setCollapsedUserSections(prev => ({ ...prev, [sectionTitle]: !isCollapsed }))}
                            className="text-slate-400 hover:text-white"
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
                          </button>
                          <h3 className="text-xs font-bold text-slate-200">
                            {sectionTitle}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            {enabledCount}/{totalCount} Ticked
                          </span>
                        </div>

                        <button
                          onClick={() => toggleUserSection(sec, !allTicked)}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {allTicked ? 'Untick Section' : 'Tick All Section'}
                        </button>
                      </div>

                      {/* Section Items with Checkboxes */}
                      {!isCollapsed && (
                        <div className="p-3 space-y-2.5">
                          {filteredItems.map((item, iIdx) => {
                            const isTicked = userPermissionMap[item.href] ?? true;

                            return (
                              <div
                                key={iIdx}
                                className={`p-3 rounded-xl border transition-all space-y-2 ${
                                  isTicked
                                    ? 'bg-slate-900 border-slate-700/80 shadow-sm'
                                    : 'bg-slate-950/50 border-slate-850 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <label
                                    onClick={() => toggleUserMenuItem(item.href)}
                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                  >
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                                      isTicked 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                                        : 'bg-slate-950 border-slate-700 text-transparent'
                                    }`}>
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-white block">{item.name}</span>
                                      <span className="text-[10px] font-mono text-slate-400">{item.href}</span>
                                    </div>
                                  </label>

                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                    isTicked 
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                      : 'bg-slate-800 text-slate-500 border-slate-700'
                                  }`}>
                                    {isTicked ? 'Granted' : 'Revoked'}
                                  </span>
                                </div>

                                {/* Nested Child Subitems */}
                                {item.subItems && item.subItems.length > 0 && (
                                  <div className="pl-8 pt-2 border-t border-slate-800/60 space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                      Child Pages Access:
                                    </span>
                                    {item.subItems.map((sub, subIdx) => {
                                      const isSubTicked = userPermissionMap[sub.href] ?? true;
                                      return (
                                        <label
                                          key={subIdx}
                                          onClick={() => toggleUserMenuItem(sub.href)}
                                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-800/50"
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                              isSubTicked 
                                                ? 'bg-blue-600 border-blue-500 text-white' 
                                                : 'bg-slate-900 border-slate-700 text-transparent'
                                            }`}>
                                              <Check className="w-3 h-3 stroke-[3]" />
                                            </div>
                                            <span className="text-slate-300 font-medium">{sub.name}</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-slate-500">{sub.href}</span>
                                        </label>
                                      );
                                    })}
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
              </>
            )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                onClick={() => setUserPermissionMap(initialUserPermissionMap)}
                disabled={!isUserDirty}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Discard
              </button>

              <button
                onClick={handleSaveUserPermissions}
                disabled={savingUserPermissions}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/50 transition-all active:scale-95 cursor-pointer"
              >
                {savingUserPermissions ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingUserPermissions ? 'Saving User Permissions...' : `Save Access for ${selectedManageUser.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
