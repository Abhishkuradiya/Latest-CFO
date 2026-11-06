import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export interface AuthenticatedUserSession {
  userId: number;
  email: string;
  tenantId: number;
  role: string;
}

export async function getAuthenticatedSession(): Promise<AuthenticatedUserSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (sessionToken) {
      const session = await db.getSession(sessionToken);
      if (session && session.tenant_id) {
        return {
          userId: Number(session.user_id),
          email: String(session.email || ''),
          tenantId: Number(session.tenant_id),
          role: String(session.role || 'Finance Manager')
        };
      }
    }
    return null;
  } catch (err: any) {
    if (!err?.message?.includes('cookies')) {
      console.error('Failed to get authenticated session:', err);
    }
    return null;
  }
}

export async function getTenantIdFromSession(): Promise<number | null> {
  const session = await getAuthenticatedSession();
  return session ? session.tenantId : null;
}
