"use client";

import React, { useState } from 'react';
import { Sparkles, Brain, DollarSign, Activity, Settings, Sliders, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminAIInsightsPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="space-y-6 select-none pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            AI Engine & Financial Insights Controller
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Configure Gemini/OpenAI models, monitor token usage, set tenant AI budget limits, and audit AI-generated CFO suggestions.</p>
        </div>

        <button onClick={() => toast.success('AI Prompt configuration updated')} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer">
          <Settings className="h-4 w-4" /> Configure AI Models & Rate Limits
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly AI Token Consumption</span>
          <span className="text-3xl font-black text-slate-900 mt-2 block">14.8M Tokens</span>
          <span className="text-xs font-bold text-emerald-600 mt-1 block">99.8% System SLA</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated AI Infrastructure Cost</span>
          <span className="text-3xl font-black text-purple-700 mt-2 block">₹18,450 / mo</span>
          <span className="text-xs font-bold text-slate-500 mt-1 block">Avg ₹144 per active tenant</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active AI Insights Generated</span>
          <span className="text-3xl font-black text-slate-900 mt-2 block">2,490 Insights</span>
          <span className="text-xs font-bold text-purple-600 mt-1 block">94.2% User helpfulness rating</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-500 w-fit">
          {['overview', 'ai usage', 'model configuration', 'ai prompts', 'insight logs', 'ai limits'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-xl capitalize transition cursor-pointer ${tab === t ? 'bg-purple-600 text-white shadow-xs' : 'hover:text-slate-900'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Active Financial AI Models</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Google Gemini 1.5 Pro</span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">Primary Analysis Model</span>
              </div>
              <p className="text-[11px] text-slate-500">Used for deep balance sheet analysis, cash flow forecasting, and multi-tenant anomaly detection.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Google Gemini 1.5 Flash</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">Fast Summary Model</span>
              </div>
              <p className="text-[11px] text-slate-500">Used for real-time ledger breakdown cards, invoice extraction, and instant executive summaries.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
