"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  QrCode, 
  Copy, 
  Check, 
  ArrowRight, 
  Shield, 
  Smartphone, 
  KeyRound, 
  AlertCircle,
  ArrowLeft,
  Lock,
  Search,
  Sun,
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Download,
  Quote,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dedicated2FAPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [forceSetupMode, setForceSetupMode] = useState(false);
  const [qrSecret, setQrSecret] = useState('FX2LADSR2YAJW0QJJ3NK6T7M');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [email, setEmail] = useState('admin@virtualcfo.com');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetchInfo();
  }, []);

  const fetchInfo = () => {
    setLoading(true);
    fetch('/api/admin/auth/2fa/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setIsEnabled(!!data.isEnabled);
          if (data.qrSecret) setQrSecret(data.qrSecret);
          if (data.otpauthUrl) setOtpauthUrl(data.otpauthUrl);
          if (data.email) setEmail(data.email);
        }
      })
      .catch(() => {
        toast.error('Failed to load 2FA setup info');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleResetToSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/2fa/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsEnabled(false);
        setForceSetupMode(true);
        toast.info('Reset to Initial Setup Mode!');
        fetchInfo();
      }
    } catch (e) {
      toast.error('Failed to reset state');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...totpCode];
    newCode[index] = value.slice(-1);
    setTotpCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newCode = [...totpCode];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pastedData[i] || '';
      }
      setTotpCode(newCode);
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(qrSecret);
    setCopiedSecret(true);
    toast.success('2FA Secret Key copied to clipboard!');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = totpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter complete 6-digit verification code.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/admin/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, secret: qrSecret }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Google 2FA Verified & Enabled! Redirecting to Dashboard...');
        window.location.href = '/admin/dashboard';
      } else {
        toast.error(data.message || 'Invalid 6-digit code. Please try again.');
      }
    } catch (err) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSkip = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/admin/auth/2fa/skip', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.info('Switched to Super Admin Dashboard.');
        window.location.href = '/admin/dashboard';
      } else {
        toast.error('Failed to switch to dashboard');
      }
    } catch (e) {
      toast.error('Failed to switch to dashboard');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center font-sans text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Google 2FA Engine...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODE B: VERIFICATION SCREEN (CLEAN, MINIMAL - USER LOVES THIS)
  // Rendered ONLY when 2FA is active AND user didn't explicitly request initial setup preview
  // -------------------------------------------------------------
  if (isEnabled && !forceSetupMode) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] font-sans flex flex-col justify-between p-4 sm:p-8 select-none">
        
        {/* Top Branding Navigation Bar */}
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-1 h-8">
              <span className="w-1.5 h-4 bg-blue-600 rounded-xs"></span>
              <span className="w-1.5 h-6 bg-blue-500 rounded-xs"></span>
              <span className="w-1.5 h-8 bg-blue-400 rounded-xs"></span>
            </div>
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">Virtual CFO <span className="text-xs text-blue-600 font-bold uppercase px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full ml-1">Super Admin</span></span>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full shadow-xs text-xs text-slate-700 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>{email}</span>
          </div>
        </header>

        {/* Main Center Container */}
        <main className="max-w-2xl w-full mx-auto my-auto py-6">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-slate-300/50 space-y-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-50 border border-blue-100 shadow-xs text-blue-600">
                <svg className="w-10 h-10" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Two-Factor Verification
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                  Enter the 6-digit verification code from your Google Authenticator app.
                </p>
              </div>
            </div>

            <div className="border-t border-b border-slate-100 py-6 max-w-md mx-auto">
              <form onSubmit={handleVerify} className="space-y-6">
                <div className="space-y-2 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 2FA ACTIVE & ENFORCED
                  </span>
                  <p className="text-xs text-slate-600 font-medium">
                    Enter 6-digit code from Google Authenticator to enter Dashboard:
                  </p>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  {totpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-11 h-13 text-center text-xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                    />
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? 'VERIFYING CODE...' : 'VERIFY CODE & ENTER DASHBOARD →'}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium text-center">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Encrypted with RFC 6238 TOTP Standard • Protected by Virtual CFO Security</span>
            </div>
          </div>
        </main>

        <footer className="max-w-4xl w-full mx-auto text-center py-2 text-xs text-slate-400">
          © 2026 Virtual CFO. All rights reserved.
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODE A: INITIAL SETUP UI -> MATCHING REFERENCE IMAGE 1 EXCLUSIVELY
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#F4F7FC] text-slate-800 font-sans flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-10 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left Branding Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-end gap-1 h-8">
            <span className="w-1.5 h-4 bg-blue-600 rounded-xs"></span>
            <span className="w-1.5 h-6 bg-blue-500 rounded-xs"></span>
            <span className="w-1.5 h-8 bg-blue-400 rounded-xs"></span>
          </div>
          <div>
            <span className="font-black text-lg text-slate-900 tracking-tight leading-none block">Virtual CFO</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">Smarter Finance. Brighter Decisions.</span>
          </div>
        </div>

        {/* Right Nav Utilities: Search Box, Theme, Bell, Admin Profile */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-100/80 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs text-slate-400 w-56 justify-between">
            <span className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span>Search anything...</span>
            </span>
            <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-mono">Ctrl K</span>
          </div>

          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer">
            <Sun className="h-4 w-4" />
          </button>

          <button className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition relative cursor-pointer">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
          </button>

          {/* User Profile Badge */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="h-8 w-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              A
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-tight">Admin</span>
              <span className="text-[10px] text-slate-400 font-medium">Super Admin</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN CONTENT BODY */}
      <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: STEPPER SIDEBAR (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>

          <div className="space-y-4">
            {/* Step 1: Account Details (Completed) */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs">
                ✓
              </div>
              <div className="pt-0.5">
                <h4 className="text-xs font-bold text-slate-900">Account Details</h4>
                <p className="text-[11px] text-slate-400">Basic information</p>
              </div>
            </div>

            {/* Step 2: Two-Factor Authentication (ACTIVE HIGHLIGHTED CONTAINER) */}
            <div className="flex items-start gap-3 bg-blue-50/90 p-3 rounded-2xl border border-blue-200/90 shadow-xs">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm shadow-blue-500/30">
                2
              </div>
              <div className="pt-0.5">
                <h4 className="text-xs font-extrabold text-blue-700">Two-Factor Authentication</h4>
                <p className="text-[11px] text-blue-600 font-medium">Secure your account</p>
              </div>
            </div>

            {/* Step 3: Preferences */}
            <div className="flex items-start gap-3 opacity-60">
              <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </div>
              <div className="pt-0.5">
                <h4 className="text-xs font-bold text-slate-700">Preferences</h4>
                <p className="text-[11px] text-slate-400">Set your preferences</p>
              </div>
            </div>

            {/* Step 4: Finish */}
            <div className="flex items-start gap-3 opacity-60">
              <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                4
              </div>
              <div className="pt-0.5">
                <h4 className="text-xs font-bold text-slate-700">Finish</h4>
                <p className="text-[11px] text-slate-400">You're all set!</p>
              </div>
            </div>
          </div>

          {/* Left Bottom Security Priority Card */}
          <div className="pt-10">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h5 className="text-[11px] font-bold text-blue-900">Your security is our priority</h5>
                <p className="text-[10px] text-slate-400">We use industry-standard encryption to keep your data safe.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: MAIN SETUP CONTAINER (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
            
            {/* Header Badge & Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-blue-600" /> SECURITY SETUP
                </span>
                <span className="text-xs text-slate-400 font-semibold">Step 2 of 4</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Set up Google Authenticator
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Add an extra layer of security to protect your Virtual CFO admin account.
              </p>
            </div>

            {/* 2-COLUMN SETUP BOX */}
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: 1. Scan QR Code */}
              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 self-start">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">1</span>
                  <span className="text-sm font-extrabold text-slate-900">Scan QR Code</span>
                </div>

                <p className="text-[11.5px] text-slate-500 leading-normal text-left">
                  Open Google Authenticator on your mobile device and scan the QR code below.
                </p>

                {/* QR Code Container with Corner Brackets & Center vCFO Logo */}
                <div className="relative p-4 bg-white border border-slate-200/90 rounded-2xl shadow-sm group">
                  {/* Vibrant Blue Corner Brackets */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-blue-600"></div>
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-blue-600"></div>
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-600"></div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-blue-600"></div>

                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl || 'otpauth://totp/VirtualCFO:admin@virtualcfo.com?secret=FX2LADSR2YAJWOQJJ3NK6T7M')}`}
                    alt="2FA QR Code"
                    className="w-36 h-36 object-contain mx-auto"
                  />

                  {/* Center vCFO Bar Icon Overlay */}
                  <div className="absolute inset-0 m-auto w-8 h-8 rounded-lg bg-white shadow-md border border-slate-200 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-4">
                      <span className="w-1 h-2.5 bg-blue-600 rounded-xs"></span>
                      <span className="w-1 h-3.5 bg-blue-500 rounded-xs"></span>
                      <span className="w-1 h-4 bg-blue-400 rounded-xs"></span>
                    </div>
                  </div>
                </div>

                {/* Secret Key Input Box */}
                <div className="w-full space-y-1 text-left pt-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Use this secret key (manual entry)</span>
                  <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 rounded-xl p-2 shadow-xs">
                    <span className="font-mono text-xs font-bold text-slate-800 tracking-wider truncate pl-1">{qrSecret}</span>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="p-1.5 bg-white hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 shadow-xs transition cursor-pointer ml-1"
                      title="Copy Key"
                    >
                      {copiedSecret ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: 2. Enter Verification Code */}
              <div className="space-y-4 flex flex-col items-center text-center border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-6">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 self-start">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">2</span>
                  <span className="text-sm font-extrabold text-slate-900">Enter Verification Code</span>
                </div>

                <p className="text-[11.5px] text-slate-500 leading-normal text-left">
                  Enter the 6-digit code from your authenticator app to verify the setup.
                </p>

                <form onSubmit={handleVerify} className="w-full space-y-5 pt-1">
                  {/* 6 Digit Input Boxes - Grid layout to guarantee 0 overflow */}
                  <div className="grid grid-cols-6 gap-1 sm:gap-1.5 w-full">
                    {totpCode.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className="w-full h-11 sm:h-12 text-center text-sm sm:text-base font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs min-w-0"
                      />
                    ))}
                  </div>

                  {/* Primary Verify Button */}
                  <button
                    type="submit"
                    disabled={verifying}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? 'Verifying...' : 'Verify & Enable 2FA →'}
                  </button>

                  {/* Divider */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Skip Button */}
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={verifying}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Skip for now & continue to Dashboard</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </form>

              </div>

            </div>

            {/* Bottom Mountain Quote Banner */}
            <div className="relative rounded-2xl p-5 text-white overflow-hidden shadow-md bg-slate-900 min-h-[100px] flex items-center">
              {/* Background Mountain Graphic / Photo */}
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-blue-950/80" />

              <div className="relative z-10 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 max-w-md">
                  <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-100 flex items-start gap-1.5">
                    <Quote className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    Security is not a product, but a continuous process.
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium pl-5.5">— Bruce Schneier</p>
                </div>

                <div className="text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
                  <div className="h-1 w-6 bg-blue-500 rounded ml-auto mb-1"></div>
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-100 block">Better Security.</span>
                  <span className="text-[11px] font-medium text-slate-300">A Stronger Tomorrow.</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: SIDEBAR WIDGETS (3 cols) */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* Widget 1: Why Enable 2FA? */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-900">Why Enable 2FA?</h3>
            </div>

            <ul className="space-y-2 text-[11px] text-slate-600 font-normal">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>Protects against unauthorized access</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>Keeps your financial data secure</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>Industry standard security (TOTP)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>Quick and easy to set up</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span>Can be removed anytime</span>
              </li>
            </ul>
          </div>

          {/* Widget 2: Get the App */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-900">Get the App</h3>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Download Google Authenticator from your device's app store.
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href="https://apps.apple.com/us/app/google-authenticator/id388497605"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-xl transition shadow-xs"
              >
                <span>Download on the App Store</span>
              </a>

              <a
                href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-xl transition shadow-xs"
              >
                <span>GET IT ON Google Play</span>
              </a>
            </div>
          </div>

          {/* Widget 3: Need Help? FAQ */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-900">Need Help?</h3>
            </div>

            <div className="divide-y divide-slate-100 text-[11px]">
              <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Open Google Authenticator, tap '+' and scan QR code."); }} className="py-2 flex items-center justify-between text-blue-600 font-semibold hover:underline">
                <span>How to set up Google Authenticator?</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </a>

              <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Yes, Authy or 1Password also work."); }} className="py-2 flex items-center justify-between text-blue-600 font-semibold hover:underline">
                <span>Can I use a different authenticator app?</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </a>

              <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Contact support to reset your 2FA key."); }} className="py-2 flex items-center justify-between text-blue-600 font-semibold hover:underline">
                <span>What if I lose my device?</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </a>

              <a href="#" onClick={(e) => { e.preventDefault(); toast.info("Support team: support@virtualcfo.com"); }} className="py-2 flex items-center justify-between text-blue-600 font-semibold hover:underline">
                <span>Contact support</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </a>
            </div>
          </div>

        </div>

      </div>

      {/* 3. FOOTER BAR */}
      <footer className="h-12 bg-white border-t border-slate-200/80 px-6 sm:px-10 flex items-center justify-between text-xs text-slate-400">
        <span>© 2026 Virtual CFO. All rights reserved.</span>

        <div className="flex items-center gap-4">
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-600 transition">Privacy Policy</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-600 transition">Terms of Service</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-slate-600 transition">Support</a>
        </div>
      </footer>

    </div>
  );
}
