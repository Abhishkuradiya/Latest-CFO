import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function POST(req: Request) {
  try {
    const { email, password, companyName, token } = await req.json();

    if (!email || !password || !companyName) {
      return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let accountRole = 'Founder / Owner';
    if (token) {
      if (!db.isPgActive()) return NextResponse.json({ success: false, message: 'Invitations require the PostgreSQL database.' }, { status: 503 });
      const invitation = await db.query(
        `SELECT email, role FROM user_invitations
         WHERE token = $1 AND status = 'Pending' AND expires_at > NOW()
         LIMIT 1`,
        [token],
      );
      const invited = invitation.rows[0];
      if (!invited || String(invited.email).toLowerCase().trim() !== normalizedEmail) {
        return NextResponse.json({ success: false, message: 'This invitation is invalid, expired, or belongs to another email address.' }, { status: 400 });
      }
      accountRole = String(invited.role || 'Finance Manager');
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'User already exists with this email' }, { status: 400 });
    }

    // 1. Create a new Tenant
    const tenantName = companyName.trim();
    const tenant = await db.createTenant(tenantName);

    // 2. Create User
    const hashedPassword = hashPassword(password);
    const user = await db.createUser(normalizedEmail, hashedPassword, tenant.id, accountRole);

    // 3. Mark invitation as Accepted if token provided
    if (token && db.isPgActive()) {
      try {
        await db.query("UPDATE user_invitations SET status = 'Accepted' WHERE token = $1 AND status = 'Pending'", [token]);
      } catch (e) {
        console.warn('Could not update invitation status:', e);
      }
    }

    // 4. Create Session Token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days

    await db.createSession(user.id, sessionToken, expiresAt);

    // 5. Create Response and set cookie
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');
    const response = NextResponse.json({
      success: true,
      message: 'Registration successful',
      user: { id: user.id, email: user.email, tenantId: user.tenant_id, companyName: tenant.name }
    });

    response.cookies.set({
      name: 'session_token',
      value: sessionToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Registration failed' }, { status: 500 });
  }
}
