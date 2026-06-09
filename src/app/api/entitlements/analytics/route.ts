import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  ENTITLEMENT_ANALYTICS_EVENTS,
  trackEntitlementEvent,
} from '@/lib/entitlements/analytics';
import { isSubscriptionPlan } from '@/lib/entitlements/plans';

const schema = z.object({
  event: z.enum(ENTITLEMENT_ANALYTICS_EVENTS),
  workspaceId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  currentPlan: z.string().optional(),
  requiredPlan: z.string().optional(),
  featureName: z.string().optional(),
  feature: z.string().optional(),
  path: z.string().optional(),
});

/** POST /api/entitlements/analytics — non-blocking entitlement funnel events. */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  trackEntitlementEvent(body.event, {
    workspaceId: body.workspaceId ?? body.organizationId,
    organizationId: body.organizationId,
    currentPlan:
      body.currentPlan && isSubscriptionPlan(body.currentPlan) ? body.currentPlan : undefined,
    requiredPlan:
      body.requiredPlan && isSubscriptionPlan(body.requiredPlan) ? body.requiredPlan : undefined,
    featureName: body.featureName,
    feature: body.feature as never,
    path: body.path,
    userId: user.id,
  });

  return apiResponse({ ok: true });
}
