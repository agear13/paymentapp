/**
 * HashConnect Wallet Service
 * Client-side only - manages wallet connections
 */

// Only import HashConnect on the client side
let HashConnect: any;
let HashConnectConnectionState: any;

if (typeof window !== 'undefined') {
  const hashconnectModule = require('hashconnect');
  HashConnect = hashconnectModule.HashConnect;
  HashConnectConnectionState = hashconnectModule.HashConnectConnectionState;
}

import { log } from '@/lib/logger';
import { HASHCONNECT_CONFIG } from './constants';
import type { WalletState, HashConnectPairingData } from './types';
import { getAccountBalances } from './token-service';

// Wallet state management
let walletState: WalletState = {
  isConnected: false,
  accountId: null,
  balances: {
    HBAR: '0.00000000',
    USDC: '0.000000',
    USDT: '0.000000',
  },
  network: HASHCONNECT_CONFIG.NETWORK,
  isLoading: false,
  error: null,
};

// HashConnect instance (singleton)
let hashconnect: HashConnect | null = null;
let pairingData: HashConnectPairingData | null = null;

// State change listeners
type StateChangeListener = (state: WalletState) => void;
const listeners: Set<StateChangeListener> = new Set();

/**
 * Initialize HashConnect (call once on app load)
 */
export async function initializeHashConnect(): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.warn('HashConnect can only be initialized on the client side');
    return;
  }

  if (hashconnect) {
    log.info('HashConnect already initialized');
    return;
  }

  try {
    log.info('Initializing HashConnect');

    hashconnect = new HashConnect(
      true, // Debug mode
      HASHCONNECT_CONFIG.NETWORK,
      HASHCONNECT_CONFIG.APP_NAME
    );

    // Set up event listeners
    setupEventListeners();

    // Initialize connection
    await hashconnect.init(
      {
        name: HASHCONNECT_CONFIG.APP_NAME,
        description: HASHCONNECT_CONFIG.APP_DESCRIPTION,
        icon: HASHCONNECT_CONFIG.APP_ICON,
        url: HASHCONNECT_CONFIG.APP_URL,
      },
      HASHCONNECT_CONFIG.NETWORK,
      false // Don't auto-pair
    );

    // Check for existing pairing
    const savedPairings = hashconnect.hcData.savedPairings;
    if (savedPairings && savedPairings.length > 0) {
      const pairing = savedPairings[0];
      await restorePairing(pairing);
    }

    log.info('HashConnect initialized successfully');
  } catch (error) {
    log.error({ error }, 'Failed to initialize HashConnect');
    updateState({ error: 'Failed to initialize wallet connection' });
    throw error;
  }
}

/**
 * Set up HashConnect event listeners
 */
function setupEventListeners(): void {
  if (!hashconnect) return;

  // Connection state changes
  hashconnect.connectionStatusChangeEvent.on((state) => {
    log.info({ state }, 'HashConnect connection state changed');
    
    if (state === HashConnectConnectionState.Paired) {
      handlePaired();
    } else if (state === HashConnectConnectionState.Disconnected) {
      handleDisconnected();
    }
  });

  // Pairing event
  hashconnect.pairingEvent.on((data) => {
    log.info({ data }, 'HashConnect pairing event');
    pairingData = {
      topic: data.topic,
      accountIds: data.accountIds,
      network: data.network,
      metadata: data.metadata,
    };
    handlePaired();
  });

  // Transaction events (for future use)
  hashconnect.transactionEvent.on((data) => {
    log.info({ data }, 'HashConnect transaction event');
  });
}

/**
 * Handle successful pairing
 */
async function handlePaired(): Promise<void> {
  try {
    if (!hashconnect || !pairingData) {
      return;
    }

    const accountId = pairingData.accountIds[0];
    
    updateState({
      isLoading: true,
      error: null,
    });

    // Fetch balances
    const balances = await getAccountBalances(accountId);

    updateState({
      isConnected: true,
      accountId,
      balances,
      network: pairingData.network,
      isLoading: false,
      error: null,
    });

    log.info({ accountId }, 'Wallet connected successfully');
  } catch (error) {
    log.error({ error }, 'Error handling pairing');
    updateState({
      isLoading: false,
      error: 'Failed to fetch wallet information',
    });
  }
}

/**
 * Handle disconnection
 */
function handleDisconnected(): void {
  updateState({
    isConnected: false,
    accountId: null,
    balances: {
      HBAR: '0.00000000',
      USDC: '0.000000',
      USDT: '0.000000',
    },
    isLoading: false,
    error: null,
  });

  pairingData = null;
  log.info('Wallet disconnected');
}

/**
 * Restore a previous pairing
 */
async function restorePairing(pairing: any): Promise<void> {
  try {
    log.info({ topic: pairing.topic }, 'Restoring previous pairing');
    
    pairingData = {
      topic: pairing.topic,
      accountIds: pairing.accountIds,
      network: pairing.network,
      metadata: pairing.metadata,
    };

    await handlePaired();
  } catch (error) {
    log.error({ error }, 'Failed to restore pairing');
  }
}

/**
 * Connect wallet (initiate pairing)
 */
export async function connectWallet(): Promise<void> {
  if (!hashconnect) {
    throw new Error('HashConnect not initialized. Call initializeHashConnect() first.');
  }

  if (walletState.isConnected) {
    log.info('Wallet already connected');
    return;
  }

  try {
    log.info('Initiating wallet connection');
    
    updateState({
      isLoading: true,
      error: null,
    });

    // Generate pairing string and open wallet
    hashconnect.openPairingModal();

    // Note: The actual connection will be handled by event listeners
  } catch (error) {
    log.error({ error }, 'Failed to connect wallet');
    updateState({
      isLoading: false,
      error: 'Failed to connect wallet. Please try again.',
    });
    throw error;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (!hashconnect || !pairingData) {
    log.warn('No active connection to disconnect');
    return;
  }

  try {
    log.info('Disconnecting wallet');
    
    await hashconnect.disconnect(pairingData.topic);
    hashconnect.clearConnectionsAndData();
    
    handleDisconnected();
  } catch (error) {
    log.error({ error }, 'Failed to disconnect wallet');
    throw error;
  }
}

/**
 * Refresh wallet balances
 */
export async function refreshBalances(): Promise<void> {
  if (!walletState.isConnected || !walletState.accountId) {
    log.warn('No connected wallet to refresh');
    return;
  }

  try {
    log.info('Refreshing wallet balances');
    
    const balances = await getAccountBalances(walletState.accountId);
    
    updateState({ balances });
  } catch (error) {
    log.error({ error }, 'Failed to refresh balances');
    updateState({
      error: 'Failed to refresh wallet balances',
    });
  }
}

/**
 * Get current wallet state
 */
export function getWalletState(): WalletState {
  return { ...walletState };
}

/**
 * Subscribe to wallet state changes
 */
export function subscribeToWalletState(
  listener: StateChangeListener
): () => void {
  listeners.add(listener);
  
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Update wallet state and notify listeners
 */
function updateState(updates: Partial<WalletState>): void {
  walletState = {
    ...walletState,
    ...updates,
  };

  // Notify all listeners
  listeners.forEach((listener) => {
    try {
      listener(walletState);
    } catch (error) {
      log.error({ error }, 'Error in state listener');
    }
  });
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected(): boolean {
  return walletState.isConnected;
}

/**
 * Get connected account ID
 */
export function getConnectedAccountId(): string | null {
  return walletState.accountId;
}

/**
 * Get HashConnect instance (for advanced usage)
 */
export function getHashConnect(): HashConnect | null {
  return hashconnect;
}

/**
 * Get pairing data
 */
export function getPairingData(): HashConnectPairingData | null {
  return pairingData;
}






