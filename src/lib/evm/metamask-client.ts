/**
 * Client-side MetaMask helpers (viem + window.ethereum).
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  erc20Abi,
  type Address,
  type Hash,
} from 'viem';
import {
  EVM_NETWORKS,
  getNetworkByChainId,
  type EvmNetworkId,
} from '@/lib/evm/networks';
import {
  EVM_TOKENS,
  getTokenAddress,
  type EvmSettlementToken,
} from '@/lib/evm/tokens';

function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum?.request) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }
  return window.ethereum;
}

export function isMetaMaskAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum?.request;
}

export function getEthereumProvider() {
  return getProvider();
}

export async function connectMetaMask(): Promise<Address> {
  const provider = getProvider();
  const accounts = (await provider.request!({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts[0]) {
    throw new Error('No MetaMask account selected');
  }

  return accounts[0] as Address;
}

export async function getConnectedChainId(): Promise<number> {
  const provider = getProvider();
  const chainIdHex = (await provider.request!({ method: 'eth_chainId' })) as string;
  return parseInt(chainIdHex, 16);
}

export async function switchToNetwork(networkId: EvmNetworkId): Promise<void> {
  const provider = getProvider();
  const network = EVM_NETWORKS[networkId];
  const chainIdHex = `0x${network.chain.id.toString(16)}`;

  try {
    await provider.request!({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: unknown) {
    const err = error as { code?: number };
    if (err.code === 4902) {
      await provider.request!({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: network.name,
            nativeCurrency: network.chain.nativeCurrency,
            rpcUrls: network.chain.rpcUrls.default.http,
            blockExplorerUrls: network.chain.blockExplorers?.default?.url
              ? [network.chain.blockExplorers.default.url]
              : [],
          },
        ],
      });
      return;
    }
    throw error;
  }
}

function createWalletClientFromProvider() {
  const provider = getProvider();
  return createWalletClient({
    transport: custom(provider as never),
  });
}

function createReadClient(networkId: EvmNetworkId) {
  const network = EVM_NETWORKS[networkId];
  const provider = getProvider();
  return createPublicClient({
    chain: network.chain,
    transport: custom(provider as never),
  });
}

export async function getWalletNativeBalance(
  address: Address,
  networkId: EvmNetworkId
): Promise<string> {
  const client = createReadClient(networkId);
  const balance = await client.getBalance({ address });
  return formatUnits(balance, 18);
}

export async function getTokenBalance(
  address: Address,
  token: EvmSettlementToken,
  networkId: EvmNetworkId
): Promise<string> {
  const client = createReadClient(networkId);
  const tokenAddress = getTokenAddress(token, networkId);
  const balance = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  });
  return formatUnits(balance, EVM_TOKENS[token].decimals);
}

export async function sendErc20Payment(params: {
  token: EvmSettlementToken;
  networkId: EvmNetworkId;
  recipient: Address;
  amount: string;
}): Promise<Hash> {
  const { token, networkId, recipient, amount } = params;
  const walletClient = createWalletClientFromProvider();
  const [account] = await walletClient.getAddresses();
  if (!account) {
    throw new Error('MetaMask wallet not connected');
  }

  const tokenAddress = getTokenAddress(token, networkId);
  const decimals = EVM_TOKENS[token].decimals;
  const value = parseUnits(amount, decimals);

  const hash = await walletClient.writeContract({
    account,
    chain: EVM_NETWORKS[networkId].chain,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, value],
  });

  return hash;
}

export function formatWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function resolveNetworkFromChainId(chainId: number): EvmNetworkId | null {
  const network = getNetworkByChainId(chainId);
  return network?.id ?? null;
}

export function subscribeToChainChanges(onChange: (chainId: number) => void): () => void {
  const provider = window.ethereum;
  if (!provider?.on) return () => {};

  const handler = (chainIdHex: unknown) => {
    if (typeof chainIdHex === 'string') {
      onChange(parseInt(chainIdHex, 16));
    }
  };

  provider.on('chainChanged', handler);
  return () => provider.removeListener?.('chainChanged', handler);
}

export function subscribeToAccountChanges(onChange: (accounts: string[]) => void): () => void {
  const provider = window.ethereum;
  if (!provider?.on) return () => {};

  const handler = (accounts: unknown) => {
    if (Array.isArray(accounts)) {
      onChange(accounts as string[]);
    }
  };

  provider.on('accountsChanged', handler);
  return () => provider.removeListener?.('accountsChanged', handler);
}
