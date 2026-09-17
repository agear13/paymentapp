import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { verifyXlayerCommitment } from '@/lib/xlayer/verify.server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) return apiError('Rate limit exceeded', 429);

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;

  try {
    const record = await verifyXlayerCommitment({
      organizationId: access.organizationId,
      userId: access.userId,
      id,
    });
    return apiResponse({ enabled: true, commitment: record });
  } catch (caught) {
    const status =
      caught && typeof caught === 'object' && 'status' in caught
        ? Number((caught as { status: number }).status)
        : 500;
    const message = caught instanceof Error ? caught.message : 'Unable to verify commitment';
    const code =
      caught && typeof caught === 'object' && 'code' in caught
        ? String((caught as { code: string }).code)
        : undefined;
    return apiError(message, Number.isInteger(status) ? status : 500, code);
  }
}
