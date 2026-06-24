/**
 * Operational state synchronization — recompute derivations after mutations.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationInput,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';

import type { OperationalMutationKind } from '@/lib/operations/orchestration/operational-mutation-kind';

export type { OperationalMutationKind } from '@/lib/operations/orchestration/operational-mutation-kind';

export type OperationalSyncScope = 'participant' | 'obligation' | 'payout' | 'funding' | 'all';

export type OperationalRefreshInput = OperationalCoordinationInput & {
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

const MUTATION_SCOPE: Record<OperationalMutationKind, OperationalSyncScope> = {
  agreement_approval: 'all',
  participant_earnings_save: 'all',
  funding_source_crud: 'funding',
  funding_update: 'funding',
  payout_verification: 'all',
  attribution_update: 'all',
  snapshot_persist: 'all',
  release_batch_generated: 'all',
  payout_released: 'all',
  supplier_onboarding: 'all',
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

/** Canonical synchronization entrypoint for ALL operational mutations. */
export function synchronizeOperationalState(input: {
  mutation: OperationalMutationKind;
  projectId: string;
  participants: DemoParticipant[];
  focusParticipant?: DemoParticipant;
  obligations?: OperationalCoordinationInput['obligations'];
  fundingAllocated?: boolean;
  funding?: OperationalCoordinationInput['funding'];
  catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
}): OperationalSyncResult {
  const focusId = input.focusParticipant?.id;
  const participants = input.participants.map((p) => {
    const raw = focusId && p.id === focusId ? input.focusParticipant! : p;
    return hydrateOperationalParticipant(raw);
  });

  const snapshot = refreshOperationalDerivations({
    participants,
    projectId: input.projectId,
    obligations: input.obligations,
    fundingAllocated: input.fundingAllocated,
    funding: input.funding,
    catalogItemsByParticipant: input.catalogItemsByParticipant,
  });

  return {
    snapshot,
    invalidatedScopes: invalidateOperationalReadiness(MUTATION_SCOPE[input.mutation] ?? 'all'),
  };
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
  return synchronizeOperationalState({
    mutation: 'agreement_approval',
    projectId: input.projectId,
    participants: input.participants ?? [input.participant],
    focusParticipant: input.participant,
    obligations: input.obligations,
    fundingAllocated: input.fundingAllocated,
    catalogItemsByParticipant: input.catalogItemsByParticipant,
  });
}

/** Client helper — invalidate workspace cache scopes after operational events. */
export function workspaceScopesFromOperationalSync(
  scopes: OperationalSyncScope[]
): ('all' | 'summary' | 'participants')[] {
  if (
    scopes.includes('all') ||
    scopes.includes('participant') ||
    scopes.includes('obligation') ||
    scopes.includes('funding')
  ) {
    return ['all'];
  }
  if (scopes.includes('payout')) {
    return ['summary', 'participants'];
  }
  return ['participants'];
}
