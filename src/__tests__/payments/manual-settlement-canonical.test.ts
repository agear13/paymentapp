const fs = require('fs');
const path = require('path');

const {
  manualSettlementProviderRef,
} = require('../../lib/payments/manual-invoice-settlement.server');

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

describe('manual invoice settlement (R1)', () => {
  it('uses stable provider ref per payment link', () => {
    expect(manualSettlementProviderRef('pl-abc')).toBe('manual-settlement:pl-abc');
  });
});

describe('manual-settlement route (R1 contract)', () => {
  const routeSource = fs.readFileSync(MANUAL_SETTLEMENT_ROUTE, 'utf-8');

  it('mark_paid does not directly transition to PAID', () => {
    expect(routeSource).toContain('executeOperatorManualInvoiceSettlement');
    expect(routeSource).not.toContain("targetState: 'PAID'");
  });

  it('mark_paid does not queue Xero or manual funding bridge separately', () => {
    const markPaidBlock = routeSource.split("action === 'mark_paid'")[1]?.split("} else {")[0] ?? '';
    expect(markPaidBlock).not.toContain('queueXeroSync');
    expect(markPaidBlock).not.toContain('orchestrateFundingAfterManualInvoiceSettlement');
  });

  it('mark_paid surfaces confirmPayment failure to operator', () => {
    expect(routeSource).toContain('MANUAL_SETTLEMENT_CONFIRM_FAILED');
    expect(routeSource).toContain('MANUAL_SETTLEMENT_CONFIRMED');
  });

  it('reopen still uses transitionPaymentLinkState to OPEN', () => {
    expect(routeSource).toContain("targetState: 'OPEN'");
    expect(routeSource).toContain('operator_reopen');
  });
});

describe('confirmPayment manual provider (R1)', () => {
  const confirmSource = fs.readFileSync(PAYMENT_CONFIRMATION_PATH, 'utf-8');

  it('supports manual provider with MANUAL source type and ledger branch', () => {
    expect(confirmSource).toContain("provider: 'stripe' | 'hedera' | 'wise' | 'manual'");
    expect(confirmSource).toContain('PaymentEventSourceType.MANUAL');
    expect(confirmSource).toContain("provider === 'manual'");
    expect(confirmSource).toContain('resolvePaymentMethodForEvent');
    expect(confirmSource).not.toContain('payment_method: provider.toUpperCase()');
    expect(confirmSource).toContain('checkManualIdempotency');
    expect(confirmSource).toContain('Manual operator settlement ledger posted');
  });

  it('invokes commission and funding after manual settlement', () => {
    const manualBranch = confirmSource.includes("provider === 'manual'");
    expect(manualBranch).toBe(true);
    expect(confirmSource).toContain('applyRevenueShareSplits');
    expect(confirmSource).toContain('orchestrateFundingAfterInvoiceSettlement');
  });
});

describe('Stripe webhook path unaffected (R1)', () => {
  const webhookSource = fs.readFileSync(STRIPE_WEBHOOK_PATH, 'utf-8');

  it('still calls confirmPayment with stripe provider', () => {
    expect(webhookSource).toContain("provider: 'stripe'");
    expect(webhookSource).toContain('confirmPayment({');
  });
});
