/**
 * Safe timestamps for organization_services API + merchant UI.
 * Handles missing DB column / stale Prisma client / partial JSON without throwing.
 */

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** ISO-8601 for JSON APIs; coalesce updated → created when updated is absent. */
export function serviceCreatedAtIso(created: Date | null | undefined): string | null {
  if (!isValidDate(created)) return null;
  return created.toISOString();
}

export function serviceUpdatedAtIso(
  created: Date | null | undefined,
  updated: Date | null | undefined
): string | null {
  if (isValidDate(updated)) return updated.toISOString();
  if (isValidDate(created)) return created.toISOString();
  return null;
}

function formatServiceDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isSameActivityMoment(created: Date, updated: Date): boolean {
  return Math.abs(updated.getTime() - created.getTime()) < 60_000;
}

/** Merchant-facing line under a service row. */
export function formatServiceActivityLine(
  createdAtIso: string | null | undefined,
  updatedAtIso: string | null | undefined
): string {
  const created = createdAtIso ? new Date(createdAtIso) : null;
  const updated = updatedAtIso ? new Date(updatedAtIso) : null;

  if (created && !Number.isNaN(created.getTime()) && updated && !Number.isNaN(updated.getTime())) {
    if (isSameActivityMoment(created, updated)) {
      return `Created ${formatServiceDate(created)}`;
    }
    return `Updated ${formatServiceDate(updated)}`;
  }

  if (updated && !Number.isNaN(updated.getTime())) {
    return `Updated ${formatServiceDate(updated)}`;
  }
  if (created && !Number.isNaN(created.getTime())) {
    return `Created ${formatServiceDate(created)}`;
  }
  return '';
}
