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

  log.info({ correlationId, referralCode: code }, 'Creating referral checkout session');

  try {
    // 1. Lookup referral_link + active rule(s) (code stored/compared uppercase)
    const referralLink = await prisma.referral_links.findFirst({
      where: {
        code,
        status: 'ACTIVE',
      },
      include: {
        referral_rules: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        organizations: {
          include: {
            merchant_settings: {
              select: {
                stripe_account_id: true,
                display_name: true,
              },
            },
          },
        },
      },
    });

    if (!referralLink) {
      log.warn({ code }, 'Referral link not found or inactive');
      return { success: false, error: 'Referral link not found or inactive' };
    }

    const rule = referralLink.referral_rules[0];
    if (!rule) {
      log.warn({ referralLinkId: referralLink.id }, 'No active referral rule');
      return { success: false, error: 'No referral rule configured' };
    }

    const merchantSettings = referralLink.organizations.merchant_settings[0];
    if (!merchantSettings?.stripe_account_id) {
      log.warn({ organizationId: referralLink.organization_id }, 'Stripe not configured');
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
      metadata: {
        payment_link_id: paymentLink.id,
        organization_id: referralLink.organization_id,
        short_code: shortCode,
        invoice_reference: `REF-${code}`,
        // Referral metadata for commission posting
        referral_link_id: referralLink.id,
        referral_code: code,
        consultant_id: rule.consultant_id ?? '',
        bd_partner_id: rule.bd_partner_id ?? '',
        consultant_pct: rule.consultant_pct.toString(),
        bd_partner_pct: rule.bd_partner_pct.toString(),
        commission_basis: rule.basis,
      },
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      expires_at: sessionExpiresAt,
      payment_intent_data: {
        metadata: {
          payment_link_id: paymentLink.id,
          organization_id: referralLink.organization_id,
          short_code: shortCode,
          referral_link_id: referralLink.id,
          referral_code: code,
          consultant_id: rule.consultant_id ?? '',
          bd_partner_id: rule.bd_partner_id ?? '',
          consultant_pct: rule.consultant_pct.toString(),
          bd_partner_pct: rule.bd_partner_pct.toString(),
          commission_basis: rule.basis,
        },
      },
    });

    log.info(
      {
        correlationId,
        referralLinkId: referralLink.id,
        paymentLinkId: paymentLink.id,
        sessionId: session.id,
      },
      'Referral checkout session created'
    );

    return {
      success: true,
      url: session.url || undefined,
      sessionId: session.id,
      paymentLinkId: paymentLink.id,
    };
  } catch (error: any) {
    const stripeError = handleStripeError(error);
    log.error(
      { correlationId, referralCode: code, error: stripeError.message },
      'Referral checkout failed'
    );
    return {
      success: false,
      error: stripeError.message,
    };
  }
}
