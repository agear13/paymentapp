import fs from 'fs';
import path from 'path';
import type Stripe from 'stripe';
import {
  applyStripeSubscriptionToOrganization,
  createSaasSubscriptionCheckoutSession,
} from '@/lib/billing/stripe-subscription.server';
import { resolveSaasCheckoutReturnUrls } from '@/lib/billing/saas-billing-return-urls';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cus_test_123';
const SUBSCRIPTION_ID = 'sub_test_456';
const PROFESSIONAL_PRICE = 'price_professional_test';

const mockCheckoutSessionsCreate = jest.fn();
const mockCustomersCreate = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockOrganizationsUpdate = jest.fn();

jest.mock('@/lib/stripe/client', () => ({
  isStripeEnabled: true,
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
      },
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
    },
  },
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organizations: {
      update: (...args: unknown[]) => mockOrganizationsUpdate(...args),
    },
  },
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  getBrandedAppOrigin: () => 'https://app.provvypay.com',
}));

describe('SaaS subscription checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY = PROFESSIONAL_PRICE;
    process.env.STRIPE_PRICE_GROWTH_MONTHLY = 'price_growth_test';

    mockCustomersCreate.mockResolvedValue({ id: CUSTOMER_ID });
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_saas',
      url: 'https://checkout.stripe.test/saas',
    });
  });

  it('creates subscription checkout with Stripe promotion codes enabled', async () => {
    const result = await createSaasSubscriptionCheckoutSession({
      organizationId: ORG_ID,
      organizationName: 'Test Org',
      userId: 'user-1',
      userEmail: 'test@example.com',
      plan: 'professional',
      stripeCustomerId: CUSTOMER_ID,
      checkoutContext: 'upgrade',
    });

    expect(result.url).toBe('https://checkout.stripe.test/saas');
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: CUSTOMER_ID,
        allow_promotion_codes: true,
        line_items: [{ price: PROFESSIONAL_PRICE, quantity: 1 }],
      })
    );
  });

  it('preserves Commercial OS return URLs for upgrade checkout', async () => {
    await createSaasSubscriptionCheckoutSession({
      organizationId: ORG_ID,
      organizationName: 'Test Org',
      userId: 'user-1',
      userEmail: 'test@example.com',
      plan: 'professional',
      stripeCustomerId: CUSTOMER_ID,
      checkoutContext: 'upgrade',
      returnTo: '/workspace/settings/plan',
    });

    const params = mockCheckoutSessionsCreate.mock.calls[0]?.[0] as Stripe.Checkout.SessionCreateParams;
    expect(params.success_url).toBe(
      'https://app.provvypay.com/workspace/settings/plan?billing=success'
    );
    expect(params.cancel_url).toBe(
      'https://app.provvypay.com/workspace/settings/plan?billing=canceled'
    );
  });

  it('defaults upgrade return URLs to Commercial OS Plan & Billing', () => {
    const urls = resolveSaasCheckoutReturnUrls('https://app.provvypay.com', 'upgrade');
    expect(urls.success_url).toBe('https://app.provvypay.com/workspace/settings/plan?billing=success');
    expect(urls.cancel_url).toBe('https://app.provvypay.com/workspace/settings/plan?billing=canceled');
  });

  it('activates Professional entitlements from an active subscription regardless of discount', async () => {
    mockOrganizationsUpdate.mockResolvedValue({ id: ORG_ID });

    await applyStripeSubscriptionToOrganization({
      organizationId: ORG_ID,
      subscription: {
        id: SUBSCRIPTION_ID,
        status: 'active',
        customer: CUSTOMER_ID,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        items: {
          data: [{ price: { id: PROFESSIONAL_PRICE } }],
        },
      } as Stripe.Subscription,
    });

    expect(mockOrganizationsUpdate).toHaveBeenCalledWith({
      where: { id: ORG_ID },
      data: expect.objectContaining({
        stripe_subscription_id: SUBSCRIPTION_ID,
        subscription_plan: 'professional',
        subscription_status: 'active',
      }),
    });
  });
});

describe('payment-link checkout separation', () => {
  it('does not enable promotion codes on payer payment-link checkout sessions', () => {
    const coordinatorPath = path.join(
      process.cwd(),
      'lib/stripe/checkout-session-coordinator.server.ts'
    );
    const source = fs.readFileSync(coordinatorPath, 'utf8');

    expect(source).not.toContain('allow_promotion_codes');
  });
});
