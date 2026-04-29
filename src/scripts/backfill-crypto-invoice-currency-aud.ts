/**
 * Safe backfill: crypto (HEDERA / CRYPTO) payment links where currency + invoice_currency
 * were both USD due to historical rail↔invoice coupling, but the merchant's latest
 * merchant_settings.default_currency matches the target (default AUD).
 *
 * Run from the `src` package (where Prisma client is installed):
 *   cd src
 *   npx tsx scripts/backfill-crypto-invoice-currency-aud.ts
 *   npx tsx scripts/backfill-crypto-invoice-currency-aud.ts --execute
 *   npx tsx scripts/backfill-crypto-invoice-currency-aud.ts --execute --before=2026-04-30T00:00:00.000Z
 *   npx tsx scripts/backfill-crypto-invoice-currency-aud.ts --org-ids=uuid1,uuid2
 *   npx tsx scripts/backfill-crypto-invoice-currency-aud.ts --rollback-from=../scripts/.backfill-audit/invoice-currency-aud-....json
 *
 * SQL preview (read-only): ../scripts/sql/preview-crypto-usd-aud-backfill.sql
 *
 * Outputs:
 *   - Console summary + per-row tier (AUTO_SAFE vs MANUAL_REVIEW + reason)
 *   - JSON audit on --execute: ../scripts/.backfill-audit/invoice-currency-aud-<timestamp>.json
 *
 * Rollback: use --rollback-from= that audit file, or apply SQL from updates[].before manually.
 *
 * Paid / Xero / ledger: see classify() — never auto-mutate confirmed payments, ledger rows, or successful Xero invoices.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';

config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/server/prisma';

type Tier = 'AUTO_SAFE' | 'MANUAL_REVIEW';

interface CandidateRow {
  id: string;
  organization_id: string;
  short_code: string;
  status: string;
  payment_method: string | null;
  currency: string;
  invoice_currency: string;
  created_at: Date;
  default_ccy: string;
  has_payment_confirmed: boolean;
  has_ledger: boolean;
  xero_invoice_success: boolean;
}

interface Classified extends CandidateRow {
  tier: Tier;
  reasons: string[];
}

function parseArgs(argv: string[]) {
  const execute = argv.includes('--execute');
  const rollbackFrom = argv.find((a) => a.startsWith('--rollback-from='))?.split('=')[1];
  const beforeArg = argv.find((a) => a.startsWith('--before='))?.split('=')[1];
  const orgIdsArg = argv.find((a) => a.startsWith('--org-ids='))?.split('=')[1];
  const source = argv.find((a) => a.startsWith('--source='))?.split('=')[1] ?? 'USD';
  const target = argv.find((a) => a.startsWith('--target='))?.split('=')[1] ?? 'AUD';
  const merchantDefault =
    argv.find((a) => a.startsWith('--merchant-default='))?.split('=')[1] ?? 'AUD';
  return {
    execute: Boolean(execute),
    rollbackFrom: rollbackFrom?.trim(),
    before: beforeArg ? new Date(beforeArg) : null,
    orgIds: orgIdsArg
      ? orgIdsArg.split(',').map((s) => s.trim()).filter(Boolean)
      : null,
    source: source.trim().toUpperCase(),
    target: target.trim().toUpperCase(),
    merchantDefault: merchantDefault.trim().toUpperCase(),
  };
}

function classify(row: CandidateRow): Classified {
  const reasons: string[] = [];

  if (row.has_payment_confirmed) {
    reasons.push('has_PAYMENT_CONFIRMED');
  }
  if (row.has_ledger) {
    reasons.push('has_ledger_entries');
  }
  if (row.xero_invoice_success) {
    reasons.push('xero_INVOICE_SUCCESS');
  }

  const terminalOrPaidLike = [
    'PAID',
    'PAID_UNVERIFIED',
    'REQUIRES_REVIEW',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
  ].includes(row.status);
  if (terminalOrPaidLike) {
    reasons.push(`status=${row.status}`);
  }

  let tier: Tier = 'MANUAL_REVIEW';
  if (
    reasons.length === 0 &&
    ['DRAFT', 'OPEN', 'EXPIRED', 'CANCELED'].includes(row.status)
  ) {
    tier = 'AUTO_SAFE';
  }

  if (tier === 'MANUAL_REVIEW' && reasons.length === 0) {
    reasons.push(`status=${row.status}_not_auto_tier`);
  }

  return { ...row, tier, reasons };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertOrgIds(orgIds: string[]) {
  for (const id of orgIds) {
    if (!UUID_RE.test(id)) {
      throw new Error(`Invalid --org-ids entry (expected UUID): ${id}`);
    }
  }
}

async function fetchCandidates(params: {
  orgIds: string[] | null;
  before: Date | null;
  source: string;
  merchantDefault: string;
}): Promise<CandidateRow[]> {
  const orgIds = params.orgIds;
  if (orgIds?.length) {
    assertOrgIds(orgIds);
  }
  const orgInSql =
    orgIds && orgIds.length > 0
      ? Prisma.raw(
          `AND pl.organization_id IN (${orgIds.map((id) => `'${id}'::uuid`).join(', ')})`
        )
      : Prisma.empty;
  const beforeCondition = params.before
    ? Prisma.sql`AND pl.created_at < ${params.before}`
    : Prisma.empty;

  let rows: CandidateRow[];
  try {
    rows = await prisma.$queryRaw<CandidateRow[]>`
    WITH latest_ms AS (
      SELECT DISTINCT ON (organization_id)
        organization_id,
        upper(trim(default_currency::text)) AS default_ccy
      FROM merchant_settings
      ORDER BY organization_id, created_at DESC
    )
    SELECT
      pl.id,
      pl.organization_id,
      pl.short_code,
      pl.status::text AS status,
      pl.payment_method::text AS payment_method,
      pl.currency,
      pl.invoice_currency,
      pl.created_at,
      ms.default_ccy,
      EXISTS (
        SELECT 1 FROM payment_events pe
        WHERE pe.payment_link_id = pl.id AND pe.event_type = 'PAYMENT_CONFIRMED'
      ) AS has_payment_confirmed,
      EXISTS (
        SELECT 1 FROM ledger_entries le WHERE le.payment_link_id = pl.id
      ) AS has_ledger,
      EXISTS (
        SELECT 1 FROM xero_syncs x
        WHERE x.payment_link_id = pl.id
          AND x.sync_type = 'INVOICE'
          AND x.status = 'SUCCESS'
      ) AS xero_invoice_success
    FROM payment_links pl
    INNER JOIN latest_ms ms ON ms.organization_id = pl.organization_id
    WHERE pl.payment_method IN ('HEDERA', 'CRYPTO')
      AND ms.default_ccy = ${params.merchantDefault}
      AND pl.currency = ${params.source}
      AND pl.invoice_currency = ${params.source}
      ${orgInSql}
      ${beforeCondition}
    ORDER BY pl.organization_id, pl.created_at
  `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('invoice_currency') && msg.includes('does not exist')) {
      throw new Error(
        'Database is missing payment_links.invoice_currency. Apply Prisma migrations (invoice_currency) before running this script.'
      );
    }
    throw e;
  }

  return rows;
}

async function rollbackFromFile(path: string) {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) {
    throw new Error(`Audit file not found: ${abs}`);
  }
  const raw = JSON.parse(readFileSync(abs, 'utf8')) as {
    updates: Array<{
      id: string;
      before: { currency: string; invoice_currency: string };
    }>;
  };
  if (!raw.updates?.length) {
    throw new Error('No updates[] in audit file');
  }
  console.log(`Rolling back ${raw.updates.length} rows from ${abs}`);
  for (const u of raw.updates) {
    await prisma.payment_links.update({
      where: { id: u.id },
      data: {
        currency: u.before.currency,
        invoice_currency: u.before.invoice_currency,
        updated_at: new Date(),
      },
    });
    console.log('Restored', u.id);
  }
  console.log('Rollback complete.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.rollbackFrom) {
    await rollbackFromFile(args.rollbackFrom);
    await prisma.$disconnect();
    return;
  }

  const rows = await fetchCandidates({
    orgIds: args.orgIds,
    before: args.before,
    source: args.source,
    merchantDefault: args.merchantDefault,
  });

  const classified = rows.map((r) => classify(r));
  const autoSafe = classified.filter((c) => c.tier === 'AUTO_SAFE');
  const manual = classified.filter((c) => c.tier === 'MANUAL_REVIEW');

  console.log('\n=== Crypto invoice currency backfill ===\n');
  console.log(`Mode: ${args.execute ? 'EXECUTE (writes)' : 'DRY-RUN (no writes)'}`);
  console.log(
    `Match: payment_method HEDERA|CRYPTO, currency=invoice=${args.source}, latest merchant_settings.default_currency=${args.merchantDefault}`
  );
  if (args.before) console.log(`Filter created_at < ${args.before.toISOString()}`);
  if (args.orgIds?.length) console.log(`Filter organization_id IN (${args.orgIds.length} orgs)`);
  console.log(`\nCandidates: ${classified.length} (AUTO_SAFE: ${autoSafe.length}, MANUAL_REVIEW: ${manual.length})\n`);

  for (const c of classified.slice(0, 50)) {
    console.log(
      `${c.tier}\t${c.short_code}\t${c.id}\tstatus=${c.status}\t` +
        `method=${c.payment_method}\t` +
        `${c.currency}/${c.invoice_currency}\t` +
        (c.tier === 'MANUAL_REVIEW' ? `reasons=[${c.reasons.join(', ')}]` : '')
    );
  }
  if (classified.length > 50) {
    console.log(`... and ${classified.length - 50} more rows (audit JSON lists all on --execute)\n`);
  }

  if (!args.execute && autoSafe.length) {
    console.log('\n--- Example dry-run (first AUTO_SAFE row) ---');
    const ex = autoSafe[0];
    console.log(
      JSON.stringify(
        {
          id: ex.id,
          short_code: ex.short_code,
          would_set: {
            currency: args.target,
            invoice_currency: args.target,
          },
          previous: { currency: ex.currency, invoice_currency: ex.invoice_currency },
        },
        null,
        2
      )
    );
  }

  if (!args.execute) {
    console.log('\nNo database writes performed. Re-run with --execute to apply AUTO_SAFE updates only.\n');
    await prisma.$disconnect();
    return;
  }

  const auditDir = resolve(__dirname, '../../scripts/.backfill-audit');
  mkdirSync(auditDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = resolve(auditDir, `invoice-currency-aud-${stamp}.json`);

  const updates: Array<{
    id: string;
    short_code: string;
    organization_id: string;
    before: { currency: string; invoice_currency: string };
    after: { currency: string; invoice_currency: string };
  }> = [];

  for (const c of autoSafe) {
    const before = { currency: c.currency, invoice_currency: c.invoice_currency };
    await prisma.payment_links.update({
      where: { id: c.id },
      data: {
        currency: args.target,
        invoice_currency: args.target,
        updated_at: new Date(),
      },
    });
    updates.push({
      id: c.id,
      short_code: c.short_code,
      organization_id: c.organization_id,
      before,
      after: { currency: args.target, invoice_currency: args.target },
    });
  }

  const audit = {
    script: 'src/scripts/backfill-crypto-invoice-currency-aud.ts',
    executedAt: new Date().toISOString(),
    params: args,
    counts: {
      candidates: classified.length,
      autoSafeUpdated: updates.length,
      manualReviewSkipped: manual.length,
    },
    manualReviewIds: manual.map((m) => ({
      id: m.id,
      short_code: m.short_code,
      status: m.status,
      reasons: m.reasons,
    })),
    updates,
  };

  writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');
  console.log(`\nWrote audit / rollback payload: ${auditPath}`);
  console.log(`Updated ${updates.length} payment_links (AUTO_SAFE only).\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
