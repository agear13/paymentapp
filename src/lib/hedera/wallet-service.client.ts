/**
 * HashConnect Wallet Service (Client)
 * 
 * CRITICAL: Client-side only wallet service.
 * Uses hashconnect.client.ts island - never imports hashconnect directly.
 * 
 * This file:
 * - Must be imported only by client components
 * - Re-exports client wallet API from the island
 * - Adds convenience helpers for UI components
 */

'use client';

import { log } from '@/lib/logger';
import { getAccountBalances } from './token-service';
import type { WalletState } from './types';

// Import from the client island (the ONLY place hashconnect is imported)
import {
  initHashConnect,
  connectWallet,
  disconnectWallet,
  getConnectionState,
  subscribeToWalletState,
  getWalletState,
  updateWalletBalances,
  signAndSubmitTransaction,
} from './hashconnect.client';

// Re-export the core API
export {
  initHashConnect,
  connectWallet,
  disconnectWallet,
  getConnectionState,
  subscribeToWalletState,
  getWalletState,
  updateWalletBalances,
  signAndSubmitTransaction,
};

/**
 * Initialize wallet service (convenience wrapper)
 */
export async function initializeHashConnect(): Promise<void> {
  return initHashConnect();
}

/**
 * Connect wallet and fetch balances
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
  const { accountId, network } = await connectWallet();

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
 */
export async function disconnectAndClear(): Promise<void> {
  return disconnectWallet();
}

/**
 * Check if wallet is ready and connected
 */
export function isWalletConnected(): boolean {
  const state = getConnectionState();
  return state.ready && state.connected;
}

/**
 * Get connected account ID
 */
export function getConnectedAccountId(): string | undefined {
  const state = getConnectionState();
  return state.accountId;
}

/**
 * Wait for wallet to be ready
 */
export async function waitForWalletReady(timeoutMs: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const state = getConnectionState();
    if (state.ready) {
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
 */
export function getFullWalletState(): WalletState {
  return getWalletState();
}

