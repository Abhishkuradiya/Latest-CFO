"use client";

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Sparkles, RefreshCw, Upload, FileDown, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionMenuProps {
  trigger: React.ReactNode;
}

export function QuickActionMenu({ trigger }: QuickActionMenuProps) {
  const handleAction = (message: string) => {
    toast.info(message);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger}
      </DropdownMenu.Trigger>
      
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-48 rounded-lg border bg-card p-1 shadow-md animate-in fade-in-80"
          align="end"
          sideOffset={8}
        >
          <DropdownMenu.Item
            onClick={() => handleAction('Initiated sync on connected APIs...')}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-muted text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync All Data Sources
          </DropdownMenu.Item>
          
          <DropdownMenu.Item
            onClick={() => handleAction('Opening spreadsheet import wizard...')}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-muted text-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Bank CSV
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onClick={() => handleAction('Preparing custom report export...')}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-muted text-foreground"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export Monthly Summary
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onClick={() => handleAction('Initializing AI Forecasting...')}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs cursor-pointer outline-none hover:bg-muted text-foreground font-medium text-primary"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Generate AI Forecasts
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
