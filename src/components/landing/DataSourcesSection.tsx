"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Database, ArrowRight, Layers, FileSpreadsheet, Layers3, Cpu, Globe, CreditCard } from 'lucide-react';

const SOURCES = [
  { name: "Xero", color: "#13B5EA" },
  { name: "QuickBooks", color: "#2CA01C" },
  { name: "Zoho Books", color: "#E42526" },
  { name: "Stripe", color: "#635BFF" },
  { name: "Amazon", color: "#FF9900" },
  { name: "HDFC & SBI Feeds", color: "#004B8D" },
  { name: "Excel & CSV", color: "#107C41" },
  { name: "REST APIs", color: "#146EF5" }
];

const OUTPUTS = [
  "Real-Time P&L Insights", 
  "Executive Board Reports", 
  "90-Day Cash Runway Model", 
  "AI Anomaly Alerts", 
  "CFO Recommendations", 
  "Automation Rules"
];

export function DataSourcesSection() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12 select-none">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          MULTI-SOURCE DATA PIPELINE
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          One CFO. <br />
          <span className="italic font-normal text-[#146EF5]">Every financial signal.</span>
        </h2>
      </div>

      <div className="bg-white border border-[#E6EDF7] rounded-3xl p-8 sm:p-12 shadow-xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center">
          
          {/* Sources Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#64748B]">INPUT DATA SOURCES</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#0B1736]">
              {SOURCES.map((src, i) => (
                <div key={i} className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-xl flex items-center justify-center gap-2 hover:border-[#146EF5]/40 transition">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: src.color }} />
                  <span>{src.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Engine Center Node */}
          <div className="bg-[#071A35] text-white p-6 rounded-2xl border border-[#146EF5]/30 space-y-2 shadow-xl">
            <div className="h-10 w-10 rounded-xl bg-[#146EF5] text-white mx-auto flex items-center justify-center font-bold">
              <Database className="h-5 w-5 text-[#16C7D9]" />
            </div>
            <h3 className="text-sm font-black tracking-wider text-[#16C7D9]">VIRTUAL CFO ENGINE</h3>
            <p className="text-[11px] text-slate-300">Continuous Processing & Reconciliation</p>
          </div>

          {/* Outputs Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#64748B]">INTELLIGENCE OUTPUTS</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#0B1736]">
              {OUTPUTS.map((out, i) => (
                <div key={i} className="bg-[#EEF6FF] border border-[#E6EDF7] p-3 rounded-xl text-[#146EF5]">
                  {out}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </section>
  );
}
