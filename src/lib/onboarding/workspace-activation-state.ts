import { computePaymentLinkRailSetup } from '@/lib/payment-links/setup-status';
import type {
  ActivationChecklistItem,
  WorkspaceActivationPhase,
  WorkspaceActivationSnapshot,
} from '@/lib/onboarding/workspace-activation-types';

export type WorkspaceActivationInput = {
  hasOrganization: boolean;
  onboardingCompleted: boolean;
  projectCreated: boolean;
  participantCount: number;
  participantsConfigured: boolean;
  participantsConfiguredCount: number;
  obligationCount: number;
  paymentLinkCount: number;
  collectionPreferenceDecideLater: boolean;
  defaultCurrency: string | null;
  stripeConfigured: boolean;
  wiseConfigured: boolean;
  hederaConfigured: boolean;
  releaseEligibleCount: number;
  releaseBatchCount: number;
  primaryProjectId: string | null;
};

function phaseFromInput(input: WorkspaceActivationInput): {
  phase: WorkspaceActivationPhase;
  label: string;
} {
  if (!input.hasOrganization || !input.onboardingCompleted) {
    return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
  }
  if (input.releaseEligibleCount > 0) {
    return { phase: 'ready_for_release', label: 'Ready for payout release' };
  }
  if (input.obligationCount > 0) {
    return { phase: 'ready_to_coordinate', label: 'Ready to coordinate payouts' };
  }
  if (input.participantsConfigured && input.providerConnected) {
    return { phase: 'ready_to_collect', label: 'Ready to collect revenue' };
  }
  if (input.participantCount > 0 || input.projectCreated) {
    return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
  }
  if (
    input.stripeConfigured ||
    input.wiseConfigured ||
    input.hederaConfigured ||
    input.paymentLinkCount > 0
  ) {
    return { phase: 'ready_to_collect', label: 'Ready to collect revenue' };
  }
  return { phase: 'setup_in_progress', label: 'Workspace setup in progress' };
}

function buildChecklist(input: WorkspaceActivationInput): ActivationChecklistItem[] {
  const providerConnected =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenueConfigured =
    providerConnected ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;
  return [
    { id: 'workspace', label: 'Workspace created', complete: input.hasOrganization },
    { id: 'project', label: 'First project created', complete: input.projectCreated },
    {
      id: 'participants',
      label: 'Participants added',
      complete: input.participantCount > 0,
    },
    {
      id: 'compensation',
      label: 'Participant compensation configured',
      complete: input.participantsConfigured,
    },
    { id: 'provider', label: 'Payment provider connected', complete: providerConnected },
    { id: 'revenue', label: 'Revenue collection ready', complete: revenueConfigured },
    {
      id: 'obligations',
      label: 'Obligations tracked',
      complete: input.obligationCount > 0,
    },
    {
      id: 'release',
      label: 'First payout release completed',
      complete: input.releaseBatchCount > 0,
    },
  ];
}

function progressPercent(checklist: ActivationChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const done = checklist.filter((c) => c.complete).length;
  return Math.round((done / checklist.length) * 100);
}

export function deriveWorkspaceActivation(
  input: WorkspaceActivationInput
): WorkspaceActivationSnapshot {
  const providerConnected =
    input.stripeConfigured || input.wiseConfigured || input.hederaConfigured;
  const revenueConfigured =
    providerConnected ||
    input.paymentLinkCount > 0 ||
    !input.collectionPreferenceDecideLater;
  const checklist = buildChecklist(input);
  const { phase, label } = phaseFromInput(input);

  const activationBlockers: string[] = [];
  if (input.participantCount > 0 && !input.participantsConfigured) {
    activationBlockers.push('Configure how each participant earns before tracking obligations');
  }
  if (!providerConnected && input.participantsConfigured) {
    activationBlockers.push('Connect a payment provider to collect revenue');
  }
  if (input.projectCreated && input.participantCount === 0) {
    activationBlockers.push('Add at least one participant to coordinate payouts');
  }

  const setupWarnings: string[] = [];
  if (input.collectionPreferenceDecideLater && !revenueConfigured) {
    setupWarnings.push('Collection method not chosen yet');
  }
  if (!input.defaultCurrency?.trim()) {
    setupWarnings.push('Default currency not configured');
  }
  if (input.participantCount > 0 && !input.participantsConfigured) {
    setupWarnings.push(
      `${input.participantCount - input.participantsConfiguredCount} participant(s) need compensation configuration`
    );
  }

  return {
    workspaceCreated: input.hasOrganization,
    projectCreated: input.projectCreated,
    participantCount: input.participantCount,
    participantsConfigured: input.participantsConfigured,
    participantsConfiguredCount: input.participantsConfiguredCount,
    obligationsCreated: input.obligationCount > 0,
    obligationCount: input.obligationCount,
    revenueConfigured,
    providerConnected,
    payoutMethodConfigured: providerConnected,
    releaseEligible: input.releaseEligibleCount > 0,
    releaseEligibleCount: input.releaseEligibleCount,
    firstReleaseCompleted: input.releaseBatchCount > 0,
    onboardingCompleted: input.onboardingCompleted,
    defaultCurrency: input.defaultCurrency,
    onboardingProgressPercent: progressPercent(checklist),
    phase,
    phaseLabel: label,
    checklist,
    activationBlockers,
    setupWarnings,
    primaryProjectId: input.primaryProjectId,
  };
}

export function merchantRowToRailFlags(merchant: {
  stripe_account_id: string | null;
  hedera_account_id: string | null;
  wise_enabled: boolean;
  wise_profile_id: string | null;
} | null) {
  const setup = computePaymentLinkRailSetup(merchant);
  return {
    stripeConfigured: setup.stripeConfigured,
    wiseConfigured: setup.wiseConfigured,
    hederaConfigured: setup.hederaConfigured,
  };
}
