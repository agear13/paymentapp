import type { OperationalEvent, OperationalEventType } from '@/lib/operations/contracts/operational-events';

export const OPERATIONAL_INITIALIZATION_EVENT_TYPES = [
  'WORKSPACE_BOOTSTRAPPED',
  'PROJECT_BOOTSTRAPPED',
  'PAYMENT_RAIL_INITIALIZED',
  'STRIPE_CONNECT_COMPLETED',
  'OPERATIONAL_GRAPH_INITIALIZED',
  'SETTLEMENT_INFRASTRUCTURE_READY',
] as const;

export type OperationalInitializationEventType =
  (typeof OPERATIONAL_INITIALIZATION_EVENT_TYPES)[number];

export function operationalInitializationEvent(
  type: OperationalInitializationEventType,
  input: { projectId?: string; organizationId?: string; correlationId?: string; payload?: Record<string, unknown> }
): OperationalEvent {
  return {
    type: type as OperationalEventType,
    projectId: input.projectId,
    timestamp: new Date().toISOString(),
    source: 'server',
    payload: {
      organizationId: input.organizationId,
      correlationId: input.correlationId,
      ...input.payload,
    },
  };
}
