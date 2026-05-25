/**
 * Operational state synchronization — recompute derivations after approval and related events.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationInput,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

export type OperationalSyncScope = 'participant' | 'obligation' | 'payout' | 'funding' | 'all';

export type OperationalRefreshInput = OperationalCoordinationInput & {
  /** When set, maps to workspace cache invalidation scope on the client. */
  projectId: string;
};

export type OperationalSyncResult = {
  snapshot: OperationalCoordinationSnapshot;
  invalidatedScopes: OperationalSyncScope[];
};

const INVALIDATE_MAP: Record<OperationalSyncScope, OperationalSyncScope[]> = {
  participant: ['participant', 'payout'],
  obligation: ['obligation', 'payout'],
  payout: ['payout'],
  funding: ['funding', 'payout', 'obligation'],
  all: ['participant', 'obligation', 'payout', 'funding'],
};

/** Marks operational readiness caches stale — client controllers call workspace invalidate after this. */
export function invalidateOperationalReadiness(scope: OperationalSyncScope = 'all'): OperationalSyncScope[] {
  return INVALIDATE_MAP[scope] ?? INVALIDATE_MAP.all;
}

/** Recompute all operational derivations from hydrated entities. */
export function refreshOperationalDerivations(
  input: OperationalCoordinationInput
): OperationalCoordinationSnapshot {
  return getOperationalCoordinationSnapshot(input);
}

/** After agreement approval — persist participant, recompute snapshot, return scopes to invalidate. */
export function synchronizeOperationalStateAfterApproval(input: {
  projectId: string;
  participant: DemoParticipant;
  participants?: DemoParticipant[];
  obligations?: OperationalCoordinationInput['obligations'];
  fundingAllocated?: boolean;
  catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
}): OperationalSyncResult {
  const hydrated = hydrateOperationalParticipant(input.participant);
  const participants = input.participants?.map((p) =>
    p.id === hydrated.id ? hydrated : hydrateOperationalParticipant(p)
  ) ?? [hydrated];

  const snapshot = refreshOperationalDerivations({
    participants,
    projectId: input.projectId,
    obligations: input.obligations,
    fundingAllocated: input.fundingAllocated,
    catalogItemsByParticipant: input.catalogItemsByParticipant,
  });

  return {
    snapshot,
    invalidatedScopes: invalidateOperationalReadiness('all'),
  };
}

/** Client helper — invalidate workspace cache scopes after operational events. */
export function workspaceScopesFromOperationalSync(
  scopes: OperationalSyncScope[]
): ('all' | 'summary' | 'participants')[] {
  if (scopes.includes('all') || scopes.includes('participant') || scopes.includes('obligation')) {
    return ['all'];
  }
  if (scopes.includes('payout') || scopes.includes('funding')) {
    return ['summary', 'participants'];
  }
  return ['participants'];
}
