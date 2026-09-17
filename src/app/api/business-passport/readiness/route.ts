import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { assessOfferingReadiness } from '@/lib/business-passport/assess-offering-readiness.server';
import { applyRateLimit } from '@/lib/rate-limit';

const querySchema = z.object({
  offeringId: z.string().min(1).max(128),
});

/** GET /api/business-passport/readiness — org-scoped information readiness for an alternative offering. */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) {
    return apiError('Rate limit exceeded', 429);
  }

  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const parsed = querySchema.safeParse({
    offeringId: request.nextUrl.searchParams.get('offeringId') ?? undefined,
  });
  if (!parsed.success) {
    return apiError('offeringId is required', 400, 'MISSING_OFFERING');
  }

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  if (!org) {
    return apiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  const allowed = await hasOrganizationPermission(auth.user.id, org.id, 'view_settings');
  if (!allowed) {
    return apiError('Forbidden', 403);
  }

  const result = await assessOfferingReadiness({
    organizationId: org.id,
    offeringId: parsed.data.offeringId,
  });

  if (!result.ok) {
    if (result.reason === 'unknown_offering') {
      return apiError('No onboarding-readiness catalog for that offering', 404, 'UNKNOWN_OFFERING');
    }
    return apiError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
  }

  return apiResponse(result.assessment);
}
