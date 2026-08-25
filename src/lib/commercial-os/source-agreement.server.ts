import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { sourceAgreementHref } from '@/lib/commercial-os/commercial-workspace-collection';

export type SourceAgreementLookup = {
  id: string;
  title: string;
  href: string;
  extractionStatus: string;
  bootstrappedAt: string | null;
};

/**
 * Org-scoped agreement linked to a user-scoped pilot deal.
 * Tenancy: deals remain user-owned; this only returns an agreement in the
 * caller's organization with matching `pilot_deal_id`.
 */
export async function findSourceAgreementForWorkspace(
  userId: string,
  workspaceId: string
): Promise<SourceAgreementLookup | null> {
  const owned = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: workspaceId, user_id: userId },
    select: { id: true },
  });
  if (!owned) return null;

  const org = await getOrganizationForAuthenticatedUser(userId);
  if (!org) return null;

  const row = await prisma.organization_workflow_agreements.findFirst({
    where: { organization_id: org.id, pilot_deal_id: workspaceId },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      title: true,
      original_filename: true,
      extraction_status: true,
      bootstrapped_at: true,
    },
  });
  if (!row) return null;

  const title =
    row.title?.trim() || row.original_filename?.trim() || 'Linked agreement';

  return {
    id: row.id,
    title,
    href: sourceAgreementHref(row.id),
    extractionStatus: row.extraction_status,
    bootstrappedAt: row.bootstrapped_at?.toISOString() ?? null,
  };
}
