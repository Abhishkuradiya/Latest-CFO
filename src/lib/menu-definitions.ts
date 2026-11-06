export interface MenuDefinitionSubItem {
  name: string;
  href: string;
  connectorId?: string;
}

export interface MenuDefinitionItem {
  name: string;
  href: string;
  connectorId?: string;
  badge?: string;
  hasDropdown?: boolean;
  subItems?: MenuDefinitionSubItem[];
}

export interface MenuDefinitionSection {
  title?: string;
  items: MenuDefinitionItem[];
}

export const ALL_SYSTEM_ROLES = [
  { id: 'ALL', label: 'All Roles (Global Default)', badgeClass: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'SUPERADMIN', label: 'Super Admin', badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'ADMIN', label: 'Admin', badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'CFO', label: 'CFO / Executive', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'FINANCE_MANAGER', label: 'Finance Manager', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'CLIENT', label: 'Client / Viewer', badgeClass: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
];

export const SYSTEM_NAV_DEFINITIONS: MenuDefinitionSection[] = [
  {
    items: [
      { name: 'Dashboard Overview', href: '/overview' }
    ]
  },
  {
    title: 'CFO Intelligence',
    items: [
      { name: 'AI Financial Copilot', href: '/cfo-copilot', connectorId: 'xero', badge: 'AI' },
      { name: 'CFO Command Center', href: '/cfo', connectorId: 'xero' },
      { name: 'Executive Overview', href: '/xero-dashboard', connectorId: 'xero' },
      { name: 'Management Accounts', href: '/management-accounts', connectorId: 'xero' },
      { name: 'Forecast & Scenario', href: '/forecast', connectorId: 'xero' },
      { name: 'Budgeting & Variances', href: '/budgeting', connectorId: 'xero' },
      { name: 'Financial KPI Scorecard', href: '/kpi-scorecard', connectorId: 'xero' },
      { name: 'Profitability Analysis', href: '/profitability', connectorId: 'xero' },
      { name: '13-Week Cash Forecast', href: '/cash-flow/13-week', connectorId: 'xero' },
      { name: 'Bookkeeping Health', href: '/bookkeeping-health', connectorId: 'xero' }
    ]
  },
  {
    title: 'Xero Core & Sales',
    items: [
      { name: 'Revenue Dashboard', href: '/sales', connectorId: 'xero' },
      { name: 'Unified AP & AR Analytics', href: '/ap-ar-analytics', connectorId: 'xero' },
      { name: 'Accounts Receivable', href: '/invoices', connectorId: 'xero' },
      { name: 'Top Overdue Invoices', href: '/invoices/overdue', connectorId: 'xero' },
      { name: 'Accounts Payable', href: '/bills', connectorId: 'xero' },
      { name: 'Purchases & Expenses', href: '/expenses', connectorId: 'xero' }
    ]
  },
  {
    title: 'Financial Statements & Reports',
    items: [
      { name: 'Profit & Loss Statement', href: '/reports/profit-and-loss', connectorId: 'xero' },
      { name: 'Balance Sheet', href: '/reports/balance-sheet', connectorId: 'xero' },
      { name: 'Cash Flow Statement', href: '/reports/cash-flow', connectorId: 'xero' },
      { name: 'Trial Balance', href: '/reports/trial-balance', connectorId: 'xero' },
      { name: 'Budget vs Actual Report', href: '/reports/budget-actual', connectorId: 'xero' },
      { name: 'Tax Center', href: '/reports/tax-center', connectorId: 'xero' }
    ]
  },
  {
    title: 'Banking, Ledger & Directory',
    items: [
      { name: 'Bank Accounts', href: '/banking/accounts', connectorId: 'xero' },
      { name: 'Chart of Accounts', href: '/chart-of-accounts', connectorId: 'xero' },
      { name: 'Tracking Categories', href: '/tracking-categories', connectorId: 'xero' },
      { name: 'Customers Directory', href: '/reports/customers', connectorId: 'xero' },
      { name: 'Vendors Directory', href: '/reports/vendors', connectorId: 'xero' },
      { name: 'Contacts Management', href: '/contacts', connectorId: 'xero' },
      { name: 'Products & Inventory', href: '/products', connectorId: 'xero' }
    ]
  },
  {
    title: 'Integrations',
    items: [
      {
        name: 'Ecommerce Stores',
        href: '/amazon',
        hasDropdown: true,
        subItems: [
          { name: 'Amazon Store', href: '/amazon', connectorId: 'amazon' },
          { name: 'eBay Store', href: '/ebay', connectorId: 'ebay' },
          { name: 'Shopify Store', href: '/shopify', connectorId: 'shopify' },
          { name: 'WooCommerce', href: '/woocommerce', connectorId: 'woocommerce' },
          { name: 'Etsy Seller', href: '/etsy', connectorId: 'etsy' }
        ]
      },
      {
        name: 'Payment Gateways',
        href: '/stripe',
        hasDropdown: true,
        subItems: [
          { name: 'Stripe Payments', href: '/stripe', connectorId: 'stripe' },
          { name: 'PayPal Account', href: '/paypal', connectorId: 'paypal' },
          { name: 'Square Terminal', href: '/square', connectorId: 'square' },
          { name: 'Razorpay Global', href: '/razorpay', connectorId: 'razorpay' }
        ]
      }
    ]
  },
  {
    title: 'Dashboard Widgets & Features',
    items: [
      { 
        name: 'Business Health Score (Card & Configuration)', 
        href: '/settings/business-health-score',
        connectorId: 'xero',
        badge: 'Feature'
      }
    ]
  },
  {
    title: 'System & Automation',
    items: [
      { name: 'CFO AI Assistant (Side Drawer)', href: '/cfo-ai-drawer' },
      { name: 'Automation Cockpit', href: '/automation' },
      { name: 'Subscription & Billing', href: '/subscription' },
      { name: 'Connectors & Sources', href: '/data-sources' },
      { name: 'Settings', href: '/settings' },
      { name: 'Menu Control Center', href: '/admin/menu-control' }
    ]
  }
];
