import { prisma } from '@/lib/server/prisma';
import { filterServicesForReferralConfig } from '@/lib/referrals/referral-commerce-config';
import { isCustomAmountAllowedOnCheckoutConfig } from '@/lib/referrals/referral-payment-rails';
import { resolveMerchantBranding } from '@/lib/branding/resolve-merchant-branding';
import { getPublicAppUrl } from '@/lib/runtime/customer-facing-url';
import {
  getConfiguredReferralPaymentRails,
  logReferralCheckoutContext,
  resolveAvailablePaymentRails,
  type ReferralPaymentRail,
} from '@/lib/referrals/referral-payment-rails';
import type { ReferralServiceRow } from '@/components/referrals/referral-commission-landing';

const DEFAULT_DISPLAY_NAME = 'Merchant checkout';

export type ReferralCheckoutPageSuccess = {
  ok: true;
  referralCode: string;
  organizationId: string;
  checkoutConfig: Record<string, unknown> | null;
  services: ReferralServiceRow[];
  merchantDisplayName: string;
  merchantLogoUrl: string | null;
  paymentRails: ReferralPaymentRail[];
  allowCustomAmount: boolean;
};

export type ReferralCheckoutPageFailure = {
  ok: false;
  reason: 'not_found' | 'inactive' | 'misconfigured' | 'error';
  referralCode: string;
  merchantDisplayName: string;
  merchantLogoUrl: string | null;
  message: string;
};

export type ReferralCheckoutPageResult =
  | ReferralCheckoutPageSuccess
  | ReferralCheckoutPageFailure;

function sanitizeServices(
  rows: Array<{
    id: string;
    name: string;
    description: string;
    price: unknown;
    currency: string;
  }>
): ReferralServiceRow[] {
  return rows
    .map((s) => {
      const price = Number(s.price);
      if (!s.id || !s.name?.trim() || !Number.isFinite(price) || price <= 0) return null;
      const currency = String(s.currency ?? 'AUD')
        .toUpperCase()
        .slice(0, 3);
      return {
        id: s.id,
        name: s.name.trim(),
        description: typeof s.description === 'string' ? s.description : '',
        price,
        currency: currency.length === 3 ? currency : 'AUD',
      };
    })
    .filter((r): r is ReferralServiceRow => r !== null);
}

function resolveBranding(input: {
  displayName?: string | null;
  logoSource?: string | null;
  requestOrigin?: string;
}) {
  try {
    const resolution = resolveMerchantBranding({
      merchantName: input.displayName?.trim() || DEFAULT_DISPLAY_NAME,
      logoSource: input.logoSource ?? null,
      runtimeOrigin: getPublicAppUrl(input.requestOrigin) || undefined,
      requestOrigin: input.requestOrigin,
      context: 'referralCheckoutPage',
    });
    return {
      merchantDisplayName: resolution.merchantName || DEFAULT_DISPLAY_NAME,
      merchantLogoUrl: resolution.logoUrl,
      usedFallback: resolution.usedFallback,
    };
  } catch (error) {
    console.warn('[ReferralCheckout] branding resolution failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const name = input.displayName?.trim() || DEFAULT_DISPLAY_NAME;
    return {
      merchantDisplayName: name,
      merchantLogoUrl: null,
      usedFallback: true,
    };
  }
}

/**
 * Load commission referral checkout data without throwing.
 */
export async function loadReferralCommissionCheckoutPage(
  referralCode: string
): Promise<ReferralCheckoutPageResult> {
  const code = referralCode.trim().toUpperCase();
  if (!code) {
    return {
      ok: false,
      reason: 'not_found',
      referralCode: code,
      merchantDisplayName: DEFAULT_DISPLAY_NAME,
      merchantLogoUrl: null,
      message: 'This checkout link is not valid.',
    };
  }

  try {
    const referralLink = await prisma.referral_links.findFirst({
      where: { code },
      include: {
        referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
        referral_link_splits: { orderBy: { sort_order: 'asc' } },
        organizations: {
          include: {
            merchant_settings: { take: 1 },
          },
        },
      },
    });

    if (!referralLink) {
      return {
        ok: false,
        reason: 'not_found',
        referralCode: code,
        merchantDisplayName: DEFAULT_DISPLAY_NAME,
        merchantLogoUrl: null,
        message: 'This checkout link could not be found.',
      };
    }

    if (referralLink.status !== 'ACTIVE') {
      const branding = resolveBranding({
        displayName: referralLink.organizations?.merchant_settings?.[0]?.display_name,
        logoSource: referralLink.organizations?.merchant_settings?.[0]?.organization_logo_url,
      });
      return {
        ok: false,
        reason: 'inactive',
        referralCode: code,
        merchantDisplayName: branding.merchantDisplayName,
        merchantLogoUrl: branding.merchantLogoUrl,
        message: 'This checkout link is no longer active.',
      };
    }

    if (referralLink.expires_at && referralLink.expires_at <= new Date()) {
      const branding = resolveBranding({
        displayName: referralLink.organizations?.merchant_settings?.[0]?.display_name,
        logoSource: referralLink.organizations?.merchant_settings?.[0]?.organization_logo_url,
      });
      return {
        ok: false,
        reason: 'inactive',
        referralCode: code,
        merchantDisplayName: branding.merchantDisplayName,
        merchantLogoUrl: branding.merchantLogoUrl,
        message: 'This checkout link has expired.',
      };
    }

    const hasRules = referralLink.referral_rules.length > 0;
    const hasSplits = referralLink.referral_link_splits.length > 0;
    if (!hasRules && !hasSplits) {
      const branding = resolveBranding({
        displayName: referralLink.organizations?.merchant_settings?.[0]?.display_name,
        logoSource: referralLink.organizations?.merchant_settings?.[0]?.organization_logo_url,
      });
      return {
        ok: false,
        reason: 'misconfigured',
        referralCode: code,
        merchantDisplayName: branding.merchantDisplayName,
        merchantLogoUrl: branding.merchantLogoUrl,
        message: 'This checkout link is not fully configured yet. Please contact the merchant.',
      };
    }

    const merchantSettings = referralLink.organizations?.merchant_settings?.[0] ?? null;
    const branding = resolveBranding({
      displayName: merchantSettings?.display_name,
      logoSource: merchantSettings?.organization_logo_url ?? null,
    });

    const merchantCapabilities = {
      stripe: !!merchantSettings?.stripe_account_id,
      wise: !!merchantSettings?.wise_enabled && !!merchantSettings?.wise_profile_id,
      hedera: !!merchantSettings?.hedera_account_id,
      manual: true,
    };

    const configuredRails = getConfiguredReferralPaymentRails(referralLink.checkout_config);
    const paymentRails = resolveAvailablePaymentRails({
      checkoutConfig: referralLink.checkout_config,
      merchant: merchantCapabilities,
    });

    const allServices = await prisma.organization_services.findMany({
      where: { organization_id: referralLink.organization_id, active: true },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
      },
    });

    const filtered = filterServicesForReferralConfig(
      allServices,
      referralLink.checkout_config
    );
    const services = sanitizeServices(filtered);

    logReferralCheckoutContext({
      referralCode: code,
      organizationId: referralLink.organization_id,
      configuredRails,
      resolvedRails: paymentRails,
      merchantCapabilities,
      brandingFallback: branding.usedFallback,
      serviceCount: services.length,
    });

    return {
      ok: true,
      referralCode: code,
      organizationId: referralLink.organization_id,
      checkoutConfig: (referralLink.checkout_config ?? null) as Record<string, unknown> | null,
      services,
      merchantDisplayName: branding.merchantDisplayName,
      merchantLogoUrl: branding.merchantLogoUrl,
      paymentRails,
      allowCustomAmount: isCustomAmountAllowedOnCheckoutConfig(referralLink.checkout_config),
    };
  } catch (error) {
    console.error('[ReferralCheckout] load failed', {
      referralCode: code,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      reason: 'error',
      referralCode: code,
      merchantDisplayName: DEFAULT_DISPLAY_NAME,
      merchantLogoUrl: null,
      message: 'Checkout is temporarily unavailable. Please try again shortly.',
    };
  }
}
