import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-50 slide-in-from-bottom-2 duration-300 space-y-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
