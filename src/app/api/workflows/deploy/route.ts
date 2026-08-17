import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { deployWorkflowToOrganization } from '@/lib/workflows/deploy-workflow';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { WorkflowDeployError } from '@/lib/workflows/types';

const deploySchema = z.object({
  templateSlug: z.string().min(1).max(64),
  configuration: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) {
    return access.response;
  }

  const { data: body, error } = await validateBody(request, deploySchema);
  if (error) {
    return error;
  }

  try {
    const result = await deployWorkflowToOrganization({
      organizationId: access.organizationId,
      userId: access.userId,
      userEmail: access.userEmail,
      templateSlug: body.templateSlug,
      configuration: body.configuration,
    });

    return apiResponse(
      {
        workflow: result.workflow,
        created: result.created,
      },
      result.created ? 201 : 200
    );
  } catch (err) {
    if (err instanceof WorkflowDeployError) {
      return apiError(err.message, err.status, err.code);
    }
    throw err;
  }
}
