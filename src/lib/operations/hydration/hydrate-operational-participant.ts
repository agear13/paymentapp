import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { AgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import type { ParticipantLifecycleState } from '@/lib/operations/lifecycle/participant-lifecycle';
import type { PayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';
import type {
  CommissionSourceMode,
  ParticipantCompensationProfile,
} from '@/lib/participants/participant-compensation-types';

const DEV = process.env.NODE_ENV === 'development';

function warnMissingField(field: string, participantId: string | undefined): void {
  if (!DEV) return;
  console.warn('[Operational Hydration] Missing participant field:', field, participantId ?? 'unknown');
}

function defaultCompensationDraft(
  participant: DemoParticipant
): ParticipantCompensationProfile | undefined {
  if (participant.compensationProfile) return undefined;
  return {
    compensationType: 'FIXED_FEE',
    configured: false,
    revenueSources: [],
    customerAttributionEnabled: false,
    commissionSourceMode: 'all_active',
    commissionServiceIds: [],
  };
}

function hydrateCompensationProfile(
  participant: DemoParticipant
): ParticipantCompensationProfile | undefined {
  const profile = participant.compensationProfile ?? defaultCompensationDraft(participant);
  if (!profile) return undefined;

  if (participant.compensationProfile == null) {
    warnMissingField('compensationProfile', participant.id);
  }
  if (profile.customerAttributionEnabled === undefined) {
    warnMissingField('customerAttributionEnabled', participant.id);
  }
  if (profile.commissionSourceMode === undefined) {
    warnMissingField('commissionSourceMode', participant.id);
  }
  if (profile.commissionServiceIds === undefined) {
    warnMissingField('commissionServiceIds', participant.id);
  }

  return {
    ...profile,
    revenueSources: profile.revenueSources ?? [],
    customerAttributionEnabled: profile.customerAttributionEnabled ?? false,
    commissionSourceMode: (profile.commissionSourceMode ?? 'all_active') as CommissionSourceMode,
    commissionServiceIds: profile.commissionServiceIds ?? [],
  };
}

/** Backfill legacy/onboarding participants with operational lifecycle defaults. */
export function backfillOperationalParticipantState(
  participant: DemoParticipant
): DemoParticipant {
  if (participant.payoutVerificationConfirmed === undefined) {
    warnMissingField('payoutVerificationConfirmed', participant.id);
  }
  if (participant.participantLifecycle === undefined) {
    warnMissingField('participantLifecycle', participant.id);
  }
  if (participant.agreementLifecycle === undefined) {
    warnMissingField('agreementLifecycle', participant.id);
  }

  const payoutOnboardingPhase: PayoutOnboardingPhase =
    participant.payoutVerificationConfirmed === true
      ? 'COMPLETED'
      : participant.payoutOnboardingPhase ?? 'NOT_STARTED';

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
    status: participant.status ?? 'Pending',
    approvalStatus: participant.approvalStatus ?? 'Pending approval',
    onboardingStatus: participant.onboardingStatus ?? 'NOT_STARTED',
    inviteToken: participant.inviteToken ?? '',
    attributionStatus: participant.attributionStatus ?? 'inactive',
    workspaceSource: participant.workspaceSource ?? 'project',
    operationalStatus: participant.operationalStatus ?? 'draft',
    participantLifecycle: (participant.participantLifecycle ?? 'DRAFT') as ParticipantLifecycleState,
    agreementLifecycle: (participant.agreementLifecycle ??
      'NOT_CREATED') as AgreementLifecycleState,
    payoutOnboardingPhase,
    payoutVerificationConfirmed: participant.payoutVerificationConfirmed ?? false,
    payoutVerificationConfirmedAt: participant.payoutVerificationConfirmedAt ?? undefined,
    agreementUrl: participant.agreementUrl ?? undefined,
    agreementSharedAt: participant.agreementSharedAt ?? undefined,
    participantNotes: participant.participantNotes ?? '',
    compensationProfile: hydrateCompensationProfile(participant),
    payoutBlocked: participant.payoutBlocked ?? false,
  };
}

export function createEmptyOperationalParticipant(): DemoParticipant {
  return backfillOperationalParticipantState({
    id: 'unknown',
    name: 'Unnamed participant',
    email: '',
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 0,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: '',
    workspaceSource: 'project',
  });
}

/** Canonical operational participant hydration — safe for draft/onboarding entities. */
export function hydrateOperationalParticipant(
  participant: DemoParticipant | null | undefined
): DemoParticipant {
  if (!participant) return createEmptyOperationalParticipant();
  try {
    return backfillOperationalParticipantState(participant);
  } catch (e) {
    if (DEV) {
      console.warn('[Operational Hydration] Failed to hydrate participant', participant.id, e);
    }
    return createEmptyOperationalParticipant();
  }
}

export function hydrateOperationalParticipants(
  participants: DemoParticipant[] | null | undefined
): DemoParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants.map((p) => hydrateOperationalParticipant(p));
}
