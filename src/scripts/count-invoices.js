const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'virtual_cfo',
});

async function main() {
  console.log('\n======================================================');
  console.log('   VIRTUAL CFO DATABASE INVOICE COUNT REPORT');
  console.log('======================================================\n');

  let pgConnected = false;
  try {
    const client = await pgPool.connect();
    pgConnected = true;
    console.log('[SOURCE: PostgreSQL Database]');
    
    // Total count
    const totalRes = await client.query('SELECT COUNT(*) FROM invoices;');
    console.log(`📊 TOTAL RECORDS IN INVOICES TABLE: ${totalRes.rows[0].count}`);

    // By Type
    const typeRes = await client.query('SELECT type, COUNT(*) FROM invoices GROUP BY type;');
    console.log('\n📌 BY TYPE:');
    typeRes.rows.forEach(r => console.log(`   - ${r.type || 'UNKNOWN'}: ${r.count}`));

    // By Status
    const statusRes = await client.query('SELECT status, COUNT(*) FROM invoices GROUP BY status ORDER BY count DESC;');
    console.log('\n📌 BY STATUS:');
    statusRes.rows.forEach(r => console.log(`   - ${r.status || 'UNKNOWN'}: ${r.count}`));

    // Detailed Matrix (Type x Status)
    const matrixRes = await client.query('SELECT type, status, COUNT(*) FROM invoices GROUP BY type, status ORDER BY type, count DESC;');
    console.log('\n📌 TYPE x STATUS MATRIX:');
    matrixRes.rows.forEach(r => console.log(`   - ${r.type || 'UNKNOWN'} | ${r.status || 'UNKNOWN'}: ${r.count}`));

    client.release();
  } catch (err) {
    console.log('[PostgreSQL DB not connected or unavailable:', err.message, ']');
  } finally {
    await pgPool.end();
  }

  // Also check JSON DB fallback
  const dbJsonPath = path.join(process.cwd(), 'src', 'data', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
      const invoices = data.invoices || [];
      console.log('\n[SOURCE: JSON File DB (src/data/db.json)]');
      console.log(`📊 TOTAL INVOICES IN DB.JSON: ${invoices.length}`);

      const typeCounts = {};
      const statusCounts = {};
      const matrixCounts = {};

      invoices.forEach(inv => {
        const t = (inv.type || inv.Type || 'UNKNOWN').toUpperCase();
        const s = (inv.status || inv.Status || 'UNKNOWN').toUpperCase();

        typeCounts[t] = (typeCounts[t] || 0) + 1;
        statusCounts[s] = (statusCounts[s] || 0) + 1;
        const key = `${t} | ${s}`;
        matrixCounts[key] = (matrixCounts[key] || 0) + 1;
      });

      console.log('\n📌 BY TYPE (JSON DB):');
      Object.entries(typeCounts).forEach(([t, c]) => console.log(`   - ${t}: ${c}`));

      console.log('\n📌 BY STATUS (JSON DB):');
      Object.entries(statusCounts).forEach(([s, c]) => console.log(`   - ${s}: ${c}`));

      console.log('\n📌 TYPE x STATUS MATRIX (JSON DB):');
      Object.entries(matrixCounts).forEach(([k, c]) => console.log(`   - ${k}: ${c}`));

    } catch (e) {
      console.log('Error reading db.json:', e.message);
    }
  }

  console.log('\n======================================================\n');
}

main();
