import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import {
  runParticipantCoordinationAction,
} from '@/lib/workflows/agreement-intelligence/participant-coordination.server';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

const bodySchema = z.object({
  action: z.enum([
    'request_approval',
    'request_payout_details',
    'approve_payout_details',
    'flag_payout_details',
    'activate_referral',
  ]),
  missingFields: z.array(z.string().min(1).max(80)).max(20).optional(),
  requestedChanges: z.string().max(2000).optional(),
});

function mapAgreementError(error: unknown) {
  if (error instanceof WorkflowAgreementError) {
    return apiError(error.message, error.status, error.code);
  }
  throw error;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id, participantId } = await context.params;
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result = await runParticipantCoordinationAction({
      organizationId: access.organizationId,
      workflowId: id,
      userId: access.userId,
      participantId,
      action: body.action as ParticipantCoordinationAction,
      origin: request.nextUrl.origin,
      missingFields: body.missingFields,
      requestedChanges: body.requestedChanges,
    });
    return apiResponse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Invalid request', 400, 'INVALID_INPUT');
    }
    return mapAgreementError(error);
  }
}
