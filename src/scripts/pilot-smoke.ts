#!/usr/bin/env node
/**
 * Pilot launch smoke test — verifies production readiness before Danielle logs in.
 *
 * Usage:
 *   npm run pilot:smoke
 *   PILOT_SMOKE_URL=https://app.provvypay.com npm run pilot:smoke
 *   PILOT_ORGANIZATION_ID=<uuid> npm run pilot:smoke
 */

import path from 'node:path';
import fs from 'node:fs';
import { config as loadEnv } from 'dotenv';

const SRC_ROOT = path.resolve(__dirname, '..');
loadEnv({ path: path.join(SRC_ROOT, '.env') });
loadEnv({ path: path.join(SRC_ROOT, '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env.local') });

import { PrismaClient } from '@prisma/client';
import {
  evaluatePilotEnvironment,
  PILOT_REQUIRED_ENV_VARS,
} from '../lib/pilot/evaluate-pilot-environment';
import { isStripeWebhookSecretValid } from '../lib/config/production-env-guards';
import { isWiseAutoSettlementAvailable } from '../lib/pilot/wise-auto-settlement';
import { runPilotLedgerSmokeCheck } from '../lib/pilot/pilot-ledger-smoke';

const prisma = new PrismaClient();

type CheckResult = { name: string; ok: boolean; detail?: string };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkHealthEndpoint(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    record(
      'health endpoint',
      res.ok && (body.status === 'healthy' || body.status === 'ok'),
      `HTTP ${res.status} status=${body.status ?? 'unknown'}`
    );
  } catch (error) {
    record(
      'health endpoint',
      false,
      error instanceof Error ? error.message : 'request failed'
    );
  }
}

async function checkDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    record('database connection', true);
  } catch (error) {
    record(
      'database connection',
      false,
      error instanceof Error ? error.message : 'query failed'
    );
  }
}

async function checkStripeConfiguration(): Promise<void> {
  const env = evaluatePilotEnvironment();
  record('Stripe configuration', env.stripeConfigured, env.blockingReasons.find((r) => r.includes('Stripe')));
  record(
    'Stripe webhook secret',
    isStripeWebhookSecretValid(process.env.STRIPE_WEBHOOK_SECRET),
    process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ? 'whsec present' : 'invalid or missing'
  );
}

async function checkXeroConnection(organizationId: string | null): Promise<void> {
  const env = evaluatePilotEnvironment();
  if (!env.xeroConfigured) {
    record('Xero connection', false, 'Xero env not configured');
    return;
  }
  if (!organizationId) {
    record('Xero connection', false, 'PILOT_ORGANIZATION_ID not set — skipping org check');
    return;
  }

  const connection = await prisma.xero_connections.findUnique({
    where: { organization_id: organizationId },
    select: { tenant_id: true, expires_at: true },
  });
  const connected = !!connection?.tenant_id;
  const expired = connection ? connection.expires_at < new Date() : false;
  record(
    'Xero connection',
    connected && !expired,
    connected ? (expired ? 'token expired' : `tenant ${connection?.tenant_id}`) : 'not connected'
  );

  const merchant = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      xero_revenue_account_id: true,
      xero_receivable_account_id: true,
      xero_stripe_clearing_account_id: true,
    },
  });
  const missing: string[] = [];
  if (!merchant?.xero_revenue_account_id) missing.push('revenue');
  if (!merchant?.xero_receivable_account_id) missing.push('receivable');
  if (!merchant?.xero_stripe_clearing_account_id) missing.push('stripe clearing');
  record(
    'Xero account mapping',
    missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : 'revenue + receivable + stripe clearing'
  );
}

async function checkInvoicePipeline(organizationId: string | null): Promise<void> {
  const postCreate = fs.readFileSync(
    path.join(SRC_ROOT, 'lib/payment-links/payment-link-post-create.ts'),
    'utf8'
  );
  record(
    'invoice creation (Xero queue at create)',
    postCreate.includes('queueXeroSync') && postCreate.includes("'INVOICE'"),
    'payment-link-post-create queues INVOICE sync'
  );

  const createTx = fs.readFileSync(
    path.join(SRC_ROOT, 'lib/payment-links/create-payment-link-in-tx.ts'),
    'utf8'
  );
  record(
    'payment link generation',
    createTx.includes('payment_links') && createTx.includes('short_code'),
    'create-payment-link-in-tx present'
  );

  if (organizationId) {
    const openCount = await prisma.payment_links.count({
      where: { organization_id: organizationId, status: 'OPEN' },
    });
    record('outstanding pilot invoices', true, `${openCount} OPEN (informational)`);
  }
}

async function checkWebhookAndSettlement(): Promise<void> {
  const webhook = fs.readFileSync(path.join(SRC_ROOT, 'app/api/stripe/webhook/route.ts'), 'utf8');
  record(
    'webhook verification',
    webhook.includes('verifyWebhookSignature') && webhook.includes('confirmPayment'),
    'stripe webhook verifies signature and calls confirmPayment'
  );

  const confirm = fs.readFileSync(path.join(SRC_ROOT, 'lib/services/payment-confirmation.ts'), 'utf8');
  record(
    'settlement pipeline',
    confirm.includes('PAYMENT_CONFIRMED') && confirm.includes('postStripeSettlement'),
    'confirmPayment posts ledger + PAYMENT_CONFIRMED'
  );
}

async function checkLedgerIntegrity(): Promise<void> {
  try {
    const result = await runPilotLedgerSmokeCheck(prisma);
    record(
      'ledger integrity',
      result.ok,
      result.ok
        ? 'no settlement state mismatches'
        : `open+confirmed=${result.openWithConfirmed}, paid-unconfirmed=${result.paidWithoutConfirmed}, duplicates=${result.duplicateConfirmed}`
    );
  } catch (error) {
    record(
      'ledger integrity',
      false,
      error instanceof Error ? error.message : 'check failed'
    );
  }
}

async function checkXeroSyncPipeline(organizationId: string | null): Promise<void> {
  const failed = organizationId
    ? await prisma.xero_syncs.count({
        where: {
          status: 'FAILED',
          payment_links: { organization_id: organizationId },
        },
      })
    : await prisma.xero_syncs.count({ where: { status: 'FAILED' } });

  record(
    'Xero invoice sync (no failures)',
    failed === 0,
    failed ? `${failed} FAILED sync row(s)` : 'no failed syncs'
  );

  const pending = await prisma.xero_syncs.count({
    where: { status: { in: ['PENDING', 'RETRYING'] } },
  });
  record('Xero payment sync queue', true, `${pending} pending/retrying (informational)`);

  const orchestration = fs.readFileSync(
    path.join(SRC_ROOT, 'lib/xero/sync-orchestration.ts'),
    'utf8'
  );
  record(
    'Xero payment sync wiring',
    orchestration.includes('recordXeroPayment') || orchestration.includes('PAYMENT'),
    'sync-orchestration handles PAYMENT sync type'
  );
}

async function main() {
  console.log('Provvypay pilot smoke test\n');

  const baseUrl = process.env.PILOT_SMOKE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const organizationId = process.env.PILOT_ORGANIZATION_ID?.trim() || null;

  const env = evaluatePilotEnvironment();
  for (const key of PILOT_REQUIRED_ENV_VARS) {
    const present = !env.missingRequiredEnv.includes(key);
    if (!present) {
      record(`env ${key}`, false, 'missing');
    }
  }
  if (env.missingRequiredEnv.length === 0) {
    record('required env vars', true, `${PILOT_REQUIRED_ENV_VARS.length} present`);
  }

  await checkHealthEndpoint(baseUrl);
  await checkDatabase();
  await checkStripeConfiguration();
  await checkXeroConnection(organizationId);
  await checkInvoicePipeline(organizationId);
  await checkWebhookAndSettlement();
  await checkLedgerIntegrity();
  await checkXeroSyncPipeline(organizationId);

  record(
    'Wise auto-settlement disabled for pilot',
    !isWiseAutoSettlementAvailable(),
    'WISE_AUTO_SETTLEMENT_ENABLED must stay unset/false for week 1'
  );

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  if (failed.length === 0) {
    console.log('PASS — all pilot smoke checks passed');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('FAIL — blocking reasons:');
  for (const f of failed) {
    console.log(`  • ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  }
  await prisma.$disconnect();
  process.exit(1);
}

main().catch(async (error) => {
  console.error('Smoke test crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
