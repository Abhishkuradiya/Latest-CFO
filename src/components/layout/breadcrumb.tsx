"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumb() {
  const pathname = usePathname();
  const paths = pathname.split('/').filter(Boolean);

  if (paths.length === 0) {
    return (
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Home className="h-4 w-4 text-primary" />
        <span className="font-medium text-foreground">Overview</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link
        href="/overview"
        className="flex items-center gap-1 hover:text-foreground transition outline-none rounded focus-visible:ring-1 focus-visible:ring-primary"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {paths.map((path, idx) => {
        const url = `/${paths.slice(0, idx + 1).join('/')}`;
        const isLast = idx === paths.length - 1;
        const formattedName = path
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        return (
          <React.Fragment key={path}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            {isLast ? (
              <span className="font-semibold text-foreground" aria-current="page">
                {formattedName}
              </span>
            ) : (
              <Link
                href={url}
                className="hover:text-foreground transition outline-none rounded focus-visible:ring-1 focus-visible:ring-primary"
              >
                {formattedName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
