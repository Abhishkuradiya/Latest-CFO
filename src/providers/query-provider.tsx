"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/api/clients/api-client';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes stale time for financial metrics
            gcTime: 10 * 60 * 1000,   // 10 minutes cache garbage collection
            refetchOnWindowFocus: false, // Prevents excessive API hits on tab switching
            retry: (failureCount, error) => {
              // Only retry up to 2 times for networks errors, skip for client auth errors
              if (error instanceof ApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            onError: (error) => {
              const errMsg = error instanceof Error ? error.message : 'Action failed';
              toast.error(`Operation error: ${errMsg}`);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
