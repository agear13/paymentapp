import 'server-only';

import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { prisma } from '@/lib/server/prisma';
import { materializeConversationImportHistoryForDeal } from '@/lib/operations/audit/conversation-import-audit';

export async function getOrgMemberUserIds(organizationId: string): Promise<string[]> {
  const rows = await prisma.user_organizations.findMany({
    where: { organization_id: organizationId },
    select: { user_id: true },
  });
  return rows.map((r) => r.user_id);
}

function isActiveAgreement(dealPayload: unknown): boolean {
  if (!dealPayload || typeof dealPayload !== 'object') return true;
  const archived = (dealPayload as RecentDeal).archived;
  return archived !== true;
}

function countImportsOnDeal(dealPayload: unknown): number {
  if (!dealPayload || typeof dealPayload !== 'object') return 0;
  const deal = materializeConversationImportHistoryForDeal(dealPayload as RecentDeal);
  return deal.conversationImportHistory?.length ?? 0;
}

/** Active (non-archived) agreements across all org members' pilot deals. */
export async function getActiveAgreementCount(organizationId: string): Promise<number> {
  const userIds = await getOrgMemberUserIds(organizationId);
  if (userIds.length === 0) return 0;

  const deals = await prisma.deal_network_pilot_deals.findMany({
    where: { user_id: { in: userIds } },
    select: { deal_payload: true },
  });

  return deals.filter((d) => isActiveAgreement(d.deal_payload)).length;
}

/** Successful Agreement Intelligence extractions (conversation import history entries). */
export async function getAiImportCount(organizationId: string): Promise<number> {
  const userIds = await getOrgMemberUserIds(organizationId);
  if (userIds.length === 0) return 0;

  const deals = await prisma.deal_network_pilot_deals.findMany({
    where: { user_id: { in: userIds } },
    select: { deal_payload: true },
  });

  return deals.reduce((sum, d) => sum + countImportsOnDeal(d.deal_payload), 0);
}

export async function getTeamMemberCount(organizationId: string): Promise<number> {
  return prisma.user_organizations.count({
    where: { organization_id: organizationId },
  });
}

export async function getWorkspaceCountForUser(userId: string): Promise<number> {
  return prisma.user_organizations.count({
    where: { user_id: userId },
  });
}

export async function getWorkspaceUsage(
  organizationId: string,
  userId: string
): Promise<{
  agreementCount: number;
  aiImportCount: number;
  teamMemberCount: number;
  workspaceCount: number;
}> {
  const [agreementCount, aiImportCount, teamMemberCount, workspaceCount] = await Promise.all([
    getActiveAgreementCount(organizationId),
    getAiImportCount(organizationId),
    getTeamMemberCount(organizationId),
    getWorkspaceCountForUser(userId),
  ]);

  return { agreementCount, aiImportCount, teamMemberCount, workspaceCount };
}
