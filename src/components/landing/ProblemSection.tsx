"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, 
  ArrowDown, 
  Activity, 
  Sparkles,
  BarChart3,
  Landmark,
  CreditCard,
  TrendingUp,
  Receipt,
  FileText
} from 'lucide-react';

const DATA_STREAMS = [
  { name: "Accounting", icon: BarChart3, color: "#146EF5" },
  { name: "Banking", icon: Landmark, color: "#16C7D9" },
  { name: "Payments", icon: CreditCard, color: "#2D7BFF" },
  { name: "Sales", icon: TrendingUp, color: "#10b981" },
  { name: "Expenses", icon: Receipt, color: "#f59e0b" },
  { name: "Invoices", icon: FileText, color: "#8b5cf6" }
];

export function ProblemSection() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-16">
      
      {/* Editorial Headline */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          The Visibility Gap
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-[#0B1736] tracking-tight leading-tight">
          Your financial data is everywhere. <br />
          <span className="text-[#146EF5]">Your decisions shouldn&apos;t be.</span>
        </h2>
      </div>

      {/* Animated Data Convergence Diagram */}
      <div className="bg-white border border-[#E6EDF7] rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden text-center space-y-12">
        
        {/* Source Nodes Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
          {DATA_STREAMS.map((stream, idx) => {
            const IconComp = stream.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.04 }}
                className="bg-[#EEF6FF]/60 border border-[#E6EDF7] p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 shadow-2xs"
              >
                <div className="p-2.5 rounded-xl bg-white shadow-xs" style={{ color: stream.color }}>
                  <IconComp className="h-5 w-5" />
                </div>
                <span className="text-xs font-extrabold text-[#0B1736]">{stream.name}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Animated Connecting Converging Streams */}
        <div className="flex flex-col items-center justify-center space-y-2 relative py-4">
          <div className="h-12 w-0.5 bg-gradient-to-b from-[#146EF5] to-[#16C7D9] animate-pulse" />
          <ArrowDown className="h-5 w-5 text-[#146EF5] animate-bounce" />
        </div>

        {/* Converged Central Virtual CFO Command Node */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-[#071A35] text-white p-6 sm:p-8 rounded-3xl shadow-2xl max-w-xl mx-auto space-y-3 border border-[#146EF5]/30 relative"
        >
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#146EF5] text-white flex items-center justify-center font-black shadow-lg shadow-[#146EF5]/30">
            <Activity className="h-6 w-6 text-[#16C7D9]" />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white">VIRTUAL CFO</h3>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Unified Financial Command Center • Instant P&L • 90-Day Cash Runway • AI Anomaly Alerts
          </p>
        </motion.div>

      </div>

      {/* Explanatory Editorial Text */}
      <div className="max-w-3xl mx-auto text-center space-y-3 pt-4">
        <h3 className="text-2xl sm:text-4xl font-black text-[#0B1736] tracking-tight leading-snug">
          &ldquo;Modern businesses don&apos;t have a data problem. <br />
          <span className="text-[#146EF5]">They have a visibility problem.</span>&rdquo;
        </h3>
        <p className="text-sm text-[#64748B] font-medium leading-relaxed">
          Virtual CFO connects fragmented ledgers into a single source of financial truth.
        </p>
      </div>

    </section>
  );
}
