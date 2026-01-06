/**
 * HashConnect Singleton Client
 * 
 * ⚠️  CRITICAL: THIS IS THE ONLY FILE ALLOWED TO IMPORT 'hashconnect' ⚠️
 * 
 * This module provides a singleton instance of HashConnect
 * that is initialized only once per browser session.
 * 
 * ALL other files MUST import from this module, never from 'hashconnect' directly.
 * 
 * Must only be used in client-side code (browser).
 * Dynamically imports HashConnect at runtime to avoid SSR issues.
 * 
 * To verify no duplicate imports exist, run:
 * grep -r "from 'hashconnect'" src/ --exclude=hashconnectClient.ts
 * grep -r "import('hashconnect')" src/ --exclude=hashconnectClient.ts
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
  balances: {
    HBAR: string;
    USDC: string;
    USDT: string;
    AUDD: string;
  };
}

let walletState: WalletState = {
  isConnected: false,
  accountId: null,
  network: HASHCONNECT_CONFIG.NETWORK,
  isLoading: false,
  error: null,
  balances: {
    HBAR: '0.00000000',
    USDC: '0.000000',
    USDT: '0.000000',
    AUDD: '0.000000',
  },
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
  console.log('[HashConnect] walletState updated:', walletState);
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
      const hashconnectModule = await import('hashconnect');
      const { HashConnect } = hashconnectModule;

      // Determine ledger ID based on network (use string literal for v3)
      const ledgerId = HASHCONNECT_CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

      // Create mutable copy of metadata to satisfy HashConnect typing
      const metadata = {
        name: HASHCONNECT_CONFIG.APP_METADATA.name,
        description: HASHCONNECT_CONFIG.APP_METADATA.description,
        url: HASHCONNECT_CONFIG.APP_METADATA.url,
        icons: [...HASHCONNECT_CONFIG.APP_METADATA.icons],
      };

      // Create HashConnect instance with v3 constructor
      // Cast ledgerId as any since TypeScript expects LedgerId enum but runtime accepts string
      const hashconnect = new HashConnect(
        ledgerId as any,
        projectId,
        metadata,
        true // multiAccount
      );

      // 🔍 DEBUG: Log available methods on HashConnect instance
      console.log('[HashConnect] instance keys:', Object.keys(hashconnect));
      console.log('[HashConnect] connect type:', typeof (hashconnect as any).connect);
      console.log('[HashConnect] generatePairingString type:', typeof (hashconnect as any).generatePairingString);
      console.log('[HashConnect] openPairingModal type:', typeof (hashconnect as any).openPairingModal);
      console.log('[HashConnect] hcData exists:', !!(hashconnect as any).hcData);

      // Check if already paired from previous session
      const alreadyPaired = (hashconnect as any).hcData?.pairingData && (hashconnect as any).hcData.pairingData.length > 0;
      
      if (alreadyPaired) {
        // Rehydrate wallet state from existing pairing
        const existing = (hashconnect as any).hcData.pairingData[0];
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
        // Initialize HashConnect (metadata already passed to constructor)
        console.log('[HashConnect] Initializing with metadata:', metadata);
        console.log('[HashConnect] network:', HASHCONNECT_CONFIG.NETWORK);
        console.log('[HashConnect] ledgerId:', ledgerId);
        console.log('[HashConnect] projectId present:', !!projectId);

        const initFn = (hashconnect as any).init;

        // Try both common HashConnect v3 init signatures
        try {
          // Signature #1: init() - no args (metadata in constructor)
          await initFn.call(hashconnect);
          console.log('[HashConnect] init succeeded with signature A (no args)');
        } catch (e1) {
          console.warn('[HashConnect] init signature A failed, trying with metadata params', e1);
          
          try {
            // Signature #2: init(metadata, network, multiAccount)
            await initFn.call(hashconnect, metadata, ledgerId, false);
            console.log('[HashConnect] init succeeded with signature B (metadata params)');
          } catch (e2) {
            console.warn('[HashConnect] init signature B failed, trying with projectId first', e2);
            
            // Signature #3: init(projectId, metadata, network, multiAccount)
            await initFn.call(hashconnect, projectId, metadata, ledgerId, false);
            console.log('[HashConnect] init succeeded with signature C (projectId first)');
          }
        }
        
        // Note: HashConnect v3+ generates pairing string internally in openPairingModal()
        // No need to call connect() or generatePairingString() here
        console.log('[HashConnect] Init complete - pairing string will be generated when modal opens');
        
        updateWalletState({ isLoading: false });
      }

      // Register event listeners (ONCE)
      (hashconnect as any).pairingEvent.on((pairingData: any) => {
        console.log('[HashConnect] ========== PAIRING EVENT FIRED ==========');
        console.log('[HashConnect] pairingEvent raw:', pairingData);
        console.log('[HashConnect] pairingEvent accountIds:', pairingData?.accountIds);
        console.log('[HashConnect] pairingEvent topic:', pairingData?.topic);
        
        // Extract topic from various possible locations
        let topic = pairingData?.topic;
        
        // If topic not in event, try to get it from the active session (not pairings)
        // The session contains the actual WalletConnect session after approval
        if (!topic && (hashconnect as any).core?.session) {
          try {
            const sessions = (hashconnect as any).core.session.getAll?.();
            console.log('[HashConnect] Checking core.session.getAll():', sessions);
            if (sessions && sessions.length > 0) {
              // Get the most recently created session (highest expiry time)
              const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
              topic = sortedSessions[0].topic;
              console.log('[HashConnect] ✅ Found topic in core.session (most recent):', topic);
            }
          } catch (e) {
            console.warn('[HashConnect] Failed to get sessions from core:', e);
          }
        }
        
        // Fallback: try core.pairing if session lookup failed
        if (!topic && (hashconnect as any).core?.pairing) {
          try {
            const pairings = (hashconnect as any).core.pairing.pairings?.getAll?.();
            console.log('[HashConnect] Fallback: checking core.pairing.pairings.getAll():', pairings);
            if (pairings && pairings.length > 0) {
              // Get most recently created pairing
              const sortedPairings = pairings.sort((a: any, b: any) => b.expiry - a.expiry);
              topic = sortedPairings[0].topic;
              console.log('[HashConnect] ✅ Found topic in core.pairing.pairings (fallback):', topic);
            }
          } catch (e) {
            console.warn('[HashConnect] Failed to get pairings from core:', e);
          }
        }
        
        // Store pairing data with topic
        latestPairingData = {
          ...pairingData,
          topic: topic || null,
        };
        console.log('[HashConnect] latestPairingData updated with topic:', latestPairingData);
        
        const accountId = pairingData?.accountIds?.[0];
        if (accountId) {
          console.log('[HashConnect] Updating wallet state with accountId:', accountId);
          updateWalletState({
            isConnected: true,
            accountId,
            isLoading: false,
            error: null,
          });
        }
        console.log('[HashConnect] ========== PAIRING EVENT COMPLETE ==========');
      });

      (hashconnect as any).connectionStatusChangeEvent.on((status: any) => {
        console.log('[HashConnect] Connection status changed:', status);
        latestConnectionStatus = status;
        
        // When status becomes "Paired", try to capture the topic from active session
        if (status === 'Paired' && latestPairingData && !latestPairingData.topic) {
          console.log('[HashConnect] Status is Paired, attempting to capture topic from session...');
          
          // Try to get topic from active session first (this is the correct source)
          if ((hashconnect as any).core?.session) {
            try {
              const sessions = (hashconnect as any).core.session.getAll();
              console.log('[HashConnect] Sessions from core.session:', sessions);
              if (sessions && sessions.length > 0) {
                // Get the most recently created session
                const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
                const topic = sortedSessions[0].topic;
                console.log('[HashConnect] ✅ Captured topic on Paired status from session:', topic);
                latestPairingData.topic = topic;
                
                // Update wallet state to trigger re-render
                updateWalletState({ ...walletState });
              }
            } catch (e) {
              console.warn('[HashConnect] Failed to capture topic on Paired status:', e);
            }
          }
        }
      });

      (hashconnect as any).disconnectionEvent.on(() => {
        console.log('[HashConnect] Disconnected');
        latestPairingData = null;
        pairingString = null;
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
 * Open HashPack pairing modal with retry logic for transient errors
 * Automatically calls initHashConnect() first
 * @param retryCount Internal counter to prevent infinite recursion (default 0)
 */
export async function openHashpackPairingModal(retryCount: number = 0): Promise<void> {
  // Ensure HashConnect is initialized first
  await initHashConnect();
  
  if (!hc) {
    throw new Error('HashConnect initialization failed - cannot open pairing modal');
  }

  // Validate openPairingModal exists
  const openModalFn = (hc as any).openPairingModal;
  if (typeof openModalFn !== 'function') {
    throw new Error(
      'openPairingModal not available on HashConnect instance. Available methods: ' + 
      Object.keys(hc).filter(k => typeof (hc as any)[k] === 'function').join(', ')
    );
  }

  // Brief delay to allow HashPack extension to fully initialize
  await new Promise(resolve => setTimeout(resolve, 300));

  try {
    console.log('[HashConnect] Opening pairing modal...');
    
    // Prefer calling with no arguments (v3+ generates pairing string internally)
    // If openPairingModal.length > 0 and we have a pairingString, pass it
    if (openModalFn.length > 0 && pairingString) {
      console.log('[HashConnect] Calling openPairingModal(pairingString)');
      await openModalFn.call(hc, pairingString);
    } else {
      console.log('[HashConnect] Calling openPairingModal() with no arguments');
      await openModalFn.call(hc);
    }
    
    console.log('[HashConnect] Pairing modal opened successfully');
  } catch (err) {
    // Check for transient errors that warrant a retry
    const msg = String((err as any)?.message ?? err).toLowerCase();
    const isTransient = 
      msg.includes('proposal expired') || 
      msg.includes('uri') || 
      msg.includes('missing') ||
      msg.includes('not ready') ||
      isUriMissingError(err);

    if (isTransient && retryCount === 0) {
      console.warn('[HashConnect] Transient error detected, retrying once...', err);
      await new Promise(resolve => setTimeout(resolve, 600));
      return openHashpackPairingModal(1); // Retry with counter = 1
    }
    
    // No retry or already retried once - throw the error
    throw err;
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
      await (hc as any).disconnect(latestPairingData.topic);
    }
    
    latestPairingData = null;
    pairingString = null;
    
    updateWalletState({
      isConnected: false,
      accountId: null,
      isLoading: false,
      error: null,
      balances: {
        HBAR: '0.00000000',
        USDC: '0.000000',
        USDT: '0.000000',
        AUDD: '0.000000',
      },
    });

    console.log('[HashConnect] Wallet disconnected successfully');
  } catch (error) {
    console.error('[HashConnect] Failed to disconnect wallet:', error);
    throw error;
  }
}

/**
 * Update wallet balances
 */
export function updateWalletBalances(balances: {
  HBAR?: string;
  USDC?: string;
  USDT?: string;
  AUDD?: string;
}): void {
  updateWalletState({
    balances: {
      ...walletState.balances,
      ...balances,
    },
  });
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
 * Falls back to checking HashConnect instance directly if event data not available
 * 
 * HashConnect v3 stores the topic separately from the pairing event data
 */
export function getLatestPairingData(): any {
  // Check if we have pairing data from event
  if (!latestPairingData || !latestPairingData.accountIds) {
    // No pairing data at all
    if (hc && (hc as any).hcData?.pairingData) {
      const pairings = (hc as any).hcData.pairingData;
      if (Array.isArray(pairings) && pairings.length > 0) {
        latestPairingData = pairings[0];
        console.log('[HashConnect] getLatestPairingData - loaded from hcData:', latestPairingData);
      }
    }
  }
  
  // If we have pairing data but no topic, try to find it
  if (latestPairingData && !latestPairingData.topic) {
    console.log('[HashConnect] Pairing data exists but no topic, searching...');
    
    // Try to get topic from HashConnect instance
    // In HashConnect v3, the topic is in the WalletConnect core
    
    // PRIORITY 1: Check core.session (active WalletConnect sessions - this is the correct source!)
    if (hc && (hc as any).core?.session) {
      try {
        const sessions = (hc as any).core.session.getAll?.();
        console.log('[HashConnect] core.session.getAll():', sessions);
        if (sessions && sessions.length > 0) {
          // Get the most recently created session (highest expiry)
          const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
          if (sortedSessions[0].topic) {
            console.log('[HashConnect] ✅ Found topic in core.session (most recent):', sortedSessions[0].topic);
            latestPairingData.topic = sortedSessions[0].topic;
            return latestPairingData;
          }
        }
      } catch (e) {
        console.warn('[HashConnect] Failed to get sessions from core.session:', e);
      }
    }
    
    // PRIORITY 2: Check core.pairing.pairings (fallback)
    if (hc && (hc as any).core?.pairing?.pairings) {
      try {
        const pairings = (hc as any).core.pairing.pairings.getAll();
        console.log('[HashConnect] core.pairing.pairings.getAll():', pairings);
        if (pairings && pairings.length > 0) {
          // Get the most recent pairing
          const sortedPairings = pairings.sort((a: any, b: any) => b.expiry - a.expiry);
          if (sortedPairings[0].topic) {
            console.log('[HashConnect] ✅ Found topic in core.pairing.pairings:', sortedPairings[0].topic);
            latestPairingData.topic = sortedPairings[0].topic;
            return latestPairingData;
          }
        }
      } catch (e) {
        console.warn('[HashConnect] Failed to get pairings from core.pairing:', e);
      }
    }
    
    // PRIORITY 3: Check hcData.pairingData (last resort fallback)
    if (hc && (hc as any).hcData?.pairingData) {
      const pairings = (hc as any).hcData.pairingData;
      if (Array.isArray(pairings) && pairings.length > 0) {
        const pairing = pairings[pairings.length - 1];
        if (pairing.topic) {
          console.log('[HashConnect] ✅ Found topic in hcData.pairingData:', pairing.topic);
          latestPairingData.topic = pairing.topic;
          return latestPairingData;
        }
      }
    }
    
    console.warn('[HashConnect] ⚠️ Could not find topic in any known location');
    console.warn('[HashConnect] This may prevent transaction signing. Please reconnect your wallet.');
  }
  
  if (latestPairingData && latestPairingData.topic) {
    return latestPairingData;
  }
  
  console.warn('[HashConnect] getLatestPairingData - no valid pairing data with topic available');
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
