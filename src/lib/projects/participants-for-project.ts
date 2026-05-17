import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';
import {
  buildProjectParticipant,
  derivePayoutStatus,
  payoutStatusLabel,
} from '@/lib/projects/participant-entitlement';

export type OperationalParticipantRole =
  | 'Contributor'
  | 'Contractor'
  | 'Referrer'
  | 'Partner';

export type ParticipantOperationalStatus =
  | 'Invited'
  | 'Pending approval'
  | 'Approved'
  | 'Onboarding incomplete'
  | 'Payout ready';

export const ROLE_TO_DEMO: Record<OperationalParticipantRole, DemoParticipant['role']> = {
  Contributor: 'Contributor',
  Contractor: 'Contributor',
  Referrer: 'Introducer',
  Partner: 'Connector',
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

export function deriveParticipantOperationalStatus(
  participant: DemoParticipant
): ParticipantOperationalStatus {
  const lifecycle = participant.operationalLifecycle;
  if (lifecycle === 'Draft participant') return 'Invited';
  if (lifecycle === 'Payout ready') return 'Payout ready';
  if (lifecycle === 'Payout blocked') {
    return 'Onboarding incomplete';
  }
  if (lifecycle === 'Invited') return 'Invited';
  if (participant.approvalStatus === 'Pending approval') return 'Pending approval';
  if (participant.approvalStatus === 'Approved') {
    const onboarding = effectiveOnboardingStatus(participant);
    if (!isOnboardingComplete(onboarding)) {
      return onboarding === 'INCOMPLETE' ? 'Onboarding incomplete' : 'Approved';
    }
    return 'Payout ready';
  }
  return 'Invited';
}

export function payoutReadinessLabel(participant: DemoParticipant): string {
  return payoutStatusLabel(derivePayoutStatus(participant));
}

/** @deprecated Use buildProjectParticipant from participant-entitlement */
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

export function participantSummaryStats(participants: DemoParticipant[]) {
  const total = participants.length;
  let ready = 0;
  let missingOnboarding = 0;
  let pendingAgreements = 0;

  for (const p of participants) {
    const payout = derivePayoutStatus(p);
    if (payout === 'payout ready') ready += 1;
    if (payout === 'onboarding incomplete' || payout === 'payout blocked') missingOnboarding += 1;
    if (p.operationalLifecycle === 'Draft participant' || payout === 'not invited') {
      pendingAgreements += 1;
    }
  }

  return { total, ready, missingOnboarding, pendingAgreements };
}
