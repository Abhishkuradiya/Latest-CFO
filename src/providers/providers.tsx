"use client";

import React, { useEffect } from 'react';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { useThemeStore } from '@/store/theme-store';
import { CommandPalette } from '@/components/common/command-palette';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add('light');
    }
  }, [theme]);

  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <CommandPalette />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryProvider>
  );
}
