import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let tenants: any[] = [];
    if (db.isPgActive()) {
      const res = await db.query(`
        SELECT 
          t.id, 
          t.name, 
          t.created_at,
          (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
          (SELECT provider FROM tenant_credentials c WHERE c.tenant_id = t.id LIMIT 1) as provider
        FROM tenants t
        ORDER BY t.id ASC
      `);
      tenants = res.rows || [];
    } else {
      const json = db.readJsonDb();
      tenants = json.tenants || [];
    }

    const formattedTenants = tenants.map((t: any, idx: number) => {
      const planName = t.id === 3 ? 'Enterprise' : (t.id === 1 ? 'Business' : 'Professional');
      const planFee = t.id === 3 ? 89990 : (t.id === 1 ? 49990 : 29990);
      const cycle = idx % 2 === 0 ? '12 Months (Annual)' : 'Monthly';
      const validityDays = idx % 2 === 0 ? 285 : 24;

      return {
        id: `tn-${t.id}`,
        db_id: t.id,
        name: t.name,
        domain: `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.virtualcfo.io`,
        plan: planName,
        billing_cycle: cycle,
        validity_days_left: validityDays,
        status: 'Active',
        saas_fee: `₹${planFee.toLocaleString('en-IN')}`,
        users: parseInt(t.user_count || 1),
        provider: t.provider || 'Xero API',
        assigned_date: t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '24 Aug 2026',
        owner: `admin@${t.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
      };
    });

    return NextResponse.json({ success: true, tenants: formattedTenants });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to fetch database tenants' }, { status: 500 });
  }
}
