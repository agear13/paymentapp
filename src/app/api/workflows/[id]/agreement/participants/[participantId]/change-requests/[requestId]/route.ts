import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import {
  AgreementChangeRequestError,
  reviewParticipantAgreementChange,
} from '@/lib/agreements/agreement-change-request.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';

const bodySchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_clarification']),
  reviewNote: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string; requestId: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { participantId, requestId } = await context.params;
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const snapshot = await getPilotSnapshotForUser(access.userId);
    const participant = snapshot.participants.find((row) => row.id === participantId);
    if (!participant) {
      return apiError('Participant not found', 404, 'NOT_FOUND');
    }

    const reviewed = await reviewParticipantAgreementChange({
      participant,
      requestId,
      decision: body.decision,
      reviewedBy: access.userId,
      reviewNote: body.reviewNote,
      origin: resolveCanonicalPublicOrigin(request),
      organizationId: access.organizationId,
    });

    return apiResponse({
      request: reviewed.request,
      resultingVersionId: reviewed.resultingVersionId,
      participant: reviewed.participant,
    });
  } catch (error) {
    if (error instanceof AgreementChangeRequestError) {
      return apiError(error.message, error.status, error.code);
    }
    if (error instanceof z.ZodError) {
      return apiError('Invalid request', 400, 'INVALID_INPUT');
    }
    throw error;
  }
}
