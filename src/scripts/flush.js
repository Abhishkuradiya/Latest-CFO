const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Helper to parse .env file manually
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
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

async function flush() {
  console.log('Connecting to PostgreSQL to flush database...');
  try {
    const client = await pgPool.connect();
    console.log('Connected. Dropping tables...');
    
    // Drop all tables
    await client.query('DROP TABLE IF EXISTS reports CASCADE;');
    await client.query('DROP TABLE IF EXISTS accounts CASCADE;');
    await client.query('DROP TABLE IF EXISTS payments CASCADE;');
    await client.query('DROP TABLE IF EXISTS invoices CASCADE;');
    await client.query('DROP TABLE IF EXISTS contacts CASCADE;');
    await client.query('DROP TABLE IF EXISTS tenant_credentials CASCADE;');
    await client.query('DROP TABLE IF EXISTS sessions CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    await client.query('DROP TABLE IF EXISTS tenants CASCADE;');
    
    console.log('PostgreSQL tables dropped successfully!');
    client.release();
  } catch (err) {
    console.warn('PostgreSQL connection failed or database does not exist:', err.message);
  } finally {
    await pgPool.end();
  }

  // Flush JSON Database
  const dbJsonPath = path.join(process.cwd(), 'src', 'data', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    try {
      fs.unlinkSync(dbJsonPath);
      console.log('JSON Database (db.json) deleted successfully!');
    } catch (err) {
      console.warn('Failed to delete db.json:', err.message);
    }
  }

  console.log('Database flush completed.');
}

flush();
