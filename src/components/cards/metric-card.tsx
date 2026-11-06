import React from 'react';
import { Card, CardContent } from './card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number; // e.g. 12.5%
  trend?: 'up' | 'down' | 'neutral';
  timeframe?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  trend = 'neutral',
  timeframe = 'vs last month',
  icon,
  isLoading = false,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isUp = trend === 'up';
  const isDown = trend === 'down';

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <span className="text-xs font-semibold text-muted-foreground">{title}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className="mt-1.5">
          <div className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{value}</div>
          
          {change !== undefined ? (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] md:text-xs">
              <span
                className={cn(
                  "flex items-center gap-0.5 font-semibold",
                  isUp && "text-success",
                  isDown && "text-destructive",
                  trend === 'neutral' && "text-muted-foreground"
                )}
              >
                {isUp ? <TrendingUp className="h-3 w-3 shrink-0" /> : null}
                {isDown ? <TrendingDown className="h-3 w-3 shrink-0" /> : null}
                {trend === 'neutral' ? <Minus className="h-3 w-3 shrink-0" /> : null}
                {isUp ? '+' : ''}
                {change}%
              </span>
              <span className="text-muted-foreground font-normal">{timeframe}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
