/**
 * Future provider integration extension points.
 *
 * Provider-specific logic belongs in adapters — not in the reconciliation engine.
 */

import type { ReconciliationRailAdapter } from '@/lib/commercial-reconciliation/adapters/reconciliation-rail-adapters';

export type FutureReconciliationProvider =
  | 'stripe'
  | 'wise'
  | 'hashpack'
  | 'metamask'
  | 'traditional_bank_feed'
  | 'xero'
  | 'quickbooks'
  | 'netsuite'
  | 'banking_api';

export type FutureProviderIntegrationHint = {
  provider: FutureReconciliationProvider;
  adapterRegistered: boolean;
  description: string;
};

const FUTURE_PROVIDER_HINTS: FutureProviderIntegrationHint[] = [
  {
    provider: 'stripe',
    adapterRegistered: true,
    description: 'StripeReconciliationAdapter normalizes PAYMENT_CONFIRMED events.',
  },
  {
    provider: 'wise',
    adapterRegistered: true,
    description: 'WiseReconciliationAdapter normalizes Wise transfer events.',
  },
  {
    provider: 'hashpack',
    adapterRegistered: true,
    description: 'CryptoReconciliationAdapter covers Hedera/HashPack via HEDERA payment method.',
  },
  {
    provider: 'metamask',
    adapterRegistered: true,
    description: 'CryptoReconciliationAdapter covers EVM_WALLET (MetaMask) events.',
  },
  {
    provider: 'traditional_bank_feed',
    adapterRegistered: true,
    description: 'ManualBankReconciliationAdapter — commercial identity pre-links payment to invoice.',
  },
  {
    provider: 'xero',
    adapterRegistered: false,
    description: 'Accounting consumes reconciliation export context; no provider logic in engine.',
  },
  {
    provider: 'quickbooks',
    adapterRegistered: false,
    description: 'Future accounting connector consumes reconciliation results.',
  },
  {
    provider: 'netsuite',
    adapterRegistered: false,
    description: 'Future accounting connector consumes reconciliation results.',
  },
  {
    provider: 'banking_api',
    adapterRegistered: false,
    description: 'Bank feeds confirm bank settlement after commercial reconciliation.',
  },
];

export function getFutureProviderIntegrationHints(): FutureProviderIntegrationHint[] {
  return FUTURE_PROVIDER_HINTS;
}

/** Register additional rail adapters at runtime (future rails). */
export type ReconciliationAdapterRegistry = {
  adapters: ReconciliationRailAdapter[];
  register(adapter: ReconciliationRailAdapter): void;
};

export function createReconciliationAdapterRegistry(
  initial: ReconciliationRailAdapter[] = []
): ReconciliationAdapterRegistry {
  const adapters = [...initial];
  return {
    adapters,
    register(adapter: ReconciliationRailAdapter) {
      if (!adapters.some((a) => a.railId === adapter.railId)) {
        adapters.push(adapter);
      }
    },
  };
}
