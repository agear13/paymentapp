import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import {
  listWorkflowAgreements,
  startNewWorkflowAgreement,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';

function mapAgreementError(error: unknown) {
  if (error instanceof WorkflowAgreementError) {
    return apiError(error.message, error.status, error.code);
  }
  throw error;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    const data = await listWorkflowAgreements(access.organizationId, id);
    return apiResponse(data);
  } catch (error) {
    return mapAgreementError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action && body.action !== 'start_new') {
      return apiError('Unsupported action', 400);
    }
    const data = await startNewWorkflowAgreement(access.organizationId, id);
    return apiResponse(data);
  } catch (error) {
    return mapAgreementError(error);
  }
}
