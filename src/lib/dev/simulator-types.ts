/**
 * Developer Simulator — Type Definitions
 *
 * This module is DEVELOPMENT-ONLY infrastructure.
 * It must never be imported from production business logic.
 *
 * The simulator injects overrides into the Commercial Brain without
 * duplicating any engine logic. The engine still runs — overrides
 * are merged on top of its computed output.
 */

import type { CommercialCapabilities } from '@/components/workflow/commercial-decision-engine';
import type { WorkflowStage } from '@/components/workflow/workflow-context';

/* ─── Subscription plans ─── */

export type SimulatorPlan = 'starter' | 'professional' | 'growth' | 'enterprise';

/* ─── Payment provider state ─── */

export type SimulatorPaymentProvider = {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  restricted: boolean;
};

/* ─── Revenue state ─── */

export type SimulatorRevenue = {
  collectedRevenue: number;
  readyToRelease: number;
  outstanding: number;
  held: number;
};

/* ─── Participant approval state ─── */

export type SimulatorParticipantApprovalState =
  | 'not_sent'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'approved';

export type SimulatorParticipant = {
  id: string;
  name: string;
  role: string;
  approval: SimulatorParticipantApprovalState;
  earningsModel: string;
  inviteSentAt: string | null;
  agreementViewedAt: string | null;
  approvedAt: string | null;
};

/* ─── Agreement state ─── */

export type SimulatorAgreementStage =
  | 'collecting-approvals'
  | 'preparing-payments'
  | 'ready-to-collect'
  | 'collecting-revenue'
  | 'ready-to-release'
  | 'operational';

/* ─── Audit event types ─── */

export type SimulatorAuditEventType =
  | 'approval_generated'
  | 'stripe_connected'
  | 'revenue_received'
  | 'settlement_released'
  | 'agreement_created'
  | 'participant_added'
  | 'payment_received';

export type SimulatorAuditEntry = {
  id: string;
  eventType: SimulatorAuditEventType;
  label: string;
  timestamp: string;
};

/* ─── Master override object ─── */

/**
 * The complete dev simulator state. Every field is optional — unset fields
 * mean "use real persisted data" for that dimension.
 *
 * Stored in localStorage under `provvypay_dev_simulator`.
 * The Commercial Brain reads this on every render tick (dev builds only).
 */
export type DevSimulatorState = {
  /** Capability toggles — merged on top of the real analyseWorkspace() output */
  capabilities: Partial<CommercialCapabilities>;
  /** Subscription plan override — consumed by a useEntitlements() shim */
  plan: SimulatorPlan | null;
  /** Payment provider state — drives paymentProviderConnected + revenueCollectionEnabled */
  paymentProvider: SimulatorPaymentProvider | null;
  /** Revenue numbers — drive revenueFlowing + settlementReady */
  revenue: SimulatorRevenue | null;
  /** Per-participant overrides */
  participants: SimulatorParticipant[];
  /** Workflow stage pin — bypasses the derived stage */
  workflowStagePin: WorkflowStage | null;
  /** Simulated audit history entries */
  auditEntries: SimulatorAuditEntry[];
  /** Human-readable name of the active scenario (null = custom) */
  activeScenario: string | null;
};

export const EMPTY_SIMULATOR_STATE: DevSimulatorState = {
  capabilities: {},
  plan: null,
  paymentProvider: null,
  revenue: null,
  participants: [],
  workflowStagePin: null,
  auditEntries: [],
  activeScenario: null,
};
