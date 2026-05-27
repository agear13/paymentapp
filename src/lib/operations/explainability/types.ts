/**
 * Explainability types — human-facing operational cognition layer.
 * Consumed by UI; derived deterministically from operations domain inputs.
 */

import type { ReadinessLevel } from '@/lib/operations/types/readiness-result';
import type { RecommendedAction } from '@/lib/operations/types/readiness-result';

export type TrustLevel = 'healthy' | 'attention' | 'risk' | 'unknown';

export type ReleaseConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED';

export type StateExplanation = {
  stateKey: string;
  title: string;
  whatThisMeans: string;
  whyItMatters: string;
  whatUnlocksNext: string;
  blockingProgress: string[];
};

export type ExplainabilitySection = {
  headline: string;
  bullets: string[];
};

export type OperationalAction = {
  id: string;
  action: string;
  reason: string;
  impact: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  destination: string;
  ctaLabel?: string;
};

export type TrustSignal = {
  id: string;
  label: string;
  status: TrustLevel;
  detail?: string;
};

export type TimelineEventType =
  | 'workspace_created'
  | 'participant_invited'
  | 'compensation_configured'
  | 'provider_connected'
  | 'revenue_collected'
  | 'obligation_approved'
  | 'release_generated'
  | 'settlement_completed'
  | 'state_transition';

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

export type TransitionExplanation = {
  entityLabel: string;
  fromState: string;
  toState: string;
  title: string;
  reasons: string[];
};

export type ReleaseConfidenceSnapshot = {
  level: ReleaseConfidenceLevel;
  score: number;
  currency: string;
  collectedRevenue: number;
  reservedObligations: number;
  readyToRelease: number;
  heldBack: number;
  heldBackReasons: string[];
  blockedParticipantCount: number;
  riskWarnings: string[];
  releasableObligationCount: number;
  totalObligationCount: number;
  explainability: ExplainabilitySection;
};

export type OperationalExplainability = {
  readinessLevel: ReadinessLevel;
  readinessScore: number;
  blockers: string[];
  warnings: string[];
  confidence: ReleaseConfidenceLevel;
  missingRequirements: string[];
  nextRecommendedActions: RecommendedAction[];
  explainability: ExplainabilitySection;
  trustState: TrustLevel;
  phaseLabel: string;
  scopeTitle: string;
};

import type { OperationalReleaseBlockerDetail } from '@/lib/operations/explainability/derive-operational-release-blockers';

export type OperationalGuidanceBundle = {
  explanation: OperationalExplainability;
  stateExplanation: StateExplanation | null;
  actions: OperationalAction[];
  trustSignals: TrustSignal[];
  releaseConfidence: ReleaseConfidenceSnapshot;
  releaseBlockers: OperationalReleaseBlockerDetail[];
  timeline: TimelineEvent[];
  transition: TransitionExplanation | null;
  degraded: boolean;
};
