import { db, pgPool } from '../db';
import { fetchXeroResource } from '../xero';

export type JournalsCapabilityState = 
  | 'AVAILABLE' 
  | 'UNAUTHORIZED' 
  | 'NOT_GRANTED' 
  | 'NOT_SUPPORTED' 
  | 'UNKNOWN';

export type CoverageStatus = 
  | 'COMPLETE' 
  | 'PARTIAL' 
  | 'NOT_GRANTED' 
  | 'AVAILABLE' 
  | 'UNAUTHORIZED' 
  | 'NOT_SUPPORTED' 
  | 'UNKNOWN';

export type JournalClassification =
  | 'MISSING_ADJUSTMENT'
  | 'DUPLICATE_SOURCE'
  | 'RECLASSIFICATION'
  | 'INVENTORY_VALUATION'
  | 'ACCRUAL'
  | 'REVERSAL'
  | 'OTHER';

export interface TenantCapabilityMatrix {
  tenantId: number;
  reporting: CoverageStatus;
  canonicalLedger: CoverageStatus;
  journalsApi: JournalsCapabilityState;
  invoiceLines: CoverageStatus;
  bankTransactions: CoverageStatus;
  manualJournals: CoverageStatus;
  bills: CoverageStatus;
  creditNotes: CoverageStatus;
  mode: 'MODE_A' | 'MODE_B';
  details: {
    hasJournalsScope: boolean;
    journalsHttpStatus?: number;
    journalsErrorMessage?: string;
  };
}

export interface GapAttributionRow {
  accountCode: string;
  accountName: string;
  xeroBalance: number;
  canonicalBalance: number;
  gap: number;
  journalContribution: number;
  explainedPercentage: number;
  remainingGap: number;
}

export class XeroCapabilityService {
  /**
   * Inspects Xero OAuth scopes and tests journals endpoint access for a specific tenant.
   * Ensures complete multi-tenant isolation (tenant-scoped execution).
   */
  static async checkJournalsCapability(tenantId: number): Promise<{
    state: JournalsCapabilityState;
    hasJournalsScope: boolean;
    httpStatus?: number;
    errorMessage?: string;
  }> {
    try {
      const creds = await db.getCredentials(tenantId, 'xero');
      if (!creds || !creds.access_token || !creds.tenant_identifier) {
        return {
          state: 'UNKNOWN',
          hasJournalsScope: false,
          errorMessage: 'No active Xero credentials found for tenant'
        };
      }

      const scopes: string[] = creds.scopes || [];
      const hasJournalsScope = scopes.includes('accounting.journals.read');

      if (!hasJournalsScope) {
        return {
          state: 'NOT_GRANTED',
          hasJournalsScope: false,
          errorMessage: 'Active OAuth token lacks accounting.journals.read scope'
        };
      }

      // If scope is present, test actual endpoint
      try {
        await fetchXeroResource(creds.access_token, creds.tenant_identifier, 'Journals', 'offset=0');
        return {
          state: 'AVAILABLE',
          hasJournalsScope: true,
          httpStatus: 200
        };
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          return {
            state: 'UNAUTHORIZED',
            hasJournalsScope: true,
            httpStatus: 401,
            errorMessage: '401 Unauthorized response from Xero Journals API'
          };
        } else if (msg.includes('403') || msg.includes('Forbidden')) {
          return {
            state: 'NOT_SUPPORTED',
            hasJournalsScope: true,
            httpStatus: 403,
            errorMessage: '403 Forbidden - Organization or plan restriction'
          };
        } else {
          return {
            state: 'UNKNOWN',
            hasJournalsScope: true,
            errorMessage: msg
          };
        }
      }
    } catch (err: any) {
      return {
        state: 'UNKNOWN',
        hasJournalsScope: false,
        errorMessage: err.message
      };
    }
  }

  /**
   * Constructs the full capability matrix for a tenant.
   */
  static async getTenantCapabilityMatrix(tenantId: number): Promise<TenantCapabilityMatrix> {
    const journalsCap = await this.checkJournalsCapability(tenantId);
    
    // Check line items presence in local database
    const { rows: invCountRows } = await pgPool.query(
      "SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1 AND line_items IS NOT NULL AND jsonb_array_length(line_items) > 0",
      [tenantId]
    ).catch(() => ({ rows: [{ cnt: '0' }] }));
    
    const hasInvoiceLines = parseInt(invCountRows[0]?.cnt || '0') > 0;

    // Check bank transactions presence
    const { rows: bankCountRows } = await pgPool.query(
      "SELECT COUNT(*) as cnt FROM account_transactions WHERE tenant_id = $1 AND transaction_type = 'BANK_TRANSACTION'",
      [tenantId]
    ).catch(() => ({ rows: [{ cnt: '0' }] }));

    const hasBankTxns = parseInt(bankCountRows[0]?.cnt || '0') > 0;

    // Check manual journals report cached
    const mjs = await db.getReport(tenantId, 'ManualJournals').catch(() => null);
    const hasManualJournals = Array.isArray(mjs) && mjs.length > 0;

    // Mode determination: MODE A by default unless Journals are available and full reconciliation passes
    const canonicalLedgerStatus: CoverageStatus = journalsCap.state === 'AVAILABLE' ? 'COMPLETE' : 'PARTIAL';
    const mode: 'MODE_A' | 'MODE_B' = 'MODE_A'; // Enforce MODE A while canonical ledger is PARTIAL

    return {
      tenantId,
      reporting: 'COMPLETE', // Authoritative report pipeline active
      canonicalLedger: canonicalLedgerStatus,
      journalsApi: journalsCap.state,
      invoiceLines: hasInvoiceLines ? 'COMPLETE' : 'PARTIAL',
      bankTransactions: hasBankTxns ? 'COMPLETE' : 'PARTIAL',
      manualJournals: hasManualJournals ? 'COMPLETE' : 'PARTIAL',
      bills: hasInvoiceLines ? 'COMPLETE' : 'PARTIAL',
      creditNotes: hasInvoiceLines ? 'COMPLETE' : 'PARTIAL',
      mode,
      details: {
        hasJournalsScope: journalsCap.hasJournalsScope,
        journalsHttpStatus: journalsCap.httpStatus,
        journalsErrorMessage: journalsCap.errorMessage
      }
    };
  }

  /**
   * Diagnostic helper: Parses a sample array of Xero Journal objects into normalized journal lines.
   */
  static parseJournalSample(journals: any[]): Array<{
    journalId: string;
    journalDate: string;
    journalNumber: number;
    sourceType: string;
    sourceId?: string;
    lineId: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    netAmount: number;
    description?: string;
    reference?: string;
  }> {
    const lines: Array<any> = [];
    if (!Array.isArray(journals)) return lines;

    for (const j of journals) {
      const journalLines = j.JournalLines || j.journal_lines || [];
      for (const line of journalLines) {
        const netAmt = parseFloat(line.NetAmount || line.net_amount || (line.GrossAmount || line.gross_amount || '0'));
        lines.push({
          journalId: j.JournalID || j.journal_id || '',
          journalDate: j.JournalDate || j.journal_date || '',
          journalNumber: j.JournalNumber || j.journal_number || 0,
          sourceType: j.SourceType || j.source_type || 'SYSTEM',
          sourceId: j.SourceID || j.source_id,
          lineId: line.JournalLineID || line.journal_line_id || '',
          accountId: line.AccountID || line.account_id || '',
          accountCode: line.AccountCode || line.account_code || '',
          accountName: line.AccountName || line.account_name || '',
          netAmount: netAmt,
          description: line.Description || line.description,
          reference: j.Reference || j.reference
        });
      }
    }
    return lines;
  }

  /**
   * Diagnostic helper: Classifies a journal line according to its source type, description, and existing lineage overlap.
   */
  static classifyJournalRecord(
    journalLine: { sourceType: string; sourceId?: string; description?: string; accountCode?: string },
    existingSourceIds: Set<string>
  ): JournalClassification {
    if (journalLine.sourceId && existingSourceIds.has(journalLine.sourceId)) {
      return 'DUPLICATE_SOURCE';
    }

    const st = (journalLine.sourceType || '').toUpperCase();
    const desc = (journalLine.description || '').toLowerCase();
    const code = journalLine.accountCode || '';

    if (code === '500' || desc.includes('inventory') || desc.includes('stock valuation')) {
      return 'INVENTORY_VALUATION';
    }
    if (desc.includes('accrual') || desc.includes('provision')) {
      return 'ACCRUAL';
    }
    if (desc.includes('reversal') || desc.includes('reverse')) {
      return 'REVERSAL';
    }
    if (st === 'MANJOURNAL' || desc.includes('reclass') || desc.includes('transfer')) {
      return 'RECLASSIFICATION';
    }
    if (st === 'SYSTEM' || code === '508' || code === '499') {
      return 'MISSING_ADJUSTMENT';
    }

    return 'OTHER';
  }

  /**
   * Diagnostic helper: Calculates gap attribution for key gap accounts.
   */
  static calculateGapAttribution(
    accountDefinitions: Array<{ code: string; name: string; xeroBalance: number; canonicalBalance: number }>,
    journalContributionsByCode: Map<string, number>
  ): GapAttributionRow[] {
    return accountDefinitions.map(acc => {
      const gap = Math.round((acc.xeroBalance - acc.canonicalBalance) * 100) / 100;
      const contrib = Math.round((journalContributionsByCode.get(acc.code) || 0) * 100) / 100;
      const remainingGap = Math.round((gap - contrib) * 100) / 100;
      const explainedPercentage = gap !== 0 ? Math.min(100, Math.max(0, Math.round((contrib / gap) * 10000) / 100)) : 0;

      return {
        accountCode: acc.code,
        accountName: acc.name,
        xeroBalance: acc.xeroBalance,
        canonicalBalance: acc.canonicalBalance,
        gap,
        journalContribution: contrib,
        explainedPercentage,
        remainingGap
      };
    });
  }

  /**
   * Diagnostic helper: Detects potential overlap between journal lines and existing transactions (invoices/bills/bank transactions).
   */
  static detectJournalDuplicates(
    journalLines: Array<{ sourceType: string; sourceId?: string; netAmount: number }>,
    existingSourceIds: Set<string>
  ): { duplicateCount: number; newAdjustmentCount: number; overlappingSourceTypes: string[] } {
    let duplicateCount = 0;
    let newAdjustmentCount = 0;
    const overlappingTypes = new Set<string>();

    for (const line of journalLines) {
      if (line.sourceId && existingSourceIds.has(line.sourceId)) {
        duplicateCount++;
        overlappingTypes.add(line.sourceType);
      } else {
        newAdjustmentCount++;
      }
    }

    return {
      duplicateCount,
      newAdjustmentCount,
      overlappingSourceTypes: Array.from(overlappingTypes)
    };
  }
}
