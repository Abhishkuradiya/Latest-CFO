import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || undefined;
    let userEmail = searchParams.get('user_email') || searchParams.get('userEmail') || undefined;

    let sessionUserEmail = '';
    let isSuperAdmin = false;
    try {
      const cookieStore = await cookies();
      const adminToken = cookieStore.get('admin_session_token')?.value;
      const sessionToken = cookieStore.get('session_token')?.value || adminToken;
      if (sessionToken) {
        const session = await db.getSession(sessionToken);
        if (session && session.email) {
          sessionUserEmail = session.email.toLowerCase().trim();
          if (!userEmail) {
            userEmail = sessionUserEmail;
          }
          if (adminToken || (session as any)?.role === 'SUPERADMIN') {
            isSuperAdmin = true;
          }
        }
      }
    } catch (e) {}

    const permissions = await db.getMenuPermissions(role, userEmail);
    const effectiveEmail = (userEmail || sessionUserEmail || '').toLowerCase().trim();

    return NextResponse.json({
      success: true,
      userEmail: effectiveEmail,
      user_email: effectiveEmail,
      isSuperAdmin,
      permissions: permissions || []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Error fetching menu permissions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch menu permissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { permissions, user_email } = body;

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Invalid permissions payload format. Expected array.' },
        { status: 400 }
      );
    }

    // Attach user_email if provided at top-level body
    const formattedPermissions = permissions.map(p => {
      if (user_email && !p.user_email) {
        return { ...p, user_email };
      }
      return p;
    });

    const success = await db.saveMenuPermissions(formattedPermissions);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update database permissions.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Menu permissions updated successfully!'
    });
  } catch (error: any) {
    console.error('Error saving menu permissions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update menu permissions' },
      { status: 500 }
    );
  }
}
