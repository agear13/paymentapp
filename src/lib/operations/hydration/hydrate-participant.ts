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
import type { CommissionScopeContext } from '@/lib/operations/derivations/commission-scope';
import { deriveParticipantReadiness } from '@/lib/operations/derivations/derive-participant-readiness';
import {
  detectParticipantEntitySource,
  warnHydrationFailure,
  warnInvalidLifecycleCombination,
} from '@/lib/operations/hydration/hydration-dev-warnings';
import { hydrateOperationalParticipant } from '@/lib/operations/hydration/hydrate-operational-participant';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { deriveAttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import { deriveParticipantLifecycleState } from '@/lib/operations/lifecycle/participant-lifecycle';
import { derivePayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';
import {
  approvalTraceFields,
  traceRuntime,
  watchParticipantAcceptedTransition,
} from '@/lib/operations/dev/participant-accepted-runtime-trace';

export type HydrateParticipantContext = CommissionScopeContext;

function emptyHydratedParticipant(context: HydrateParticipantContext = {}): HydratedParticipant {
  const entity = hydrateOperationalParticipant(null);
  return buildHydratedParticipant(entity, context);
}

function buildHydratedParticipant(
  entity: DemoParticipant,
  context: HydrateParticipantContext = {}
): HydratedParticipant {
  const compensation = deriveCompensationState(entity, context);
  const attribution = deriveAttributionState(entity, context);
  const operational = deriveParticipantReadiness(entity);
  const participantLifecycle = deriveParticipantLifecycleState(entity);
  const agreementLifecycle = deriveAgreementLifecycleState(entity);
  const attributionLifecycle = deriveAttributionLifecycleState(entity, context);
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
      settlementBasis: compensation.settlementBasis,
      scopeLabel: compensation.scopeLabel,
      scopeDescription: compensation.scopeDescription,
      earningsPrimary: compensation.earningsPrimary,
      earningsPrimaryCompact: compensation.earningsPrimaryCompact,
      earningsSecondary: compensation.earningsSecondary,
      earningsTitle: compensation.earningsTitle,
      eligibleCatalogItems: compensation.eligibleCatalogItems,
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
  raw: DemoParticipant | Record<string, unknown> | null | undefined,
  context: HydrateParticipantContext = {}
): HydratedParticipant {
  try {
    watchParticipantAcceptedTransition('hydrateParticipant raw input', raw);
    traceRuntime('hydrateParticipant raw input', {
      participant: raw,
      participantApprovalFields: approvalTraceFields(raw),
    });
    const adapted = adaptParticipantInput(raw);
    if (!adapted) return emptyHydratedParticipant(context);
    watchParticipantAcceptedTransition('hydrateParticipant adapted', adapted);
    traceRuntime('hydrateParticipant adapted', {
      participant: adapted,
      participantApprovalFields: approvalTraceFields(adapted),
    });
    const source = detectParticipantEntitySource(adapted, true);
    auditParticipantInput(adapted);
    const entity = hydrateOperationalParticipant(adapted);
    watchParticipantAcceptedTransition('hydrateParticipant entity', entity);
    traceRuntime('hydrateParticipant entity', {
      participant: entity,
      participantApprovalFields: approvalTraceFields(entity),
    });
    const hydrated = buildHydratedParticipant(entity, context);
    const result = {
      ...hydrated,
      metadata: {
        ...hydrated.metadata,
        source,
      },
    };
    traceRuntime('hydrateParticipant output', {
      hydrated: result,
      participantApprovalFields: approvalTraceFields(result._entity),
    });
    watchParticipantAcceptedTransition('hydrateParticipant output', result._entity);
    return result;
  } catch (error) {
    const id =
      raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string'
        ? raw.id
        : undefined;
    warnHydrationFailure('participant', id, error);
    return emptyHydratedParticipant(context);
  }
}

export function hydrateParticipants(
  rawList: (DemoParticipant | Record<string, unknown>)[] | null | undefined,
  context: HydrateParticipantContext = {}
): HydratedParticipant[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw) => hydrateParticipant(raw, context));
}

/** Access hydrated storage entity for mutations only. */
export function participantEntity(hydrated: HydratedParticipant): DemoParticipant {
  watchParticipantAcceptedTransition('participantEntity output', hydrated._entity);
  traceRuntime('participantEntity output', {
    participant: hydrated._entity,
    participantApprovalFields: approvalTraceFields(hydrated._entity),
  });
  return hydrated._entity;
}
