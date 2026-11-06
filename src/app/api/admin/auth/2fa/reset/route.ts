import { NextResponse } from 'next/server';
import { generate2FASecret, setAdmin2FADbState } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await setAdmin2FADbState(false, null);
    return NextResponse.json({ success: true, message: '2FA state reset. Google 2FA is now disabled.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to reset 2FA state' }, { status: 500 });
  }
}
