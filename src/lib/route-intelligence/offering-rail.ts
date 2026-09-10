import { UNKNOWN_NETWORK_RAIL } from '@/lib/route-intelligence/network-rail';
import type {
  MechanismId,
  NetworkRailId,
  OfferingRailMapping,
  ProviderId,
} from '@/lib/route-intelligence/types';

/**
 * Explicit offering → rail links only.
 * Empty in Phase 7: no sourced evidence maps Wise, Airwallex, OFX, or Bank to a rail.
 */
export const OFFERING_RAIL_MAPPINGS: readonly OfferingRailMapping[] = [];

export function resolveOfferingRail(input: {
  providerId: ProviderId;
  offeringId: string;
  mechanismId: MechanismId;
  mappings?: readonly OfferingRailMapping[];
}): NetworkRailId {
  const mappings = input.mappings ?? OFFERING_RAIL_MAPPINGS;
  const match = mappings.find(
    (row) =>
      row.providerId === input.providerId &&
      row.offeringId === input.offeringId &&
      row.mechanismId === input.mechanismId &&
      Boolean(row.evidence?.sourceUrl) &&
      row.railId !== UNKNOWN_NETWORK_RAIL
  );
  return match?.railId ?? UNKNOWN_NETWORK_RAIL;
}

export function mechanismIsNotNetworkRail(
  mechanismId: MechanismId,
  railId: NetworkRailId
): boolean {
  return mechanismId !== railId;
}
