/**
 * Stripe refund webhook (Option A) — Refund object events + refundId idempotency.
 * Contract tests: correlation_id format, ledger idempotency key format, status transitions.
 */
import * as fs from 'fs';
import * as path from 'path';

const WEBHOOK_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'stripe',
  'webhook',
  'route.ts'
);
const STRIPE_POSTING_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'ledger',
  'posting-rules',
  'stripe.ts'
);

describe('Stripe refund webhook (Option A)', () => {
  it('webhook route handles refund object events (refund.created, refund.updated)', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain("case 'refund.created':");
    expect(content).toContain("case 'refund.updated':");
    expect(content).toContain('handleRefundObjectEvent');
  });

  it('webhook route routes charge.refund.created/updated to handleRefundObjectEvent in default', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain("event.type === 'charge.refund.created'");
    expect(content).toContain("event.type === 'charge.refund.updated'");
  });

  it('refund idempotency uses correlation_id stripe_refund_<refundId>', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain('stripe_refund_${refundId}');
    expect(content).toContain('refundCorrelationId');
  });

  it('refund handler only processes succeeded status', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain("refund.status !== 'succeeded'");
  });

  it('ledger reversal supports refundId-based idempotency key (stripe-refund-<refundId>-0/1)', () => {
    const content = fs.readFileSync(STRIPE_POSTING_PATH, 'utf-8');
    expect(content).toContain('refundId');
    expect(content).toContain('stripe-refund-${refundId}');
    expect(content).toContain('keyBase');
    expect(content).toContain('idempotencyKey: keyBase');
  });

  it('payment_links.status transitions to PARTIALLY_REFUNDED or REFUNDED based on totals', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain('PARTIALLY_REFUNDED');
    expect(content).toContain('REFUNDED');
    expect(content).toContain('totalRefunded >= totalPaid');
  });

  describe('single-path refund: no double-write (charge.refunded is log-only)', () => {
    it('charge.refunded case only logs and does not write DB or ledger', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain("case 'charge.refunded':");
      expect(content).toContain('charge.refunded ignored');
      expect(content).toContain('refund.* is source of truth');
      expect(content).toContain('no DB or ledger writes');
      // Must NOT call a handler that does prisma.payment_events.create or postStripeRefundReversal for charge.refunded
      const chargeRefundedBlock = content.slice(
        content.indexOf("case 'charge.refunded':"),
        content.indexOf("default:") > 0 ? content.indexOf("default:") : content.length
      );
      expect(chargeRefundedBlock).not.toContain('handleChargeRefunded');
      expect(chargeRefundedBlock).not.toContain('prisma.payment_events.create');
      expect(chargeRefundedBlock).not.toContain('postStripeRefundReversal');
    });

    it('only handleRefundObjectEvent writes REFUND_CONFIRMED with correlation_id stripe_refund_<refundId>', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('refundCorrelationId = `stripe_refund_${refundId}`');
      expect(content).toContain('event_type: \'REFUND_CONFIRMED\'');
      expect(content).toContain('correlation_id: refundCorrelationId');
      expect(content).toContain('existingRefund');
    });

    it('ledger reversal uses refundId-only idempotency keys (stripe-refund-<refundId>-0 and -1)', () => {
      const content = fs.readFileSync(STRIPE_POSTING_PATH, 'utf-8');
      expect(content).toContain('stripe-refund-${refundId}');
      expect(content).toContain('keyBase');
      expect(content).toContain('idempotencyKey: keyBase');
      expect(content).toContain('refundId is required');
      expect(content).toContain('charge.refunded is no longer a write path');
    });
  });
});
