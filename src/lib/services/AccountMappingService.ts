import { db } from '@/lib/db';

export interface TenantAccountMapping {
  id?: number | string;
  tenant_id: number;
  source: string;
  source_account_id: string; // Xero AccountID GUID (Primary Identity!)
  account_code: string;
  account_name: string;
  source_account_type: string;
  source_account_class: string;
  financial_statement_category: 'REVENUE' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_INCOME_EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY';
  subcategory: string;
  cfo_analytical_tag?: string;
  status: 'SUGGESTED' | 'CONFIRMED' | 'CUSTOM_OVERRIDE';
  confidence_score: number;
  user_confirmed: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface XeroAccountInput {
  AccountID?: string;
  id?: string;
  Code?: string;
  code?: string;
  Name?: string;
  name?: string;
  Type?: string;
  type?: string;
  Class?: string;
  class?: string;
  Status?: string;
  status?: string;
}

export class AccountMappingService {
  /**
   * Generates a non-authoritative SUGGESTED mapping for a Xero account.
   * Safe baselines:
   *  - REVENUE -> REVENUE
   *  - ASSET -> ASSET
   *  - LIABILITY -> LIABILITY
   *  - EQUITY -> EQUITY
   *  - DIRECTCOSTS -> COST_OF_SALES (SUGGESTED)
   *  - EXPENSE / OVERHEADS -> OPERATING_EXPENSES (SUGGESTED)
   */
  static getSuggestedMapping(account: XeroAccountInput): Omit<TenantAccountMapping, 'tenant_id'> {
    const sourceAccountId = (account.AccountID || account.id || '').toString();
    const code = (account.Code || account.code || '').toString();
    const name = (account.Name || account.name || '').trim();
    const rawType = (account.Type || account.type || '').toUpperCase();
    const rawClass = (account.Class || account.class || '').toUpperCase();
    const nameLow = name.toLowerCase();

    let category: TenantAccountMapping['financial_statement_category'] = 'OPERATING_EXPENSES';
    let subcategory = 'GENERAL_EXPENSE';
    let cfoTag: string | undefined = undefined;
    let confidence = 0.50;

    // 1. Safe Baseline Classification Rules
    if (rawClass === 'REVENUE' || rawType === 'REVENUE' || rawType === 'SALES') {
      category = 'REVENUE';
      subcategory = 'PRODUCT_SALES';
      confidence = 0.85;
    } else if (rawClass === 'ASSET' || rawType === 'BANK' || rawType === 'CURRENT' || rawType === 'FIXED') {
      category = 'ASSET';
      subcategory = 'CURRENT_ASSET';
      confidence = 0.90;
    } else if (rawClass === 'LIABILITY' || rawType === 'CURRLIAB' || rawType === 'TERMLIAB' || rawType === 'PAYABLE') {
      category = 'LIABILITY';
      subcategory = 'CURRENT_LIABILITY';
      confidence = 0.90;
    } else if (rawClass === 'EQUITY' || rawType === 'EQUITY') {
      category = 'EQUITY';
      subcategory = 'OWNER_EQUITY';
      confidence = 0.90;
    } else if (rawClass === 'DIRECTCOSTS' || rawType === 'DIRECTCOSTS') {
      category = 'COST_OF_SALES';
      subcategory = 'DIRECT_MATERIALS';
      confidence = 0.75;
    } else if (rawClass === 'EXPENSE' || rawClass === 'OVERHEADS' || rawType === 'EXPENSE' || rawType === 'OVERHEADS') {
      category = 'OPERATING_EXPENSES';
      subcategory = 'GENERAL_ADMIN';
      confidence = 0.75;
    }

    // 2. Account Name Pattern Refinements
    if (nameLow.includes('amazon sales') || nameLow.includes('ebay sales') || nameLow.includes('groupon sales') || nameLow.includes('website sales') || nameLow.includes('online sales')) {
      category = 'REVENUE';
      subcategory = 'MARKETPLACE_SALES';
      confidence = 0.95;
    } else if (nameLow.includes('packaging') || nameLow.includes('polybags') || nameLow.includes('boxes') || nameLow.includes('woolcool') || nameLow.includes('puffin') || nameLow.includes('labels')) {
      category = 'COST_OF_SALES';
      subcategory = 'PACKAGING';
      cfoTag = 'DIRECT_PRODUCT_COST';
      confidence = 0.94;
    } else if (nameLow.includes('merchant fee') || nameLow.includes('stripe') || nameLow.includes('paypal') || nameLow.includes('barclaycard') || nameLow.includes('sumup') || nameLow.includes('worldpay') || nameLow.includes('card fee')) {
      category = 'COST_OF_SALES';
      subcategory = 'PAYMENT_PROCESSING';
      cfoTag = 'MERCHANT_CHANNEL_FEE';
      confidence = 0.91;
    } else if (nameLow.includes('amazon fee') || nameLow.includes('fba fee') || nameLow.includes('ebay fee') || nameLow.includes('referral fee')) {
      category = 'COST_OF_SALES';
      subcategory = 'MARKETPLACE_FEES';
      cfoTag = 'MERCHANT_CHANNEL_FEE';
      confidence = 0.93;
    } else if (nameLow.includes('amazon shipping') || nameLow.includes('courier') || nameLow.includes('shipping costs') || nameLow.includes('logistics') || nameLow.includes('3pl') || nameLow.includes('postage')) {
      category = 'COST_OF_SALES';
      subcategory = 'LOGISTICS_FULFILLMENT';
      cfoTag = 'VARIABLE_FULFILLMENT';
      confidence = 0.92;
    } else if (nameLow.includes('opening stock') || nameLow.includes('closing stock') || nameLow.includes('inventory write-off') || nameLow.includes('cost of goods')) {
      category = 'COST_OF_SALES';
      subcategory = 'DIRECT_MATERIALS';
      cfoTag = 'DIRECT_PRODUCT_COST';
      confidence = 0.90;
    } else if (nameLow.includes('salary') || nameLow.includes('salaries') || nameLow.includes('payroll') || nameLow.includes('wages')) {
      category = 'OPERATING_EXPENSES';
      subcategory = 'PAYROLL';
      cfoTag = 'FIXED_OVERHEAD';
      confidence = 0.95;
    } else if (nameLow.includes('rent') || nameLow.includes('facilities') || nameLow.includes('office rent')) {
      category = 'OPERATING_EXPENSES';
      subcategory = 'RENT_FACILITIES';
      cfoTag = 'FIXED_OVERHEAD';
      confidence = 0.90;
    } else if (nameLow.includes('software') || nameLow.includes('saas') || nameLow.includes('hosting') || nameLow.includes('cloud') || nameLow.includes('aws')) {
      category = 'OPERATING_EXPENSES';
      subcategory = 'SOFTWARE_SAAS';
      cfoTag = 'FIXED_OVERHEAD';
      confidence = 0.90;
    }

    return {
      source: 'xero',
      source_account_id: sourceAccountId || `code-${code}`,
      account_code: code,
      account_name: name,
      source_account_type: rawType,
      source_account_class: rawClass,
      financial_statement_category: category,
      subcategory: subcategory,
      cfo_analytical_tag: cfoTag,
      status: 'SUGGESTED',
      confidence_score: confidence,
      user_confirmed: false,
      active: (account.Status || account.status || 'ACTIVE').toUpperCase() !== 'ARCHIVED'
    };
  }

  /**
   * Retrieves tenant-isolated account mapping by Xero AccountID GUID
   */
  static async getMapping(tenantId: number, sourceAccountId: string, source: string = 'xero'): Promise<TenantAccountMapping | null> {
    if (!tenantId || !sourceAccountId) return null;
    return await db.getAccountMapping(tenantId, sourceAccountId, source);
  }

  /**
   * Retrieves all active account mappings for a specific tenant
   */
  static async getMappings(tenantId: number): Promise<TenantAccountMapping[]> {
    if (!tenantId) return [];
    return await db.getAccountMappings(tenantId);
  }

  /**
   * Creates a SUGGESTED mapping if no confirmed/custom mapping exists.
   * GUARANTEE: User-confirmed mappings are NEVER silently overwritten!
   */
  static async createSuggestion(tenantId: number, account: XeroAccountInput): Promise<TenantAccountMapping> {
    const sourceAccountId = (account.AccountID || account.id || `code-${account.Code || account.code}`).toString();
    const existing = await this.getMapping(tenantId, sourceAccountId);

    if (existing) {
      // User-confirmed or custom override mappings MUST remain authoritative for category choices,
      // but metadata like account_code or account_name should update if changed in Xero.
      if (existing.user_confirmed || existing.status === 'CONFIRMED' || existing.status === 'CUSTOM_OVERRIDE') {
        const newCode = (account.Code || account.code || existing.account_code).toString();
        const newName = account.Name || account.name || existing.account_name;
        if (newCode !== existing.account_code || newName !== existing.account_name) {
          const updatedRecord: TenantAccountMapping = {
            ...existing,
            account_code: newCode,
            account_name: newName,
            updated_at: new Date().toISOString()
          };
          return await db.saveAccountMapping(updatedRecord);
        }
        return existing;
      }
    }

    const suggestion = this.getSuggestedMapping(account);
    const mappingRecord: TenantAccountMapping = {
      tenant_id: tenantId,
      ...suggestion,
      id: existing?.id
    };

    return await db.saveAccountMapping(mappingRecord);
  }

  /**
   * Confirms a mapping record, turning it into an authoritative tenant decision.
   */
  static async confirmMapping(tenantId: number, mappingId: number | string): Promise<TenantAccountMapping | null> {
    if (!tenantId || !mappingId) return null;
    return await db.confirmAccountMapping(tenantId, mappingId);
  }

  /**
   * Manually overrides a mapping record with custom categories.
   */
  static async overrideMapping(tenantId: number, mappingId: number | string, newMapping: Partial<TenantAccountMapping>): Promise<TenantAccountMapping | null> {
    if (!tenantId || !mappingId) return null;
    return await db.overrideAccountMapping(tenantId, mappingId, newMapping);
  }

  /**
   * Returns list of accounts that do NOT have any saved mapping in DB
   */
  static async findUnmappedAccounts(tenantId: number, allAccounts: XeroAccountInput[]): Promise<XeroAccountInput[]> {
    const existingMappings = await this.getMappings(tenantId);
    const mappedIds = new Set(existingMappings.map(m => m.source_account_id));
    return allAccounts.filter(a => {
      const accId = (a.AccountID || a.id || `code-${a.Code || a.code}`).toString();
      return !mappedIds.has(accId);
    });
  }

  /**
   * Seeds initial SUGGESTED mappings for all accounts of a tenant
   */
  static async seedMappingsForTenant(tenantId: number, accounts: XeroAccountInput[]): Promise<{ seeded: number; updated: number }> {
    let seeded = 0;
    let updated = 0;

    for (const acc of accounts) {
      const sourceAccountId = (acc.AccountID || acc.id || `code-${acc.Code || acc.code}`).toString();
      const existing = await this.getMapping(tenantId, sourceAccountId);

      if (existing) {
        if (!existing.user_confirmed && existing.status === 'SUGGESTED') {
          await this.createSuggestion(tenantId, acc);
          updated++;
        }
      } else {
        await this.createSuggestion(tenantId, acc);
        seeded++;
      }
    }

    return { seeded, updated };
  }
}
