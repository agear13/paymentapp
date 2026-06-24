/**
 * Canonical operational events — event-driven synchronization across the payout ecosystem.
 */

import type { OperationalMutationKind } from '@/lib/operations/orchestration/operational-mutation-kind';

export const OPERATIONAL_EVENT_TYPES = [
  'FUNDING_SOURCE_UPDATED',
  'FUNDING_ALLOCATION_RESERVED',
  'WORKSPACE_BOOTSTRAPPED',
  'PROJECT_BOOTSTRAPPED',
  'PAYMENT_RAIL_INITIALIZED',
  'STRIPE_CONNECT_COMPLETED',
  'OPERATIONAL_GRAPH_INITIALIZED',
  'SETTLEMENT_INFRASTRUCTURE_READY',
  'PARTICIPANT_COMPENSATION_UPDATED',
  'AGREEMENT_APPROVED',
  'AGREEMENT_SHARED',
  'AGREEMENT_VIEWED',
  'ATTRIBUTION_CONFIGURATION_UPDATED',
  'PAYOUT_STATE_UPDATED',
  'OBLIGATION_STATE_UPDATED',
  'SNAPSHOT_PERSISTED',
  'SYNCHRONIZATION_COMPLETED',
  'RELEASE_BATCH_GENERATED',
  'SUPPLIER_ONBOARDING_STARTED',
] as const;

export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number];

export type OperationalEvent = {
  type: OperationalEventType;
  projectId?: string;
  participantId?: string;
  timestamp: string;
  source: 'server' | 'client';
  /** When true, subscribers append audit only — do not re-run convergence. */
  notificationOnly?: boolean;
  payload?: Record<string, unknown>;
  /** Replay-safe correlation identifier when emitted by orchestration. */
  correlationId?: string;
  /** Assigned during deterministic replay — do not set at mutation sites. */
  sequence?: number;
  /** Stable dedupe key — assigned during replay normalization. */
  dedupeKey?: string;
};

export type { OperationalMutationKind } from '@/lib/operations/orchestration/operational-mutation-kind';

export const MUTATION_TO_OPERATIONAL_EVENT: Record<OperationalMutationKind, OperationalEventType> = {
  agreement_approval: 'AGREEMENT_APPROVED',
  participant_earnings_save: 'PARTICIPANT_COMPENSATION_UPDATED',
  funding_source_crud: 'FUNDING_SOURCE_UPDATED',
  funding_update: 'FUNDING_ALLOCATION_RESERVED',
  payout_verification: 'PAYOUT_STATE_UPDATED',
  attribution_update: 'ATTRIBUTION_CONFIGURATION_UPDATED',
  snapshot_persist: 'SNAPSHOT_PERSISTED',
  release_batch_generated: 'RELEASE_BATCH_GENERATED',
  payout_released: 'PAYOUT_STATE_UPDATED',
  supplier_onboarding: 'SUPPLIER_ONBOARDING_STARTED',
};

export function operationalEventFromMutation(
  mutation: OperationalMutationKind,
  input: { projectId?: string; participantId?: string; payload?: Record<string, unknown> }
): OperationalEvent {
  return {
    type: MUTATION_TO_OPERATIONAL_EVENT[mutation],
    projectId: input.projectId,
    participantId: input.participantId,
    timestamp: new Date().toISOString(),
    source: 'server',
    payload: input.payload,
  };
}
