"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Info } from 'lucide-react';

const DIMENSIONS = [
  { name: "Cash Flow", score: 84, color: "#10b981", explanation: "Calculates operating runway & liquid cash cushion." },
  { name: "Profitability", score: 71, color: "#3b82f6", explanation: "Monitors gross margin, net EBITDA, & product profitability." },
  { name: "Liquidity", score: 89, color: "#10b981", explanation: "Evaluates current asset to liability ratios." },
  { name: "Receivables", score: 76, color: "#f59e0b", explanation: "Tracks collection velocity & overdue invoice aging." },
  { name: "Expenses", score: 81, color: "#3b82f6", explanation: "Monitors supplier cost stability and overhead variances." },
  { name: "Reconciliation", score: 93, color: "#10b981", explanation: "Verifies statement line matching completeness." }
];

export function IntelligenceSection() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <section className="py-24 px-6 sm:px-12 max-w-7xl mx-auto z-10 space-y-12">
      
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3.5 py-1 rounded-full bg-[#EEF6FF] text-[#146EF5] text-xs font-extrabold uppercase tracking-wider border border-[#146EF5]/20">
          HEALTH INDEX
        </span>
        <h2 className="text-3xl sm:text-5xl font-serif text-[#0B1736] tracking-tight leading-tight">
          Business Health Score: <span className="text-[#146EF5] font-sans font-black">82 / 100</span>
        </h2>
        <p className="text-xs text-[#64748B] font-medium max-w-xl mx-auto">
          Six dimensions computed continuously from your Xero general ledger. Hover any metric to see details.
        </p>
      </div>

      <div className="bg-white border border-[#E6EDF7] rounded-3xl p-8 sm:p-10 shadow-xl max-w-3xl mx-auto space-y-6">
        {DIMENSIONS.map((dim, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className="space-y-2 p-3 rounded-xl transition-colors hover:bg-[#EEF6FF]/50 relative"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#0B1736]">
              <div className="flex items-center gap-1.5">
                <span>{dim.name}</span>
                <Info className="h-3.5 w-3.5 text-[#64748B] cursor-help" />
              </div>
              <span className="font-extrabold text-sm" style={{ color: dim.color }}>{dim.score} / 100</span>
            </div>

            <div className="h-2.5 w-full bg-[#E6EDF7] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dim.score}%` }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: dim.color }}
              />
            </div>

            {hoveredIdx === idx && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-[#146EF5] font-semibold pt-1"
              >
                {dim.explanation}
              </motion.div>
            )}
          </div>
        ))}
      </div>

    </section>
  );
}
