"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, Clock, Filter, RotateCcw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatToDDMMYYYY } from './formatted-date-picker';

export interface FinancialDateRangePickerProps {
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  onChange: (fromDate: string, toDate: string, presetName?: string) => void;
  className?: string;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function FinancialDateRangePicker({
  fromDate,
  toDate,
  onChange,
  className
}: FinancialDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [tempFrom, setTempFrom] = useState(fromDate);
  const [tempTo, setTempTo] = useState(toDate);
  const [validationError, setValidationError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempFrom(fromDate);
    setTempTo(toDate);
    setValidationError(null);
  }, [fromDate, toDate]);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setValidationError(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Accounting Preset Definitions
  const applyPreset = (presetKey: string) => {
    setValidationError(null);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let start: Date;
    let end: Date;

    switch (presetKey) {
      case 'THIS_MONTH':
        start = new Date(currentYear, currentMonth, 1);
        end = new Date(currentYear, currentMonth + 1, 0);
        break;

      case 'LAST_MONTH':
        start = new Date(currentYear, currentMonth - 1, 1);
        end = new Date(currentYear, currentMonth, 0);
        break;

      case 'THIS_QUARTER': {
        const qStartMonth = Math.floor(currentMonth / 3) * 3;
        start = new Date(currentYear, qStartMonth, 1);
        end = new Date(currentYear, qStartMonth + 3, 0);
        break;
      }

      case 'LAST_QUARTER': {
        const qStartMonth = Math.floor(currentMonth / 3) * 3 - 3;
        start = new Date(currentYear, qStartMonth, 1);
        end = new Date(currentYear, qStartMonth + 3, 0);
        break;
      }

      case 'THIS_FY_UK': {
        // Financial Year (Apr 1 - Mar 31)
        if (currentMonth >= 3) {
          start = new Date(currentYear, 3, 1);
          end = new Date(currentYear + 1, 2, 31);
        } else {
          start = new Date(currentYear - 1, 3, 1);
          end = new Date(currentYear, 2, 31);
        }
        break;
      }

      case 'LAST_FY_UK': {
        if (currentMonth >= 3) {
          start = new Date(currentYear - 1, 3, 1);
          end = new Date(currentYear, 2, 31);
        } else {
          start = new Date(currentYear - 2, 3, 1);
          end = new Date(currentYear - 1, 2, 31);
        }
        break;
      }

      case 'LAST_3_MONTHS':
        start = new Date(currentYear, currentMonth - 3, 1);
        end = now;
        break;

      case 'LAST_6_MONTHS':
        start = new Date(currentYear, currentMonth - 6, 1);
        end = now;
        break;

      case 'LAST_12_MONTHS':
        end = now;
        start = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000);
        break;

      case 'YTD':
        start = new Date(currentYear, 0, 1);
        end = now;
        break;

      default:
        return;
    }

    // Ensure range never exceeds 364 days for Xero API limits
    if (end.getTime() - start.getTime() > 364 * 24 * 60 * 60 * 1000) {
      start = new Date(end.getTime() - 364 * 24 * 60 * 60 * 1000);
    }

    const fromStr = formatYMD(start);
    const toStr = formatYMD(end);
    setActivePreset(presetKey);
    onChange(fromStr, toStr, presetKey);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (!tempFrom || !tempTo) return;
    const dFrom = new Date(tempFrom);
    const dTo = new Date(tempTo);

    if (dFrom > dTo) {
      setValidationError('From Date cannot be after To Date.');
      return;
    }

    const diffDays = Math.ceil((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      setValidationError(`Date range is ${diffDays} days. Xero API allows a max of 365 days (1 year). Please select a range within 365 days.`);
      return;
    }

    setValidationError(null);
    setActivePreset('CUSTOM');
    onChange(tempFrom, tempTo, 'CUSTOM');
    setIsOpen(false);
  };

  const presetsList = [
    { key: 'THIS_MONTH', label: 'This Month' },
    { key: 'LAST_MONTH', label: 'Last Month' },
    { key: 'THIS_QUARTER', label: 'This Quarter (QTD)' },
    { key: 'LAST_QUARTER', label: 'Last Quarter' },
    { key: 'THIS_FY_UK', label: 'Financial Year (Apr–Mar)' },
    { key: 'LAST_FY_UK', label: 'Last Financial Year' },
    { key: 'LAST_3_MONTHS', label: 'Last 3 Months' },
    { key: 'LAST_6_MONTHS', label: 'Last 6 Months' },
    { key: 'LAST_12_MONTHS', label: 'Last 12 Months' },
    { key: 'YTD', label: 'Year to Date (YTD)' },
  ];

  const displayLabel = `${formatToDDMMYYYY(fromDate)} – ${formatToDDMMYYYY(toDate)}`;

  return (
    <div className={cn("relative shrink-0 select-none", className)} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setValidationError(null);
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer outline-none h-9"
      >
        <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-slate-400 font-medium text-[11px]">From:</span>
        <span className="font-extrabold text-slate-900">{formatToDDMMYYYY(fromDate)}</span>
        <span className="text-slate-400 font-medium text-[11px]">To:</span>
        <span className="font-extrabold text-slate-900">{formatToDDMMYYYY(toDate)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform ml-1", isOpen && "rotate-180")} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-extrabold text-xs text-slate-900">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              <span>Accounting Period Selection</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              P&L Report Range
            </span>
          </div>

          {/* Presets Grid */}
          <div className="mb-4">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2 px-0.5">
              Quick Accounting Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {presetsList.map(p => {
                const isActive = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={cn(
                      "px-2.5 py-1.5 text-[11px] font-bold rounded-lg text-left transition cursor-pointer flex items-center justify-between border",
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border-slate-200/80"
                    )}
                  >
                    <span className="truncate">{p.label}</span>
                    {isActive && <Check className="h-3 w-3 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Selector */}
          <div className="border-t border-slate-100 pt-3 space-y-2.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-0.5">
              Custom Date Range
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">From Date</label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => {
                    setTempFrom(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">To Date</label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => {
                    setTempTo(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {validationError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCustomApply}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition cursor-pointer mt-1"
            >
              Apply Custom Range
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
