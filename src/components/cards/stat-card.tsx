import React from 'react';
import { Card, CardContent } from './card';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  isLoading?: boolean;
}

export function StatCard({
  label,
  value,
  subtitle,
  badge,
  isLoading = false,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="text-lg font-bold text-foreground leading-none">{value}</div>
          {subtitle ? (
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badge ? <div className="ml-4">{badge}</div> : null}
      </CardContent>
    </Card>
  );
}
