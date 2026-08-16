/**
 * One-off verification helper: apply treasury migration when direct URL is unreachable.
 * Uses DATABASE_URL (pooler) which supports DDL on Supabase session pooler.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const MIGRATION_NAME = '20260816120000_treasury_foundation';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const sqlPath = path.join(
    process.cwd(),
    'prisma',
    'migrations',
    MIGRATION_NAME,
    'migration.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString, connectionTimeoutMillis: 20000 });
  await client.connect();

  try {
    const existing = await client.query(
      `SELECT migration_name FROM _prisma_migrations WHERE migration_name = $1`,
      [MIGRATION_NAME]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      console.log('ALREADY_APPLIED');
      return;
    }

    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO "_prisma_migrations" (
        id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
      ) VALUES (
        gen_random_uuid()::text, '', NOW(), $1, NULL, NULL, NOW(), 1
      )`,
      [MIGRATION_NAME]
    );
    await client.query('COMMIT');
    console.log('MIGRATION_APPLIED');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('MIGRATION_FAIL', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
