import type { OperationalEvent, OperationalEventType } from '@/lib/operations/contracts/operational-events';
import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';
import type { TimelineEvent } from '@/lib/operations/explainability/types';

/** Replay-safe canonical event — all timeline projections derive from this shape. */
export type CanonicalOperationalEvent = OperationalEvent & {
  sequence: number;
  dedupeKey: string;
  correlationId?: string;
};

export type OnboardingMilestoneProjection = {
  id: string;
  label: string;
  eventType: OperationalEventType;
  complete: boolean;
  timestamp: string | null;
  releaseImpact?: string;
};

export type EventDerivedBlocker = {
  id: string;
  category: string;
  reason: string;
  remediation: string;
  missingEventType?: OperationalEventType;
  severity: 'blocking' | 'warning';
};

export type OperationalConfidenceScore = {
  level: ReleaseConfidenceLevel;
  score: number;
  coveragePercent: number;
  observedCriticalEvents: number;
  totalCriticalEvents: number;
  explainability: {
    headline: string;
    bullets: string[];
  };
};

/** Full event-layer projection consumed by guidance and UI surfaces. */
export type OperationalTimelineProjection = {
  canonicalEvents: CanonicalOperationalEvent[];
  milestones: OnboardingMilestoneProjection[];
  timeline: TimelineEvent[];
  confidence: OperationalConfidenceScore;
  blockers: EventDerivedBlocker[];
  replayFingerprint: string;
  degraded: boolean;
};

export type OperationalTimelineReducerState = {
  observedTypes: Set<OperationalEventType>;
  milestoneTimestamps: Map<string, string>;
  lastEventAt: string | null;
};
