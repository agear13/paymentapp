import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantEarningsPersistenceDiagnostic } from '@/lib/operations/dev/participant-earnings-persistence-diagnostic';

export type OnboardingPipelineStage =
  | 'mapReviewToParticipants'
  | 'onCompletePayload'
  | 'clientPostPayload'
  | 'apiRequestBodyReceived'
  | 'storageWrite'
  | 'storageReadBack'
  | 'coordinationSnapshotParticipant'
  | 'participantDiagnosticsInput';

export type TrackedOnboardingParty = 'island_djs' | 'coastal_promotions';

export type OnboardingPipelineSnap = {
  participantId: string | null;
  name: string;
  participationModel: string | null;
  commissionValue: number | null;
  compensationProfile: {
    compensationType?: string;
    fixedAmount?: number | null;
    percentage?: number | null;
    configured?: boolean;
    configuredAt?: string;
  } | null;
};

export type OnboardingPipelineDiff = {
  changed: boolean;
  fields: Record<string, { from: unknown; to: unknown }>;
};

export type OnboardingPipelineFirstLoss = {
  islandDjsFixedAmount2500: OnboardingPipelineStage | null;
  coastalCompensationTypeRevenueShareToFixedFee: OnboardingPipelineStage | null;
};

export type OnboardingPipelineEvent = {
  sessionId: string;
  stage: OnboardingPipelineStage;
  tracked: TrackedOnboardingParty;
  timestamp: string;
  participant: OnboardingPipelineSnap;
  diffFromPrevious: OnboardingPipelineDiff;
  firstLossInSession: OnboardingPipelineFirstLoss;
  meta?: Record<string, unknown>;
};

export type OnboardingPipelineSession = {
  sessionId: string;
  label: string;
  startedAt: string;
  events: OnboardingPipelineEvent[];
  lastByTracked: Partial<Record<TrackedOnboardingParty, OnboardingPipelineSnap>>;
  firstLossInSession: OnboardingPipelineFirstLoss;
};

const LOG_PREFIX = '[onboarding-pipeline]';

let sessionCounter = 0;
let activeSession: OnboardingPipelineSession | null = null;

export const onboardingPipelineTracingEnabled =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ONBOARDING_PIPELINE_TRACE !== '0'
    : true;

export function classifyTrackedOnboardingParty(name: string): TrackedOnboardingParty | null {
  const n = name.trim().toLowerCase();
  if (n.includes('island') && (n.includes('dj') || n.includes('djs'))) return 'island_djs';
  if (n.includes('coastal')) return 'coastal_promotions';
  return null;
}

export function snapDemoParticipant(participant: DemoParticipant): OnboardingPipelineSnap {
  const profile = participant.compensationProfile;
  return {
    participantId: participant.id,
    name: participant.name,
    participationModel: participant.participationModel ?? null,
    commissionValue: participant.commissionValue ?? null,
    compensationProfile: profile
      ? {
          compensationType: profile.compensationType,
          fixedAmount: profile.fixedAmount ?? null,
          percentage: profile.percentage ?? null,
          configured: profile.configured,
          configuredAt: profile.configuredAt,
        }
      : null,
  };
}

export function snapDraftParticipant(input: {
  name: string;
  email?: string;
  role: string;
}): OnboardingPipelineSnap {
  return {
    participantId: null,
    name: input.name,
    participationModel: null,
    commissionValue: null,
    compensationProfile: null,
  };
}

export function snapDiagnosticInput(
  diagnostic: ParticipantEarningsPersistenceDiagnostic
): OnboardingPipelineSnap {
  return {
    participantId: diagnostic.participantId,
    name: diagnostic.name ?? '',
    participationModel: null,
    commissionValue: diagnostic.persisted.commissionValue,
    compensationProfile: {
      compensationType: diagnostic.persisted.compensationType ?? undefined,
      fixedAmount: diagnostic.persisted.fixedAmount,
      percentage: diagnostic.persisted.percentage,
      configured: diagnostic.configuredFlag ?? undefined,
      configuredAt: diagnostic.configuredAt ?? undefined,
    },
  };
}

function diffSnaps(
  prior: OnboardingPipelineSnap | undefined,
  next: OnboardingPipelineSnap
): OnboardingPipelineDiff {
  if (!prior) {
    return { changed: true, fields: { _initial: { from: null, to: next } } };
  }
  const fields: Record<string, { from: unknown; to: unknown }> = {};
  const keys: (keyof OnboardingPipelineSnap)[] = [
    'participantId',
    'name',
    'participationModel',
    'commissionValue',
    'compensationProfile',
  ];
  for (const key of keys) {
    const from = prior[key];
    const to = next[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      fields[key] = { from, to };
    }
  }
  return { changed: Object.keys(fields).length > 0, fields };
}

function computeFirstLoss(
  tracked: TrackedOnboardingParty,
  stage: OnboardingPipelineStage,
  snap: OnboardingPipelineSnap,
  session: OnboardingPipelineSession
): OnboardingPipelineFirstLoss {
  const next = { ...session.firstLossInSession };
  const fixedAmount = snap.compensationProfile?.fixedAmount ?? null;
  const compensationType = snap.compensationProfile?.compensationType ?? null;
  const prior = session.lastByTracked[tracked];

  if (tracked === 'island_djs' && next.islandDjsFixedAmount2500 == null) {
    const priorFixed = prior?.compensationProfile?.fixedAmount;
    if (priorFixed === 2500 && fixedAmount !== 2500) {
      next.islandDjsFixedAmount2500 = stage;
    }
  }

  if (tracked === 'coastal_promotions' && next.coastalCompensationTypeRevenueShareToFixedFee == null) {
    const priorType = prior?.compensationProfile?.compensationType;
    if (priorType === 'REVENUE_SHARE' && compensationType === 'FIXED_FEE') {
      next.coastalCompensationTypeRevenueShareToFixedFee = stage;
    }
  }

  return next;
}

export function startOnboardingPipelineSession(label: string): string {
  sessionCounter += 1;
  const sessionId = `onboarding-pipeline-${Date.now()}-${sessionCounter}`;
  activeSession = {
    sessionId,
    label,
    startedAt: new Date().toISOString(),
    events: [],
    lastByTracked: {},
    firstLossInSession: {
      islandDjsFixedAmount2500: null,
      coastalCompensationTypeRevenueShareToFixedFee: null,
    },
  };
  return sessionId;
}

export function getActiveOnboardingPipelineSession(): OnboardingPipelineSession | null {
  return activeSession;
}

function emitSnap(
  stage: OnboardingPipelineStage,
  snap: OnboardingPipelineSnap,
  meta?: Record<string, unknown>
): void {
  if (!onboardingPipelineTracingEnabled) return;

  const tracked = classifyTrackedOnboardingParty(snap.name);
  if (!tracked) return;

  if (!activeSession) {
    startOnboardingPipelineSession(`auto:${stage}`);
  }

  const session = activeSession!;
  const prior = session.lastByTracked[tracked];
  const diffFromPrevious = diffSnaps(prior, snap);
  const firstLossInSession = computeFirstLoss(tracked, stage, snap, session);
  session.firstLossInSession = firstLossInSession;
  session.lastByTracked[tracked] = snap;

  const event: OnboardingPipelineEvent = {
    sessionId: session.sessionId,
    stage,
    tracked,
    timestamp: new Date().toISOString(),
    participant: snap,
    diffFromPrevious,
    firstLossInSession,
    meta,
  };
  session.events.push(event);

  const payload = {
    label: session.label,
    ...event,
  };

  if (typeof console !== 'undefined') {
    console.info(LOG_PREFIX, JSON.stringify(payload, null, 2));
  }

  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __ONBOARDING_PIPELINE_TRACES__?: OnboardingPipelineSession[];
    };
    const sessions = w.__ONBOARDING_PIPELINE_TRACES__ ?? [];
    const idx = sessions.findIndex((s) => s.sessionId === session.sessionId);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.push(session);
    }
    w.__ONBOARDING_PIPELINE_TRACES__ = sessions;
  }
}

export function logOnboardingPipelineDemoParticipants(
  stage: OnboardingPipelineStage,
  participants: DemoParticipant[],
  meta?: Record<string, unknown>
): void {
  for (const p of participants) {
    if (classifyTrackedOnboardingParty(p.name)) {
      emitSnap(stage, snapDemoParticipant(p), meta);
    }
  }
}

export function logOnboardingPipelineDrafts(
  stage: OnboardingPipelineStage,
  drafts: Array<{ name: string; email?: string; role: string }>,
  meta?: Record<string, unknown>
): void {
  for (const d of drafts) {
    if (classifyTrackedOnboardingParty(d.name)) {
      emitSnap(stage, snapDraftParticipant(d), meta);
    }
  }
}

export function logOnboardingPipelineDiagnostic(
  stage: OnboardingPipelineStage,
  diagnostic: ParticipantEarningsPersistenceDiagnostic,
  meta?: Record<string, unknown>
): void {
  if (!classifyTrackedOnboardingParty(diagnostic.name ?? '')) return;
  emitSnap(stage, snapDiagnosticInput(diagnostic), meta);
}

/** Server routes: ensure a session exists for logging. */
export function ensureOnboardingPipelineSessionForServer(label: string): void {
  if (!onboardingPipelineTracingEnabled) return;
  if (!activeSession) {
    startOnboardingPipelineSession(label);
  }
}
