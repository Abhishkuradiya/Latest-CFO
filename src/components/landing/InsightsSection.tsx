"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, DollarSign, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const INSIGHTS = [
  {
    title: "Gross Margin Declining",
    badge: "ALERT",
    badgeColor: "bg-rose-100 text-rose-700",
    icon: TrendingDown,
    mainVal: "Gross margin declined 4.8%",
    desc: "Potential drivers: COGS +12.4%, Supplier raw material costs +8.1%.",
    cta: "Investigate"
  },
  {
    title: "Revenue Surge Detected",
    badge: "GROWTH",
    badgeColor: "bg-emerald-100 text-emerald-700",
    icon: Activity,
    mainVal: "Sales surge +55.9% in Q3",
    desc: "Primary expansion driven by enterprise customer contracts.",
    cta: "View Growth"
  },
  {
    title: "Overdue Receivables Risk",
    badge: "WARNING",
    badgeColor: "bg-amber-100 text-amber-700",
    icon: DollarSign,
    mainVal: "18 Invoices overdue (£187,423)",
    desc: "Collection delay increased from 24 days to 42 days across 3 key clients.",
    cta: "Send Reminders"
  },
  {
    title: "Bank Reconciliation Gap",
    badge: "RECON",
    badgeColor: "bg-sky-100 text-sky-700",
    icon: AlertTriangle,
    mainVal: "59% Bank statement lines reconciled",
    desc: "41% pending matching with sales invoices and supplier vouchers.",
    cta: "Auto Match"
  }
];

export function InsightsSection() {
  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          AI ANOMALY GUARD
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          Don&apos;t just see your numbers. <br />
          <span className="italic font-normal text-[#146EF5]">Understand them.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INSIGHTS.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <motion.div
              key={idx}
              whileHover={{ y: -4 }}
              className="bg-white border border-[#E6EDF7] rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-lg transition-all space-y-4 text-left"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${item.badgeColor}`}>
                  {item.badge}
                </span>
                <IconComp className="h-5 w-5 text-[#146EF5]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-[#0B1736]">{item.mainVal}</h3>
                <p className="text-xs text-[#64748B] font-medium leading-relaxed mt-1">{item.desc}</p>
              </div>

              <div className="pt-2">
                <Link
                  href="/overview"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#146EF5] hover:text-[#0B1736] transition cursor-pointer"
                >
                  <span>{item.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

    </section>
  );
}
