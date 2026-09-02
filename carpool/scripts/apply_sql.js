#!/usr/bin/env node
/**
 * Simple SQL apply helper.
 * Usage: node scripts/apply_sql.js path/to/file.sql
 * Requires either DATABASE_URL env var or PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT.
 */
import fs from 'fs';
import { Client } from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply_sql.js path/to/file.sql');
  process.exitCode = 1;
  throw new Error('Missing SQL file argument');
}

const sql = fs.readFileSync(file, 'utf8');

const connectionString = process.env.DATABASE_URL || null;

const clientConfig = connectionString
  ? { connectionString }
  : {
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: process.env.PGPORT || process.env.DB_PORT || 5432,
      user: process.env.PGUSER || process.env.DB_USER,
      password: process.env.PGPASSWORD || process.env.DB_PASS,
      database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    };

const client = new Client(clientConfig);

(async () => {
  try {
    await client.connect();
    console.log(`Connected to database`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Applied SQL from ${file} successfully`);
    process.exitCode = 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to apply SQL:', err.message || err);
    process.exitCode = 2;
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
})();
