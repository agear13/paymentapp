/**
 * Applies workflow/agreement/referral-catalog migrations needed for local E2E
 * when `prisma migrate deploy` cannot be used on a stale database.
 * Local dev DB only — idempotent (safe to re-run).
 *
 * This is not a second schema: it replays existing prisma/migrations files and
 * then verifies columns the current Prisma client already expects.
 *
 * Why not every migration? Later payment_events migrations assume columns
 * (e.g. stripe_event_id) that this E2E database never received from an earlier
 * base. Those columns are not required for P4. The required Prisma columns are
 * applied from the additive migrations below plus IF NOT EXISTS supplements.
 */
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '..', '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const prisma = new PrismaClient();

const migrationFiles = [
  '20260328120000_deal_network_pilot_tables/migration.sql',
  '20260417120000_deal_network_pilot_obligations/migration.sql',
  '20260421120000_payment_links_pilot_deal/migration.sql',
  '20260503150000_payment_links_referral_link_id/migration.sql',
  '20260513120000_sprint1_referral_attribution/migration.sql',
  '20260513210000_organization_services_updated_at/migration.sql',
  '20260520120000_project_funding_sources/migration.sql',
  '20260624120000_user_auth_profiles/migration.sql',
  '20260625130000_xero_connection_token_metadata/migration.sql',
  '20260814120000_crypto_settlement_strategy/migration.sql',
  '20260817120000_organization_workflows/migration.sql',
  '20260817140000_organization_workflow_agreements/migration.sql',
  '20260817160000_agreement_intelligence_bootstrap/migration.sql',
  '20260818120000_agreement_intelligence_participant_setup/migration.sql',
];

/** Additive columns the current Prisma client selects; IF NOT EXISTS only. */
const supplementalStatements = [
  'ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "pilot_deal_id" VARCHAR(255)',
  'CREATE INDEX IF NOT EXISTS "payment_events_pilot_deal_id_idx" ON "payment_events"("pilot_deal_id")',
  `DO $$ BEGIN
    ALTER TABLE "payment_events"
      ADD CONSTRAINT "payment_events_pilot_deal_id_fkey"
      FOREIGN KEY ("pilot_deal_id") REFERENCES "deal_network_pilot_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
  'ALTER TABLE "payment_links" ADD COLUMN IF NOT EXISTS "pilot_deal_id" VARCHAR(255)',
  'CREATE INDEX IF NOT EXISTS "payment_links_pilot_deal_id_idx" ON "payment_links"("pilot_deal_id")',
  'ALTER TABLE "xero_connections" ADD COLUMN IF NOT EXISTS "id_token" TEXT',
  'ALTER TABLE "merchant_settings" ADD COLUMN IF NOT EXISTS "crypto_settlement_strategy" VARCHAR(16)',
];

const requiredColumns = [
  { table: 'deal_network_pilot_participants', column: 'deal_id' },
  { table: 'payment_events', column: 'pilot_deal_id' },
  { table: 'payment_links', column: 'pilot_deal_id' },
  { table: 'xero_connections', column: 'id_token' },
  { table: 'merchant_settings', column: 'crypto_settlement_strategy' },
];

function splitStatements(sql) {
  const parts = [];
  let current = '';
  const text = sql.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; ) {
    if (text[i] === '-' && text[i + 1] === '-') {
      const newline = text.indexOf('\n', i);
      i = newline === -1 ? text.length : newline + 1;
      continue;
    }
    const dollar = text.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
    if (dollar) {
      const tag = dollar[0];
      const end = text.indexOf(tag, i + tag.length);
      if (end === -1) {
        current += text.slice(i);
        break;
      }
      current += text.slice(i, end + tag.length);
      i = end + tag.length;
      continue;
    }
    if (text[i] === "'") {
      current += text[i];
      i += 1;
      while (i < text.length) {
        current += text[i];
        if (text[i] === "'" && text[i + 1] === "'") {
          current += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (text[i] === ';') {
      const stmt = current.trim();
      if (stmt.replace(/;+$/, '').trim().length > 0) {
        parts.push(stmt.endsWith(';') ? stmt : `${stmt};`);
      }
      current = '';
      i += 1;
      continue;
    }
    current += text[i];
    i += 1;
  }
  const tail = current.trim();
  if (tail.replace(/;+$/, '').trim().length > 0) {
    parts.push(tail.endsWith(';') ? tail : `${tail};`);
  }
  return parts;
}

async function execStatement(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /already exists|duplicate key value|enum label .* already exists|column .* already exists|duplicate_object|incompatible types/i.test(
        message
      )
    ) {
      return;
    }
    throw error;
  }
}

async function verifyRequiredColumns() {
  const missing = [];
  for (const { table, column } of requiredColumns) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
       LIMIT 1`,
      table,
      column
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      missing.push(`${table}.${column}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`E2E database is still missing Prisma columns: ${missing.join(', ')}`);
  }
  for (const { table, column } of requiredColumns) {
    console.log(`Verified ${table}.${column}`);
  }
}

const migrationsDir = resolve(process.cwd(), 'prisma/migrations');

try {
  for (const file of migrationFiles) {
    const path = resolve(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    for (const statement of splitStatements(sql)) {
      await execStatement(statement);
    }
    console.log(`Applied ${file}`);
  }
  for (const statement of supplementalStatements) {
    await execStatement(`${statement};`);
  }
  console.log('Applied supplemental Prisma columns required by the current client');
  await verifyRequiredColumns();
  console.log('E2E database prep complete.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
