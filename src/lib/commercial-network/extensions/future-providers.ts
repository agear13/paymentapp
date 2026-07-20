/**
 * Future Commercial Network providers.
 *
 * Canton is one implementation. Future providers may include Local, Azure,
 * Hyperledger, or others. Do not hardcode Canton in the Commercial Domain.
 */

import type { CommercialNetworkProviderId } from '@/lib/commercial-network/types';

export type FutureCommercialNetworkProviderHint = {
  provider: CommercialNetworkProviderId;
  label: string;
  adapterRegistered: boolean;
  description: string;
};

const FUTURE_PROVIDER_HINTS: FutureCommercialNetworkProviderHint[] = [
  {
    provider: 'local',
    label: 'Local',
    adapterRegistered: true,
    description:
      'Default Provvypay behaviour — in-process shared state via LocalPersistencePort (Postgres today).',
  },
  {
    provider: 'canton',
    label: 'Canton',
    adapterRegistered: true,
    description:
      'HackCanton Shared Commercial Agreement — Proposal / progressive Accept / SettlementReady via cn-quickstart Daml + CNL provider.',
  },
  {
    provider: 'azure',
    label: 'Azure',
    adapterRegistered: false,
    description: 'Future Azure confidential ledger / workflow network adapter.',
  },
  {
    provider: 'hyperledger',
    label: 'Hyperledger',
    adapterRegistered: false,
    description: 'Future Hyperledger Fabric / FireFly shared workflow adapter.',
  },
];

export function getFutureCommercialNetworkProviderHints(): FutureCommercialNetworkProviderHint[] {
  return FUTURE_PROVIDER_HINTS;
}
