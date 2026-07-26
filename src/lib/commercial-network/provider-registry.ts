/**
 * Commercial Network Provider Registry
 *
 * Resolves providers by organisation or project configuration.
 * Never hardcodes Canton — selection is config-driven.
 *
 * Example registrations:
 *   LocalProvider
 *   CantonProvider
 *   FutureProvider
 */

import type { CommercialNetworkProvider } from '@/lib/commercial-network/commercial-network-provider';
import { resolveCommercialNetworkProviderId } from '@/lib/commercial-network/network-config';
import { createLocalCommercialNetworkProvider } from '@/lib/commercial-network/providers/local/local-provider';
import { createCantonCommercialNetworkProvider } from '@/lib/commercial-network/providers/canton/canton-provider';
import type {
  AvailableCommercialNetworkProviderId,
  CommercialNetworkProviderId,
} from '@/lib/commercial-network/types';

export type CommercialNetworkProviderFactory = () => CommercialNetworkProvider;

export type CommercialNetworkProviderRegistry = {
  register(
    providerId: AvailableCommercialNetworkProviderId,
    factory: CommercialNetworkProviderFactory
  ): void;
  has(providerId: CommercialNetworkProviderId): boolean;
  list(): AvailableCommercialNetworkProviderId[];
  /** Create a fresh provider instance for the given id. */
  create(providerId: AvailableCommercialNetworkProviderId): CommercialNetworkProvider;
  /**
   * Resolve provider for organisation / optional project using network config.
   * Defaults to Canton when unset (Local via COMMERCIAL_NETWORK_PROVIDER=local).
   */
  resolveFor(input: {
    organizationId: string;
    projectId?: string | null;
  }): CommercialNetworkProvider;
};

export function createCommercialNetworkProviderRegistry(
  initial?: Partial<
    Record<AvailableCommercialNetworkProviderId, CommercialNetworkProviderFactory>
  >
): CommercialNetworkProviderRegistry {
  const factories = new Map<
    AvailableCommercialNetworkProviderId,
    CommercialNetworkProviderFactory
  >();

  const defaults: Record<
    AvailableCommercialNetworkProviderId,
    CommercialNetworkProviderFactory
  > = {
    local: () => createLocalCommercialNetworkProvider(),
    canton: () => createCantonCommercialNetworkProvider(),
  };

  for (const [id, factory] of Object.entries({ ...defaults, ...initial }) as Array<
    [AvailableCommercialNetworkProviderId, CommercialNetworkProviderFactory]
  >) {
    factories.set(id, factory);
  }

  return {
    register(providerId, factory) {
      factories.set(providerId, factory);
    },

    has(providerId) {
      return factories.has(providerId as AvailableCommercialNetworkProviderId);
    },

    list() {
      return [...factories.keys()];
    },

    create(providerId) {
      const factory = factories.get(providerId);
      if (!factory) {
        throw new Error(
          `Commercial Network provider "${providerId}" is not registered`
        );
      }
      return factory();
    },

    resolveFor(input) {
      const providerId = resolveCommercialNetworkProviderId(input);
      return this.create(providerId);
    },
  };
}

/** Process-wide default registry (Local + Canton skeleton). */
let defaultRegistry: CommercialNetworkProviderRegistry | null = null;

export function getDefaultCommercialNetworkProviderRegistry(): CommercialNetworkProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createCommercialNetworkProviderRegistry();
  }
  return defaultRegistry;
}

/** Test helper — replace the default registry. */
export function setDefaultCommercialNetworkProviderRegistry(
  registry: CommercialNetworkProviderRegistry | null
): void {
  defaultRegistry = registry;
}
