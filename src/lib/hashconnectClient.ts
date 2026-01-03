/**
 * HashConnect Singleton Client
 * 
 * CRITICAL: This module provides a singleton instance of HashConnect
 * that is initialized only once per browser session.
 * 
 * Must only be used in client-side code (browser).
 * Dynamically imports HashConnect at runtime to avoid SSR issues.
 */

'use client';

import { isUriMissingError, isChunkMismatchError } from './walletErrors';
import { HASHCONNECT_CONFIG } from './hedera/constants';

// Module-level singleton variables
let initPromise: Promise<any> | null = null;
let hc: any = null;
let latestPairingData: any = null;
let latestConnectionStatus: any = null;
let pairingString: string | null = null;

// Wallet state
interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  network: string;
  isLoading: boolean;
  error: string | null;
}

let walletState: WalletState = {
  isConnected: false,
  accountId: null,
  network: HASHCONNECT_CONFIG.NETWORK,
  isLoading: false,
  error: null,
};

// State change listeners
type StateChangeListener = (state: WalletState) => void;
const listeners: Set<StateChangeListener> = new Set();

/**
 * Notify all listeners of state changes
 */
function notifyListeners() {
  listeners.forEach(listener => listener({ ...walletState }));
}

/**
 * Update wallet state and notify listeners
 */
function updateWalletState(updates: Partial<WalletState>) {
  walletState = { ...walletState, ...updates };
  notifyListeners();
}

/**
 * Get or initialize the HashConnect singleton instance
 * Guaranteed to initialize only once per browser session
 */
export async function initHashConnect(): Promise<void> {
  // Guard: Must be in browser
  if (typeof window === 'undefined') {
    throw new Error('HashConnect must run on client (window is undefined)');
  }

  // Already initialized - return immediately
  if (hc !== null) {
    console.log('[HashConnect] Already initialized - reusing singleton');
    return;
  }

  // Initialization in progress - wait for it
  if (initPromise !== null) {
    console.log('[HashConnect] Initialization in progress - waiting...');
    return await initPromise;
  }

  // Start initialization (store promise to prevent duplicate init)
  initPromise = (async () => {
    try {
      console.log('[HashConnect] Initializing singleton instance...');
      updateWalletState({ isLoading: true, error: null });

      // Validate WalletConnect project ID
      const projectId = HASHCONNECT_CONFIG.WALLETCONNECT_PROJECT_ID;
      if (!projectId) {
        throw new Error(
          'Missing WalletConnect projectId. Create one in WalletConnect Cloud (https://cloud.walletconnect.com/) and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment variables.'
        );
      }

      // Dynamic import (client-only)
      const { HashConnect, LedgerId } = await import('hashconnect');

      // Determine network from env (default to testnet)
      const networkEnv = HASHCONNECT_CONFIG.NETWORK.toLowerCase();
      const ledgerId = networkEnv === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET;

      // App metadata (use window.location.origin at runtime)
      const appMetadata = {
        name: HASHCONNECT_CONFIG.APP_METADATA.name,
        description: HASHCONNECT_CONFIG.APP_METADATA.description,
        url: window.location.origin,
        icons: [`${window.location.origin}/icon.png`],
      };

      // Create HashConnect instance
      const hashconnect = new HashConnect(
        ledgerId,
        projectId,
        appMetadata,
        true // debug mode
      );

      // Register event listeners (ONCE)
      hashconnect.pairingEvent.on((pairingData: any) => {
        console.log('[HashConnect] Pairing event:', pairingData);
        latestPairingData = pairingData;
        
        const accountId = pairingData?.accountIds?.[0];
        if (accountId) {
          updateWalletState({
            isConnected: true,
            accountId,
            isLoading: false,
            error: null,
          });
        }
      });

      hashconnect.connectionStatusChangeEvent.on((status: any) => {
        console.log('[HashConnect] Connection status changed:', status);
        latestConnectionStatus = status;
      });

      hashconnect.disconnectionEvent.on(() => {
        console.log('[HashConnect] Disconnected');
        latestPairingData = null;
        pairingString = null;
        updateWalletState({
          isConnected: false,
          accountId: null,
          isLoading: false,
        });
      });

      // Initialize HashConnect
      await hashconnect.init();

      // Check if already paired from previous session
      const alreadyPaired = hashconnect.hcData?.pairingData && hashconnect.hcData.pairingData.length > 0;
      
      if (alreadyPaired) {
        // Rehydrate wallet state from existing pairing
        const existing = hashconnect.hcData.pairingData[0];
        latestPairingData = existing;
        const accountId = existing?.accountIds?.[0] ?? null;
        
        updateWalletState({
          isConnected: !!accountId,
          accountId,
          isLoading: false,
          error: null,
        });
        
        pairingString = null; // already paired
        console.log('[HashConnect] Rehydrated existing pairing:', accountId);
      } else {
        // Generate pairing string for new connection
        pairingString = await hashconnect.connect();
        console.log('[HashConnect] Generated pairing string');
        updateWalletState({ isLoading: false });
      }

      // Store singleton instance
      hc = hashconnect;

      console.log('[HashConnect] ✅ Singleton initialized successfully');
    } catch (error) {
      // Keep initPromise set (don't reset to null) to prevent retry loops
      console.error('[HashConnect] ❌ Initialization failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize HashConnect';
      updateWalletState({
        isLoading: false,
        error: errorMessage,
      });
      
      throw error;
    }
  })();

  return await initPromise;
}

/**
 * Open HashPack pairing modal with retry logic for URI missing errors
 * Automatically calls initHashConnect() first
 * Waits 500ms for HashPack extension to initialize, retries once if needed
 */
export async function openHashpackPairingModal(): Promise<void> {
  // Ensure HashConnect is initialized first
  await initHashConnect();
  
  if (!hc) {
    throw new Error('HashConnect initialization failed - cannot open pairing modal');
  }

  // Ensure we have a pairing string
  if (!pairingString) {
    console.log('[HashConnect] No pairing string - generating new one');
    pairingString = await hc.connect();
  }

  if (!pairingString) {
    throw new Error('Failed to generate pairing string');
  }

  // Brief delay to allow HashPack extension to fully initialize
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    console.log('[HashConnect] Opening pairing modal...');
    await hc.openPairingModal(pairingString);
    console.log('[HashConnect] Pairing modal opened successfully');
  } catch (err) {
    // Retry once if URI missing (HashPack still initializing)
    if (isUriMissingError(err)) {
      console.warn('[HashConnect] URI missing - retrying after delay...');
      await new Promise(resolve => setTimeout(resolve, 500));
      await hc.openPairingModal(pairingString);
      console.log('[HashConnect] Pairing modal opened successfully (retry)');
    } else {
      throw err;
    }
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (!hc) {
    console.warn('[HashConnect] Not initialized - nothing to disconnect');
    return;
  }

  try {
    if (latestPairingData?.topic) {
      await hc.disconnect(latestPairingData.topic);
    }
    
    latestPairingData = null;
    pairingString = null;
    
    updateWalletState({
      isConnected: false,
      accountId: null,
      isLoading: false,
      error: null,
    });

    console.log('[HashConnect] Wallet disconnected successfully');
  } catch (error) {
    console.error('[HashConnect] Failed to disconnect wallet:', error);
    throw error;
  }
}

/**
 * Subscribe to wallet state changes
 */
export function subscribeToWalletState(listener: StateChangeListener): () => void {
  listeners.add(listener);
  
  // Immediately call with current state
  listener({ ...walletState });
  
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current wallet state (synchronous)
 */
export function getWalletState(): WalletState {
  return { ...walletState };
}

/**
 * Get the latest pairing data (if connected)
 */
export function getLatestPairingData(): any {
  return latestPairingData;
}

/**
 * Get the latest connection status
 */
export function getLatestConnectionStatus(): any {
  return latestConnectionStatus;
}

/**
 * Check if wallet is currently connected
 */
export function isWalletConnected(): boolean {
  return walletState.isConnected && walletState.accountId !== null;
}

/**
 * Get HashConnect instance (for advanced use cases)
 * Returns null if not initialized
 */
export function getHashConnectInstance(): any {
  return hc;
}
