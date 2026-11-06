import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verify2FAToken, getAdmin2FAInfo, setAdmin2FADbState } from '@/lib/totp';

export async function POST(req: Request) {
  try {
    const { code, secret } = await req.json();

    if (!code || code.trim().length !== 6) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 6-digit verification code' },
        { status: 400 }
      );
    }

    const { secret: dbSecret } = await getAdmin2FAInfo();
    const secretToUse = secret || dbSecret;

    if (!secretToUse) {
      return NextResponse.json(
        { success: false, message: 'No 2FA secret found. Please log in again.' },
        { status: 400 }
      );
    }

    // Verify 6-digit TOTP code
    const isValid = verify2FAToken(code, secretToUse);

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid 6-digit code. Please check Google Authenticator and try again.' },
        { status: 401 }
      );
    }

    // Mark 2FA as setup & enabled in PostgreSQL
    await setAdmin2FADbState(true, secretToUse);

    // Generate Full Admin Session Token & 2FA Verified Cookie
    const adminToken = 'saas_admin_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');

    const response = NextResponse.json({
      success: true,
      message: 'Google 2FA Verified Successfully!',
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

    response.cookies.set({
      name: 'admin_2fa_verified',
      value: 'true',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;
  } catch (err: any) {
    console.error('2FA verification error:', err);
    return NextResponse.json(
      { success: false, message: '2FA verification failed' },
      { status: 500 }
    );
  }
}
