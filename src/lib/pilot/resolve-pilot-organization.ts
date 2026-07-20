export type PilotOrganizationSummary = {
  id: string;
  name: string;
};

export type PilotOrganizationResolution =
  | 'explicit'
  | 'single_membership'
  | 'dev_fallback'
  | 'unresolved';

export function isPilotOrganizationDevFallbackAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv !== 'production';
}

/**
 * Resolve which organization the pilot command centre should inspect.
 * Explicit query param wins; otherwise a sole membership; dev env fallback last.
 */
export function resolvePilotOrganizationFromMemberships(input: {
  explicitOrgId?: string | null;
  memberships: readonly PilotOrganizationSummary[];
  devFallbackOrgId?: string | null;
  allowDevFallback?: boolean;
}): { organizationId: string | null; resolution: PilotOrganizationResolution } {
  const explicit = input.explicitOrgId?.trim();
  if (explicit) {
    return { organizationId: explicit, resolution: 'explicit' };
  }

  if (input.memberships.length === 1) {
    return {
      organizationId: input.memberships[0].id,
      resolution: 'single_membership',
    };
  }

  if (input.allowDevFallback) {
    const fallback = input.devFallbackOrgId?.trim();
    if (fallback) {
      return { organizationId: fallback, resolution: 'dev_fallback' };
    }
  }

  return { organizationId: null, resolution: 'unresolved' };
}
