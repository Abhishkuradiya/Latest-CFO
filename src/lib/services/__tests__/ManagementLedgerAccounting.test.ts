import assert from 'node:assert/strict';
// @ts-expect-error Node's built-in TypeScript runner requires the explicit extension.
import { calculateLedgerBalances, getLedgerReconciliationStatus, isManagementAccountsAdministrator } from '../ManagementLedgerAccounting.ts';

const debitNormal = calculateLedgerBalances(100, 40, 15, 'DEBIT');
assert.deepEqual(debitNormal, { netMovement: 25, originalClosing: 125, adjustedClosing: 125 });

const creditNormal = calculateLedgerBalances(100, 15, 40, 'CREDIT');
assert.deepEqual(creditNormal, { netMovement: 25, originalClosing: 125, adjustedClosing: 125 });

const adjusted = calculateLedgerBalances(100, 40, 15, 'DEBIT', 0, 10);
assert.equal(adjusted.adjustedClosing, 115);
assert.equal(adjusted.originalClosing, 125);

assert.equal(calculateLedgerBalances(null, 10, 5, 'DEBIT').adjustedClosing, null);

const statusBase = { independentClosing: 115, adjustedClosing: 115, difference: 0, approvedAdjustmentCount: 1, pendingAdjustmentCount: 0, transactionEvidenceAvailable: true };
assert.equal(getLedgerReconciliationStatus(statusBase), 'Matches Xero activity');
assert.equal(getLedgerReconciliationStatus({ ...statusBase, pendingAdjustmentCount: 1 }), 'Matches Xero activity');
assert.equal(getLedgerReconciliationStatus({ ...statusBase, transactionEvidenceAvailable: false }), 'Evidence unavailable');
assert.equal(getLedgerReconciliationStatus({ ...statusBase, difference: 12 }), 'Difference outstanding');
assert.equal(getLedgerReconciliationStatus({ ...statusBase, approvedAdjustmentCount: 0 }), 'Matches Xero activity');
assert.equal(getLedgerReconciliationStatus({ ...statusBase, adjustedClosing: 125, difference: -10, approvedAdjustmentCount: 1 }), 'Difference outstanding');
assert.equal(isManagementAccountsAdministrator('Founder / Owner'), true);
assert.equal(isManagementAccountsAdministrator('CFO'), true);
assert.equal(isManagementAccountsAdministrator('Finance Manager'), false);
assert.equal(isManagementAccountsAdministrator('Accountant'), false);

console.log('Management ledger accounting tests passed.');
