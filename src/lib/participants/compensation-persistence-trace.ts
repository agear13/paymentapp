import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import {
  inferCompensationConfiguredFromPersistence,
  isCompensationConfigured,
} from '@/lib/participants/participant-compensation';

export type CompensationPersistenceTraceContext = {
  participantId: string;
  projectId?: string;
  surface?: string;
};

/** Dev-only — compensation save → persistence → selector visibility pipeline. */
export function logCompensationPersistenceTrace(
  phase:
    | 'save-start'
    | 'save-success'
    | 'save-failure'
    | 'persisted-payload'
    | 'selector-recompute'
    | 'configured-transition'
    | 'readiness-recompute',
  context: CompensationPersistenceTraceContext,
  detail?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'production') return;

  console.groupCollapsed(`[compensation-persistence] ${phase}`);
  console.log('participantId', context.participantId);
  console.log('projectId', context.projectId ?? null);
  console.log('surface', context.surface ?? null);
  if (detail) console.log('detail', detail);
  console.groupEnd();
}

export function traceCompensationConfiguredState(
  participant: DemoParticipant | null | undefined,
  context: CompensationPersistenceTraceContext,
  label: string
): void {
  if (process.env.NODE_ENV === 'production' || !participant) return;

  const profile = participant.compensationProfile;
  logCompensationPersistenceTrace('selector-recompute', context, {
    label,
    profileConfigured: profile?.configured ?? null,
    configuredAt: profile?.configuredAt ?? null,
    compensationType: profile?.compensationType ?? null,
    percentage: profile?.percentage ?? null,
    fixedAmount: profile?.fixedAmount ?? null,
    commissionValue: participant.commissionValue ?? null,
    commissionKind: participant.commissionKind ?? null,
    inferConfigured: inferCompensationConfiguredFromPersistence(participant),
    isConfigured: isCompensationConfigured(participant),
  });
}

export function traceCompensationSavePayload(
  profile: ParticipantCompensationProfile,
  context: CompensationPersistenceTraceContext
): void {
  logCompensationPersistenceTrace('persisted-payload', context, {
    compensationType: profile.compensationType,
    configured: profile.configured,
    configuredAt: profile.configuredAt,
    percentage: profile.percentage,
    fixedAmount: profile.fixedAmount,
    customerAttributionEnabled: profile.customerAttributionEnabled,
    commissionSourceMode: profile.commissionSourceMode,
    commissionServiceIds: profile.commissionServiceIds,
    exemptFromPayout: profile.exemptFromPayout,
  });
}
