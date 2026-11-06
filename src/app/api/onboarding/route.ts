import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureProfilesTable() {
  if (db.isPgActive()) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS organization_profiles (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          full_name VARCHAR(255),
          work_email VARCHAR(255),
          job_title VARCHAR(100),
          financial_decision_role VARCHAR(100),
          business_name VARCHAR(255),
          business_type VARCHAR(100),
          industry VARCHAR(100),
          business_description TEXT,
          employees_range VARCHAR(50),
          customers_range VARCHAR(50),
          annual_revenue_range VARCHAR(50),
          currency VARCHAR(10) DEFAULT 'INR',
          legal_entities_count VARCHAR(20),
          monetization_models JSONB,
          sales_channels JSONB,
          revenue_model VARCHAR(50),
          payment_terms VARCHAR(50),
          fiscal_year VARCHAR(50),
          accounting_basis VARCHAR(50),
          primary_accounting_platform VARCHAR(100),
          bank_reconciliation_frequency VARCHAR(50),
          cfo_help_priorities JSONB,
          biggest_financial_challenge VARCHAR(255),
          improvement_goals_12m VARCHAR(255),
          custom_cfo_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn('Profiles table check:', e);
    }
  }
}

async function getSmtpConfig() {
  let config = {
    host: 'smtp.gmail.com',
    port: 465,
    user: 'gvaaca105@gmail.com',
    pass: 'weof skca mths nprk',
    senderName: 'Virtual CFO Platform'
  };

  if (db.isPgActive()) {
    try {
      const res = await db.query('SELECT * FROM system_settings WHERE id = 1 LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (row.smtp_user && row.smtp_pass) {
          config = {
            host: row.smtp_host || 'smtp.gmail.com',
            port: parseInt(row.smtp_port) || 465,
            user: row.smtp_user,
            pass: row.smtp_pass,
            senderName: row.smtp_sender_name || 'Virtual CFO Platform'
          };
        }
      }
    } catch (e) {
      console.warn('Could not load SMTP config:', e);
    }
  }

  return config;
}

export async function POST(req: Request) {
  try {
    await ensureProfilesTable();
    const body = await req.json();

    const {
      fullName,
      workEmail,
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
      customCfoNotes
    } = body;

    const userEmail = workEmail || 'user@company.com';
    const userName = fullName || userEmail.split('@')[0];
    const orgName = businessName || 'Organization Workspace';

    if (db.isPgActive()) {
      await db.query(`
        INSERT INTO organization_profiles (
          full_name, work_email, job_title, financial_decision_role,
          business_name, business_type, industry, business_description,
          employees_range, customers_range, annual_revenue_range, currency, legal_entities_count,
          monetization_models, sales_channels, revenue_model, payment_terms,
          fiscal_year, accounting_basis, primary_accounting_platform, bank_reconciliation_frequency,
          cfo_help_priorities, biggest_financial_challenge, improvement_goals_12m, custom_cfo_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        );
      `, [
        userName,
        userEmail,
        jobTitle || 'Founder / Owner',
        financialDecisionRole || 'I make most financial decisions',
        orgName,
        businessType || 'Private Limited',
        industry || 'Technology',
        businessDescription || '',
        employeesRange || '1–5',
        customersRange || '1–10',
        annualRevenueRange || '₹50L – ₹1Cr',
        currency,
        legalEntitiesCount || '1',
        JSON.stringify(monetizationModels),
        JSON.stringify(salesChannels),
        revenueModel || 'Recurring Revenue',
        paymentTerms || '30 days',
        fiscalYear || 'April – March',
        accountingBasis || 'Accrual',
        primaryAccountingPlatform || 'Xero',
        bankReconciliationFrequency || 'Weekly',
        JSON.stringify(cfoHelpPriorities),
        biggestFinancialChallenge || 'Cash Flow',
        improvementGoals12m || 'Increase Profit Margin',
        customCfoNotes || ''
      ]);

      // Mark user as onboarded in users table
      try {
        await db.query(`UPDATE users SET is_onboarded = TRUE WHERE LOWER(email) = LOWER($1)`, [userEmail.trim()]);
      } catch (e) {
        console.warn('Could not update users is_onboarded flag:', e);
      }
    }

    // Dispatch Account Registration & Onboarding Completion Success Email
    const smtp = await getSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass
      },
      tls: { rejectUnauthorized: false }
    });

    const emailSubject = '✅ Registration & Onboarding Complete - Virtual CFO Account Activation Pending';
    const emailHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
          
          <div style="background: linear-gradient(135deg, #0b1329 0%, #133863 100%); padding: 32px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 900;">Virtual CFO</h1>
            <p style="margin: 6px 0 0 0; font-size: 11px; color: #00b7e2; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">Business Onboarding Submitted</p>
          </div>
          
          <div style="padding: 36px; line-height: 1.7;">
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0;">Registration Complete! 🎉</h2>
            
            <p style="font-size: 14px; color: #475569;">
              Hello <strong>${userName}</strong>,
            </p>

            <p style="font-size: 14px; color: #475569;">
              Thank you for completing the <strong>Virtual CFO Business Discovery & Onboarding Setup</strong> for <strong>${orgName}</strong>.
            </p>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 20px; margin: 24px 0; border-radius: 10px;">
              <p style="margin: 0; font-size: 13.5px; font-weight: 700; color: #15803d;">
                Status: Account Activation In Progress
              </p>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #166534;">
                Your registration has been received successfully. Your account and CFO Intelligence Profile will be activated within a few hours after administrator verification.
              </p>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 10px; margin-bottom: 24px;">
              <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0b1329;">Onboarding Summary</h4>
              <p style="margin: 4px 0; font-size: 12.5px; color: #334155;"><strong>Business:</strong> ${orgName} (${industry || 'Technology'})</p>
              <p style="margin: 4px 0; font-size: 12.5px; color: #334155;"><strong>Primary Focus:</strong> ${Array.isArray(cfoHelpPriorities) && cfoHelpPriorities.length > 0 ? cfoHelpPriorities.join(', ') : 'Cash Flow & Profitability'}</p>
              <p style="margin: 4px 0; font-size: 12.5px; color: #334155;"><strong>Accounting Platform:</strong> ${primaryAccountingPlatform || 'Xero'}</p>
            </div>

            <p style="font-size: 13px; color: #64748b;">
              Once your account is activated, you will be able to sign in and connect your accounting platform to receive AI CFO recommendations.
            </p>

            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;">Regards,</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 800; color: #2563eb;">Virtual CFO Team</p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">Financial Intelligence Platform</p>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0;">© 2026 Virtual CFO. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.user}>`,
        to: userEmail,
        subject: emailSubject,
        html: emailHtml
      });
    } catch (e) {
      console.warn('Onboarding completion email dispatch warning:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Registration & Onboarding setup complete! Confirmation email sent to ${userEmail}.`
    });

  } catch (err: any) {
    console.error('Onboarding submission error:', err);
    return NextResponse.json({ success: false, message: 'Failed to submit onboarding profile' }, { status: 500 });
  }
}
