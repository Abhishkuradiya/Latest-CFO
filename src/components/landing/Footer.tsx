"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Activity } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10">
      <div className="bg-[#071A35] text-white rounded-3xl p-10 sm:p-16 text-center space-y-8 relative overflow-hidden shadow-2xl border border-[#146EF5]/30">
        
        {/* Subtle Wave Graph Background SVG */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
            <path d="M0 300 Q250 100 500 250 T1000 150 L1000 400 L0 400 Z" fill="url(#wave-grad)" />
            <defs>
              <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#146EF5" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto relative z-10">
          <h2 className="text-3xl sm:text-5xl font-serif text-white tracking-tight leading-tight">
            Meet your new financial <br />
            <span className="text-[#16C7D9] italic font-normal">intelligence layer.</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
            Connect your financial data, automate the busywork, and make decisions with confidence.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10 pt-2">
          <Link
            href="/overview"
            className="w-full sm:w-auto px-8 py-4 bg-[#146EF5] hover:bg-white hover:text-[#071A35] text-white font-extrabold text-sm rounded-full shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
          >
            <span>Start Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-extrabold text-sm rounded-full transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Book a Demo</span>
          </Link>
        </div>

      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#E6EDF7] bg-white py-16 px-6 sm:px-12 text-xs text-[#64748B] z-10 relative">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10">
        
        {/* Brand Col */}
        <div className="md:col-span-2 space-y-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#0B1736] text-white flex items-center justify-center font-black">
              <Activity className="h-4 w-4 text-[#16C7D9]" />
            </div>
            <span className="text-base font-black text-[#0B1736] tracking-tight">Virtual CFO</span>
          </div>
          <p className="text-xs text-[#64748B] font-medium leading-relaxed max-w-sm">
            Your Financial Intelligence Partner. Sat on top of your business data to turn numbers into actionable insights and automation.
          </p>
          <div className="text-[11px] text-[#64748B] font-semibold">
            © 2026 Virtual CFO Intelligence Platform. All Rights Reserved.
          </div>
        </div>

        {/* Product Col */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#0B1736]">Product</h4>
          <ul className="space-y-2 font-medium">
            <li><Link href="/overview" className="hover:text-[#146EF5]">Overview</Link></li>
            <li><a href="#product" className="hover:text-[#146EF5]">Xero Analytics</a></li>
            <li><a href="#ai-cfo" className="hover:text-[#146EF5]">AI CFO Engine</a></li>
            <li><a href="#automation" className="hover:text-[#146EF5]">Automation</a></li>
            <li><a href="#product" className="hover:text-[#146EF5]">Reports</a></li>
          </ul>
        </div>

        {/* Company Col */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#0B1736]">Company</h4>
          <ul className="space-y-2 font-medium">
            <li><a href="#" className="hover:text-[#146EF5]">About</a></li>
            <li><a href="#" className="hover:text-[#146EF5]">Contact</a></li>
            <li><a href="#" className="hover:text-[#146EF5]">Careers</a></li>
          </ul>
        </div>

        {/* Legal Col */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#0B1736]">Legal</h4>
          <ul className="space-y-2 font-medium">
            <li><a href="#" className="hover:text-[#146EF5]">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-[#146EF5]">Terms of Service</a></li>
            <li><a href="#security" className="hover:text-[#146EF5]">Security Overview</a></li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
