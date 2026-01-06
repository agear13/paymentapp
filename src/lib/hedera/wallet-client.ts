/**
 * Hedera Wallet Client
 * Helper functions for sending transactions via HashConnect
 * 
 * ⚠️  IMPORTANT: Only imports from hashconnectClient (singleton)
 */

'use client';

import { 
  getHashConnectInstance, 
  getLatestPairingData, 
  getWalletState,
  initHashConnect,
  openHashpackPairingModal,
} from '@/lib/hashconnectClient';
import { hbarToTinybars } from './amount-utils';
import { CURRENT_NETWORK } from './constants';

// Hedera SDK imports (client-side only)
let TransferTransaction: any = null;
let Hbar: any = null;
let AccountId: any = null;

// Dynamically import Hedera SDK (client-side only)
async function loadHederaSDK() {
  if (typeof window === 'undefined') {
    throw new Error('Hedera SDK must be used in browser only');
  }
  
  if (!TransferTransaction) {
    const sdk = await import('@hashgraph/sdk');
    TransferTransaction = sdk.TransferTransaction;
    Hbar = sdk.Hbar;
    AccountId = sdk.AccountId;
  }
  
  return { TransferTransaction, Hbar, AccountId };
}

export interface SendHbarPaymentParams {
  merchantAccountId: string;
  amountHbar: number | string;
  memo: string;
}

export interface SendHbarPaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  rejected?: boolean;
}

/**
 * Connect wallet and open HashPack pairing modal
 */
export async function connectWallet(): Promise<void> {
  await initHashConnect();
  await openHashpackPairingModal();
}

/**
 * Send a pre-filled HBAR payment transaction request to HashPack
 * User only needs to approve/reject in their wallet
 * 
 * @param params - Payment parameters
 * @returns Result with transaction ID or error
 */
export async function sendHbarPayment(
  params: SendHbarPaymentParams
): Promise<SendHbarPaymentResult> {
  const { merchantAccountId, amountHbar, memo } = params;
  
  console.log('[HederaWalletClient] sendHbarPayment called:', {
    merchantAccountId,
    amountHbar,
    memo,
  });
  
  try {
    // Ensure HashConnect is initialized
    await initHashConnect();
    
    const hc = getHashConnectInstance();
    if (!hc) {
      throw new Error('HashConnect not initialized');
    }
    
    // Get wallet state
    const walletState = getWalletState();
    if (!walletState.isConnected || !walletState.accountId) {
      throw new Error('Wallet not connected');
    }
    
    // Get pairing data
    const pairingData = getLatestPairingData();
    if (!pairingData || !pairingData.topic) {
      throw new Error('No active pairing');
    }
    
    // Load Hedera SDK
    const { TransferTransaction: Transfer, Hbar: HbarClass, AccountId: AccId } = await loadHederaSDK();
    
    // Convert amount to tinybars
    const tinybars = hbarToTinybars(amountHbar);
    
    console.log('[HederaWalletClient] Preparing transaction:', {
      from: walletState.accountId,
      to: merchantAccountId,
      amount: tinybars.toString(),
      amountHbar,
      memo,
      network: CURRENT_NETWORK,
    });
    
    // Build Hedera transaction using SDK
    const transaction = new Transfer()
      .addHbarTransfer(walletState.accountId, new HbarClass(Number(tinybars) * -1, 'tinybar'))
      .addHbarTransfer(merchantAccountId, new HbarClass(Number(tinybars), 'tinybar'))
      .setTransactionMemo(memo);
    
    // Freeze transaction for signing
    // Note: We don't set a node account or transaction ID as HashConnect handles this
    const frozenTx = transaction.freeze();
    
    // Convert to bytes for HashConnect
    const transactionBytes = frozenTx.toBytes();
    
    console.log('[HederaWalletClient] Transaction built, size:', transactionBytes.length, 'bytes');
    console.log('[HederaWalletClient] Sending transaction request to HashPack...');
    
    // Send transaction via HashConnect v3
    let result: any;
    
    try {
      // HashConnect v3 sendTransaction method
      if (typeof hc.sendTransaction === 'function') {
        console.log('[HederaWalletClient] Using sendTransaction API');
        result = await hc.sendTransaction(pairingData.topic, {
          topic: pairingData.topic,
          byteArray: Array.from(transactionBytes),
          metadata: {
            accountToSign: walletState.accountId,
            returnTransaction: false,
          },
        });
      } else {
        throw new Error('sendTransaction method not available on HashConnect instance');
      }
    } catch (error: any) {
      // Check if user rejected
      const errorMsg = error?.message?.toLowerCase() || String(error).toLowerCase();
      if (
        errorMsg.includes('reject') ||
        errorMsg.includes('cancel') ||
        errorMsg.includes('denied') ||
        errorMsg.includes('user declined')
      ) {
        console.log('[HederaWalletClient] User rejected transaction');
        return {
          success: false,
          rejected: true,
          error: 'Transaction rejected by user',
        };
      }
      
      // Re-throw other errors
      throw error;
    }
    
    console.log('[HederaWalletClient] Transaction response:', result);
    
    // Extract transaction ID from result
    // The response format may vary, check common locations
    let transactionId: string | undefined;
    
    if (result?.transactionId) {
      transactionId = result.transactionId;
    } else if (result?.receipt?.transactionId) {
      transactionId = result.receipt.transactionId;
    } else if (result?.response?.transactionId) {
      transactionId = result.response.transactionId;
    } else if (typeof result === 'string') {
      transactionId = result;
    }
    
    if (!transactionId) {
      console.warn('[HederaWalletClient] Transaction ID not found in response:', result);
      // Still consider it a success if we got a response without error
      return {
        success: true,
        transactionId: undefined,
      };
    }
    
    console.log('[HederaWalletClient] ✅ Transaction submitted:', transactionId);
    
    return {
      success: true,
      transactionId,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[HederaWalletClient] ❌ Transaction failed:', errorMsg, error);
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Get current wallet connection status
 */
export function getWalletConnectionStatus() {
  const state = getWalletState();
  return {
    isConnected: state.isConnected,
    accountId: state.accountId,
    network: state.network,
    isLoading: state.isLoading,
    error: state.error,
  };
}

