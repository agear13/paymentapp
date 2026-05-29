import { deriveObligationState, type RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import type { HydratedObligation } from '@/lib/operations/contracts/obligation-contract';
import { warnHydrationFailure } from '@/lib/operations/hydration/hydration-dev-warnings';

function emptyHydratedObligation(): HydratedObligation {
  return deriveObligationState({});
}

/**
 * Canonical obligation pipeline: normalize → hydrate → derive → present.
 * Never throws.
 */
export function hydrateObligation(
  raw: RawObligationInput | Record<string, unknown> | null | undefined
): HydratedObligation {
  try {
    if (!raw || typeof raw !== 'object') return emptyHydratedObligation();
    return deriveObligationState(raw as RawObligationInput);
  } catch (error) {
    const id =
      raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string'
        ? raw.id
        : undefined;
    warnHydrationFailure('obligation', id, error);
    return emptyHydratedObligation();
  }
}

export function hydrateObligations(
  rawList: (RawObligationInput | Record<string, unknown>)[] | null | undefined
): HydratedObligation[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((raw) => hydrateObligation(raw));
}
