import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'virtual_cfo',
});

export async function GET() {
  try {
    const client = await pgPool.connect();
    const { rows } = await client.query('SELECT id, email, tenant_id FROM users');
    client.release();
    return NextResponse.json({ success: true, users: rows });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  } finally {
    await pgPool.end();
  }
}
