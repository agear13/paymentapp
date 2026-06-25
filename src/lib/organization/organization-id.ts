/**
 * Organization identity helpers (client + server safe).
 * Canonical org id is always `organizations.id` (UUID) from the authenticated session.
 */

export const ORGANIZATION_ID_STORAGE_KEY = 'provvypay.organizationId';

/** Standard UUID v4 shape used for `organizations.id`. */
export const ORGANIZATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrganizationIdKind =
  | 'uuid'
  | 'timestamp_like'
  | 'demo_synthetic'
  | 'invalid';

export function isValidOrganizationUuid(value: string): boolean {
  return ORGANIZATION_UUID_RE.test(value.trim());
}

/** Detect demo / synthetic ids that must never be sent to production APIs. */
export function isDemoSyntheticOrganizationId(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^(demo-|part-|co-edit-|ct-edit-|co-pilot-|ct-pilot-|onb_)/i.test(v)) {
    return true;
  }
  return false;
}

/** Numeric strings (e.g. `1778387226579`) are never persisted organization UUIDs. */
export function isTimestampLikeOrganizationId(value: string): boolean {
  const v = value.trim();
  return /^\d{10,}$/.test(v);
}

export function classifyOrganizationId(value: string): OrganizationIdKind {
  const v = value.trim();
  if (!v) return 'invalid';
  if (isValidOrganizationUuid(v)) return 'uuid';
  if (isTimestampLikeOrganizationId(v)) return 'timestamp_like';
  if (isDemoSyntheticOrganizationId(v)) return 'demo_synthetic';
  return 'invalid';
}

/**
 * Development-only warning when a non-UUID or synthetic id is used as organization id.
 */
export function warnInvalidOrganizationId(value: string, context: string): void {
  if (process.env.NODE_ENV === 'production') return;

  const kind = classifyOrganizationId(value);
  if (kind === 'uuid') return;

  const detail =
    kind === 'timestamp_like'
      ? 'timestamp-like numeric id'
      : kind === 'demo_synthetic'
        ? 'demo/synthetic id'
        : 'non-UUID value';

  console.warn(
    `[organization-id] Invalid organization id (${detail}) in ${context}: "${value}". ` +
      'Use GET /api/user/organization or server getUserOrganization().'
  );
}
