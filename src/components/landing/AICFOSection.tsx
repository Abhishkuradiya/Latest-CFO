"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Sparkles, User, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';

const AI_RESPONSE_LINES = [
  "Revenue increased 18.4%, but gross margin declined from 14.2% to 8.7%.",
  "The primary drivers were:",
  "• COGS +31% (Supplier cost escalation)",
  "• Operating expenses +12% (Overhead variance)",
  "• 7 overdue invoices (£74,500 total value)",
  "• Higher raw material costs across 3 product lines",
  "I recommend reviewing product-level margins and chasing overdue receivables."
];

export function AICFOSection() {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleLines((prev) => (prev < AI_RESPONSE_LINES.length ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="ai-cfo" className="py-24 px-6 sm:px-12 bg-[#071A35] text-white z-10 relative overflow-hidden select-none">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#146EF5]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3.5 py-1 rounded-full bg-[#146EF5]/20 text-[#16C7D9] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/40">
            THE AI CFO
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Numbers tell you what happened. <br />
            <span className="text-[#16C7D9]">Your CFO should tell you why.</span>
          </h2>
        </div>

        {/* Animated AI Conversation Interface */}
        <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative">
          
          {/* User Prompt */}
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0 border border-slate-700">
              <User className="h-4 w-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs sm:text-sm font-bold text-white max-w-lg">
              &ldquo;Why did my profit fall this month?&rdquo;
            </div>
          </div>

          {/* AI CFO Answer */}
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-xl bg-[#146EF5] text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-[#146EF5]/30">
              <Bot className="h-5 w-5 text-[#16C7D9]" />
            </div>

            <div className="bg-slate-900/90 border border-[#146EF5]/30 p-5 rounded-2xl text-xs sm:text-sm space-y-3 flex-1 text-slate-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-extrabold text-[#16C7D9] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> AI CFO Real-Time Analysis
                </span>
                <span className="text-[10px] font-mono text-emerald-400">ANALYSIS COMPLETE</span>
              </div>

              <div className="space-y-1.5 font-medium leading-relaxed">
                {AI_RESPONSE_LINES.slice(0, visibleLines).map((line, idx) => (
                  <motion.p
                    key={idx}
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={idx === 0 ? "font-bold text-white text-sm" : idx === AI_RESPONSE_LINES.length - 1 ? "font-extrabold text-[#16C7D9] pt-2" : "text-slate-300"}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-4 text-center">
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#146EF5] hover:bg-white hover:text-[#071A35] text-white font-extrabold text-sm rounded-xl transition-all shadow-lg cursor-pointer"
            >
              <span>Meet Your AI CFO</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
}
