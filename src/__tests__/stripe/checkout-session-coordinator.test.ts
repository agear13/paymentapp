/**
 * Single-active Stripe Checkout session coordinator tests.
 */

import type Stripe from 'stripe';

const PAYMENT_LINK_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';

type PaymentLinkState = {
  id: string;
  short_code: string;
  status: string;
  amount: { toString: () => string };
  currency: string;
  invoice_currency: string;
  description: string;
  invoice_reference: string | null;
  customer_email: string | null;
  expires_at: Date | null;
  organization_id: string;
  active_stripe_checkout_session_id: string | null;
  active_stripe_checkout_expires_at: Date | null;
  organizations: {
    merchant_settings: Array<{ stripe_account_id: string; display_name: string }>;
  };
};

let mockPaymentLinkState: PaymentLinkState;
let mockTransactionChain: Promise<unknown> = Promise.resolve();

const mockTx = {
  $queryRaw: jest.fn(async () => [{ id: PAYMENT_LINK_ID }]),
  payment_links: {
    findUnique: jest.fn(async () => mockPaymentLinkState),
    update: jest.fn(async ({ data }: { data: Partial<PaymentLinkState> }) => {
      mockPaymentLinkState = { ...mockPaymentLinkState, ...data };
      return mockPaymentLinkState;
    }),
  },
  payment_events: {
    create: jest.fn(async () => ({ id: 'evt-init' })),
  },
};

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn: (client: typeof mockTx) => Promise<unknown>) => {
      const run = mockTransactionChain.then(() => fn(mockTx));
      mockTransactionChain = run;
      return run;
    }),
    payment_links: {
      findUnique: jest.fn(async () => mockPaymentLinkState),
      update: jest.fn(async ({ data }: { data: Partial<PaymentLinkState> }) => {
        mockPaymentLinkState = { ...mockPaymentLinkState, ...data };
        return mockPaymentLinkState;
      }),
    },
  },
}));

import {
  clearActiveStripeCheckoutSession,
  getActiveStripeCheckoutSession,
  isStripeCheckoutSessionChargeable,
  resolveOrCreateStripeCheckoutSession,
} from '@/lib/stripe/checkout-session-coordinator.server';
import { prisma } from '@/lib/server/prisma';

function openSession(id: string, url = `https://checkout.stripe.test/${id}`): Stripe.Checkout.Session {
  return {
    id,
    object: 'checkout.session',
    status: 'open',
    url,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  } as Stripe.Checkout.Session;
}

function buildPaymentLink(overrides: Partial<PaymentLinkState> = {}): PaymentLinkState {
  return {
    id: PAYMENT_LINK_ID,
    short_code: 'ABCD1234',
    status: 'OPEN',
    amount: { toString: () => '100.00' },
    currency: 'AUD',
    invoice_currency: 'AUD',
    description: 'Test invoice',
    invoice_reference: 'INV-1',
    customer_email: 'payer@example.com',
    expires_at: new Date(Date.now() + 86_400_000),
    organization_id: ORG_ID,
    active_stripe_checkout_session_id: null,
    active_stripe_checkout_expires_at: null,
    organizations: {
      merchant_settings: [{ stripe_account_id: 'acct_test', display_name: 'Merchant' }],
    },
    ...overrides,
  };
}

describe('isStripeCheckoutSessionChargeable', () => {
  it('accepts open sessions with a URL and future expiry', () => {
    expect(isStripeCheckoutSessionChargeable(openSession('cs_test_1'))).toBe(true);
  });

  it('rejects complete or expired sessions', () => {
    expect(
      isStripeCheckoutSessionChargeable({
        ...openSession('cs_test_2'),
        status: 'complete',
      } as Stripe.Checkout.Session)
    ).toBe(false);

    expect(
      isStripeCheckoutSessionChargeable({
        ...openSession('cs_test_3'),
        expires_at: Math.floor(Date.now() / 1000) - 10,
      } as Stripe.Checkout.Session)
    ).toBe(false);
  });
});

describe('resolveOrCreateStripeCheckoutSession', () => {
  let createCalls = 0;
  let retrieveCalls = 0;

  const gateway = {
    sessions: {
      create: jest.fn(async () => {
        createCalls += 1;
        return openSession(`cs_test_new_${createCalls}`);
      }),
      retrieve: jest.fn(async (id: string) => {
        retrieveCalls += 1;
        return openSession(id);
      }),
    },
  };

  beforeEach(() => {
    mockPaymentLinkState = buildPaymentLink();
    createCalls = 0;
    retrieveCalls = 0;
    mockTransactionChain = Promise.resolve();
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((fn: (client: typeof mockTx) => Promise<unknown>) => {
      const run = mockTransactionChain.then(() => fn(mockTx));
      mockTransactionChain = run;
      return run;
    });
    (prisma.payment_links.findUnique as jest.Mock).mockImplementation(async () => mockPaymentLinkState);
    (prisma.payment_links.update as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<PaymentLinkState> }) => {
        mockPaymentLinkState = { ...mockPaymentLinkState, ...data };
        return mockPaymentLinkState;
      }
    );
  });

  it('serializes concurrent creation to a single chargeable session', async () => {
    const [first, second] = await Promise.all([
      resolveOrCreateStripeCheckoutSession({
        paymentLinkId: PAYMENT_LINK_ID,
        baseUrl: 'https://pay.example.com',
        gateway,
      }),
      resolveOrCreateStripeCheckoutSession({
        paymentLinkId: PAYMENT_LINK_ID,
        baseUrl: 'https://pay.example.com',
        gateway,
      }),
    ]);

    expect(first.sessionId).toBe(second.sessionId);
    expect(createCalls).toBe(1);
    expect(retrieveCalls).toBeGreaterThanOrEqual(1);
    expect(mockTx.payment_events.create).toHaveBeenCalledTimes(1);
    expect(mockPaymentLinkState.active_stripe_checkout_session_id).toBe(first.sessionId);
  });

  it('reuses the active session on refresh (sequential POST)', async () => {
    const first = await resolveOrCreateStripeCheckoutSession({
      paymentLinkId: PAYMENT_LINK_ID,
      baseUrl: 'https://pay.example.com',
      gateway,
    });

    const second = await resolveOrCreateStripeCheckoutSession({
      paymentLinkId: PAYMENT_LINK_ID,
      baseUrl: 'https://pay.example.com',
      gateway,
    });

    expect(second.reused).toBe(true);
    expect(second.sessionId).toBe(first.sessionId);
    expect(createCalls).toBe(1);
    expect(mockTx.payment_events.create).toHaveBeenCalledTimes(1);
  });

  it('exposes the active session for page refresh via GET helper', async () => {
    await resolveOrCreateStripeCheckoutSession({
      paymentLinkId: PAYMENT_LINK_ID,
      baseUrl: 'https://pay.example.com',
      gateway,
    });

    const active = await getActiveStripeCheckoutSession({
      paymentLinkId: PAYMENT_LINK_ID,
      gateway,
    });

    expect(active?.sessionId).toBe(mockPaymentLinkState.active_stripe_checkout_session_id);
    expect(active?.reused).toBe(true);
    expect(createCalls).toBe(1);
  });

  it('clears the lease after settlement so a paid link cannot spawn another charge', async () => {
    await resolveOrCreateStripeCheckoutSession({
      paymentLinkId: PAYMENT_LINK_ID,
      baseUrl: 'https://pay.example.com',
      gateway,
    });

    await clearActiveStripeCheckoutSession(PAYMENT_LINK_ID);
    mockPaymentLinkState.status = 'PAID';
    mockPaymentLinkState.active_stripe_checkout_session_id = null;
    mockPaymentLinkState.active_stripe_checkout_expires_at = null;

    await expect(
      resolveOrCreateStripeCheckoutSession({
        paymentLinkId: PAYMENT_LINK_ID,
        baseUrl: 'https://pay.example.com',
        gateway,
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(createCalls).toBe(1);
  });
});

describe('settlement idempotency contract (checkout coordinator)', () => {
  it('create-checkout-session route delegates to coordinator', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(
      __dirname,
      '..',
      '..',
      'app',
      'api',
      'stripe',
      'create-checkout-session',
      'route.ts'
    );
    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).toContain('resolveOrCreateStripeCheckoutSession');
    expect(source).not.toContain('stripe.checkout.sessions.create');
  });

  it('webhook clears active checkout lease after successful checkout.session.completed', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(
      __dirname,
      '..',
      '..',
      'app',
      'api',
      'stripe',
      'webhook',
      'route.ts'
    );
    const source = fs.readFileSync(routePath, 'utf-8');
    expect(source).toContain('clearActiveStripeCheckoutSession');
  });
});
