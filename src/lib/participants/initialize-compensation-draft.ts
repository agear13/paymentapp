import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { hydrateParticipant, participantEntity } from '@/lib/operations/hydration/hydrate-participant';
import { safeDefaultCompensationProfile } from '@/lib/operational/safe-operational-hydration';

export const DEFAULT_COMPENSATION_DRAFT: ParticipantCompensationProfile = {
  compensationType: 'FIXED_FEE',
  configured: false,
  revenueSources: [],
  customerAttributionEnabled: false,
  commissionSourceMode: 'all_active',
  commissionServiceIds: [],
};

/** Safe draft initialization — never throws. */
export function initializeCompensationDraft(
  participant: DemoParticipant | null | undefined
): ParticipantCompensationProfile {
  if (!participant) return { ...DEFAULT_COMPENSATION_DRAFT };
  try {
    const hydrated = hydrateParticipant(participant);
    const entity = participantEntity(hydrated);
    const profile =
      entity.compensationProfile ?? safeDefaultCompensationProfile(entity);
    return {
      ...DEFAULT_COMPENSATION_DRAFT,
      ...profile,
      revenueSources: profile.revenueSources ?? [],
      commissionServiceIds: profile.commissionServiceIds ?? [],
      customerAttributionEnabled: profile.customerAttributionEnabled ?? false,
      commissionSourceMode: profile.commissionSourceMode ?? 'all_active',
    };
  } catch {
    return { ...DEFAULT_COMPENSATION_DRAFT };
  }
}

export type OpenCompensationConfigContext = {
  participantId: string;
  projectId?: string;
  reason?: string;
};

/** Development-only diagnostics for compensation modal open failures. */
export function logCompensationConfigDiagnostic(
  level: 'open' | 'init-failure' | 'catalog-failure',
  context: OpenCompensationConfigContext,
  detail?: unknown
): void {
  if (process.env.NODE_ENV === 'production') return;
  const prefix = '[CompensationConfig]';
  switch (level) {
    case 'open':
      console.warn(prefix, 'Opening modal', context);
      break;
    case 'init-failure':
      console.warn(prefix, 'Init failure', context, detail);
      break;
    case 'catalog-failure':
      console.warn(prefix, 'Catalog fetch failed (non-fatal)', context, detail);
      break;
  }
}

/** Hydrate participant for local compensation editing — independent of onboarding gates. */
export function prepareParticipantForCompensationEdit(
  participant: DemoParticipant
): DemoParticipant {
  return participantEntity(hydrateParticipant(participant));
}
