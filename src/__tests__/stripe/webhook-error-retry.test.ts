/**
 * Stripe webhook ERROR retry recovery tests.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  recordStripeWebhookReceived,
  shouldReprocessStripeWebhookDelivery,
} from '@/lib/webhooks/stripe-audit';

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

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    webhook_events: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const baseEvent = {
  id: 'evt_retry_test',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { metadata: { payment_link_id: 'pl-1' } } },
} as import('stripe').Stripe.Event;

describe('shouldReprocessStripeWebhookDelivery', () => {
  it('reprocesses ERROR deliveries', () => {
    expect(shouldReprocessStripeWebhookDelivery('ERROR')).toBe(true);
  });

  it('reprocesses RECEIVED and PROCESSING (stuck) deliveries', () => {
    expect(shouldReprocessStripeWebhookDelivery('RECEIVED')).toBe(true);
    expect(shouldReprocessStripeWebhookDelivery('PROCESSING')).toBe(true);
  });

  it('does not reprocess terminal PROCESSED / IGNORED / DUPLICATE', () => {
    expect(shouldReprocessStripeWebhookDelivery('PROCESSED')).toBe(false);
    expect(shouldReprocessStripeWebhookDelivery('IGNORED')).toBe(false);
    expect(shouldReprocessStripeWebhookDelivery('DUPLICATE')).toBe(false);
  });
});

describe('recordStripeWebhookReceived ERROR recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('returns shouldReprocess=true for existing ERROR rows and refreshes payload', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'wh-1',
      provider: 'STRIPE',
      provider_event_id: 'evt_retry_test',
      event_type: 'checkout.session.completed',
      status: 'ERROR',
      attempt_count: 1,
    });

    const result = await recordStripeWebhookReceived({
      rawBody: '{"id":"evt_retry_test"}',
      headers: { 'stripe-signature': 'sig' },
      parsedStripeEvent: baseEvent,
      linkage: {
        organization_id: null,
        payment_link_id: 'pl-1',
        short_code: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_refund_id: null,
      },
      correlationId: 'corr-1',
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.shouldReprocess).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1' },
        data: expect.objectContaining({
          raw_body: '{"id":"evt_retry_test"}',
          correlation_id: 'corr-1',
        }),
      })
    );
  });

  it('returns shouldReprocess=false for PROCESSED duplicates', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'wh-2',
      provider: 'STRIPE',
      provider_event_id: 'evt_retry_test',
      event_type: 'checkout.session.completed',
      status: 'PROCESSED',
      attempt_count: 1,
    });

    const result = await recordStripeWebhookReceived({
      rawBody: '{}',
      headers: {},
      parsedStripeEvent: baseEvent,
      linkage: {
        organization_id: null,
        payment_link_id: null,
        short_code: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_refund_id: null,
      },
      correlationId: null,
    });

    expect(result.shouldReprocess).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('webhook route retry wiring', () => {
  it('processes ERROR retries and skips terminal duplicates', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).toContain('auditResult.shouldReprocess');
    expect(content).toContain('Retrying webhook delivery after non-terminal prior attempt');
    expect(content).toContain('auditResult.isDuplicate && !auditResult.shouldReprocess');
  });

  it('replay route exists and uses shared internal admin auth', () => {
    const replayPath = path.join(
      __dirname,
      '..',
      '..',
      'app',
      'api',
      'internal',
      'webhooks',
      'stripe',
      'replay',
      'route.ts'
    );
    const content = fs.readFileSync(replayPath, 'utf-8');
    expect(content).toContain('isValidInternalAdminRequest');
    expect(content).toContain('processStripeWebhookEvent');
  });
});
