import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { getXlayerCommitmentView } from '@/lib/xlayer/prepare.server';

/** GET /api/xlayer/commitments — current on-chain commitment for an agreement. */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) return apiError('Rate limit exceeded', 429);

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const agreementId = request.nextUrl.searchParams.get('agreementId')?.trim() || undefined;
  const view = await getXlayerCommitmentView({
    organizationId: access.organizationId,
    agreementId,
  });
  return apiResponse(view);
}
