import type { OperationalEvent, OperationalEventType } from '@/lib/operations/contracts/operational-events';
import type { ConversationImportAuditPayload } from '@/lib/operations/audit/conversation-import-audit-types';

export const OPERATIONAL_AUDIT_EVENT_TYPES = [
  'agreement_shared',
  'agreement_viewed',
  'agreement_approved',
  'participant_note_added',
  'funding_linked',
  'funding_reserved_against_obligations',
  'obligations_generated',
  'obligations_funded',
  'payout_eligible',
  'release_batch_generated',
  'compensation_updated',
  'attribution_configured',
  'payout_state_updated',
  'workspace_created',
  'project_initialized',
  'payment_rails_connected',
  'stripe_connected',
  'operational_graph_initialized',
  'settlement_infrastructure_ready',
  'operational_graph_initialization_failed',
  'conversation_imported',
] as const;

export type OperationalAuditEventType = (typeof OPERATIONAL_AUDIT_EVENT_TYPES)[number];

export type OperationalAuditEntry = {
  id: string;
  type: OperationalAuditEventType;
  title: string;
  description: string;
  timestamp: string;
  projectId?: string;
  participantId?: string;
  actor?: string;
  /** Full conversation import audit payload — persisted via deal snapshot. */
  conversationImport?: ConversationImportAuditPayload;
};

const EVENT_TO_AUDIT: Partial<Record<OperationalEventType, OperationalAuditEventType>> = {
  AGREEMENT_SHARED: 'agreement_shared',
  AGREEMENT_VIEWED: 'agreement_viewed',
  AGREEMENT_APPROVED: 'agreement_approved',
  FUNDING_SOURCE_UPDATED: 'funding_linked',
  FUNDING_ALLOCATION_RESERVED: 'funding_reserved_against_obligations',
  PARTICIPANT_COMPENSATION_UPDATED: 'compensation_updated',
  ATTRIBUTION_CONFIGURATION_UPDATED: 'attribution_configured',
  PAYOUT_STATE_UPDATED: 'payout_state_updated',
  OBLIGATION_STATE_UPDATED: 'obligations_generated',
  WORKSPACE_BOOTSTRAPPED: 'workspace_created',
  PROJECT_BOOTSTRAPPED: 'project_initialized',
  PAYMENT_RAIL_INITIALIZED: 'payment_rails_connected',
  STRIPE_CONNECT_COMPLETED: 'stripe_connected',
  OPERATIONAL_GRAPH_INITIALIZED: 'operational_graph_initialized',
  SETTLEMENT_INFRASTRUCTURE_READY: 'settlement_infrastructure_ready',
};

const AUDIT_TITLES: Record<OperationalAuditEventType, string> = {
  agreement_shared: 'Agreement shared for approval',
  agreement_viewed: 'Agreement viewed by participant',
  agreement_approved: 'Participation agreement approved',
  participant_note_added: 'Participant note received',
  funding_linked: 'Funding source updated',
  funding_reserved_against_obligations: 'Funding reserved against obligations',
  obligations_generated: 'Obligations regenerated',
  obligations_funded: 'Obligations funded',
  payout_eligible: 'Participant payout eligible',
  release_batch_generated: 'Release batch generated',
  compensation_updated: 'Participant compensation updated',
  attribution_configured: 'Attribution configuration updated',
  payout_state_updated: 'Payout state updated',
  workspace_created: 'Workspace created',
  project_initialized: 'Project initialized',
  payment_rails_connected: 'Payment rails connected',
  stripe_connected: 'Stripe connected',
  operational_graph_initialized: 'Operational graph initialized',
  settlement_infrastructure_ready: 'Settlement infrastructure ready',
  operational_graph_initialization_failed: 'Operational graph initialization failed',
  conversation_imported: 'Conversation imported',
};

export function auditEntryFromOperationalEvent(event: OperationalEvent): OperationalAuditEntry | null {
  const auditType = EVENT_TO_AUDIT[event.type];
  if (!auditType) return null;
  return {
    id: `${auditType}-${event.timestamp}-${event.participantId ?? event.projectId ?? 'workspace'}`,
    type: auditType,
    title: AUDIT_TITLES[auditType],
    description: describeAuditEvent(auditType, event),
    timestamp: event.timestamp,
    projectId: event.projectId,
    participantId: event.participantId,
    actor: event.payload?.actor as string | undefined,
  };
}

function describeAuditEvent(type: OperationalAuditEventType, event: OperationalEvent): string {
  const note = event.payload?.note as string | undefined;
  switch (type) {
    case 'agreement_approved':
      return note?.trim()
        ? `Participant approved with note: "${note.trim()}"`
        : 'Participant approved participation agreement.';
    case 'obligations_generated':
      return `Obligation count: ${event.payload?.obligationCount ?? 'updated'}`;
    case 'funding_linked':
      return 'Funding source changed — obligations and readiness recomputed.';
    case 'funding_reserved_against_obligations':
      return 'Funding allocated and reserved against payout obligations.';
    case 'compensation_updated':
      return 'Earnings configuration saved — obligations regenerated.';
    default:
      return AUDIT_TITLES[type];
  }
}

export function mergeAuditTimeline(
  existing: OperationalAuditEntry[],
  incoming: OperationalAuditEntry[]
): OperationalAuditEntry[] {
  const byId = new Map<string, OperationalAuditEntry>();
  for (const e of [...existing, ...incoming]) {
    byId.set(e.id, e);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
