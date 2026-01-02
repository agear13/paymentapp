/**
 * HashConnect Client Island
 * 
 * CRITICAL: This is the ONLY file that imports hashconnect.
 * All other files must use this API, never import hashconnect directly.
 * 
 * This file:
 * - Must start with 'use client'
 * - Dynamically imports hashconnect at runtime
 * - Never imported by server code
 * - Provides minimal API for UI components
 */

'use client';

import { log } from '@/lib/logger';
import { HASHCONNECT_CONFIG } from './constants';
import type { WalletState, HashConnectPairingData } from './types';

/**
 * Session storage key to track if we've already reloaded due to chunk error
 * Prevents infinite reload loops
 */
const CHUNK_RELOAD_KEY = 'hashconnect_chunk_reload_attempted';

/**
 * Loads HashConnect with ONE attempt.
 * On chunk load errors (manifest mismatch during deploy), performs ONE-TIME page reload.
 * 
 * Rationale: Retry loops make chunk mismatches worse by repeatedly fetching stale manifests.
 * A single page reload gets fresh HTML with correct chunk references.
 */
async function loadHashConnectWithReload(): Promise<typeof import('hashconnect')> {
  try {
    log.info('📦 Attempting HashConnect dynamic import (single attempt)');
    const hashconnectModule = await import('hashconnect');
    
    // Success - clear any reload flag
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }
    
    return hashconnectModule;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Detect chunk loading errors (manifest mismatch or corrupted chunk)
    const isChunkError = 
      errorMessage.includes('Loading chunk') || 
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('already been declared'); // SyntaxError from duplicate chunk loads
    
    if (isChunkError) {
      log.error('❌ HashConnect chunk load error detected (manifest/chunk mismatch)', {
        error: errorMessage,
        errorType: 'CHUNK_MISMATCH',
      });
      
      // Check if we've already tried reloading
      const alreadyReloaded = typeof sessionStorage !== 'undefined' && 
        sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';
      
      if (!alreadyReloaded && typeof sessionStorage !== 'undefined') {
        // Mark that we're about to reload (guard against loops)
        sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
        
        log.info('🔄 Performing ONE-TIME page reload to fetch fresh chunks');
        console.warn('Chunk mismatch detected - reloading page to fetch correct manifest...');
        
        // Short delay to ensure logs are written, then hard reload with cache bust
        setTimeout(() => {
          // Hard reload with cache-busting to force fresh chunks
          // Using href assignment with timestamp to bypass cache
          const url = new URL(window.location.href);
          url.searchParams.set('_t', Date.now().toString());
          window.location.href = url.toString();
        }, 100);
        
        // Never reaches here, but return promise for TypeScript
        return new Promise(() => {});
      } else {
        // Already reloaded once - don't loop
        log.error('❌ Chunk error persists after reload - deployment may still be in progress', {
          error: errorMessage,
          errorType: 'CHUNK_MISMATCH_PERSISTENT',
        });
        throw new Error(
          'Failed to load HashConnect due to deployment in progress. Please refresh the page in a few moments.'
        );
      }
    } else {
      // Not a chunk error - genuine initialization failure
      log.error('❌ HashConnect import failed (non-chunk error)', {
        error: errorMessage,
        errorType: 'IMPORT_ERROR',
        stack: error instanceof Error ? error.stack?.substring(0, 200) : undefined,
      });
      throw error;
    }
  }
}

// Lazy-loaded HashConnect modules (loaded on first use)
let HashConnect: any = null;
let HashConnectConnectionState: any = null;
let hashconnectLoaded = false;

// HashConnect instance (singleton)
let hashconnect: any = null;
let pairingData: HashConnectPairingData | null = null;
let pairingString: string | null = null;
let initPromise: Promise<void> | null = null;
let isInitialized = false;

// Wallet state
let walletState: WalletState = {
  isConnected: false,
  accountId: null,
  balances: {
    HBAR: '0.00000000',
    USDC: '0.000000',
    USDT: '0.000000',
    AUDD: '0.000000',
  },
  network: HASHCONNECT_CONFIG.NETWORK,
  isLoading: false,
  error: null,
};

// State change listeners
type StateChangeListener = (state: WalletState) => void;
const listeners: Set<StateChangeListener> = new Set();

/**
 * Dynamically load HashConnect library (called on first use)
 * Uses npm package via dynamic import (no CDN/script injection)
 */
async function loadHashConnect(): Promise<void> {
  if (hashconnectLoaded && HashConnect !== null) {
    log.info('✅ HashConnect module already loaded - reusing');
    return;
  }
  
  if (typeof window === 'undefined') {
    const error = new Error('HashConnect can only be loaded in the browser (window is undefined)');
    log.error('❌ Server-side HashConnect load attempt blocked', { 
      windowExists: false,
      isServer: true,
    });
    throw error;
  }

  try {
    log.info('📦 Loading HashConnect module via dynamic import...', {
      windowExists: typeof window !== 'undefined',
      navigatorExists: typeof navigator !== 'undefined',
    });

    // Dynamic import from npm package (NOT CDN) - single attempt with reload on chunk error
    const hashconnectModule = await loadHashConnectWithReload();
    
    if (!hashconnectModule.HashConnect) {
      throw new Error('HashConnect export not found in module');
    }

    if (!hashconnectModule.HashConnectConnectionState) {
      throw new Error('HashConnectConnectionState export not found in module');
    }

    HashConnect = hashconnectModule.HashConnect;
    HashConnectConnectionState = hashconnectModule.HashConnectConnectionState;
    hashconnectLoaded = true;
    
    log.info('✅ HashConnect module loaded successfully', {
      hasHashConnect: !!HashConnect,
      hasConnectionState: !!HashConnectConnectionState,
    });

  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack?.substring(0, 200), // First 200 chars of stack
      windowExists: typeof window !== 'undefined',
      moduleType: typeof error?.message === 'string' && error.message.includes('Cannot find module') ? 'MODULE_NOT_FOUND' : 'IMPORT_ERROR',
    };
    
    log.error('❌ Failed to load HashConnect module', errorDetails);
    
    throw new Error(`Failed to load HashConnect library: ${error?.message || 'Unknown error'}`);
  }
}

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
 * Initialize HashConnect (must be called before other operations)
 * Uses promise-based singleton pattern to prevent double initialization
 */
export async function initHashConnect(): Promise<void> {
  // Guard: Server-side check
  if (typeof window === 'undefined') {
    log.warn('Cannot initialize HashConnect on server (window undefined)');
    return;
  }

  // Guard: Already initialized
  if (isInitialized && hashconnect) {
    log.info('HashConnect already initialized - reusing singleton instance');
    return;
  }

  // Guard: Initialization in progress
  if (initPromise) {
    log.info('HashConnect initialization in progress - waiting for existing promise');
    return initPromise;
  }

  // Start initialization (store promise to prevent concurrent init)
  log.info('Starting HashConnect initialization', {
    network: HASHCONNECT_CONFIG.NETWORK,
    windowExists: typeof window !== 'undefined',
  });

  initPromise = (async () => {
    try {
      updateWalletState({ isLoading: true, error: null });

      // Load the library
      await loadHashConnect();

      // Create instance (singleton)
      if (!hashconnect) {
        hashconnect = new HashConnect();
        log.info('HashConnect instance created');
      }

      // Check if already paired/initialized
      const alreadyPaired = hashconnect.hcData?.pairingData && hashconnect.hcData.pairingData.length > 0;
      
      if (alreadyPaired) {
        // Rehydrate wallet state from existing pairing
        const existing = hashconnect.hcData.pairingData[0];
        pairingData = existing;
        const accountId = existing?.accountIds?.[0] ?? null;
        
        isInitialized = true;
        updateWalletState({
          isConnected: !!accountId,
          accountId,
          isLoading: false,
          error: null,
        });
        
        pairingString = null; // already paired; no need to open modal unless re-pairing
        log.info('✅ Rehydrated existing HashConnect pairing', { accountId });
        return;
      }

      // Initialize with app metadata
      log.info('Calling hashconnect.init()');
      await hashconnect.init(HASHCONNECT_CONFIG.APP_METADATA, HASHCONNECT_CONFIG.NETWORK, false);
      
      log.info('Calling hashconnect.connect()');
      pairingString = await hashconnect.connect();

      // Set up event listeners (only once)
      hashconnect.pairingEvent.on((data: any) => {
        log.info('Pairing event received', { 
          accountId: data.accountIds?.[0],
          topic: data.topic,
        });
        pairingData = data;
        
        const accountId = data.accountIds?.[0];
        if (accountId) {
          updateWalletState({
            isConnected: true,
            accountId,
            isLoading: false,
            error: null,
          });
        }
      });

      hashconnect.disconnectionEvent.on(() => {
        log.info('Wallet disconnected');
        pairingData = null;
        updateWalletState({
          isConnected: false,
          accountId: null,
          isLoading: false,
          balances: {
            HBAR: '0.00000000',
            USDC: '0.000000',
            USDT: '0.000000',
            AUDD: '0.000000',
          },
        });
      });

      hashconnect.connectionStatusChangeEvent.on((state: any) => {
        log.info('Connection status changed', { state });
        
        if (state === HashConnectConnectionState.Connected && pairingData?.accountIds?.[0]) {
          updateWalletState({
            isConnected: true,
            accountId: pairingData.accountIds[0],
            isLoading: false,
          });
        } else if (state === HashConnectConnectionState.Disconnected) {
          updateWalletState({
            isConnected: false,
            accountId: null,
            isLoading: false,
          });
        }
      });

      isInitialized = true;
      updateWalletState({ isLoading: false });
      log.info('✅ HashConnect initialized successfully (singleton pattern)');

    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        windowExists: typeof window !== 'undefined',
        alreadyPaired: hashconnect?.hcData?.pairingData?.length > 0,
      };
      
      log.error('❌ Failed to initialize HashConnect', errorDetails);
      
      updateWalletState({
        isLoading: false,
        error: error.message || 'Failed to initialize wallet',
      });
      
      // Reset promise so retry is possible
      initPromise = null;
      
      throw new Error(`HashConnect initialization failed: ${error.message}`);
    }
  })();

  return initPromise;
}

/**
 * Connect wallet (opens pairing modal)
 */
export async function connectWallet(): Promise<{
  accountId: string;
  network: string;
  pairingData?: any;
}> {
  if (!hashconnect) {
    throw new Error('HashConnect not initialized. Call initHashConnect() first.');
  }

  // Safety: ensure we're in browser context
  if (typeof window === 'undefined') {
    throw new Error('connectWallet() can only be called in browser context (window undefined)');
  }

  if (walletState.isConnected && walletState.accountId) {
    return {
      accountId: walletState.accountId,
      network: walletState.network,
      pairingData,
    };
  }

  try {
    updateWalletState({ isLoading: true, error: null });

    // Ensure we have a pairing URI before opening modal
    if (!pairingString) {
      log.info('No pairingString available - calling hashconnect.connect()');
      pairingString = await hashconnect.connect();
    }

    // Hard requirement: pairingString must exist
    if (!pairingString) {
      throw new Error('HashConnect pairing URI missing (pairingString). Cannot open pairing modal.');
    }

    // Open pairing modal WITH the pairing URI
    await hashconnect.openPairingModal(pairingString);

    // Wait for pairing (with timeout)
    const result = await new Promise<{ accountId: string; network: string; pairingData?: any }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Wallet connection timeout'));
        }, 60000); // 60 second timeout

        const checkConnection = setInterval(() => {
          if (walletState.isConnected && walletState.accountId) {
            clearTimeout(timeout);
            clearInterval(checkConnection);
            resolve({
              accountId: walletState.accountId,
              network: walletState.network,
              pairingData,
            });
          }
        }, 100);
      }
    );

    updateWalletState({ isLoading: false });
    return result;

  } catch (error: any) {
    log.error('Failed to connect wallet', { error: error.message });
    updateWalletState({
      isLoading: false,
      error: error.message || 'Failed to connect wallet',
    });
    throw error;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (!hashconnect) {
    return;
  }

  try {
    if (pairingData?.topic) {
      await hashconnect.disconnect(pairingData.topic);
    }
    
    pairingData = null;
    updateWalletState({
      isConnected: false,
      accountId: null,
      balances: {
        HBAR: '0.00000000',
        USDC: '0.000000',
        USDT: '0.000000',
      },
    });

    log.info('Wallet disconnected successfully');
  } catch (error: any) {
    log.error('Failed to disconnect wallet', { error: error.message });
    throw error;
  }
}

/**
 * Get current connection state (synchronous)
 */
export function getConnectionState(): {
  ready: boolean;
  connected: boolean;
  accountId?: string;
  network?: string;
  isLoading?: boolean;
  error?: string | null;
} {
  return {
    ready: hashconnect !== null,
    connected: walletState.isConnected,
    accountId: walletState.accountId || undefined,
    network: walletState.network,
    isLoading: walletState.isLoading,
    error: walletState.error,
  };
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
 * Update wallet balances (called after fetching from API)
 */
export function updateWalletBalances(balances: {
  HBAR?: string;
  USDC?: string;
  USDT?: string;
}): void {
  updateWalletState({
    balances: {
      ...walletState.balances,
      ...balances,
    },
  });
}

/**
 * Sign and submit transaction (if needed client-side)
 */
export async function signAndSubmitTransaction(
  transactionBytes: Uint8Array,
  accountId: string
): Promise<{ transactionId: string; receipt?: any }> {
  if (!hashconnect || !pairingData) {
    throw new Error('Wallet not connected');
  }

  try {
    const result = await hashconnect.sendTransaction(pairingData.topic, {
      topic: pairingData.topic,
      byteArray: transactionBytes,
      metadata: {
        accountToSign: accountId,
        returnTransaction: false,
      },
    });

    return {
      transactionId: result.transactionId || result.response?.transactionId,
      receipt: result.receipt || result.response?.receipt,
    };
  } catch (error: any) {
    log.error('Failed to sign transaction', { error: error.message });
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

