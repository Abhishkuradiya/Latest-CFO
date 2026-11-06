"use client";

import React from 'react';
import { useFilterStore, DateRange } from '@/store/filter-store';
import { Calendar, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { format, subDays, startOfMonth, endOfMonth, startOfQuarter, startOfYear } from 'date-fns';

import { FormattedDatePicker } from '@/components/ui/formatted-date-picker';

const PRESETS = [
  { label: 'Today', key: 'today' as const },
  { label: 'Yesterday', key: 'yesterday' as const },
  { label: 'Last 7 Days', key: 'last_7_days' as const },
  { label: 'Last 30 Days', key: 'last_30_days' as const },
  { label: 'This Month', key: 'this_month' as const },
  { label: 'Last Month', key: 'last_month' as const },
  { label: 'This Quarter', key: 'this_quarter' as const },
  { label: 'This Year', key: 'this_year' as const },
  { label: 'Custom Range', key: 'custom' as const },
];

export function DatePickerWrapper() {
  const { dateRange, setDateRange } = useFilterStore();

  const handleSelectPreset = (key: DateRange['preset']) => {
    const today = new Date();
    let startDate = today;
    let endDate = today;

    switch (key) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'yesterday':
        startDate = subDays(today, 1);
        endDate = subDays(today, 1);
        break;
      case 'last_7_days':
        startDate = subDays(today, 6);
        endDate = today;
        break;
      case 'last_30_days':
        startDate = subDays(today, 29);
        endDate = today;
        break;
      case 'this_month':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'last_month':
        const lastMonth = subDays(startOfMonth(today), 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case 'this_quarter':
        startDate = startOfQuarter(today);
        endDate = today;
        break;
      case 'this_year':
        startDate = startOfYear(today);
        endDate = today;
        break;
      case 'custom':
        setDateRange({ preset: 'custom' });
        return;
    }

    setDateRange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      preset: key,
    });
  };

  const getLabel = () => {
    const found = PRESETS.find((p) => p.key === dateRange.preset);
    return found ? found.label : 'Select Date Range';
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{getLabel()}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-44 rounded-md border bg-card p-1 shadow-md animate-in fade-in-80"
            align="start"
          >
            {PRESETS.map((preset) => (
              <DropdownMenu.Item
                key={preset.key}
                onClick={() => handleSelectPreset(preset.key)}
                className="flex w-full items-center rounded px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-muted text-foreground"
              >
                {preset.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {dateRange.preset === 'custom' ? (
        <div className="flex items-center gap-1.5">
          <FormattedDatePicker
            value={dateRange.startDate}
            onChange={(val) => setDateRange({ startDate: val })}
          />
          <span className="text-xs text-muted-foreground font-semibold">to</span>
          <FormattedDatePicker
            value={dateRange.endDate}
            onChange={(val) => setDateRange({ endDate: val })}
          />
        </div>
      ) : null}
    </div>
  );
}
