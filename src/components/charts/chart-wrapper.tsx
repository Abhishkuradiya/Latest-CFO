"use client";

import React, { useEffect, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useThemeStore } from '@/store/theme-store';
import { Card, CardHeader, CardTitle, CardContent } from '../cards/card';
import { cn } from '@/lib/utils';

interface ChartWrapperProps {
  title?: string;
  option: any; // ECharts configuration object
  height?: number | string;
  className?: string;
  isLoading?: boolean;
}

export function ChartWrapper({
  title,
  option,
  height = 320,
  className,
  isLoading = false,
}: ChartWrapperProps) {
  const chartRef = useRef<ReactECharts>(null);
  const { theme } = useThemeStore();
  const [chartTheme, setChartTheme] = useState('light');

  // Sync theme with ECharts
  useEffect(() => {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setChartTheme(isDark ? 'dark' : 'light');
  }, [theme]);

  // Handle automatic chart resizing on layout toggle/window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        const echartsInstance = chartRef.current.getEchartsInstance();
        echartsInstance.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Custom event listener for sidebar transition triggers
    const sidebarToggleListener = () => {
      setTimeout(handleResize, 350); // Delay match sidebar collapse duration
    };
    window.addEventListener('sidebar-toggle', sidebarToggleListener);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebar-toggle', sidebarToggleListener);
    };
  }, []);

  const chartContent = (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}

      <ReactECharts
        ref={chartRef}
        option={{
          ...option,
          backgroundColor: 'transparent',
        }}
        theme={chartTheme}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'svg' }} // SVG renderer performs better on low-spec dashboards
      />
    </div>
  );

  if (title) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {chartContent}
        </CardContent>
      </Card>
    );
  }

  return <div className={cn("w-full bg-card rounded-lg border p-4", className)}>{chartContent}</div>;
}
