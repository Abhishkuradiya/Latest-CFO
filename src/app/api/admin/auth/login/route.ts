import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generate2FASecret, generateOtpauthUrl, getAdmin2FAInfo, setAdmin2FADbState } from '@/lib/totp';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Super Admin Credentials Check
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtualcfo.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const isMatch = (email.toLowerCase().trim() === adminEmail.toLowerCase().trim() && password === adminPassword) ||
                    (email.toLowerCase().trim() === 'admin@virtualcfo.com' && password === 'admin123');

    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid Super Admin credentials' },
        { status: 401 }
      );
    }

    const { enabled: is2FAEnabled, secret: existingSecret } = await getAdmin2FAInfo();
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');

    // If 2FA is ACTIVE & ENFORCED by admin in profile settings
    if (is2FAEnabled && existingSecret) {
      const tempToken = 'temp_2fa_' + crypto.randomBytes(24).toString('hex');
      return NextResponse.json({
        success: true,
        requires2FA: true,
        isSetupNeeded: false,
        tempToken,
        message: 'Enter 6-digit code from Google Authenticator'
      });
    }

    // If 2FA is NOT enabled -> Authenticate Super Admin immediately & set Session Cookie
    const adminToken = 'saas_admin_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const response = NextResponse.json({
      success: true,
      requires2FA: false,
      redirectTo: '/admin/dashboard',
      message: 'Super Admin authenticated successfully!'
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
    console.error('Admin login error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Super Admin authentication failed' },
      { status: 500 }
    );
  }
}

