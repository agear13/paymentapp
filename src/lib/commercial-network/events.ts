/**
 * Commercial Network events.
 *
 * These are network-boundary events (shared workflow synchronization).
 * They are distinct from the Commercial Domain event bus
 * (`processCommercialEvent` in commercial-event-bus.ts), which owns
 * forecast / timeline / notification consequences inside Provvypay.
 *
 * Flow:
 *   Commercial Network Provider
 *       ↓
 *   Commercial Network Event
 *       ↓
 *   Event Dispatcher → Projection Service → Commercial Domain read models
 */

export const COMMERCIAL_NETWORK_EVENT_KINDS = [
  'AgreementCreated',
  'AgreementUpdated',
  'WorkflowTransitioned',
  'ParticipantApproved',
  'SettlementReady',
  'SettlementReleased',
  'CommercialForecastUpdated',
  'AutomationExecuted',
] as const;

export type CommercialNetworkEventKind = (typeof COMMERCIAL_NETWORK_EVENT_KINDS)[number];

export type CommercialNetworkEventBase = {
  /** Stable event id for idempotency. */
  eventId: string;
  kind: CommercialNetworkEventKind;
  /** ISO timestamp. */
  occurredAt: string;
  agreementId: string;
  organizationId?: string | null;
  participantId?: string;
  /** Provider that emitted the event. */
  providerId?: string;
  metadata?: Record<string, unknown>;
};

export type AgreementCreatedEvent = CommercialNetworkEventBase & {
  kind: 'AgreementCreated';
  name: string;
  payload?: Record<string, unknown>;
};

export type AgreementUpdatedEvent = CommercialNetworkEventBase & {
  kind: 'AgreementUpdated';
  name?: string;
  status?: string | null;
  payload?: Record<string, unknown>;
};

export type WorkflowTransitionedEvent = CommercialNetworkEventBase & {
  kind: 'WorkflowTransitioned';
  workflow: string;
  fromState?: string | null;
  toState: string;
};

export type ParticipantApprovedEvent = CommercialNetworkEventBase & {
  kind: 'ParticipantApproved';
  participantId: string;
  note?: string;
  approvedAt: string;
};

export type SettlementReadyEvent = CommercialNetworkEventBase & {
  kind: 'SettlementReady';
  settlementId?: string;
};

export type SettlementReleasedEvent = CommercialNetworkEventBase & {
  kind: 'SettlementReleased';
  settlementId?: string;
  amount?: number;
  currency?: string;
};

export type CommercialForecastUpdatedEvent = CommercialNetworkEventBase & {
  kind: 'CommercialForecastUpdated';
  /** Opaque forecast summary — domain re-derives full forecast. */
  summary?: Record<string, unknown>;
};

export type AutomationExecutedEvent = CommercialNetworkEventBase & {
  kind: 'AutomationExecuted';
  automationId?: string;
  actionKind?: string;
};

export type CommercialNetworkEvent =
  | AgreementCreatedEvent
  | AgreementUpdatedEvent
  | WorkflowTransitionedEvent
  | ParticipantApprovedEvent
  | SettlementReadyEvent
  | SettlementReleasedEvent
  | CommercialForecastUpdatedEvent
  | AutomationExecutedEvent;

/**
 * Input for createCommercialNetworkEvent — distributive over the event union
 * so kind-specific fields (name, workflow, approvedAt, …) type-check correctly.
 */
export type CommercialNetworkEventInput = {
  [K in CommercialNetworkEventKind]: Omit<
    Extract<CommercialNetworkEvent, { kind: K }>,
    'eventId'
  > & { eventId?: string };
}[CommercialNetworkEventKind];

/** Build a network event with a generated id when omitted. */
export function createCommercialNetworkEvent(
  event: CommercialNetworkEventInput
): CommercialNetworkEvent {
  const eventId =
    event.eventId ??
    `cne_${event.kind}_${event.agreementId}_${event.occurredAt}_${Math.random().toString(36).slice(2, 10)}`;
  return { ...event, eventId } as CommercialNetworkEvent;
}
