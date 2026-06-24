/**
 * Canonical operational mutation kinds — single source for server orchestration
 * and client convergence tracing.
 */

export const OPERATIONAL_MUTATION_KINDS = [
  'agreement_approval',
  'participant_earnings_save',
  'funding_source_crud',
  'funding_update',
  'payout_verification',
  'attribution_update',
  'snapshot_persist',
  'release_batch_generated',
  'payout_released',
  'supplier_onboarding',
] as const;

export type OperationalMutationKind = (typeof OPERATIONAL_MUTATION_KINDS)[number];

/** Client-only trace kinds — not emitted by server orchestration. */
export const OPERATIONAL_CLIENT_TRACE_KINDS = [
  'obligation_generation',
  'other',
] as const;

export type OperationalClientTraceKind = (typeof OPERATIONAL_CLIENT_TRACE_KINDS)[number];

/** All mutation labels used by client convergence / telemetry. */
export type OperationalSyncMutationKind =
  | OperationalMutationKind
  | OperationalClientTraceKind;

export function isOperationalMutationKind(value: string): value is OperationalMutationKind {
  return (OPERATIONAL_MUTATION_KINDS as readonly string[]).includes(value);
}
