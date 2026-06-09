import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { createSaasSubscriptionCheckoutSession } from '@/lib/billing/stripe-subscription.server';
import { isPaidStripePlan } from '@/lib/billing/stripe-subscription-plans';
import { isStripeEnabled } from '@/lib/stripe/client';

const bodySchema = z.object({
  plan: z.enum(['professional', 'growth']),
  context: z.enum(['onboarding', 'upgrade']).optional().default('upgrade'),
});

/** POST /api/billing/create-checkout-session — Stripe Checkout for SaaS subscription. */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  if (!isStripeEnabled) {
    return apiError('Stripe billing is not configured', 503);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('No organization found', 404);
  }

  const { data: body, error } = await validateBody(request, bodySchema);
  if (error) {
    return error;
  }

  if (!isPaidStripePlan(body.plan)) {
    return apiError('Invalid plan', 400);
  }

  const orgBilling = await prisma.organizations.findUnique({
    where: { id: org.id },
    select: { name: true, stripe_customer_id: true },
  });

  try {
    const session = await createSaasSubscriptionCheckoutSession({
      organizationId: org.id,
      organizationName: orgBilling?.name ?? org.name,
      userId: user.id,
      userEmail: user.email ?? '',
      plan: body.plan,
      stripeCustomerId: orgBilling?.stripe_customer_id ?? null,
      checkoutContext: body.context,
    });

    return apiResponse({
      url: session.url,
      sessionId: session.sessionId,
      plan: body.plan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return apiError(message, 500);
  }
}
