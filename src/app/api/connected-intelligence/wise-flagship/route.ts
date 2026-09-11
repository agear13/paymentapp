import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { evaluateConnectedWiseFlagship } from '@/lib/connected-intelligence/evaluate-connected-wise';

const flagshipBodySchema = z.object({
  organizationId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const { data: body, error } = await validateBody(request, flagshipBodySchema);
  if (error || !body) return error ?? apiError('Invalid request', 400);

  const allowed = await hasOrganizationPermission(
    auth.user.id,
    body.organizationId,
    'view_settings'
  );
  if (!allowed) return apiError('Forbidden', 403);

  const result = await evaluateConnectedWiseFlagship(body.organizationId);
  if (!result.ok) {
    const status =
      result.reason === 'consent_required' || result.reason === 'consent_revoked'
        ? 403
        : result.reason === 'wise_not_connected' || result.reason === 'missing_profile'
          ? 409
          : 422;
    return apiError(
      result.reason === 'consent_required' || result.reason === 'consent_revoked'
        ? 'Wise payment intelligence consent is required'
        : 'Connected Wise economics are unavailable',
      status,
      result.reason
    );
  }

  return apiResponse(result.insight);
}
