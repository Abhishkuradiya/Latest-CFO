import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
 
export async function GET() {
  try {
    const tenants = await db.getTenants();
    return NextResponse.json({ success: true, tenants });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch tenants' }, { status: 500 });
  }
}
 
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: 'Tenant name is required' }, { status: 400 });
    }
 
    const tenant = await db.createTenant(name.trim());
    return NextResponse.json({ success: true, tenant });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to create tenant' }, { status: 500 });
  }
}
