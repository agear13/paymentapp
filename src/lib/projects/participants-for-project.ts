import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { participantSummaryMetrics } from '@/lib/projects/participant-lifecycle';

export type OperationalParticipantRole =
  | 'Contributor'
  | 'Contractor'
  | 'Referrer'
  | 'Partner'
  | 'Co-founder'
  | 'Stakeholder';

export const ROLE_TO_DEMO: Record<OperationalParticipantRole, DemoParticipant['role']> = {
  Contributor: 'Contributor',
  Contractor: 'Contributor',
  Referrer: 'Introducer',
  Partner: 'Connector',
  'Co-founder': 'Connector',
  Stakeholder: 'Contributor',
};

const DEMO_TO_OPERATIONAL_LABEL: Record<DemoParticipant['role'], string> = {
  Introducer: 'Referrer',
  Connector: 'Partner',
  Closer: 'Contractor',
  Contributor: 'Contributor',
};

export function participantsForProject(
  participants: DemoParticipant[],
  project: RecentDeal
): DemoParticipant[] {
  return participants.filter(
    (p) =>
      p.dealId === project.id ||
      (p.dealId == null && p.dealName === project.dealName)
  );
}

export function operationalRoleLabel(participant: DemoParticipant): string {
  return DEMO_TO_OPERATIONAL_LABEL[participant.role] ?? participant.role;
}

export function buildOperationalParticipant(input: {
  name: string;
  email?: string;
  role: OperationalParticipantRole;
  project: RecentDeal;
  payoutDueDate?: string;
  notes?: string;
}): DemoParticipant {
  return buildProjectParticipant({
    name: input.name,
    email: input.email,
    role: input.role,
    project: input.project,
    payoutDueDate: input.payoutDueDate,
    notes: input.notes,
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    enableCustomerAttribution: false,
  });
}

/** @deprecated Use participantSummaryMetrics from participant-lifecycle */
export function participantSummaryStats(participants: DemoParticipant[]) {
  const m = participantSummaryMetrics(participants);
  return {
    total: m.total,
    ready: m.readyForPayout,
    missingOnboarding: m.missingOnboarding,
    pendingAgreements: m.pendingAgreements,
    activeAttribution: m.activeAttribution,
  };
}
