import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { OperationalSyncMutationKind } from '@/lib/operations/sync/operational-sync-types';

export type CoordinationSnapshotSummary = {
  participantCount: number;
  earningsConfiguredCount: number;
  payoutReadyCount: number;
  releaseReadyCount?: number;
  obligationCount?: number;
};

export type ActivationMetricsSnapshot = {
  participantsConfiguredCount: number;
  participantCount: number;
  obligationCount: number;
  releaseEligibleCount?: number;
};

export type PostConvergenceIntegrityInput = {
  mutation: OperationalSyncMutationKind;
  projectId?: string | null;
  surface?: string;
  participants: DemoParticipant[];
  graphSummary: CoordinationSnapshotSummary;
  canonicalKpis: OperationalKPIs | null;
  activation?: ActivationMetricsSnapshot | null;
  sync?: {
    payoutReadyCount?: number;
    obligationCount?: number;
    releaseEligibleObligationCount?: number;
  } | null;
  obligationsTableRowCount?: number;
  obligationsTableSuppressed?: boolean;
  fundingAllocated?: boolean;
  treasuryHasFundingSources?: boolean;
  minPayoutReadyCount?: number;
};

export type PostConvergenceIntegrityViolation = {
  code: string;
  message: string;
};
