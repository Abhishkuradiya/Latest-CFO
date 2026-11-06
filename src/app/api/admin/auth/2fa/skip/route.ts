import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdmin2FAInfo } from '@/lib/totp';

export async function POST(req: Request) {
  try {
    const { enabled: is2FAEnabled } = await getAdmin2FAInfo();

    // If 2FA is active & enforced, skipping is strictly FORBIDDEN!
    if (is2FAEnabled) {
      return NextResponse.json(
        { 
          success: false, 
          message: '2FA is Active & Enforced! You must enter your 6-digit Google Authenticator code to access the Super Admin Dashboard.' 
        },
        { status: 403 }
      );
    }

    // Allowed ONLY during initial optional setup phase
    const adminToken = 'saas_admin_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');

    const response = NextResponse.json({
      success: true,
      message: '2FA setup skipped. Logged into Super Admin Dashboard.',
      admin: {
        id: 'super_admin_1',
        name: 'SaaS Super Admin',
        email: 'admin@virtualcfo.com',
        role: 'super_admin',
        permissions: ['*']
      }
    });

    response.cookies.set({
      name: 'admin_session_token',
      value: adminToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;
  } catch (err: any) {
    console.error('2FA skip error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to skip 2FA' },
      { status: 500 }
    );
  }
}
