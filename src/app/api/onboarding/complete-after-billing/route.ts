import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import {
  getOperatorOnboardingState,
  saveOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';
import { resumeOperationalInitialization } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import { resolveEntitlementContext } from '@/lib/entitlements/resolve-context.server';
import {
  getEffectivePlan,
  hasActivePaidSubscription,
} from '@/lib/entitlements/subscription-state';

/**
 * POST /api/onboarding/complete-after-billing
 * Marks onboarding complete after Stripe confirms an active paid subscription.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('No organization found', 404);
  }

  const ctx = await resolveEntitlementContext({
    organizationId: org.id,
    userId: user.id,
    userEmail: user.email,
  });

  if (!hasActivePaidSubscription(ctx)) {
    return apiError('Active subscription required before completing onboarding', 402);
  }

  const existing = await getOperatorOnboardingState(org.id);
  const { pending_billing_plan: _pending, ...rest } = existing ?? { step: 'complete' as const };

  await saveOperatorOnboardingState(org.id, user.id, {
    ...rest,
    step: 'complete',
    completed: true,
    completedAt: new Date().toISOString(),
    organizationId: org.id,
  });

  const convergence = await resumeOperationalInitialization({
    userId: user.id,
    organizationId: org.id,
    triggerSource: 'finish-onboarding-billing',
  });

  return apiResponse({
    ok: true,
    plan: ctx.plan,
    effectivePlan: getEffectivePlan(ctx),
    hasActivePaidSubscription: true,
    operationalInitialization: convergence.snapshot,
  });
}
