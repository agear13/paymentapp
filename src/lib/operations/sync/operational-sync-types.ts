import type { OperationalEvent } from '@/lib/operations/contracts/operational-events';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { OperationalSyncScope } from '@/lib/operations/orchestration/synchronize-operational-state';
import type { WorkspaceRefreshScope } from '@/lib/projects/workspace-refresh-controller';

export type OperationalSyncMutationKind =
  | 'participant_earnings_save'
  | 'agreement_approval'
  | 'payout_verification'
  | 'funding_update'
  | 'obligation_generation'
  | 'snapshot_persist'
  | 'other';

export const OPERATIONAL_CONVERGENCE_PHASE_ORDER = [
  'server-commit-complete',
  'invalidate-caches',
  'refresh-trigger',
  'coordination-snapshot-response',
  'activation-sync',
  'selector-recompute',
  'ui-render-convergence',
  'mutation-success',
] as const;

export type OperationalConvergencePhase = (typeof OPERATIONAL_CONVERGENCE_PHASE_ORDER)[number];

export type OperationalSyncHandlers = {
  invalidate: (scope?: WorkspaceRefreshScope | 'all') => void;
  refreshWorkspace: (scope?: WorkspaceRefreshScope | 'all') => Promise<void>;
  reloadCoordinationSnapshot?: () => Promise<void>;
  notifyActivation?: () => void;
  onAudit?: (entry: OperationalAuditEntry) => void;
};

export type OperationalSyncTraceContext = {
  mutation: OperationalSyncMutationKind;
  projectId?: string | null;
  participantId?: string | null;
  surface?: string;
};

export type OperationalSyncConvergenceOptions = {
  verify?: () => void | Promise<void>;
  onPhase?: (phase: OperationalConvergencePhase) => void;
};

export type OperationalSyncPayload = {
  invalidatedScopes?: OperationalSyncScope[];
  releaseEligibleCount?: number;
  payoutReadyCount?: number;
  obligationCount?: number;
  releaseEligibleObligationCount?: number;
  operationalEvent?: OperationalEvent;
  completionEvent?: OperationalEvent;
  auditEntry?: OperationalAuditEntry | null;
  syncCompletedAt?: string;
};

export type OperationalSyncResponse = {
  operationalSync?: OperationalSyncPayload;
};
