import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export type PersistenceBoundaryStage =
  | 'afterMapSinglePartyToParticipant'
  | 'afterMergeExtractedCompensationIntoExistingParticipant'
  | 'beforePersistPilotSnapshot'
  | 'insidePersistPilotSnapshotBeforeWrite'
  | 'afterReadSnapshotBack'
  | 'coordinationHydrationBeforeParticipantDiagnostics';

export type TrackedPersistenceParty = 'island_djs' | 'coastal_promotions';

export type ParticipantPersistenceSnap = {
  participantId: string;
  name: string;
  participationModel: string;
  commissionValue: number;
  compensationProfile: {
    compensationType?: string;
    fixedAmount?: number | null;
    percentage?: number | null;
    configured?: boolean;
    configuredAt?: string;
  } | null;
};

export type PersistenceBoundaryDiff = {
  changed: boolean;
  fields: Record<string, { from: unknown; to: unknown }>;
};

export type PersistenceBoundaryFirstLoss = {
  islandDjsFixedAmount2500: PersistenceBoundaryStage | null;
  coastalCompensationTypeRevenueShareToFixedFee: PersistenceBoundaryStage | null;
};

export type PersistenceBoundaryStageEvent = {
  sessionId: string;
  stage: PersistenceBoundaryStage;
  tracked: TrackedPersistenceParty;
  timestamp: string;
  participant: ParticipantPersistenceSnap;
  diffFromPrevious: PersistenceBoundaryDiff;
  firstLossInSession: PersistenceBoundaryFirstLoss;
  meta?: Record<string, unknown>;
};

export type PersistenceBoundarySession = {
  sessionId: string;
  label: string;
  startedAt: string;
  events: PersistenceBoundaryStageEvent[];
  lastByTracked: Partial<Record<TrackedPersistenceParty, ParticipantPersistenceSnap>>;
  firstLossInSession: PersistenceBoundaryFirstLoss;
};

const LOG_PREFIX = '[persistence-boundary]';

let sessionCounter = 0;
let activeSession: PersistenceBoundarySession | null = null;

export const persistenceBoundaryTracingEnabled =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_PERSISTENCE_BOUNDARY_TRACE !== '0'
    : true;

export function classifyTrackedPersistenceParty(name: string): TrackedPersistenceParty | null {
  const n = name.trim().toLowerCase();
  if (n.includes('island') && (n.includes('dj') || n.includes('djs'))) return 'island_djs';
  if (n.includes('coastal')) return 'coastal_promotions';
  return null;
}

export function snapParticipantForPersistenceBoundary(
  participant: DemoParticipant
): ParticipantPersistenceSnap {
  const profile = participant.compensationProfile;
  return {
    participantId: participant.id,
    name: participant.name,
    participationModel: participant.participationModel ?? '',
    commissionValue: participant.commissionValue,
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

function diffSnaps(
  prior: ParticipantPersistenceSnap | undefined,
  next: ParticipantPersistenceSnap
): PersistenceBoundaryDiff {
  if (!prior) {
    return { changed: true, fields: { _initial: { from: null, to: next } } };
  }
  const fields: Record<string, { from: unknown; to: unknown }> = {};
  const keys: (keyof ParticipantPersistenceSnap)[] = [
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
  tracked: TrackedPersistenceParty,
  stage: PersistenceBoundaryStage,
  snap: ParticipantPersistenceSnap,
  session: PersistenceBoundarySession
): PersistenceBoundaryFirstLoss {
  const next = { ...session.firstLossInSession };
  const fixedAmount = snap.compensationProfile?.fixedAmount ?? null;
  const compensationType = snap.compensationProfile?.compensationType ?? null;
  const prior = session.lastByTracked[tracked];

  if (tracked === 'island_djs' && next.islandDjsFixedAmount2500 == null) {
    const priorFixed = prior?.compensationProfile?.fixedAmount;
    const had2500 = priorFixed === 2500;
    const nowNull = fixedAmount == null;
    const nowNot2500 = fixedAmount !== 2500;
    if (had2500 && (nowNull || nowNot2500)) {
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

export function startPersistenceBoundarySession(label: string): string {
  sessionCounter += 1;
  const sessionId = `persist-boundary-${Date.now()}-${sessionCounter}`;
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

export function getActivePersistenceBoundarySession(): PersistenceBoundarySession | null {
  return activeSession;
}

function emitStageEvent(
  stage: PersistenceBoundaryStage,
  participant: DemoParticipant,
  meta?: Record<string, unknown>
): void {
  if (!persistenceBoundaryTracingEnabled || !activeSession) return;

  const tracked = classifyTrackedPersistenceParty(participant.name);
  if (!tracked) return;

  const snap = snapParticipantForPersistenceBoundary(participant);
  const prior = activeSession.lastByTracked[tracked];
  const diffFromPrevious = diffSnaps(prior, snap);
  const firstLossInSession = computeFirstLoss(tracked, stage, snap, activeSession);
  activeSession.firstLossInSession = firstLossInSession;
  activeSession.lastByTracked[tracked] = snap;

  const event: PersistenceBoundaryStageEvent = {
    sessionId: activeSession.sessionId,
    stage,
    tracked,
    timestamp: new Date().toISOString(),
    participant: snap,
    diffFromPrevious,
    firstLossInSession,
    meta,
  };
  activeSession.events.push(event);

  const payload = {
    label: activeSession.label,
    ...event,
    consoleSummary: {
      stage,
      tracked,
      participant: snap,
      diffFromPrevious,
      firstLossInSession,
    },
  };

  if (typeof console !== 'undefined') {
    console.info(LOG_PREFIX, JSON.stringify(payload, null, 2));
  }

  if (typeof window !== 'undefined') {
    const w = window as Window & {
      __PERSISTENCE_BOUNDARY_TRACES__?: PersistenceBoundarySession[];
    };
    const sessions = w.__PERSISTENCE_BOUNDARY_TRACES__ ?? [];
    const idx = sessions.findIndex((s) => s.sessionId === activeSession!.sessionId);
    if (idx >= 0) {
      sessions[idx] = activeSession!;
    } else {
      sessions.push(activeSession!);
    }
    w.__PERSISTENCE_BOUNDARY_TRACES__ = sessions;
  }
}

export function logPersistenceBoundaryParticipant(
  stage: PersistenceBoundaryStage,
  participant: DemoParticipant,
  meta?: Record<string, unknown>
): void {
  emitStageEvent(stage, participant, meta);
}

export function logPersistenceBoundaryParticipants(
  stage: PersistenceBoundaryStage,
  participants: DemoParticipant[],
  meta?: Record<string, unknown>
): void {
  for (const participant of participants) {
    if (classifyTrackedPersistenceParty(participant.name)) {
      emitStageEvent(stage, participant, meta);
    }
  }
}

/** Server / isomorphic logging (no window). */
export function logPersistenceBoundaryParticipantsFromList(
  stage: PersistenceBoundaryStage,
  participants: DemoParticipant[],
  meta?: Record<string, unknown>
): void {
  if (!persistenceBoundaryTracingEnabled) return;
  if (!activeSession) {
    startPersistenceBoundarySession(`server:${stage}`);
  }
  logPersistenceBoundaryParticipants(stage, participants, meta);
}
