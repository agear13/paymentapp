import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { isSubscriptionPlan } from '@/lib/entitlements/plans';
import { updateOrganizationSubscription } from '@/lib/entitlements/resolve-context.server';
import { trackEntitlementEvent } from '@/lib/entitlements/analytics';
import { prisma } from '@/lib/server/prisma';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/entitlements/types';

const patchSchema = z.object({
  plan: z.enum(['starter', 'professional', 'growth', 'enterprise']),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled']).optional(),
});

/** PATCH /api/organizations/[id]/subscription — persist plan selection (no billing). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { id } = await params;
  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org || org.id !== id) {
    return apiError('Forbidden', 403);
  }

  const { data: body, error } = await validateBody(request, patchSchema);
  if (error) {
    return error;
  }

  const existing = await prisma.organizations.findUnique({
    where: { id },
    select: { subscription_plan: true },
  });
  const previousPlan = isSubscriptionPlan(existing?.subscription_plan ?? 'starter')
    ? (existing!.subscription_plan as SubscriptionPlan)
    : 'starter';

  const updated = await updateOrganizationSubscription({
    organizationId: id,
    plan: body.plan,
    status: body.status as SubscriptionStatus | undefined,
  });

  const event =
    previousPlan === body.plan ? 'plan_selected' : ('plan_changed' as const);
  trackEntitlementEvent(event, {
    organizationId: id,
    workspaceId: id,
    currentPlan: body.plan,
    requiredPlan: body.plan,
    previousPlan,
    userId: user.id,
  });

  return apiResponse({
    organizationId: updated.id,
    plan: updated.subscription_plan,
    status: updated.subscription_status,
  });
}
