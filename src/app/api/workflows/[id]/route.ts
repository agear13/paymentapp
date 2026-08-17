import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { OrganizationWorkflowStatus } from '@prisma/client';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import {
  getOrganizationWorkflowById,
  updateOrganizationWorkflowStatus,
} from '@/lib/workflows/organization-workflows.server';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { WorkflowNotFoundError } from '@/lib/workflows/types';
import { updateWorkflowConfiguration } from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import { sanitizeWorkflowConfiguration } from '@/lib/workflows/template-registry';
import { resolveWorkflowTemplate } from '@/lib/workflows/template-registry';

const patchSchema = z
  .object({
    status: z.enum(['DEPLOYED', 'PAUSED']).optional(),
    configuration: z.record(z.unknown()).optional(),
  })
  .refine((body) => body.status !== undefined || body.configuration !== undefined, {
    message: 'Provide status and/or configuration',
  });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) {
    return access.response;
  }

  const { id } = await context.params;

  try {
    const workflow = await getOrganizationWorkflowById(access.organizationId, id);
    return apiResponse({ workflow });
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return apiError('Workflow not found', 404);
    }
    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) {
    return access.response;
  }

  const { data: body, error } = await validateBody(request, patchSchema);
  if (error) {
    return error;
  }

  const { id } = await context.params;

  try {
    if (body.configuration !== undefined) {
      const workflow = await getOrganizationWorkflowById(access.organizationId, id);
      const template = resolveWorkflowTemplate(workflow.templateSlug);
      if (!template) {
        return apiError('Workflow template no longer available', 500);
      }
      let sanitized: Record<string, unknown>;
      try {
        sanitized = sanitizeWorkflowConfiguration(template, body.configuration);
      } catch (error) {
        return apiError(error instanceof Error ? error.message : 'Invalid configuration', 400);
      }

      if (workflow.templateSlug === 'agreement-intelligence') {
        const contextData = await updateWorkflowConfiguration(
          access.organizationId,
          id,
          sanitized
        );
        const updatedWorkflow = await getOrganizationWorkflowById(access.organizationId, id);
        return apiResponse({ workflow: updatedWorkflow, ...contextData });
      }

      return apiError('Configuration is not supported for this workflow', 400);
    }

    if (body.status !== undefined) {
      const workflow = await updateOrganizationWorkflowStatus(
        access.organizationId,
        id,
        body.status as OrganizationWorkflowStatus
      );
      return apiResponse({ workflow });
    }

    return apiError('No supported patch fields provided', 400);
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return apiError('Workflow not found', 404);
    }
    if (err instanceof WorkflowAgreementError) {
      return apiError(err.message, err.status);
    }
    throw err;
  }
}
