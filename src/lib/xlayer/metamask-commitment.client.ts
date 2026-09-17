/**
 * Client-side MetaMask helpers for X Layer commitment registration.
 * Isolated from checkout payment transfers.
 */

import {
  createWalletClient,
  custom,
  getAddress,
  type Address,
  type Hash,
} from 'viem';
import {
  XLAYER_TESTNET_CHAIN_ID,
  XLAYER_TESTNET_NAME,
  getConfiguredRegistryAddress,
  getXlayerExplorerBaseUrl,
  getXlayerRpcUrl,
  isXlayerCommitmentsEnabled,
  xLayerTestnet,
} from '@/lib/xlayer/chain';
import { commitmentRegistryAbi } from '@/lib/xlayer/commitment-registry.abi';
import type { XlayerRegisterArgs } from '@/lib/xlayer/types';

function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum?.request) {
    throw new Error('MetaMask is not installed.');
  }
  return window.ethereum;
}

export function isMetaMaskAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum?.request;
}

export async function connectCommitmentWallet(): Promise<Address> {
  const provider = getProvider();
  const accounts = (await provider.request!({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts[0]) throw new Error('No MetaMask account selected');
  return getAddress(accounts[0]);
}

export async function getConnectedChainId(): Promise<number> {
  const provider = getProvider();
  const chainIdHex = (await provider.request!({ method: 'eth_chainId' })) as string;
  return Number.parseInt(chainIdHex, 16);
}

export async function switchToXlayerTestnet(): Promise<void> {
  const provider = getProvider();
  const chainIdHex = `0x${XLAYER_TESTNET_CHAIN_ID.toString(16)}`;
  try {
    await provider.request!({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code !== 4902) throw error;
    await provider.request!({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: XLAYER_TESTNET_NAME,
          nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
          rpcUrls: [getXlayerRpcUrl()],
          blockExplorerUrls: [getXlayerExplorerBaseUrl()],
        },
      ],
    });
  }
}

export async function registerOnchainCommitment(args: XlayerRegisterArgs): Promise<Hash> {
  if (!isXlayerCommitmentsEnabled()) {
    throw new Error('X Layer commitments are not configured.');
  }
  const contractAddress = getConfiguredRegistryAddress();
  if (!contractAddress) {
    throw new Error('X Layer registry address is not configured.');
  }

  await switchToXlayerTestnet();
  const chainId = await getConnectedChainId();
  if (chainId !== XLAYER_TESTNET_CHAIN_ID) {
    throw new Error(`Wallet is not on X Layer Testnet (expected ${XLAYER_TESTNET_CHAIN_ID}).`);
  }

  const provider = getProvider();
  const walletClient = createWalletClient({
    chain: xLayerTestnet,
    transport: custom(provider as never),
  });
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('MetaMask wallet not connected');

  return walletClient.writeContract({
    account,
    chain: xLayerTestnet,
    address: contractAddress,
    abi: commitmentRegistryAbi,
    functionName: 'registerCommitment',
    args: [
      args.commitmentId,
      args.buyerRefHash,
      args.supplierRefHash,
      BigInt(args.amountMinorUnits),
      args.sourceCurrency,
      args.settlementCurrency,
      BigInt(args.dueDate),
      args.purposeHash,
      args.termsHash,
    ],
    // Future: add dataSuffix here when a real Builder Code is configured. Do not invent one.
  });
}

export function formatWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
