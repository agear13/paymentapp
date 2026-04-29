/**
 * Commission-enabled referral checkout flow (Option B).
 * Creates payment_link + Stripe Checkout Session with referral metadata.
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { stripe, toSmallestUnit, handleStripeError } from '@/lib/stripe/client';
import { generateUniqueShortCode } from '@/lib/server/short-code';
import { log } from '@/lib/logger';

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
}

/**
 * Create payment link and Stripe Checkout Session for a commission-enabled referral.
 * Includes referral metadata on session for webhook commission posting.
 */
export async function createReferralCheckoutSession(
  params: ReferralCheckoutParams
): Promise<ReferralCheckoutResult> {
  const { referralCode, successUrl, cancelUrl, correlationId, amount: amountOverride, currency: currencyOverride, description: descriptionOverride } = params;

  const code = referralCode.trim().toUpperCase();
  if (!code) {
    return { success: false, error: 'Invalid referral code' };
  }

  log.info('Creating referral checkout session', { correlationId, referralCode: code });

  try {
    // 1. Lookup referral_link + splits (or legacy rules)
    const referralLink = await prisma.referral_links.findFirst({
      where: {
        code,
        status: 'ACTIVE',
      },
      include: {
        referral_rules: { orderBy: { created_at: 'desc' }, take: 1 },
        referral_link_splits: { orderBy: { sort_order: 'asc' } },
        organizations: {
          include: {
            merchant_settings: {
              select: { stripe_account_id: true, display_name: true },
            },
          },
        },
      },
    });

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
    if (!merchantSettings?.stripe_account_id) {
      log.warn('Stripe not configured', { organizationId: referralLink.organization_id });
      return { success: false, error: 'Stripe not configured for this merchant' };
    }

    // 2. Get checkout config (default amount/currency/description); overrides from params take precedence
    const config = (referralLink.checkout_config as Record<string, unknown>) || {};
    const amount = amountOverride ?? Number(config.amount) ?? 100;
    const currency = (currencyOverride ?? String(config.currency ?? 'AUD')).toUpperCase().slice(0, 3);
    const description = descriptionOverride ?? String(config.description ?? `Payment via referral ${code}`);

    // 3. Create payment_link
    const shortCode = await generateUniqueShortCode();
    const now = new Date();

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
        created_at: now,
        updated_at: now,
      },
    });

    // 4. Create Stripe Checkout Session with referral metadata
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const defaultSuccessUrl = `${baseUrl}/pay/${shortCode}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${baseUrl}/pay/${shortCode}`;

    const amountInSmallestUnit = toSmallestUnit(amount, currency);
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionExpiresAt = nowSec + 86400; // 24h max

    const basis = hasSplits ? 'GROSS' : (rule?.basis ?? 'GROSS');
    const referralMetadata: Record<string, string> = {
      payment_link_id: paymentLink.id,
      organization_id: referralLink.organization_id,
      short_code: shortCode,
      invoice_reference: `REF-${code}`,
      referral_link_id: referralLink.id,
      referral_code: code,
      commission_basis: basis,
    };
    if (hasSplits) {
      referralMetadata.referral_splits = JSON.stringify(
        splits.map((s) => ({
          split_id: s.id,
          label: s.label,
          percentage: Number(s.percentage),
          beneficiary_id: s.beneficiary_id ?? null,
          sort_order: s.sort_order,
        }))
      );
    } else if (rule) {
      referralMetadata.consultant_id = rule.consultant_id ?? '';
      referralMetadata.bd_partner_id = rule.bd_partner_id ?? '';
      referralMetadata.consultant_pct = rule.consultant_pct.toString();
      referralMetadata.bd_partner_pct = rule.bd_partner_pct.toString();
      referralMetadata.commission_basis = rule.basis;
    }

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
