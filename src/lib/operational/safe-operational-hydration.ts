/**
 * @deprecated Import from `@/lib/operations/guards` — compatibility re-exports.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  deriveParticipantCapabilityFlags,
  deriveParticipantState,
  draftParticipantDefaults,
  draftProjectDefaults,
  normalizeParticipantEntity,
  safeCompensationState,
  safeProjectState,
} from '@/lib/operations/guards/hydration-guards';
import { defaultCompensationProfile } from '@/lib/participants/participant-compensation';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';

export type SafeCompensationView = {
  status: ReturnType<typeof safeCompensationState>;
  profile: ParticipantCompensationProfile | null;
  readiness: 'complete' | 'incomplete';
  issues: string[];
};

export type SafeParticipantReadiness = {
  participantId: string;
  name: string;
  operationalStatus: string;
  payoutReady: boolean;
  readinessLevel: 'none' | 'partial' | 'ready';
  compensationConfigured: boolean;
  payoutDestinationConfigured: boolean;
  onboardingComplete: boolean;
  obligationsLinked: boolean;
  providerConnected: boolean;
  issues: string[];
  primaryIssue: string | null;
};

export function normalizeParticipant(participant: DemoParticipant | null | undefined) {
  return normalizeParticipantEntity(participant);
}

export function safeCompensationProfile(
  participant: DemoParticipant | null | undefined
): SafeCompensationView {
  const status = safeCompensationState(participant);
  return {
    status,
    profile: participant?.compensationProfile ?? null,
    readiness: status === 'CONFIGURED' ? 'complete' : 'incomplete',
    issues: status === 'CONFIGURED' ? [] : ['Compensation structure missing'],
  };
}

export function safeParticipantReadiness(
  participant: DemoParticipant | null | undefined,
  context?: { providerConnected?: boolean; obligationsLinked?: boolean }
): SafeParticipantReadiness {
  const p = normalizeParticipantEntity(participant);
  const flags = deriveParticipantCapabilityFlags(p);
  const issues: string[] = [];
  if (!flags.hasCompensation) issues.push('Compensation structure missing');
  if (!flags.hasPayoutDestination) issues.push('No payout destination configured');
  return {
    participantId: p.id,
    name: p.name,
    operationalStatus: deriveParticipantState(p),
    payoutReady: flags.payoutReady,
    readinessLevel: flags.payoutReady ? 'ready' : issues.length ? 'partial' : 'none',
    compensationConfigured: flags.hasCompensation,
    payoutDestinationConfigured: flags.hasPayoutDestination,
    onboardingComplete: flags.hasPayoutDestination,
    obligationsLinked: context?.obligationsLinked ?? false,
    providerConnected: context?.providerConnected ?? false,
    issues,
    primaryIssue: issues[0] ?? null,
  };
}

export function safeProjectOperationalState(
  project: RecentDeal | null | undefined,
  participants: DemoParticipant[] = [],
  options?: { providerConnected?: boolean; revenueConfigured?: boolean; obligationCount?: number }
) {
  const state = safeProjectState(project);
  const normalized = participants.map(normalizeParticipantEntity);
  return {
    setupStatus: state === 'CONFIGURING' ? 'configuring' : state.toLowerCase(),
    completeness: {
      participantsAdded: normalized.length > 0,
      compensationConfigured:
        normalized.length > 0 &&
        normalized.every((p) => deriveParticipantCapabilityFlags(p).hasCompensation),
      revenueConfigured: options?.revenueConfigured ?? false,
      obligationsConfigured: (options?.obligationCount ?? 0) > 0,
      payoutDestinationsConfigured:
        normalized.length > 0 &&
        normalized.every((p) => deriveParticipantCapabilityFlags(p).hasPayoutDestination),
      providerConnected: options?.providerConnected ?? false,
    },
    isDraft: state === 'DRAFT' || state === 'CONFIGURING',
    guidance:
      state === 'CONFIGURING' ? 'This project is still being configured.' : null,
  };
}

export const draftParticipantBootstrap = draftParticipantDefaults;
export const draftProjectBootstrap = draftProjectDefaults;

export function safeDefaultCompensationProfile(participant: DemoParticipant | null | undefined) {
  try {
    return defaultCompensationProfile(normalizeParticipantEntity(participant));
  } catch {
    return { compensationType: 'FIXED_FEE' as const, configured: false, revenueSources: [] };
  }
}
