"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../cards/card';
import { Maximize2, MoreHorizontal, Settings, RefreshCw, Trash } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WidgetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  onConfigure?: () => void;
  isDragging?: boolean;
  isLoading?: boolean;
}

export function WidgetContainer({
  title,
  children,
  onRefresh,
  onRemove,
  onConfigure,
  isDragging = false,
  isLoading = false,
  className,
  ...props
}: WidgetContainerProps) {
  return (
    <Card
      className={cn(
        "flex flex-col h-full overflow-hidden transition-shadow select-none",
        isDragging && "opacity-60 border-primary ring-2 ring-primary/25",
        className
      )}
      {...props}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 border-b bg-muted/20 drag-handle cursor-grab active:cursor-grabbing">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          {isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : null}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground outline-none cursor-pointer">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-40 rounded border bg-card p-1 shadow-md animate-in fade-in-80"
                align="end"
              >
                {onRefresh ? (
                  <DropdownMenu.Item
                    onClick={onRefresh}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-muted cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </DropdownMenu.Item>
                ) : null}

                {onConfigure ? (
                  <DropdownMenu.Item
                    onClick={onConfigure}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-muted cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configure
                  </DropdownMenu.Item>
                ) : null}

                <DropdownMenu.Item
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-muted cursor-pointer"
                  onClick={() => toast.success('Expanded to Fullscreen')}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Expand
                </DropdownMenu.Item>

                {onRemove ? (
                  <>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                    <DropdownMenu.Item
                      onClick={onRemove}
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-destructive outline-none hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      Remove
                    </DropdownMenu.Item>
                  </>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-4 relative">
        {isLoading && !children ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
