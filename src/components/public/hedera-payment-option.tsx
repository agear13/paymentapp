/**
 * Hedera Payment Option Component
 * Multi-token payment with HBAR, USDC, USDT, and AUDD support
 */

'use client';

import { useState, useEffect } from 'react';
import { Wallet, Check, Zap, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { WalletConnectButton } from '@/components/public/wallet-connect-button';
import { TokenCardSelector } from '@/components/public/token-card-selector';
import { SelectedTokenDetails } from '@/components/public/selected-token-details';
import { SelectedTokenWallet } from '@/components/public/selected-token-wallet';
import { PaymentInstructions } from '@/components/public/payment-instructions';
// CRITICAL: Import from canonical HashConnect client ONLY
import { 
  getWalletState, 
  initHashConnect,
  subscribeToWalletState,
} from '@/lib/hashconnectClient';
import { sendHbarPayment, sendTokenPayment } from '@/lib/hedera/wallet-client';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { CURRENT_NETWORK, getTokenConfig } from '@/lib/hedera/constants';

interface HederaPaymentOptionProps {
  isAvailable: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  currency: string;
}

type PaymentStep = 
  | 'select_method' 
  | 'connect_wallet' 
  | 'select_token' 
  | 'choose_payment_method'
  | 'manual_payment'
  | 'confirm_payment' 
  | 'requesting_signature' 
  | 'awaiting_approval' 
  | 'monitoring' 
  | 'complete' 
  | 'rejected';

type PaymentMethod = 'quick_pay' | 'manual';

export const HederaPaymentOption: React.FC<HederaPaymentOptionProps> = ({
  isAvailable,
  isSelected,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
  paymentLinkId,
  shortCode,
  amount,
  currency,
}) => {
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('select_method');
  const [paymentAmounts, setPaymentAmounts] = useState<TokenPaymentAmount[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDC');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('quick_pay');
  const [isLoadingAmounts, setIsLoadingAmounts] = useState(false);
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(null);
  const [isLoadingMerchant, setIsLoadingMerchant] = useState(false);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  
  // HashConnect initialization state
  const [isInitializingHashConnect, setIsInitializingHashConnect] = useState(false);
  const [hashConnectInitialized, setHashConnectInitialized] = useState(false);
  const [hashConnectError, setHashConnectError] = useState<string | null>(null);

  // Wallet state subscription
  const [wallet, setWallet] = useState(getWalletState());
  const [canPay, setCanPay] = useState(false);

  // Subscribe to wallet state changes
  useEffect(() => {
    return subscribeToWalletState((s) => {
      console.log('[HederaPaymentOption] wallet state update:', s);
      setWallet(s);
      const ok = !!s.isConnected && !!s.accountId && !s.isLoading && !s.error;
      setCanPay(ok);
      if (ok && paymentStep === 'select_method') {
        setPaymentStep('select_token');
      }
    });
  }, [paymentStep]);

  // Pre-initialize HashConnect when component mounts (if available)
  useEffect(() => {
    if (!isAvailable) return;
    
    // Only initialize once
    if (isInitializingHashConnect || hashConnectInitialized) return;
    
    console.log('[HederaPaymentOption] Pre-initializing HashConnect...');
    setIsInitializingHashConnect(true);
    setHashConnectError(null);
    
    initHashConnect()
      .then(() => {
        console.log('[HederaPaymentOption] ✅ HashConnect pre-initialized successfully');
        setHashConnectInitialized(true);
        setHashConnectError(null);
      })
      .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Failed to initialize wallet';
        console.error('[HederaPaymentOption] ❌ HashConnect initialization failed:', error);
        setHashConnectError(errorMsg);
        toast.error('Failed to initialize crypto wallet: ' + errorMsg);
      })
      .finally(() => {
        setIsInitializingHashConnect(false);
      });
  }, [isAvailable, isInitializingHashConnect, hashConnectInitialized]);

  // Fetch merchant settings when component mounts or short code changes
  useEffect(() => {
    // Guard: Validate shortCode exists
    if (!shortCode) {
      console.error('[HederaPaymentOption] shortCode is missing!');
      setMerchantError('Payment link configuration error');
      return;
    }

    if (isAvailable && !merchantAccountId && !isLoadingMerchant) {
      console.log('[HederaPaymentOption] Fetching merchant settings for shortCode:', shortCode);
      fetchMerchantSettings();
    }
  }, [isAvailable, shortCode, merchantAccountId, isLoadingMerchant]);

  // Fetch payment amounts when selected and merchant account is loaded
  useEffect(() => {
    if (isSelected && isAvailable && merchantAccountId && paymentAmounts.length === 0) {
      fetchPaymentAmounts();
    }
  }, [isSelected, isAvailable, merchantAccountId, paymentAmounts.length]);

  const fetchMerchantSettings = async () => {
    try {
      setIsLoadingMerchant(true);
      setMerchantError(null);

      console.log('[HederaPaymentOption] Fetching merchant from:', `/api/public/merchant/${shortCode}`);
      const response = await fetch(`/api/public/merchant/${shortCode}`);
      
      console.log('[HederaPaymentOption] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[HederaPaymentOption] API error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[HederaPaymentOption] Merchant data received:', result);
      
      if (!result.data) {
        console.error('[HederaPaymentOption] Missing data field in response:', result);
        throw new Error('Invalid response format');
      }

      if (!result.data.hederaAccountId) {
        const errorMsg = 'Merchant has not configured Hedera payments';
        console.warn('[HederaPaymentOption]', errorMsg);
        setMerchantError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      console.log('[HederaPaymentOption] Merchant account ID set:', result.data.hederaAccountId);
      setMerchantAccountId(result.data.hederaAccountId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to load payment details';
      console.error('[HederaPaymentOption] Failed to fetch merchant settings:', error);
      setMerchantError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoadingMerchant(false);
    }
  };

  const fetchPaymentAmounts = async () => {
    try {
      setIsLoadingAmounts(true);

      const walletState = getWalletState();
      
      const response = await fetch('/api/hedera/payment-amounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiatAmount: parseFloat(amount),
          fiatCurrency: currency,
          walletBalances: walletState.isConnected ? walletState.balances : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment amounts');
      }

      const result = await response.json();
      setPaymentAmounts(result.data.paymentAmounts);

      // Select recommended token
      const recommended = result.data.paymentAmounts.find((a: TokenPaymentAmount) => a.isRecommended);
      if (recommended) {
        setSelectedToken(recommended.tokenType);
      }
    } catch (error) {
      console.error('Failed to fetch payment amounts:', error);
      toast.error('Failed to calculate payment amounts');
    } finally {
      setIsLoadingAmounts(false);
    }
  };

  const handleTokenSelect = (token: TokenType) => {
    setSelectedToken(token);
  };

  const handleConfirmPayment = async () => {
    // Phase 1 & 2: All tokens now use pre-filled transaction flow
    if (selectedToken === 'HBAR') {
      await handleHbarPayment();
    } else {
      // Phase 2: Stablecoins (USDC, USDT, AUDD) use pre-filled token transfer
      await handleTokenPayment();
    }
  };
  
  const handleHbarPayment = async () => {
    try {
      setPaymentStep('requesting_signature');
      
      const selectedAmount = paymentAmounts.find(a => a.tokenType === 'HBAR');
      if (!selectedAmount) {
        toast.error('HBAR payment amount not found');
        setPaymentStep('select_token');
        return;
      }
      
      if (!merchantAccountId) {
        toast.error('Merchant account not configured');
        setPaymentStep('select_token');
        return;
      }
      
      // Build memo: Provvypay:{paymentLinkId}
      const memo = `Provvypay:${paymentLinkId}`;
      
      console.log('[HederaPaymentOption] Sending HBAR payment request:', {
        merchantAccountId,
        amount: selectedAmount.requiredAmount,
        memo,
      });
      
      toast.info('Preparing transaction...');
      
      setPaymentStep('awaiting_approval');
      
      // Send pre-filled transaction to HashPack
      const result = await sendHbarPayment({
        merchantAccountId,
        amountHbar: selectedAmount.requiredAmount,
        memo,
      });
      
      if (result.rejected) {
        console.log('[HederaPaymentOption] Transaction rejected by user');
        setPaymentStep('rejected');
        toast.error('Transaction rejected. You can try again when ready.');
        return;
      }
      
      if (!result.success) {
        console.error('[HederaPaymentOption] Transaction failed:', result.error);
        setPaymentStep('select_token');
        toast.error(result.error || 'Failed to send transaction');
        return;
      }
      
      console.log('[HederaPaymentOption] Transaction approved!', result.transactionId);
      toast.success('Transaction approved! Monitoring for confirmation...');
      
      // Start monitoring for the transaction
      await handleStartMonitoring();
    } catch (error: any) {
      console.error('[HederaPaymentOption] HBAR payment error:', error);
      setPaymentStep('select_token');
      toast.error(error?.message || 'Failed to process payment');
    }
  };
  
  const handleTokenPayment = async () => {
    try {
      setPaymentStep('requesting_signature');
      
      const selectedAmount = paymentAmounts.find(a => a.tokenType === selectedToken);
      if (!selectedAmount) {
        toast.error(`${selectedToken} payment amount not found`);
        setPaymentStep('select_token');
        return;
      }
      
      if (!merchantAccountId) {
        toast.error('Merchant account not configured');
        setPaymentStep('select_token');
        return;
      }
      
      // Get token configuration (ID and decimals)
      const tokenConfig = getTokenConfig(selectedToken, CURRENT_NETWORK);
      if (!tokenConfig.id) {
        toast.error(`${selectedToken} token ID not configured for ${CURRENT_NETWORK}`);
        setPaymentStep('select_token');
        return;
      }
      
      // Build memo: Provvypay:{paymentLinkId}
      const memo = `Provvypay:${paymentLinkId}`;
      
      console.log('[HederaPaymentOption] Sending token payment request:', {
        tokenType: selectedToken,
        tokenId: tokenConfig.id,
        decimals: tokenConfig.decimals,
        merchantAccountId,
        amount: selectedAmount.requiredAmount,
        memo,
      });
      
      toast.info(`Preparing ${selectedToken} transaction...`);
      
      setPaymentStep('awaiting_approval');
      
      // Send pre-filled token transaction to HashPack
      const result = await sendTokenPayment({
        tokenId: tokenConfig.id,
        tokenType: selectedToken,
        decimals: tokenConfig.decimals,
        merchantAccountId,
        amount: selectedAmount.requiredAmount,
        memo,
      });
      
      if (result.rejected) {
        console.log('[HederaPaymentOption] Token transaction rejected by user');
        setPaymentStep('rejected');
        toast.error('Transaction rejected. You can try again when ready.');
        return;
      }
      
      if (!result.success) {
        console.error('[HederaPaymentOption] Token transaction failed:', result.error);
        setPaymentStep('select_token');
        
        // Show user-friendly error messages
        if (result.error?.includes('not associated')) {
          toast.error(
            `Your wallet needs to be associated with ${selectedToken}. ` +
            `Please open HashPack, go to Tokens, and associate ${selectedToken} first.`,
            { duration: 8000 }
          );
        } else if (result.error?.includes('insufficient')) {
          toast.error(
            `Insufficient balance. Make sure you have enough ${selectedToken} ` +
            `and a small amount of HBAR for network fees.`,
            { duration: 6000 }
          );
        } else {
          toast.error(result.error || 'Failed to send transaction');
        }
        return;
      }
      
      console.log('[HederaPaymentOption] Token transaction approved!', result.transactionId);
      toast.success('Transaction approved! Monitoring for confirmation...');
      
      // Start monitoring for the transaction
      // Use longer window for tokens (60 min) as they may take longer to appear
      await handleStartMonitoring(60);
    } catch (error: any) {
      console.error('[HederaPaymentOption] Token payment error:', error);
      setPaymentStep('select_token');
      toast.error(error?.message || 'Failed to process payment');
    }
  };

  const handleStartMonitoring = async (timeWindowMinutes: number = 15) => {
    console.log('[HederaPaymentOption] 🔍 handleStartMonitoring called');
    console.log('[HederaPaymentOption] Selected token:', selectedToken);
    console.log('[HederaPaymentOption] Merchant account:', merchantAccountId);
    console.log('[HederaPaymentOption] Payment link ID:', paymentLinkId);
    console.log('[HederaPaymentOption] Time window (minutes):', timeWindowMinutes);
    
    setPaymentStep('monitoring');
    console.log('[HederaPaymentOption] Payment step set to: monitoring');
    
    // Monitor for payment using retry strategy
    const selectedAmount = paymentAmounts.find(a => a.tokenType === selectedToken);
    console.log('[HederaPaymentOption] Selected amount found:', !!selectedAmount, selectedAmount);
    
    if (!selectedAmount) {
      console.error('[HederaPaymentOption] ❌ Payment amount not found');
      toast.error('Payment amount not found');
      return;
    }

    const walletState = getWalletState();
    console.log('[HederaPaymentOption] Wallet state:', walletState);
    
    const maxAttempts = 40; // ~2 minutes total (40 * 3s)
    let attempts = 0;
    let delay = 3000; // Start with 3 seconds

    // Build memo for monitoring (same format as transaction)
    const memo = `Provvypay:${paymentLinkId}`;
    console.log('[HederaPaymentOption] Memo for monitoring:', memo);

    const checkPayment = async (): Promise<boolean> => {
      attempts++;
      
      try {
        console.log(`[Payment Monitor] Attempt ${attempts}/${maxAttempts} (window: ${timeWindowMinutes}min, ~${Math.floor(attempts * 3 / 60)}m${(attempts * 3) % 60}s elapsed)`);
        
        const monitorRequest = {
          paymentLinkId,
          merchantAccountId,
          payerAccountId: walletState.accountId,
          network: CURRENT_NETWORK,
          tokenType: selectedToken,
          expectedAmount: parseFloat(selectedAmount.totalAmount),
          memo, // Include memo for matching
          timeWindowMinutes, // Use parameter (15 for HBAR, 60 for tokens)
        };
        
        console.log('[Payment Monitor] Sending request:', monitorRequest);
        
        const response = await fetch('/api/hedera/transactions/monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(monitorRequest),
          // Add timeout and retry-friendly settings
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (!response.ok) {
          console.error('[Payment Monitor] API error:', response.status, response.statusText);
          const errorData = await response.json().catch(() => null);
          console.error('[Payment Monitor] Error details:', errorData);
          
          // Show error to user for 4xx/5xx errors
          if (response.status >= 400) {
            const errorMessage = errorData?.message || `API error: ${response.status}`;
            toast.error(errorMessage, { duration: 6000 });
            setPaymentStep('confirm_payment'); // Reset to allow retry
            return true; // Stop polling on explicit errors
          }
          
          // Exponential backoff on error
          delay = Math.min(delay * 1.5, 10000);
          return false;
        }

        const result = await response.json();
        
        if (result.found) {
          console.log('[Payment Monitor] Transaction found!', result);
          
          // Transition through processing state
          setPaymentStep('monitoring'); // Ensure we're in monitoring
          
          // Check if payment was persisted
          if (result.persisted || result.alreadyPaid) {
            console.log('[Payment Monitor] Payment persisted successfully', {
              transactionId: result.transactionId,
              paymentLink: result.paymentLink,
            });
            
            // Show processing state briefly
            setTimeout(() => {
              setPaymentStep('complete');
              toast.success('Payment confirmed!');
              
              // Optionally navigate to success page after a short delay
              setTimeout(() => {
                window.location.href = `/pay/${shortCode}/success`;
              }, 2000);
            }, 500);
          } else {
            // Transaction found but not persisted (error during persistence)
            console.warn('[Payment Monitor] Transaction found but not persisted');
            toast.warning('Payment detected but not yet confirmed. Please wait...');
            // Continue polling
            return false;
          }
          
          return true; // Stop polling
        }

        return false;
      } catch (error: any) {
        // Distinguish between network errors and other errors
        const isNetworkError = error.name === 'TypeError' && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') ||
           error.message.includes('network') ||
           error.name === 'AbortError');
        
        if (isNetworkError) {
          console.error('[Payment Monitor] Network error:', error.message);
          
          // Only show toast every 5 attempts to avoid spam
          if (attempts % 5 === 0) {
            toast.error(
              `Network connectivity issue. Please check your connection. (Attempt ${attempts}/${maxAttempts})`,
              { duration: 4000 }
            );
          }
        } else {
          console.error('[Payment Monitor] Check failed:', error);
          toast.error('Failed to check payment status. Retrying...');
        }
        
        // Exponential backoff on error
        delay = Math.min(delay * 1.5, 10000);
        return false;
      }
    };

    // Poll with retries
    while (attempts < maxAttempts) {
      const found = await checkPayment();
      
      if (found) {
        return; // Success!
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Max attempts reached
    console.log('[Payment Monitor] Max attempts reached');
    toast.error(
      'Payment not detected yet. Please check your transaction and try again.',
      {
        duration: 6000,
        action: {
          label: 'Retry',
          onClick: () => handleStartMonitoring(),
        },
      }
    );
  };

  // Determine if the payment option can be selected
  const canSelect = isAvailable && hashConnectInitialized && !hashConnectError;
  const isInitializing = isInitializingHashConnect || isLoadingMerchant;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={canSelect ? onSelect : undefined}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        disabled={!canSelect}
        className={cn(
          'w-full text-left transition-all rounded-lg border-2 p-4',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
          {
            'border-purple-600 bg-purple-50 shadow-md': isSelected,
            'border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm': !isSelected && canSelect,
            'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed': !canSelect,
          }
        )}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={!canSelect}
        aria-label="Pay with HBAR, USDC, USDT, or AUDD via Hedera"
        aria-busy={isInitializing}
        tabIndex={canSelect ? 0 : -1}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full transition-colors',
              {
                'bg-purple-600': isSelected,
                'bg-purple-100': !isSelected && isAvailable,
                'bg-slate-200': !isAvailable,
              }
            )}
          >
            <Wallet
              className={cn('w-6 h-6', {
                'text-white': isSelected,
                'text-purple-600': !isSelected && isAvailable,
                'text-slate-400': !isAvailable,
              })}
            />
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-slate-900">
                Cryptocurrency
              </h3>
              {isSelected && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Pay with HBAR, USDC, USDT, or AUDD on the Hedera network
            </p>

            {/* Initialization Status */}
            {isInitializingHashConnect && (
              <div className="flex items-center gap-2 text-sm text-purple-600 mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading wallet...</span>
              </div>
            )}

            {hashConnectError && (
              <div className="flex items-start gap-2 text-sm text-red-600 mb-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Wallet initialization failed: {hashConnectError}</span>
              </div>
            )}

            {/* Features - only show when ready */}
            {!isInitializingHashConnect && !hashConnectError && (
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Low fees (~$0.0001)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span>3-5 second finality</span>
                </div>
              </div>
            )}

            {!isAvailable && (
              <p className="text-xs text-amber-600 mt-3 font-medium">
                Crypto payments not available from this merchant
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Payment Flow */}
      {isSelected && isAvailable && (
        <div className="space-y-4 mt-4">
          {/* Loading Merchant Settings */}
          {isLoadingMerchant && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-sm text-slate-600">Loading merchant details...</p>
            </div>
          )}

          {/* Merchant Error State */}
          {!isLoadingMerchant && merchantError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">Unable to load merchant settings</p>
              <p className="text-xs text-red-600 mt-1">{merchantError}</p>
              <button
                onClick={fetchMerchantSettings}
                className="mt-3 text-xs text-red-700 underline hover:text-red-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Only show payment flow if merchant loaded successfully */}
          {!isLoadingMerchant && !merchantError && merchantAccountId && (
            <>
              {/* Loading Amounts */}
              {isLoadingAmounts && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              )}

              {/* Step 1: Connect Wallet */}
              {!isLoadingAmounts && paymentStep === 'select_method' && (
                <>
                  <WalletConnectButton />
                  
                  {/* Wallet Status */}
                  <div className="text-sm text-slate-600 mt-3">
                    {wallet.isLoading && 'Connecting wallet...'}
                    {wallet.error && <span className="text-red-600">Wallet error: {wallet.error}</span>}
                    {!wallet.isConnected && !wallet.isLoading && !wallet.error && 'Connect HashPack to continue.'}
                    {wallet.isConnected && wallet.accountId && (
                      <span className="text-green-600 font-medium">Connected: {wallet.accountId}</span>
                    )}
                  </div>

                  {/* Pay Now Button - visible after connection */}
                  {wallet.isConnected && (
                    <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <div className="font-medium text-purple-900 mb-2">Wallet Connected</div>
                      <div className="text-sm text-purple-700 mb-3">
                        Ready to proceed with payment.
                      </div>
                      <Button
                        type="button"
                        disabled={!canPay}
                        onClick={() => {
                          console.log('[HederaPaymentOption] Pay now clicked. Proceeding to token selection...', wallet);
                          setPaymentStep('select_token');
                          fetchPaymentAmounts();
                        }}
                        className="w-full"
                      >
                        Pay now
                      </Button>
                    </div>
                  )}
                </>
              )}

          {/* Step 2: Token Selection with Progressive Disclosure */}
          {!isLoadingAmounts && paymentAmounts.length > 0 && paymentStep === 'select_token' && (
            <>
              {/* Section 2: Compact Token Cards */}
              <TokenCardSelector
                paymentAmounts={paymentAmounts}
                selectedToken={selectedToken}
                onTokenSelect={handleTokenSelect}
              />
              
              {/* Section 3: Payment Details (only for selected token) */}
              {selectedToken && (
                <SelectedTokenDetails
                  selectedToken={selectedToken}
                  paymentAmounts={paymentAmounts}
                  fiatAmount={amount}
                  fiatCurrency={currency}
                />
              )}

              {/* Section 4: Wallet Balance (only for selected token) */}
              {selectedToken && (
                <SelectedTokenWallet
                  selectedToken={selectedToken}
                  paymentAmounts={paymentAmounts}
                  isWalletConnected={wallet.isConnected}
                  walletBalances={wallet.balances}
                />
              )}

              {/* Section 5: Continue Button (unchanged) */}
              <Button
                onClick={() => setPaymentStep('choose_payment_method')}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Continue with {selectedToken}
              </Button>
            </>
          )}

          {/* Step 3a: Choose Payment Method */}
          {paymentStep === 'choose_payment_method' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold mb-2">Choose Payment Method</h3>
                <p className="text-sm text-muted-foreground">
                  Select how you'd like to complete your payment
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Quick Pay Option */}
                <button
                  onClick={() => {
                    setPaymentMethod('quick_pay');
                    handleConfirmPayment();
                  }}
                  className="group relative overflow-hidden rounded-lg border-2 border-primary/20 hover:border-primary bg-card p-6 text-left transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Zap className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold mb-1">Quick Pay (Automated)</h4>
                      <p className="text-sm text-muted-foreground">
                        Pre-filled transaction with one-click approval in HashPack
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                        <Check className="h-3 w-3" />
                        <span>Fastest option</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Manual Payment Option */}
                <button
                  onClick={() => {
                    setPaymentMethod('manual');
                    setPaymentStep('manual_payment');
                  }}
                  className="group relative overflow-hidden rounded-lg border-2 border-muted hover:border-primary bg-card p-6 text-left transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold mb-1">Manual Payment</h4>
                      <p className="text-sm text-muted-foreground">
                        Copy payment details and send from your wallet manually
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="h-3 w-3" />
                        <span>Works with any wallet</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <Button
                onClick={() => setPaymentStep('select_token')}
                variant="outline"
                className="w-full"
              >
                Back to Token Selection
              </Button>
            </div>
          )}

          {/* Step 3b: Manual Payment Instructions */}
          {paymentStep === 'manual_payment' && merchantAccountId && (() => {
            const selectedAmount = paymentAmounts.find(a => a.tokenType === selectedToken);
            if (!selectedAmount) return null;

            return (
              <div className="space-y-4">
                <PaymentInstructions
                  tokenType={selectedToken}
                  amount={selectedAmount.requiredAmount}
                  totalAmount={selectedAmount.totalAmount}
                  merchantAccountId={merchantAccountId}
                  memo={`Provvypay:${paymentLinkId}`}
                  paymentLinkId={paymentLinkId}
                />

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => handleStartMonitoring()}
                    className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <Check className="mr-2 h-5 w-5" />
                    I&apos;ve Sent the Payment
                  </Button>
                  
                  <Button
                    onClick={() => setPaymentStep('choose_payment_method')}
                    variant="outline"
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Step 3c: Requesting Signature (HBAR only) */}
          {paymentStep === 'requesting_signature' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-lg font-semibold">Preparing transaction...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please wait while we prepare your payment request
              </p>
            </div>
          )}

          {/* Step 3d: Awaiting Approval (HBAR only) */}
          {paymentStep === 'awaiting_approval' && (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-lg font-semibold">Waiting for approval</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please approve the transaction in HashPack
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Check your HashPack wallet to approve or reject the payment
              </p>
            </div>
          )}

          {/* Step 3e: Rejected */}
          {paymentStep === 'rejected' && (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-lg font-semibold text-red-600">Transaction Rejected</p>
              <p className="text-sm text-muted-foreground mt-2">
                You can try again when you&apos;re ready
              </p>
              <Button
                onClick={() => setPaymentStep('select_token')}
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Step 4: Monitoring */}
          {paymentStep === 'monitoring' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-lg font-semibold">Monitoring for payment...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This usually takes 5-30 seconds
              </p>
            </div>
          )}

              {/* Step 5: Complete */}
              {paymentStep === 'complete' && (
                <div className="text-center py-8">
                  <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <p className="text-xl font-bold text-green-600">Payment Confirmed!</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Thank you for your payment
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
