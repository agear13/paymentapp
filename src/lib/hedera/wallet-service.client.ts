/**
 * HashConnect Wallet Service (Client)
 * 
 * CRITICAL: This is a compatibility layer that re-exports from the canonical module.
 * 
 * ⚠️  MIGRATION NOTE: Prefer importing directly from @/lib/hashconnectClient
 * 
 * This file exists for backward compatibility and will be removed in a future update.
 * All new code should import from @/lib/hashconnectClient instead.
 * 
 * Canonical module: src/lib/hashconnectClient.ts (ONLY file that imports 'hashconnect')
 */

'use client';

import { log } from '@/lib/logger';
import { getAccountBalances } from './token-service';

// Re-export from canonical HashConnect client
// NO state, NO hashconnect imports - just forwarding
import {
  initHashConnect,
  disconnectWallet,
  subscribeToWalletState,
  getWalletState,
  updateWalletBalances,
  openHashpackPairingModal,
  getLatestPairingData,
  isWalletConnected as isConnected,
} from '@/lib/hashconnectClient';

// Re-export core API
export {
  initHashConnect,
  disconnectWallet,
  subscribeToWalletState,
  getWalletState,
  updateWalletBalances,
};

/**
 * Initialize wallet service (convenience wrapper)
 * @deprecated Use initHashConnect() directly from @/lib/hashconnectClient
 */
export async function initializeHashConnect(): Promise<void> {
  return initHashConnect();
}

/**
 * Connect wallet (opens pairing modal)
 * @deprecated Use openHashpackPairingModal() directly from @/lib/hashconnectClient
 */
export async function connectWallet(): Promise<{
  accountId: string;
  network: string;
  pairingData?: any;
}> {
  await openHashpackPairingModal();
  
  // Wait for connection to complete
  const state = getWalletState();
  if (!state.isConnected || !state.accountId) {
    throw new Error('Wallet connection failed or was cancelled');
  }
  
  const pairingData = getLatestPairingData();
  
  return {
    accountId: state.accountId,
    network: state.network,
    pairingData,
  };
}

/**
 * Connect wallet and fetch balances
 * @deprecated Use openHashpackPairingModal() + getAccountBalances() directly
 */
export async function connectAndFetchBalances(): Promise<{
  accountId: string;
  network: string;
  balances?: {
    HBAR: string;
    USDC: string;
    USDT: string;
    AUDD: string;
  };
}> {
  // Connect wallet
  const { accountId, network, pairingData } = await connectWallet();

  try {
    // Fetch balances from API
    const balances = await getAccountBalances(accountId);
    
    // Update state with balances
    updateWalletBalances(balances);

    return {
      accountId,
      network,
      balances,
    };
  } catch (error) {
    log.error('Failed to fetch balances after connection', { error, accountId });
    
    // Still return connection info even if balance fetch fails
    return {
      accountId,
      network,
    };
  }
}

/**
 * Disconnect wallet (convenience wrapper)
 * @deprecated Use disconnectWallet() directly from @/lib/hashconnectClient
 */
export async function disconnectAndClear(): Promise<void> {
  return disconnectWallet();
}

/**
 * Check if wallet is ready and connected
 * @deprecated Use isWalletConnected() directly from @/lib/hashconnectClient
 */
export function isWalletConnected(): boolean {
  return isConnected();
}

/**
 * Get connected account ID
 */
export function getConnectedAccountId(): string | undefined {
  const state = getWalletState();
  return state.accountId || undefined;
}

/**
 * Get connection state
 */
export function getConnectionState(): {
  ready: boolean;
  connected: boolean;
  accountId?: string;
  network?: string;
  isLoading?: boolean;
  error?: string | null;
} {
  const state = getWalletState();
  return {
    ready: state.isConnected, // Simplified - if connected, it's ready
    connected: state.isConnected,
    accountId: state.accountId || undefined,
    network: state.network,
    isLoading: state.isLoading,
    error: state.error,
  };
}

/**
 * Wait for wallet to be ready
 */
export async function waitForWalletReady(timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const state = getWalletState();
    if (state.isConnected) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * Refresh wallet balances
 */
export async function refreshWalletBalances(): Promise<void> {
  const accountId = getConnectedAccountId();
  
  if (!accountId) {
    throw new Error('No wallet connected');
  }

  try {
    const balances = await getAccountBalances(accountId);
    updateWalletBalances(balances);
    log.info('Wallet balances refreshed', { accountId, balances });
  } catch (error) {
    log.error('Failed to refresh balances', { error, accountId });
    throw error;
  }
}

/**
 * Get current wallet state with all data
 * @deprecated Use getWalletState() directly from @/lib/hashconnectClient
 */
export function getFullWalletState() {
  return getWalletState();
}

/**
 * Sign and submit transaction (placeholder for future implementation)
 * @deprecated This function is not yet implemented in the canonical client
 */
export async function signAndSubmitTransaction(
  transactionBytes: Uint8Array,
  accountId: string
): Promise<{ transactionId: string; receipt?: any }> {
  throw new Error(
    'signAndSubmitTransaction is not yet implemented in the canonical HashConnect client. ' +
    'This will be added in a future update.'
  );
}
