"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Workflow, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function AutomationSection() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          AUTOMATION ENGINE
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          Finance shouldn&apos;t require <br />
          <span className="italic font-normal text-[#146EF5]">manual work.</span>
        </h2>
      </div>

      {/* Visual Workflow Nodes Diagram */}
      <div className="bg-white border border-[#E6EDF7] rounded-3xl p-8 sm:p-12 shadow-xl space-y-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-mono font-bold">
          <span className="px-4 py-2.5 rounded-xl bg-[#EEF6FF] text-[#146EF5] border border-[#E6EDF7]">Xero OAuth</span>
          <span className="text-[#64748B]">→</span>
          <span className="px-4 py-2.5 rounded-xl bg-[#EEF6FF] text-[#146EF5] border border-[#E6EDF7]">New Transaction</span>
          <span className="text-[#64748B]">→</span>
          <span className="px-4 py-2.5 rounded-xl bg-[#071A35] text-white border border-slate-800">AI Categorization</span>
          <span className="text-[#64748B]">→</span>
          <span className="px-4 py-2.5 rounded-xl bg-[#EEF6FF] text-[#146EF5] border border-[#E6EDF7]">Rule Engine</span>
          <span className="text-[#64748B]">→</span>
          <span className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">Reconciliation</span>
        </div>

        {/* 6 Example Automations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left pt-4">
          {[
            "Daily Financial Summary Email",
            "Overdue Invoice Alert Triggers",
            "Predictive Cash Flow Warnings",
            "Continuous Reconciliation Monitor",
            "Expense Anomaly Spike Alert",
            "Automated Monthly CFO Board Report"
          ].map((item, idx) => (
            <div key={idx} className="bg-[#EEF6FF]/40 border border-[#E6EDF7] p-4 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-[#146EF5] shrink-0" />
              <span className="text-xs font-bold text-[#0B1736]">{item}</span>
            </div>
          ))}
        </div>

        <div className="pt-4">
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#146EF5] hover:bg-[#071A35] text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer"
          >
            <span>Explore Automation</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

    </section>
  );
}
