/**
 * Commercial Network Layer — shared types.
 *
 * Provvypay remains the Commercial Operating System.
 * Commercial Networks synchronize shared commercial state only.
 * Providers never own forecasting, automation, accounting, AI, reporting, or UI.
 */

import type { CommercialNetworkEvent } from '@/lib/commercial-network/events';

/* ─── Provider identity ───────────────────────────────────────────────────── */

export const COMMERCIAL_NETWORK_PROVIDERS = [
  'local',
  'canton',
  'azure',
  'hyperledger',
] as const;

export type CommercialNetworkProviderId = (typeof COMMERCIAL_NETWORK_PROVIDERS)[number];

export const COMMERCIAL_NETWORK_PROVIDER_LABELS: Record<CommercialNetworkProviderId, string> = {
  local: 'Local',
  canton: 'Canton',
  azure: 'Azure',
  hyperledger: 'Hyperledger',
};

/** Providers that are registered and selectable today. */
export const AVAILABLE_COMMERCIAL_NETWORK_PROVIDERS = ['local', 'canton'] as const;
export type AvailableCommercialNetworkProviderId =
  (typeof AVAILABLE_COMMERCIAL_NETWORK_PROVIDERS)[number];

/* ─── Organisation / project network configuration ────────────────────────── */

/**
 * Organisation-level Commercial Network selection.
 *
 * Example (configuration only — no UI in this milestone):
 *   Commercial Network
 *   ○ Local
 *   ○ Canton
 */
export type CommercialNetworkConfig = {
  /** Which network implementation synchronizes shared commercial state. */
  provider: AvailableCommercialNetworkProviderId;
  /** Optional project-level override. When set, takes precedence for that project. */
  projectOverrides?: Record<string, AvailableCommercialNetworkProviderId>;
  /** Opaque provider-specific options (ledger party IDs, endpoints, etc.). */
  options?: Record<string, unknown>;
};

export const DEFAULT_COMMERCIAL_NETWORK_CONFIG: CommercialNetworkConfig = {
  provider: 'local',
};

/* ─── Shared commercial agreement (network view) ──────────────────────────── */

/**
 * Network-facing agreement snapshot.
 * Deliberately thin — Commercial Domain owns rich business models.
 */
export type SharedCommercialAgreement = {
  agreementId: string;
  organizationId: string | null;
  /** Operator / owner scope used by the Local provider today. */
  ownerUserId?: string | null;
  name: string;
  partner?: string | null;
  status?: string | null;
  /** Opaque payload synchronized by the network (Local stores deal_payload shape). */
  payload: Record<string, unknown>;
  updatedAt: string;
};

export type SharedCommercialParticipant = {
  participantId: string;
  agreementId: string;
  name: string;
  email?: string | null;
  role?: string | null;
  approvalStatus: 'Pending approval' | 'Approved' | string;
  approvedAt?: string | null;
  /** Opaque participant payload (Local stores participant_payload shape). */
  payload: Record<string, unknown>;
  updatedAt: string;
};

export type SharedCommercialSnapshot = {
  agreements: SharedCommercialAgreement[];
  participants: SharedCommercialParticipant[];
};

/* ─── Commands ────────────────────────────────────────────────────────────── */

export type CreateSharedAgreementCommand = {
  agreementId: string;
  organizationId: string | null;
  ownerUserId?: string | null;
  name: string;
  partner?: string | null;
  status?: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
};

export type UpdateSharedAgreementCommand = {
  agreementId: string;
  organizationId?: string | null;
  ownerUserId?: string | null;
  name?: string;
  partner?: string | null;
  status?: string | null;
  payload?: Record<string, unknown>;
  /** When true, merge payload keys; when false, replace payload. Default: true. */
  mergePayload?: boolean;
  occurredAt?: string;
};

export type WorkflowTransitionCommand = {
  agreementId: string;
  participantId?: string;
  /** Workflow lane: commercial | settlement | accounting | custom. */
  workflow: string;
  fromState?: string | null;
  toState: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

export type ParticipantApprovalCommand = {
  agreementId: string;
  participantId: string;
  /** Invite token path used by Local / pilot today. */
  inviteToken?: string;
  note?: string;
  approverUserId?: string | null;
  occurredAt?: string;
};

export type SettlementApprovalCommand = {
  agreementId: string;
  participantId?: string;
  settlementId?: string;
  approvedBy: string;
  note?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

export type PublishCommercialNetworkEventCommand = {
  event: CommercialNetworkEvent;
};

export type SynchronizeSharedStateCommand = {
  organizationId?: string | null;
  ownerUserId?: string | null;
  agreementId?: string;
  /** Full snapshot to upsert when the provider supports bulk sync (Local). */
  snapshot?: SharedCommercialSnapshot;
};

/* ─── Results ─────────────────────────────────────────────────────────────── */

export type CommercialNetworkResult<T = void> =
  | { ok: true; data: T; notImplemented?: false }
  | {
      ok: false;
      error: string;
      /** True when the provider method is a documented stub. */
      notImplemented?: boolean;
      operatorError?: string;
    };

export type ParticipantApprovalResult = {
  agreement: SharedCommercialAgreement;
  participant: SharedCommercialParticipant;
};

export type WorkflowTransitionResult = {
  agreementId: string;
  participantId?: string;
  workflow: string;
  toState: string;
};

export type SettlementApprovalResult = {
  agreementId: string;
  participantId?: string;
  settlementId?: string;
  status: 'approved' | 'ready' | 'released';
};

/* ─── Subscriptions ───────────────────────────────────────────────────────── */

export type CommercialNetworkEventHandler = (
  event: CommercialNetworkEvent
) => void | Promise<void>;

export type Unsubscribe = () => void;

/* ─── Read-model projections (Commercial Domain side) ─────────────────────── */

/**
 * Thin read models updated from Commercial Network events.
 * Mirrors how future Canton events will update Provvypay.
 */
export type AgreementProjection = {
  agreementId: string;
  name: string;
  status: string | null;
  organizationId: string | null;
  lastEventKind: string;
  lastEventAt: string;
  version: number;
};

export type WorkflowProjection = {
  agreementId: string;
  participantId?: string;
  workflow: string;
  state: string;
  lastTransitionAt: string;
  version: number;
};

export type ParticipantProjection = {
  participantId: string;
  agreementId: string;
  approvalStatus: string;
  approvedAt: string | null;
  lastEventKind: string;
  lastEventAt: string;
  version: number;
};

export type SettlementProjection = {
  agreementId: string;
  participantId?: string;
  settlementId?: string;
  status: 'pending' | 'ready' | 'approved' | 'released';
  lastEventKind: string;
  lastEventAt: string;
  version: number;
};

export type CommercialDomainReadModels = {
  agreements: Map<string, AgreementProjection>;
  workflows: Map<string, WorkflowProjection>;
  participants: Map<string, ParticipantProjection>;
  settlements: Map<string, SettlementProjection>;
};
