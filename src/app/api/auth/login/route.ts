import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch (err) {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = typeof email === 'string' ? email.trim() : '';

    if (!cleanEmail || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    // 1. Fetch user by email
    const user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // 2. Verify Password
    const isPasswordValid = verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // 3. Fetch Tenant Details
    const tenantsList = await db.getTenants();
    const activeTenant = tenantsList.find(t => t.id === user.tenant_id);
    const companyName = activeTenant ? activeTenant.name : 'My Workspace';

    // 4. Create Session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Session expires in 7 days

    await db.createSession(user.id, sessionToken, expiresAt);

    // 5. Create Response and set cookie
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');
    // Check onboarding status
    let isOnboarded = !!user.is_onboarded;
    if (!isOnboarded && db.isPgActive()) {
      try {
        const prof = await db.query('SELECT id FROM organization_profiles WHERE LOWER(work_email) = LOWER($1) LIMIT 1', [user.email]);
        if (prof.rows.length > 0) isOnboarded = true;
      } catch (e) {}
    }

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, tenantId: user.tenant_id, companyName, isOnboarded }
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
    console.error('Login error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Login failed' }, { status: 500 });
  }
}
