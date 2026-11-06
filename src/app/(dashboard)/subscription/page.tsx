"use client";

import React, { useState } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Calendar, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  ArrowRight,
  ChevronRight,
  Building2,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

export default function UserSubscriptionPage() {
  const [billingCycle, setBillingCycle] = useState<'1' | '3' | '6' | '12'>('12');
  const [currentPlan, setCurrentPlan] = useState('Professional');
  const [loading, setLoading] = useState(false);

  // Discount multiplier per billing cycle
  const getCycleMultiplier = () => {
    if (billingCycle === '3') return 3 * 0.95; // 5% discount
    if (billingCycle === '6') return 6 * 0.90; // 10% discount
    if (billingCycle === '12') return 12 * 0.80; // 20% discount
    return 1;
  };

  const getCycleLabel = () => {
    if (billingCycle === '3') return '/ 3 Months (5% OFF)';
    if (billingCycle === '6') return '/ 6 Months (10% OFF)';
    if (billingCycle === '12') return '/ Year (20% OFF)';
    return '/ Month';
  };

  const calculatePrice = (baseMonthlyRate: number) => {
    const total = Math.round(baseMonthlyRate * getCycleMultiplier());
    return `₹${total.toLocaleString('en-IN')}`;
  };

  const handleUpgrade = (planName: string) => {
    setLoading(true);
    setTimeout(() => {
      setCurrentPlan(planName);
      setLoading(false);
      toast.success(`Successfully subscribed to ${planName} Plan (${billingCycle === '1' ? '1 Month' : billingCycle === '3' ? '3 Months' : billingCycle === '6' ? '6 Months' : '12 Months'})!`);
    }, 600);
  };

  return (
    <div className="space-y-8 select-none max-w-6xl mx-auto py-4 pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-slate-900 via-[#0B1329] to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl text-white shadow-xl">
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-blue-400" /> SaaS Subscription Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Manage Subscription Plan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl font-medium">
            View your active organization plan, billing validity days remaining, and upgrade options.
          </p>
        </div>

        {/* Active Plan Badge Box */}
        <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-1 self-start sm:self-auto min-w-[220px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Plan</span>
          <h3 className="text-lg font-black text-blue-400 flex items-center justify-between">
            <span>{currentPlan} Plan</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Active</span>
          </h3>
          <p className="text-[11px] text-slate-300 font-semibold pt-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-blue-400" /> 285 Days Remaining
          </p>
          <p className="text-[10px] text-slate-400">Renews on 05 Jun 2027</p>
        </div>
      </div>

      {/* Billing Cycle Selector */}
      <div className="flex flex-col items-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Choose Billing Cycle</span>

        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold text-slate-600 shadow-inner">
          <button
            onClick={() => setBillingCycle('1')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${billingCycle === '1' ? 'bg-blue-600 text-white shadow-md' : 'hover:text-slate-900'}`}
          >
            1 Month
          </button>
          <button
            onClick={() => setBillingCycle('3')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer relative ${billingCycle === '3' ? 'bg-blue-600 text-white shadow-md' : 'hover:text-slate-900'}`}
          >
            3 Months
            <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-extrabold">5% OFF</span>
          </button>
          <button
            onClick={() => setBillingCycle('6')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer relative ${billingCycle === '6' ? 'bg-blue-600 text-white shadow-md' : 'hover:text-slate-900'}`}
          >
            6 Months
            <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-extrabold">10% OFF</span>
          </button>
          <button
            onClick={() => setBillingCycle('12')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer relative ${billingCycle === '12' ? 'bg-blue-600 text-white shadow-md' : 'hover:text-slate-900'}`}
          >
            12 Months (Annual)
            <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-extrabold">20% OFF</span>
          </button>
        </div>
      </div>

      {/* 3 Subscription Plan Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Plan 1: Starter */}
        <div className={`bg-white border rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between transition ${currentPlan === 'Starter' ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xl' : 'border-slate-200/80 shadow-xs hover:border-slate-300'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Starter</span>
              {currentPlan === 'Starter' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Current Plan</span>}
            </div>

            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {calculatePrice(9990)} <span className="text-xs font-semibold text-slate-400">{getCycleLabel()}</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Essential Virtual CFO platform features for small accounting teams.
            </p>

            <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Single ERP Connector (Xero/QB/Zoho)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>P&L, Balance Sheet & Cash Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Up to 3 User Seats</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Standard Email Support</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleUpgrade('Starter')}
            disabled={loading || currentPlan === 'Starter'}
            className={`w-full py-3 rounded-xl text-xs font-bold transition cursor-pointer ${currentPlan === 'Starter' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'}`}
          >
            {currentPlan === 'Starter' ? 'Active Plan' : 'Select Starter Plan'}
          </button>
        </div>

        {/* Plan 2: Professional (RECOMMENDED) */}
        <div className={`bg-white border-2 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between relative shadow-xl ${currentPlan === 'Professional' ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-blue-500'}`}>
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider shadow-sm">
            Most Popular
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">Professional</span>
              {currentPlan === 'Professional' && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">Current Plan</span>}
            </div>

            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {calculatePrice(29990)} <span className="text-xs font-semibold text-slate-400">{getCycleLabel()}</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Full Virtual CFO suite with AI insights, AP/AR analytics, and Amazon integration.
            </p>

            <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>All ERP Connectors + Amazon SP-API</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>CFO Bookkeeping Health & Anomaly Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Unified AP & AR Analytics Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>AI Insights & Smart CFO Prompts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Up to 10 User Seats</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleUpgrade('Professional')}
            disabled={loading || currentPlan === 'Professional'}
            className={`w-full py-3.5 rounded-xl text-xs font-bold transition cursor-pointer ${currentPlan === 'Professional' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'}`}
          >
            {currentPlan === 'Professional' ? 'Active Plan' : 'Upgrade to Professional'}
          </button>
        </div>

        {/* Plan 3: Enterprise */}
        <div className={`bg-white border rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between transition ${currentPlan === 'Enterprise' ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xl' : 'border-slate-200/80 shadow-xs hover:border-slate-300'}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-purple-600 uppercase tracking-wider">Enterprise</span>
              {currentPlan === 'Enterprise' && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">Current Plan</span>}
            </div>

            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {calculatePrice(89990)} <span className="text-xs font-semibold text-slate-400">{getCycleLabel()}</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Maximum speed & power with dedicated AI models, custom integrations & 24/7 CFO support.
            </p>

            <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Unlimited Connectors & Custom API Access</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Dedicated AI Model Fine-tuning</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Unlimited User Seats & Role RBAC</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>24/7 Priority CFO Account Manager</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleUpgrade('Enterprise')}
            disabled={loading || currentPlan === 'Enterprise'}
            className={`w-full py-3 rounded-xl text-xs font-bold transition cursor-pointer ${currentPlan === 'Enterprise' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'}`}
          >
            {currentPlan === 'Enterprise' ? 'Active Plan' : 'Upgrade to Enterprise'}
          </button>
        </div>

      </div>

    </div>
  );
}
