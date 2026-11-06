"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function FAB({ children, icon, className, ...props }: FABProps) {
  return (
    <button
      className={cn(
        "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground p-3 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {icon || <Plus className="h-5 w-5" />}
      {children ? <span className="text-xs font-semibold pr-1">{children}</span> : null}
    </button>
  );
}
