"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  ShieldCheck, 
  TrendingUp, 
  Activity, 
  DollarSign, 
  CreditCard, 
  FileText, 
  PieChart, 
  Landmark, 
  Layers, 
  SlidersHorizontal, 
  Briefcase, 
  Users, 
  Building2, 
  Box,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';

const SHOWCASE_ITEMS = [
  { id: 'xero', name: 'Xero Analytics', icon: TrendingUp, desc: 'Real-time overview of your connected Xero organization ledgers & revenues.' },
  { id: 'health', name: 'CFO Bookkeeping Health', icon: ShieldCheck, desc: 'Continuous audit score verifying rule completeness & transaction tagging.' },
  { id: 'revenue', name: 'Revenue Dashboard', icon: BarChart3, desc: 'Breakdown of Gross Sales, Credit Notes, Net Revenue, and MoM expansion.' },
  { id: 'ap_ar', name: 'Unified AP & AR Analytics', icon: Activity, desc: 'Consolidated receivables vs payables aging and net working capital.' },
  { id: 'ar', name: 'Account Receivable', icon: DollarSign, desc: 'Outstanding customer invoices, payment collection rates, and aging buckets.' },
  { id: 'ap', name: 'Account Payable', icon: CreditCard, desc: 'Supplier bills, upcoming payment due dates, and vendor cash outlays.' },
  { id: 'purchases', name: 'Purchases & Expenses', icon: FileText, desc: 'Operating overhead deep dive and vendor-level cost distribution.' },
  { id: 'pnl', name: 'Profit & Loss', icon: PieChart, desc: 'Full P&L waterfall statement with sub-second drilldown analytics.' },
  { id: 'balance_sheet', name: 'Balance Sheet', icon: Layers, desc: 'Point-in-time assets, liabilities, and equity structure analysis.' },
  { id: 'cashflow', name: 'Cash Flow', icon: Activity, desc: 'Direct & indirect cash flow statements and operating cash runway.' },
  { id: 'trial_balance', name: 'Trial Balance', icon: SlidersHorizontal, desc: 'General ledger debit and credit balance verification.' },
  { id: 'bank_accounts', name: 'Bank Accounts', icon: Landmark, desc: 'Real-time verified bank statement feeds & liquidity balances.' },
  { id: 'coa', name: 'Chart of Accounts', icon: Briefcase, desc: 'Full ledger chart of accounts classification and code tracking.' },
  { id: 'budget', name: 'Budget vs Actual', icon: TrendingUp, desc: 'Variance reporting comparing target budgets with actual ledger data.' },
  { id: 'tax', name: 'Tax Center', icon: FileText, desc: 'VAT liability, sales tax tracking, and compliance reporting.' },
  { id: 'customers', name: 'Customers', icon: Users, desc: 'Top revenue contributing customers and payment behavior analysis.' },
  { id: 'vendors', name: 'Vendors', icon: Building2, desc: 'Supplier bill breakdown, price variance alerts, and top spend vendors.' },
  { id: 'inventory', name: 'Inventory', icon: Box, desc: 'Stock valuation, fast-moving items, and dead stock identification.' }
];

export function ProductShowcase() {
  const [selectedId, setSelectedId] = useState('xero');
  const selectedItem = SHOWCASE_ITEMS.find((item) => item.id === selectedId) || SHOWCASE_ITEMS[0];

  return (
    <section id="product" className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          Interactive Product Suite
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-[#0B1736] tracking-tight leading-tight">
          Everything your CFO needs. <br />
          <span className="text-[#146EF5]">One intelligent workspace.</span>
        </h2>
      </div>

      {/* Two Column Showcase Interface */}
      <div className="bg-white border border-[#E6EDF7] rounded-3xl p-6 sm:p-8 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: 18 Feature Items Scrollable Vertical Navigation */}
        <div className="lg:col-span-4 max-h-[540px] overflow-y-auto pr-2 space-y-1.5 scrollbar-thin">
          {SHOWCASE_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isSelected = item.id === selectedId;

            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#146EF5] text-white shadow-md'
                    : 'bg-[#EEF6FF]/40 text-[#0B1736] hover:bg-[#EEF6FF] border border-[#E6EDF7]'
                }`}
              >
                <IconComponent className={`h-4 w-4 shrink-0 ${isSelected ? 'text-[#16C7D9]' : 'text-[#146EF5]'}`} />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Animated Preview Canvas */}
        <div className="lg:col-span-8 bg-[#071A35] text-white rounded-2xl p-6 sm:p-8 space-y-6 min-h-[500px] flex flex-col justify-between border border-[#146EF5]/30 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedItem.id}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 flex-1 flex flex-col justify-between"
            >
              {/* Feature Title & Description */}
              <div className="space-y-2 border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#16C7D9] uppercase tracking-wider flex items-center gap-2">
                    <selectedItem.icon className="h-4 w-4" /> {selectedItem.name}
                  </span>
                  <span className="text-[10px] font-bold bg-[#146EF5] px-2.5 py-0.5 rounded text-white uppercase tracking-wider">
                    MODULE READY
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">{selectedItem.name} Command Center</h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">{selectedItem.desc}</p>
              </div>

              {/* Dynamic Mock UI Content based on module */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 flex-1">
                
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>MODULE_ID: {selectedItem.id.toUpperCase()}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> LIVE REFRESH ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Verified Metric</span>
                    <div className="text-lg font-black text-white mt-1">£3,998,930</div>
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">+55.9% Target</div>
                  </div>
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Variance Margin</span>
                    <div className="text-lg font-black text-[#16C7D9] mt-1">34.2% Net</div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">Optimal Range</div>
                  </div>
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Runway Duration</span>
                    <div className="text-lg font-black text-purple-400 mt-1">14.2 Months</div>
                    <div className="text-[10px] text-purple-300 font-bold mt-0.5">Liquid Protection</div>
                  </div>
                </div>

                {/* Simulated Wave Line Graphic */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Real-Time Computation Pipeline</span>
                  <span className="text-[#16C7D9] font-mono text-[11px] font-bold flex items-center gap-1">
                    Sub-second SQL Query <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>

              </div>

              {/* Bottom Footer CTA */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Included in all Virtual CFO Plans</span>
                <button className="px-4 py-2 bg-[#146EF5] hover:bg-white hover:text-[#071A35] text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer">
                  Launch {selectedItem.name} →
                </button>
              </div>

            </motion.div>
          </AnimatePresence>

        </div>

      </div>

    </section>
  );
}
