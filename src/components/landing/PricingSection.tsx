"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const plans = [
    {
      name: "Starter",
      priceMonthly: "£99",
      priceAnnual: "£79",
      desc: "For single entity startups.",
      features: ["1 Connected Xero Entity", "Standard P&L & Cashflow", "5 User Accounts", "Daily Automated Sync"],
      highlight: false
    },
    {
      name: "Professional",
      priceMonthly: "£299",
      priceAnnual: "£239",
      desc: "For expanding mid-sized companies.",
      features: ["3 Connected Xero Entities", "AI Anomaly Detection", "90-Day Cash Runway Model", "AR & AP Aging Control", "20 User Accounts"],
      highlight: true
    },
    {
      name: "Business",
      priceMonthly: "£599",
      priceAnnual: "£479",
      desc: "For multi-entity corporate groups.",
      features: ["10 Connected Xero Entities", "Custom AI CFO Models", "Multi-Entity Consolidation", "Priority 24/7 Support", "Unlimited Users"],
      highlight: false
    },
    {
      name: "Enterprise",
      priceMonthly: "£899",
      priceAnnual: "£719",
      desc: "For corporate holdings & CFO advisories.",
      features: ["Unlimited Xero Entities", "Custom QuickBooks & Zoho Connectors", "Dedicated SLA Manager", "White-Label Reports"],
      highlight: false
    }
  ];

  return (
    <section id="pricing" className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          PREMIUM SAAS BILLING
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          Your CFO shouldn&apos;t <br />
          <span className="italic font-normal text-[#146EF5]">cost like one.</span>
        </h2>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-[#0B1736]' : 'text-[#64748B]'}`}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
            className="w-14 h-8 bg-[#EEF6FF] border border-[#E6EDF7] rounded-full p-1 transition cursor-pointer relative shadow-inner"
          >
            <div className={`w-6 h-6 rounded-full bg-[#146EF5] transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-bold ${billingCycle === 'annual' ? 'text-[#146EF5]' : 'text-[#64748B]'} flex items-center gap-1.5`}>
            <span>Annual</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">SAVE 20%</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 transition-all ${
              plan.highlight
                ? 'border-2 border-[#146EF5] shadow-xl relative'
                : 'border border-[#E6EDF7] shadow-2xs hover:shadow-md'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#146EF5] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-full shadow-md">
                MOST POPULAR
              </div>
            )}

            <div className="space-y-4">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#64748B]">{plan.name}</span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#0B1736]">
                    {billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly}
                  </span>
                  <span className="text-xs text-[#64748B] font-bold">/ mo</span>
                </div>
                <p className="text-xs text-[#64748B] font-medium mt-1">{plan.desc}</p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-[#E6EDF7] text-xs font-semibold text-[#0B1736]">
                {plan.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#146EF5] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/overview"
              className={`w-full py-3.5 rounded-xl font-extrabold text-xs text-center transition cursor-pointer ${
                plan.highlight
                  ? 'bg-[#146EF5] hover:bg-[#071A35] text-white shadow-md'
                  : 'bg-[#EEF6FF] hover:bg-[#146EF5] hover:text-white text-[#0B1736]'
              }`}
            >
              Get Started →
            </Link>
          </div>
        ))}
      </div>

    </section>
  );
}

export function Testimonials() {
  const reviews = [
    {
      quote: "Virtual CFO transformed our month-end close from 14 days down to zero. Real-time P&L visibility is an absolute game-changer.",
      name: "Marcus Vance",
      title: "Founder & CEO, Apex Holdings"
    },
    {
      quote: "The 90-day cash runway forecasting caught an upcoming supplier liquidity crunch weeks before our traditional accountants noticed.",
      name: "Sarah Jenkins",
      title: "Finance Director, Lumina Retail"
    },
    {
      quote: "Managing 6 client entities under a single Virtual CFO account gives our advisory firm an unparalleled competitive edge.",
      name: "David Sterling",
      title: "Managing Partner, Sterling Advisory"
    }
  ];

  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          EXECUTIVE TRUST
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          Built for businesses that <br />
          <span className="italic font-normal text-[#146EF5]">take finance seriously.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reviews.map((rev, idx) => (
          <div key={idx} className="bg-white border border-[#E6EDF7] rounded-3xl p-8 shadow-xs space-y-4 text-left">
            <p className="text-xs sm:text-sm text-[#0B1736] font-medium leading-relaxed font-serif italic">
              &ldquo;{rev.quote}&rdquo;
            </p>
            <div className="pt-2 border-t border-[#E6EDF7]">
              <div className="text-xs font-extrabold text-[#0B1736]">{rev.name}</div>
              <div className="text-[11px] text-[#64748B] font-semibold">{rev.title}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
