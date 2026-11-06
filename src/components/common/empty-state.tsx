import React from 'react';
import { Layers, Plus } from 'lucide-react';
import { Card, CardContent } from '../cards/card';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/10">
      <CardContent className="flex flex-col items-center justify-center p-10 text-center min-h-60">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          {icon || <Layers className="h-6 w-6" />}
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
          {description}
        </p>
        {onAction && actionLabel ? (
          <button
            onClick={onAction}
            className="mt-5 flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 cursor-pointer outline-none transition"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
