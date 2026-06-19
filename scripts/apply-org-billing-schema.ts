/**
 * TEMPORARY: Applies pending organization billing schema migrations
 * using the pooled Supabase connection (direct URL blocked from this network).
 * Runs the SQL from the two unapplied migrations:
 *   - 20260608120000_organization_subscription_entitlements
 *   - 20260608140000_organization_stripe_billing
 * DELETE THIS FILE AFTER SUCCESSFUL EXECUTION.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../src/.env.local') });
config({ path: resolve(__dirname, '../src/.env') });

import { PrismaClient } from '../src/node_modules/@prisma/client/index.js';
const prisma = new PrismaClient();

async function main() {
  console.log('\nApplying organization billing schema...\n');

  // Migration 1: subscription_plan + subscription_status
  console.log('Step 1: Adding subscription_plan and subscription_status columns...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "subscription_plan" VARCHAR(32) NOT NULL DEFAULT 'starter',
      ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(32) NOT NULL DEFAULT 'inactive'
  `);
  console.log('  ✓ Done.\n');

  // Migration 2: Stripe billing columns
  console.log('Step 2: Adding stripe_customer_id, stripe_subscription_id, current_period_end...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "current_period_end" TIMESTAMPTZ(6)
  `);
  console.log('  ✓ Done.\n');

  // Unique indexes (IF NOT EXISTS — safe to re-run)
  console.log('Step 3: Creating unique indexes for Stripe columns...');
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_customer_id_key"
      ON "organizations" ("stripe_customer_id")
      WHERE "stripe_customer_id" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_subscription_id_key"
      ON "organizations" ("stripe_subscription_id")
      WHERE "stripe_subscription_id" IS NOT NULL
  `);
  console.log('  ✓ Done.\n');

  // Verify
  const sample = await prisma.$queryRaw<{ subscription_plan: string; subscription_status: string }[]>`
    SELECT subscription_plan, subscription_status FROM organizations LIMIT 1
  `;
  console.log('Verification — first org row:');
  console.log(JSON.stringify(sample[0], null, 2));

  console.log('\n✓ Schema applied successfully.');
}

main()
  .catch((e) => { console.error('✗ Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
