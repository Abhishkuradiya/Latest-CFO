"use client";

import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { usePathname, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme-store';
import { Search, FileText, Settings, ShieldCheck, RefreshCw, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import '@/styles/command-palette.css'; // Add specialized styles for clean styling

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useThemeStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    
    const handleCustomTrigger = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-command-palette', handleCustomTrigger);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-command-palette', handleCustomTrigger);
    };
  }, []);

  const runCommand = (command: () => void) => {
    command();
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm p-4 pt-[15vh]"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl animate-in fade-in-50 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global Command Menu">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Type a command or page name..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          
          <Command.List className="max-h-64 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              No results found.
            </Command.Empty>
            
            <Command.Group heading="Navigation" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
              <Command.Item
                onSelect={() => runCommand(() => router.push('/overview'))}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <FileText className="h-4 w-4" />
                Go to Overview
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/cash-flow'))}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <FileText className="h-4 w-4" />
                Go to Cash Flow
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => router.push('/settings'))}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <Settings className="h-4 w-4" />
                Go to Settings
              </Command.Item>
            </Command.Group>
            
            <Command.Group heading="Actions" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => runCommand(() => {
                  setTheme('light');
                  toast.success('Theme updated to light');
                })}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <Sun className="h-4 w-4" />
                Set Light Mode
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => {
                  setTheme('dark');
                  toast.success('Theme updated to dark');
                })}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <Moon className="h-4 w-4" />
                Set Dark Mode
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => {
                  toast.loading('Syncing external connectors...');
                  setTimeout(() => toast.success('Sync complete!'), 2000);
                })}
                className="flex items-center gap-2 rounded px-2.5 py-2 text-xs hover:bg-muted cursor-pointer transition"
              >
                <RefreshCw className="h-4 w-4" />
                Trigger Connectors Sync
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
