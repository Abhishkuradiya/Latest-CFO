"use client";

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormattedDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (newValue: string) => void;
  label?: string;
  className?: string;
}

// Formats YYYY-MM-DD to DD/MM/YYYY
export function formatToDDMMYYYY(isoStr: string): string {
  if (!isoStr) return '—';
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return isoStr;
}

export function FormattedDatePicker({
  value,
  onChange,
  label,
  className
}: FormattedDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedDisplay = formatToDDMMYYYY(value);

  return (
    <div
      onClick={() => inputRef.current?.showPicker?.()}
      className={cn(
        "relative flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer hover:bg-slate-50 transition group",
        className
      )}
    >
      <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
      {label && <span className="text-slate-400 font-semibold text-[11px] shrink-0">{label}</span>}
      
      {/* Visible Formatted Date DD/MM/YYYY */}
      <span className="font-extrabold text-slate-900 tracking-tight select-none">
        {formattedDisplay}
      </span>

      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1 group-hover:text-slate-700" />

      {/* Hidden Native Input Date for Calendar Trigger */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
  );
}
