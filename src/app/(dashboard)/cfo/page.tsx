import React from 'react';
import { CfoExecutiveDashboard } from '@/components/dashboard/cfo/CfoExecutiveDashboard';
import { getTenantIdFromSession } from '@/lib/auth';

export const metadata = {
  title: 'CFO Intelligence Command Center | Virtual CFO Platform',
  description: 'Executive financial overview, profitability waterfall, liquidity snapshot, and real-time CFO decision engine.'
};

export default async function CfoDashboardPage() {
  const tenantId = await getTenantIdFromSession();
  return <CfoExecutiveDashboard initialTenantId={tenantId ? String(tenantId) : ''} />;
}
