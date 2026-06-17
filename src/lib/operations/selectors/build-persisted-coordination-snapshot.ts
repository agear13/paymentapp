import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { FundingCoordinationInput } from '@/lib/operations/truth/funding-coordination-semantics';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

/**
 * The fields the Commercial Brain and its downstream hooks actually consume from treasury.
 *
 * `ProjectWorkspaceSummary.treasury` is a Pick that covers the four required fields.
 * `obligationsTotal` and `currency` are genuinely absent from workspace summaries — both
 * have safe fallbacks (0 and undefined respectively) when not provided.
 * Full `ProjectTreasurySummary` objects are also assignable to this type via structural typing.
 */
export type CommercialTreasuryData = Pick<
  ProjectTreasurySummary,
  | 'hasFundingSources'
  | 'confirmedFunding'
  | 'obligationsReady'
  | 'pendingFunding'
> & {
  /** Absent from workspace summaries — falls back to 0 in funding derivation. */
  obligationsTotal?: number;
  /** Absent from workspace summaries — omitted from snapshot currency when not provided. */
  currency?: string;
};

export type PersistedCoordinationSnapshotInput = {
  participants: DemoParticipant[];
  projectId?: string | null;
  treasury?: CommercialTreasuryData | null;
  obligations?: RawObligationInput[];
  fundingAllocated?: boolean;
};

/** Map treasury data to funding coordination input — persisted reconciliation is authoritative. */
export function fundingInputFromTreasury(
  treasury: CommercialTreasuryData | null | undefined
): FundingCoordinationInput | undefined {
  if (!treasury) return undefined;
  return {
    fundingSourceConnected: treasury.hasFundingSources || treasury.confirmedFunding > 0,
    confirmedFunding: treasury.confirmedFunding,
    obligationsTotal: treasury.obligationsTotal ?? 0,
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
