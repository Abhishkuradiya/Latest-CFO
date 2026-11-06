"use client";

import React from 'react';

interface BrandLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function BrandLogo({ variant = 'dark', size = 'md', showSubtitle = true }: BrandLogoProps) {
  const isDark = variant === 'dark';

  // Size configurations
  const sizes = {
    sm: {
      barWidth: 'w-1.5',
      barHeights: ['h-3.5', 'h-5', 'h-6.5'],
      titleSize: 'text-base font-black',
      subSize: 'text-[8px] tracking-[0.18em]'
    },
    md: {
      barWidth: 'w-2',
      barHeights: ['h-4 shadow-sm', 'h-6 shadow-sm', 'h-8 shadow-sm'],
      titleSize: 'text-xl font-black',
      subSize: 'text-[9.5px] tracking-[0.2em]'
    },
    lg: {
      barWidth: 'w-2.5',
      barHeights: ['h-5 shadow-md', 'h-7.5 shadow-md', 'h-10 shadow-md'],
      titleSize: 'text-2xl md:text-3xl font-black',
      subSize: 'text-[11px] tracking-[0.22em]'
    }
  };

  const currentSize = sizes[size];

  return (
    <div className="flex items-center gap-3 select-none">
      {/* 3-Pill Vertical Gradient Bar Icon */}
      <div className="flex items-end gap-1 p-0.5">
        <div className={`${currentSize.barWidth} ${currentSize.barHeights[0]} bg-[#2563eb] rounded-full transition-all duration-300 hover:scale-105`} />
        <div className={`${currentSize.barWidth} ${currentSize.barHeights[1]} bg-[#3b82f6] rounded-full transition-all duration-300 hover:scale-105`} />
        <div className={`${currentSize.barWidth} ${currentSize.barHeights[2]} bg-[#00b7e2] rounded-full transition-all duration-300 hover:scale-105`} />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center">
        <span className={`${currentSize.titleSize} tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Virtual<span className="font-black">CFO</span>
        </span>
        {showSubtitle && (
          <span className={`${currentSize.subSize} font-extrabold uppercase mt-1 text-[#00b7e2] leading-none`}>
            AI FINANCIAL INTELLIGENCE
          </span>
        )}
      </div>
    </div>
  );
}
