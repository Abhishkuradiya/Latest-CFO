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
