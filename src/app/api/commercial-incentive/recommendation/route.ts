import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  decideEarlyPaymentIncentive,
  getEarlyPaymentIncentiveView,
} from '@/lib/commercial-incentive/assess.server';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';

const decideSchema = z.object({
  action: z.enum(['approve', 'dismiss']),
  workflowId: z.string().uuid().optional(),
  agreementId: z.string().uuid().optional(),
});

/** GET /api/commercial-incentive/recommendation — proposed incentive from extracted terms. */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) {
    return apiError('Rate limit exceeded', 429);
  }

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const workflowId = request.nextUrl.searchParams.get('workflowId')?.trim() || undefined;
  const agreementId = request.nextUrl.searchParams.get('agreementId')?.trim() || undefined;

  const view = await getEarlyPaymentIncentiveView({
    organizationId: access.organizationId,
    workflowId,
    agreementId,
  });

  return apiResponse(view);
}

/** POST /api/commercial-incentive/recommendation — explicit human approve or dismiss. */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) {
    return apiError('Rate limit exceeded', 429);
  }

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { data: body, error } = await validateBody(request, decideSchema);
  if (error || !body) return error ?? apiError('Invalid request', 400);

  try {
    const view = await decideEarlyPaymentIncentive({
      organizationId: access.organizationId,
      userId: access.userId,
      action: body.action,
      workflowId: body.workflowId,
      agreementId: body.agreementId,
    });
    return apiResponse(view);
  } catch (caught) {
    const status =
      caught && typeof caught === 'object' && 'status' in caught
        ? Number((caught as { status: number }).status)
        : 500;
    const message = caught instanceof Error ? caught.message : 'Unable to save incentive decision';
    const code =
      caught && typeof caught === 'object' && 'code' in caught
        ? String((caught as { code: string }).code)
        : undefined;
    return apiError(message, Number.isInteger(status) ? status : 500, code);
  }
}
