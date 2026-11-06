"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Filter, RefreshCw } from 'lucide-react';
import { useFilterStore } from '@/store/filter-store';

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function FilterBar({
  children,
  onRefresh,
  isRefreshing = false,
  className,
  ...props
}: FilterBarProps) {
  const { clearFilters } = useFilterStore();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center justify-between border bg-card p-3 rounded-lg shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>
        
        {children}
      </div>

      <div className="flex items-center gap-2.5 ml-auto sm:ml-0">
        <button
          onClick={clearFilters}
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition py-1 px-2 rounded hover:bg-muted"
        >
          Clear filters
        </button>

        {onRefresh ? (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50 cursor-pointer transition outline-none"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            Sync Metrics
          </button>
        ) : null}
      </div>
    </div>
  );
}
