import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { prepareXlayerCommitment } from '@/lib/xlayer/prepare.server';

const prepareSchema = z.object({
  agreementId: z.string().uuid(),
});

/** POST /api/xlayer/commitments/prepare — build unsigned registry args. Does not submit a chain tx. */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) return apiError('Rate limit exceeded', 429);

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { data: body, error } = await validateBody(request, prepareSchema);
  if (error || !body) return error ?? apiError('Invalid request', 400);

  try {
    const view = await prepareXlayerCommitment({
      organizationId: access.organizationId,
      userId: access.userId,
      agreementId: body.agreementId,
    });
    return apiResponse(view);
  } catch (caught) {
    const status =
      caught && typeof caught === 'object' && 'status' in caught
        ? Number((caught as { status: number }).status)
        : 500;
    const message = caught instanceof Error ? caught.message : 'Unable to prepare commitment';
    const code =
      caught && typeof caught === 'object' && 'code' in caught
        ? String((caught as { code: string }).code)
        : undefined;
    return apiError(message, Number.isInteger(status) ? status : 500, code);
  }
}
