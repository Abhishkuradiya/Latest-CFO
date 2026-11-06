import React from 'react';
import { Database } from 'lucide-react';
import { Card, CardContent } from '../cards/card';

interface NoDataStateProps {
  title?: string;
  description?: string;
}

export function NoDataState({
  title = 'No records found',
  description = 'There is no data matching your current filters or date ranges.',
}: NoDataStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-48 border rounded-lg bg-muted/5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
        <Database className="h-5 w-5" />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        {description}
      </p>
    </div>
  );
}
