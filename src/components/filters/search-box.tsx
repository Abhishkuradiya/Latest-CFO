"use client";

import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBoxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
}

export function SearchBox({
  value,
  onChange,
  containerClassName,
  className,
  placeholder = "Search transactions...",
  ...props
}: SearchBoxProps) {
  return (
    <div className={cn("relative flex items-center w-full max-w-xs", containerClassName)}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full h-9 rounded-md border bg-background pl-9 pr-8 text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all placeholder:text-muted-foreground/80",
          className
        )}
        {...props}
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 h-5 w-5 flex items-center justify-center text-muted-foreground/60 hover:text-foreground rounded transition outline-none cursor-pointer hover:bg-muted"
          aria-label="Clear search value"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
