import { apiResponse } from '@/lib/api/middleware';
import { deriveFeaturesFromDeployedWorkflows } from '@/lib/workflows/derive-deployed-features';
import { listOrganizationWorkflows } from '@/lib/workflows/organization-workflows.server';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';

export async function GET(request: Request) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) {
    return access.response;
  }

  const workflows = await listOrganizationWorkflows(access.organizationId);
  const enabledFeatures = deriveFeaturesFromDeployedWorkflows(workflows);

  return apiResponse({
    workflows,
    enabledFeatures,
  });
}
