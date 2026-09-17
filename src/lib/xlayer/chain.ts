/**
 * Isolated X Layer Testnet chain config.
 * Do not import src/lib/evm/networks.ts.
 */

import { defineChain, isAddress, zeroAddress, type Address, type Chain } from 'viem';

export const XLAYER_COMMITMENT_DISCLAIMER =
  'The underlying agreement remains the source of the commercial obligation. This transaction creates an on-chain representation of its current commitment state. It is not a payment and does not indicate supplier acceptance.';
export const XLAYER_COMMITMENT_DOMAIN = 'provvy.xlayer.commitment.v1';
export const XLAYER_TESTNET_CHAIN_ID = 1952;
export const XLAYER_TESTNET_RPC_DEFAULT = 'https://testrpc.xlayer.tech/terigon';
export const XLAYER_TESTNET_EXPLORER_DEFAULT = 'https://www.okx.com/web3/explorer/xlayer-test';
export const XLAYER_TESTNET_NAME = 'X Layer Testnet';

export function getXlayerRpcUrl(): string {
  return process.env.NEXT_PUBLIC_XLAYER_RPC_URL?.trim() || XLAYER_TESTNET_RPC_DEFAULT;
}

export function getXlayerExplorerBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_XLAYER_EXPLORER_URL?.trim() || XLAYER_TESTNET_EXPLORER_DEFAULT
  ).replace(/\/$/, '');
}

export function getConfiguredChainId(): number {
  const raw = process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID?.trim();
  if (!raw) return XLAYER_TESTNET_CHAIN_ID;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : XLAYER_TESTNET_CHAIN_ID;
}

export function getConfiguredRegistryAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_XLAYER_COMMITMENT_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw) || raw.toLowerCase() === zeroAddress) return null;
  return raw as Address;
}

export function isXlayerCommitmentsFlagEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_XLAYER_COMMITMENTS_ENABLED?.trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

export function isXlayerCommitmentsEnabled(): boolean {
  return (
    isXlayerCommitmentsFlagEnabled() &&
    getConfiguredChainId() === XLAYER_TESTNET_CHAIN_ID &&
    getConfiguredRegistryAddress() != null
  );
}

export function buildXlayerExplorerTxUrl(transactionHash: string): string {
  return `${getXlayerExplorerBaseUrl()}/tx/${transactionHash}`;
}

export const xLayerTestnet: Chain = defineChain({
  id: XLAYER_TESTNET_CHAIN_ID,
  name: XLAYER_TESTNET_NAME,
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [getXlayerRpcUrl()] },
  },
  blockExplorers: {
    default: { name: 'OKX Explorer', url: getXlayerExplorerBaseUrl() },
  },
  testnet: true,
});
