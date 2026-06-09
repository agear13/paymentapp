import { NextRequest } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { resumeOperationalInitialization } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';

/** POST /api/operations/initialization/resume — replay missing orchestration stages */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    return apiError('Organization required', 400);
  }

  const result = await resumeOperationalInitialization({
    userId: user.id,
    organizationId: org.id,
    triggerSource: 'initialization-resume-api',
  });

  return apiResponse({
    correlationId: result.correlationId,
    operationalInitialization: result.snapshot,
    operationalOnboarding: result.onboarding,
    orchestrationHealthy: result.orchestrationHealthy,
    convergence: result.convergence,
  });
}
