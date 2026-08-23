import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { isSubscriptionPlan } from '@/lib/entitlements/plans';
import { updateOrganizationSubscription } from '@/lib/entitlements/resolve-context.server';
import { trackEntitlementEvent } from '@/lib/entitlements/analytics';
import { prisma } from '@/lib/server/prisma';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';

const patchSchema = z.object({
  plan: z.enum(['starter', 'professional', 'growth', 'enterprise']),
  status: z.enum(['inactive', 'active', 'trialing', 'past_due', 'canceled']).optional(),
});

/**
 * PATCH /api/organizations/[id]/subscription
 * Starter and Enterprise may be set manually. Professional/Growth require Stripe Checkout.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const { id } = await params;
  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org || org.id !== id) {
    return apiError('Forbidden', 403);
  }

  const { data: body, error } = await validateBody(request, patchSchema);
  if (error) {
    return error;
  }

  if (body.plan === 'professional' || body.plan === 'growth') {
    return apiError(
      'Professional and Growth plans require Stripe Checkout. Use POST /api/billing/create-checkout-session.',
      403
    );
  }

  const existing = await prisma.organizations.findUnique({
    where: { id },
    select: { subscription_plan: true },
  });
  const previousPlan = isSubscriptionPlan(existing?.subscription_plan)
    ? (existing!.subscription_plan as SubscriptionPlan)
    : null;

  if (body.plan === 'starter' && previousPlan && previousPlan !== 'starter') {
    return apiError(
      'Starter cannot be assigned to a workspace that is not already a historical Starter organisation.',
      403
    );
  }

  const status: SubscriptionStatus | undefined =
    body.plan === 'starter'
      ? (body.status ?? 'inactive')
      : body.status;

  const updated = await updateOrganizationSubscription({
    organizationId: id,
    plan: body.plan,
    status,
  });

  const event =
    previousPlan === body.plan ? 'plan_selected' : ('plan_changed' as const);
  trackEntitlementEvent(event, {
    organizationId: id,
    workspaceId: id,
    currentPlan: body.plan,
    requiredPlan: body.plan,
    previousPlan: previousPlan ?? body.plan,
    userId: user.id,
  });

  return apiResponse({
    organizationId: updated.id,
    plan: updated.subscription_plan,
    status: updated.subscription_status,
  });
}
