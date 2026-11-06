import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      // 1. Delete session from database
      await db.deleteSession(sessionToken);
    }

    // 2. Clear Cookie in response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      expires: new Date(0), // Instantly expire
      path: '/'
    });

    return response;
  } catch (err: any) {
    console.error('Logout error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Logout failed' }, { status: 500 });
  }
}
