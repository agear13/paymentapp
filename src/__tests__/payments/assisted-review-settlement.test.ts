const fs = require('fs');
const path = require('path');

const {
  bankReviewProviderRef,
  cryptoReviewProviderRef,
  assistedReviewProviderRef,
  ASSISTED_REVIEW_SETTLEMENT_ENTRY_STATUSES,
} = require('../../lib/payments/assisted-review-settlement.server');

const {
  CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES,
} = require('../../lib/services/payment-confirmation');

const BANK_REVIEW_ROUTE = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'payment-links',
  'manual-bank-confirmations',
  '[id]',
  'review',
  'route.ts'
);

const CRYPTO_REVIEW_ROUTE = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'payment-links',
  'crypto-confirmations',
  '[id]',
  'review',
  'route.ts'
);

const ASSISTED_SETTLEMENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'payments',
  'assisted-review-settlement.server.ts'
);

const ASSISTED_TRACE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'payments',
  'assisted-review-settlement-trace.ts'
);

const PAYMENT_CONFIRMATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);

const MANUAL_SETTLEMENT_ROUTE = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'payment-links',
  '[id]',
  'manual-settlement',
  'route.ts'
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

describe('assisted review settlement provider refs (R3)', () => {
  it('uses stable bank-review:{confirmationId} format', () => {
    expect(bankReviewProviderRef('conf-1')).toBe('bank-review:conf-1');
  });

  it('uses stable crypto-review:{confirmationId} format', () => {
    expect(cryptoReviewProviderRef('conf-2')).toBe('crypto-review:conf-2');
  });

  it('routes rail to correct prefix', () => {
    expect(assistedReviewProviderRef('MANUAL_BANK', 'x')).toBe('bank-review:x');
    expect(assistedReviewProviderRef('CRYPTO', 'y')).toBe('crypto-review:y');
  });
});

describe('executeAssistedReviewSettlement adapter (R3 contract)', () => {
  const adapterSource = fs.readFileSync(ASSISTED_SETTLEMENT_PATH, 'utf-8');
  const traceSource = fs.readFileSync(ASSISTED_TRACE_PATH, 'utf-8');

  it('converges through confirmPayment only (no inline settlement)', () => {
    expect(adapterSource).toContain('confirmPayment({');
    expect(adapterSource).not.toContain('transitionPaymentLinkState');
    expect(adapterSource).not.toContain('postWiseSettlement');
    expect(adapterSource).not.toContain('applyRevenueShareSplits');
  });

  it('uses manual provider with assisted_review metadata', () => {
    expect(adapterSource).toContain("provider: 'manual'");
    expect(adapterSource).toContain("settlementPath: 'assisted_review'");
    expect(adapterSource).toContain("reason: 'merchant_mark_valid'");
  });

  it('documents entry statuses for review (not OPEN)', () => {
    expect(ASSISTED_REVIEW_SETTLEMENT_ENTRY_STATUSES).toEqual([
      'PAID_UNVERIFIED',
      'REQUIRES_REVIEW',
    ]);
    expect(adapterSource).toContain('ASSISTED_REVIEW_SETTLEMENT_ENTRY_STATUSES');
  });

  it('emits bank and crypto settlement trace stages', () => {
    expect(traceSource).toContain('bank_review_settlement_started');
    expect(traceSource).toContain('bank_review_settlement_completed');
    expect(traceSource).toContain('bank_review_settlement_failed');
    expect(traceSource).toContain('crypto_review_settlement_started');
    expect(traceSource).toContain('crypto_review_settlement_completed');
    expect(traceSource).toContain('crypto_review_settlement_failed');
  });

  it('allows PAID backfill when PAYMENT_CONFIRMED missing', () => {
    expect(adapterSource).toContain("status === 'PAID'");
    expect(adapterSource).toContain("event_type: 'PAYMENT_CONFIRMED'");
  });
});

describe('manual bank review route (R3)', () => {
  const routeSource = fs.readFileSync(BANK_REVIEW_ROUTE, 'utf-8');

  it('mark_valid uses executeAssistedReviewSettlement not direct PAID transition', () => {
    expect(routeSource).toContain('executeAssistedReviewSettlement');
    expect(routeSource).toContain("rail: 'MANUAL_BANK'");
    expect(routeSource).not.toMatch(
      /executeAssistedReviewSettlement[\s\S]*targetState:\s*'PAID'/
    );
    const afterSettlement = routeSource.split('executeAssistedReviewSettlement')[1] ?? '';
    expect(afterSettlement).not.toContain("targetState: 'PAID'");
  });

  it('does not duplicate referral conversion in route', () => {
    expect(routeSource).not.toContain('createReferralConversionFromPaymentConfirmed');
  });

  it('surfaces settlement failure to merchant', () => {
    expect(routeSource).toContain('BANK_REVIEW_SETTLEMENT_CONFIRM_FAILED');
    expect(routeSource).toContain('BANK_REVIEW_SETTLEMENT_CONFIRMED');
  });

  it('flag_investigate still uses REQUIRES_REVIEW transition', () => {
    expect(routeSource).toContain("targetState: 'REQUIRES_REVIEW'");
  });
});

describe('crypto review route (R3)', () => {
  const routeSource = fs.readFileSync(CRYPTO_REVIEW_ROUTE, 'utf-8');

  it('mark_valid uses executeAssistedReviewSettlement not direct PAID transition', () => {
    expect(routeSource).toContain('executeAssistedReviewSettlement');
    expect(routeSource).toContain("rail: 'CRYPTO'");
    expect(routeSource).not.toMatch(
      /executeAssistedReviewSettlement[\s\S]*targetState:\s*'PAID'/
    );
  });

  it('does not duplicate referral conversion in route', () => {
    expect(routeSource).not.toContain('createReferralConversionFromPaymentConfirmed');
  });

  it('surfaces settlement failure to merchant', () => {
    expect(routeSource).toContain('CRYPTO_REVIEW_SETTLEMENT_CONFIRM_FAILED');
    expect(routeSource).toContain('CRYPTO_REVIEW_SETTLEMENT_CONFIRMED');
  });
});

describe('confirmPayment entry states (R3)', () => {
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

  it('documents OPEN, PAID_UNVERIFIED, REQUIRES_REVIEW as settlement entry statuses', () => {
    expect(CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES).toEqual([
      'OPEN',
      'PAID_UNVERIFIED',
      'REQUIRES_REVIEW',
    ]);
    expect(confirmSource).toContain('CONFIRM_PAYMENT_SETTLEMENT_ENTRY_STATUSES');
  });

  it('backfills settlement when PAID without PAYMENT_CONFIRMED (legacy review)', () => {
    expect(confirmSource).toContain('link already PAID, backfilling settlement artifacts');
    expect(confirmSource).not.toContain('defensive skip');
  });

  it('transitions PAID_UNVERIFIED and REQUIRES_REVIEW via state machine', () => {
    expect(confirmSource).toContain('isValidTransition');
    expect(confirmSource).toContain('priorStatus: paymentLink.status');
  });
});

describe('R1 manual settlement unchanged (R3 regression)', () => {
  const routeSource = fs.readFileSync(MANUAL_SETTLEMENT_ROUTE, 'utf-8');

  it('still uses executeOperatorManualInvoiceSettlement', () => {
    expect(routeSource).toContain('executeOperatorManualInvoiceSettlement');
    expect(routeSource).not.toContain('executeAssistedReviewSettlement');
  });
});

describe('Stripe webhook unchanged (R3 regression)', () => {
  const webhookSource = fs.readFileSync(STRIPE_WEBHOOK_PATH, 'utf-8');

  it('still calls confirmPayment with stripe provider', () => {
    expect(webhookSource).toContain("provider: 'stripe'");
    expect(webhookSource).toContain('confirmPayment({');
  });
});

describe('idempotent duplicate review approval (R3 contract)', () => {
  const adapterSource = fs.readFileSync(ASSISTED_SETTLEMENT_PATH, 'utf-8');
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

  it('adapter returns alreadyProcessed when confirmation not SUBMITTED but event exists', () => {
    expect(adapterSource).toContain('alreadyProcessed: true');
    expect(adapterSource).toContain("confirmation.status !== 'SUBMITTED'");
  });

  it('confirmPayment guards duplicate PAYMENT_CONFIRMED per link', () => {
    expect(confirmSource).toContain('PAYMENT_CONFIRMED already exists for paymentLinkId');
    expect(confirmSource).toContain('checkManualIdempotency');
  });
});
