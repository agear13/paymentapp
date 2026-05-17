import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  effectiveOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';

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

const ROLE_TO_DEMO: Record<OperationalParticipantRole, DemoParticipant['role']> = {
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
  if (participant.inviteStatus === 'Invited' && participant.approvalStatus === 'Pending approval') {
    return 'Invited';
  }
  if (participant.approvalStatus === 'Pending approval') {
    return 'Pending approval';
  }
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
  const status = deriveParticipantOperationalStatus(participant);
  if (status === 'Payout ready') return 'Ready';
  if (status === 'Onboarding incomplete') return 'Onboarding needed';
  if (status === 'Pending approval' || status === 'Invited') return 'Not ready';
  if (status === 'Approved') return 'Approved — onboarding pending';
  return 'Not ready';
}

export function buildOperationalParticipant(input: {
  name: string;
  email: string;
  role: OperationalParticipantRole;
  project: RecentDeal;
  payoutDueDate?: string;
  notes?: string;
}): DemoParticipant {
  const id = `proj-p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inviteToken = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const roleLabel = input.role;
  return {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    role: ROLE_TO_DEMO[input.role],
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    inviteStatus: 'Invited',
    approvalStatus: 'Pending approval',
    onboardingStatus: 'NOT_STARTED',
    inviteToken,
    dealId: input.project.id,
    dealName: input.project.dealName,
    roleDetails: input.notes?.trim() || `${roleLabel} on ${input.project.dealName}`,
    payoutDueDate: input.payoutDueDate?.trim() || undefined,
    participantNotes: input.notes?.trim() || undefined,
  };
}

export function participantSummaryStats(participants: DemoParticipant[]) {
  const total = participants.length;
  let ready = 0;
  let missingOnboarding = 0;
  let pendingAgreements = 0;

  for (const p of participants) {
    const op = deriveParticipantOperationalStatus(p);
    if (op === 'Payout ready') ready += 1;
    if (op === 'Onboarding incomplete') missingOnboarding += 1;
    if (op === 'Invited' || op === 'Pending approval') pendingAgreements += 1;
  }

  return { total, ready, missingOnboarding, pendingAgreements };
}
