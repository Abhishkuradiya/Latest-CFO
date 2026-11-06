"use client";
 
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
 
interface DateRangePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
  initialStart?: string;
  initialEnd?: string;
}
 
export function DateRangePicker({
  isOpen,
  onClose,
  onApply,
  initialStart,
  initialEnd
}: DateRangePickerProps) {
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
 
  // Track displayed left calendar month/year
  const [leftMonth, setLeftMonth] = useState(6); // default July
  const [leftYear, setLeftYear] = useState(2026);
 
  useEffect(() => {
    if (initialStart) {
      const d = new Date(initialStart);
      setTempStart(d);
      setLeftMonth(d.getMonth());
      setLeftYear(d.getFullYear());
    }
    if (initialEnd) {
      setTempEnd(new Date(initialEnd));
    }
  }, [initialStart, initialEnd, isOpen]);
 
  if (!isOpen) return null;
 
  // Month Names Helper
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
 
  // Right calendar display (always next month)
  let rightMonth = leftMonth + 1;
  let rightYear = leftYear;
  if (rightMonth > 11) {
    rightMonth = 0;
    rightYear += 1;
  }
 
  // Preset select handlers
  const applyPreset = (preset: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);
 
    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'current-week':
        const dayOfWeek = today.getDay(); // 0 is Sunday
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start.setDate(today.getDate() + diffToMon);
        end.setDate(start.getDate() + 6);
        break;
      case 'previous-week':
        const prevMon = new Date(today);
        const dayOfW = today.getDay();
        const diffToMonPrev = dayOfW === 0 ? -13 : -6 - dayOfW;
        start.setDate(today.getDate() + diffToMonPrev);
        end.setDate(start.getDate() + 6);
        break;
      case 'current-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'previous-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'previous-quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const prevQuarterStartMonth = (currentQuarter - 1) * 3;
        start = new Date(today.getFullYear(), prevQuarterStartMonth, 1);
        end = new Date(today.getFullYear(), prevQuarterStartMonth + 3, 0);
        break;
      case 'last-7':
        start.setDate(today.getDate() - 6);
        break;
      case 'july-2026':
        start = new Date(2026, 6, 1);
        end = new Date(2026, 6, 31);
        break;
      default:
        break;
    }
 
    setTempStart(start);
    setTempEnd(end);
    setLeftMonth(start.getMonth());
    setLeftYear(start.getFullYear());
  };
 
  // Calendar Navigation
  const prevMonth = () => {
    if (leftMonth === 0) {
      setLeftMonth(11);
      setLeftYear(leftYear - 1);
    } else {
      setLeftMonth(leftMonth - 1);
    }
  };
 
  const nextMonth = () => {
    if (leftMonth === 11) {
      setLeftMonth(0);
      setLeftYear(leftYear + 1);
    } else {
      setLeftMonth(leftMonth + 1);
    }
  };
 
  const prevYear = () => setLeftYear(leftYear - 1);
  const nextYear = () => setLeftYear(leftYear + 1);
 
  // Generate Days Grid for a month
  const getDaysArray = (year: number, month: number) => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Week day of 1st day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDay = new Date(year, month, 1).getDay();
    // Align with Mon start (Mon = 0, Tue = 1, ..., Sun = 6)
    const prefixBlanks = (firstDay + 6) % 7;
 
    const result: (Date | null)[] = [];
    for (let i = 0; i < prefixBlanks; i++) {
      result.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      result.push(new Date(year, month, day));
    }
    return result;
  };
 
  const handleDateClick = (date: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (date < tempStart) {
        setTempStart(date);
      } else {
        setTempEnd(date);
      }
    }
  };
 
  const isDateSelected = (date: Date) => {
    if (tempStart && date.getTime() === tempStart.getTime()) return 'start';
    if (tempEnd && date.getTime() === tempEnd.getTime()) return 'end';
    return null;
  };
 
  const isDateInRange = (date: Date) => {
    if (tempStart && tempEnd) {
      return date > tempStart && date < tempEnd;
    }
    if (tempStart && hoverDate && !tempEnd) {
      return date > tempStart && date <= hoverDate;
    }
    return false;
  };
 
  const handleApply = () => {
    if (tempStart && tempEnd) {
      onApply(tempStart, tempEnd);
    } else if (tempStart) {
      onApply(tempStart, tempStart);
    }
  };
 
  const renderCalendar = (year: number, month: number, isRight: boolean) => {
    const days = getDaysArray(year, month);
    return (
      <div className="w-[280px] flex flex-col shrink-0">
        {/* Month Header */}
        <div className="flex items-center justify-between px-2 mb-4 h-8 select-none">
          {!isRight ? (
            <div className="flex items-center gap-2">
              <button onClick={prevYear} className="p-1 rounded hover:bg-slate-100 transition cursor-pointer text-slate-405 hover:text-slate-700 outline-none border-none bg-transparent">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 transition cursor-pointer text-slate-405 hover:text-slate-700 outline-none border-none bg-transparent">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : <div />}
 
          <span className="text-xs font-bold text-slate-800">
            {monthNames[month]} {year}
          </span>
 
          {isRight ? (
            <div className="flex items-center gap-2">
              <button onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 transition cursor-pointer text-slate-405 hover:text-slate-700 outline-none border-none bg-transparent">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button onClick={nextYear} className="p-1 rounded hover:bg-slate-100 transition cursor-pointer text-slate-405 hover:text-slate-700 outline-none border-none bg-transparent">
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          ) : <div />}
        </div>
 
        {/* Week Days */}
        <div className="grid grid-cols-7 gap-y-1 text-center mb-2 select-none">
          {["MO", "TU", "WE", "TH", "FR", "SA", "SU"].map(w => (
            <span key={w} className="text-[10px] font-bold text-slate-400 tracking-wider">
              {w}
            </span>
          ))}
        </div>
 
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1.5 text-center">
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="h-7 w-7" />;
 
            const status = isDateSelected(date);
            const inRange = isDateInRange(date);
            const formatted = date.getDate();
 
            return (
              <div 
                key={date.toISOString()}
                className="relative flex items-center justify-center h-7 w-full group"
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => !tempEnd && setHoverDate(date)}
                onMouseLeave={() => setHoverDate(null)}
              >
                {/* Background highlight for range intermediate days */}
                {inRange && (
                  <div className={cn(
                    "absolute top-0 bottom-0 left-0 right-0 bg-indigo-50/70 z-0",
                    idx % 7 === 0 && "rounded-l-md",
                    idx % 7 === 6 && "rounded-r-md"
                  )} />
                )}
                
                {/* Specific highlight styles for selected endpoints */}
                <button
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-bold transition flex items-center justify-center z-10 outline-none cursor-pointer border-none bg-transparent",
                    status === 'start' && "bg-[#4f46e5] text-white shadow-md hover:bg-[#4f46e5]",
                    status === 'end' && "bg-[#4f46e5] text-white shadow-md hover:bg-[#4f46e5]",
                    !status && !inRange && "text-slate-700 hover:bg-slate-100",
                    !status && inRange && "text-[#4f46e5] font-semibold hover:bg-blue-100/50"
                  )}
                >
                  {formatted}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
 
  // Preset list labels
  const presets = [
    { label: 'Today', key: 'today' },
    { label: 'Yesterday', key: 'yesterday' },
    { label: 'Current Week', key: 'current-week' },
    { label: 'Previous Week', key: 'previous-week' },
    { label: 'Current Month', key: 'current-month' },
    { label: 'Previous Month', key: 'previous-month' },
    { label: 'Previous Quarter', key: 'previous-quarter' },
    { label: 'Last 7 Days', key: 'last-7' },
    { label: 'July 2026 (Demo)', key: 'july-2026' }
  ];
 
  return (
    <div 
      className="absolute right-0 top-11 mt-2 w-[800px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-1">
        {/* Left Side: Presets Sidebar */}
        <div className="w-[170px] border-r border-slate-100 py-4 px-2 flex flex-col gap-0.5 select-none shrink-0 bg-slate-50/50">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Presets</span>
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition outline-none cursor-pointer border-none bg-transparent",
                p.key === 'july-2026' 
                  ? "text-[#4f46e5] bg-indigo-50/50 hover:bg-indigo-50 font-bold" 
                  : "text-slate-600 hover:bg-slate-100/85 hover:text-slate-900"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
 
        {/* Right Side: Dual Calendars */}
        <div className="flex-grow p-5 flex gap-5 justify-between">
          {renderCalendar(leftYear, leftMonth, false)}
          {renderCalendar(rightYear, rightMonth, true)}
        </div>
      </div>
 
      {/* Bottom Footer: Cancel / Apply Actions */}
      <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 select-none shrink-0 bg-white">
        {tempStart && (
          <div className="mr-auto text-xs font-bold text-slate-500">
            Selected: <span className="text-slate-800">{tempStart.toISOString().slice(0, 10)}</span>
            {tempEnd && <> to <span className="text-slate-800">{tempEnd.toISOString().slice(0, 10)}</span></>}
          </div>
        )}
        <button 
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg border border-slate-200 transition outline-none cursor-pointer bg-white"
        >
          Cancel
        </button>
        <button 
          onClick={handleApply}
          className="px-5 py-2 text-xs font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg shadow-md transition outline-none cursor-pointer border-none"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
