import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email required' }, { status: 400 });
    }

    if (db.isPgActive()) {
      const res = await db.query(
        `SELECT * FROM organization_profiles WHERE LOWER(work_email) = LOWER($1) ORDER BY id DESC LIMIT 1`,
        [email.trim()]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        return NextResponse.json({
          success: true,
          draft: {
            fullName: row.full_name,
            workEmail: row.work_email,
            jobTitle: row.job_title,
            financialDecisionRole: row.financial_decision_role,
            businessName: row.business_name,
            businessType: row.business_type,
            industry: row.industry,
            businessDescription: row.business_description,
            employeesRange: row.employees_range,
            customersRange: row.customers_range,
            annualRevenueRange: row.annual_revenue_range,
            currency: row.currency,
            legalEntitiesCount: row.legal_entities_count,
            monetizationModels: row.monetization_models || [],
            salesChannels: row.sales_channels || [],
            revenueModel: row.revenue_model,
            paymentTerms: row.payment_terms,
            fiscalYear: row.fiscal_year,
            accountingBasis: row.accounting_basis,
            primaryAccountingPlatform: row.primary_accounting_platform,
            bankReconciliationFrequency: row.bank_reconciliation_frequency,
            cfoHelpPriorities: row.cfo_help_priorities || [],
            biggestFinancialChallenge: row.biggest_financial_challenge,
            improvementGoals12m: row.improvement_goals_12m,
            customCfoNotes: row.custom_cfo_notes,
            currentStep: row.current_step || 1
          }
        });
      }
    }

    return NextResponse.json({ success: false, message: 'No draft found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      workEmail,
      fullName,
      jobTitle,
      financialDecisionRole,
      businessName,
      businessType,
      industry,
      businessDescription,
      employeesRange,
      customersRange,
      annualRevenueRange,
      currency = 'INR',
      legalEntitiesCount,
      monetizationModels = [],
      salesChannels = [],
      revenueModel,
      paymentTerms,
      fiscalYear,
      accountingBasis,
      primaryAccountingPlatform,
      bankReconciliationFrequency,
      cfoHelpPriorities = [],
      biggestFinancialChallenge,
      improvementGoals12m,
      customCfoNotes,
      currentStep = 1
    } = body;

    if (!workEmail) {
      return NextResponse.json({ success: false, message: 'Email required for draft saving' }, { status: 400 });
    }

    if (db.isPgActive()) {
      // Check existing row
      const existing = await db.query(
        `SELECT id FROM organization_profiles WHERE LOWER(work_email) = LOWER($1) LIMIT 1`,
        [workEmail.trim()]
      );

      if (existing.rows.length > 0) {
        await db.query(`
          UPDATE organization_profiles SET
            full_name = $1,
            job_title = $2,
            financial_decision_role = $3,
            business_name = $4,
            business_type = $5,
            industry = $6,
            business_description = $7,
            employees_range = $8,
            customers_range = $9,
            annual_revenue_range = $10,
            currency = $11,
            legal_entities_count = $12,
            monetization_models = $13,
            sales_channels = $14,
            revenue_model = $15,
            payment_terms = $16,
            fiscal_year = $17,
            accounting_basis = $18,
            primary_accounting_platform = $19,
            bank_reconciliation_frequency = $20,
            cfo_help_priorities = $21,
            biggest_financial_challenge = $22,
            improvement_goals_12m = $23,
            custom_cfo_notes = $24,
            current_step = $25
          WHERE LOWER(work_email) = LOWER($26)
        `, [
          fullName || '',
          jobTitle || '',
          financialDecisionRole || '',
          businessName || '',
          businessType || '',
          industry || '',
          businessDescription || '',
          employeesRange || '',
          customersRange || '',
          annualRevenueRange || '',
          currency || 'INR',
          legalEntitiesCount || '1',
          JSON.stringify(monetizationModels),
          JSON.stringify(salesChannels),
          revenueModel || '',
          paymentTerms || '',
          fiscalYear || '',
          accountingBasis || '',
          primaryAccountingPlatform || '',
          bankReconciliationFrequency || '',
          JSON.stringify(cfoHelpPriorities),
          biggestFinancialChallenge || '',
          improvementGoals12m || '',
          customCfoNotes || '',
          currentStep,
          workEmail.trim()
        ]);
      } else {
        await db.query(`
          INSERT INTO organization_profiles (
            full_name, work_email, job_title, financial_decision_role,
            business_name, business_type, industry, business_description,
            employees_range, customers_range, annual_revenue_range, currency, legal_entities_count,
            monetization_models, sales_channels, revenue_model, payment_terms,
            fiscal_year, accounting_basis, primary_accounting_platform, bank_reconciliation_frequency,
            cfo_help_priorities, biggest_financial_challenge, improvement_goals_12m, custom_cfo_notes, current_step
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
          )
        `, [
          fullName || '',
          workEmail.trim(),
          jobTitle || '',
          financialDecisionRole || '',
          businessName || '',
          businessType || '',
          industry || '',
          businessDescription || '',
          employeesRange || '',
          customersRange || '',
          annualRevenueRange || '',
          currency || 'INR',
          legalEntitiesCount || '1',
          JSON.stringify(monetizationModels),
          JSON.stringify(salesChannels),
          revenueModel || '',
          paymentTerms || '',
          fiscalYear || '',
          accountingBasis || '',
          primaryAccountingPlatform || '',
          bankReconciliationFrequency || '',
          JSON.stringify(cfoHelpPriorities),
          biggestFinancialChallenge || '',
          improvementGoals12m || '',
          customCfoNotes || '',
          currentStep
        ]);
      }
    }

    return NextResponse.json({ success: true, message: 'Draft saved to database' });
  } catch (err: any) {
    console.error('Draft save error:', err);
    return NextResponse.json({ success: false, message: 'Failed to save draft' }, { status: 500 });
  }
}
