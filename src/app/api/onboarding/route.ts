import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  getOperatorOnboardingState,
  saveOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';
import { COLLECTION_PREFERENCE_VALUES } from '@/lib/onboarding/collection-preference';

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  state: z.object({
    step: z.enum(['use_case', 'project', 'participants', 'funding', 'payment_rails', 'complete']),
    onboarding_use_case: z.string().optional(),
    onboarding_context: z.string().optional(),
    collection_preference: z.enum(COLLECTION_PREFERENCE_VALUES).optional(),
    organizationId: z.string().uuid().optional(),
    merchantSettingsId: z.string().uuid().optional(),
    projectId: z.string().optional(),
    completed: z.boolean().optional(),
    completedAt: z.string().optional(),
  }),
});

/** GET /api/onboarding — load saved onboarding progression for the user's organization */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiResponse({ hasOrganization: false, state: null });
  }

  const state = await getOperatorOnboardingState(org.id);
  return apiResponse({
    hasOrganization: true,
    organizationId: org.id,
    state,
  });
}

/** PATCH /api/onboarding — persist onboarding progression */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { data: body, error } = await validateBody(request, patchSchema);
  if (error) {
    return error;
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org || org.id !== body.organizationId) {
    return apiError('Forbidden', 403);
  }

  await saveOperatorOnboardingState(org.id, user.id, body.state as OperatorOnboardingState);
  return apiResponse({ ok: true });
}
