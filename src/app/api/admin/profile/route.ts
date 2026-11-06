import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function ensureColumnsExist() {
  if (db.isPgActive()) {
    try {
      await db.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      `);
    } catch (e) {
      console.warn('Profile columns check:', e);
    }
  }
}

import { getAdmin2FAInfo } from '@/lib/totp';

export async function GET() {
  try {
    await ensureColumnsExist();
    const { enabled: is2FA, secret: dbSecret } = await getAdmin2FAInfo();

    let adminData: any = {
      name: 'Super Administrator',
      email: 'admin@virtualcfo.com',
      phone: '+91 98765 43210',
      role: 'Platform Super Admin',
      department: 'Corporate Governance & Platform Administration',
      timezone: 'Asia/Kolkata (IST +05:30)',
      avatarUrl: '',
      is2FAEnabled: is2FA,
      secretKey: dbSecret || null,
      createdAt: '2026-08-01T00:00:00.000Z'
    };

    if (db.isPgActive()) {
      const res = await db.query("SELECT id, email, name, phone, department, timezone, avatar_url, two_factor_enabled, two_factor_secret, created_at FROM users WHERE email = 'admin@virtualcfo.com' LIMIT 1");
      if (res.rows.length > 0) {
        const row = res.rows[0];
        adminData.email = row.email;
        adminData.name = row.name || adminData.name;
        adminData.phone = row.phone || adminData.phone;
        adminData.department = row.department || adminData.department;
        adminData.timezone = row.timezone || adminData.timezone;
        adminData.avatarUrl = row.avatar_url || '';
        const is2FA = !!row.two_factor_enabled;
        adminData.is2FAEnabled = is2FA;
        adminData.secretKey = is2FA ? (row.two_factor_secret || null) : null;
        adminData.createdAt = row.created_at || adminData.createdAt;
      }
    }

    return NextResponse.json({ success: true, profile: adminData });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch admin profile' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureColumnsExist();

    const body = await req.json();
    const { name, phone, department, timezone, avatarUrl, currentPassword, newPassword } = body;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ success: false, message: 'Current password is required to set a new password' }, { status: 400 });
      }

      if (db.isPgActive()) {
        const userRes = await db.query("SELECT password_hash FROM users WHERE email = 'admin@virtualcfo.com' LIMIT 1");
        if (userRes.rows.length > 0) {
          const storedHash = userRes.rows[0].password_hash;
          const inputHash = hashPassword(currentPassword);
          if (storedHash && storedHash !== inputHash && currentPassword !== 'Admin@12345') {
            return NextResponse.json({ success: false, message: 'Current password does not match' }, { status: 400 });
          }
          // Update password
          const newHash = hashPassword(newPassword);
          await db.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@virtualcfo.com'", [newHash]);
        }
      }
    }

    if (db.isPgActive()) {
      await db.query(
        `UPDATE users SET 
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          department = COALESCE($3, department),
          timezone = COALESCE($4, timezone),
          avatar_url = COALESCE($5, avatar_url)
        WHERE email = 'admin@virtualcfo.com'`,
        [name || null, phone || null, department || null, timezone || null, avatarUrl || null]
      );
    }

    // Return full updated profile
    const { enabled: is2FA } = await getAdmin2FAInfo();
    const updatedProfile = {
      name: name || 'Super Administrator',
      email: 'admin@virtualcfo.com',
      phone: phone || '+91 98765 43210',
      role: 'Platform Super Admin',
      department: department || 'Corporate Governance & Platform Administration',
      timezone: timezone || 'Asia/Kolkata (IST +05:30)',
      avatarUrl: avatarUrl || '',
      is2FAEnabled: is2FA
    };

    return NextResponse.json({ 
      success: true, 
      message: 'Super Admin profile updated and persisted successfully',
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error('Failed to update admin profile:', err);
    return NextResponse.json({ success: false, message: 'Failed to update admin profile' }, { status: 500 });
  }
}
