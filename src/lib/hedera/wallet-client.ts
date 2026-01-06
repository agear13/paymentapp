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
import { hbarToTinybars, toSmallestUnit } from './amount-utils';
import { CURRENT_NETWORK, CURRENT_NODE_ACCOUNT_ID, type TokenType } from './constants';

// Hedera SDK imports (client-side only)
let TransferTransaction: any = null;
let Hbar: any = null;
let AccountId: any = null;
let TransactionId: any = null;
let Timestamp: any = null;

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
    TransactionId = sdk.TransactionId;
    Timestamp = sdk.Timestamp;
  }
  
  return { TransferTransaction, Hbar, AccountId, TransactionId, Timestamp };
}

export interface SendHbarPaymentParams {
  merchantAccountId: string;
  amountHbar: number | string;
  memo: string;
}

export interface SendTokenPaymentParams {
  tokenId: string;
  tokenType: TokenType;
  decimals: number;
  merchantAccountId: string;
  amount: number | string;
  memo: string;
}

export interface SendPaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  rejected?: boolean;
}

// Backward compatibility
export type SendHbarPaymentResult = SendPaymentResult;

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
    
    // Get pairing data with retry (sometimes there's a brief delay after pairing)
    console.log('[HederaWalletClient] [HBAR] Attempting to get pairing data...');
    let pairingData = getLatestPairingData();
    console.log('[HederaWalletClient] [HBAR] Initial pairing data:', pairingData);
    
    let retries = 0;
    while ((!pairingData || !pairingData.topic) && retries < 5) {
      console.log('[HederaWalletClient] [HBAR] Waiting for pairing data... attempt', retries + 1);
      console.log('[HederaWalletClient] [HBAR] Current pairing data has topic?', !!pairingData?.topic);
      await new Promise(resolve => setTimeout(resolve, 500));
      pairingData = getLatestPairingData();
      retries++;
    }
    
    if (!pairingData || !pairingData.topic) {
      console.error('[HederaWalletClient] [HBAR] Pairing data after all retries:', pairingData);
      throw new Error('Pairing not ready. Please wait a moment and try again, or disconnect and reconnect your wallet.');
    }
    
    console.log('[HederaWalletClient] [HBAR] ✅ Pairing data confirmed:', {
      topic: pairingData.topic,
      accountIds: pairingData.accountIds,
    });
    
    // Load Hedera SDK
    const { TransferTransaction: Transfer, Hbar: HbarClass, TransactionId: TxId, AccountId: AcctId } = await loadHederaSDK();
    
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
    
    // Generate transaction ID (required when not using a client)
    // Transaction ID = AccountId + ValidStart timestamp
    const txId = TxId.generate(AcctId.fromString(walletState.accountId));
    
    // Build Hedera transaction using SDK
    // Use Hbar.fromTinybars() to properly handle bigint values
    const hbarAmount = HbarClass.fromTinybars(tinybars);
    const transaction = new Transfer()
      .setTransactionId(txId)
      .setNodeAccountIds([AcctId.fromString(CURRENT_NODE_ACCOUNT_ID)]) // Convert string to AccountId
      .addHbarTransfer(walletState.accountId, hbarAmount.negated())
      .addHbarTransfer(merchantAccountId, hbarAmount)
      .setTransactionMemo(memo);
    
    // Freeze transaction for signing
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
 * Send a pre-filled HTS token payment transaction request to HashPack
 * User only needs to approve/reject in their wallet
 * 
 * @param params - Token payment parameters
 * @returns Result with transaction ID or error
 */
export async function sendTokenPayment(
  params: SendTokenPaymentParams
): Promise<SendPaymentResult> {
  const { tokenId, tokenType, decimals, merchantAccountId, amount, memo } = params;
  
  console.log('[HederaWalletClient] sendTokenPayment called:', {
    tokenId,
    tokenType,
    decimals,
    merchantAccountId,
    amount,
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
    
    // Get pairing data with retry (sometimes there's a brief delay after pairing)
    console.log('[HederaWalletClient] [TOKEN] Attempting to get pairing data...');
    let pairingData = getLatestPairingData();
    console.log('[HederaWalletClient] [TOKEN] Initial pairing data:', pairingData);
    
    let retries = 0;
    while ((!pairingData || !pairingData.topic) && retries < 5) {
      console.log('[HederaWalletClient] [TOKEN] Waiting for pairing data... attempt', retries + 1);
      console.log('[HederaWalletClient] [TOKEN] Current pairing data has topic?', !!pairingData?.topic);
      await new Promise(resolve => setTimeout(resolve, 500));
      pairingData = getLatestPairingData();
      retries++;
    }
    
    if (!pairingData || !pairingData.topic) {
      console.error('[HederaWalletClient] [TOKEN] Pairing data after all retries:', pairingData);
      throw new Error('Pairing not ready. Please wait a moment and try again, or disconnect and reconnect your wallet.');
    }
    
    console.log('[HederaWalletClient] [TOKEN] ✅ Pairing data confirmed:', {
      topic: pairingData.topic,
      accountIds: pairingData.accountIds,
    });
    
    // Convert amount to smallest unit
    const smallestUnit = toSmallestUnit(amount, decimals);
    
    console.log('[HederaWalletClient] Preparing token transaction:', {
      from: walletState.accountId,
      to: merchantAccountId,
      tokenId,
      amount: smallestUnit.toString(),
      amountDecimal: amount,
      decimals,
      memo,
      network: CURRENT_NETWORK,
    });
    
    // Load Hedera SDK
    const { TransferTransaction: Transfer, TransactionId: TxId, AccountId: AcctId } = await loadHederaSDK();
    
    // Generate transaction ID (required when not using a client)
    const txId = TxId.generate(AcctId.fromString(walletState.accountId));
    
    // Build Hedera token transfer transaction using SDK
    // For token transfers, amounts must be Long (int64), so we convert bigint to number
    // This is safe for HTS tokens as they typically have 6-8 decimals (max ~9 quadrillion units)
    const amountNumber = Number(smallestUnit);
    if (!Number.isSafeInteger(amountNumber)) {
      throw new Error('Token amount exceeds safe integer range');
    }
    
    const transaction = new Transfer()
      .setTransactionId(txId)
      .setNodeAccountIds([AcctId.fromString(CURRENT_NODE_ACCOUNT_ID)]) // Convert string to AccountId
      .addTokenTransfer(tokenId, walletState.accountId, -amountNumber)
      .addTokenTransfer(tokenId, merchantAccountId, amountNumber)
      .setTransactionMemo(memo);
    
    // Freeze transaction for signing
    const frozenTx = transaction.freeze();
    
    // Convert to bytes for HashConnect
    const transactionBytes = frozenTx.toBytes();
    
    console.log('[HederaWalletClient] Token transaction built, size:', transactionBytes.length, 'bytes');
    console.log('[HederaWalletClient] Sending token transaction request to HashPack...');
    
    // Send transaction via HashConnect v3
    let result: any;
    
    try {
      // HashConnect v3 sendTransaction method
      if (typeof hc.sendTransaction === 'function') {
        console.log('[HederaWalletClient] Using sendTransaction API for token transfer');
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
        console.log('[HederaWalletClient] User rejected token transaction');
        return {
          success: false,
          rejected: true,
          error: 'Transaction rejected by user',
        };
      }
      
      // Check for token association errors
      if (
        errorMsg.includes('token not associated') ||
        errorMsg.includes('token_not_associated') ||
        errorMsg.includes('not associated with token') ||
        errorMsg.includes('no balance')
      ) {
        console.log('[HederaWalletClient] Token association error');
        return {
          success: false,
          error: `Your wallet is not associated with ${tokenType}. Please associate the token in HashPack first.`,
        };
      }
      
      // Check for insufficient balance errors
      if (
        errorMsg.includes('insufficient') ||
        errorMsg.includes('not enough')
      ) {
        console.log('[HederaWalletClient] Insufficient balance error');
        return {
          success: false,
          error: `Insufficient ${tokenType} balance or HBAR for network fees.`,
        };
      }
      
      // Re-throw other errors
      throw error;
    }
    
    console.log('[HederaWalletClient] Token transaction response:', result);
    
    // Extract transaction ID from result
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
    
    console.log('[HederaWalletClient] ✅ Token transaction submitted:', transactionId);
    
    return {
      success: true,
      transactionId,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[HederaWalletClient] ❌ Token transaction failed:', errorMsg, error);
    
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

