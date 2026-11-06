"use client";

import React from 'react';
import { motion } from 'framer-motion';

const BRAND_LOGOS = [
  {
    name: "Xero",
    category: "Accounting",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.2 2.5C7.7 2.5 2.5 7.7 2.5 14.2C2.5 20.7 7.7 25.9 14.2 25.9C20.7 25.9 25.9 20.7 25.9 14.2C25.9 7.7 20.7 2.5 14.2 2.5ZM19.1 18.2C19.4 18.5 19.4 19 19.1 19.3C18.9 19.5 18.7 19.6 18.5 19.6C18.3 19.6 18.1 19.5 17.9 19.3L14.2 15.6L10.5 19.3C10.3 19.5 10.1 19.6 9.9 19.6C9.7 19.6 9.5 19.5 9.3 19.3C9 19 9 18.5 9.3 18.2L13 14.5L9.3 10.8C9 10.5 9 10 9.3 9.7C9.6 9.4 10.1 9.4 10.4 9.7L14.1 13.4L17.8 9.7C18.1 9.4 18.6 9.4 18.9 9.7C19.2 10 19.2 10.5 18.9 10.8L15.2 14.5L19.1 18.2Z" fill="#13B5EA"/>
        <text x="30" y="20" fill="#0B1736" fontSize="18" fontWeight="800" fontFamily="sans-serif">xero</text>
      </svg>
    )
  },
  {
    name: "QuickBooks",
    category: "Ledger",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="12" fill="#2CA01C"/>
        <path d="M10 10V18M10 14H15C16.5 14 18 13 18 11.5C18 10 16.5 9 15 9H10V14Z" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <text x="32" y="20" fill="#0B1736" fontSize="16" fontWeight="700" fontFamily="sans-serif">quickbooks</text>
      </svg>
    )
  },
  {
    name: "Zoho Books",
    category: "ERP",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 150 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="20" rx="4" fill="#E42526"/>
        <text x="7" y="19" fill="white" fontSize="13" fontWeight="900">Z</text>
        <text x="28" y="20" fill="#0B1736" fontSize="16" fontWeight="800" fontFamily="sans-serif">ZOHO <tspan fill="#64748B" fontWeight="600">Books</tspan></text>
      </svg>
    )
  },
  {
    name: "Stripe",
    category: "Payments",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.9 10.3C13.9 9.5 14.6 9 15.8 9C17.2 9 18.9 9.5 20.1 10.2L20.9 6.2C19.5 5.5 17.7 5.1 15.8 5.1C11.6 5.1 8.7 7.4 8.7 10.7C8.7 16 16.1 15.2 16.1 17.7C16.1 18.7 15.1 19.2 13.7 19.2C12.1 19.2 10 18.5 8.6 17.6L7.7 21.7C9.3 22.5 11.5 23.1 13.7 23.1C18.1 23.1 21.2 20.8 21.2 17.4C21.1 11.7 13.9 12.8 13.9 10.3Z" fill="#635BFF"/>
        <text x="28" y="20" fill="#0B1736" fontSize="18" fontWeight="800" fontFamily="sans-serif">stripe</text>
      </svg>
    )
  },
  {
    name: "Amazon",
    category: "Commerce",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 120 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="2" y="19" fill="#0B1736" fontSize="18" fontWeight="900" fontFamily="sans-serif">amazon</text>
        <path d="M6 23C20 27 45 27 62 21" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M59 19L64 21.5L60.5 25" fill="#FF9900"/>
      </svg>
    )
  },
  {
    name: "HDFC Bank",
    category: "Banking",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 140 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="20" fill="#004B8D"/>
        <rect x="7" y="9" width="10" height="10" fill="#ED1C24"/>
        <rect x="9" y="11" width="6" height="6" fill="white"/>
        <text x="28" y="20" fill="#004B8D" fontSize="15" fontWeight="900" fontFamily="sans-serif">HDFC BANK</text>
      </svg>
    )
  },
  {
    name: "State Bank of India",
    category: "Banking",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 130 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="14" r="10" fill="#280071"/>
        <circle cx="12" cy="11" r="4" fill="white"/>
        <rect x="10.5" y="11" width="3" height="9" fill="white"/>
        <text x="28" y="19" fill="#280071" fontSize="16" fontWeight="900" fontFamily="sans-serif">SBI BANK</text>
      </svg>
    )
  },
  {
    name: "Microsoft Excel",
    category: "Spreadsheets",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 120 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="20" height="20" rx="3" fill="#107C41"/>
        <path d="M7 8L12 14L7 20H9.5L13.2 15.2L17 20H19.5L14.4 14L19.2 8H16.8L13.2 12.6L9.6 8H7Z" fill="white"/>
        <text x="28" y="19" fill="#0B1736" fontSize="16" fontWeight="800" fontFamily="sans-serif">Excel</text>
      </svg>
    )
  },
  {
    name: "Microsoft Power BI",
    category: "Analytics",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 140 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="14" width="4" height="10" rx="1" fill="#F2C811"/>
        <rect x="8" y="9" width="4" height="15" rx="1" fill="#F2C811"/>
        <rect x="14" y="4" width="4" height="20" rx="1" fill="#F2C811"/>
        <text x="24" y="19" fill="#0B1736" fontSize="16" fontWeight="800" fontFamily="sans-serif">Power BI</text>
      </svg>
    )
  },
  {
    name: "Razorpay",
    category: "Gateway",
    render: () => (
      <svg className="h-7 w-auto" viewBox="0 0 140 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22L14 4L10 14L18 22H4Z" fill="#0C2340"/>
        <path d="M14 4L9 14H15L14 4Z" fill="#0284C7"/>
        <text x="24" y="19" fill="#0C2340" fontSize="16" fontWeight="900" fontFamily="sans-serif">Razorpay</text>
      </svg>
    )
  }
];

export function IntegrationMarquee() {
  return (
    <section className="py-12 bg-white border-y border-[#E6EDF7] overflow-hidden select-none z-10 relative">
      <div className="max-w-7xl mx-auto px-6 mb-4 text-center">
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748B] bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          NATIVE DATA INTEGRATIONS & LIVE BANK FEEDS
        </span>
      </div>

      {/* Infinite Horizontal Logo Marquee */}
      <div className="relative w-full overflow-hidden flex items-center">
        
        {/* Left & Right Gradient Fades */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div className="flex gap-12 whitespace-nowrap animate-marquee py-3">
          {[...BRAND_LOGOS, ...BRAND_LOGOS].map((brand, idx) => {
            const LogoRender = brand.render;
            return (
              <div 
                key={idx}
                className="flex items-center gap-3 px-5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl shadow-2xs hover:shadow-md hover:border-[#146EF5]/40 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer shrink-0 group"
              >
                <div className="opacity-85 group-hover:opacity-100 transition-opacity">
                  <LogoRender />
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 35s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

