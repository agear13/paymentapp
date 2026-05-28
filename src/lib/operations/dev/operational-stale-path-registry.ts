/**
 * Dev registry of legacy operational derivation paths.
 * Persisted server entities + coordination-snapshot are authoritative once they exist.
 * Grep these symbols when auditing stale selector/render timing.
 */
export const OPERATIONAL_STALE_PATH_SYMBOLS = [
  'degradedGuidance',
  'summarizeProject',
  'safeOperationalRouteState',
  'computeKpis',
  'summarizeProjectReadinessGaps',
  'graphReady',
  'graphSnapshotConverged',
  'participantsConfiguredCount',
] as const;

/** Surfaces that must not derive readiness/funding/earnings/obligations outside canonical hooks. */
export const CANONICAL_ONLY_SURFACES = [
  'useOperationalCoordinationState',
  'useCanonicalOperationalState',
  'useOperationalGuidance',
] as const;
