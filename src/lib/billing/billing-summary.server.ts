import 'server-only';

import type Stripe from 'stripe';
import { stripe, isStripeEnabled } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { getWorkspaceEntitlementsForUser } from '@/lib/entitlements/resolve-context.server';
import { requiredPlanLabel } from '@/lib/entitlements/plans';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';

export type PaymentMethodSummary = {
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  label: string;
};

export type BillingSummary = {
  organizationId: string;
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  status: SubscriptionStatus;
  hasActivePaidSubscription: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  planLabel: string;
  statusLabel: string;
  renewalLabel: string | null;
  paymentMethod: PaymentMethodSummary | null;
  canManageInPortal: boolean;
};

function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trialing';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
    case 'inactive':
    default:
      return 'Inactive';
  }
}

function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function cardBrandLabel(brand: string): string {
  const normalized = brand.trim().toLowerCase();
  if (!normalized) return 'Card';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function paymentMethodFromStripe(pm: Stripe.PaymentMethod): PaymentMethodSummary | null {
  if (pm.type !== 'card' || !pm.card) return null;
  const brand = cardBrandLabel(pm.card.brand);
  const last4 = pm.card.last4;
  return {
    brand,
    last4,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
    label: `${brand} •••• ${last4}`,
  };
}

async function fetchDefaultPaymentMethodSummary(
  customerId: string
): Promise<PaymentMethodSummary | null> {
  if (!isStripeEnabled) return null;

  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    if (customer.deleted) return null;

    const defaultPm = customer.invoice_settings?.default_payment_method;
    if (defaultPm && typeof defaultPm === 'object') {
      const summary = paymentMethodFromStripe(defaultPm);
      if (summary) return summary;
    }

    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    });

    const first = methods.data[0];
    return first ? paymentMethodFromStripe(first) : null;
  } catch {
    return null;
  }
}

export async function getBillingSummaryForOrganization(input: {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  productProfile?: DashboardProductProfile;
}): Promise<BillingSummary> {
  const entitlements = await getWorkspaceEntitlementsForUser(input);

  const org = await prisma.organizations.findUnique({
    where: { id: input.organizationId },
    select: { stripe_customer_id: true },
  });

  const stripeCustomerId = org?.stripe_customer_id ?? entitlements.stripeCustomerId;
  const paymentMethod = stripeCustomerId
    ? await fetchDefaultPaymentMethodSummary(stripeCustomerId)
    : null;

  return {
    organizationId: input.organizationId,
    plan: entitlements.plan,
    effectivePlan: entitlements.effectivePlan,
    status: entitlements.status,
    hasActivePaidSubscription: entitlements.hasActivePaidSubscription,
    stripeCustomerId,
    stripeSubscriptionId: entitlements.stripeSubscriptionId,
    currentPeriodEnd: entitlements.currentPeriodEnd,
    planLabel: requiredPlanLabel(entitlements.effectivePlan),
    statusLabel: subscriptionStatusLabel(entitlements.status),
    renewalLabel: formatRenewalDate(entitlements.currentPeriodEnd),
    paymentMethod,
    canManageInPortal: Boolean(stripeCustomerId && isStripeEnabled),
  };
}
