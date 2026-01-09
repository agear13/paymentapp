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
  getSessionTopic,
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
    const pairingData = getLatestPairingData();
    console.log('[HederaWalletClient] [HBAR] Initial pairing data:', pairingData);
    
    if (!pairingData || !pairingData.accountIds || pairingData.accountIds.length === 0) {
      throw new Error('No wallet connection found. Please connect your wallet first.');
    }
    
    // Get the session topic (needed for signing transactions - different from pairing topic!)
    console.log('[HederaWalletClient] [HBAR] 🔑 Getting session topic for transaction signing...');
    // Increased retries and delay to ensure session is fully established in both core and _signClient
    const sessionTopic = await getSessionTopic(8, 600); // Try up to 8 times with 600ms delay (4.8s total)
    
    if (!sessionTopic) {
      console.error('[HederaWalletClient] [HBAR] ❌ Could not get session topic');
      throw new Error('Could not establish signing session. Please wait a moment and try again, or disconnect and reconnect your wallet.');
    }
    
    console.log('[HederaWalletClient] [HBAR] ✅ Session topic confirmed:', sessionTopic);
    console.log('[HederaWalletClient] [HBAR] ✅ Account IDs:', pairingData.accountIds);
    
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
      // Debug: Check available methods and properties  
      console.log('[HederaWalletClient] HashConnect methods:', Object.keys(hc).filter(k => typeof (hc as any)[k] === 'function'));
      console.log('[HederaWalletClient] HashConnect properties:', Object.keys(hc).filter(k => typeof (hc as any)[k] !== 'function'));
      console.log('[HederaWalletClient] sendTransaction exists?', 'sendTransaction' in hc);
      console.log('[HederaWalletClient] sendTransaction type:', typeof (hc as any).sendTransaction);
      
      // Check for request method (alternative API)
      console.log('[HederaWalletClient] request method exists?', 'request' in hc);
      console.log('[HederaWalletClient] request type:', typeof (hc as any).request);
      
      // Try using the request method instead of sendTransaction
      if (typeof (hc as any).request === 'function') {
        console.log('[HederaWalletClient] Using request() API for transaction');
        console.log('[HederaWalletClient] Topic:', pairingData.topic);
        console.log('[HederaWalletClient] Wallet account:', walletState.accountId);
        console.log('[HederaWalletClient] Pairing accounts:', pairingData.accountIds);
        console.log('[HederaWalletClient] Transaction bytes length:', transactionBytes.length);
        
        // Use the first account from pairing data
        const accountToSign = pairingData.accountIds && pairingData.accountIds.length > 0 
          ? pairingData.accountIds[0] 
          : walletState.accountId;
        
        console.log('[HederaWalletClient] Using account for signing:', accountToSign);
        
        // HashConnect v3 request API
        result = await (hc as any).request(pairingData.topic, {
          method: 'hedera_signAndExecuteTransaction',
          params: {
            signerAccountId: accountToSign,
            transactionList: transactionBytes,
          },
        });
      } else if (typeof hc.sendTransaction === 'function') {
        console.log('[HederaWalletClient] Using sendTransaction API');
        console.log('[HederaWalletClient] Session Topic (for signing):', sessionTopic);
        console.log('[HederaWalletClient] Wallet account:', walletState.accountId);
        console.log('[HederaWalletClient] Pairing accounts:', pairingData.accountIds);
        console.log('[HederaWalletClient] Transaction bytes length:', transactionBytes.length);
        
        // Use the first account from pairing data (most reliable)
        const accountToSign = pairingData.accountIds && pairingData.accountIds.length > 0 
          ? pairingData.accountIds[0] 
          : walletState.accountId;
        
        console.log('[HederaWalletClient] Using account for signing:', accountToSign);
        
        // HashConnect v3 API: sendTransaction(topic, transactionRequest)
        // IMPORTANT: Must use session topic, not pairing topic!
        console.log('[HederaWalletClient] About to call sendTransaction with SESSION topic...');
        console.log('[HederaWalletClient] Transaction request:', {
          topic: sessionTopic,
          byteArrayLength: transactionBytes.length,
          accountToSign: accountToSign,
          returnTransaction: false,
        });
        
        try {
          console.log('[HederaWalletClient] 🚀 CALLING hc.sendTransaction() NOW...');
          console.log('[HederaWalletClient] hc object type:', typeof hc);
          console.log('[HederaWalletClient] sendTransaction function type:', typeof hc.sendTransaction);
          console.log('[HederaWalletClient] sendTransaction function:', hc.sendTransaction.toString().substring(0, 200));
          console.log('[HederaWalletClient] sendTransaction.length (param count):', hc.sendTransaction.length);
          
          let sendTransactionPromise;
          
          console.log('[HederaWalletClient] Step 1: About to create transaction request object...');
          const transactionRequest = {
            byteArray: transactionBytes,
            metadata: {
              accountToSign: accountToSign,
              returnTransaction: false,
            },
          };
          console.log('[HederaWalletClient] Step 2: Transaction request object created:', {
            hasByteArray: !!transactionRequest.byteArray,
            byteArrayLength: transactionRequest.byteArray?.length,
            metadata: transactionRequest.metadata,
          });
          
          // First, try to ping HashPack to verify connection is active
          console.log('[HederaWalletClient] Step 2.5: Testing if HashConnect is responsive...');
          try {
            if (typeof hc.ping === 'function') {
              console.log('[HederaWalletClient] Pinging session to verify it\'s alive...');
              const pingResult = await hc.ping(sessionTopic);
              console.log('[HederaWalletClient] ✅ Ping successful:', pingResult);
            } else {
              console.log('[HederaWalletClient] No ping method available, proceeding...');
            }
          } catch (pingError: any) {
            console.error('[HederaWalletClient] ⚠️ Ping failed:', pingError?.message);
            // Continue anyway
          }
          
          try {
            console.log('[HederaWalletClient] Step 3: Calling hc.sendTransaction with topic:', sessionTopic.substring(0, 16) + '...');
            
            // Prove JavaScript continues executing
            setTimeout(() => {
              console.log('[HederaWalletClient] ⏰ setTimeout callback fired - JS thread is still alive');
            }, 100);
            
            // Add a global error handler temporarily to catch any unhandled errors
            const originalErrorHandler = window.onerror;
            const originalUnhandledRejection = window.onunhandledrejection;
            
            window.onerror = function(msg, url, lineNo, columnNo, error) {
              console.error('[HederaWalletClient] ⚠️ WINDOW ERROR during sendTransaction:', {
                message: msg,
                url,
                lineNo,
                columnNo,
                error,
              });
              if (originalErrorHandler) originalErrorHandler(msg, url, lineNo, columnNo, error);
              return false;
            };
            
            window.onunhandledrejection = function(event) {
              console.error('[HederaWalletClient] ⚠️ UNHANDLED PROMISE REJECTION:', event.reason);
              if (originalUnhandledRejection) originalUnhandledRejection(event);
            };
            
            console.log('[HederaWalletClient] Step 3.1: About to call sendTransaction...');
            console.log('[HederaWalletClient] Parameters being passed:', {
              topicLength: sessionTopic.length,
              topicStart: sessionTopic.substring(0, 16),
              requestKeys: Object.keys(transactionRequest),
              byteArrayType: typeof transactionRequest.byteArray,
              byteArrayIsUint8Array: transactionRequest.byteArray instanceof Uint8Array,
            });
            
            // Try with a micro-timeout to see if it helps
            await new Promise(resolve => setTimeout(resolve, 50));
            console.log('[HederaWalletClient] Step 3.1b: After micro-delay, calling now...');
            console.log('[HederaWalletClient] Step 3.1c: THE NEXT LINE CALLS sendTransaction...');
            
            sendTransactionPromise = hc.sendTransaction(sessionTopic, transactionRequest);
            
            console.log('[HederaWalletClient] Step 3.2: sendTransaction() RETURNED!');
            console.log('[HederaWalletClient] Return value:', sendTransactionPromise);
            console.log('[HederaWalletClient] Type:', typeof sendTransactionPromise);
            console.log('[HederaWalletClient] Is null?:', sendTransactionPromise === null);
            console.log('[HederaWalletClient] Is undefined?:', sendTransactionPromise === undefined);
            console.log('[HederaWalletClient] Is Promise?:', sendTransactionPromise instanceof Promise);
            
            // If it returned something, log its properties
            if (sendTransactionPromise) {
              console.log('[HederaWalletClient] Has .then?:', typeof sendTransactionPromise.then);
              console.log('[HederaWalletClient] Has .catch?:', typeof sendTransactionPromise.catch);
              console.log('[HederaWalletClient] Object keys:', Object.keys(sendTransactionPromise || {}));
            }
            
            // Restore original handlers
            window.onerror = originalErrorHandler;
            window.onunhandledrejection = originalUnhandledRejection;
            
            console.log('[HederaWalletClient] Step 4: sendTransaction() call completed (returned)');
          } catch (syncError: any) {
            console.error('[HederaWalletClient] ❌ Step 3.5: sendTransaction threw SYNCHRONOUS error:', syncError);
            console.error('[HederaWalletClient] Error details:', {
              message: syncError?.message,
              name: syncError?.name,
              type: typeof syncError,
              stack: syncError?.stack,
            });
            throw syncError;
          }
          
          console.log('[HederaWalletClient] ✅ sendTransaction() returned successfully');
          console.log('[HederaWalletClient] Return value type:', typeof sendTransactionPromise);
          console.log('[HederaWalletClient] Is Promise?:', sendTransactionPromise instanceof Promise);
          console.log('[HederaWalletClient] ⏳ Starting Promise.race with 120s timeout...');
          console.log('[HederaWalletClient] 💡 CHECK YOUR HASHPACK WALLET NOW FOR APPROVAL PROMPT!');
          
          // Wait for the result with a generous timeout (2 minutes)
          const raceStartTime = Date.now();
          try {
            result = await Promise.race([
              sendTransactionPromise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transaction request timeout after 120 seconds')), 120000)
              )
            ]);
            
            const elapsed = ((Date.now() - raceStartTime) / 1000).toFixed(2);
            console.log(`[HederaWalletClient] ✅ Promise resolved after ${elapsed}s`);
          } catch (raceError: any) {
            const elapsed = ((Date.now() - raceStartTime) / 1000).toFixed(2);
            console.error(`[HederaWalletClient] ❌ Promise rejected after ${elapsed}s:`, raceError);
            throw raceError;
          }
          
          console.log('[HederaWalletClient] ✅ sendTransaction completed successfully');
          console.log('[HederaWalletClient] Result type:', typeof result);
          console.log('[HederaWalletClient] Result:', result);
        } catch (sendError: any) {
          console.error('[HederaWalletClient] ❌ sendTransaction threw error:', sendError);
          console.error('[HederaWalletClient] Error type:', typeof sendError);
          console.error('[HederaWalletClient] Error message:', sendError?.message);
          console.error('[HederaWalletClient] Error stack:', sendError?.stack);
          throw sendError;
        }
      } else {
        throw new Error('sendTransaction method not available on HashConnect instance');
      }
    } catch (error: any) {
      // Check if user rejected
      const errorMsg = error?.message?.toLowerCase() || String(error).toLowerCase();
      console.error('[HederaWalletClient] Caught error in sendHbarPayment:', error);
      console.error('[HederaWalletClient] Error message:', errorMsg);
      
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
      console.error('[HederaWalletClient] Re-throwing error');
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
    
    // Get pairing data
    console.log('[HederaWalletClient] [TOKEN] Attempting to get pairing data...');
    const pairingData = getLatestPairingData();
    console.log('[HederaWalletClient] [TOKEN] Initial pairing data:', pairingData);
    
    if (!pairingData || !pairingData.accountIds || pairingData.accountIds.length === 0) {
      throw new Error('No wallet connection found. Please connect your wallet first.');
    }
    
    // Get the session topic (needed for signing transactions - different from pairing topic!)
    console.log('[HederaWalletClient] [TOKEN] 🔑 Getting session topic for transaction signing...');
    // Increased retries and delay to ensure session is fully established in both core and _signClient
    const sessionTopic = await getSessionTopic(8, 600); // Try up to 8 times with 600ms delay (4.8s total)
    
    if (!sessionTopic) {
      console.error('[HederaWalletClient] [TOKEN] ❌ Could not get session topic');
      throw new Error('Could not establish signing session. Please wait a moment and try again, or disconnect and reconnect your wallet.');
    }
    
    console.log('[HederaWalletClient] [TOKEN] ✅ Session topic confirmed:', sessionTopic);
    console.log('[HederaWalletClient] [TOKEN] ✅ Account IDs:', pairingData.accountIds);
    
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
        console.log('[HederaWalletClient] Session Topic (for signing):', sessionTopic);
        console.log('[HederaWalletClient] Wallet account:', walletState.accountId);
        console.log('[HederaWalletClient] Pairing accounts:', pairingData.accountIds);
        
        // Use the first account from pairing data (most reliable)
        const accountToSign = pairingData.accountIds && pairingData.accountIds.length > 0 
          ? pairingData.accountIds[0] 
          : walletState.accountId;
        
        console.log('[HederaWalletClient] Using account for signing:', accountToSign);
        
        // HashConnect v3 API: sendTransaction(topic, transactionRequest)
        // IMPORTANT: Must use session topic, not pairing topic!
        console.log('[HederaWalletClient] About to call sendTransaction for token with SESSION topic...');
        console.log('[HederaWalletClient] Token transaction request:', {
          topic: sessionTopic,
          byteArrayLength: transactionBytes.length,
          accountToSign: accountToSign,
          returnTransaction: false,
        });
        
        try {
          // Add a timeout to prevent infinite hanging
          const sendTransactionPromise = hc.sendTransaction(sessionTopic, {
            byteArray: transactionBytes,
            metadata: {
              accountToSign: accountToSign,
              returnTransaction: false,
            },
          });
          
          console.log('[HederaWalletClient] sendTransaction promise created, waiting for response...');
          console.log('[HederaWalletClient] ⏳ Check your HashPack wallet for approval prompt...');
          
          // Wait for the result with a generous timeout (2 minutes)
          result = await Promise.race([
            sendTransactionPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transaction request timeout after 120 seconds')), 120000)
            )
          ]);
          
          console.log('[HederaWalletClient] ✅ sendTransaction call completed for token successfully');
          console.log('[HederaWalletClient] Result type:', typeof result);
          console.log('[HederaWalletClient] Result:', result);
        } catch (sendError: any) {
          console.error('[HederaWalletClient] ❌ sendTransaction threw error (token):', sendError);
          console.error('[HederaWalletClient] Error type:', typeof sendError);
          console.error('[HederaWalletClient] Error message:', sendError?.message);
          console.error('[HederaWalletClient] Error stack:', sendError?.stack);
          throw sendError;
        }
      } else {
        throw new Error('sendTransaction method not available on HashConnect instance');
      }
    } catch (error: any) {
      // Check if user rejected
      const errorMsg = error?.message?.toLowerCase() || String(error).toLowerCase();
      console.error('[HederaWalletClient] Caught error in sendTokenPayment:', error);
      console.error('[HederaWalletClient] Error message:', errorMsg);
      
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
      console.error('[HederaWalletClient] Re-throwing error');
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

