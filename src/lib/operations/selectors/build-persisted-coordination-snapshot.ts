import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { FundingCoordinationInput } from '@/lib/operations/truth/funding-coordination-semantics';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

export type PersistedCoordinationSnapshotInput = {
  participants: DemoParticipant[];
  projectId?: string | null;
  treasury?: ProjectTreasurySummary | null;
  obligations?: RawObligationInput[];
  fundingAllocated?: boolean;
};

/** Map treasury summary to funding coordination input — persisted reconciliation is authoritative. */
export function fundingInputFromTreasury(
  treasury: ProjectTreasurySummary | null | undefined
): FundingCoordinationInput | undefined {
  if (!treasury) return undefined;
  return {
    fundingSourceConnected: treasury.hasFundingSources || treasury.confirmedFunding > 0,
    confirmedFunding: treasury.confirmedFunding,
    obligationsTotal: treasury.obligationsTotal,
    obligationsFunded: treasury.obligationsReady,
    pendingFunding: treasury.pendingFunding,
  };
}

/**
 * Client/server helper — builds coordination snapshot from persisted entities only.
 * Operational events and graph convergence must not gate this output.
 */
export function buildPersistedCoordinationSnapshot(
  input: PersistedCoordinationSnapshotInput
): OperationalCoordinationSnapshot {
  const funding = fundingInputFromTreasury(input.treasury);
  const fundingAllocated =
    input.fundingAllocated ??
    Boolean(funding?.fundingSourceConnected && (funding.confirmedFunding ?? 0) > 0);

  return getOperationalCoordinationSnapshot({
    participants: input.participants,
    projectId: input.projectId ?? undefined,
    obligations: input.obligations,
    fundingAllocated,
    funding,
    projectCurrency: input.treasury?.currency,
  });
}

export function hasPersistedOperationalEntities(
  participants: DemoParticipant[] | null | undefined
): boolean {
  return (participants?.length ?? 0) > 0;
}
