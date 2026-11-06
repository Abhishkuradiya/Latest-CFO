import { NextResponse } from 'next/server';
import { getTenantIdFromSession } from '@/lib/auth';
import { getCashForecast } from '@/lib/cashForecast';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenantId = await getTenantIdFromSession();
  if (tenantId === null) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await getCashForecast(tenantId)); }
  catch (error: any) { console.error('13-week cash forecast failed:', error); return NextResponse.json({ error: error.message || 'Unable to calculate cash forecast' }, { status: 500 }); }
}
