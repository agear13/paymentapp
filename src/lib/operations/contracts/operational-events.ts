/**
 * Canonical operational events — event-driven synchronization across the payout ecosystem.
 */

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
] as const;

export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number];

export type OperationalEvent = {
  type: OperationalEventType;
  projectId?: string;
  participantId?: string;
  timestamp: string;
  source: 'server' | 'client';
  payload?: Record<string, unknown>;
};

export type OperationalMutationKind =
  | 'agreement_approval'
  | 'participant_earnings_save'
  | 'funding_update'
  | 'payout_verification'
  | 'attribution_update'
  | 'snapshot_persist'
  | 'release_batch_generated'
  | 'payout_released';

export const MUTATION_TO_OPERATIONAL_EVENT: Record<OperationalMutationKind, OperationalEventType> = {
  agreement_approval: 'AGREEMENT_APPROVED',
  participant_earnings_save: 'PARTICIPANT_COMPENSATION_UPDATED',
  funding_update: 'FUNDING_ALLOCATION_RESERVED',
  payout_verification: 'PAYOUT_STATE_UPDATED',
  attribution_update: 'ATTRIBUTION_CONFIGURATION_UPDATED',
  snapshot_persist: 'SNAPSHOT_PERSISTED',
  release_batch_generated: 'RELEASE_BATCH_GENERATED',
  payout_released: 'PAYOUT_STATE_UPDATED',
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
