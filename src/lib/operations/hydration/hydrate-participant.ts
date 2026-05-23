import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  adaptParticipantInput,
  auditParticipantInput,
} from '@/lib/operations/adapters/participant-adapter';
import {
  PARTICIPANT_CONTRACT_VERSION,
  type HydratedParticipant,
} from '@/lib/operations/contracts/participant-contract';
import { deriveAttributionState } from '@/lib/operations/derivations/derive-attribution-state';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';
import { deriveParticipantReadiness } from '@/lib/operations/derivations/derive-participant-readiness';
import {
  detectParticipantEntitySource,
  warnHydrationFailure,
  warnInvalidLifecycleCombination,
} from '@/lib/operations/dev/operational-diagnostics';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { deriveAttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import { deriveParticipantLifecycleState } from '@/lib/operations/lifecycle/participant-lifecycle';
import { derivePayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';

function emptyHydratedParticipant(): HydratedParticipant {
  const entity = hydrateOperationalParticipant(null);
  return buildHydratedParticipant(entity);
}

function buildHydratedParticipant(entity: DemoParticipant): HydratedParticipant {
  const compensation = deriveCompensationState(entity);
  const attribution = deriveAttributionState(entity);
  const operational = deriveParticipantReadiness(entity);
  const participantLifecycle = deriveParticipantLifecycleState(entity);
  const agreementLifecycle = deriveAgreementLifecycleState(entity);
  const attributionLifecycle = deriveAttributionLifecycleState(entity);
  const payoutVerification = derivePayoutOnboardingPhase(entity);

  warnInvalidLifecycleCombination(entity.id, {
    participant: participantLifecycle,
    agreement: agreementLifecycle,
    attribution: attributionLifecycle,
  });

  return {
    id: entity.id,
    identity: {
      displayName: entity.name,
      email: entity.email?.trim() ? entity.email : null,
      role: entity.role,
    },
    lifecycle: {
      participant: participantLifecycle,
      agreement: agreementLifecycle,
      attribution: attributionLifecycle,
      payoutVerification,
    },
    compensation: {
      configured: compensation.configured,
      type: compensation.type,
      exemptFromPayout: compensation.exemptFromPayout,
      attributionEnabled: compensation.attributionEnabled,
      commissionSource: compensation.commissionSource,
      selectedCatalogItemIds: compensation.selectedCatalogItemIds,
      earningsSummary: compensation.earningsSummary,
    },
    payout: {
      verifiedExternally: entity.payoutVerificationConfirmed === true,
      verifiedAt: entity.payoutVerificationConfirmedAt ?? null,
      blocked: entity.payoutBlocked === true,
    },
    attribution: {
      enabled: attribution.enabled,
      active: attribution.active,
      linkGenerated: attribution.linkGenerated,
      lifecycle: attribution.lifecycle,
    },
    operational: {
      payoutReady: operational.payoutReady,
      agreementReady: operational.agreementReady,
      needsAttention: operational.needsAttention,
    },
    metadata: {
      contractVersion: PARTICIPANT_CONTRACT_VERSION,
      source: detectParticipantEntitySource(entity),
    },
    _entity: entity,
  };
}

/**
 * Canonical participant pipeline: normalize → hydrate → derive → present.
 * Never throws.
 */
export function hydrateParticipant(
  raw: DemoParticipant | Record<string, unknown> | null | undefined
): HydratedParticipant {
  try {
    const adapted = adaptParticipantInput(raw);
    if (!adapted) return emptyHydratedParticipant();
    const source = detectParticipantEntitySource(adapted, true);
    auditParticipantInput(adapted);
    const entity = hydrateOperationalParticipant(adapted);
    const hydrated = buildHydratedParticipant(entity);
    return {
      ...hydrated,
      metadata: {
        ...hydrated.metadata,
        source,
      },
    };
  } catch (error) {
    const id =
      raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string'
        ? raw.id
        : undefined;
    warnHydrationFailure('participant', id, error);
    return emptyHydratedParticipant();
  }
}

export function hydrateParticipants(
  rawList: (DemoParticipant | Record<string, unknown>)[] | null | undefined
): HydratedParticipant[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw) => hydrateParticipant(raw));
}

/** Access hydrated storage entity for mutations only. */
export function participantEntity(hydrated: HydratedParticipant): DemoParticipant {
  return hydrated._entity;
}
