"use client";

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Lock,
  KeyRound,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Building,
  Clock,
  Globe,
  Laptop,
  Eye,
  EyeOff,
  Camera,
  Image as ImageIcon,
  Check,
  Crown,
  Upload,
  Sparkles,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

// Preset Executive Avatars
const PRESET_AVATARS = [
  { id: 'av-1', name: 'Executive Crown', bg: 'bg-gradient-to-tr from-[#00b7e2] to-blue-600', icon: '👑' },
  { id: 'av-2', name: 'Tech Strategist', bg: 'bg-gradient-to-tr from-purple-600 to-indigo-600', icon: '⚡' },
  { id: 'av-3', name: 'Cyber Shield', bg: 'bg-gradient-to-tr from-emerald-600 to-teal-600', icon: '🛡️' },
  { id: 'av-4', name: 'Financial Lead', bg: 'bg-gradient-to-tr from-amber-500 to-orange-600', icon: '💼' },
  { id: 'av-5', name: 'Deep Navy', bg: 'bg-gradient-to-tr from-slate-800 to-slate-950', icon: '🔷' },
  { id: 'av-6', name: 'Cyan Glow', bg: 'bg-gradient-to-tr from-cyan-500 to-blue-600', icon: '✨' },
  { id: 'av-7', name: 'Emerald Star', bg: 'bg-gradient-to-tr from-emerald-500 to-teal-700', icon: '🌟' },
  { id: 'av-8', name: 'Gold Governance', bg: 'bg-gradient-to-tr from-amber-600 to-[#00b7e2]', icon: '🏆' },
];

export default function SuperAdminProfilePage() {
  const [activeTab, setActiveTab] = useState<'info' | 'security' | '2fa' | 'sessions'>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Form states
  const [name, setName] = useState('Super Administrator');
  const [email, setEmail] = useState('admin@virtualcfo.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [department, setDepartment] = useState('Corporate Governance & Platform Administration');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST +05:30)');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatarInput, setCustomAvatarInput] = useState('');

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // 2FA state (dynamic from DB)
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Interactive 2FA Setup states
  const [settingUp2FA, setSettingUp2FA] = useState(false);
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupCode, setTotpSetupCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/profile');
      const data = await res.json();
      if (res.ok && data.success) {
        setName(data.profile.name || 'Super Administrator');
        setEmail(data.profile.email || 'admin@virtualcfo.com');
        setPhone(data.profile.phone || '+91 98765 43210');
        setDepartment(data.profile.department || 'Corporate Governance & Platform Administration');
        setTimezone(data.profile.timezone || 'Asia/Kolkata (IST +05:30)');
        setAvatarUrl(data.profile.avatarUrl || '');
        setIs2FAEnabled(!!data.profile.is2FAEnabled);
        setSecretKey(data.profile.secretKey || null);
      }
    } catch (e) {
      toast.error('Failed to load admin profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, department, timezone, avatarUrl })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Super Admin profile saved to PostgreSQL database!');
        window.dispatchEvent(new Event('adminProfileUpdated'));
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error('Network error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarUrl(result);
        setShowAvatarModal(false);
        toast.success('Custom avatar photo selected! Click "Save Profile Changes" to persist.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Super Admin password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Failed to change password');
      }
    } catch (err) {
      toast.error('Error changing password');
    } finally {
      setSaving(false);
    }
  };

  const copySecretKey = () => {
    const keyToCopy = secretKey || totpSetupSecret;
    if (keyToCopy) {
      navigator.clipboard.writeText(keyToCopy);
      toast.success('2FA Secret Key copied to clipboard!');
    }
  };

  const handleStart2FASetup = async () => {
    setSettingUp2FA(true);
    try {
      const res = await fetch('/api/admin/auth/2fa/info');
      const data = await res.json();
      if (res.ok && data.success) {
        setTotpSetupSecret(data.qrSecret || '');
      } else {
        toast.error('Failed to initialize 2FA setup');
      }
    } catch (e) {
      toast.error('Error starting 2FA setup');
    }
  };

  const handleVerifyAndActivate2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetupCode || totpSetupCode.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return;
    }

    setVerifying2FA(true);
    try {
      const res = await fetch('/api/admin/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpSetupCode, secret: totpSetupSecret })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Google 2FA Enabled & Enforced Successfully!');
        setIs2FAEnabled(true);
        setSecretKey(totpSetupSecret);
        setSettingUp2FA(false);
        setTotpSetupCode('');
        fetchProfile();
      } else {
        toast.error(data.message || 'Verification failed. Check 6-digit code in Authenticator.');
      }
    } catch (e) {
      toast.error('Failed to verify 2FA code.');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleReset2FA = async () => {
    if (!confirm('Are you sure you want to disable and reset 2FA credentials for Super Admin?')) return;
    try {
      const res = await fetch('/api/admin/auth/2fa/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('2FA credentials removed. Google 2FA is now disabled.');
        setIs2FAEnabled(false);
        setSecretKey(null);
        setSettingUp2FA(false);
        fetchProfile();
      } else {
        toast.error(data.message || 'Failed to reset 2FA');
      }
    } catch (e) {
      toast.error('Error resetting 2FA');
    }
  };

  const renderAvatarContent = (sizeClass = 'h-20 w-20 text-2xl') => {
    if (avatarUrl && avatarUrl.startsWith('data:image')) {
      return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-2xl object-cover shadow-lg border-2 border-white/20`} />;
    }
    if (avatarUrl && avatarUrl.startsWith('http')) {
      return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-2xl object-cover shadow-lg border-2 border-white/20`} />;
    }
    const selectedPreset = PRESET_AVATARS.find(a => a.id === avatarUrl) || PRESET_AVATARS[0];
    return (
      <div className={`${sizeClass} rounded-2xl ${selectedPreset.bg} text-white font-black flex items-center justify-center shadow-lg border-2 border-white/20`}>
        {selectedPreset.icon}
      </div>
    );
  };

  return (
    <div className="space-y-6 select-none pb-16">

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Super Admin Profile & Governance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Manage your master administrative credentials, avatar icon, contact details, security settings, and 2FA authentication.
          </p>
        </div>

        <button
          onClick={fetchProfile}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Main Profile Summary Banner Card */}
      <div className="bg-gradient-to-r from-[#0b1329] via-[#111e3f] to-[#0b1329] rounded-3xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-5 z-10">

          <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
            {renderAvatarContent('h-20 w-20 text-2xl')}
            <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 backdrop-blur-xs">
              <Camera className="h-4 w-4 text-cyan-400" />
              <span>Change</span>
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-[#0b1329] flex items-center justify-center text-white" title="Active Account">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{name}</h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-md">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-cyan-400" />
              <span>{email}</span>
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3 text-slate-400" /> {department}
              </span>
              {is2FAEnabled ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <ShieldCheck className="h-3 w-3" /> 2FA Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <AlertCircle className="h-3 w-3 text-amber-400" /> 2FA Disabled
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto z-10 border-t md:border-t-0 border-slate-800/80 pt-4 md:pt-0">
          <button
            onClick={() => setShowAvatarModal(true)}
            className="px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>Change Profile Icon</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'info', label: 'Profile Details', icon: User },
          { id: 'security', label: 'Password & Security', icon: Lock },
          { id: '2fa', label: 'Google 2FA Settings', icon: Smartphone },
          { id: 'sessions', label: 'Active Sessions & Logs', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-xl transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE DETAILS */}
      {activeTab === 'info' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Personal & Administrative Profile</h3>
              <p className="text-xs text-slate-500">Update your Super Administrator contact details and governance profile.</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Last updated: Today</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Governance Department</label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Timezone</label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Administrative Role</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />
                <input
                  type="text"
                  value="Platform Super Administrator (Full Unrestricted Access)"
                  readOnly
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-cyan-50/60 border border-cyan-200 rounded-xl text-cyan-900 font-bold cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving to Database...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: PASSWORD & SECURITY */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Change Master Password</h3>
            <p className="text-xs text-slate-500">Ensure your Super Admin account uses a strong, unique password.</p>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: GOOGLE 2FA SETTINGS */}
      {activeTab === '2fa' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Google Two-Factor Authentication (2FA / TOTP)</h3>
              <p className="text-xs text-slate-500">RFC 6238 time-based 6-digit one-time password protection for Super Admin logins.</p>
            </div>
            {is2FAEnabled ? (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> 2FA Enforced & Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> 2FA Not Configured
              </span>
            )}
          </div>

          {is2FAEnabled ? (
            /* ACTIVE 2FA VIEW */
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Authenticator App Connected</h4>
                    <p className="text-[11px] text-slate-500">Super Admin login is protected with 6-digit TOTP codes.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset2FA}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Disable / Reset 2FA</span>
                  </button>
                </div>
              </div>

              {secretKey && (
                <div className="border-t border-slate-200/80 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">TOTP Secret Key: </span>
                    <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg ml-1">
                      {showSecretKey ? secretKey : '•••• •••• •••• ••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="ml-2 text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      {showSecretKey ? 'Hide' : 'Reveal Key'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={copySecretKey}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Key
                  </button>
                </div>
              )}
            </div>
          ) : settingUp2FA ? (
            /* SETUP IN PROGRESS VIEW */
            <form onSubmit={handleVerifyAndActivate2FA} className="bg-blue-50/50 border border-blue-200 rounded-2xl p-6 space-y-5 animate-in fade-in duration-300">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  Set Up Google Authenticator
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Scan QR code or enter secret key into Google Authenticator / Authy app.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Secret Key for Authenticator App</span>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg tracking-wider">
                    {totpSetupSecret || 'FETCHING...'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(totpSetupSecret);
                      toast.success('Secret key copied!');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Key
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-800">Enter 6-Digit Code from Authenticator App *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={totpSetupCode}
                    onChange={(e) => setTotpSetupCode(e.target.value.replace(/\D/g, ''))}
                    className="px-4 py-3 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 w-44"
                    required
                  />
                  <button
                    type="submit"
                    disabled={verifying2FA || totpSetupCode.length !== 6}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifying2FA ? 'Verifying Code...' : 'Verify Code & Activate 2FA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingUp2FA(false)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* DISABLED / NOT SETUP VIEW */
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-900">Google 2FA is Currently Disabled</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Super Admin logins currently only require email and password. Enable Google Two-Factor Authentication to add RFC 6238 6-digit TOTP protection.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <button
                  type="button"
                  onClick={handleStart2FASetup}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="h-4 w-4" />
                  <span>Enable & Setup Google 2FA</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACTIVE SESSIONS & LOGS */}
      {activeTab === 'sessions' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Active Administrative Sessions</h3>
            <p className="text-xs text-slate-500">Live devices currently logged into the Super Admin portal.</p>
          </div>

          <div className="space-y-3">
            {[
              { device: 'Windows Desktop (Chrome 128)', ip: '127.0.0.1 (Current Session)', location: 'New Delhi, India', status: 'Active Now', current: true },
              { device: 'MacBook Pro (Safari 17.5)', ip: '192.168.1.18', location: 'Mumbai, India', status: '2 hours ago', current: false },
            ].map((sess, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{sess.device}</span>
                      {sess.current && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                          Current Device
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">IP: {sess.ip} • {sess.location}</p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-medium">{sess.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AVATAR SELECTION MODAL */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Select Super Admin Avatar</h3>
                <p className="text-xs text-slate-500 font-medium">Choose an executive preset or upload your photo.</p>
              </div>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Executive Presets</span>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => {
                      setAvatarUrl(av.id);
                      setShowAvatarModal(false);
                      toast.success(`Selected "${av.name}" avatar preset! Save profile changes to apply.`);
                    }}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition cursor-pointer hover:scale-105 ${
                      avatarUrl === av.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl ${av.bg} text-white font-black flex items-center justify-center text-lg shadow-sm`}>
                      {av.icon}
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 text-center leading-tight truncate w-full">{av.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Upload Custom Avatar Image</span>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>Choose Image File...</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <span className="text-[11px] text-slate-400">PNG, JPG, SVG under 2MB</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAvatarModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
