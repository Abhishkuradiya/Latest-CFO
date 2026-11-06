import { XeroCapabilityService, JournalClassification } from './XeroCapabilityService';

export type DuplicateStatus = 'DUPLICATE' | 'SAFE_TO_AUGMENT' | 'NEEDS_REVIEW';
export type ValidationStatus = 'VALIDATED' | 'BALANCING_ERROR' | 'OUT_OF_PERIOD' | 'INVALID_ACCOUNT';
export type ModeBReadinessState = 'MODE_B_NOT_READY' | 'MODE_B_DIAGNOSTIC_READY' | 'MODE_B_CANDIDATE';

export interface DiagnosticJournalEntry {
  tenantId: number;
  journalId: string;
  lineId: string;
  journalNumber: number;
  journalDate: string;
  sourceType: string;
  sourceId?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  netAmount: number;
  description?: string;
  reference?: string;
  classification: JournalClassification;
  duplicateStatus: DuplicateStatus;
  validationStatus: ValidationStatus;
}

export interface DiagnosticReconciliationSummary {
  tenantId: number;
  journalsRetrievedCount: number;
  stagedEntriesCount: number;
  safeToAugmentCount: number;
  duplicateCount: number;
  needsReviewCount: number;
  accountAttribution: Array<{
    accountCode: string;
    accountName: string;
    xeroBalance: number;
    canonicalBefore: number;
    gapBefore: number;
    stagedAdjustment: number;
    canonicalAfter: number;
    remainingGap: number;
    reconciled: boolean;
  }>;
  readinessState: ModeBReadinessState;
}

export class JournalStagingService {
  /**
   * Processes a sample array of raw Xero Journal objects into isolated diagnostic staging entries.
   * Performs double-entry equality check, date boundary validation, and lineage duplicate checks.
   */
  static processDiagnosticJournalSample(
    tenantId: number,
    rawJournals: any[],
    existingSourceIds: Set<string>,
    periodStart: string = '2026-04-01',
    periodEnd: string = '2026-09-30'
  ): DiagnosticJournalEntry[] {
    const staged: DiagnosticJournalEntry[] = [];
    if (!Array.isArray(rawJournals)) return staged;

    const startDate = new Date(`${periodStart}T00:00:00.000Z`);
    const endDate = new Date(`${periodEnd}T23:59:59.999Z`);

    for (const j of rawJournals) {
      const journalId = j.JournalID || j.journal_id || '';
      const journalDateStr = j.JournalDate || j.journal_date || '';
      const journalDate = new Date(journalDateStr);
      const journalNumber = j.JournalNumber || j.journal_number || 0;
      const sourceType = j.SourceType || j.source_type || 'SYSTEM';
      const sourceId = j.SourceID || j.source_id;
      const reference = j.Reference || j.reference;

      const journalLines = j.JournalLines || j.journal_lines || [];

      // 1. Double-Entry Equality Check (Sum Debit === Sum Credit)
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of journalLines) {
        const netAmt = parseFloat(line.NetAmount || line.net_amount || '0');
        const grossAmt = parseFloat(line.GrossAmount || line.gross_amount || '0');
        const amt = netAmt !== 0 ? netAmt : grossAmt;

        if (amt > 0) totalDebit += amt;
        else if (amt < 0) totalCredit += Math.abs(amt);
      }
      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 || journalLines.length === 1;

      // 2. Period Boundary Check
      const isInPeriod = journalDate >= startDate && journalDate <= endDate;

      for (const line of journalLines) {
        const lineId = line.JournalLineID || line.journal_line_id || `${journalId}-line`;
        const accountId = line.AccountID || line.account_id || '';
        const accountCode = line.AccountCode || line.account_code || '';
        const accountName = line.AccountName || line.account_name || '';
        const netAmt = parseFloat(line.NetAmount || line.net_amount || (line.GrossAmount || line.gross_amount || '0'));
        const description = line.Description || line.description;

        const debit = netAmt > 0 ? netAmt : 0;
        const credit = netAmt < 0 ? Math.abs(netAmt) : 0;

        // Duplicate determination
        let duplicateStatus: DuplicateStatus = 'SAFE_TO_AUGMENT';
        if (sourceId && existingSourceIds.has(sourceId)) {
          duplicateStatus = 'DUPLICATE';
        } else if (!accountCode) {
          duplicateStatus = 'NEEDS_REVIEW';
        }

        // Validation status
        let validationStatus: ValidationStatus = 'VALIDATED';
        if (!isInPeriod) {
          validationStatus = 'OUT_OF_PERIOD';
        } else if (!isBalanced && journalLines.length > 1) {
          validationStatus = 'BALANCING_ERROR';
        } else if (!accountCode) {
          validationStatus = 'INVALID_ACCOUNT';
        }

        // Classification
        const classification = XeroCapabilityService.classifyJournalRecord(
          { sourceType, sourceId, description, accountCode },
          existingSourceIds
        );

        staged.push({
          tenantId,
          journalId,
          lineId,
          journalNumber,
          journalDate: journalDateStr,
          sourceType,
          sourceId,
          accountId,
          accountCode,
          accountName,
          debit,
          credit,
          netAmount: netAmt,
          description,
          reference,
          classification,
          duplicateStatus,
          validationStatus
        });
      }
    }

    return staged;
  }

  /**
   * Computes diagnostic P&L reconciliation comparing before and after staged adjustments.
   */
  static calculateDiagnosticReconciliation(
    tenantId: number,
    accountDefinitions: Array<{ code: string; name: string; xeroBalance: number; canonicalBefore: number }>,
    stagedEntries: DiagnosticJournalEntry[],
    journalsCapState: string
  ): DiagnosticReconciliationSummary {
    // Sum valid, non-duplicate staged adjustments per account
    const stagedByAccount = new Map<string, number>();
    let safeToAugmentCount = 0;
    let duplicateCount = 0;
    let needsReviewCount = 0;

    for (const entry of stagedEntries) {
      if (entry.duplicateStatus === 'DUPLICATE') {
        duplicateCount++;
      } else if (entry.duplicateStatus === 'NEEDS_REVIEW' || entry.validationStatus !== 'VALIDATED') {
        needsReviewCount++;
      } else {
        safeToAugmentCount++;
        const current = stagedByAccount.get(entry.accountCode) || 0;
        stagedByAccount.set(entry.accountCode, current + entry.netAmount);
      }
    }

    const attribution = accountDefinitions.map(acc => {
      const stagedAdj = Math.round((stagedByAccount.get(acc.code) || 0) * 100) / 100;
      const canonicalAfter = Math.round((acc.canonicalBefore + stagedAdj) * 100) / 100;
      const gapBefore = Math.round((acc.xeroBalance - acc.canonicalBefore) * 100) / 100;
      const remainingGap = Math.round((acc.xeroBalance - canonicalAfter) * 100) / 100;
      const reconciled = Math.abs(remainingGap) < 1.0;

      return {
        accountCode: acc.code,
        accountName: acc.name,
        xeroBalance: acc.xeroBalance,
        canonicalBefore: acc.canonicalBefore,
        gapBefore,
        stagedAdjustment: stagedAdj,
        canonicalAfter,
        remainingGap,
        reconciled
      };
    });

    // Determine readiness state
    let readinessState: ModeBReadinessState = 'MODE_B_NOT_READY';
    if (journalsCapState === 'AVAILABLE') {
      const allReconciled = attribution.every(a => a.reconciled);
      if (allReconciled && needsReviewCount === 0) {
        readinessState = 'MODE_B_CANDIDATE';
      } else {
        readinessState = 'MODE_B_DIAGNOSTIC_READY';
      }
    }

    return {
      tenantId,
      journalsRetrievedCount: stagedEntries.length,
      stagedEntriesCount: stagedEntries.length,
      safeToAugmentCount,
      duplicateCount,
      needsReviewCount,
      accountAttribution: attribution,
      readinessState
    };
  }
}
