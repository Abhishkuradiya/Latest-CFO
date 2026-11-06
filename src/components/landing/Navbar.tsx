"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, ChevronDown } from 'lucide-react';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md border-b border-[#E6EDF7] shadow-2xs py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-between">
        
        {/* Left: Starburst Logo + / virtualcfo.ai */}
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-[#0B1736] text-white flex items-center justify-center font-black group-hover:bg-[#146EF5] transition-colors">
            <Activity className="h-4 w-4 text-[#16C7D9]" />
          </div>
          <span className="text-sm font-bold text-[#0B1736] tracking-tight">
            / virtualcfo.ai
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-xs font-bold text-[#64748B]">
          <a href="#product" className="hover:text-[#0B1736] transition cursor-pointer flex items-center gap-1">
            <span>Products</span>
            <ChevronDown className="h-3 w-3" />
          </a>
          <a href="#solutions" className="hover:text-[#0B1736] transition cursor-pointer">Customer Stories</a>
          <a href="#ai-cfo" className="hover:text-[#0B1736] transition cursor-pointer">Resources</a>
          <a href="#pricing" className="hover:text-[#0B1736] transition cursor-pointer">Pricing</a>
        </nav>

        {/* Right Area: Book A Demo + Get Started */}
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-xs font-bold text-[#0B1736] hover:text-[#146EF5] transition cursor-pointer"
          >
            Book A Demo
          </Link>

          <Link
            href="/overview"
            className="px-5 py-2.5 bg-[#0B1736] hover:bg-[#146EF5] text-white font-bold text-xs rounded-full shadow-sm transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </div>

      </div>
    </header>
  );
}
