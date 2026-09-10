/**
 * Canonical outbound Payout Rail Registry.
 *
 * Separate from inbound PaymentRailRegistry. Metadata and capabilities only —
 * provider SDKs live in adapters.
 */

import type {
  PayoutDestinationKind,
  PayoutRailCapabilities,
  PayoutRailId,
} from '@/lib/payouts/rails/types';
import { PAYOUT_RAIL_IDS } from '@/lib/payouts/rails/types';

export type PayoutRailDefinition = PayoutRailCapabilities;

export const PAYOUT_RAIL_REGISTRY: readonly PayoutRailDefinition[] = [
  {
    railId: 'manual',
    displayLabel: 'Manual / off-platform',
    implemented: true,
    supportedCurrencies: [],
    supportedDestinationKinds: ['BANK_ACCOUNT', 'WALLET', 'PLATFORM_HANDLE'],
    supportsQuote: false,
    supportsPrepare: false,
    supportsCancel: false,
    acceptsInboundWebhooks: false,
    typicalSettlementHint: 'Operator confirms after paying off-platform',
    feeHint: 'Unknown — recorded as 0 until a quoting rail is selected',
    health: 'available',
  },
  {
    railId: 'hedera',
    displayLabel: 'Hedera HTS',
    implemented: true,
    supportedCurrencies: ['USD', 'AUD'],
    supportedDestinationKinds: ['WALLET'],
    supportsQuote: false,
    supportsPrepare: true,
    supportsCancel: false,
    acceptsInboundWebhooks: false,
    typicalSettlementHint: 'On-chain after HashPack sign + mirror SUCCESS',
    feeHint: 'Network fees paid by merchant Hedera account',
    health: 'available',
  },
  {
    railId: 'cregis',
    displayLabel: 'Cregis',
    implemented: true,
    /**
     * Cregis currencies are chain_id@token_id tokens, not Provvy Char(3) fiat.
     * Empty here is intentional: do not advertise USD/AUD. Selection uses
     * destination metadata, not this list.
     */
    supportedCurrencies: [],
    supportedDestinationKinds: ['WALLET'],
    supportsQuote: false,
    supportsPrepare: false,
    supportsCancel: false,
    acceptsInboundWebhooks: true,
    typicalSettlementHint: 'Async after Cregis audit/sign; webhook or query',
    feeHint: 'Not provided by the Cregis payout API',
    health: 'unknown',
  },
  {
    railId: 'airwallex',
    displayLabel: 'Airwallex',
    implemented: true,
    /**
     * Documented common payout currencies. Not a corridor catalogue and not a
     * statement that Provvy can hold or disburse customer funds in these
     * currencies. Selection does not use this list.
     */
    supportedCurrencies: ['SGD', 'USD', 'AUD', 'EUR', 'GBP', 'HKD', 'NZD', 'CAD', 'JPY', 'CHF'],
    supportedDestinationKinds: ['BANK_ACCOUNT'],
    supportsQuote: true,
    supportsPrepare: false,
    supportsCancel: true,
    acceptsInboundWebhooks: true,
    typicalSettlementHint: 'Sandbox bank transfer; timing comes from Airwallex, not a production funds-flow confirmation',
    feeHint: 'Quoted by the adapter from Airwallex validate/quote APIs',
    health: 'unknown',
  },
  {
    railId: 'stripe_treasury',
    displayLabel: 'Stripe Treasury',
    implemented: false,
    supportedCurrencies: ['USD', 'AUD'],
    supportedDestinationKinds: ['BANK_ACCOUNT'],
    supportsQuote: true,
    supportsPrepare: false,
    supportsCancel: true,
    acceptsInboundWebhooks: true,
    typicalSettlementHint: 'Async fiat payout',
    feeHint: 'Quoted by adapter when implemented',
    health: 'unavailable',
  },
];

const registryById = new Map(PAYOUT_RAIL_REGISTRY.map((rail) => [rail.railId, rail]));

export function getPayoutRail(id: PayoutRailId): PayoutRailDefinition {
  const rail = registryById.get(id);
  if (!rail) {
    throw new Error(`Unknown payout rail: ${id}`);
  }
  return rail;
}

export function listPayoutRails(): readonly PayoutRailDefinition[] {
  return PAYOUT_RAIL_REGISTRY;
}

export function listImplementedPayoutRails(): PayoutRailDefinition[] {
  return PAYOUT_RAIL_REGISTRY.filter((rail) => rail.implemented);
}

export function payoutRailSupportsCurrency(id: PayoutRailId, currency: string): boolean {
  const rail = getPayoutRail(id);
  // Empty supportedCurrencies means "any fiat" only for manual. Cregis tokens
  // are not Provvy Char(3) codes and must not be treated as all-currency.
  if (rail.supportedCurrencies.length === 0) return id === 'manual';
  return rail.supportedCurrencies.includes(currency.trim().toUpperCase());
}

export function payoutRailSupportsDestination(
  id: PayoutRailId,
  kind: PayoutDestinationKind | null
): boolean {
  if (!kind) return id === 'manual';
  return getPayoutRail(id).supportedDestinationKinds.includes(kind);
}

export function webhookProviderForPayoutRail(id: PayoutRailId):
  | 'STRIPE'
  | 'HEDERA'
  | 'MANUAL'
  | 'CREGIS'
  | 'STRIPE_TREASURY'
  | 'AIRWALLEX' {
  switch (id) {
    case 'hedera':
      return 'HEDERA';
    case 'cregis':
      return 'CREGIS';
    case 'airwallex':
      return 'AIRWALLEX';
    case 'stripe_treasury':
      return 'STRIPE_TREASURY';
    case 'manual':
      return 'MANUAL';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function assertKnownPayoutRailId(id: string): asserts id is PayoutRailId {
  if (!(PAYOUT_RAIL_IDS as readonly string[]).includes(id)) {
    throw new Error(`Unknown payout rail: ${id}`);
  }
}
