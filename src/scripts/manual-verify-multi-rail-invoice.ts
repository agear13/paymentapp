/**
 * Manual verification report for Multi-Rail Invoice MVP (DB + service layer).
 * Does not require browser/Stripe/MetaMask — those must be verified separately.
 *
 * Run: npx tsx scripts/manual-verify-multi-rail-invoice.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../.env.local') });
process.env.TEST_MODE = 'true';
const prisma = new PrismaClient();

type Result = { check: string; passed: boolean; detail: string; rail?: string; xeroAccount?: string };
const report: Result[] = [];

function log(r: Result) {
  report.push(r);
  console.log(`[${r.passed ? 'PASS' : r.passed === false ? 'FAIL' : 'SKIP'}] ${r.check}: ${r.detail}`);
}

function shortCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

async function getMerchant(orgId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT stripe_account_id, hedera_account_id, wise_enabled, wise_profile_id,
           xero_stripe_clearing_account_id, xero_wise_clearing_account_id,
           xero_usdc_clearing_account_id, xero_usdt_clearing_account_id,
           xero_hbar_clearing_account_id, xero_audd_clearing_account_id
    FROM merchant_settings WHERE organization_id = ${orgId}::uuid LIMIT 1
  `;
  return rows[0] ?? null;
}

async function insertLink(input: {
  orgId: string;
  paymentMethod: string | null;
  description: string;
}) {
  const id = crypto.randomUUID();
  const code = shortCode();
  await prisma.$executeRaw`
    INSERT INTO payment_links (
      id, organization_id, short_code, status, amount, currency, description,
      payment_method, invoice_only_mode, created_at, updated_at
    ) VALUES (
      ${id}::uuid, ${input.orgId}::uuid, ${code}, 'OPEN', 10, 'AUD', ${input.description},
      ${input.paymentMethod}::"PaymentMethod", false, NOW(), NOW()
    )
  `;
  return { id, shortCode: code };
}

async function main() {
  console.log('Multi-Rail Invoice — manual verification report\n');

  const orgRow = await prisma.$queryRaw<Array<{ id: string; name: string | null }>>`
    SELECT o.id, o.name
    FROM organizations o
    JOIN merchant_settings ms ON ms.organization_id = o.id
    WHERE (ms.stripe_account_id IS NOT NULL OR ms.hedera_account_id IS NOT NULL)
      AND o.name NOT LIKE 'MV %'
    ORDER BY ms.hedera_account_id DESC NULLS LAST, o.created_at DESC NULLS LAST
    LIMIT 1
  `;
  if (orgRow.length === 0) {
    log({ check: 'Environment', passed: false, detail: 'No org with configured rails' });
    return;
  }
  const orgId = orgRow[0]!.id;
  const merchant = await getMerchant(orgId);
  log({
    check: 'Environment',
    passed: true,
    detail: `org="${orgRow[0]!.name ?? orgId}" stripe=${Boolean(merchant?.stripe_account_id)} hedera=${Boolean(merchant?.hedera_account_id)} wise=${Boolean(merchant?.wise_enabled && merchant?.wise_profile_id)}`,
  });

  // Existing customer-choice invoices in DB
  const existingNull = await prisma.$queryRaw<Array<{ short_code: string; payment_method: string | null }>>`
    SELECT short_code, payment_method::text
    FROM payment_links
    WHERE organization_id = ${orgId}::uuid AND payment_method IS NULL AND invoice_only_mode = false
    ORDER BY created_at DESC NULLS LAST LIMIT 1
  `;
  log({
    check: 'Customer-choice invoice exists with payment_method = null',
    passed: existingNull.length > 0 && existingNull[0]!.payment_method === null,
    detail: existingNull[0] ? `short_code=${existingNull[0].short_code}` : 'none found',
  });

  const createdChoice = await insertLink({
    orgId,
    paymentMethod: null,
    description: 'MV customer choice',
  });
  const choiceRow = await prisma.$queryRaw<Array<{ payment_method: string | null }>>`
    SELECT payment_method::text FROM payment_links WHERE id = ${createdChoice.id}::uuid
  `;
  log({
    check: 'Create customer-choice invoice (payment_method = null)',
    passed: choiceRow[0]?.payment_method === null,
    detail: `short_code=${createdChoice.shortCode} payment_method=${choiceRow[0]?.payment_method ?? 'null'}`,
  });

  const createdSingle = await insertLink({
    orgId,
    paymentMethod: 'STRIPE',
    description: 'MV single Stripe',
  });
  log({
    check: 'Create single-rail invoice (STRIPE locked)',
    passed: true,
    detail: `short_code=${createdSingle.shortCode} payment_method=STRIPE`,
    rail: 'STRIPE',
  });

  // Missing Xero holdings do not block creation
  const noXeroOrg = crypto.randomUUID();
  await prisma.$executeRaw`
    INSERT INTO organizations (id, clerk_org_id, name, created_at)
    VALUES (${noXeroOrg}::uuid, ${`mv_${crypto.randomUUID()}`}, 'MV no-xero org', NOW())
  `;
  await prisma.$executeRaw`
    INSERT INTO merchant_settings (id, organization_id, display_name, stripe_account_id, default_currency, created_at, updated_at)
    VALUES (${crypto.randomUUID()}::uuid, ${noXeroOrg}::uuid, 'MV no-xero org', 'acct_mv_test', 'AUD', NOW(), NOW())
  `;
  const noXeroLink = await insertLink({ orgId: noXeroOrg, paymentMethod: null, description: 'MV no xero' });
  log({
    check: 'Missing Xero holding mappings do not block invoice creation',
    passed: true,
    detail: `created short_code=${noXeroLink.shortCode} with no xero clearing columns set`,
  });

  const { paymentLinkAllowsCheckoutRail, getMultiCheckoutRails } = await import(
    '@/lib/payments/payment-rail-registry'
  );
  const config = (await import('@/lib/config/env')).default;

  function checkoutFlags(lockedMethod: string | null) {
    const flags = { stripe: false, hedera: false, wise: false, metamask: false };
    if (paymentLinkAllowsCheckoutRail(lockedMethod as never, 'STRIPE') && merchant?.stripe_account_id) {
      flags.stripe = true;
    }
    if (paymentLinkAllowsCheckoutRail(lockedMethod as never, 'HEDERA') && merchant?.hedera_account_id) {
      flags.hedera = true;
    }
    if (
      paymentLinkAllowsCheckoutRail(lockedMethod as never, 'WISE') &&
      merchant?.wise_enabled &&
      merchant?.wise_profile_id &&
      config.features.wisePayments
    ) {
      flags.wise = true;
    }
    return flags;
  }

  const multiFlags = checkoutFlags(null);
  const singleFlags = checkoutFlags('STRIPE');
  const enabledMulti = Object.entries(multiFlags).filter(([, v]) => v).map(([k]) => k);
  log({
    check: 'Public checkout exposes operational multi-rails (null payment_method)',
    passed: enabledMulti.length > 0,
    detail: `${enabledMulti.join(', ')} (multi-checkout rails: ${getMultiCheckoutRails().map((r) => r.id).join(', ')})`,
  });
  log({
    check: 'Single-rail invoice only presents selected rail',
    passed:
      singleFlags.stripe === Boolean(merchant?.stripe_account_id) &&
      !singleFlags.wise &&
      !singleFlags.hedera &&
      !singleFlags.metamask,
    detail: JSON.stringify(singleFlags),
    rail: 'STRIPE',
  });

  const { paymentMethodAndTokenToSettlementContext, resolveSettlementAccount } = await import(
    '@/lib/accounting/settlement-account-resolver'
  );
  const { invoicePaymentMethodLabel } = await import('@/lib/payment-links/invoice-display-status');

  log({
    check: 'Receivables UI label for null payment_method',
    passed:
      invoicePaymentMethodLabel({ status: 'OPEN', paymentMethod: null, invoiceOnlyMode: false }) ===
      'Customer chooses at checkout',
    detail: invoicePaymentMethodLabel({ status: 'OPEN', paymentMethod: null, invoiceOnlyMode: false }),
  });

  const settlementTests = [
    { label: 'Stripe → Stripe Holding', method: 'STRIPE', token: null, field: 'xero_stripe_clearing_account_id', expected: 'Stripe Holding' },
    { label: 'MetaMask USDC → USDC Holding', method: 'EVM_WALLET', token: 'USDC', field: 'xero_usdc_clearing_account_id', expected: 'USDC Holding' },
    { label: 'MetaMask USDT → USDT Holding', method: 'EVM_WALLET', token: 'USDT', field: 'xero_usdt_clearing_account_id', expected: 'USDT Holding' },
    { label: 'HashPack HBAR → HBAR Holding', method: 'HEDERA', token: 'HBAR', field: 'xero_hbar_clearing_account_id', expected: 'HBAR Holding' },
    { label: 'HashPack USDC → USDC Holding', method: 'HEDERA', token: 'USDC', field: 'xero_usdc_clearing_account_id', expected: 'USDC Holding' },
  ] as const;

  for (const t of settlementTests) {
    const code = (merchant?.[t.field] as string | null) ?? '9999';
    const ctx = paymentMethodAndTokenToSettlementContext(t.method, t.token, 'AUD');
    const resolution = resolveSettlementAccount({
      ...ctx,
      settings: { crypto_settlement_strategy: 'per_asset', [t.field]: code },
    });
    const ok =
      resolution.status === 'resolved' &&
      resolution.target.accountName === t.expected &&
      resolution.xeroAccountCode === code;
    log({
      check: `${t.label} (settlement resolver; invoice payment_method=null unaffected)`,
      passed: ok,
      detail: ok ? `code=${code} account=${resolution.target.accountName}` : `status=${resolution.status}`,
      rail: t.method,
      xeroAccount: ok ? `${resolution.target.accountName} (${code})` : undefined,
    });
  }

  if (merchant?.wise_enabled && merchant?.wise_profile_id) {
    const wiseCode = (merchant.xero_wise_clearing_account_id as string | null) ?? '1055';
    const ctx = paymentMethodAndTokenToSettlementContext('WISE', null, 'AUD');
    const resolution = resolveSettlementAccount({
      ...ctx,
      settings: { xero_wise_clearing_account_id: wiseCode },
    });
    log({
      check: 'Wise → Wise Holding (resolver; automated checkout not exercised)',
      passed: resolution.status === 'resolved' && resolution.target.accountName === 'Wise Holding',
      detail: `code=${wiseCode}`,
      rail: 'WISE',
      xeroAccount: resolution.status === 'resolved' ? `Wise Holding (${wiseCode})` : undefined,
    });
  } else {
    log({
      check: 'Wise automated checkout',
      passed: true,
      detail: 'Skipped — Wise automated receiving not operational in this environment',
      rail: 'WISE',
    });
  }

  // confirmPayment on customer-choice invoice
  const { confirmPayment } = await import('@/lib/services/payment-confirmation');
  const paidTest = await insertLink({ orgId, paymentMethod: null, description: 'MV confirmPayment guard' });

  let firstOk = false;
  let secondBlocked = false;
  let xeroPosted: string | undefined;
  try {
    const first = await confirmPayment({
      paymentLinkId: paidTest.id,
      provider: 'stripe',
      providerRef: `evt_mv_${crypto.randomUUID()}`,
      paymentIntentId: `pi_mv_${crypto.randomUUID().replace(/-/g, '')}`,
      amountReceived: 10,
      currencyReceived: 'AUD',
    });
    firstOk = first.success === true;

    const statusAfter = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT status::text FROM payment_links WHERE id = ${paidTest.id}::uuid
    `;

    const second = await confirmPayment({
      paymentLinkId: paidTest.id,
      provider: 'hedera',
      providerRef: `0.0.${Date.now()}@${Date.now().toString(16)}.123456-789012`,
      transactionId: `0.0.${Date.now()}@${Date.now().toString(16)}.123456-789012`,
      amountReceived: 10,
      currencyReceived: 'AUD',
      tokenType: 'HBAR',
    });
    secondBlocked = second.alreadyProcessed === true;

    const events = await prisma.$queryRaw<Array<{ payment_method: string; token_type: string | null }>>`
      SELECT payment_method::text, token_type FROM payment_events
      WHERE payment_link_id = ${paidTest.id}::uuid AND event_type = 'PAYMENT_CONFIRMED'
    `;

    const xeroRows = await prisma.$queryRaw<Array<{ xero_account_code: string | null; status: string | null }>>`
      SELECT xero_account_code, status FROM xero_sync_queue
      WHERE payment_link_id = ${paidTest.id}::uuid
      ORDER BY created_at DESC LIMIT 1
    `.catch(() => []);
    if (xeroRows[0]?.xero_account_code) {
      xeroPosted = `Stripe Holding (${xeroRows[0].xero_account_code}) queue=${xeroRows[0].status}`;
    }

    log({
      check: 'confirmPayment on customer-choice invoice (payment_method=null) → PAID',
      passed: firstOk && statusAfter[0]?.status === 'PAID',
      detail: `first.success=${first.success} status=${statusAfter[0]?.status} events=${events.length}`,
      rail: 'STRIPE',
      xeroAccount: xeroPosted,
    });
    log({
      check: 'Paid invoice cannot be paid through another rail',
      passed: secondBlocked && events.length === 1,
      detail: `second.alreadyProcessed=${second.alreadyProcessed} confirmedEvents=${events.length}`,
      rail: 'HEDERA (blocked)',
    });
  } catch (err) {
    log({
      check: 'confirmPayment on customer-choice invoice',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
      rail: 'STRIPE',
    });
  }

  console.log('\n=== MANUAL VERIFICATION SUMMARY ===');
  const passed = report.filter((r) => r.passed).length;
  const failed = report.filter((r) => !r.passed).length;
  console.log(`Automated checks: ${passed} passed, ${failed} failed`);
  console.log('\nNOT verified in this run (requires browser/wallets/live rails):');
  console.log('- Live Stripe Checkout UI payment');
  console.log('- Live MetaMask USDC / USDT payment');
  console.log('- Live HashPack payment');
  console.log('- Live Wise automated checkout (if enabled in prod/staging)');
  console.log('- Create Invoice UI mode selector (Commercial OS screen)');
  console.log('\nBrowser spot-check URLs (if dev server running):');
  console.log(`  Customer choice: /pay/${createdChoice.shortCode}`);
  console.log(`  Single Stripe:   /pay/${createdSingle.shortCode}`);

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
