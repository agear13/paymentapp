import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  getOperatorOnboardingState,
  saveOperatorOnboardingState,
} from '@/lib/onboarding/operator-onboarding.server';
import { resumeOperationalInitialization } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import type { OperatorOnboardingState } from '@/lib/onboarding/operator-onboarding-types';
import { COLLECTION_PREFERENCE_VALUES } from '@/lib/onboarding/collection-preference';

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  state: z.object({
    step: z.enum([
      'workspace',
      'use_case',
      'project',
      'participants',
      'funding',
      'payment_rails',
      'complete',
    ]),
    workspace_name: z.string().optional(),
    workspace_industry: z.string().optional(),
    workspace_team_size: z.string().optional(),
    onboarding_use_case: z.string().optional(),
    onboarding_context: z.string().optional(),
    collection_preference: z.enum(COLLECTION_PREFERENCE_VALUES).optional(),
    organizationId: z.string().uuid().optional(),
    merchantSettingsId: z.string().uuid().optional(),
    projectId: z.string().optional(),
    completed: z.boolean().optional(),
    completedAt: z.string().optional(),
    pending_billing_plan: z.enum(['professional', 'growth']).optional(),
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
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const { data: body, error } = await validateBody(request, patchSchema);
  if (error) {
    return error;
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org || org.id !== body.organizationId) {
    return apiError('Forbidden', 403);
  }

  await saveOperatorOnboardingState(org.id, user.id, body.state as OperatorOnboardingState);

  let operationalInitialization;
  if (body.state.step === 'complete' || body.state.completed) {
    const convergence = await resumeOperationalInitialization({
      userId: user.id,
      organizationId: org.id,
      triggerSource: 'finish-onboarding',
    });
    operationalInitialization = convergence.snapshot;
  }

  return apiResponse({ ok: true, operationalInitialization });
}
