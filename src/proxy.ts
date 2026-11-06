import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static next files and favicon pass through
  const isNextAsset = pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname.match(/\.(png|jpg|jpeg|svg|ico)$/);
  if (isNextAsset) {
    return NextResponse.next();
  }

  // 1. SUPER ADMIN ROUTES HANDLING
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Public Admin Paths & Menu Permissions accessible with session_token or admin_session_token
    if (
      pathname === '/admin/login' || 
      pathname === '/admin/setup-2fa' || 
      pathname.startsWith('/api/admin/auth/login') || 
      pathname.startsWith('/api/admin/auth/2fa/') ||
      pathname.startsWith('/api/admin/menu-permissions')
    ) {
      if (pathname.startsWith('/api/admin/menu-permissions')) {
        const hasToken = request.cookies.get('session_token')?.value || request.cookies.get('admin_session_token')?.value;
        if (!hasToken) {
          return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
      }
      return NextResponse.next();
    }

    // Check Super Admin session token cookie
    const adminToken = request.cookies.get('admin_session_token')?.value;
    if (!adminToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, message: 'Unauthorized Super Admin' }, { status: 401 });
      }
      const adminLoginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(adminLoginUrl);
    }

    return NextResponse.next();
  }

  // 2. REGULAR CLIENT TENANT ROUTES HANDLING
  const publicPaths = ['/', '/login', '/register', '/onboarding', '/cfo-copilot', '/api/cfo/copilot', '/api/onboarding', '/api/auth/login', '/api/auth/register', '/api/auth/invitation-info', '/api/db-status', '/api/xero/callback', '/api/amazon'];
  const isPublicPath = publicPaths.some(path => pathname === path || (path !== '/' && pathname.startsWith(path + '/')));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Get client tenant session token
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
