"use client";

import React, { Suspense } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ConnectorRouteGuard } from './connector-route-guard';
import { useSidebarStore } from '@/store/sidebar-store';

import { usePathname } from 'next/navigation';
import { PageLoadingSkeleton } from '@/components/common/loading-skeleton';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const isCopilotRoute = pathname?.startsWith('/cfo-copilot');
  const isManagementAccountsRoute = pathname === '/management-accounts';
  const isForecastRoute = pathname === '/forecast';
  const isSidebarCollapsed = useSidebarStore((state) => state.isCollapsed);

  const routesWithPageHeading = new Set([
    '/', '/overview', '/overview/revenue-debug', '/overview/cash-debug',
    '/tracking-categories', '/support', '/subscription', '/settings',
    '/settings/db-management', '/settings/business-health-score', '/settings/account-mappings',
    '/contacts', '/chart-of-accounts', '/revenue', '/cfo', '/cash-flow',
    '/cash-flow/13-week', '/reports/vendors', '/reports/trial-balance', '/budgeting',
    '/bookkeeping-health', '/kpi-scorecard', '/profitability', '/products',
    '/invoices/overdue', '/banking/accounts', '/forecast', '/automation', '/expenses',
    '/ap-ar-analytics', '/organizations', '/amazon', '/management-accounts',
    '/reports/cash-flow', '/alerts', '/reports/balance-sheet', '/reports/budget-actual',
    '/ai-insights', '/reports', '/reports/profit-and-loss', '/reports/customers',
    '/reports/tax-center', '/developer-amazon',
    '/xero-dashboard',
  ]);
  const fallbackPageTitles: Record<string, string> = {
    '/xero-dashboard': 'Executive Overview',
    '/sales': 'Sales Dashboard',
    '/stripe': 'Stripe Command Center',
    '/data-sources': 'Connectors',
    '/customers': 'Customers & Contacts',
    '/bills': 'Accounts Payable',
    '/invoices': 'Accounts Receivable',
    '/reports/account-receivable': 'Accounts Receivable',
    '/reports/aged-receivables': 'Aged Receivables',
    '/reports/invoice-status-summary': 'Invoice Status Summary',
    '/reports/bill-status-summary': 'Bill Status Summary',
    '/reports/chart-of-accounts': 'Chart of Accounts',
  };
  const routeLabel = pathname?.split('/').filter(Boolean).at(-1)?.replace(/[-_]/g, ' ');
  const pageTitle = fallbackPageTitles[pathname] ?? routeLabel?.replace(/\b\w/g, (character) => character.toUpperCase()) ?? 'Dashboard';

  if (isCopilotRoute) {
    return (
      <div className="h-dvh min-h-0 w-screen overflow-hidden bg-slate-50 text-slate-900 antialiased">
        <Suspense fallback={<div className="h-screen w-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans text-sm">Loading Virtual CFO Copilot...</div>}>
          <ConnectorRouteGuard>
            {children}
          </ConnectorRouteGuard>
        </Suspense>
      </div>
    );
  }

  return (
    <div className={isManagementAccountsRoute ? 'flex min-h-dvh w-full overflow-x-clip bg-background' : 'flex h-dvh min-h-0 w-screen overflow-hidden bg-background'}>
      {/* Sidebar navigation */}
      <Sidebar />

      {/* The desktop sidebar is fixed, so keep its width in the flex layout without adding a second offset. */}
      <div aria-hidden="true" className={`hidden md:block shrink-0 transition-[width] duration-300 ${isManagementAccountsRoute ? 'h-dvh' : 'h-full'} ${isSidebarCollapsed ? 'w-16' : 'w-64'}`} />

      {/* Main workspace frame */}
      <div className={`flex min-w-0 flex-1 flex-col ${isManagementAccountsRoute ? 'min-h-dvh' : 'min-h-0 overflow-hidden'}`}>
        {/* Top Navbar Header */}
        <div className={isManagementAccountsRoute ? 'sticky top-0 z-30 shrink-0' : 'shrink-0'}>
          <Suspense fallback={<div className="h-20 border-b border-slate-100 bg-white" />}>
            <Header />
          </Suspense>
        </div>

        {/* Dynamic page content scrollable area */}
        <main className={`min-w-0 flex-1 bg-background ${isManagementAccountsRoute ? 'overflow-visible px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8' : isForecastRoute ? 'min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 md:p-5' : 'min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-8'}`}>
          <div className={isManagementAccountsRoute ? 'mx-auto w-full max-w-none space-y-4 sm:space-y-6' : isForecastRoute ? 'mx-auto w-full max-w-none space-y-3' : 'mx-auto max-w-[1600px] space-y-8'}>
            {!routesWithPageHeading.has(pathname) && !isCopilotRoute && (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{pageTitle}</h1>
              </section>
            )}
            <Suspense fallback={<PageLoadingSkeleton />}>
              <ConnectorRouteGuard>
                {children}
              </ConnectorRouteGuard>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
