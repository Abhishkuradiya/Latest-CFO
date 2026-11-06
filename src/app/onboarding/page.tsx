"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  User, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Brain, 
  Rocket, 
  CheckCircle, 
  Globe, 
  Layers, 
  Shield, 
  Target, 
  Zap, 
  Sliders, 
  PieChart, 
  BarChart3, 
  FileText,
  ChevronRight,
  Sparkle,
  BadgeCheck,
  CreditCard,
  Building,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/brand-logo';

export default function RedesignedCanvaOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisText, setAnalysisText] = useState('Analyzing Business Model & Monetization Structure...');
  const [isCompleted, setIsCompleted] = useState(false);

  // Step 1 — Personal Information
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('Founder / Owner');
  const [decisionRole, setDecisionRole] = useState('I make most financial decisions');

  // Step 2 — Business Details
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Private Limited');
  const [industry, setIndustry] = useState('SaaS');
  const [customIndustry, setCustomIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');

  // Step 3 — Business Size
  const [employeesRange, setEmployeesRange] = useState('21–50');
  const [customersRange, setCustomersRange] = useState('51–200');
  const [annualRevenueRange, setAnnualRevenueRange] = useState('₹1Cr – ₹5Cr');
  const [currency, setCurrency] = useState('INR');
  const [legalEntities, setLegalEntities] = useState('1');

  // Step 4 — Money Flow & Business Model
  const [monetizationModels, setMonetizationModels] = useState<string[]>(['Subscription', 'Product Sales']);
  const [salesChannels, setSalesChannels] = useState<string[]>(['Website', 'Direct / B2B']);
  const [revenueModel, setRevenueModel] = useState('Recurring Revenue');
  const [paymentTerms, setPaymentTerms] = useState('30 days');

  // Step 5 — Accounting Setup
  const [fiscalYear, setFiscalYear] = useState('April – March');
  const [accountingBasis, setAccountingBasis] = useState('Accrual');
  const [accountingPlatform, setAccountingPlatform] = useState('Xero');
  const [bankReconciliation, setBankReconciliation] = useState('Weekly');

  // Step 6 — CFO Help & Priorities
  const [cfoPriorities, setCfoPriorities] = useState<string[]>([
    'Manage Cash Flow',
    'Improve Profitability',
    'Manage Accounts Receivable',
    'Monitor Revenue'
  ]);
  const [biggestChallenge, setBiggestChallenge] = useState('Cash Flow');
  const [improvementGoal, setImprovementGoal] = useState('Increase Profit Margin');
  const [customCfoNotes, setCustomCfoNotes] = useState('');

  // Fetch initial user details and saved DB draft
  useEffect(() => {
    const initData = async () => {
      let emailToFetch = '';
      try {
        const savedUser = localStorage.getItem('cfo_user_details') || localStorage.getItem('cfo_user_info');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.email) {
            setWorkEmail(parsed.email);
            emailToFetch = parsed.email;
          }
          if (parsed.firstName || parsed.name) setFullName(parsed.firstName || parsed.name);
          if (parsed.companyName) setBusinessName(parsed.companyName);
          if (parsed.role) setJobTitle(parsed.role);
        }
      } catch (e) {}

      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          if (!workEmail && data.user.email) {
            setWorkEmail(data.user.email);
            emailToFetch = data.user.email;
          }
          if (!businessName && data.user.companyName) {
            setBusinessName(data.user.companyName);
          }
        }
      } catch (e) {}

      if (emailToFetch) {
        try {
          const draftRes = await fetch(`/api/onboarding/draft?email=${encodeURIComponent(emailToFetch)}`);
          const draftData = await draftRes.json();
          if (draftRes.ok && draftData.success && draftData.draft) {
            const d = draftData.draft;
            if (d.fullName) setFullName(d.fullName);
            if (d.jobTitle) setJobTitle(d.jobTitle);
            if (d.financialDecisionRole) setDecisionRole(d.financialDecisionRole);
            if (d.businessName) setBusinessName(d.businessName);
            if (d.businessType) setBusinessType(d.businessType);
            if (d.industry) setIndustry(d.industry);
            if (d.businessDescription) setBusinessDescription(d.businessDescription);
            if (d.employeesRange) setEmployeesRange(d.employeesRange);
            if (d.annualRevenueRange) setAnnualRevenueRange(d.annualRevenueRange);
            if (d.monetizationModels && d.monetizationModels.length > 0) setMonetizationModels(d.monetizationModels);
            if (d.cfoHelpPriorities && d.cfoHelpPriorities.length > 0) setCfoPriorities(d.cfoHelpPriorities);
            if (d.currentStep) setCurrentStep(d.currentStep);
            return;
          }
        } catch (e) {}
      }

      try {
        const savedState = localStorage.getItem('cfo_onboarding_draft');
        if (savedState) {
          const d = JSON.parse(savedState);
          if (d.fullName) setFullName(d.fullName);
          if (d.workEmail && !workEmail) setWorkEmail(d.workEmail);
          if (d.jobTitle) setJobTitle(d.jobTitle);
          if (d.decisionRole) setDecisionRole(d.decisionRole);
          if (d.businessName) setBusinessName(d.businessName);
          if (d.businessType) setBusinessType(d.businessType);
          if (d.industry) setIndustry(d.industry);
          if (d.employeesRange) setEmployeesRange(d.employeesRange);
          if (d.monetizationModels) setMonetizationModels(d.monetizationModels);
          if (d.cfoPriorities) setCfoPriorities(d.cfoPriorities);
          if (d.currentStep) setCurrentStep(d.currentStep);
        }
      } catch (e) {}
    };

    initData();
  }, []);

  const saveProgressState = async (step: number) => {
    const payload = {
      workEmail,
      fullName,
      jobTitle,
      financialDecisionRole: decisionRole,
      businessName,
      businessType,
      industry: industry === 'Other' ? customIndustry : industry,
      businessDescription,
      employeesRange,
      customersRange,
      annualRevenueRange,
      currency,
      legalEntitiesCount: legalEntities,
      monetizationModels,
      salesChannels,
      revenueModel,
      paymentTerms,
      fiscalYear,
      accountingBasis,
      primaryAccountingPlatform: accountingPlatform,
      bankReconciliationFrequency: bankReconciliation,
      cfoHelpPriorities: cfoPriorities,
      biggestFinancialChallenge: biggestChallenge,
      improvementGoals12m: improvementGoal,
      customCfoNotes,
      currentStep: step
    };

    try {
      localStorage.setItem('cfo_onboarding_draft', JSON.stringify(payload));
    } catch (e) {}

    if (workEmail) {
      try {
        await fetch('/api/onboarding/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {}
    }
  };

  const toggleArrayItem = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1 && (!fullName.trim() || !workEmail.trim())) {
      toast.error('Please enter your full name and work email address.');
      return;
    }
    if (currentStep === 2 && !businessName.trim()) {
      toast.error('Please enter your business name.');
      return;
    }
    if (currentStep < 7) {
      const next = currentStep + 1;
      setCurrentStep(next);
      await saveProgressState(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = async () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      await saveProgressState(prev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(20);
    setAnalysisText('Analyzing Business Model & Monetization Structure...');

    setTimeout(() => {
      setAnalysisProgress(55);
      setAnalysisText('Synthesizing CFO Priorities & Optimization Rules...');
    }, 1200);

    setTimeout(() => {
      setAnalysisProgress(88);
      setAnalysisText('Generating Virtual CFO Profile & Notifications...');
    }, 2400);

    const payload = {
      fullName,
      workEmail,
      jobTitle,
      financialDecisionRole: decisionRole,
      businessName,
      businessType,
      industry: industry === 'Other' ? customIndustry : industry,
      businessDescription,
      employeesRange,
      customersRange,
      annualRevenueRange,
      currency,
      legalEntitiesCount: legalEntities,
      monetizationModels,
      salesChannels,
      revenueModel,
      paymentTerms,
      fiscalYear,
      accountingBasis,
      primaryAccountingPlatform: accountingPlatform,
      bankReconciliationFrequency: bankReconciliation,
      cfoHelpPriorities: cfoPriorities,
      biggestFinancialChallenge: biggestChallenge,
      improvementGoals12m: improvementGoal,
      customCfoNotes
    };

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setTimeout(() => {
        setAnalysisProgress(100);
        setIsAnalyzing(false);
        if (res.ok && data.success) {
          setIsCompleted(true);
          try {
            localStorage.removeItem('cfo_onboarding_draft');
          } catch (e) {}
          toast.success('Your Virtual CFO Profile has been created successfully!');
        } else {
          toast.error(data.message || 'Failed to save business profile.');
        }
      }, 3400);
    } catch (e) {
      setTimeout(() => {
        setIsAnalyzing(false);
        toast.error('An error occurred while saving your onboarding setup.');
      }, 3400);
    }
  };

  const stepsList = [
    { num: 1, title: 'You', tag: 'Personal Profile' },
    { num: 2, title: 'Business', tag: 'Company Setup' },
    { num: 3, title: 'Scale', tag: 'Team & Revenue' },
    { num: 4, title: 'Cashflow', tag: 'Monetization' },
    { num: 5, title: 'Accounting', tag: 'Xero & Ledger' },
    { num: 6, title: 'Priorities', tag: 'CFO Focus' },
    { num: 7, title: 'Profile', tag: 'Review & Launch' }
  ];

  // Role Selection Cards Data
  const roleCards = [
    { title: 'Founder / Owner', subtitle: 'Strategic oversight & full financial control', icon: User, color: 'from-blue-500 to-indigo-600' },
    { title: 'CEO / Executive', subtitle: 'Corporate scaling & executive strategy', icon: Rocket, color: 'from-indigo-500 to-purple-600' },
    { title: 'CFO / Finance Director', subtitle: 'Direct cash management & forecasting', icon: DollarSign, color: 'from-emerald-500 to-teal-600' },
    { title: 'Finance Manager / Accountant', subtitle: 'Financial operations & bookkeeping', icon: BarChart3, color: 'from-sky-500 to-blue-600' },
  ];

  // Entity Types
  const businessTypes = [
    { name: 'Private Limited', desc: 'Pvt. Ltd. / Inc. Corporate Entity', icon: Building2 },
    { name: 'Sole Proprietorship', desc: 'Single-owner business setup', icon: User },
    { name: 'LLP / Partnership', desc: 'Partnership or Limited Liability', icon: Layers },
    { name: 'Public Limited', desc: 'Public / Stock-listed company', icon: Globe },
  ];

  // Industries
  const industryCards = [
    { name: 'SaaS / Software', icon: '💻' },
    { name: 'Technology', icon: '⚡' },
    { name: 'E-commerce', icon: '🛒' },
    { name: 'Retail', icon: '🏬' },
    { name: 'Manufacturing', icon: '🏭' },
    { name: 'Healthcare', icon: '🩺' },
    { name: 'Professional Services', icon: '💼' },
    { name: 'Consulting', icon: '📊' },
    { name: 'Financial Services', icon: '🏦' },
    { name: 'Real Estate', icon: '🏢' },
    { name: 'Other', icon: '✨' }
  ];

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-xl bg-white border border-slate-200/90 rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/60 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Onboarding Completed!</h1>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">
              We have generated your custom Virtual CFO Intelligence Profile for <strong>{businessName}</strong>.
            </p>
          </div>

          <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-slate-700 space-y-2 text-left">
            <div className="flex items-center gap-2 text-blue-700 font-bold">
              <Mail className="h-4 w-4 text-blue-600" /> Account Activation Pending
            </div>
            <p className="text-slate-600 leading-relaxed">
              A confirmation email has been dispatched to <strong>{workEmail}</strong>. Our system will review your financial setup and activate full access within a few hours.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.href = '/overview'}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-600/25 transition cursor-pointer flex items-center justify-center gap-2"
            >
              Go to Financial Cockpit <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col justify-between relative overflow-x-hidden">
      
      {/* Soft Ambient Background Light Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[350px] bg-blue-400/10 blur-[130px] rounded-full" />
        <div className="absolute top-[-5%] right-[20%] w-[450px] h-[300px] bg-indigo-400/10 blur-[120px] rounded-full" />
      </div>

      {/* AI CFO Radar Loader Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="h-24 w-24 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shadow-md">
              <Brain className="h-12 w-12 text-blue-600 animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-full border-3 border-t-blue-600 border-r-transparent border-b-indigo-600 border-l-transparent animate-spin" />
          </div>

          <div className="max-w-md space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Building Your Virtual CFO Profile</h2>
            <p className="text-xs text-blue-600 font-bold tracking-wide animate-pulse">{analysisText}</p>
            
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-700 ease-out shadow-xs"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-bold">{analysisProgress}% Complete</span>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="relative z-20 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 sm:px-10 py-4 shadow-xs sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <BrandLogo variant="light" size="md" />

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-extrabold">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Step {currentStep} of 6</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200">
              <Clock className="h-3.5 w-3.5 text-blue-600" /> ~5 min setup
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-8 my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        
        {/* LEFT COLUMN: REAL-TIME CFO PROFILE PREVIEW CARD & PROGRESS */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          
          {/* Progress Card */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xl shadow-slate-200/40 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Virtual CFO Wizard</span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">Setup Progress</h3>
              </div>
              <span className="h-9 w-9 rounded-2xl bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center border border-blue-200">
                {Math.round(((currentStep - 1) / 6) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(8, ((currentStep - 1) / 6) * 100)}%` }}
              />
            </div>

            {/* Step Checklist List */}
            <div className="space-y-2.5 pt-1">
              {stepsList.map((st) => {
                const isPast = st.num < currentStep;
                const isCurrent = st.num === currentStep;
                return (
                  <div
                    key={st.num}
                    onClick={() => { if (isPast) setCurrentStep(st.num); }}
                    className={`flex items-center justify-between p-2.5 rounded-2xl text-xs transition select-none ${
                      isCurrent 
                        ? 'bg-blue-50 border border-blue-200 font-extrabold text-blue-900 shadow-2xs' 
                        : isPast 
                        ? 'bg-slate-50 border border-slate-200/60 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100' 
                        : 'text-slate-400 font-medium opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-6 w-6 rounded-full text-[10px] font-black flex items-center justify-center ${
                        isPast ? 'bg-blue-600 text-white' : isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isPast ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : st.num}
                      </span>
                      <span>{st.title}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{st.tag}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Dynamic CFO Preview Card */}
          <div className="bg-gradient-to-br from-[#091529] via-[#0E1E38] to-[#040A15] border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-black tracking-wide text-slate-200">Live Profile Preview</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                {businessType}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Organization</span>
                <h4 className="text-base font-extrabold text-white tracking-tight leading-tight mt-0.5">
                  {businessName || 'Your Business Name'}
                </h4>
                <p className="text-[11px] text-blue-400 font-semibold mt-0.5">
                  {industry} • {employeesRange} employees
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Selected Priorities ({cfoPriorities.length})</span>
                <div className="flex flex-wrap gap-1.5">
                  {cfoPriorities.slice(0, 3).map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-slate-800/90 text-slate-300 rounded-lg text-[10px] font-medium border border-slate-700">
                      ✦ {p}
                    </span>
                  ))}
                  {cfoPriorities.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-800/90 text-blue-400 rounded-lg text-[10px] font-bold">
                      +{cfoPriorities.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CANVA-STYLE INTERACTIVE STAGE */}
        <div className="lg:col-span-8">
          
          <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-10 shadow-2xl shadow-slate-200/50 space-y-8 min-h-[580px] flex flex-col justify-between">
            
            {/* STEP 1: Personal Profile */}
            {currentStep === 1 && (
              <div key="step1" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 1 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    Tell us about yourself
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Help Virtual CFO personalize strategic insights and reporting hierarchy for your exact role.
                  </p>
                </div>

                <div className="space-y-5">
                  {/* Inputs Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Rajan Goswami"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Work Email *</label>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Canva Role Selection Cards */}
                  <div className="space-y-2.5 pt-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Select your Role in the Organization</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {roleCards.map((rc) => {
                        const IconComp = rc.icon;
                        const isSelected = jobTitle === rc.title;
                        return (
                          <div
                            key={rc.title}
                            onClick={() => setJobTitle(rc.title)}
                            className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex items-start gap-3 select-none ${
                              isSelected 
                                ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-md scale-[1.01]' 
                                : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl text-white bg-gradient-to-tr ${rc.color} shadow-sm flex-shrink-0`}>
                              <IconComp className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-extrabold text-slate-900">{rc.title}</h4>
                              <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">{rc.subtitle}</p>
                            </div>
                            {isSelected && <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Decision Role */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Financial Decision Responsibility</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        'I make most financial decisions',
                        'I make decisions with a finance team',
                        'I manage financial operations',
                        'I mainly review financial reports'
                      ].map((dr) => {
                        const selected = decisionRole === dr;
                        return (
                          <button
                            key={dr}
                            type="button"
                            onClick={() => setDecisionRole(dr)}
                            className={`p-3.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer text-left flex items-center justify-between ${
                              selected 
                                ? 'bg-[#2563eb] text-white shadow-md' 
                                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{dr}</span>
                            {selected && <Check className="h-4 w-4 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* STEP 2: Business Setup */}
            {currentStep === 2 && (
              <div key="step2" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 2 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    Tell us about your business
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Configure benchmarks tailored specifically to your industry model.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Business / Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Technologies Pvt. Ltd."
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      required
                    />
                  </div>

                  {/* Business Type Cards */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Corporate Entity Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {businessTypes.map((bt) => {
                        const IconComponent = bt.icon;
                        const selected = businessType === bt.name;
                        return (
                          <div
                            key={bt.name}
                            onClick={() => setBusinessType(bt.name)}
                            className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center text-center gap-2 select-none ${
                              selected 
                                ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-md scale-[1.02]' 
                                : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl ${selected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-900">{bt.name}</h5>
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{bt.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Industry Cards Grid */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Industry Focus</label>
                    <div className="flex flex-wrap gap-2.5">
                      {industryCards.map((ind) => {
                        const selected = industry === ind.name || (ind.name === 'SaaS / Software' && industry === 'SaaS');
                        return (
                          <button
                            key={ind.name}
                            type="button"
                            onClick={() => setIndustry(ind.name === 'SaaS / Software' ? 'SaaS' : ind.name)}
                            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                              selected
                                ? 'bg-[#2563eb] text-white shadow-md'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span>{ind.icon}</span>
                            <span>{ind.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {industry === 'Other' && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Custom Industry</label>
                      <input
                        type="text"
                        placeholder="e.g. Clean Energy Tech"
                        value={customIndustry}
                        onChange={(e) => setCustomIndustry(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">What does your business do?</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. We provide B2B software for small businesses with monthly recurring subscriptions."
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Scale & Team */}
            {currentStep === 3 && (
              <div key="step3" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 3 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    Understand your business scale
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Approximate ranges calibrate risk alerts and operating expense baselines.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Employees */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Team Size (Employees)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {['1–5', '6–20', '21–50', '51–100', '101–500', '500+'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setEmployeesRange(val)}
                          className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                            employeesRange === val 
                              ? 'bg-[#2563eb] text-white shadow-md border border-blue-600 scale-[1.02]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Annual Revenue */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Approximate Annual Revenue</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {['Under ₹10 Lakh', '₹10L – ₹50L', '₹50L – ₹1Cr', '₹1Cr – ₹5Cr', '₹5Cr – ₹25Cr', '₹25Cr – ₹100Cr', '₹100Cr+', 'Prefer not to say'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnnualRevenueRange(val)}
                          className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                            annualRevenueRange === val 
                              ? 'bg-[#2563eb] text-white shadow-md border border-blue-600 scale-[1.02]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency & Entities */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Primary Operating Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      >
                        <option value="INR">INR ₹ (Indian Rupee)</option>
                        <option value="USD">USD $ (US Dollar)</option>
                        <option value="GBP">GBP £ (British Pound)</option>
                        <option value="EUR">EUR € (Euro)</option>
                        <option value="AUD">AUD $ (Australian Dollar)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Number of Legal Entities</label>
                      <select
                        value={legalEntities}
                        onChange={(e) => setLegalEntities(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      >
                        <option value="1">1 Entity</option>
                        <option value="2–5">2–5 Entities</option>
                        <option value="6–10">6–10 Entities</option>
                        <option value="10+">10+ Entities</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Money Flow */}
            {currentStep === 4 && (
              <div key="step4" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 4 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    Understand how money flows
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Select all monetization models that bring revenue into your business.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Revenue Sources (Select all that apply)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {['Product Sales', 'Subscription', 'Professional Services', 'Consulting', 'Marketplace', 'Commission', 'Licensing', 'Manufacturing', 'Rental', 'Advertising'].map((m) => {
                        const selected = monetizationModels.includes(m);
                        return (
                          <div
                            key={m}
                            onClick={() => toggleArrayItem(monetizationModels, setMonetizationModels, m)}
                            className={`p-3.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-between text-left select-none ${
                              selected 
                                ? 'bg-blue-50 border-2 border-blue-600 text-blue-900 shadow-xs scale-[1.01]' 
                                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{m}</span>
                            {selected ? <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" /> : <div className="h-4 w-4 rounded-full border border-slate-300 flex-shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Primary Revenue Model</label>
                      <select
                        value={revenueModel}
                        onChange={(e) => setRevenueModel(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      >
                        <option value="Recurring Revenue">Recurring Revenue</option>
                        <option value="One-time Sales">One-time Sales</option>
                        <option value="Both Recurring & One-time">Both Recurring & One-time</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Typical Payment Terms</label>
                      <select
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                      >
                        <option value="Paid immediately">Paid immediately</option>
                        <option value="7 days">7 days</option>
                        <option value="15 days">15 days</option>
                        <option value="30 days">30 days</option>
                        <option value="45 days">45 days</option>
                        <option value="60+ days">60+ days</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Accounting Setup */}
            {currentStep === 5 && (
              <div key="step5" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 5 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    Accounting Setup
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Configure bookkeeping and general ledger sync parameters.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Financial Year</label>
                    <select
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                    >
                      <option value="April – March">April – March</option>
                      <option value="January – December">January – December</option>
                      <option value="July – June">July – June</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Accounting Basis</label>
                    <select
                      value={accountingBasis}
                      onChange={(e) => setAccountingBasis(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                    >
                      <option value="Accrual">Accrual</option>
                      <option value="Cash">Cash</option>
                      <option value="Not sure">Not sure</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Primary Accounting Platform</label>
                    <select
                      value={accountingPlatform}
                      onChange={(e) => setAccountingPlatform(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                    >
                      <option value="Xero">Xero ✓ (Connected)</option>
                      <option value="QuickBooks">QuickBooks</option>
                      <option value="Zoho Books">Zoho Books</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Bank Reconciliation Frequency</label>
                    <select
                      value={bankReconciliation}
                      onChange={(e) => setBankReconciliation(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Occasionally">Occasionally</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: CFO Priorities */}
            {currentStep === 6 && (
              <div key="step6" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                    Step 6 of 6
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                    What should Virtual CFO prioritize?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Select your primary financial focus areas for customized AI alerts.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      'Manage Cash Flow',
                      'Improve Profitability',
                      'Reduce Expenses',
                      'Monitor Revenue',
                      'Manage Accounts Receivable',
                      'Manage Accounts Payable',
                      'Forecast Cash Flow',
                      'Budget vs Actual',
                      'Monitor Business Risks',
                      'Tax Planning'
                    ].map((pr) => {
                      const selected = cfoPriorities.includes(pr);
                      return (
                        <div
                          key={pr}
                          onClick={() => toggleArrayItem(cfoPriorities, setCfoPriorities, pr)}
                          className={`p-4 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-between text-left select-none ${
                            selected 
                              ? 'bg-blue-50 border-2 border-blue-600 text-blue-950 shadow-md scale-[1.01]' 
                              : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Sparkles className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-slate-400'}`} />
                            {pr}
                          </span>
                          {selected && <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Free-form CFO Context</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. We are growing quickly but cash flow is becoming tight because customers pay after 60 days."
                      value={customCfoNotes}
                      onChange={(e) => setCustomCfoNotes(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: Profile Review & Launch */}
            {currentStep === 7 && (
              <div key="step7" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                    ✦
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">We've Built Your Virtual CFO Profile</h2>
                    <p className="text-xs text-slate-500 font-medium">Review your business setup before launching your financial cockpit.</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-5 text-xs text-slate-700 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{businessName || 'Your Business'}</h3>
                      <p className="text-xs text-blue-600 font-bold mt-0.5">{industry} • {employeesRange} employees</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                      {businessType}
                    </span>
                  </div>

                  <hr className="border-slate-200" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary CFO Focus</span>
                      <ul className="space-y-1 text-slate-800 font-semibold">
                        {cfoPriorities.slice(0, 4).map((p) => (
                          <li key={p} className="flex items-center gap-2">
                            <span className="text-blue-600 font-bold">💧</span> <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accounting Specs</span>
                      <p className="text-slate-800 font-medium">
                        <strong>Basis:</strong> {accountingBasis}<br />
                        <strong>Currency:</strong> {currency}<br />
                        <strong>Fiscal Year:</strong> {fiscalYear}<br />
                        <strong>Platform:</strong> {accountingPlatform}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">CFO Optimization Rules:</span>
                    <ul className="list-disc list-inside text-slate-600 text-[11px] font-medium space-y-0.5">
                      <li>Prioritize cash-flow and receivables risk alerts</li>
                      <li>Track recurring vs one-time revenue margins</li>
                      <li>Monitor operating expenses against benchmark limits</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200/90">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 transition flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : <div />}

              {currentStep < 7 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-7 py-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-600/25 transition flex items-center gap-2 cursor-pointer"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 transition cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    className="px-8 py-3.5 bg-[#2563eb] hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-blue-600/25 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Rocket className="h-4 w-4" /> Complete Setup & Launch
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full bg-white border-t border-slate-200/80 px-6 py-4 text-center text-xs text-slate-500 font-medium">
        © 2026 Virtual CFO. All rights reserved. • Financial Intelligence Platform
      </footer>

    </div>
  );
}
