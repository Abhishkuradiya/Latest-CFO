import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, message: 'Invitation token is missing' }, { status: 400 });
    }

    if (db.isPgActive()) {
      const res = await db.query('SELECT * FROM user_invitations WHERE token = $1 LIMIT 1', [token]);
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'This invitation link is invalid or has been removed.' }, { status: 404 });
      }

      const inv = res.rows[0];
      const isExpired = new Date(inv.expires_at).getTime() < Date.now();

      if (inv.status === 'Revoked') {
        return NextResponse.json({ success: false, message: 'This invitation link has been revoked by the administrator.' }, { status: 400 });
      }

      const isAccepted = inv.status === 'Accepted';

      if (isExpired || inv.status === 'Expired') {
        return NextResponse.json({ 
          success: false, 
          isExpired: true,
          message: 'This invitation link is valid until ' + new Date(inv.expires_at).toLocaleString() + ' and has now expired.' 
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        isAlreadyAccepted: isAccepted,
        invitation: {
          token: inv.token,
          email: inv.email,
          firstName: inv.first_name || '',
          organizationName: inv.organization_name,
          role: inv.role,
          invitedBy: inv.invited_by,
          expiresAt: inv.expires_at,
          status: inv.status
        }
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Database connection is unavailable. Check the PostgreSQL settings in .env.local and restart the app.'
      },
      { status: 503 }
    );
  } catch (err: unknown) {
    console.error('Failed to verify invitation link:', err);
    return NextResponse.json({ success: false, message: 'Failed to verify invitation link' }, { status: 500 });
  }
}
