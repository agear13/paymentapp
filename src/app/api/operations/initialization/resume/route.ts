import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { resumeOperationalInitialization } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';

/** POST /api/operations/initialization/resume — replay missing orchestration stages */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

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
