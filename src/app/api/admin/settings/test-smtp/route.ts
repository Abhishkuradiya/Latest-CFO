import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { smtpHost, smtpPort, smtpEncryption, smtpUser, smtpPass, testRecipient, smtpSenderName } = body;

    if (!smtpHost) {
      return NextResponse.json({ success: false, message: 'SMTP Host / Server address is required' }, { status: 400 });
    }
    if (!smtpPort) {
      return NextResponse.json({ success: false, message: 'SMTP Port is required (e.g. 587 or 465)' }, { status: 400 });
    }
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ success: false, message: 'SMTP Username and Password / App Password are required' }, { status: 400 });
    }
    if (!testRecipient || !testRecipient.includes('@')) {
      return NextResponse.json({ success: false, message: 'Valid recipient email address is required for test mail' }, { status: 400 });
    }

    const hostClean = smtpHost.trim();
    const portNum = parseInt(smtpPort, 10) || 587;
    const cleanUser = smtpUser.trim();
    const cleanPass = smtpPass.trim();
    const senderName = smtpSenderName || 'Virtual CFO Platform';

    // Determine secure option based on port or encryption selection
    const isSecure = portNum === 465 || (smtpEncryption && smtpEncryption.toUpperCase() === 'SSL');

    const transporter = nodemailer.createTransport({
      host: hostClean,
      port: portNum,
      secure: isSecure,
      auth: {
        user: cleanUser,
        pass: cleanPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    // Verify SMTP connection handshake
    await transporter.verify();

    // Send real HTML test email
    const mailOptions = {
      from: `"${senderName}" <${cleanUser}>`,
      to: testRecipient.trim(),
      subject: '✅ Virtual CFO Platform - SMTP Outbound Verification Test',
      html: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f4f7fc; padding: 30px; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);">
            <div style="background: linear-gradient(135deg, #0b1329 0%, #133863 100%); padding: 28px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">Virtual CFO</h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #00b7e2; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">Outbound SMTP Engine Verified</p>
            </div>
            <div style="padding: 32px; line-height: 1.6;">
              <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0;">Test Email Dispatched Successfully! 🎉</h2>
              <p style="font-size: 14px; color: #475569;">
                Your <strong>Gmail SMTP Outbound Server</strong> has been verified. The Virtual CFO Platform is ready to deliver real-time financial alerts, client invoices, and CFO intelligence reports.
              </p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #00b7e2; padding: 16px 20px; margin: 24px 0; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;"><strong>Sender Email:</strong> ${cleanUser}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 700; color: #1e293b;"><strong>Test Recipient:</strong> ${testRecipient}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 700; color: #1e293b;"><strong>SMTP Server:</strong> ${hostClean}:${portNum} (${isSecure ? 'SSL' : 'TLS'})</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; font-weight: 700; color: #1e293b;"><strong>Dispatched At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
              </div>

              <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                If you received this message, your Gmail App Password configuration is working.
              </p>
            </div>
            <div style="background: #f8fafc; padding: 18px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; font-weight: 500;">
              © 2026 Virtual CFO Intelligence Platform • All rights reserved
            </div>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Real email sent via SMTP:', info.messageId);

    return NextResponse.json({ 
      success: true, 
      message: `Live email delivered to ${testRecipient}! Message ID: ${info.messageId}`,
      verified: true
    });
  } catch (err: any) {
    console.error('SMTP Error:', err);
    return NextResponse.json({ 
      success: false, 
      message: `SMTP Failed: ${err.message || 'Authentication failed or server timeout'}` 
    }, { status: 500 });
  }
}
