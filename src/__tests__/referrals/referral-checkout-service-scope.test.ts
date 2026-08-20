/**
 * Referral Management revenue-share links must be service-specific on existing checkout.
 */

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    referral_links: { findFirst: jest.fn() },
    organization_services: { findFirst: jest.fn(), findMany: jest.fn() },
    payment_links: { create: jest.fn() },
  },
}));

jest.mock('@/lib/server/short-code', () => ({
  generateUniqueShortCode: jest.fn().mockResolvedValue('pay123'),
}));

jest.mock('@/lib/referrals/pilot-referral-slug.server', () => ({
  resolvePilotDealFromReferralSlug: jest.fn().mockResolvedValue({ pilotDealId: 'deal-rm-1' }),
}));

jest.mock('@/lib/stripe/client', () => ({
  stripe: { checkout: { sessions: { create: jest.fn() } } },
  toSmallestUnit: (amount: number) => Math.round(amount * 100),
  handleStripeError: (err: unknown) => err,
}));

jest.mock('@/lib/config/env', () => ({
  __esModule: true,
  default: { features: { wisePayments: false } },
}));

jest.mock('@/lib/runtime/customer-facing-url', () => ({
  getBrandedAppOrigin: () => 'https://app.test',
  getPaymentLinkUrl: (code: string) => `https://app.test/pay/${code}`,
  getPublicAppUrl: () => 'https://app.test',
}));

jest.mock('@/lib/branding/resolve-merchant-branding', () => ({
  resolveMerchantBranding: () => ({
    merchantName: 'Danielle Dental',
    logoUrl: null,
    usedFallback: false,
  }),
}));

import { prisma } from '@/lib/server/prisma';
import { loadReferralCommissionCheckoutPage } from '@/lib/referrals/referral-checkout-page.server';
import {
  createReferralCheckoutSession,
  createReferralServiceCheckoutSession,
} from '@/lib/referrals/referral-checkout';

const ORG = 'org-11111111-1111-1111-1111-111111111111';
const SERVICE_A = '11111111-1111-1111-1111-111111111111';
const SERVICE_B = '22222222-2222-2222-2222-222222222222';
const FOREIGN_SERVICE = '99999999-9999-9999-9999-999999999999';
const LINK_ID = 'link-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const rmCheckoutConfig = {
  referralCommerce: {
    createReferralLink: true,
    commissionMode: 'project_revenue_share',
    commerceCommissionPct: 20,
    enabledServiceIds: [SERVICE_A],
    allowCustomAmount: true,
  },
};

const referralCommerceOpenConfig = {
  referralCommerce: {
    commissionMode: 'referral_commerce',
    enabledServiceIds: [],
    allowCustomAmount: true,
  },
};

const referralCommerceScopedConfig = {
  referralCommerce: {
    commissionMode: 'referral_commerce',
    enabledServiceIds: [SERVICE_A, SERVICE_B],
    allowCustomAmount: true,
  },
};

function referralLink(checkout_config: unknown) {
  return {
    id: LINK_ID,
    code: 'APEX20',
    slug: 'pilot-apex',
    status: 'ACTIVE',
    expires_at: null,
    organization_id: ORG,
    created_by_user_id: 'user-1',
    checkout_config,
    referral_rules: [],
    referral_link_splits: [{ id: 'split-1', sort_order: 0, percentage: 20, label: 'Apex' }],
    referral_code: { id: 'rc-1', participant_user_id: 'user-apex', code: 'APEX20' },
    organizations: {
      merchant_settings: [
        {
          stripe_account_id: 'acct_1',
          hedera_account_id: null,
          wise_profile_id: null,
          wise_enabled: false,
          display_name: 'Danielle Dental',
          organization_logo_url: null,
        },
      ],
    },
  };
}

function catalogService(id: string, name: string, active = true) {
  return {
    id,
    name,
    description: `${name} description`,
    price: 199,
    currency: 'AUD',
    active,
  };
}

describe('Referral Management service-specific checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.referral_links.findFirst.mockResolvedValue(referralLink(rmCheckoutConfig));
    prisma.organization_services.findMany.mockResolvedValue([
      catalogService(SERVICE_A, 'Teeth Whitening'),
      catalogService(SERVICE_B, 'Check-up'),
    ]);
    prisma.organization_services.findFirst.mockResolvedValue(
      catalogService(SERVICE_A, 'Teeth Whitening')
    );
    prisma.payment_links.create.mockResolvedValue({
      id: 'pl-1',
      short_code: 'pay123',
    });
  });

  it('A: /r/code for RM revenue-share only exposes the configured service', async () => {
    const page = await loadReferralCommissionCheckoutPage('APEX20');
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.services.map((s) => s.id)).toEqual([SERVICE_A]);
    expect(page.services[0].name).toBe('Teeth Whitening');
    expect(page.allowCustomAmount).toBe(false);
  });

  it('B: purchasing the configured service keeps existing referral attribution fields', async () => {
    const result = await createReferralServiceCheckoutSession({
      referralCode: 'APEX20',
      organizationServiceId: SERVICE_A,
      paymentRail: 'manual',
    });
    expect(result.success).toBe(true);
    expect(prisma.payment_links.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization_id: ORG,
          referral_link_id: LINK_ID,
          attribution_referral_code: 'APEX20',
          organization_service_id: SERVICE_A,
          attribution_source: 'REFERRAL_SERVICE_SELECTION',
        }),
      })
    );
  });

  it('C: Service B cannot be purchased through an RM referral configured for Service A', async () => {
    prisma.organization_services.findFirst.mockResolvedValue(
      catalogService(SERVICE_B, 'Check-up')
    );
    const result = await createReferralServiceCheckoutSession({
      referralCode: 'APEX20',
      organizationServiceId: SERVICE_B,
      paymentRail: 'manual',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available on this referral link/i);
    expect(prisma.payment_links.create).not.toHaveBeenCalled();
  });

  it('D: inactive configured service shows unavailable and does not expose the catalogue', async () => {
    prisma.organization_services.findMany.mockResolvedValue([
      catalogService(SERVICE_B, 'Check-up'),
    ]);
    const page = await loadReferralCommissionCheckoutPage('APEX20');
    expect(page.ok).toBe(false);
    if (page.ok) return;
    expect(page.reason).toBe('offer_unavailable');
    expect(page.message).toMatch(/no longer available/i);
  });

  it('E: referral_commerce with no service scope still lists all active org services', async () => {
    prisma.referral_links.findFirst.mockResolvedValue(referralLink(referralCommerceOpenConfig));
    const page = await loadReferralCommissionCheckoutPage('OPEN20');
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.services.map((s) => s.id)).toEqual([SERVICE_A, SERVICE_B]);
    expect(page.allowCustomAmount).toBe(true);
  });

  it('E: referral_commerce with enabledServiceIds still filters to those services', async () => {
    prisma.referral_links.findFirst.mockResolvedValue(referralLink(referralCommerceScopedConfig));
    const page = await loadReferralCommissionCheckoutPage('SCOPED');
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.services.map((s) => s.id)).toEqual([SERVICE_A, SERVICE_B]);
    expect(page.allowCustomAmount).toBe(true);
  });

  it('E: referral_commerce custom-amount checkout is not blocked', async () => {
    prisma.referral_links.findFirst.mockResolvedValue(referralLink(referralCommerceOpenConfig));
    const result = await createReferralCheckoutSession({
      referralCode: 'OPEN20',
      paymentRail: 'manual',
      amount: 50,
    });
    expect(result.success).toBe(true);
    expect(prisma.payment_links.create).toHaveBeenCalled();
  });

  it('F: a service from another organization cannot be purchased on this referral', async () => {
    prisma.organization_services.findFirst.mockResolvedValue(null);
    const result = await createReferralServiceCheckoutSession({
      referralCode: 'APEX20',
      organizationServiceId: FOREIGN_SERVICE,
      paymentRail: 'manual',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found for this merchant/i);
    expect(prisma.payment_links.create).not.toHaveBeenCalled();
    expect(prisma.organization_services.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: FOREIGN_SERVICE,
          organization_id: ORG,
          active: true,
        }),
      })
    );
  });

  it('blocks custom-amount checkout on RM revenue-share service-scoped referrals', async () => {
    const result = await createReferralCheckoutSession({
      referralCode: 'APEX20',
      paymentRail: 'manual',
      amount: 80,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/configured service/i);
    expect(prisma.payment_links.create).not.toHaveBeenCalled();
  });
});
