import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const session = await db.getSession(sessionToken);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Tenant Details
    const tenantsList = await db.getTenants();
    const activeTenant = tenantsList.find(t => t.id === session.tenant_id);
    const companyName = activeTenant ? activeTenant.name : 'My Workspace';

    let isOnboarded = false;
    if (db.isPgActive()) {
      try {
        const u = await db.getUserByEmail(session.email);
        if (u && u.is_onboarded) isOnboarded = true;
        else {
          const prof = await db.query('SELECT id FROM organization_profiles WHERE LOWER(work_email) = LOWER($1) LIMIT 1', [session.email]);
          if (prof.rows.length > 0) isOnboarded = true;
        }
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user_id,
        email: session.email,
        tenantId: session.tenant_id,
        companyName,
        isOnboarded
      }
    });
  } catch (err: any) {
    console.error('Validate session error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
