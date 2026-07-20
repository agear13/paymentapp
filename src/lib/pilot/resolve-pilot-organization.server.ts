import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  isPilotOrganizationDevFallbackAllowed,
  resolvePilotOrganizationFromMemberships,
  type PilotOrganizationResolution,
  type PilotOrganizationSummary,
} from './resolve-pilot-organization';

export async function listPilotOrganizationsForUser(
  userId: string
): Promise<PilotOrganizationSummary[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string }>
  >`
    SELECT o.id, o.name
    FROM organizations o
    INNER JOIN user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = ${userId}
    ORDER BY uo.created_at ASC
  `;

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function resolvePilotOrganizationId(input: {
  explicitOrgId?: string | null;
  userId?: string | null;
}): Promise<{
  organizationId: string | null;
  resolution: PilotOrganizationResolution;
}> {
  const memberships = input.userId
    ? await listPilotOrganizationsForUser(input.userId)
    : [];

  return resolvePilotOrganizationFromMemberships({
    explicitOrgId: input.explicitOrgId,
    memberships,
    devFallbackOrgId: process.env.PILOT_ORGANIZATION_ID,
    allowDevFallback: isPilotOrganizationDevFallbackAllowed(),
  });
}
