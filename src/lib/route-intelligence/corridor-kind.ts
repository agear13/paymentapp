import type { Corridor, CorridorKind, JurisdictionCode } from '@/lib/route-intelligence/types';

/**
 * ISO-style jurisdiction codes are opaque strings.
 * Do not maintain a closed country enum here.
 */
export function normalizeJurisdiction(code: string | null | undefined): JurisdictionCode | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function corridorKind(corridor: Corridor): CorridorKind {
  const origin = normalizeJurisdiction(corridor.origin);
  const destination = normalizeJurisdiction(corridor.destination);
  if (!origin || !destination) {
    return origin && destination && origin === destination ? 'domestic' : 'cross_border';
  }
  return origin === destination ? 'domestic' : 'cross_border';
}

export function corridorTouchesJurisdiction(
  corridor: Corridor,
  jurisdiction: JurisdictionCode | null | undefined
): boolean {
  const target = normalizeJurisdiction(jurisdiction);
  if (!target) return true;
  return (
    normalizeJurisdiction(corridor.origin) === target ||
    normalizeJurisdiction(corridor.destination) === target
  );
}
