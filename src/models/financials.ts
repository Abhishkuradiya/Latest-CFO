export interface NormalizedTransaction {
  id: string;
  sourceConnectorId: string;
  sourceConnectorType: 'xero' | 'stripe' | 'shopify' | 'amazon' | 'quickbooks';
  amount: number;
  currency: string;
  timestamp: string;
  description: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  category?: string;
}

export interface NormalizedCustomer {
  id: string;
  sourceConnectorId: string;
  name: string;
  email?: string;
  country?: string;
  lifetimeValue: number;
  createdAt: string;
}

export interface FinancialMetric {
  metricId: string;
  name: string;
  value: number;
  changePercent: number; // trend percentage (e.g. +14.2%)
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
}

export interface BalanceSheet {
  date: string;
  assets: {
    current: number;
    nonCurrent: number;
    total: number;
  };
  liabilities: {
    current: number;
    nonCurrent: number;
    total: number;
  };
  equity: {
    retainedEarnings: number;
    shareCapital: number;
    total: number;
  };
}
