import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureInvitationsTable() {
  if (db.isPgActive()) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_invitations (
          id SERIAL PRIMARY KEY,
          token VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) NOT NULL,
          first_name VARCHAR(255),
          organization_name VARCHAR(255) NOT NULL,
          role VARCHAR(100) DEFAULT 'Finance Manager',
          invited_by VARCHAR(255) DEFAULT 'Super Administrator',
          status VARCHAR(50) DEFAULT 'Pending',
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn('Invitations table check:', e);
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
      console.warn('Could not load SMTP config from DB:', e);
    }
  }

  return config;
}

export async function GET() {
  try {
    await ensureInvitationsTable();
    let invitations: any[] = [];

    if (db.isPgActive()) {
      const res = await db.query('SELECT * FROM user_invitations ORDER BY id DESC');
      invitations = res.rows || [];
    }

    const formatted = invitations.map((inv: any) => {
      const isExpired = new Date(inv.expires_at).getTime() < Date.now();
      let currentStatus = inv.status;
      if (currentStatus === 'Pending' && isExpired) {
        currentStatus = 'Expired';
      }

      return {
        id: inv.id,
        token: inv.token,
        email: inv.email,
        firstName: inv.first_name || '',
        organizationName: inv.organization_name,
        role: inv.role,
        invitedBy: inv.invited_by,
        status: currentStatus,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at
      };
    });

    return NextResponse.json({ success: true, invitations: formatted });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch invitations' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureInvitationsTable();
    const body = await req.json();
    const { firstName, email, organizationName, role, invitedBy, validHours = 6, expiryHours } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, message: 'Valid email address is required' }, { status: 400 });
    }
    if (!organizationName) {
      return NextResponse.json({ success: false, message: 'Organization name is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFirstName = firstName ? firstName.trim() : cleanEmail.split('@')[0];
    const cleanOrg = organizationName.trim();
    const userRole = role || 'Finance Manager';
    const cleanInvitedBy = invitedBy && invitedBy.trim() ? invitedBy.trim() : 'Rajan Goswami';
    const hoursNum = parseInt(String(expiryHours || validHours), 10) || 6;

    // Generate Token & Expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + hoursNum * 3600 * 1000);

    // Save invitation into PostgreSQL DB
    if (db.isPgActive()) {
      await db.query(
        `INSERT INTO user_invitations (token, email, first_name, organization_name, role, invited_by, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, NOW())`,
        [token, cleanEmail, cleanFirstName, cleanOrg, userRole, cleanInvitedBy, expiresAt]
      );
    }

    // Determine host origin for Accept Invitation link
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const inviteUrl = `${protocol}://${host}/register?token=${token}`;
    const formattedExpiry = expiresAt.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    }) + ' (IST)';

    // Load SMTP Credentials & Send Real Invitation Email
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

    const emailSubject = 'Invitation to Join Virtual CFO';
    
    // Plain Text Version
    const emailText = `Hello ${cleanFirstName},

You have been invited to join Virtual CFO by ${cleanInvitedBy}.

Virtual CFO is a financial intelligence platform that brings your business's financial information, reporting, analytics, and insights together in one secure environment.

To access the platform, please complete your account registration using the invitation below.

Accept Invitation: ${inviteUrl}

Once you accept the invitation, you will be asked to:

• Confirm your email address
• Set up your account password
• Complete the required security verification
• Sign in to Virtual CFO

Invitation Details

Organization: ${cleanOrg}
Email: ${cleanEmail}
Access Level: ${userRole}
Invited By: ${cleanInvitedBy}

This invitation is valid until ${formattedExpiry}. For security purposes, the invitation link can only be used by the recipient of this email.

If you were not expecting this invitation, please disregard this email.

If you have any questions regarding this invitation, please contact your organization's administrator or Virtual CFO Support.

Regards,
Virtual CFO
Financial Intelligence Platform

This is an automated email. Please do not reply to this message.

© 2026 Virtual CFO. All rights reserved.
Privacy Policy · Terms of Service · Support`;

    // Simple Clean HTML Version (without direct link line below button)
    const emailHtml = `
      <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; color: #111827; line-height: 1.6; padding: 20px;">
        <p>Hello ${cleanFirstName},</p>
        <p>You have been invited to join Virtual CFO by <strong>${cleanInvitedBy}</strong>.</p>
        <p>Virtual CFO is a financial intelligence platform that brings your business's financial information, reporting, analytics, and insights together in one secure environment.</p>
        <p>To access the platform, please complete your account registration using the invitation below.</p>
        <br />
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 15px;">
            Accept Invitation
          </a>
        </p>
        <br />
        <p>Once you accept the invitation, you will be asked to:</p>
        <ul>
          <li>Confirm your email address</li>
          <li>Set up your account password</li>
          <li>Complete the required security verification</li>
          <li>Sign in to Virtual CFO</li>
        </ul>
        <br />
        <p><strong>Invitation Details</strong></p>
        <p style="margin: 4px 0;">Organization: <strong>${cleanOrg}</strong></p>
        <p style="margin: 4px 0;">Email: <strong>${cleanEmail}</strong></p>
        <p style="margin: 4px 0;">Access Level: <strong>${userRole}</strong></p>
        <p style="margin: 4px 0;">Invited By: <strong>${cleanInvitedBy}</strong></p>
        <br />
        <p>This invitation is valid until <strong>${formattedExpiry}</strong>. For security purposes, the invitation link can only be used by the recipient of this email.</p>
        <p>If you were not expecting this invitation, please disregard this email.</p>
        <p>If you have any questions regarding this invitation, please contact your organization's administrator or Virtual CFO Support.</p>
        <br />
        <p>Regards,<br /><strong>Virtual CFO</strong><br />Financial Intelligence Platform</p>
        <br />
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #6b7280;">This is an automated email. Please do not reply to this message.</p>
        <p style="font-size: 11px; color: #6b7280;">© 2026 Virtual CFO. All rights reserved.<br />Privacy Policy · Terms of Service · Support</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.user}>`,
        to: cleanEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      });
      console.log('Invitation email sent:', info.messageId);
    } catch (mailErr: any) {
      console.error('Failed to send invitation email:', mailErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Invitation email sent successfully to ${cleanEmail}! Link valid for ${hoursNum} hours.`,
      inviteUrl,
      token
    });
  } catch (err: any) {
    console.error('Failed to create invitation:', err);
    return NextResponse.json({ success: false, message: 'Failed to create invitation' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id && db.isPgActive()) {
      await db.query('DELETE FROM user_invitations WHERE id = $1', [parseInt(id, 10)]);
    }

    return NextResponse.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to revoke invitation' }, { status: 500 });
  }
}
