import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { EventDerivedBlocker } from '@/lib/operations/timeline/types';
import type { OperationalReadinessState } from '@/lib/operations/coordination/types';
import type { OperationalTimelineProjection } from '@/lib/operations/timeline/types';
import { assertObligationProjectionInvariants } from '@/lib/operations/dev/operational-invariants';

export type SafeObligationsProjection = {
  showInitializationShell: boolean;
  canLoadObligations: boolean;
  headline: string;
  guidance: string;
  nextActions: OperationalAction[];
  blockers: EventDerivedBlocker[];
  degraded: boolean;
};

export type SafeObligationsProjectionInput = {
  readiness: OperationalReadinessState;
  settlementShowShell: boolean;
  timelineProjection: OperationalTimelineProjection;
  nextActions: OperationalAction[];
  loadError?: string | null;
  obligationsAvailable: boolean;
};

/**
 * Canonical obligations page presentation — never hard-fails during convergence.
 */
export function safeObligationsProjection(
  input: SafeObligationsProjectionInput
): SafeObligationsProjection {
  const { readiness, timelineProjection } = input;
  const showInitializationShell = input.settlementShowShell;
  const canLoadObligations =
    readiness.settlementInfrastructureReady && !showInitializationShell;

  let headline = readiness.headline;
  let guidance = readiness.guidance;
  const blockers = [...timelineProjection.blockers];

  if (input.loadError && canLoadObligations) {
    headline = 'Obligation lines synchronizing';
    guidance =
      'Participant payout lines are reconciling with the operational graph. Your data is safe — refresh once coordination converges.';
  } else if (!canLoadObligations) {
    headline = readiness.headline;
    guidance =
      readiness.releaseInteraction.interactionGuidance ??
      'Settlement coordination is preparing obligation projections.';
  } else if (!input.obligationsAvailable && !input.loadError) {
    headline = 'No payout lines in view yet';
    guidance =
      'Participant payout obligations appear as earnings, agreements, and funding converge in the operational graph.';
  }

  const degraded =
    showInitializationShell ||
    Boolean(input.loadError) ||
    timelineProjection.degraded ||
    !readiness.canProjectGuidance;

  const projection: SafeObligationsProjection = {
    showInitializationShell,
    canLoadObligations,
    headline,
    guidance,
    nextActions: input.nextActions,
    blockers,
    degraded,
  };

  assertObligationProjectionInvariants({
    fatalDuringExpectedDegradedState: false,
    projectionThrewDuringConvergence: false,
  });

  return projection;
}
