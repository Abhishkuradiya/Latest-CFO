"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ShieldCheck, Lock, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const REPORTS = [
  "Profit & Loss Statement",
  "Balance Sheet",
  "Cash Flow Statement",
  "Trial Balance",
  "Budget vs Actual",
  "AR Aging Analysis",
  "AP Aging Analysis",
  "Tax & VAT Center"
];

export function ReportingSection() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          EXECUTIVE REPORTING
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          From financial statements <br />
          <span className="italic font-normal text-[#146EF5]">to confident decisions.</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {REPORTS.map((title, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -4 }}
            className="bg-white border border-[#E6EDF7] p-5 rounded-2xl shadow-2xs hover:shadow-md transition-all text-left space-y-2 cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-[#EEF6FF] text-[#146EF5] flex items-center justify-center font-bold group-hover:bg-[#146EF5] group-hover:text-white transition-colors">
              <FileText className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-extrabold text-[#0B1736] group-hover:text-[#146EF5] transition-colors">{title}</h4>
            <span className="text-[10px] text-[#64748B] font-semibold block">Verified Real-Time Output</span>
          </motion.div>
        ))}
      </div>

    </section>
  );
}

export function SecuritySection() {
  return (
    <section id="security" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto z-10">
      <div className="bg-[#071A35] text-white rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-[#146EF5]/30">
        <div className="space-y-4 max-w-2xl text-left">
          <div className="inline-flex items-center gap-2 text-[#16C7D9] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /> Enterprise Security & Isolation
          </div>
          <h2 className="text-2xl sm:text-4xl font-serif text-white leading-tight">
            Your financial data deserves enterprise-grade protection.
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Virtual CFO implements strict PostgreSQL row-level multi-tenant isolation, RFC 6238 2FA OTP, 256-bit TLS encryption, and comprehensive audit logging.
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#16C7D9]" /> Encrypted Data</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#16C7D9]" /> RFC 6238 2FA</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#16C7D9]" /> Role Isolation</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#16C7D9]" /> Tenant Privacy</span>
          </div>
        </div>

        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-3 shrink-0 shadow-xl">
          <Lock className="h-10 w-10 text-[#16C7D9] mx-auto" />
          <div className="text-sm font-bold text-white">100% Tenant Isolation</div>
          <p className="text-[11px] text-slate-400 max-w-xs font-medium">Sandboxed multi-tenant postgres security policies.</p>
        </div>
      </div>
    </section>
  );
}
