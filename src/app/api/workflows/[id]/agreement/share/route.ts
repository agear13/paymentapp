import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { shareWorkflowAgreementExtraction } from '@/lib/workflows/agreement-intelligence/share-extraction.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';

const bodySchema = z.object({
  to: z.string().trim().email(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    const body = bodySchema.parse(await request.json());
    const result = await shareWorkflowAgreementExtraction({
      organizationId: access.organizationId,
      workflowId: id,
      to: body.to,
      senderName: access.userEmail,
    });
    if (!result.sent) {
      return apiError(result.error, 502, 'EMAIL_NOT_SENT');
    }
    return apiResponse({ sent: true, emailId: result.emailId });
  } catch (error) {
    if (error instanceof WorkflowAgreementError) {
      return apiError(error.message, error.status, error.code);
    }
    if (error instanceof z.ZodError) {
      return apiError('Enter a valid operator email address.', 400, 'INVALID_INPUT');
    }
    throw error;
  }
}
