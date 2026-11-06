import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface LoadingSkeletonProps {
  count?: number;
  height?: number | string;
  width?: number | string;
  circle?: boolean;
  className?: string;
}

export function LoadingSkeleton({
  count = 1,
  height,
  width,
  circle = false,
  className,
}: LoadingSkeletonProps) {
  return (
    <SkeletonTheme baseColor="var(--color-muted)" highlightColor="var(--color-accent)">
      <Skeleton
        count={count}
        height={height}
        width={width}
        circle={circle}
        className={className}
      />
    </SkeletonTheme>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-lg border p-6 space-y-3">
      <LoadingSkeleton height={14} width={80} />
      <LoadingSkeleton height={28} width={140} />
      <LoadingSkeleton height={12} width={110} />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="space-y-2.5 w-full">
      <LoadingSkeleton height={32} />
      <LoadingSkeleton height={24} count={5} />
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} aria-hidden="true" />;
}

/** Page-shaped loading state used while dashboard routes are being resolved. */
export function PageLoadingSkeleton({ variant = 'dashboard' }: { variant?: 'dashboard' | 'forecast' | 'cash' }) {
  const cardCount = variant === 'cash' ? 6 : 5;

  return (
    <div role="status" aria-label="Loading page content" className="w-full space-y-5">
      <span className="sr-only">Loading page content</span>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-7 w-72 max-w-[70vw]" />
          <SkeletonBlock className="h-3 w-96 max-w-[80vw]" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-28" />
          <SkeletonBlock className="h-9 w-24" />
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cardCount === 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-4 h-7 w-32" />
            <SkeletonBlock className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="mt-5 h-64 w-full" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-4 w-36" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
