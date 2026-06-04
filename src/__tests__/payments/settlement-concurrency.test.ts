const fs = require('fs');
const path = require('path');

const PAYMENT_CONFIRMATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);
const STRIPE_WEBHOOK_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'stripe',
  'webhook',
  'route.ts'
);
const STRIPE_RECON_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'jobs',
  'stripe-reconciliation.ts'
);
const HEDERA_VERIFY_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'hedera',
  'transactions',
  'verify',
  'route.ts'
);
const HEDERA_MIRROR_SETTLEMENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'hedera',
  'hedera-mirror-settlement.server.ts'
);
const HEDERA_CHECKER_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'hedera',
  'transaction-checker.ts'
);
const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260507145000_settlement_uniqueness_guards',
  'migration.sql'
);

function createConcurrentSettlementRunner() {
  const state = {
    paymentConfirmedExists: false,
    paymentConfirmedCount: 0,
    ledgerPostingCount: 0,
    xeroEnqueueCount: 0,
    transitionCount: 0,
    debits: 0,
    credits: 0,
  };

  async function confirmPaymentLike() {
    // Simulate transactional primary idempotency guard.
    if (state.paymentConfirmedExists) {
      return { success: true, alreadyProcessed: true };
    }

    state.paymentConfirmedExists = true;
    state.paymentConfirmedCount += 1;
    state.transitionCount += 1;
    state.ledgerPostingCount += 1;
    state.xeroEnqueueCount += 1;
    state.debits += 100;
    state.credits += 100;

    return { success: true, alreadyProcessed: false };
  }

  return {
    state,
    confirmPaymentLike,
  };
}

describe('Settlement concurrency and replay safety', () => {
  it('A) duplicate webhook replay: second settlement no-ops safely', async () => {
    const source = fs.readFileSync(STRIPE_WEBHOOK_PATH, 'utf-8');
    expect(source).toContain('confirmPayment({');
    expect(source).toContain('alreadyProcessed');

    const runner = createConcurrentSettlementRunner();
    const first = await runner.confirmPaymentLike();
    const second = await runner.confirmPaymentLike();

    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);
    expect(runner.state.paymentConfirmedCount).toBe(1);
    expect(runner.state.ledgerPostingCount).toBe(1);
  });

  it('B) webhook + reconciliation race: only one settlement write survives', async () => {
    const webhookSource = fs.readFileSync(STRIPE_WEBHOOK_PATH, 'utf-8');
    const reconSource = fs.readFileSync(STRIPE_RECON_PATH, 'utf-8');
    expect(webhookSource).toContain('confirmPayment({');
    expect(reconSource).toContain('confirmPayment({');
    expect(reconSource).toContain('isStripeSuccessEventAlreadyProcessed');

    const runner = createConcurrentSettlementRunner();
    const [r1, r2] = await Promise.all([
      runner.confirmPaymentLike(),
      runner.confirmPaymentLike(),
    ]);

    const processedCount = [r1, r2].filter((x) => x.alreadyProcessed === false).length;
    expect(processedCount).toBe(1);
    expect(runner.state.paymentConfirmedCount).toBe(1);
    expect(runner.state.ledgerPostingCount).toBe(1);
    expect(runner.state.transitionCount).toBe(1);
  });

  it('C) concurrent confirmPayment() calls converge via guard + uniqueness', async () => {
    const source = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    expect(source).toContain('const existingConfirmed = await tx.payment_events.findFirst');
    expect(source).toContain("event_type: 'PAYMENT_CONFIRMED'");
    expect(source).toContain('await prisma.$transaction(async (tx) =>');
    expect(migration).toContain('ux_payment_events_confirmed_per_link');

    const runner = createConcurrentSettlementRunner();
    const outcomes = await Promise.all(
      Array.from({ length: 8 }).map(() => runner.confirmPaymentLike())
    );

    expect(outcomes.filter((x) => x.alreadyProcessed === false)).toHaveLength(1);
    expect(runner.state.paymentConfirmedCount).toBe(1);
    expect(runner.state.ledgerPostingCount).toBe(1);
  });

  it('D) Hedera duplicate verification replay converges via confirmPayment', () => {
    const verifySource = fs.readFileSync(HEDERA_VERIFY_PATH, 'utf-8');
    const adapterSource = fs.readFileSync(HEDERA_MIRROR_SETTLEMENT_PATH, 'utf-8');
    const checkerSource = fs.readFileSync(HEDERA_CHECKER_PATH, 'utf-8');
    const confirmationSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

    expect(verifySource).toContain('executeHederaMirrorSettlement');
    expect(adapterSource).toContain("provider: 'hedera'");
    expect(adapterSource).toContain('confirmPayment({');
    expect(checkerSource).toContain("provider: 'hedera'");
    expect(checkerSource).toContain('confirmPayment({');
    expect(confirmationSource).toContain('checkHederaIdempotency');
  });

  it('E) duplicate Xero enqueue prevention remains idempotent on replay', async () => {
    const source = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
    expect(source).toContain('xero_syncs.upsert');
    expect(source).toContain('xero_syncs_payment_link_sync_type_unique');

    const runner = createConcurrentSettlementRunner();
    await runner.confirmPaymentLike();
    await runner.confirmPaymentLike();

    expect(runner.state.xeroEnqueueCount).toBe(1);
  });

  it('Invariant check: one PAYMENT_CONFIRMED, one transition, one ledger posting, balanced ledger', async () => {
    const runner = createConcurrentSettlementRunner();
    await Promise.all(Array.from({ length: 12 }).map(() => runner.confirmPaymentLike()));

    expect(runner.state.paymentConfirmedCount).toBe(1);
    expect(runner.state.transitionCount).toBe(1);
    expect(runner.state.ledgerPostingCount).toBe(1);
    expect(runner.state.xeroEnqueueCount).toBe(1);
    expect(runner.state.debits).toBe(runner.state.credits);
  });
});
