import 'server-only';

import type Stripe from 'stripe';
import { stripe, isStripeEnabled } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';
import {
  getStripePriceIdForPlan,
  planFromStripePriceId,
  SAAS_BILLING_CHECKOUT_TYPE,
  type PaidStripePlan,
} from '@/lib/billing/stripe-subscription-plans';
import { getBrandedAppOrigin } from '@/lib/runtime/customer-facing-url';

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'inactive';
  }
}

function resolvePlanFromSubscription(subscription: Stripe.Subscription): SubscriptionPlan | null {
  const priceId = subscription.items.data[0]?.price?.id;
  return planFromStripePriceId(priceId);
}

export async function ensureStripeCustomerForOrganization(input: {
  organizationId: string;
  organizationName: string;
  userEmail: string;
  existingCustomerId?: string | null;
}): Promise<string> {
  if (input.existingCustomerId) return input.existingCustomerId;
  if (!isStripeEnabled) {
    throw new Error('Stripe billing is not configured');
  }

  const customer = await stripe.customers.create({
    email: input.userEmail,
    name: input.organizationName,
    metadata: {
      organizationId: input.organizationId,
      billingType: SAAS_BILLING_CHECKOUT_TYPE,
    },
  });

  await prisma.organizations.update({
    where: { id: input.organizationId },
    data: { stripe_customer_id: customer.id },
  });

  return customer.id;
}

export async function createSaasSubscriptionCheckoutSession(input: {
  organizationId: string;
  organizationName: string;
  userId: string;
  userEmail: string;
  plan: PaidStripePlan;
  stripeCustomerId?: string | null;
}): Promise<{ url: string; sessionId: string }> {
  if (!isStripeEnabled) {
    throw new Error('Stripe billing is not configured');
  }

  const priceId = getStripePriceIdForPlan(input.plan);
  if (!priceId) {
    throw new Error(`Stripe price is not configured for ${input.plan}`);
  }

  const customerId = await ensureStripeCustomerForOrganization({
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    userEmail: input.userEmail,
    existingCustomerId: input.stripeCustomerId,
  });

  const origin = getBrandedAppOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?billing=success&plan=${input.plan}`,
    cancel_url: `${origin}/dashboard?billing=canceled`,
    client_reference_id: input.organizationId,
    subscription_data: {
      metadata: {
        organizationId: input.organizationId,
        plan: input.plan,
        billingType: SAAS_BILLING_CHECKOUT_TYPE,
      },
    },
    metadata: {
      billingType: SAAS_BILLING_CHECKOUT_TYPE,
      organizationId: input.organizationId,
      plan: input.plan,
      userId: input.userId,
    },
  });

  if (!session.url) {
    throw new Error('Stripe Checkout session URL missing');
  }

  return { url: session.url, sessionId: session.id };
}

export async function applyStripeSubscriptionToOrganization(input: {
  organizationId: string;
  subscription: Stripe.Subscription;
  correlationId?: string;
}): Promise<void> {
  const plan = resolvePlanFromSubscription(input.subscription);
  if (!plan) {
    log.warn(
      {
        correlationId: input.correlationId,
        organizationId: input.organizationId,
        subscriptionId: input.subscription.id,
      },
      'Ignoring Stripe subscription with unknown price id'
    );
    return;
  }

  const status = mapStripeSubscriptionStatus(input.subscription.status);
  const customerId =
    typeof input.subscription.customer === 'string'
      ? input.subscription.customer
      : input.subscription.customer?.id ?? null;

  const periodEnd = input.subscription.current_period_end
    ? new Date(input.subscription.current_period_end * 1000)
    : null;

  const isEntitled = status === 'active' || status === 'trialing';

  await prisma.organizations.update({
    where: { id: input.organizationId },
    data: {
      stripe_customer_id: customerId ?? undefined,
      stripe_subscription_id: input.subscription.id,
      current_period_end: periodEnd,
      subscription_plan: isEntitled ? plan : 'starter',
      subscription_status: isEntitled ? status : status === 'canceled' ? 'canceled' : 'inactive',
    },
  });

  log.info(
    {
      correlationId: input.correlationId,
      organizationId: input.organizationId,
      subscriptionId: input.subscription.id,
      plan,
      status,
    },
    'Workspace subscription synced from Stripe'
  );
}

export async function clearStripeSubscriptionForOrganization(input: {
  organizationId: string;
  correlationId?: string;
}): Promise<void> {
  await prisma.organizations.update({
    where: { id: input.organizationId },
    data: {
      stripe_subscription_id: null,
      current_period_end: null,
      subscription_plan: 'starter',
      subscription_status: 'inactive',
    },
  });

  log.info(
    { correlationId: input.correlationId, organizationId: input.organizationId },
    'Workspace subscription cleared — reverted to Starter'
  );
}

export async function handleSaasCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  correlationId: string
): Promise<void> {
  const organizationId =
    session.metadata?.organizationId ?? session.client_reference_id ?? null;
  if (!organizationId) {
    log.error({ correlationId, sessionId: session.id }, 'SaaS checkout missing organizationId');
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    log.error({ correlationId, sessionId: session.id, organizationId }, 'SaaS checkout missing subscription');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applyStripeSubscriptionToOrganization({
    organizationId,
    subscription,
    correlationId,
  });
}

export async function handleSaasSubscriptionUpdated(
  subscription: Stripe.Subscription,
  correlationId: string
): Promise<void> {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    log.info(
      { correlationId, subscriptionId: subscription.id },
      'Subscription update ignored — no organizationId metadata'
    );
    return;
  }

  if (subscription.status === 'canceled') {
    await clearStripeSubscriptionForOrganization({ organizationId, correlationId });
    return;
  }

  await applyStripeSubscriptionToOrganization({
    organizationId,
    subscription,
    correlationId,
  });
}

export async function handleSaasSubscriptionDeleted(
  subscription: Stripe.Subscription,
  correlationId: string
): Promise<void> {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;
  await clearStripeSubscriptionForOrganization({ organizationId, correlationId });
}

export function isSaasBillingCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.billingType === SAAS_BILLING_CHECKOUT_TYPE;
}
