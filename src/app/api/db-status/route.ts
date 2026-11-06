import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await db.checkPgConnectionDetails();
  const response = NextResponse.json({
    success: true,
    isPostgres: result.success,
    error: result.error || null,
    code: result.code || null,
    config: result.config || null
  });
  
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}
