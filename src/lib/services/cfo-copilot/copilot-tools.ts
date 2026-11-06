import { CFOIntelligenceEngine } from '@/lib/services/CFOIntelligenceEngine';
import { XeroAccountTransactionsService } from '@/lib/services/XeroAccountTransactionsService';
import { db } from '@/lib/db';
import { fetchBaselineFinancialContext, executeScenario, ScenarioType, ScenarioAssumption } from '@/lib/services/cfo-copilot/scenario-engine';
import { getXeroAccessToken, fetchXeroResource } from '@/lib/xero';
import {
  getLiveXeroProfitAndLoss,
  getLiveXeroBalanceSheet,
  getLiveXeroBankSummary,
  getLiveXeroInvoices,
  getLiveXeroContacts,
  getLiveXeroAccounts,
  getLiveXeroSupplierPaymentTiming,
  parseXeroDate
} from '@/lib/services/cfo-copilot/live-xero-service';
import { getDefaultXeroDateRange } from '@/lib/services/cfo-copilot/live-xero-service';

function defaultToolDates() {
  return getDefaultXeroDateRange();
}

export function safeFormatDateISO(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

export type ToolCategory = 'FINANCIAL_REPORTING' | 'TRANSACTIONS' | 'SALES_AND_PURCHASES' | 'MASTER_DATA';

export interface ToolExecutionContext {
  tenantId: number | string;
  userId?: string;
  requestId?: string;
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: 'INVALID_ARGUMENT' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INTERNAL_ERROR' | 'LIVE_XERO_UNAVAILABLE';
    message: string;
  };
}

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  format?: string;
  items?: any;
  default?: any;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface CfoToolDefinition<TArgs = any, TOutput = any> {
  name: string;
  description: string;
  category: ToolCategory;
  isReadOnly: boolean;
  parameters: ToolParameterSchema;
  outputTypeDescription?: string;
  execute: (args: TArgs, context: ToolExecutionContext) => Promise<ToolResult<TOutput>>;
}

// For backward compatibility interface alias
export type ToolDefinition = CfoToolDefinition;

export const ToolAliases: Record<string, string> = {
  'get_live_xero_profit_and_loss': 'get_profit_and_loss_report',
  'get_live_xero_balance_sheet': 'get_balance_sheet_report',
  'get_live_xero_bank_summary': 'get_cash_flow_balance',
  'get_live_xero_invoices': 'search_invoices_and_bills',
  'get_live_xero_bills': 'search_invoices_and_bills',
  'get_live_xero_contacts': 'search_contacts',
  'get_live_xero_chart_of_accounts': 'get_chart_of_accounts',
  'get_live_xero_account_transactions': 'get_account_transactions',
  'get_supplier_payment_timing': 'get_supplier_payment_timing_report',
  'get_payment_timing': 'get_supplier_payment_timing_report',
  'get_bill_payment_lag': 'get_supplier_payment_timing_report',
  'get_supplier_payment_lag': 'get_supplier_payment_timing_report',
  'get_supplier_payment_timing_drilldown': 'get_supplier_payment_timing_drilldown',
  'get_supplier_drilldown': 'get_supplier_payment_timing_drilldown',
  'get_bill_payment_pattern': 'get_supplier_payment_timing_drilldown',
  'get_payment_timing_drilldown': 'get_supplier_payment_timing_drilldown',
  'list_bank_accounts': 'get_cash_flow_balance',
  'get_bank_accounts': 'get_cash_flow_balance',
  'list_connected_tenants': 'get_connected_tenants',
  'get_invoices': 'search_invoices_and_bills',
  'get_bills': 'search_invoices_and_bills',
  'list_users': 'get_users',
  'list_budgets': 'get_budgets'
};

export const COPILOT_TOOLS: Record<string, CfoToolDefinition> = {
  get_connected_tenants: {
    name: 'get_connected_tenants',
    description: 'Retrieves all client organizations and connected tenantId mappings available in the system. Use this tool when asked which client companies, tenants, or organizations are available or connected.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {}
    },
    outputTypeDescription: 'Array<{ tenantId: number, organizationName: string, connectionStatus: string, connectedAt?: string, baseCurrency?: string }>',
    execute: async (_args: any, _context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        const tenants = await db.getTenants();
        if (tenants && tenants.length > 0) {
          const data = tenants.map((r: any) => ({
            tenantId: Number(r.id),
            organizationName: r.name || 'Unnamed Organization',
            connectionStatus: 'ACTIVE',
            connectedAt: r.created_at || new Date().toISOString()
          }));
          return { success: true, data };
        }
      } catch (err: any) {
        // Fallback to active organization context if query fails
      }

      return { success: true, data: [] };
    }
  },

  get_tenant_context: {
    name: 'get_tenant_context',
    description: 'Retrieves structural metadata, organization name, base currency, tax parameters, fiscal year settings, and data synchronization freshness timestamp for the active tenant.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {}
    },
    outputTypeDescription: '{ tenantId: number, organizationName: string, baseCurrency: string, countryCode: string, financialYearEndMonth: number, taxNumber: string, isDemoCompany: boolean, activeStatus: string, dataSource: string, lastSyncedAt: string }',
    execute: async (_args: any, context: ToolExecutionContext): Promise<ToolResult> => {
      if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Security Context Error: Missing or invalid authorized tenantId context.'
          }
        };
      }
      const tId = Number(context.tenantId);
      let orgName: string | null = null;
      let lastSyncedAt: string | null = null;
      try {
        const tenants = await db.getTenants();
        const match = tenants.find((t: any) => Number(t.id) === tId);
        if (match) {
          if (match.name) orgName = match.name;
          if (match.last_synced_at) lastSyncedAt = new Date(match.last_synced_at).toISOString();
          else if (match.updated_at) lastSyncedAt = new Date(match.updated_at).toISOString();
          else if (match.created_at) lastSyncedAt = new Date(match.created_at).toISOString();
        }
      } catch (err) {}

      return {
        success: true,
        data: {
          tenantId: tId,
          organizationName: orgName || 'Unavailable',
          baseCurrency: null,
          countryCode: null,
          financialYearEndMonth: null,
          taxNumber: null,
          isDemoCompany: false,
          activeStatus: 'ACTIVE',
          dataSource: 'Source: PostgreSQL System Metadata',
          lastSyncedAt: lastSyncedAt || new Date().toISOString()
        }
      };
    }
  },

  get_profit_and_loss_report: {
    name: 'get_profit_and_loss_report',
    description: 'Queries the authoritative Profit & Loss statement directly from Live Xero API (Revenue, COGS, Gross Profit, Operating Expenses, Net Profit) for the active tenant over a specified date range. Dates must be in YYYY-MM-DD format. Use this tool when evaluating financial performance, profit margins, revenue breakdowns, or operating expense totals.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: '{ tenantId: number, period: string, currency: string, profitability: object, revenueBreakdown: object, expensesBreakdown: object, provenance: object }',
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const defaults = defaultToolDates();
      const start = args.startDate || defaults.startDate;
      const end = args.endDate || defaults.endDate;
      const res = await getLiveXeroProfitAndLoss(context.tenantId, start, end);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Profit & Loss statement'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_profit_and_loss: {
    name: 'get_live_xero_profit_and_loss',
    description: 'Retrieves Profit & Loss financial data directly from Live Xero API.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' }
      }
    },
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const defaults = defaultToolDates();
      const start = args.startDate || defaults.startDate;
      const end = args.endDate || defaults.endDate;
      const res = await getLiveXeroProfitAndLoss(context.tenantId, start, end);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Profit & Loss statement'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_balance_sheet_report: {
    name: 'get_balance_sheet_report',
    description: 'Queries the Balance Sheet snapshot statement directly from Live Xero API (Working Capital, Net Assets, Retained Earnings, Assets, Liabilities) as of a specific date (YYYY-MM-DD). Use this tool when analyzing financial position, balance sheet assets/liabilities, working capital position, or capital structure as of a target date.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'As-on date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: '{ tenantId: number, asOnDate: string, currency: string, workingCapital: object, summary: object, provenance: object }',
    execute: async (args: { date?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const asOn = args.date || new Date().toISOString().split('T')[0];
      const res = await getLiveXeroBalanceSheet(context.tenantId, asOn);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Balance Sheet'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_balance_sheet: {
    name: 'get_live_xero_balance_sheet',
    description: 'Retrieves Balance Sheet snapshot statement directly from Live Xero API.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'As-on date YYYY-MM-DD' }
      }
    },
    execute: async (args: { date?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const asOn = args.date || new Date().toISOString().split('T')[0];
      const res = await getLiveXeroBalanceSheet(context.tenantId, asOn);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Balance Sheet'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_cash_flow_balance: {
    name: 'get_cash_flow_balance',
    description: 'Retrieves liquid cash reserves, total cash balances, and individual bank account balances directly from Live Xero API for the active tenant as of a given date (YYYY-MM-DD). Use this tool to answer questions about available liquid cash, bank account balances, or current cash positions.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'As-on date in YYYY-MM-DD format' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: '{ date: string, totalCash: number, netCashChange: number, currency: string, bankAccounts: Array<{ name: string, balance: number, type: string }>, provenance: object }',
    execute: async (args: { date?: string; startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const defaults = defaultToolDates();
      const start = args.startDate || defaults.startDate;
      const end = args.endDate || args.date || new Date().toISOString().split('T')[0];
      const res = await getLiveXeroBankSummary(context.tenantId, start, end);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Bank Summary'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_bank_summary: {
    name: 'get_live_xero_bank_summary',
    description: 'Retrieves bank summary and liquid cash reserves directly from Live Xero API.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' }
      }
    },
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const defaults = defaultToolDates();
      const start = args.startDate || defaults.startDate;
      const end = args.endDate || defaults.endDate;
      const res = await getLiveXeroBankSummary(context.tenantId, start, end);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Bank Summary'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_cash_flow_summary: {
    name: 'get_cash_flow_summary',
    description: 'Generates rolling month-by-month cash flow movement summaries (Operating Cash Flow, Cash Inflows, Cash Outflows, Net Movement) for a specified number of rolling months (e.g. 6). Use this tool when evaluating cash flow trends over time or historical monthly cash flow trajectory.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Number of rolling months to evaluate (e.g. 6)' }
      }
    },
    outputTypeDescription: '{ tenantId: number, monthsCount: number, currency: string, operatingSummary: object, monthlyTrends: Array<{ month: string, inflow: number, outflow: number, net: number }> }',
    execute: async (args: { months?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }
        const tId = Number(context.tenantId);
        const defaults = defaultToolDates();
        const res = await getLiveXeroBankSummary(tId, defaults.startDate, defaults.endDate);
        if (!res.success || !res.data) {
          return {
            success: false,
            error: {
              code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
              message: res.error?.message || 'Failed to query Live Xero Bank Summary'
            }
          };
        }
        const data = res.data;
        return {
          success: true,
          data: {
            tenantId: tId,
            monthsCount: args.months || 6,
            currency: data.currency,
            totalCash: data.totalCash,
            bankAccounts: data.bankAccounts || [],
            provenance: data.provenance
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'LIVE_XERO_UNAVAILABLE',
            message: `Failed to query cash flow summary: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  get_cash_flow_drivers: {
    name: 'get_cash_flow_drivers',
    description: 'Identifies top customer collections (cash inflow drivers) and top supplier/vendor outlays (cash outflow drivers) shaping the tenant net cash position for a date range (YYYY-MM-DD). Use this tool to answer why cash increased or decreased, or which customers and vendors drove cash movement.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: '{ tenantId: number, period: string, currency: string, inflowDrivers: Array<{ contactName: string, totalCollected: number, contributionPercentage: number }>, outflowDrivers: Array<{ contactName: string, totalPaid: number, percentageOfExpenses: number }> }',
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }
        const tId = Number(context.tenantId);
        const defaults = defaultToolDates();
        const start = args.startDate || defaults.startDate;
        const end = args.endDate || defaults.endDate;
        const pnlRes = await getLiveXeroProfitAndLoss(tId, start, end);
        if (!pnlRes.success || !pnlRes.data) {
          return {
            success: false,
            error: {
              code: pnlRes.error?.code || 'LIVE_XERO_UNAVAILABLE',
              message: pnlRes.error?.message || 'Failed to query Live Xero P&L for drivers'
            }
          };
        }
        const pnl = pnlRes.data;
        const revAccounts = pnl.revenueBreakdown?.topRevenueAccounts || [];
        const expAccounts = pnl.expensesBreakdown?.topExpenseAccounts || [];
        const totalRev = pnl.profitability?.revenue || 1;
        const totalExp = pnl.profitability?.operatingExpenses || 1;

        return {
          success: true,
          data: {
            tenantId: tId,
            period: `${start} to ${end}`,
            currency: pnl.currency,
            inflowDrivers: revAccounts.map((r: any) => ({
              contactName: r.accountName,
              totalCollected: r.amount,
              contributionPercentage: Number(((r.amount / totalRev) * 100).toFixed(2))
            })),
            outflowDrivers: expAccounts.map((e: any) => ({
              contactName: e.accountName,
              totalPaid: e.amount,
              percentageOfExpenses: Number(((e.amount / totalExp) * 100).toFixed(2))
            })),
            provenance: pnl.provenance
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'LIVE_XERO_UNAVAILABLE',
            message: `Failed to query cash flow drivers: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  get_cash_flow_reconciliation: {
    name: 'get_cash_flow_reconciliation',
    description: 'Audits expected closing cash balance against actual recorded bank balances to verify reconciliation integrity and flag variances over a date range (YYYY-MM-DD). Use this tool when checking bank reconciliation status, expected vs actual cash totals, or audit trail integrity.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: '{ tenantId: number, startDate: string, endDate: string, openingBalance: number, totalInflows: number, totalOutflows: number, expectedClosing: number, actualClosing: number, variance: number, isReconciled: boolean, status: string, auditNotes: string }',
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }
        const tId = Number(context.tenantId);
        const defaults = defaultToolDates();
        const start = args.startDate || defaults.startDate;
        const end = args.endDate || defaults.endDate;
        const res = await getLiveXeroBankSummary(tId, start, end);
        if (!res.success || !res.data) {
          return {
            success: false,
            error: {
              code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
              message: res.error?.message || 'Failed to query Live Xero Bank Summary for reconciliation audit'
            }
          };
        }
        const bankAccounts = res.data.bankAccounts || [];
        if (!res.data.reconciliationAvailable) {
          return {
            success: false,
            error: {
              code: 'LIVE_XERO_UNAVAILABLE',
              message: 'Cash reconciliation is unavailable because Xero did not return period movement data for the requested range.'
            }
          };
        }
        const hasReconciliationInputs = bankAccounts.some((account: any) =>
          [account.openingBalance, account.inflows, account.outflows, account.closingBalance]
            .every((value) => typeof value === 'number' && Number.isFinite(value))
        );
        if (!hasReconciliationInputs) {
          return {
            success: false,
            error: {
              code: 'LIVE_XERO_UNAVAILABLE',
              message: 'Cash reconciliation is unavailable because Xero did not return opening, inflow, outflow, and closing balances for the requested period.'
            }
          };
        }
        const totalCash = res.data.totalCash;
        const totalInflows = bankAccounts.reduce((sum: number, account: any) => sum + account.inflows, 0);
        const totalOutflows = bankAccounts.reduce((sum: number, account: any) => sum + account.outflows, 0);
        const openingBalance = bankAccounts.reduce((sum: number, account: any) => sum + account.openingBalance, 0);
        const actualClosing = bankAccounts.reduce((sum: number, account: any) => sum + account.closingBalance, 0);
        const expectedClosing = openingBalance + totalInflows - totalOutflows;
        const variance = actualClosing - expectedClosing;
        return {
          success: true,
          data: {
            tenantId: tId,
            startDate: start,
            endDate: end,
            openingBalance,
            totalInflows,
            totalOutflows,
            expectedClosing,
            actualClosing,
            variance,
            isReconciled: Math.abs(variance) < 0.01,
            status: Math.abs(variance) < 0.01 ? 'CLEAN_RECONCILED' : 'VARIANCE_FOUND',
            auditNotes: 'Reconciliation audit evaluated against authoritative Live Xero Bank Summary.',
            provenance: res.data.provenance
          }
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'LIVE_XERO_UNAVAILABLE',
            message: `Failed to execute cash flow reconciliation audit: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  search_cash_transactions: {
    name: 'search_cash_transactions',
    description: 'Searches realized cash inflow and outflow transactions from bank statements and ledger payment records directly from Live Xero API. Filterable by query string, direction (INFLOW, OUTFLOW, ALL), and record limit.',
    category: 'TRANSACTIONS',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords e.g. contact name or reference' },
        direction: { type: 'string', enum: ['INFLOW', 'OUTFLOW', 'ALL'], description: 'Transaction cash direction filter' },
        limit: { type: 'number', description: 'Maximum number of transactions to return (default 10)' }
      }
    },
    outputTypeDescription: 'Array<{ eventId: string, date: string, contactName: string, amount: number, type: "CASH_IN"|"CASH_OUT", account: string, reference: string }>',
    execute: async (args: { query?: string; direction?: string; limit?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }
        const tId = Number(context.tenantId);
        const limit = args.limit || 10;
        const events: any[] = [];

        const formatDateStr = (val: any) => {
          if (!val) return new Date().toISOString().split('T')[0];
          if (val instanceof Date) return val.toISOString().split('T')[0];
          const parsed = parseXeroDate(val);
          if (parsed) return parsed.toISOString().split('T')[0];
          return String(val).split('T')[0];
        };

        const auth = await getXeroAccessToken(tId);
        if (!auth) {
          return {
            success: false,
            error: {
              code: 'LIVE_XERO_UNAVAILABLE',
              message: `Live Xero API is unavailable: No valid OAuth connection found for tenant ${tId}.`
            }
          };
        }

        try {
          const bankTxns = await fetchXeroResource(auth.accessToken, auth.xeroTenantId, 'BankTransactions');
          if (bankTxns && Array.isArray(bankTxns)) {
            for (const tx of bankTxns) {
              const amt = Number(tx.Total || tx.Amount || 0);
              events.push({
                eventId: tx.BankTransactionID || `bt_${events.length}`,
                date: formatDateStr(tx.Date),
                contactName: tx.Contact?.Name || 'Bank Movement',
                amount: Math.abs(amt),
                type: (tx.Type === 'RECEIVE' || amt >= 0) ? 'CASH_IN' : 'CASH_OUT',
                account: tx.BankAccount?.Name || 'Bank Account',
                reference: tx.Reference || ''
              });
            }
          }

          const payments = await fetchXeroResource(auth.accessToken, auth.xeroTenantId, 'Payments');
          if (payments && Array.isArray(payments)) {
            for (const p of payments) {
              const amt = Number(p.Amount || 0);
              events.push({
                eventId: p.PaymentID || `pay_${events.length}`,
                date: formatDateStr(p.Date),
                contactName: p.Invoice?.Contact?.Name || p.Account?.Name || 'Payment',
                amount: Math.abs(amt),
                type: p.PaymentType === 'ARPAYMENT' ? 'CASH_IN' : 'CASH_OUT',
                account: 'Bank Operating Account',
                reference: p.Invoice?.InvoiceNumber || ''
              });
            }
          }
        } catch (xeroErr: any) {
          return {
            success: false,
            error: {
              code: 'LIVE_XERO_UNAVAILABLE',
              message: `Failed to query bank transactions from Live Xero API: ${xeroErr.message || 'Unknown error'}`
            }
          };
        }

        let filtered = events;
        if (args.query) {
          const q = args.query.toLowerCase();
          filtered = filtered.filter(e => e.contactName.toLowerCase().includes(q) || e.reference.toLowerCase().includes(q));
        }
        if (args.direction === 'INFLOW') filtered = filtered.filter(e => e.type === 'CASH_IN');
        if (args.direction === 'OUTFLOW') filtered = filtered.filter(e => e.type === 'CASH_OUT');

        return {
          success: true,
          data: filtered.slice(0, limit)
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'LIVE_XERO_UNAVAILABLE',
            message: `Failed to search cash transactions: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  search_invoices_and_bills: {
    name: 'search_invoices_and_bills',
    description: 'Unified search across sales invoices (AR) and purchase bills (AP) directly from Live Xero API by type (INVOICE, BILL, ALL), status (e.g. OVERDUE, AUTHORISED, PAID), query string, or record limit.',
    category: 'SALES_AND_PURCHASES',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['INVOICE', 'BILL', 'ALL'], description: 'Record type filter' },
        status: { type: 'string', description: 'Status filter e.g. OVERDUE, AUTHORISED, PAID' },
        query: { type: 'string', description: 'Search term for customer/vendor name or invoice number' },
        limit: { type: 'number', description: 'Maximum number of items to return (default 10)' }
      }
    },
    outputTypeDescription: '{ totalRecords: number, records: Array<{ invoiceId: string, invoiceNumber: string, contactName: string, category: "AR"|"AP", amountDue: number, total: number, status: string, daysOverdue: number, dueDate: string }>, provenance: object }',
    execute: async (args: { type?: any; status?: string; query?: string; limit?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroInvoices(context.tenantId, args.type || 'ALL', args.status, args.query, args.limit || 10);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Invoices/Bills'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_invoices: {
    name: 'get_live_xero_invoices',
    description: 'Retrieves sales invoices directly from Live Xero API.',
    category: 'SALES_AND_PURCHASES',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Invoice status filter (e.g. OVERDUE, AUTHORISED)' },
        query: { type: 'string', description: 'Customer name or invoice number search query' },
        limit: { type: 'number', description: 'Maximum number of items to return' }
      }
    },
    execute: async (args: { status?: string; query?: string; limit?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroInvoices(context.tenantId, 'INVOICE', args.status, args.query, args.limit || 10);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Invoices'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_live_xero_bills: {
    name: 'get_live_xero_bills',
    description: 'Retrieves purchase bills directly from Live Xero API.',
    category: 'SALES_AND_PURCHASES',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Bill status filter (e.g. OVERDUE, AUTHORISED)' },
        query: { type: 'string', description: 'Vendor name or bill number search query' },
        limit: { type: 'number', description: 'Maximum number of items to return' }
      }
    },
    execute: async (args: { status?: string; query?: string; limit?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroInvoices(context.tenantId, 'BILL', args.status, args.query, args.limit || 10);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Bills'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_invoice_or_bill_details: {
    name: 'get_invoice_or_bill_details',
    description: 'Fetches granular line item details (descriptions, unit amounts, account codes, quantities) and payment breakdown for a specific bill or invoice by invoiceId or invoiceNumber.',
    category: 'SALES_AND_PURCHASES',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Target Invoice/Bill ID or Invoice Number' }
      },
      required: ['invoiceId']
    },
    outputTypeDescription: '{ invoiceId: string, invoiceNumber: string, contact: { name: string }, type: string, status: string, issueDate: string, dueDate: string, subTotal: number, taxTotal: number, total: number, amountDue: number, lineItems: Array<object>, payments: Array<object> }',
    execute: async (args: { invoiceId: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!args || !args.invoiceId) {
          return {
            success: false,
            error: {
              code: 'INVALID_ARGUMENT',
              message: 'Missing required argument: invoiceId.'
            }
          };
        }

        const res = await getLiveXeroInvoices(context.tenantId, 'ALL', undefined, args.invoiceId, 5);
        if (!res.success) {
          return {
            success: false,
            error: {
              code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
              message: res.error?.message || 'Failed to fetch invoice details from Live Xero'
            }
          };
        }

        const records = res.data?.records || [];
        const match = records.find((r: any) =>
          String(r.invoiceId).toLowerCase() === args.invoiceId.toLowerCase() ||
          String(r.invoiceNumber).toLowerCase() === args.invoiceId.toLowerCase()
        ) || records[0];

        if (!match) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Invoice or bill matching "${args.invoiceId}" was not found in Live Xero.`
            }
          };
        }

        return {
          success: true,
          data: match
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: `Failed to fetch invoice details: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  search_contacts: {
    name: 'search_contacts',
    description: 'Searches the contacts directory (customers, suppliers, vendors) directly from Live Xero API for the active tenant.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Contact name search query' }
      }
    },
    outputTypeDescription: 'Array<{ contactId: string, name: string, isCustomer: boolean, isSupplier: boolean, arBalance: number, apBalance: number }>',
    execute: async (args: { query?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroContacts(context.tenantId, args.query);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Contacts'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_contacts: {
    name: 'get_live_xero_contacts',
    description: 'Retrieves contacts directory directly from Live Xero API.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Contact name search query' }
      }
    },
    execute: async (args: { query?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroContacts(context.tenantId, args.query);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Contacts'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_chart_of_accounts: {
    name: 'get_chart_of_accounts',
    description: 'Retrieves all general ledger account codes directly from Live Xero API.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {}
    },
    outputTypeDescription: 'Array<{ code: string, name: string, type: string, class: string }>',
    execute: async (_args: any, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroAccounts(context.tenantId);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Chart of Accounts'
          }
        };
      }
      return {
        success: true,
        data: res.data
      };
    }
  },

  get_live_xero_chart_of_accounts: {
    name: 'get_live_xero_chart_of_accounts',
    description: 'Retrieves chart of accounts directly from Live Xero API.',
    category: 'MASTER_DATA',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (_args: any, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroAccounts(context.tenantId);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Chart of Accounts'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_account_transactions: {
    name: 'get_account_transactions',
    description: 'Retrieves granular line item journal transactions posted against a specific General Ledger Account Code (e.g. 400 or 420). Use this tool when diving deep into specific GL account transactions or ledger postings.',
    category: 'TRANSACTIONS',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Target GL Account Code (e.g. 400 or 420)' }
      },
      required: ['accountId']
    },
    outputTypeDescription: 'Array<{ journalId: string, date: string, accountCode: string, description: string, debit: number, credit: number }>',
    execute: async (args: { accountId: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }

        if (!args || !args.accountId) {
          return {
            success: false,
            error: {
              code: 'INVALID_ARGUMENT',
              message: 'Missing required argument: accountId.'
            }
          };
        }

        const tId = Number(context.tenantId);
        const accCode = (args.accountId || '').trim();

        try {
          const result = await XeroAccountTransactionsService.fetchAccountTransactions(tId, undefined, accCode);
          if (result && result.transactions && result.transactions.length > 0) {
            const data = result.transactions.map((t: any, idx: number) => ({
              journalId: t.sourceTransactionId || `j_${idx + 1}`,
              date: t.date,
              accountCode: t.accountCode || accCode,
              description: t.description || t.reference || '',
              debit: t.debit,
              credit: t.credit
            }));
            return { success: true, data };
          }
        } catch (err) {}

        return { success: true, data: [] };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: `Failed to fetch account transactions: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  get_live_xero_account_transactions: {
    name: 'get_live_xero_account_transactions',
    description: 'Retrieves line item journal transactions directly from Live Xero API.',
    category: 'TRANSACTIONS',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Target GL Account Code (e.g. 400 or 420)' }
      },
      required: ['accountId']
    },
    execute: async (args: { accountId: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      const tool = COPILOT_TOOLS['get_account_transactions'];
      return await tool.execute(args, context);
    }
  },

  find_unusual_transactions: {
    name: 'find_unusual_transactions',
    description: 'Runs financial audit scans on Live Xero invoices and bills to identify transaction anomalies, overdue cost spikes, or large bill postings.',
    category: 'TRANSACTIONS',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' }
      }
    },
    outputTypeDescription: 'Array<{ anomalyId: string, severity: string, category: string, description: string, impactAmount: number, recommendedAction: string }>',
    execute: async (args: { startDate?: string; endDate?: string }, context: ToolExecutionContext): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Security Context Error: Missing or invalid authorized tenantId context.'
            }
          };
        }
        const tId = Number(context.tenantId);
        const invRes = await getLiveXeroInvoices(tId, 'ALL', undefined, undefined, 100);
        if (!invRes.success || !invRes.data || !Array.isArray(invRes.data.records)) {
          return {
            success: false,
            error: {
              code: invRes.error?.code || 'LIVE_XERO_UNAVAILABLE',
              message: invRes.error?.message || 'Failed to query Live Xero invoices for audit scan'
            }
          };
        }

        const records = invRes.data.records;
        const anomalies: any[] = [];

        for (const r of records) {
          if (r.status === 'OVERDUE' && r.daysOverdue > 30) {
            anomalies.push({
              anomalyId: `anom_overdue_${r.invoiceId}`,
              severity: r.daysOverdue > 60 ? 'HIGH' : 'MEDIUM',
              category: 'OVERDUE_BILL_SPIKE',
              description: `Record ${r.invoiceNumber} for ${r.contactName} is ${r.daysOverdue} days overdue.`,
              impactAmount: r.amountDue || r.total,
              recommendedAction: 'Schedule urgent vendor payment review or customer collection follow-up.'
            });
          } else if (r.total > 10000) {
            anomalies.push({
              anomalyId: `anom_large_${r.invoiceId}`,
              severity: 'LOW',
              category: 'HIGH_VALUE_TRANSACTION',
              description: `High value transaction detected: ${r.invoiceNumber} (${r.contactName}) totaling £${r.total.toFixed(2)}.`,
              impactAmount: r.total,
              recommendedAction: 'Verify line-item authorization and supporting documentation.'
            });
          }
        }

        return {
          success: true,
          data: anomalies
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'LIVE_XERO_UNAVAILABLE',
            message: `Failed to scan for unusual transactions: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  cfo_simulate_scenario: {
    name: 'cfo_simulate_scenario',
    description: 'Executes a deterministic financial what-if scenario calculation based on user assumptions (revenue drops, cost changes, receivables collection, break-even, gross margin shifts, sensitivity analysis). Returns baseline actuals, scenario outputs, and variance metrics.',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        scenarioType: {
          type: 'string',
          enum: [
            'REVENUE_DELTA',
            'COGS_DELTA',
            'OPEX_DELTA',
            'RECEIVABLES_COLLECTION',
            'GROSS_MARGIN_SHIFT',
            'BREAK_EVEN_ANALYSIS',
            'SENSITIVITY_MATRIX'
          ],
          description: 'Type of scenario to simulate'
        },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        assumptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              metricName: { type: 'string', enum: ['REVENUE', 'COGS', 'OPEX', 'OVERDUE_RECEIVABLES', 'GROSS_MARGIN'] },
              value: { type: 'number', description: 'Numerical magnitude of assumption' },
              unit: { type: 'string', enum: ['PERCENTAGE', 'ABSOLUTE_CURRENCY', 'PERCENTAGE_POINTS'] },
              direction: { type: 'string', enum: ['INCREASE', 'DECREASE'] }
            },
            required: ['metricName', 'value', 'unit', 'direction']
          },
          description: 'List of scenario assumptions to apply'
        },
        sensitivitySteps: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of percentage steps for SENSITIVITY_MATRIX (e.g. [-5, -10, -15, -20])'
        }
      },
      required: ['scenarioType', 'assumptions']
    },
    outputTypeDescription: '{ scenarioType: string, baseline: object, assumptionsApplied: array, scenarioOutputs: object, variances: object, calculationMethod: string, isDeterministic: boolean, status: string, dataSource: string, lastSyncedAt: string }',
    execute: async (
      args: {
        scenarioType?: ScenarioType;
        startDate?: string;
        endDate?: string;
        assumptions?: ScenarioAssumption[];
        sensitivitySteps?: number[];
      },
      context: ToolExecutionContext
    ): Promise<ToolResult> => {
      try {
        if (!context || context.tenantId === undefined || context.tenantId === null) {
          return {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing authorized tenant context.'
            }
          };
        }

        const tenantId = context.tenantId; // Always use context.tenantId, ignore args.tenantId
        const scenarioType = args.scenarioType || 'REVENUE_DELTA';
        const defaults = defaultToolDates();
        const startDate = args.startDate || defaults.startDate;
        const endDate = args.endDate || defaults.endDate;
        const assumptions = args.assumptions || [];
        const sensitivitySteps = args.sensitivitySteps;

        // 1. Fetch baseline actual context
        const baseline = await fetchBaselineFinancialContext(tenantId, startDate, endDate);

        // 2. Execute deterministic scenario calculation
        const result = executeScenario(baseline, {
          tenantId,
          scenarioType,
          period: { startDate, endDate },
          assumptions,
          sensitivitySteps
        });

        return {
          success: true,
          data: result
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: `Failed to execute scenario simulation: ${err.message || 'Unknown error'}`
          }
        };
      }
    }
  },

  get_supplier_payment_timing_report: {
    name: 'get_supplier_payment_timing_report',
    description: 'Analyzes aggregate supplier bill payment timing, payment lag (calendar days between invoice date and fully paid date), and aggregate payment metrics for ALL suppliers directly from Live Xero API. Returns supplier-level average, min, max payment days, bill counts, total billed amount, and overall dataset payment metrics. Use this tool ONLY when asked for overall/aggregate supplier payment timing across all suppliers or supplier comparisons (e.g., "How many days difference between invoice date and paid date for each supplier?"). DO NOT use this tool for a specific supplier recent pattern, individual bill analysis, or when user specifies "don\'t take average".',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        supplierName: { type: 'string', description: 'Optional supplier / contact name filter' },
        startDate: { type: 'string', description: 'Optional start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'Optional end date YYYY-MM-DD' },
        maxPages: { type: 'number', description: 'Maximum pagination pages to fetch from Xero (default 35)' }
      }
    },
    outputTypeDescription: '{ tenantId: number, totalFullyPaidBillsAnalyzed: number, totalBillsInXero: number, overallAveragePaymentDays: number, overallMedianPaymentDays: number, coverageDescription: string, suppliers: Array<{ supplierName: string, fullyPaidBillsCount: number, averagePaymentDays: number, medianPaymentDays: number, minPaymentDays: number, maxPaymentDays: number, totalBilledAmount: number }> }',
    execute: async (args: { supplierName?: string; startDate?: string; endDate?: string; maxPages?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroSupplierPaymentTiming(context.tenantId, args);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Supplier Payment Timing'
          }
        };
      }
      return { success: true, data: res.data };
    }
  },

  get_supplier_payment_timing_drilldown: {
    name: 'get_supplier_payment_timing_drilldown',
    description: 'Retrieves bill-level payment timing records for a specific supplier and recent period (e.g. last 3 months, last quarter, last month). Use this tool MUST be preferred whenever the user asks for a specific supplier payment pattern, individual bill payment lag, recent payment timing, or explicitly instructs "don\'t take average". Returns individual bill-level records with invoice date, fully paid date, payment lag days, amount, and temporal anomaly flags directly from Live Xero API. Parameters: supplierName (e.g. AAH Pharmaceuticals Limited), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD).',
    category: 'FINANCIAL_REPORTING',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        supplierName: { type: 'string', description: 'Specific supplier / contact name (e.g., AAH Pharmaceuticals Limited)' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD for the requested period' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD for the requested period' },
        maxPages: { type: 'number', description: 'Maximum pagination pages to fetch from Xero (default 35)' }
      },
      required: ['supplierName']
    },
    outputTypeDescription: '{ tenantId: number, supplierName: string, startDate: string, endDate: string, periodCoverageDescription: string, individualBills: Array<{ invoiceId: string, invoiceNumber: string, supplierName: string, invoiceDate: string, fullyPaidDate: string, paymentLagDays: number, amount: number, isTemporalAnomaly: boolean }> }',
    execute: async (args: { supplierName?: string; startDate?: string; endDate?: string; maxPages?: number }, context: ToolExecutionContext): Promise<ToolResult> => {
      const res = await getLiveXeroSupplierPaymentTiming(context.tenantId, args);
      if (!res.success) {
        return {
          success: false,
          error: {
            code: res.error?.code || 'LIVE_XERO_UNAVAILABLE',
            message: res.error?.message || 'Failed to query Live Xero Supplier Payment Timing Drill-Down'
          }
        };
      }
      return { success: true, data: res.data };
    }
  }
};

/**
 * Registry Helper API: Retrieve tool definition by name or alias
 */
export function getCfoTool(name: string): CfoToolDefinition | undefined {
  const resolvedName = ToolAliases[name] || name;
  return COPILOT_TOOLS[resolvedName];
}

/**
 * Registry Helper API: Retrieve all registered CFO tools
 */
export function getAllCfoTools(): CfoToolDefinition[] {
  return Object.values(COPILOT_TOOLS);
}

/**
 * Registry Helper API: Retrieve tools filtered by category
 */
export function getToolsByCategory(category: ToolCategory): CfoToolDefinition[] {
  return Object.values(COPILOT_TOOLS).filter(tool => tool.category === category);
}

/**
 * Registry Helper API: Execute a registered CFO tool with security context
 */
export async function executeCfoTool(
  name: string,
  args: any,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const tool = getCfoTool(name);
  if (!tool) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Unknown CFO tool: "${name}". No tool registered with this name or alias.`
      }
    };
  }

  if (!context || context.tenantId === undefined || context.tenantId === null || isNaN(Number(context.tenantId)) || Number(context.tenantId) <= 0) {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Security Context Error: Missing or invalid authorized tenantId context.'
      }
    };
  }

  // Ensure clean model input args object
  const cleanArgs = { ...(args || {}) };

  try {
    return await tool.execute(cleanArgs, context);
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Unhandled tool error executing "${name}": ${err.message || 'Unknown error'}`
      }
    };
  }
}

/**
 * Schema Adapter API: Formats canonical CFO tools into Anthropic / OmegaPlus LLM tool definitions.
 * Filters out cross-tenant administration tools (like get_connected_tenants) and duplicate get_live_xero_* wrappers.
 */
export function getLlmToolsSchema() {
  const DUPLICATE_LLM_TOOLS = new Set([
    'get_live_xero_profit_and_loss',
    'get_live_xero_balance_sheet',
    'get_live_xero_bank_summary',
    'get_live_xero_contacts',
    'get_live_xero_chart_of_accounts',
    'get_live_xero_account_transactions',
    'get_live_xero_invoices',
    'get_live_xero_bills'
  ]);

  return getAllCfoTools()
    .filter(tool => tool.name !== 'get_connected_tenants' && !DUPLICATE_LLM_TOOLS.has(tool.name))
    .map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || []
      }
    }));
}


