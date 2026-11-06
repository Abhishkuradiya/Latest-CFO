import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../cards/card';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorState({
  title = 'Failed to load financial records',
  description = 'There was an issue fetching analytics data. Please check your data connection or refresh.',
  onRetry,
  isRetrying = false,
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-60">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
          {description}
        </p>
        {onRetry ? (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-5 flex items-center gap-2 rounded bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/95 disabled:opacity-50 cursor-pointer outline-none transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
