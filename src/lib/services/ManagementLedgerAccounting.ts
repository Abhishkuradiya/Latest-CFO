export type NormalSide = 'DEBIT' | 'CREDIT';

export function isManagementAccountsAdministrator(role: string) {
  const normalized = role.trim().toLocaleLowerCase();
  return [
    'founder / owner', 'owner', 'cfo', 'admin', 'administrator',
    'management accounts administrator', 'finance director',
    'bookkeeper',
  ].includes(normalized)
    || normalized.includes('owner')
    || normalized.includes('finance administrator')
    || normalized.includes('management accounts');
}

export function calculateLedgerBalances(
  opening: number | null,
  debit: number | null,
  credit: number | null,
  normalSide: NormalSide,
  internalDebit = 0,
  internalCredit = 0,
) {
  if (opening === null || debit === null || credit === null) {
    return { netMovement: null, originalClosing: null, adjustedClosing: null };
  }
  const netMovement = normalSide === 'DEBIT' ? debit - credit : credit - debit;
  const internalMovement = normalSide === 'DEBIT' ? internalDebit - internalCredit : internalCredit - internalDebit;
  const originalClosing = opening + netMovement;
  return { netMovement, originalClosing, adjustedClosing: originalClosing + internalMovement };
}

export function getLedgerReconciliationStatus(input: {
  independentClosing: number | null;
  adjustedClosing: number | null;
  difference: number | null;
  approvedAdjustmentCount: number;
  pendingAdjustmentCount: number;
  transactionEvidenceAvailable: boolean;
}) {
  if (input.independentClosing === null || input.adjustedClosing === null || !input.transactionEvidenceAvailable) return 'Evidence unavailable';
  if (input.difference === null || Math.abs(input.difference) > 0.01) return 'Difference outstanding';
  return 'Matches Xero activity';
}
