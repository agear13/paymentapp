/**
 * Applies workflow/agreement migrations needed for P3-C E2E when deploy is not run.
 * Local dev DB only — idempotent (safe to re-run).
 */
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const prisma = new PrismaClient();

const migrationFiles = [
  '20260328120000_deal_network_pilot_tables/migration.sql',
  '20260417120000_deal_network_pilot_obligations/migration.sql',
  '20260520120000_project_funding_sources/migration.sql',
  '20260624120000_user_auth_profiles/migration.sql',
  '20260817120000_organization_workflows/migration.sql',
  '20260817140000_organization_workflow_agreements/migration.sql',
  '20260817160000_agreement_intelligence_bootstrap/migration.sql',
];

/** Minimal columns bootstrap reads; full payment_events migration assumes newer base schema. */
const supplementalStatements = [
  'ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "pilot_deal_id" VARCHAR(255)',
  'CREATE INDEX IF NOT EXISTS "payment_events_pilot_deal_id_idx" ON "payment_events"("pilot_deal_id")',
  `DO $$ BEGIN
    ALTER TABLE "payment_events"
      ADD CONSTRAINT "payment_events_pilot_deal_id_fkey"
      FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
];

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `${chunk};`);
}

async function execStatement(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /already exists|duplicate key value|enum label .* already exists|column .* already exists|duplicate_object/i.test(
        message
      )
    ) {
      return;
    }
    throw error;
  }
}

try {
  for (const file of migrationFiles) {
    const path = resolve(process.cwd(), 'prisma/migrations', file);
    const sql = readFileSync(path, 'utf8');
    for (const statement of splitStatements(sql)) {
      await execStatement(statement);
    }
    console.log(`Applied ${file}`);
  }
  for (const statement of supplementalStatements) {
    await execStatement(`${statement};`);
  }
  console.log('Applied supplemental payment_events pilot_deal_id columns');
  console.log('E2E database prep complete.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
