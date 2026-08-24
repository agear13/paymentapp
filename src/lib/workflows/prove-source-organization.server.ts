import 'server-only';

import { hasOrganizationAccess } from '@/lib/auth/organization-access';
import { prisma } from '@/lib/server/prisma';

/**
 * Prove the commercial workspace that owns a workflow.
 *
 * Direction is workflow → organization_id → actor membership on THAT org.
 * Never uses oldest-membership helpers or client-supplied organization ids.
 */
export async function proveSourceOrganizationFromWorkflow(
  workflowId: string | null | undefined,
  actorUserId: string | null | undefined
): Promise<string | null> {
  const id = workflowId?.trim() ?? '';
  const actor = actorUserId?.trim() ?? '';
  if (!id || !actor) return null;

  const workflow = await prisma.organization_workflows.findUnique({
    where: { id },
    select: { organization_id: true },
  });
  const organizationId = workflow?.organization_id?.trim() ?? '';
  if (!organizationId) return null;

  const allowed = await hasOrganizationAccess(actor, organizationId);
  if (!allowed) return null;

  return organizationId;
}
