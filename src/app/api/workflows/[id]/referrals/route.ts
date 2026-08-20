import { NextRequest } from 'next/server';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { requireReferralManagementEntitlement } from '@/lib/entitlements/gate-referral-admin.server';
import { getReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlement = await requireReferralManagementEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
  });
  if (entitlement) return entitlement;

  const { id } = await context.params;
  const data = await getReferralManagementContext({
    organizationId: access.organizationId,
    workflowId: id,
    userId: access.userId,
  });
  if (!data) return apiError('Workflow not found', 404, 'NOT_FOUND');
  return apiResponse(data);
}
