"use client";

import React, { useEffect, useState } from 'react';
import { AgGridReact, AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { useThemeStore } from '@/store/theme-store';
import { cn } from '@/lib/utils';

// Import AG Grid core CSS
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register standard ClientSideRowModelModule
ModuleRegistry.registerModules([ClientSideRowModelModule]);

// Dynamic license key injection if available
const LICENSE_KEY = process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY;
if (LICENSE_KEY && typeof window !== 'undefined') {
  // Enterprise features automatically unlock when the license key is valid
  (ModuleRegistry as any).setLicenseKey?.(LICENSE_KEY);
}

interface TableWrapperProps<TData = any> extends AgGridReactProps<TData> {
  containerClassName?: string;
  isLoading?: boolean;
}

export function TableWrapper<TData = any>({
  rowData,
  columnDefs,
  containerClassName,
  isLoading = false,
  ...props
}: TableWrapperProps<TData>) {
  const { theme } = useThemeStore();
  const [gridTheme, setGridTheme] = useState('ag-theme-alpine');

  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setGridTheme(isDark ? 'ag-theme-alpine-dark' : 'ag-theme-alpine');
  }, [theme]);

  return (
    <div className={cn("relative w-full h-[400px] border rounded-lg overflow-hidden bg-card", containerClassName)}>
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Loading records...</span>
          </div>
        </div>
      ) : null}

      <div className={cn("w-full h-full", gridTheme)}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
            minWidth: 100,
            ...props.defaultColDef,
          }}
          rowHeight={46}
          headerHeight={44}
          animateRows={true}
          pagination={true}
          paginationPageSize={10}
          {...props}
        />
      </div>
    </div>
  );
}
