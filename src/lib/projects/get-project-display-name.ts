/**
 * Human-readable project labels — never expose internal IDs in UI.
 */

export const UNTITLED_PROJECT_LABEL = 'Untitled agreement';

export type ProjectNameSource = {
  name?: string | null;
  dealName?: string | null;
};

/**
 * Returns the operator-facing project name, never a database or system id.
 */
export function getProjectDisplayName(source: ProjectNameSource | null | undefined): string {
  const candidate = source?.name?.trim() || source?.dealName?.trim();
  if (!candidate) return UNTITLED_PROJECT_LABEL;

  if (looksLikeInternalSystemId(candidate)) {
    return UNTITLED_PROJECT_LABEL;
  }

  return candidate;
}

/** Detect generated onboarding / system ids shown as names (e.g. Onb-deal-1779076794753). */
export function looksLikeInternalSystemId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (/^onb-deal-\d+$/i.test(trimmed)) return true;
  if (/^deal-[a-f0-9-]{8,}$/i.test(trimmed)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function isLikelyProjectIdSegment(segment: string): boolean {
  if (/^onb-deal-\d+$/i.test(segment)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segment)) {
    return true;
  }
  if (/^deal-[a-z0-9-]+$/i.test(segment) && segment.length > 12) return true;
  return false;
}
