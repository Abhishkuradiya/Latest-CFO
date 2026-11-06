import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdmin2FAInfo } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session_token')?.value;
  const is2FAVerified = cookieStore.get('admin_2fa_verified')?.value === 'true';

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized Super Admin Session' },
      { status: 401 }
    );
  }

  const { enabled: is2FAEnabled } = await getAdmin2FAInfo();

  // Strict Security Check: If 2FA is active & enforced, 2FA verification is MANDATORY
  if (is2FAEnabled && !is2FAVerified) {
    return NextResponse.json(
      { 
        success: false, 
        requires2FA: true, 
        message: 'Google 2FA verification is mandatory before accessing Super Admin Dashboard.' 
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    admin: {
      id: 'super_admin_1',
      name: 'SaaS Super Admin',
      email: 'admin@virtualcfo.com',
      role: 'super_admin',
      permissions: ['*']
    }
  });
}
