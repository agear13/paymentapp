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
const RECONCILIATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'jobs',
  'stripe-reconciliation.ts'
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

describe('Settlement integrity guardrails', () => {
  it('enforces DB-level duplicate PAYMENT_CONFIRMED prevention', () => {
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    expect(migration).toContain('ux_payment_events_confirmed_per_link');
    expect(migration).toContain("WHERE event_type = 'PAYMENT_CONFIRMED'");
  });

  it('invalid transitions are explicitly guarded in state machine', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'payments', 'state-machine.ts'),
      'utf-8'
    );
    expect(source).toContain('throw new InvalidPaymentLinkTransitionError');
    expect(source).toContain('const isAllowed = isValidTransition(paymentLink.status, targetState)');
  });

  it('replayed settlement no-ops when PAYMENT_CONFIRMED already exists', () => {
    const source = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
    expect(source).toContain('Idempotent skip: PAYMENT_CONFIRMED already exists for paymentLinkId');
    expect(source).toContain('alreadyProcessed: true');
  });

  it('duplicate ledger posting is prevented by idempotent guard before settlement posting', () => {
    const source = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');
    const guardIndex = source.indexOf('const existingConfirmed = await tx.payment_events.findFirst');
    const stripePostingIndex = source.indexOf('await postStripeSettlement(');
    const hederaPostingIndex = source.indexOf('await postHederaSettlement(');
    const wisePostingIndex = source.indexOf('await postWiseSettlement(');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(stripePostingIndex).toBeGreaterThan(guardIndex);
    expect(hederaPostingIndex).toBeGreaterThan(guardIndex);
    expect(wisePostingIndex).toBeGreaterThan(guardIndex);
  });

  it('reconciliation replay remains idempotent by pre-checking before confirmPayment', () => {
    const source = fs.readFileSync(RECONCILIATION_PATH, 'utf-8');
    const preCheckIndex = source.indexOf('isStripeSuccessEventAlreadyProcessed');
    const invokeIndex = source.indexOf('confirmPayment({');

    expect(preCheckIndex).toBeGreaterThan(-1);
    expect(invokeIndex).toBeGreaterThan(-1);
    expect(preCheckIndex).toBeLessThan(invokeIndex);
  });
});
