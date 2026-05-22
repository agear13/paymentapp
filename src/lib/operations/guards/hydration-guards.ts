import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { CompensationStructure } from '@/lib/operations/states/compensation-state';
import type { CompensationState } from '@/lib/operations/states/compensation-state';
import type { ParticipantState } from '@/lib/operations/states/participant-state';
import type { ProjectState } from '@/lib/operations/states/project-state';
import {
  derivePayoutOnboardingPhase,
  PAYOUT_ONBOARDING_UI_IMPLEMENTED,
} from '@/lib/operations/lifecycle/payout-lifecycle';
import { isOnboardingComplete, effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

/**
 * Safe hydration — never trust DB completeness.
 * All UI and orchestration must read entities through these helpers.
 */

export function safeCompensationStructure(
  participant: DemoParticipant | null | undefined
): CompensationStructure | null {
  if (!participant?.compensationProfile) return null;
  const p = participant.compensationProfile;
  return {
    compensationType: mapLegacyCompensationType(p.compensationType),
    percentage: p.percentage,
    fixedAmount: p.fixedAmount,
    revenueSources: p.revenueSources ?? [],
    minimumGuarantee: p.minimumGuarantee,
    payoutPriority: p.payoutPriority,
    notes: p.notes,
    configured: p.configured,
    configuredAt: p.configuredAt,
    exemptFromPayout: p.exemptFromPayout,
  };
}

function mapLegacyCompensationType(
  type: string | undefined
): CompensationStructure['compensationType'] {
  const map: Record<string, CompensationStructure['compensationType']> = {
    UNPAID_INTERNAL: 'INTERNAL',
    FIXED_FEE: 'FIXED_FEE',
    REVENUE_SHARE: 'REVENUE_SHARE',
    COMMISSION: 'COMMISSION',
    HYBRID: 'HYBRID',
    REIMBURSEMENT: 'REIMBURSEMENT',
    CUSTOM: 'CUSTOM',
  };
  return map[type ?? ''] ?? 'CUSTOM';
}

export function safeCompensationState(
  participant: DemoParticipant | null | undefined
): CompensationState {
  const p = participant;
  if (!p) return 'MISSING';
  const type = p.compensationProfile?.compensationType;
  if (
    p.compensationProfile?.exemptFromPayout ||
    type === 'UNPAID_INTERNAL' ||
    (type as string) === 'INTERNAL'
  ) {
    return 'CONFIGURED';
  }
  if (p.compensationProfile?.configured === true) return 'CONFIGURED';
  if (p.compensationProfile?.compensationType) return 'DRAFT';
  return 'MISSING';
}

export function normalizeParticipantEntity(
  participant: DemoParticipant | null | undefined
): DemoParticipant {
  if (!participant) {
    return {
      id: 'unknown',
      name: 'Unnamed participant',
      email: '',
      role: 'Contributor',
      commissionKind: 'fixed_amount',
      commissionValue: 0,
      status: 'Pending',
      approvalStatus: 'Pending approval',
      onboardingStatus: 'NOT_STARTED',
      inviteToken: '',
      workspaceSource: 'project',
      operationalStatus: 'draft',
    };
  }
  return {
    ...participant,
    id: participant.id ?? `draft-${Date.now()}`,
    name: participant.name?.trim() || 'Unnamed participant',
    email: participant.email ?? '',
    role: participant.role ?? 'Contributor',
    commissionKind: participant.commissionKind ?? 'fixed_amount',
    commissionValue: Number.isFinite(participant.commissionValue)
      ? participant.commissionValue
      : 0,
    approvalStatus: participant.approvalStatus ?? 'Pending approval',
    onboardingStatus: participant.onboardingStatus ?? 'NOT_STARTED',
    inviteToken: participant.inviteToken ?? '',
    attributionStatus: participant.attributionStatus ?? 'inactive',
    workspaceSource: participant.workspaceSource ?? 'project',
  };
}

export function deriveParticipantState(
  participant: DemoParticipant | null | undefined
): ParticipantState {
  const p = normalizeParticipantEntity(participant);
  if (p.payoutBlocked) return 'BLOCKED';
  const caps = deriveParticipantCapabilityFlags(p);
  if (caps.payoutReady) return 'READY';
  if (!caps.hasCompensation) return 'COMPENSATION_PENDING';
  if (!caps.hasPayoutDestination) return 'PAYOUT_DETAILS_PENDING';
  if (!caps.hasAgreement && p.inviteStatus === 'Invited') return 'INVITED';
  if (!isOnboardingComplete(effectiveOnboardingStatus(p))) return 'ONBOARDING';
  return 'COMPENSATION_PENDING';
}

export function deriveParticipantCapabilityFlags(
  participant: DemoParticipant | null | undefined
): import('@/lib/operations/states/participant-state').ParticipantCapabilityFlags {
  const p = normalizeParticipantEntity(participant);
  const compState = safeCompensationState(p);
  const hasCompensation = compState === 'CONFIGURED';
  const hasIdentity = Boolean(p.name?.trim());
  const hasEmail = Boolean(p.email?.trim());
  const onboardingComplete = isOnboardingComplete(effectiveOnboardingStatus(p));
  const hasAgreement = p.approvalStatus === 'Approved';
  const hasPayoutDestination =
    compState === 'CONFIGURED' && p.compensationProfile?.exemptFromPayout
      ? true
      : PAYOUT_ONBOARDING_UI_IMPLEMENTED
        ? hasEmail && onboardingComplete
        : onboardingComplete || derivePayoutOnboardingPhase(p) === 'COMPLETED';
  const payoutReady =
    hasCompensation &&
    hasPayoutDestination &&
    hasAgreement &&
    !p.payoutBlocked;
  return {
    hasIdentity,
    hasCompensation,
    hasPayoutDestination,
    hasAgreement,
    payoutReady,
  };
}

export function safeProjectState(project: RecentDeal | null | undefined): ProjectState {
  if (!project) return 'DRAFT';
  const legacy = project.setupStatus;
  if (legacy === 'settlement_ready') return 'READY_FOR_RELEASE';
  if (legacy === 'active') return 'READY_FOR_RELEASE';
  if (legacy === 'draft') return 'DRAFT';
  if (legacy === 'configuring') return 'CONFIGURING';
  if (project.status === 'Paid') return 'SETTLED';
  if (project.status === 'Approved') return 'READY_FOR_RELEASE';
  return 'CONFIGURING';
}

export function draftParticipantDefaults(): Pick<
  DemoParticipant,
  'operationalStatus' | 'onboardingStatus'
> {
  return { operationalStatus: 'draft', onboardingStatus: 'NOT_STARTED' };
}

export function draftProjectDefaults(): Pick<RecentDeal, 'setupStatus' | 'operationalCompleteness'> {
  return {
    setupStatus: 'configuring',
    operationalCompleteness: {
      participantsAdded: false,
      compensationConfigured: false,
      revenueConfigured: false,
      obligationsConfigured: false,
      payoutDestinationsConfigured: false,
      providerConnected: false,
    },
  };
}
