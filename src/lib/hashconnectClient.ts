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

  // Already initialized - ensure SignClient is initialized too
  if (hc !== null) {
    console.log('[HashConnect] Already initialized - reusing singleton');
    
    // Check if SignClient needs initialization
    if (!(hc as any).signClient && !(hc as any)._initPromise) {
      console.log('[HashConnect] SignClient not initialized - starting background init...');
      
      // Start init() in background with timeout protection
      const initFn = (hc as any).init;
      if (typeof initFn === 'function') {
        // Wrap init() with a 3-second timeout
        const initWithTimeout = Promise.race([
          initFn.call(hc),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Init timeout after 3s')), 3000)
          )
        ]);
        
        (hc as any)._initPromise = initWithTimeout.then(() => {
          console.log('[HashConnect] ✅ Background SignClient init completed');
          delete (hc as any)._initPromise;
        }).catch((err: any) => {
          console.warn('[HashConnect] Background SignClient init failed/timeout (continuing anyway):', err.message);
          delete (hc as any)._initPromise;
        });
      }
    } else if ((hc as any).signClient) {
      console.log('[HashConnect] SignClient already initialized ✅');
    }
    
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

      // Pre-initialization cleanup: Clear any corrupted WalletConnect sessions
      // This fixes the hang issue when there are stale sessions from previous browser sessions
      try {
        console.log('[HashConnect] 🧹 Pre-init cleanup: Clearing corrupted WalletConnect sessions...');
        
        // Check for corrupted WalletConnect data in localStorage
        const storageKeys = Object.keys(localStorage);
        const wcKeys = storageKeys.filter(key => 
          key.startsWith('wc@2:') || 
          key.startsWith('WALLETCONNECT_') ||
          key.includes('wallet_connect')
        );
        
        if (wcKeys.length > 0) {
          console.log(`[HashConnect] Found ${wcKeys.length} WalletConnect keys in localStorage`);
          
          // Only clear if there are signs of corruption (excessive keys or old timestamps)
          if (wcKeys.length > 10) {
            console.log('[HashConnect] ⚠️  Excessive WalletConnect keys detected, clearing all...');
            wcKeys.forEach(key => {
              try {
                localStorage.removeItem(key);
              } catch {
                // Ignore errors - some keys might be read-only
              }
            });
            console.log('[HashConnect] ✅ Cleared all WalletConnect keys');
          } else {
            console.log('[HashConnect] WalletConnect key count is normal, keeping existing sessions');
          }
        } else {
          console.log('[HashConnect] No WalletConnect keys found in localStorage');
        }
      } catch (cleanupError) {
        // Don't fail initialization if cleanup fails
        console.warn('[HashConnect] Pre-init cleanup failed (non-fatal):', cleanupError);
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

        // ✅ HashConnect v3.0.14: Start SignClient initialization in background
        // Don't await it here - let it initialize while we set up event listeners
        // We'll wait for it when we actually need to generate a pairing string
        console.log('[HashConnect] Starting WalletConnect SignClient initialization...');
        const initFn = (hashconnect as any).init;
        if (typeof initFn === 'function') {
          // Start init in background with 3s timeout - don't await
          const initWithTimeout = Promise.race([
            initFn.call(hashconnect),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Init timeout after 3s')), 3000)
            )
          ]);
          
          initWithTimeout
            .then(() => console.log('[HashConnect] ✅ Background init completed'))
            .catch((err: any) => {
              console.warn('[HashConnect] Background init failed/timeout (continuing anyway):', err.message);
            });
          
          console.log('[HashConnect] SignClient initialization started in background');
        } else {
          console.log('[HashConnect] No init() method found - SignClient may initialize lazily');
        }
        
        // Clean up any old/stale sessions after initialization
        console.log('[HashConnect] Checking for old sessions to clean up...');
        await cleanupOldSessions();
        
        updateWalletState({ isLoading: false });
      }

      // Register event listeners (ONCE)
      (hashconnect as any).pairingEvent.on(async (pairingData: any) => {
        console.log('[HashConnect] ========== PAIRING EVENT FIRED ==========');
        console.log('[HashConnect] pairingEvent raw:', pairingData);
        console.log('[HashConnect] pairingEvent accountIds:', pairingData?.accountIds);
        console.log('[HashConnect] pairingEvent topic:', pairingData?.topic);
        
        // Extract topic from various possible locations
        let topic = pairingData?.topic;
        
        // Debug: Check if core.session exists
        console.log('[HashConnect] Checking for core.session...');
        console.log('[HashConnect] (hashconnect as any).core exists?', !!(hashconnect as any).core);
        console.log('[HashConnect] (hashconnect as any).core.session exists?', !!(hashconnect as any).core?.session);
        
        if ((hashconnect as any).core) {
          console.log('[HashConnect] core properties:', Object.keys((hashconnect as any).core));
        }
        
        // If topic not in event, wait a moment then try to get it from the active session
        // The session needs a moment to be created after approval AND synced to _signClient
        if (!topic && (hashconnect as any).core?.session) {
          console.log('[HashConnect] Topic not in event, waiting for session to be created and synced...');
          await new Promise(resolve => setTimeout(resolve, 800)); // Wait for session creation and sync
          
          try {
            const sessions = (hashconnect as any).core.session.getAll?.();
            console.log('[HashConnect] Checking core.session.getAll() after delay:', sessions);
            if (sessions && sessions.length > 0) {
              // Get the most recently created session (highest expiry time)
              const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
              topic = sortedSessions[0].topic;
              console.log('[HashConnect] ✅ Found topic in core.session (most recent):', topic);
            } else {
              console.warn('[HashConnect] No sessions found after waiting');
            }
          } catch (e) {
            console.warn('[HashConnect] Failed to get sessions from core:', e);
          }
        } else if (!topic) {
          console.warn('[HashConnect] ⚠️ core.session does not exist - cannot get session topic from there');
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
              console.log('[HashConnect] ⚠️  Using fallback topic from core.pairing.pairings:', topic);
            }
          } catch (e) {
            console.warn('[HashConnect] Failed to get pairings from core:', e);
          }
        }
        
        // Store pairing data with topic
        // IMPORTANT: Preserve existing topic from approval event if it was already set
        const existingTopic = latestPairingData?.topic;
        latestPairingData = {
          ...pairingData,
          topic: existingTopic || topic || null, // Prefer existing topic from approval event
        };
        console.log('[HashConnect] latestPairingData updated:', {
          hasExistingTopic: !!existingTopic,
          newTopic: topic,
          finalTopic: latestPairingData.topic,
        });
        
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

      // Listen to approval event (fires when wallet approves the pairing with session topic)
      (hashconnect as any).approveEvent.on((approvalData: any) => {
        console.log('[HashConnect] ========== APPROVAL EVENT FIRED ==========');
        console.log('[HashConnect] Approval data:', approvalData);
        console.log('[HashConnect] Approval topic:', approvalData?.topic);
        console.log('[HashConnect] latestPairingData before update:', latestPairingData);
        
        // Store the session topic from the approval event
        if (approvalData?.topic) {
          console.log('[HashConnect] ✅ Storing session topic from approval event:', approvalData.topic);
          
          // Initialize latestPairingData if it doesn't exist yet
          if (!latestPairingData) {
            console.log('[HashConnect] Initializing latestPairingData from approval event');
            latestPairingData = {
              topic: approvalData.topic,
              accountIds: [],
              network: 'testnet',
            };
          } else {
            latestPairingData.topic = approvalData.topic;
          }
          
          console.log('[HashConnect] latestPairingData after update:', latestPairingData);
          
          // Update wallet state to trigger re-render
          updateWalletState({ ...walletState });
        } else {
          console.warn('[HashConnect] Approval event fired but no topic provided');
        }
        console.log('[HashConnect] ========== APPROVAL EVENT COMPLETE ==========');
      });

      (hashconnect as any).connectionStatusChangeEvent.on(async (status: any) => {
        console.log('[HashConnect] Connection status changed:', status);
        latestConnectionStatus = status;
        
        // When status becomes "Paired", try to capture the topic from active session
        if (status === 'Paired' && latestPairingData && !latestPairingData.topic) {
          console.log('[HashConnect] Status is Paired, waiting for session to be fully created and synced...');
          
          // Wait a bit for the session to be properly registered in both core.session and _signClient
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Try to get topic from active session first (this is the correct source)
          if ((hashconnect as any).core?.session) {
            try {
              const sessions = (hashconnect as any).core.session.getAll();
              console.log('[HashConnect] Sessions from core.session after delay:', sessions);
              if (sessions && sessions.length > 0) {
                // Get the most recently created session
                const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
                const topic = sortedSessions[0].topic;
                console.log('[HashConnect] ✅ Captured topic on Paired status from session:', topic);
                latestPairingData.topic = topic;
                
                // Update wallet state to trigger re-render
                updateWalletState({ ...walletState });
              } else {
                console.warn('[HashConnect] No sessions found in core.session after delay');
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
    
    // HashConnect v3: Wait for WalletConnect SignClient to be ready
    // First, wait for any in-progress init() to complete (with timeout)
    if ((hc as any)._initPromise) {
      console.log('[HashConnect] Waiting for background init() to complete...');
      try {
        await Promise.race([
          (hc as any)._initPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Init wait timeout')), 3000)
          )
        ]);
        console.log('[HashConnect] Background init() completed');
      } catch (err: any) {
        console.warn('[HashConnect] Background init() wait failed/timeout (continuing anyway):', err.message);
      }
    }
    
    // Then check if SignClient is ready, with fallback wait
    const maxWaitTime = 2000; // 2 seconds max wait
    const startTime = Date.now();
    
    while (!(hc as any).signClient && (Date.now() - startTime) < maxWaitTime) {
      console.log('[HashConnect] Waiting for SignClient to be ready...');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // If SignClient still not ready, try to force initialization
    if (!(hc as any).signClient) {
      console.warn('[HashConnect] SignClient not ready after wait, trying to proceed anyway...');
      console.log('[HashConnect] Available HashConnect keys:', Object.keys(hc));
      
      // Last resort: Try calling init() directly one more time with short timeout
      const initFn = (hc as any).init;
      if (typeof initFn === 'function') {
        console.log('[HashConnect] Attempting emergency init()...');
        try {
          await Promise.race([
            initFn.call(hc),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Emergency init timeout')), 2000))
          ]);
          console.log('[HashConnect] Emergency init() succeeded');
        } catch {
          console.error('[HashConnect] Emergency init() also failed');
          throw new Error('Unable to initialize HashConnect wallet connection. Please refresh the page and try again.');
        }
      } else {
        throw new Error('HashConnect SignClient unavailable. Please refresh the page and try again.');
      }
    }
    
    console.log('[HashConnect] ✅ SignClient is ready');
    
    // HashConnect v3: Generate pairing string first if we don't have one
    if (!pairingString) {
      const generatePairingStringFn = (hc as any).generatePairingString;
      if (typeof generatePairingStringFn === 'function') {
        console.log('[HashConnect] Generating pairing string...');
        try {
          pairingString = await generatePairingStringFn.call(hc);
          console.log('[HashConnect] Pairing string generated:', pairingString ? 'success' : 'failed');
        } catch (genError: any) {
          console.error('[HashConnect] Failed to generate pairing string:', genError);
          throw new Error(`Pairing string generation failed: ${genError.message}`);
        }
      } else {
        console.warn('[HashConnect] generatePairingString not available, modal may not work properly');
      }
    }
    
    // Call openPairingModal - try with pairing string first, then without
    if (pairingString) {
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
        console.log('[HashConnect] 🔍 Checking core.session.getAll():', sessions);
        console.log('[HashConnect] 🔍 Number of sessions found:', sessions?.length || 0);
        
        if (sessions && sessions.length > 0) {
          // Log details of all sessions
          sessions.forEach((session: any, index: number) => {
            console.log(`[HashConnect] Session ${index}:`, {
              topic: session.topic,
              expiry: session.expiry,
              pairingTopic: session.pairingTopic,
              acknowledged: session.acknowledged,
            });
          });
          
          // Get the most recently created session (highest expiry)
          const sortedSessions = sessions.sort((a: any, b: any) => b.expiry - a.expiry);
          if (sortedSessions[0].topic) {
            console.log('[HashConnect] ✅ Found SESSION topic in core.session (most recent):', sortedSessions[0].topic);
            latestPairingData.topic = sortedSessions[0].topic;
            return latestPairingData;
          }
        } else {
          console.warn('[HashConnect] ⚠️  No sessions found in core.session - session may not be fully established yet');
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
 * Get the active session topic (needed for signing transactions)
 * This is different from the pairing topic!
 * Retries with delays to allow session to be fully established
 * 
 * @param maxRetries Maximum number of retry attempts (default 3)
 * @param delayMs Delay between retries in milliseconds (default 300)
 * @returns Session topic string or null if not found
 */
export async function getSessionTopic(maxRetries: number = 3, delayMs: number = 300): Promise<string | null> {
  console.log('[HashConnect] getSessionTopic - starting search...');
  
  if (!hc) {
    console.warn('[HashConnect] HashConnect not initialized');
    return null;
  }
  
  console.log('[HashConnect] Checking HashConnect structure...');
  console.log('[HashConnect] hc exists:', !!hc);
  console.log('[HashConnect] hc.core exists:', !!(hc as any).core);
  console.log('[HashConnect] hc.core.session exists:', !!(hc as any).core?.session);
  console.log('[HashConnect] hc.core.session.getAll exists:', typeof (hc as any).core?.session?.getAll);
  console.log('[HashConnect] hc._signClient exists:', !!(hc as any)._signClient);
  console.log('[HashConnect] hc._signClient.session exists:', !!(hc as any)._signClient?.session);
  
  // Log available methods on core
  if ((hc as any).core) {
    console.log('[HashConnect] core properties:', Object.keys((hc as any).core));
  }
  
  // Log available methods on _signClient
  if ((hc as any)._signClient) {
    console.log('[HashConnect] _signClient properties:', Object.keys((hc as any)._signClient));
    if ((hc as any)._signClient.session) {
      console.log('[HashConnect] _signClient.session properties:', Object.keys((hc as any)._signClient.session));
    }
  }
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[HashConnect] getSessionTopic - retry attempt ${attempt}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Try to get sessions from both locations
    let coreSessions: any[] | null = null;
    let signClientSessions: any[] | null = null;
    
    // Method 1: Try core.session (WalletConnect v2 standard location - may not exist in all versions)
    if ((hc as any).core?.session) {
      try {
        const sessionObj = (hc as any).core.session;
        console.log(`[HashConnect] Attempt ${attempt}: Trying core.session...`);
        console.log(`[HashConnect] Attempt ${attempt}: sessionObj type:`, typeof sessionObj);
        console.log(`[HashConnect] Attempt ${attempt}: sessionObj keys:`, Object.keys(sessionObj));
        
        coreSessions = sessionObj.getAll?.();
        console.log(`[HashConnect] Attempt ${attempt}: core.session.getAll() returned:`, coreSessions?.length || 0, 'sessions');
      } catch (e) {
        console.error(`[HashConnect] Attempt ${attempt}: Error accessing core.session:`, e);
      }
    } else {
      console.log(`[HashConnect] Attempt ${attempt}: core.session does not exist (not used in this HashConnect version)`);
    }
    
    // Method 2: Check _signClient.session (REQUIRED - this is where the signer looks for sessions)
    if ((hc as any)._signClient?.session) {
      try {
        const sessionObj = (hc as any)._signClient.session;
        console.log(`[HashConnect] Attempt ${attempt}: Checking _signClient.session...`);
        console.log(`[HashConnect] Attempt ${attempt}: _signClient.session keys:`, Object.keys(sessionObj));
        
        signClientSessions = sessionObj.getAll?.();
        console.log(`[HashConnect] Attempt ${attempt}: _signClient.session.getAll() returned:`, signClientSessions?.length || 0, 'sessions');
      } catch (e) {
        console.error(`[HashConnect] Attempt ${attempt}: Error accessing _signClient.session:`, e);
      }
    }
    
    // Use _signClient.session as primary (required for signing)
    // core.session may not exist in some HashConnect versions
    const sessionsToUse = signClientSessions || coreSessions;
    
    // If no sessions found at all, retry
    if (!sessionsToUse || sessionsToUse.length === 0) {
      if (attempt < maxRetries) {
        console.warn(`[HashConnect] Attempt ${attempt}: No sessions found yet, will retry...`);
        continue;
      }
    }
    
    // Process sessions if found
    if (sessionsToUse && sessionsToUse.length > 0) {
      // Log all sessions
      console.log(`[HashConnect] Attempt ${attempt}: All sessions found:`, sessionsToUse);
      
      // Filter sessions to only those with Hedera namespace AND are acknowledged
      const hederaSessions = sessionsToUse.filter((s: any) => {
        const hasHederaNamespace = s?.namespaces?.hedera;
        const isAcknowledged = s?.acknowledged !== false; // Treat undefined as true
        console.log(`[HashConnect] Session ${s.topic?.substring(0, 8)}... has hedera namespace:`, !!hasHederaNamespace, ', acknowledged:', isAcknowledged);
        if (hasHederaNamespace) {
          console.log(`[HashConnect] Session ${s.topic?.substring(0, 8)}... hedera chains:`, s.namespaces.hedera.chains);
          console.log(`[HashConnect] Session ${s.topic?.substring(0, 8)}... hedera accounts:`, s.namespaces.hedera.accounts);
          console.log(`[HashConnect] 🔍 FIRST ACCOUNT FORMAT IN SESSION:`, s.namespaces.hedera.accounts?.[0]);
        }
        return hasHederaNamespace && isAcknowledged;
      });
      
      console.log(`[HashConnect] Attempt ${attempt}: Filtered to ${hederaSessions.length} acknowledged Hedera-enabled sessions`);
      
      if (hederaSessions.length === 0) {
        console.warn(`[HashConnect] Attempt ${attempt}: No acknowledged sessions with Hedera namespace found`);
        if (attempt < maxRetries) {
          console.log(`[HashConnect] Attempt ${attempt}: Will retry to allow session to be acknowledged...`);
          continue;
        }
      } else {
        // Get the stored topic from pairing data
        const storedTopic = latestPairingData?.topic;
        console.log(`[HashConnect] Stored topic from pairing/approval: ${storedTopic?.substring(0, 8)}...`);
        console.log(`[HashConnect] Available sessions:`, hederaSessions.map((s: any) => ({
          session: s.topic.substring(0, 8) + '...',
          pairing: s.pairingTopic?.substring(0, 8) + '...',
        })));
        
        // IMPORTANT: latestPairingData.topic could be either a SESSION topic (from approval event)
        // or a PAIRING topic (from pairing event). We need to check both!
        
        // DEBUG: Check exact matching logic
        console.log(`[HashConnect] 🔍 TOPIC MATCHING DEBUG:`);
        console.log(`[HashConnect]   Stored topic: ${storedTopic}`);
        hederaSessions.forEach((s: any, idx: number) => {
          const matchesTopic = s.topic === storedTopic;
          const matchesPairing = s.pairingTopic === storedTopic;
          console.log(`[HashConnect]   Session ${idx + 1}:`, {
            topic: s.topic,
            pairingTopic: s.pairingTopic,
            matchesTopic,
            matchesPairing,
            willSelect: matchesTopic || matchesPairing,
          });
        });
        
        let session = hederaSessions.find((s: any) => 
          s.topic === storedTopic || s.pairingTopic === storedTopic
        );
        
        if (!session) {
          console.error(`[HashConnect] ❌ CRITICAL: Stored topic does NOT match any of the ${hederaSessions.length} available sessions!`);
          console.error(`[HashConnect] This means you likely have OLD sessions from previous pairings`);
          console.error(`[HashConnect] SOLUTION: Disconnect wallet and clear old sessions, then reconnect`);
          
          // Use the most recently created session as fallback
          console.warn(`[HashConnect] Using fallback: most recent session by expiry (may not work)`);
          const sortedSessions = hederaSessions.sort((a: any, b: any) => b.expiry - a.expiry);
          session = sortedSessions[0];
          console.log(`[HashConnect] Selected session: ${session.topic.substring(0, 8)}... (pairing: ${session.pairingTopic?.substring(0, 8)}...)`);
        } else {
          console.log(`[HashConnect] ✅ Found matching session! (by session topic or pairing topic)`);
          console.log(`[HashConnect] Using session: ${session.topic.substring(0, 8)}... (pairing: ${session.pairingTopic?.substring(0, 8)}...)`);
        }
        
        const sessionTopic = session.topic;
        
        if (sessionTopic) {
          console.log('[HashConnect] ✅ Found valid HEDERA SESSION topic:', sessionTopic);
          console.log('[HashConnect] Session details:', {
            topic: sessionTopic,
            expiry: session.expiry,
            pairingTopic: session.pairingTopic,
            acknowledged: session.acknowledged,
            hederaChains: session.namespaces.hedera.chains,
            hederaAccounts: session.namespaces.hedera.accounts,
            matchesStoredTopic: sessionTopic === storedTopic,
          });
          
          console.log('[HashConnect] ✅ Session ready for signing!');
          return sessionTopic;
        }
      }
    } else {
      console.warn(`[HashConnect] Attempt ${attempt}: No sessions found in any location`);
    }
  }
  
  console.error('[HashConnect] ❌ Could not find session topic after', maxRetries, 'retries');
  console.error('[HashConnect] This means the WalletConnect session is not properly established');
  return null;
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

/**
 * Clean up old/stale WalletConnect sessions
 * This helps prevent "proposal deleted" errors
 */
export async function cleanupOldSessions(): Promise<void> {
  try {
    console.log('[HashConnect] 🧹 Cleaning up old/stale sessions...');
    
    if (!hc) {
      console.log('[HashConnect] No HashConnect instance to clean up');
      return;
    }
    
    const signClient = (hc as any)._signClient;
    if (!signClient) {
      console.log('[HashConnect] No sign client available');
      return;
    }
    
    // Get all active sessions
    const allSessions = signClient.session?.getAll?.() || [];
    console.log('[HashConnect] Found', allSessions.length, 'total sessions');
    
    if (allSessions.length === 0) {
      console.log('[HashConnect] No sessions to clean up');
      return;
    }
    
    // Find Hedera sessions
    const hederaSessions = allSessions.filter((s: any) => 
      s.namespaces?.hedera || 
      s.requiredNamespaces?.hedera ||
      s.optionalNamespaces?.hedera
    );
    
    console.log('[HashConnect] Found', hederaSessions.length, 'Hedera sessions');
    
    // Keep only the most recent session, disconnect the rest
    if (hederaSessions.length > 1) {
      const sortedSessions = hederaSessions.sort((a: any, b: any) => b.expiry - a.expiry);
      const mostRecent = sortedSessions[0];
      const oldSessions = sortedSessions.slice(1);
      
      console.log('[HashConnect] Keeping most recent session:', mostRecent.topic.substring(0, 16) + '...');
      console.log('[HashConnect] Disconnecting', oldSessions.length, 'old sessions');
      
      for (const oldSession of oldSessions) {
        try {
          console.log('[HashConnect] Disconnecting old session:', oldSession.topic.substring(0, 16) + '...');
          await signClient.disconnect({
            topic: oldSession.topic,
            reason: { code: 6000, message: 'Cleaning up old session' },
          });
          console.log('[HashConnect] ✅ Disconnected old session');
        } catch (error) {
          console.warn('[HashConnect] Failed to disconnect old session:', error);
        }
      }
      
      console.log('[HashConnect] ✅ Cleanup complete - kept 1 session, removed', oldSessions.length);
    } else {
      console.log('[HashConnect] Only 1 Hedera session found, no cleanup needed');
    }
    
  } catch (error) {
    console.error('[HashConnect] Error during session cleanup:', error);
  }
}
