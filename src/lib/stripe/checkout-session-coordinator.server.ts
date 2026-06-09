import 'server-only';

import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { stripe, toSmallestUnit } from '@/lib/stripe/client';
import { invoiceDenominationCurrency } from '@/lib/payments/invoice-denomination';
import { log } from '@/lib/logger';

export type CheckoutSessionLookup = {
  sessionId: string;
  url: string;
  reused: boolean;
};

type PaymentLinkCheckoutRow = {
  id: string;
  short_code: string;
  status: string;
  amount: Prisma.Decimal;
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
    merchant_settings: Array<{
      stripe_account_id: string | null;
      display_name: string | null;
    }>;
  };
};

export type StripeCheckoutGateway = {
  sessions: {
    create: (params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Checkout.Session>;
    retrieve: (id: string) => Promise<Stripe.Checkout.Session>;
  };
};

const defaultGateway: StripeCheckoutGateway = stripe.checkout;

export function isStripeCheckoutSessionChargeable(session: Stripe.Checkout.Session): boolean {
  if (session.status !== 'open') return false;
  if (typeof session.expires_at === 'number' && session.expires_at * 1000 <= Date.now()) {
    return false;
  }
  return Boolean(session.url);
}

export async function clearActiveStripeCheckoutSession(
  paymentLinkId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.payment_links.update({
    where: { id: paymentLinkId },
    data: {
      active_stripe_checkout_session_id: null,
      active_stripe_checkout_expires_at: null,
      updated_at: new Date(),
    },
  });
}

async function lockPaymentLinkForCheckout(
  tx: Prisma.TransactionClient,
  paymentLinkId: string
): Promise<PaymentLinkCheckoutRow | null> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM payment_links
    WHERE id = ${paymentLinkId}::uuid
    FOR UPDATE
  `;
  if (!locked[0]) return null;

  const paymentLink = await tx.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      short_code: true,
      status: true,
      amount: true,
      currency: true,
      invoice_currency: true,
      description: true,
      invoice_reference: true,
      customer_email: true,
      expires_at: true,
      organization_id: true,
      active_stripe_checkout_session_id: true,
      active_stripe_checkout_expires_at: true,
      organizations: {
        include: {
          merchant_settings: {
            select: {
              stripe_account_id: true,
              display_name: true,
            },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  return paymentLink as PaymentLinkCheckoutRow | null;
}

async function tryReuseActiveCheckoutSession(params: {
  paymentLink: PaymentLinkCheckoutRow;
  gateway: StripeCheckoutGateway;
  tx: Prisma.TransactionClient;
}): Promise<CheckoutSessionLookup | null> {
  const { paymentLink, gateway, tx } = params;
  const activeSessionId = paymentLink.active_stripe_checkout_session_id;
  if (!activeSessionId) return null;

  const localExpiry = paymentLink.active_stripe_checkout_expires_at;
  if (localExpiry && localExpiry.getTime() <= Date.now()) {
    await clearActiveStripeCheckoutSession(paymentLink.id, tx);
    return null;
  }

  try {
    const session = await gateway.sessions.retrieve(activeSessionId);
    if (!isStripeCheckoutSessionChargeable(session)) {
      await clearActiveStripeCheckoutSession(paymentLink.id, tx);
      return null;
    }

    return {
      sessionId: session.id,
      url: session.url!,
      reused: true,
    };
  } catch (error) {
    log.warn('Failed to retrieve active Stripe checkout session; clearing lease', {
      paymentLinkId: paymentLink.id,
      activeSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    await clearActiveStripeCheckoutSession(paymentLink.id, tx);
    return null;
  }
}

function buildCheckoutSessionExpiry(paymentLink: PaymentLinkCheckoutRow): number {
  const now = Math.floor(Date.now() / 1000);
  const stripeMaxExpiry = now + 86400;
  if (!paymentLink.expires_at) return stripeMaxExpiry;
  const linkExpiry = Math.floor(new Date(paymentLink.expires_at).getTime() / 1000);
  return Math.min(linkExpiry, stripeMaxExpiry);
}

export async function resolveOrCreateStripeCheckoutSession(input: {
  paymentLinkId: string;
  baseUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  gateway?: StripeCheckoutGateway;
}): Promise<CheckoutSessionLookup> {
  const gateway = input.gateway ?? defaultGateway;

  return prisma.$transaction(async (tx) => {
    const paymentLink = await lockPaymentLinkForCheckout(tx, input.paymentLinkId);
    if (!paymentLink) {
      throw new CheckoutCoordinatorError('Payment link not found', 404);
    }

    if (paymentLink.status !== 'OPEN') {
      throw new CheckoutCoordinatorError(
        `Payment link is ${paymentLink.status.toLowerCase()}`,
        400
      );
    }

    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      throw new CheckoutCoordinatorError('Payment link has expired', 400);
    }

    const merchantSettings = paymentLink.organizations.merchant_settings[0];
    if (!merchantSettings?.stripe_account_id) {
      throw new CheckoutCoordinatorError('Stripe not configured for this merchant', 400);
    }

    const reused = await tryReuseActiveCheckoutSession({ paymentLink, gateway, tx });
    if (reused) {
      log.info('Reusing active Stripe checkout session', {
        paymentLinkId: paymentLink.id,
        sessionId: reused.sessionId,
      });
      return reused;
    }

    const invoiceCcy = invoiceDenominationCurrency(paymentLink);
    const amountInSmallestUnit = toSmallestUnit(Number(paymentLink.amount), invoiceCcy);
    const sessionExpiresAt = buildCheckoutSessionExpiry(paymentLink);

    const defaultSuccessUrl = `${input.baseUrl}/pay/${paymentLink.short_code}/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${input.baseUrl}/pay/${paymentLink.short_code}`;

    const session = await gateway.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: invoiceCcy.toLowerCase(),
            product_data: {
              name: paymentLink.description || `Payment for ${paymentLink.short_code}`,
              description: paymentLink.invoice_reference
                ? `Invoice: ${paymentLink.invoice_reference}`
                : undefined,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_link_id: paymentLink.id,
        organization_id: paymentLink.organization_id,
        short_code: paymentLink.short_code,
        invoice_reference: paymentLink.invoice_reference || '',
      },
      customer_email: paymentLink.customer_email || undefined,
      success_url: input.successUrl || defaultSuccessUrl,
      cancel_url: input.cancelUrl || defaultCancelUrl,
      expires_at: sessionExpiresAt,
      payment_intent_data: {
        metadata: {
          payment_link_id: paymentLink.id,
          organization_id: paymentLink.organization_id,
          short_code: paymentLink.short_code,
        },
      },
    });

    if (!session.url) {
      throw new CheckoutCoordinatorError('Stripe Checkout session URL missing', 500);
    }

    await tx.payment_links.update({
      where: { id: paymentLink.id },
      data: {
        active_stripe_checkout_session_id: session.id,
        active_stripe_checkout_expires_at: new Date(sessionExpiresAt * 1000),
        updated_at: new Date(),
      },
    });

    await tx.payment_events.create({
      data: {
        id: randomUUID(),
        payment_link_id: paymentLink.id,
        organization_id: paymentLink.organization_id,
        event_type: 'PAYMENT_INITIATED',
        payment_method: 'STRIPE',
        metadata: {
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
          amount: amountInSmallestUnit,
          currency: invoiceCcy,
          expiresAt: new Date(sessionExpiresAt * 1000).toISOString(),
          lease: 'active',
        },
      },
    });

    log.info('Created Stripe checkout session with single-active lease', {
      paymentLinkId: paymentLink.id,
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      url: session.url,
      reused: false,
    };
  });
}

export async function getActiveStripeCheckoutSession(input: {
  paymentLinkId: string;
  gateway?: StripeCheckoutGateway;
}): Promise<CheckoutSessionLookup | null> {
  const gateway = input.gateway ?? defaultGateway;
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: input.paymentLinkId },
    select: {
      id: true,
      status: true,
      active_stripe_checkout_session_id: true,
      active_stripe_checkout_expires_at: true,
    },
  });

  if (!paymentLink || paymentLink.status !== 'OPEN' || !paymentLink.active_stripe_checkout_session_id) {
    return null;
  }

  if (
    paymentLink.active_stripe_checkout_expires_at &&
    paymentLink.active_stripe_checkout_expires_at.getTime() <= Date.now()
  ) {
    await clearActiveStripeCheckoutSession(paymentLink.id);
    return null;
  }

  try {
    const session = await gateway.sessions.retrieve(paymentLink.active_stripe_checkout_session_id);
    if (!isStripeCheckoutSessionChargeable(session)) {
      await clearActiveStripeCheckoutSession(paymentLink.id);
      return null;
    }

    return {
      sessionId: session.id,
      url: session.url!,
      reused: true,
    };
  } catch {
    await clearActiveStripeCheckoutSession(paymentLink.id);
    return null;
  }
}

export class CheckoutCoordinatorError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'CheckoutCoordinatorError';
  }
}
