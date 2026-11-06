import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Super Admin Logged Out Successfully'
  });

  response.cookies.set({
    name: 'admin_session_token',
    value: '',
    expires: new Date(0),
    path: '/'
  });

  return response;
}
