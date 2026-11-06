"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  BarChart2, 
  CheckCircle2, 
  Activity, 
  Star,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from 'lucide-react';

const TYPEWRITER_WORDS = [
  "Intelligence",
  "Forecasting",
  "Automation",
  "Ledger Sync",
  "Real-Time Insights",
  "Cash Flow Control"
];

function TypewriterEffect() {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setBlink((prev) => !prev);
    }, 450);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (subIndex === TYPEWRITER_WORDS[index].length + 1 && !reverse) {
      const timeout = setTimeout(() => {
        setReverse(true);
      }, 1600);
      return () => clearTimeout(timeout);
    }

    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % TYPEWRITER_WORDS.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, reverse ? 35 : 75);

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse]);

  return (
    <span className="inline-flex items-center">
      <span className="italic font-normal text-[#146EF5] min-w-[200px] sm:min-w-[340px] text-left inline-block">
        {TYPEWRITER_WORDS[index].substring(0, subIndex)}
      </span>
      <span
        className={`w-[3px] h-[0.75em] bg-[#146EF5] ml-1.5 rounded-full inline-block ${
          blink ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-100`}
      />
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 pb-20 px-6 sm:px-12 max-w-7xl mx-auto text-center z-10 select-none">
      
      {/* Editorial Main Headline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-4 max-w-4xl mx-auto"
      >
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif tracking-tight text-[#0B1736] leading-[1.15]">
          AI-Driven Financial <br />
          <TypewriterEffect /> <span className="font-serif">Right Away</span>
        </h1>
        
        <p className="text-sm sm:text-lg text-[#64748B] font-sans font-medium max-w-2xl mx-auto leading-relaxed pt-2">
          From ledger sync to live forecasting — manage millions in cash flow seamlessly with Virtual CFO.
        </p>
      </motion.div>

      {/* Dual Pill Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex flex-row items-center justify-center gap-3 pt-6"
      >
        <Link
          href="/overview"
          className="px-6 py-3.5 bg-[#0B1736] hover:bg-[#146EF5] text-white font-sans font-bold text-xs sm:text-sm rounded-full shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
        >
          Launch Platform
        </Link>

        <Link
          href="/login"
          className="px-6 py-3.5 bg-white hover:bg-[#EEF6FF] border border-[#E6EDF7] text-[#0B1736] font-sans font-bold text-xs sm:text-sm rounded-full transition shadow-xs cursor-pointer"
        >
          Get Started Free
        </Link>
      </motion.div>

      {/* Hero Visual Composition - Glowing Warm Arch + Floating Cards Orbit */}
      <div className="relative pt-16 max-w-5xl mx-auto">
        
        {/* Warm Arc Gradient Glow Background */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[350px] sm:h-[450px] bg-gradient-to-t from-amber-200/50 via-amber-100/30 to-transparent rounded-t-full blur-2xl pointer-events-none z-0" />

        {/* Central Mockup Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative z-10 max-w-[340px] sm:max-w-[380px] mx-auto bg-[#071A35] text-white rounded-[40px] p-4 shadow-2xl border-4 border-slate-800"
        >
          {/* Mock Smartphone Screen */}
          <div className="bg-slate-950 rounded-[32px] p-5 space-y-4 text-left overflow-hidden relative">
            
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">
                  <Activity className="h-4 w-4 text-[#16C7D9]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Bella CFO</div>
                  <div className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Xero Feed
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                ● LIVE
              </span>
            </div>

            {/* Mock Dashboard Metric Inside Phone */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Cash Balance</span>
              <div className="text-2xl font-black text-white">£144,417<span className="text-xs text-slate-500">.76</span></div>
              <div className="text-[10.5px] text-emerald-400 font-bold flex items-center gap-1 pt-1">
                <TrendingUp className="h-3.5 w-3.5" /> +18.4% Net Buffer
              </div>
            </div>

            {/* Mock Revenue Card */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>Revenue (MTD)</span>
                <span className="text-sky-400">P&L VERIFIED</span>
              </div>
              <div className="text-xl font-black text-white">£3,998,930</div>
            </div>

          </div>
        </motion.div>

        {/* Orbiting Floating Widget Card 1: Top Left (Blue Image Card) */}
        <motion.div
          initial={{ opacity: 0, x: -40, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="absolute top-12 left-2 sm:left-12 z-20 bg-sky-100 border border-sky-200/80 p-3.5 rounded-2xl shadow-lg max-w-[160px] sm:max-w-[200px] text-left hidden sm:block"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-600 text-white">2.5k</span>
            <span className="text-[11px] font-extrabold text-sky-900">Xero API Feed</span>
          </div>
          <div className="text-[11px] font-bold text-sky-950">100% Ledger Synced</div>
        </motion.div>

        {/* Orbiting Floating Widget Card 2: Bottom Left (Soft Yellow Engagement Meter) */}
        <motion.div
          initial={{ opacity: 0, x: -40, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="absolute bottom-16 left-4 sm:left-16 z-20 bg-[#fef08a] border border-amber-300 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-left"
        >
          <div className="p-2.5 rounded-xl bg-amber-400/40 text-amber-950">
            <BarChart2 className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block leading-none">Net Margin</span>
            <span className="text-2xl font-black text-amber-950 leading-none">34.2%</span>
          </div>
        </motion.div>

        {/* Orbiting Floating Widget Card 3: Top Right (Soft Mint Green Items Badge) */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: -20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="absolute top-8 right-2 sm:right-12 z-20 bg-[#bbf7d0] border border-emerald-300 p-4 rounded-2xl shadow-xl text-left min-w-[170px] hidden sm:block"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-950">£3.99M</span>
          </div>
          <div className="text-[11px] font-extrabold text-emerald-900 mt-0.5">Revenue MoM (+55.9%)</div>
          <div className="mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white w-max">
            TARGET PASSED
          </div>
        </motion.div>

        {/* Orbiting Floating Widget Card 4: Bottom Right (Soft White Alert Card) */}
        <motion.div
          initial={{ opacity: 0, x: 40, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="absolute bottom-12 right-4 sm:right-16 z-20 bg-white border border-[#E6EDF7] p-4 rounded-2xl shadow-2xl text-left max-w-[210px] space-y-1.5"
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3" /> CFO Insight
            </span>
            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">Alert</span>
          </div>
          <p className="text-[11px] font-bold text-[#0B1736] leading-tight">
            18 Invoices Overdue (£187,423 Total)
          </p>
        </motion.div>

        {/* Stars Badge overlay */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-white/90 border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1 text-[11px] font-extrabold text-[#0B1736]">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3 w-3 fill-amber-400" />
            ))}
          </div>
          <span className="ml-1">5.0 Rated Financial Intelligence</span>
        </div>

      </div>

    </section>
  );
}
