"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Cpu, 
  ShieldCheck, 
  Layers, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Shield,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both admin email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.requires2FA) {
          toast.success('Credentials verified! Enter Google 2FA verification code.');
          window.location.href = '/admin/setup-2fa';
        } else {
          toast.success('Welcome back, Super Admin!');
          window.location.href = data.redirectTo || '/admin/dashboard';
        }
      } else {
        toast.error(data.message || 'Super Admin authentication failed.');
      }
    } catch (err) {
      toast.error('An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc] font-sans overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* LEFT PANE: Premium Light-Blue Gradient Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#eef5ff] via-[#f3f7fe] to-[#e6efff] text-slate-900 overflow-hidden border-r border-slate-200/60">
        
        {/* Soft Decorative Ambient Circles */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-blue-400/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 rounded-full bg-indigo-400/10 blur-[120px] pointer-events-none" />

        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-end gap-1 h-9">
            <span className="w-2 h-5 bg-blue-600 rounded-sm"></span>
            <span className="w-2 h-7 bg-blue-500 rounded-sm"></span>
            <span className="w-2 h-9 bg-blue-400 rounded-sm"></span>
          </div>
          <div>
            <h2 className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">Virtual CFO</h2>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider mt-0.5">Insights Today. A Stronger Tomorrow.</p>
          </div>
        </div>

        {/* Hero Marketing Copy & Features */}
        <div className="relative z-10 my-auto py-6 space-y-6 max-w-xl">
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-snug">
              Turn Your Financial Data Into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
                Smarter Decisions
              </span>
            </h1>
            <p className="text-slate-600 text-sm xl:text-base leading-relaxed font-normal">
              Connect. Analyze. Get AI-Powered Insights. Your Always-On CFO, for Sustainable Growth.
            </p>
          </div>

          {/* 4 Feature Badges Grid */}
          <div className="grid grid-cols-4 gap-3 py-2">
            
            <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center space-y-2 shadow-sm">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Real-Time Analytics</span>
            </div>

            <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center space-y-2 shadow-sm">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">AI-Driven Insights</span>
            </div>

            <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center space-y-2 shadow-sm">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Secure & Reliable</span>
            </div>

            <div className="bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-2xl p-3 flex flex-col items-center text-center space-y-2 shadow-sm">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Multi-Platform Support</span>
            </div>

          </div>

          {/* Floating Live Dashboard Showcase Card */}
          <div className="relative mt-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xl shadow-blue-900/5 space-y-3">
              
              {/* Header inside showcase */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Good morning, Admin 👋
                  </h4>
                  <p className="text-[10px] text-slate-400">Here's what's happening with your business today.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-slate-500">Live</span>
                </div>
              </div>

              {/* 3 Metric cards row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-semibold text-slate-500">Total Revenue</span>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">£3,998,930</div>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded flex items-center gap-0.5 w-fit mt-1">
                    <ArrowUpRight className="h-2 w-2" /> +55.9%
                  </span>
                </div>

                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-semibold text-slate-500">Net Profit</span>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">-£7,740</div>
                  <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded flex items-center gap-0.5 w-fit mt-1">
                    <ArrowDownRight className="h-2 w-2" /> -87.1%
                  </span>
                </div>

                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-semibold text-slate-500">Total Cash</span>
                  <div className="text-sm font-extrabold text-slate-900 mt-0.5">£144,417</div>
                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded flex items-center gap-0.5 w-fit mt-1">
                    <ArrowUpRight className="h-2 w-2" /> +83.7%
                  </span>
                </div>
              </div>

              {/* Revenue Trend Wave */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                  <span className="font-bold text-slate-600">Revenue Trend</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span> Current Year</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Previous Year</span>
                  </div>
                </div>
                <svg className="w-full h-9 overflow-visible" viewBox="0 0 200 40" preserveAspectRatio="none">
                  <path d="M 0,30 Q 50,10 100,22 T 200,5" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 0,35 Q 50,25 100,30 T 200,15" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="3,3" strokeLinecap="round" />
                </svg>
              </div>

            </div>

            {/* Overlapping AI Insight Floating Card */}
            <div className="absolute -bottom-5 -right-3 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 shadow-xl max-w-[240px] space-y-1 text-left z-20">
              <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-bold">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                AI Insight
              </div>
              <p className="text-[9.5px] text-slate-600 leading-tight">
                Revenue increased by <strong className="text-slate-900">55.9%</strong> compared to previous period, driven by higher sales in core product categories.
              </p>
            </div>

          </div>

        </div>

        {/* Left Bottom Quote */}
        <div className="relative z-10 pt-4 border-t border-slate-200/60">
          <p className="text-xs text-slate-500 italic font-medium">
            “Good financial decisions today create extraordinary opportunities tomorrow.”
          </p>
        </div>

      </div>

      {/* RIGHT PANE: Clean Enterprise Admin Login Card */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 relative bg-radial from-[#ffffff] via-[#f8fafc] to-[#f1f5f9]">
        
        {/* Center Main Login Card Container */}
        <div className="w-full max-w-md mx-auto my-auto py-6 space-y-6">
          
          {/* Card Header Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Sign in to your Virtual CFO admin account
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            
            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400"><Mail className="h-4.5 w-4.5" /></span>
                <input
                  type="email"
                  placeholder="admin@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder-slate-400 transition shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400"><Lock className="h-4.5 w-4.5" /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder-slate-400 transition shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Actions: Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                />
                <span className="text-xs font-medium text-slate-600">Remember me</span>
              </label>

              <Link href="#" onClick={(e) => { e.preventDefault(); toast.info("Password reset request sent to super admin."); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-4">
            <p className="text-[11px] text-slate-400 font-medium">
              Only authorized personnel can access this system.
            </p>
          </div>

        </div>

        {/* Footer Security Seal */}
        <div className="text-center pt-6">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Shield className="h-4 w-4 text-slate-400" />
            <span>Protected by enterprise-grade security • Data • Privacy • Trust</span>
          </div>
        </div>

      </div>

    </div>
  );
}
