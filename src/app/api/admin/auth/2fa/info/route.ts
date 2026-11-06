import { NextResponse } from 'next/server';
import { generate2FASecret, generateOtpauthUrl, getAdmin2FAInfo, setAdmin2FADbState } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let { enabled, secret } = await getAdmin2FAInfo();

    if (!secret) {
      secret = generate2FASecret();
      await setAdmin2FADbState(false, secret);
    }

    const qrSecret = secret;
    const otpauthUrl = generateOtpauthUrl('admin@virtualcfo.com', 'VirtualCFO Super Admin', qrSecret);

    return NextResponse.json({
      success: true,
      isEnabled: enabled,
      qrSecret,
      otpauthUrl,
      email: 'admin@virtualcfo.com'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch 2FA info' }, { status: 500 });
  }
}
