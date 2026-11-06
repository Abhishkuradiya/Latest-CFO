"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  Briefcase, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Check, 
  TrendingUp, 
  ShieldCheck, 
  PieChart,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { BrandLogo } from '@/components/brand-logo';

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [invitationInfo, setInvitationInfo] = useState<any>(null);
  const [invitationError, setInvitationError] = useState('');
  const [validatingToken, setValidatingToken] = useState(false);
  const [isAlreadyAccepted, setIsAlreadyAccepted] = useState(false);

  // Validate token if present
  useEffect(() => {
    if (!token) return;
    const checkToken = async () => {
      setValidatingToken(true);
      try {
        const res = await fetch(`/api/auth/invitation-info?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setInvitationInfo(data.invitation);
          setEmail(data.invitation.email || '');
          setCompanyName(data.invitation.organizationName || '');
          if (data.isAlreadyAccepted) {
            setIsAlreadyAccepted(true);
            try {
              const meRes = await fetch('/api/auth/me');
              const meData = await meRes.json();
              if (meRes.ok && meData.success) {
                if (meData.user.isOnboarded) {
                  window.location.href = '/overview';
                } else {
                  window.location.href = '/onboarding';
                }
                return;
              }
            } catch (e) {}
          }
        } else {
          setInvitationError(data.message || 'Invalid or expired invitation link');
        }
      } catch (err) {
        setInvitationError('Failed to verify invitation details.');
      } finally {
        setValidatingToken(false);
      }
    };
    checkToken();
  }, [token]);

  // Password validation
  const hasMinLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasUppercase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !companyName.trim()) {
      toast.error('All fields are required.');
      return;
    }

    if (!isPasswordValid) {
      toast.error('Please meet all password requirements before registering.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, companyName, token: token || undefined }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Account registered successfully for ${data.user.companyName}!`);
        
        login('session_token', {
          id: String(data.user.id),
          name: invitationInfo?.firstName || data.user.email.split('@')[0],
          email: data.user.email,
          role: invitationInfo?.role || 'owner',
          permissions: ['*']
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('cfo_user_details', JSON.stringify({
            email: data.user.email,
            companyName: data.user.companyName,
            firstName: invitationInfo?.firstName || '',
            role: invitationInfo?.role || ''
          }));
        }
        
        window.location.href = '/onboarding';
      } else {
        toast.error(data.message || 'Registration failed. Email might already be taken.');
      }
    } catch (err) {
      toast.error('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  if (isAlreadyAccepted) {
    return (
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 flex flex-col justify-between min-h-[580px]">
        <div>
          <div className="text-center flex flex-col items-center mb-6">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Invitation Already Accepted
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Account for <strong>{invitationInfo?.organizationName || 'your organization'}</strong> is already registered.
            </p>
          </div>

          <div className="space-y-6 text-center py-6">
            <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200 shadow-sm">
              <UserCheck className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                Sign in with your email address to continue your Virtual CFO Onboarding.
              </p>
            </div>
            <button
              onClick={() => window.location.href = `/login?email=${encodeURIComponent(invitationInfo?.email || email)}&next=/onboarding`}
              className="w-full py-3.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              Sign In to Continue Onboarding <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="text-center border-t border-slate-100 pt-5 mt-6">
          <p className="text-xs text-slate-500 font-medium">
            Need help? <Link href="/login" className="text-blue-600 font-bold hover:underline">Go to Sign In</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 flex flex-col justify-between min-h-[580px]">
      <div>
        <div className="text-center flex flex-col items-center mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {token ? 'Accept Invitation' : 'Create Your Account'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {token 
              ? (invitationInfo ? `You have been invited by ${invitationInfo.invitedBy}` : 'Complete your registration using your invitation token')
              : 'Get your own secure tenant financial cockpit'}
          </p>
        </div>

        {validatingToken && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            Verifying invitation details...
          </div>
        )}

        {invitationInfo && (
          <div className="mb-6 p-3.5 bg-blue-50/90 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-slate-700">Joining <strong className="text-slate-900 font-bold">{invitationInfo.organizationName}</strong></span>
            </div>
            <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold uppercase tracking-wider">
              {invitationInfo.role}
            </span>
          </div>
        )}

        {invitationError && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{invitationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Company / Workspace Name</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400"><Briefcase className="h-4 w-4" /></span>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading || !!invitationInfo?.organizationName}
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 bg-slate-50/50 hover:bg-slate-50 transition font-medium disabled:bg-slate-100/90 disabled:text-slate-800 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Email Address</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400"><Mail className="h-4 w-4" /></span>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!invitationInfo?.email}
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 bg-slate-50/50 hover:bg-slate-50 transition font-medium disabled:bg-slate-100/90 disabled:text-slate-800 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Set Password</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400"><Lock className="h-4 w-4" /></span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-10 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 bg-slate-50/50 hover:bg-slate-50 transition font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pt-1">
              <span className={`flex items-center gap-1 transition ${hasMinLength ? 'text-emerald-600 font-bold' : ''}`}>
                <Check className={`h-3.5 w-3.5 ${hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} /> 6+ chars
              </span>
              <span className={`flex items-center gap-1 transition ${hasNumber ? 'text-emerald-600 font-bold' : ''}`}>
                <Check className={`h-3.5 w-3.5 ${hasNumber ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} /> One number
              </span>
              <span className={`flex items-center gap-1 transition ${hasUppercase ? 'text-emerald-600 font-bold' : ''}`}>
                <Check className={`h-3.5 w-3.5 ${hasUppercase ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} /> One uppercase
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="w-full py-3.5 bg-[#1d4ed8] hover:bg-[#1e40af] active:bg-blue-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                {token ? 'Accept Invitation & Continue' : 'Get Started'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-center mt-6 border-t border-slate-100 pt-5">
        <p className="text-xs text-slate-500 font-medium">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-bold hover:underline">
            Sign In
          </Link>
        </p>

        <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
          © 2026 Virtual CFO. All rights reserved.<br />
          Designed by{' '}
          <a 
            href="https://exuberantglobal.co.uk" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-500 hover:text-blue-600 font-semibold transition hover:underline"
          >
            exuberantglobal.co.uk
          </a>{' '}
          | Developed by{' '}
          <span className="relative group inline-block">
            <span className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer border-b border-dashed border-blue-400 hover:border-blue-700 transition pb-0.5">
              Rajan Goswami
            </span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-72 p-4 bg-slate-900/98 text-white rounded-2xl shadow-2xl border border-slate-800 backdrop-blur-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-350 ease-out z-50 flex flex-col text-left font-normal normal-case tracking-normal">
              <span className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2.5">
                <span className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/20">
                  RG
                </span>
                <span className="flex flex-col">
                  <span className="font-bold text-sm text-slate-100">Rajan Goswami</span>
                  <span className="text-[9px] text-blue-400 font-bold tracking-wider uppercase">Senior Full Stack Developer</span>
                </span>
              </span>
              <span className="text-xs text-slate-300 leading-relaxed font-light">
                Specializing in high-performance enterprise dashboards, finance integrations, and state-of-the-art responsive UI/UX designs.
              </span>
              <span className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">📍 Noida, India</span>
                <span className="text-blue-400 font-bold">exuberantglobal.co.uk</span>
              </span>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-800 rotate-45"></span>
            </span>
          </span>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc] font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">
      
      {/* Left Pane: Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-[#091529] via-[#0E1E38] to-[#040A15] text-white overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
        
        <div className="relative z-10">
          <BrandLogo variant="dark" size="md" />
        </div>

        <div className="relative z-10 my-auto py-8">
          <div className="max-w-xl space-y-10">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Your Financial Data.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
                  Smarter Decisions.
                </span>
              </h1>
              <p className="text-slate-400 text-sm xl:text-base leading-relaxed font-light">
                Complete your registration to set up your Virtual CFO Profile, sync financial systems, and access customized corporate financial insights.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4 items-start group">
                <span className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Real-time Insights</h4>
                  <p className="text-xs text-slate-400 font-light mt-0.5 leading-relaxed">
                    Get up-to-date financial data and key performance metrics (KPIs) at your fingertips instantly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start group">
                <span className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Secure & Reliable</h4>
                  <p className="text-xs text-slate-400 font-light mt-0.5 leading-relaxed">
                    Enterprise-grade bank-level security and automated backups keep your organization's data safe.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start group">
                <span className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <PieChart className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Powerful Analytics</h4>
                  <p className="text-xs text-slate-400 font-light mt-0.5 leading-relaxed">
                    Visualize, analyze, model scenarios, and grow your business with automated reporting you can trust.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Right Pane: Register Form wrapped in Suspense */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-radial from-[#f1f5f9] via-[#f8fafc] to-[#e2e8f0]">
        <Suspense fallback={<div className="p-8 bg-white rounded-3xl text-center text-xs font-bold text-slate-500">Loading registration form...</div>}>
          <RegisterFormContent />
        </Suspense>
      </div>

    </div>
  );
}
