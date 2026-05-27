import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { ReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';
import type { OperationalOnboardingPhase } from '@/lib/operations/onboarding/operational-onboarding-phases';

export type OperationalReadinessPhase =
  | 'activation_loading'
  | 'settlement_initializing'
  | 'graph_converging'
  | 'coordination_active'
  | 'release_ready';

/** Canonical operational readiness — all pages derive projection gates from this shape. */
export type OperationalReadinessState = {
  phase: OperationalReadinessPhase;
  graphReadyForProjection: boolean;
  graphSnapshotConverged: boolean;
  canProjectGuidance: boolean;
  settlementInfrastructureReady: boolean;
  releaseInteraction: ReleaseInteractionState;
  headline: string;
  guidance: string;
};

export type SettlementInitializationState = {
  showInitializationShell: boolean;
  allowChildProjections: boolean;
  headline: string;
  recoveryMessage: string | null;
  progressSteps: Array<{ id: string; label: string; complete: boolean }>;
  blockers: string[];
  nextActions: OperationalAction[];
};

export type OperationalOnboardingStage = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
  releaseImpact?: string;
};

/** Canonical onboarding progression derived from graph + workspace context only. */
export type OperationalOnboardingProgress = {
  currentStage: OperationalOnboardingPhase | 'COORDINATION_ACTIVE';
  completionPercent: number;
  headline: string;
  blockers: string[];
  requiredActions: OperationalAction[];
  optionalActions: OperationalAction[];
  stages: OperationalOnboardingStage[];
  releaseImpact: string | null;
};
