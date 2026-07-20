/**
 * Commercial Network configuration (organisation-level).
 *
 * Configuration only — no UI in this milestone.
 *
 * Example:
 *   Commercial Network
 *   ○ Local   ← default (current Provvypay behaviour)
 *   ○ Canton  ← future shared workflow network
 *
 * Stored in-process for now. Persistence can be added later without
 * changing the Commercial Domain or provider interface.
 */

import {
  DEFAULT_COMMERCIAL_NETWORK_CONFIG,
  type AvailableCommercialNetworkProviderId,
  type CommercialNetworkConfig,
} from '@/lib/commercial-network/types';

const orgConfigs = new Map<string, CommercialNetworkConfig>();

export function getCommercialNetworkConfig(
  organizationId: string
): CommercialNetworkConfig {
  return orgConfigs.get(organizationId) ?? { ...DEFAULT_COMMERCIAL_NETWORK_CONFIG };
}

export function setCommercialNetworkConfig(
  organizationId: string,
  config: CommercialNetworkConfig
): CommercialNetworkConfig {
  const next: CommercialNetworkConfig = {
    provider: config.provider,
    projectOverrides: config.projectOverrides
      ? { ...config.projectOverrides }
      : undefined,
    options: config.options ? { ...config.options } : undefined,
  };
  orgConfigs.set(organizationId, next);
  return next;
}

/**
 * Resolve which provider id applies for an organisation / optional project.
 * Project overrides win when present.
 */
export function resolveCommercialNetworkProviderId(input: {
  organizationId: string;
  projectId?: string | null;
}): AvailableCommercialNetworkProviderId {
  const config = getCommercialNetworkConfig(input.organizationId);
  if (input.projectId && config.projectOverrides?.[input.projectId]) {
    return config.projectOverrides[input.projectId]!;
  }
  return config.provider;
}

/** Test / bootstrap helper — clear all organisation configs. */
export function clearCommercialNetworkConfigs(): void {
  orgConfigs.clear();
}

/** List configured organisation ids (does not include implicit defaults). */
export function listConfiguredCommercialNetworkOrganizations(): string[] {
  return [...orgConfigs.keys()];
}
