/**
 * Commission-enabled referral checkout flow (Option B).
 * Creates payment_link + Stripe Checkout Session with referral metadata.
 */

import { randomUUID } from 'crypto';
import { AttributionSource } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { stripe, toSmallestUnit, handleStripeError } from '@/lib/stripe/client';
import { generateUniqueShortCode } from '@/lib/server/short-code';
import { log } from '@/lib/logger';
import { getBrandedAppOrigin } from '@/lib/runtime/customer-facing-url';
import {
  buildCommissionAttributionMetadataFromReferralLink,
  commissionSnapshotToPrismaJson,
} from '@/lib/referrals/commission-attribution-snapshot';
import { isServiceAllowedForReferral } from '@/lib/referrals/referral-commerce-config';
import {
  referralRailToPaymentMethod,
  type ReferralPaymentRail,
} from '@/lib/referrals/referral-payment-rails';
import { getPaymentLinkUrl } from '@/lib/runtime/customer-facing-url';

export interface ReferralCheckoutResult {
  success: boolean;
  url?: string;
  sessionId?: string;
  paymentLinkId?: string;
  error?: string;
}

export interface ReferralCheckoutParams {
  referralCode: string;
  successUrl?: string;
  cancelUrl?: string;
  correlationId?: string;
  /** Override amount (major units). If not provided, uses checkout_config.amount */
  amount?: number;
  /** Override currency. If not provided, uses checkout_config.currency */
  currency?: string;
  /** Override description. If not provided, uses checkout_config.description */
  description?: string;
  paymentRail?: ReferralPaymentRail;
}

export interface ReferralServiceCheckoutParams {
  referralCode: string;
  organizationServiceId: string;
  successUrl?: string;
  cancelUrl?: string;
  correlationId?: string;
}

async function loadReferralLinkForCheckout(code: string) {
  return prisma.referral_links.findFirst({
    where: {
      code,
      status: 'ACTIVE',
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    include: {
      referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
      referral_link_splits: { orderBy: { sort_order: 'asc' } },
      referral_code: true,
      organizations: {
        include: {
          merchant_settings: {
            select: { stripe_account_id: true, display_name: true },
          },
        },
      },
    },
  });
}

/**
 * Create payment link and Stripe Checkout Session for a commission-enabled referral.
 * Includes referral metadata on session for webhook commission posting.
 */
export async function createReferralCheckoutSession(
  params: ReferralCheckoutParams
): Promise<ReferralCheckoutResult> {
  const {
    referralCode,
    successUrl,
    cancelUrl,
    correlationId,
    amount: amountOverride,
    currency: currencyOverride,
    description: descriptionOverride,
    paymentRail = 'stripe',
  } = params;

  const code = referralCode.trim().toUpperCase();
  if (!code) {
    return { success: false, error: 'Invalid referral code' };
  }

  log.info('Creating referral checkout session', { correlationId, referralCode: code });

  try {
    const referralLink = await loadReferralLinkForCheckout(code);

    if (!referralLink) {
      log.warn('Referral link not found or inactive', { code });
      return { success: false, error: 'Referral link not found or inactive' };
    }

    const splits = referralLink.referral_link_splits;
    const rule = referralLink.referral_rules[0];
    const hasSplits = splits.length > 0;
    if (!hasSplits && !rule) {
      log.warn('No splits or referral rule configured', { referralLinkId: referralLink.id });
      return { success: false, error: 'No referral rule or splits configured' };
    }

    const merchantSettings = referralLink.organizations.merchant_settings[0];
    if (paymentRail === 'stripe' && !merchantSettings?.stripe_account_id) {
      log.warn('Stripe not configured', { organizationId: referralLink.organization_id });
      return { success: false, error: 'Card payments are not configured for this merchant' };
    }

    const config = (referralLink.checkout_config as Record<string, unknown>) || {};
    const amount = amountOverride ?? Number(config.amount) ?? 100;
    const currency = (currencyOverride ?? String(config.currency ?? 'AUD')).toUpperCase().slice(0, 3);
    const description =
      descriptionOverride ?? String(config.description ?? `Payment via referral ${code}`);

    const shortCode = await generateUniqueShortCode();
    const now = new Date();

    const snapshotMeta = buildCommissionAttributionMetadataFromReferralLink(referralLink);

    const paymentMethod = referralRailToPaymentMethod(paymentRail);

    const paymentLink = await prisma.payment_links.create({
      data: {
        id: randomUUID(),
        organization_id: referralLink.organization_id,
        short_code: shortCode,
        status: 'OPEN',
        amount,
        currency,
        invoice_currency: currency,
        description,
        invoice_reference: `REF-${code}`,
        referral_link_id: referralLink.id,
        referral_code_id: referralLink.referral_code?.id ?? null,
        payment_method: paymentMethod,
        attribution_referral_code: code,
        attributed_participant_user_id:
          referralLink.referral_code?.participant_user_id ?? referralLink.created_by_user_id ?? null,
        attribution_source: AttributionSource.REFERRAL_CHECKOUT,
        commission_attribution_snapshot: commissionSnapshotToPrismaJson(snapshotMeta),
        created_at: now,
        updated_at: now,
      },
    });

    if (paymentRail !== 'stripe') {
      return {
        success: true,
        url: getPaymentLinkUrl(shortCode),
        paymentLinkId: paymentLink.id,
      };
    }

    const baseUrl = getBrandedAppOrigin();
    const defaultSuccessUrl = `${baseUrl}/pay/${shortCode}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pay/${shortCode}`;

    const amountInSmallestUnit = toSmallestUnit(amount, currency);
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExpiresAt = nowSec + 86400;

    const basis = hasSplits ? 'GROSS' : (rule?.basis ?? 'GROSS');
    const referralMetadata: Record<string, string> = {
      ...snapshotMeta,
      payment_link_id: paymentLink.id,
      organization_id: referralLink.organization_id,
      short_code: paymentLink.short_code,
      invoice_reference: `REF-${code}`,
      commission_basis: basis,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description,
              description: `Referral: ${code}`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: referralMetadata,
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      expires_at: sessionExpiresAt,
      payment_intent_data: {
        metadata: referralMetadata,
      },
    });

    log.info('Referral checkout session created', {
      correlationId,
      referralLinkId: referralLink.id,
      paymentLinkId: paymentLink.id,
      sessionId: session.id,
    });

    return {
      success: true,
      url: session.url || undefined,
      sessionId: session.id,
      paymentLinkId: paymentLink.id,
    };
  } catch (error: unknown) {
    const stripeError = handleStripeError(error);
    log.error('Referral checkout failed', error instanceof Error ? error : undefined, {
      correlationId,
      referralCode: code,
      error: stripeError.message,
    });
    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Referral landing → pick catalog service → Stripe checkout with frozen attribution on the invoice.
 */
export async function createReferralServiceCheckoutSession(
  params: ReferralServiceCheckoutParams
): Promise<ReferralCheckoutResult> {
  const {
    referralCode,
    organizationServiceId,
    successUrl,
    cancelUrl,
    correlationId,
    paymentRail = 'stripe',
  } = params;
  const code = referralCode.trim().toUpperCase();
  if (!code || !organizationServiceId?.trim()) {
    return { success: false, error: 'Invalid referral code or service' };
  }

  log.info('Creating referral service checkout session', {
    correlationId,
    referralCode: code,
    organizationServiceId,
  });

  try {
    const referralLink = await loadReferralLinkForCheckout(code);
    if (!referralLink) {
      return { success: false, error: 'Referral link not found or inactive' };
    }

    const splits = referralLink.referral_link_splits;
    const rule = referralLink.referral_rules[0];
    const hasSplits = splits.length > 0;
    if (!hasSplits && !rule) {
      return { success: false, error: 'No referral rule or splits configured' };
    }

    const merchantSettings = referralLink.organizations.merchant_settings[0];
    if (!merchantSettings?.stripe_account_id) {
      return { success: false, error: 'Stripe not configured for this merchant' };
    }

    const service = await prisma.organization_services.findFirst({
      where: {
        id: organizationServiceId,
        organization_id: referralLink.organization_id,
        active: true,
      },
    });
    if (!service) {
      return { success: false, error: 'Service not found for this merchant' };
    }

    if (!isServiceAllowedForReferral(referralLink.checkout_config, organizationServiceId)) {
      return { success: false, error: 'This service is not available on this referral link' };
    }

    const amount = Number(service.price);
    const currency = service.currency.toUpperCase().slice(0, 3);
    const description = service.name;

    const shortCode = await generateUniqueShortCode();
    const now = new Date();
    const snapshotMeta = buildCommissionAttributionMetadataFromReferralLink(referralLink);

    const paymentMethod = referralRailToPaymentMethod(paymentRail);

    if (paymentRail === 'stripe' && !merchantSettings?.stripe_account_id) {
      return { success: false, error: 'Card payments are not configured for this merchant' };
    }

    const paymentLink = await prisma.payment_links.create({
      data: {
        id: randomUUID(),
        organization_id: referralLink.organization_id,
        short_code: shortCode,
        status: 'OPEN',
        amount,
        currency,
        invoice_currency: currency,
        description,
        invoice_reference: `SRV-${service.id.slice(0, 8).toUpperCase()}`,
        referral_link_id: referralLink.id,
        referral_code_id: referralLink.referral_code?.id ?? null,
        organization_service_id: service.id,
        payment_method: paymentMethod,
        attribution_referral_code: code,
        attributed_participant_user_id:
          referralLink.referral_code?.participant_user_id ?? referralLink.created_by_user_id ?? null,
        attribution_source: AttributionSource.REFERRAL_SERVICE_SELECTION,
        commission_attribution_snapshot: commissionSnapshotToPrismaJson(snapshotMeta),
        created_at: now,
        updated_at: now,
      },
    });

    if (paymentRail !== 'stripe') {
      const payUrl = getPaymentLinkUrl(shortCode);
      log.info('Referral service payment link created (multi-rail)', {
        correlationId,
        paymentLinkId: paymentLink.id,
        paymentRail,
      });
      return {
        success: true,
        url: payUrl,
        paymentLinkId: paymentLink.id,
      };
    }

    const baseUrl = getBrandedAppOrigin();
    const defaultSuccessUrl = `${baseUrl}/pay/${shortCode}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pay/${shortCode}`;

    const amountInSmallestUnit = toSmallestUnit(amount, currency);
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExpiresAt = nowSec + 86400;
    const basis = hasSplits ? 'GROSS' : (rule?.basis ?? 'GROSS');

    const referralMetadata: Record<string, string> = {
      ...snapshotMeta,
      payment_link_id: paymentLink.id,
      organization_id: referralLink.organization_id,
      short_code: paymentLink.short_code,
      invoice_reference: paymentLink.invoice_reference ?? '',
      commission_basis: basis,
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description,
              description: `Referral: ${code} · Service`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: referralMetadata,
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      expires_at: sessionExpiresAt,
      payment_intent_data: {
        metadata: referralMetadata,
      },
    });

    log.info('Referral service checkout session created', {
      correlationId,
      paymentLinkId: paymentLink.id,
      sessionId: session.id,
    });

    return {
      success: true,
      url: session.url || undefined,
      sessionId: session.id,
      paymentLinkId: paymentLink.id,
    };
  } catch (error: unknown) {
    const stripeError = handleStripeError(error);
    log.error('Referral service checkout failed', error instanceof Error ? error : undefined, {
      correlationId,
      referralCode: code,
      error: stripeError.message,
    });
    return { success: false, error: stripeError.message };
  }
}
