"use client";

import React from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface ResizablePanelsProps {
  direction?: 'horizontal' | 'vertical';
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLayout?: number[];
  className?: string;
}

export function ResizablePanels({
  direction = 'horizontal',
  leftPanel,
  rightPanel,
  defaultLayout = [50, 50],
  className,
}: ResizablePanelsProps) {
  return (
    <Group
      orientation={direction}
      className={cn("w-full min-h-[400px] border rounded-lg overflow-hidden bg-card", className)}
    >
      <Panel defaultSize={defaultLayout[0]} minSize={20}>
        <div className="h-full w-full overflow-auto p-4">{leftPanel}</div>
      </Panel>
      
      {/* Resizer Handle Bar */}
      <Separator className={cn(
        "flex items-center justify-center bg-border transition-colors hover:bg-primary/50",
        direction === 'horizontal' ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
      )}>
        <div className={cn(
          "bg-muted-foreground/60 rounded",
          direction === 'horizontal' ? "h-6 w-1" : "w-6 h-1"
        )} />
      </Separator>
      
      <Panel defaultSize={defaultLayout[1]} minSize={20}>
        <div className="h-full w-full overflow-auto p-4">{rightPanel}</div>
      </Panel>
    </Group>
  );
}
