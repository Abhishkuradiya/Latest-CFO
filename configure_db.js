const { Client } = require('pg');

async function run() {
  console.log('Connecting to PostgreSQL using local trust authentication...');

  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected successfully to default postgres database!');

    console.log("Setting postgres password to 'postgres'...");
    try {
      await client.query("ALTER USER postgres PASSWORD 'postgres';");
      console.log('Password set successfully.');
    } catch (e) {
      console.warn('Notice setting password:', e.message);
    }

    console.log("Checking if 'virtual_cfo' database exists...");
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'virtual_cfo'");
    if (dbCheck.rows.length === 0) {
      console.log("Creating database 'virtual_cfo'...");
      await client.query("CREATE DATABASE virtual_cfo");
      console.log("Database 'virtual_cfo' created successfully.");
    } else {
      console.log("Database 'virtual_cfo' already exists.");
    }

    await client.end();
    console.log('Configuration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error during configuration:', err.message);
    try { await client.end(); } catch (e) { }
    process.exit(1);
  }
}

run();
