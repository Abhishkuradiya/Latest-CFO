import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_RULES_TEMPLATES = [
  { ruleCode: 'RULE_DUP_BILL', name: 'Duplicate Vendor Bill Detection', category: 'DUPLICATE', severity: 'CRITICAL', isEnabled: true, conditionType: 'DUPLICATE_CHECK', configJson: { fields: ['contactName', 'invoiceNumber', 'amount'] }, rationaleTemplate: 'Same Vendor + Same Invoice # + Same Amount', isCustom: false },
  { ruleCode: 'RULE_DUP_INV', name: 'Duplicate Sales Invoice Detection', category: 'DUPLICATE', severity: 'CRITICAL', isEnabled: true, conditionType: 'DUPLICATE_CHECK', configJson: { fields: ['contactName', 'invoiceNumber', 'amount'] }, rationaleTemplate: 'Same Customer + Same Invoice # + Same Amount', isCustom: false },
  { ruleCode: 'RULE_DUP_BANK', name: 'Duplicate Bank Transaction', category: 'DUPLICATE', severity: 'CRITICAL', isEnabled: true, conditionType: 'DUPLICATE_CHECK', configJson: { fields: ['date', 'amount', 'reference'] }, rationaleTemplate: 'Same Date + Same Amount + Same Reference', isCustom: false },
  { ruleCode: 'RULE_DUP_PAY', name: 'Duplicate Payment Applied', category: 'DUPLICATE', severity: 'CRITICAL', isEnabled: true, conditionType: 'DUPLICATE_CHECK', configJson: {}, rationaleTemplate: 'Multiple payments applied to same bill/invoice', isCustom: false },
  { ruleCode: 'RULE_UNMATCHED_BANK', name: 'Unmatched Bank Transaction', category: 'RECONCILIATION', severity: 'REVIEW_REQUIRED', isEnabled: true, conditionType: 'RECONCILIATION_CHECK', configJson: {}, rationaleTemplate: 'Bank movement without expected accounting ledger match', isCustom: false },
  { ruleCode: 'RULE_OVERPAYMENT', name: 'Payment Exceeds Invoice / Bill Total', category: 'PAYMENT_MISMATCH', severity: 'CRITICAL', isEnabled: true, conditionType: 'AMOUNT_THRESHOLD', configJson: {}, rationaleTemplate: 'Total payments applied exceed invoice total amount', isCustom: false },
  { ruleCode: 'RULE_OVERDUE_AR', name: 'Overdue Receivables (>30 Days)', category: 'PAYMENT_MISMATCH', severity: 'MONITORING', isEnabled: true, conditionType: 'DATE_CHECK', configJson: { maxDays: 30 }, rationaleTemplate: 'Customer payment is overdue beyond 30 days', isCustom: false },
  { ruleCode: 'RULE_OVERDUE_AP', name: 'Overdue Payables (>30 Days)', category: 'PAYMENT_MISMATCH', severity: 'MONITORING', isEnabled: true, conditionType: 'DATE_CHECK', configJson: { maxDays: 30 }, rationaleTemplate: 'Vendor bill is overdue beyond 30 days', isCustom: false },
  { ruleCode: 'RULE_MISSING_NUM', name: 'Missing Invoice / Bill Number', category: 'INCOMPLETE_DATA', severity: 'DATA_QUALITY', isEnabled: true, conditionType: 'MISSING_FIELD', configJson: { field: 'invoiceNumber' }, rationaleTemplate: 'Bill/Invoice posted without an official reference number', isCustom: false },
  { ruleCode: 'RULE_MISSING_CONTACT', name: 'Missing / Unnamed Contact Information', category: 'INCOMPLETE_DATA', severity: 'DATA_QUALITY', isEnabled: true, conditionType: 'MISSING_FIELD', configJson: { field: 'contactName' }, rationaleTemplate: 'Transaction has incomplete or default contact information', isCustom: false },
  { ruleCode: 'RULE_MISSING_ACCOUNT', name: 'Missing Account Classification', category: 'INCOMPLETE_DATA', severity: 'DATA_QUALITY', isEnabled: true, conditionType: 'MISSING_FIELD', configJson: { field: 'accountCode' }, rationaleTemplate: 'Line item posted without proper chart of accounts classification', isCustom: false },
  { ruleCode: 'RULE_UNUSUAL_CLASS', name: 'Unusual Account Classification Anomaly', category: 'CLASSIFICATION_ANOMALY', severity: 'REVIEW_REQUIRED', isEnabled: true, conditionType: 'KEYWORD_MISMATCH', configJson: { keywords: ['rent', 'ads', 'marketing', 'travel', 'courier'] }, rationaleTemplate: 'Expense/Revenue posted to unusual account code', isCustom: false },
  { ruleCode: 'RULE_TAX_ANOMALY', name: 'Tax / VAT Treatment Review Required', category: 'TAX_ANOMALY', severity: 'REVIEW_REQUIRED', isEnabled: true, conditionType: 'TAX_CHECK', configJson: {}, rationaleTemplate: 'Tax treatment requires review or differs from standard category', isCustom: false },
  { ruleCode: 'RULE_FUTURE_DATE', name: 'Future-Dated Transaction Warning', category: 'PERIOD_CHECK', severity: 'REVIEW_REQUIRED', isEnabled: true, conditionType: 'FUTURE_DATE', configJson: {}, rationaleTemplate: 'Transaction date is dated in the future', isCustom: false },
  { ruleCode: 'RULE_CN_EXCEEDS', name: 'Credit Note Exceeds Invoice Total', category: 'CREDIT_NOTE', severity: 'CRITICAL', isEnabled: true, conditionType: 'CREDIT_NOTE_CHECK', configJson: {}, rationaleTemplate: 'Credit note amount exceeds original related invoice balance', isCustom: false }
];

export async function GET() {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let dbRules = await db.getTenantBookkeepingRules(tenantId);
    if (!dbRules || dbRules.length === 0) {
      // Seed default rules into DB for tenant
      for (const t of DEFAULT_RULES_TEMPLATES) {
        await db.saveTenantBookkeepingRule(tenantId, t);
      }
      dbRules = await db.getTenantBookkeepingRules(tenantId);
    }

    return NextResponse.json({ rules: dbRules });
  } catch (err: any) {
    console.error('Error fetching bookkeeping rules:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ruleCode, name, category, severity, isEnabled, conditionType, configJson, rationaleTemplate, isCustom } = body;

    if (!name || !conditionType) {
      return NextResponse.json({ error: 'Missing required rule fields (name, conditionType)' }, { status: 400 });
    }

    const code = ruleCode || `CUSTOM_${category || 'RULE'}_${Date.now()}`;

    await db.saveTenantBookkeepingRule(tenantId, {
      ruleCode: code,
      name,
      category: category || 'CUSTOM_POLICY',
      severity: severity || 'REVIEW_REQUIRED',
      isEnabled: isEnabled !== undefined ? isEnabled : true,
      conditionType,
      configJson: configJson || {},
      rationaleTemplate: rationaleTemplate || 'User custom rule trigger',
      isCustom: isCustom !== undefined ? isCustom : true
    });

    return NextResponse.json({ success: true, ruleCode: code, message: 'Rule saved successfully' });
  } catch (err: any) {
    console.error('Error saving bookkeeping rule:', err);
    return NextResponse.json({ error: err.message || 'Failed to save rule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const ruleCode = searchParams.get('rule_code');
    const isReset = searchParams.get('reset') === 'true';

    if (isReset) {
      // Clear custom rules and re-seed defaults
      const current = await db.getTenantBookkeepingRules(tenantId);
      for (const r of current) {
        await db.deleteTenantBookkeepingRule(tenantId, r.ruleCode);
      }
      for (const t of DEFAULT_RULES_TEMPLATES) {
        await db.saveTenantBookkeepingRule(tenantId, t);
      }
      const resetRules = await db.getTenantBookkeepingRules(tenantId);
      return NextResponse.json({ success: true, message: 'Reset to default CFO rules', rules: resetRules });
    }

    if (!ruleCode) {
      return NextResponse.json({ error: 'Missing rule_code parameter' }, { status: 400 });
    }

    await db.deleteTenantBookkeepingRule(tenantId, ruleCode);
    return NextResponse.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting bookkeeping rule:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete rule' }, { status: 500 });
  }
}
