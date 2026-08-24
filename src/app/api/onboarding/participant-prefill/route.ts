import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { loadAuthorizedParticipantWorkspacePrefill } from '@/lib/onboarding/participant-workspace-prefill.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/participant-prefill
 * Allowlisted workspace-name suggestion for a bound participant. Not attribution.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const hint =
    request.nextUrl.searchParams.get('sourceParticipantId') ??
    request.nextUrl.searchParams.get('participantId');

  const prefill = await loadAuthorizedParticipantWorkspacePrefill(user.id, hint);
  return apiResponse(prefill);
}
