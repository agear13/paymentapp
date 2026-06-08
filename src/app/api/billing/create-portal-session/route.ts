import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { createBillingPortalSession } from '@/lib/billing/stripe-subscription.server';
import { isStripeEnabled } from '@/lib/stripe/client';

/** POST /api/billing/create-portal-session — Stripe Customer Billing Portal. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  if (!isStripeEnabled) {
    return apiError('Stripe billing is not configured', 503);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('No organization found', 404);
  }

  const orgBilling = await prisma.organizations.findUnique({
    where: { id: org.id },
    select: { stripe_customer_id: true },
  });

  const stripeCustomerId = orgBilling?.stripe_customer_id;
  if (!stripeCustomerId) {
    return apiError('No Stripe customer on file. Subscribe to a paid plan first.', 404);
  }

  try {
    const session = await createBillingPortalSession({ stripeCustomerId });
    return apiResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create billing portal session';
    return apiError(message, 500);
  }
}
