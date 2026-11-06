export const CONNECTOR_NAMES: Record<string, string> = {
  xero: 'Xero Integration',
  amazon: 'Amazon Seller Central',
  ebay: 'eBay Seller Central',
  shopify: 'Shopify Store',
  woocommerce: 'WooCommerce',
  etsy: 'Etsy Seller',
  stripe: 'Stripe Payments',
  paypal: 'PayPal Settlement',
  square: 'Square Payments',
  razorpay: 'Razorpay Global'
};

export const ROUTE_CONNECTOR_MAP: Record<string, { connector: string; name: string }> = {
  // Xero Dashboard & Accounting Routes
  '/xero-dashboard': { connector: 'xero', name: 'Xero Integration' },
  '/bookkeeping-health': { connector: 'xero', name: 'Xero Integration' },
  '/sales': { connector: 'xero', name: 'Xero Integration' },
  '/ap-ar-analytics': { connector: 'xero', name: 'Xero Integration' },
  '/ap-ar-simple': { connector: 'xero', name: 'Xero Integration' },
  '/invoices': { connector: 'xero', name: 'Xero Integration' },
  '/invoices/overdue': { connector: 'xero', name: 'Xero Integration' },
  '/bills': { connector: 'xero', name: 'Xero Integration' },
  '/expenses': { connector: 'xero', name: 'Xero Integration' },
  '/reports': { connector: 'xero', name: 'Xero Integration' },
  '/reports/profit-and-loss': { connector: 'xero', name: 'Xero Integration' },
  '/reports/balance-sheet': { connector: 'xero', name: 'Xero Integration' },
  '/reports/cash-flow': { connector: 'xero', name: 'Xero Integration' },
  '/reports/trial-balance': { connector: 'xero', name: 'Xero Integration' },
  '/reports/budget-actual': { connector: 'xero', name: 'Xero Integration' },
  '/reports/tax-center': { connector: 'xero', name: 'Xero Integration' },
  '/reports/customers': { connector: 'xero', name: 'Xero Integration' },
  '/reports/vendors': { connector: 'xero', name: 'Xero Integration' },
  '/banking/accounts': { connector: 'xero', name: 'Xero Integration' },
  '/chart-of-accounts': { connector: 'xero', name: 'Xero Integration' },
  '/tracking-categories': { connector: 'xero', name: 'Xero Integration' },
  '/contacts': { connector: 'xero', name: 'Xero Integration' },
  '/products': { connector: 'xero', name: 'Xero Integration' },

  // Fathom CFO Intelligence & Analytics Routes
  '/profitability': { connector: 'xero', name: 'Xero Integration' },
  '/kpi-scorecard': { connector: 'xero', name: 'Xero Integration' },
  '/cash-flow/13-week': { connector: 'xero', name: 'Xero Integration' },
  '/budgeting': { connector: 'xero', name: 'Xero Integration' },

  // Ecommerce Routes
  '/amazon': { connector: 'amazon', name: 'Amazon Seller Central' },
  '/ebay': { connector: 'ebay', name: 'eBay Seller Central' },
  '/shopify': { connector: 'shopify', name: 'Shopify Store' },
  '/woocommerce': { connector: 'woocommerce', name: 'WooCommerce' },
  '/etsy': { connector: 'etsy', name: 'Etsy Seller' },

  // Payment Gateways Routes
  '/stripe': { connector: 'stripe', name: 'Stripe Payments' },
  '/paypal': { connector: 'paypal', name: 'PayPal Settlement' },
  '/square': { connector: 'square', name: 'Square Payments' },
  '/razorpay': { connector: 'razorpay', name: 'Razorpay Global' }
};

export function getRequiredConnector(pathname: string): { connector: string; name: string } | null {
  if (!pathname) return null;

  // Exact match
  if (ROUTE_CONNECTOR_MAP[pathname]) {
    return ROUTE_CONNECTOR_MAP[pathname];
  }

  // Subpath prefix checks
  if (pathname.startsWith('/reports/')) return { connector: 'xero', name: 'Xero Integration' };
  if (pathname.startsWith('/banking/')) return { connector: 'xero', name: 'Xero Integration' };
  if (pathname.startsWith('/invoices/')) return { connector: 'xero', name: 'Xero Integration' };
  if (pathname.startsWith('/cash-flow/')) return { connector: 'xero', name: 'Xero Integration' };
  if (pathname.startsWith('/amazon')) return { connector: 'amazon', name: 'Amazon Seller Central' };
  if (pathname.startsWith('/ebay')) return { connector: 'ebay', name: 'eBay Seller Central' };
  if (pathname.startsWith('/shopify')) return { connector: 'shopify', name: 'Shopify Store' };
  if (pathname.startsWith('/stripe')) return { connector: 'stripe', name: 'Stripe Payments' };
  if (pathname.startsWith('/paypal')) return { connector: 'paypal', name: 'PayPal Settlement' };

  return null;
}
