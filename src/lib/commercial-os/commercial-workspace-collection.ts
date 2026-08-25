import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getProjectDisplayName } from '@/lib/projects/get-project-display-name';
import { formatOperationalStage } from '@/lib/projects/format-operational-stage';
import { participantsForProject } from '@/lib/projects/participants-for-project';

export type CommercialWorkspaceSource =
  | 'agreement_intelligence'
  | 'conversation_import'
  | 'onboarding'
  | 'referral_management'
  | 'manual';

export type CommercialWorkspaceListItem = {
  id: string;
  name: string;
  statusLabel: string;
  settlementLabel: string;
  participantCount: number;
  source: CommercialWorkspaceSource;
  sourceLabel: string;
  href: string;
};

const SOURCE_LABELS: Record<CommercialWorkspaceSource, string> = {
  agreement_intelligence: 'Agreement Intelligence',
  conversation_import: 'Conversation import',
  onboarding: 'Onboarding',
  referral_management: 'Referral Management',
  manual: 'Manual',
};

export function commercialWorkspaceHref(workspaceId: string): string {
  return COMMERCIAL_OS_ROUTES.arrangement(workspaceId);
}

/** Convention from `agreementIntelligencePilotDealId` — `aiwf-{agreementId}`. */
export function agreementIdFromPilotDealId(workspaceId: string): string | null {
  if (!workspaceId.startsWith('aiwf-')) return null;
  const agreementId = workspaceId.slice('aiwf-'.length).trim();
  return agreementId || null;
}

export function sourceAgreementHref(agreementId: string): string {
  return COMMERCIAL_OS_ROUTES.workflowAgreement('agreement-intelligence', agreementId);
}

export function commercialWorkspaceShowsAgreementTab(
  source: CommercialWorkspaceSource,
  linkedAgreementId?: string | null
): boolean {
  return source === 'agreement_intelligence' || Boolean(linkedAgreementId?.trim());
}

export function commercialWorkspaceSourceOf(deal: RecentDeal): CommercialWorkspaceSource {
  const via = deal.createdVia?.trim().toLowerCase() ?? '';
  if (via.includes('agreement_intelligence')) return 'agreement_intelligence';
  if (via.includes('conversation') || via === 'ai_conversation_import') {
    return 'conversation_import';
  }
  if (via === 'deal_network_pilot_manual') return 'manual';
  if (deal.id.startsWith('aiwf-')) return 'agreement_intelligence';
  if (deal.id.startsWith('onb-deal-')) return 'onboarding';
  if (deal.id.startsWith('rmwf-')) return 'referral_management';
  if (deal.importedConversation || deal.importedAt) return 'conversation_import';
  return 'manual';
}

/** Stamp existing payload metadata so OS-created workspaces classify as Manual. */
export function stampManualCommercialWorkspace(deal: RecentDeal): RecentDeal {
  return {
    ...deal,
    createdVia: deal.createdVia ?? 'deal_network_pilot_manual',
    currentStage: deal.currentStage ?? 'Introduced',
    status: deal.status || 'Pending',
    paymentStatus: deal.paymentStatus || 'Not Paid',
  };
}

export function commercialWorkspaceSourceLabel(source: CommercialWorkspaceSource): string {
  return SOURCE_LABELS[source];
}

export function commercialWorkspaceSettlementLabel(deal: RecentDeal): string {
  if (deal.paymentStatus === 'Paid' || deal.status === 'Paid') return 'Settled';
  if (deal.status === 'Approved') return 'Ready to settle';
  if (deal.status === 'In Review') return 'In review';
  if (deal.status === 'Pending') return 'Pending settlement';
  return deal.status;
}

export function toCommercialWorkspaceListItem(
  deal: RecentDeal,
  participants: DemoParticipant[]
): CommercialWorkspaceListItem {
  const source = commercialWorkspaceSourceOf(deal);
  return {
    id: deal.id,
    name: getProjectDisplayName({ dealName: deal.dealName }),
    statusLabel: formatOperationalStage(deal.currentStage ?? deal.status),
    settlementLabel: commercialWorkspaceSettlementLabel(deal),
    participantCount: participantsForProject(participants, deal).length,
    source,
    sourceLabel: commercialWorkspaceSourceLabel(source),
    href: commercialWorkspaceHref(deal.id),
  };
}

export function listCommercialWorkspaces(
  deals: RecentDeal[],
  participants: DemoParticipant[]
): CommercialWorkspaceListItem[] {
  return deals
    .filter((deal) => !deal.archived)
    .map((deal) => toCommercialWorkspaceListItem(deal, participants));
}
