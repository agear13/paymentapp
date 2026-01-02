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
import { TokenSelector } from '@/components/public/token-selector';
import { TokenComparison } from '@/components/public/token-comparison';
import { PaymentInstructions } from '@/components/public/payment-instructions';
// CRITICAL: Import from .client.ts ONLY (never from barrel export)
import { getWalletState, initHashConnect } from '@/lib/hedera/wallet-service.client';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';

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

type PaymentStep = 'select_method' | 'connect_wallet' | 'select_token' | 'confirm_payment' | 'monitoring' | 'complete';

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
  const [isLoadingAmounts, setIsLoadingAmounts] = useState(false);
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(null);
  const [isLoadingMerchant, setIsLoadingMerchant] = useState(false);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  
  // HashConnect initialization state
  const [isInitializingHashConnect, setIsInitializingHashConnect] = useState(false);
  const [hashConnectInitialized, setHashConnectInitialized] = useState(false);
  const [hashConnectError, setHashConnectError] = useState<string | null>(null);

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

  const handleWalletConnected = () => {
    setPaymentStep('select_token');
    // Refresh payment amounts with wallet balances
    fetchPaymentAmounts();
  };

  const handleTokenSelect = (token: TokenType) => {
    setSelectedToken(token);
  };

  const handleConfirmPayment = () => {
    setPaymentStep('confirm_payment');
  };

  const handleStartMonitoring = async () => {
    setPaymentStep('monitoring');
    
    // Start monitoring for payment
    try {
      const selectedAmount = paymentAmounts.find(a => a.tokenType === selectedToken);
      if (!selectedAmount) return;

      const response = await fetch('/api/hedera/transactions/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: merchantAccountId,
          tokenType: selectedToken,
          expectedAmount: parseFloat(selectedAmount.totalAmount),
          timeoutMs: 300000, // 5 minutes
        }),
      });

      if (!response.ok) {
        throw new Error('Payment monitoring failed');
      }

      const result = await response.json();
      
      if (result.data.validation.isValid) {
        setPaymentStep('complete');
        toast.success('Payment confirmed!');
      } else {
        toast.error(result.data.validation.message || 'Payment validation failed');
      }
    } catch (error) {
      console.error('Payment monitoring error:', error);
      toast.error('Failed to monitor payment');
    }
  };

  const getWalletState = () => {
    return {
      isConnected: false,
      balances: {
        HBAR: '0.00000000',
        USDC: '0.000000',
        USDT: '0.000000',
        AUDD: '0.000000',
      },
    };
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
                <WalletConnectButton />
              )}

          {/* Step 2: Token Comparison & Selection */}
          {!isLoadingAmounts && paymentAmounts.length > 0 && paymentStep === 'select_token' && (
            <>
              <TokenComparison
                paymentAmounts={paymentAmounts}
                fiatAmount={amount}
                fiatCurrency={currency}
              />
              
              <TokenSelector
                paymentAmounts={paymentAmounts}
                selectedToken={selectedToken}
                onTokenSelect={handleTokenSelect}
                walletBalances={getWalletState().balances}
              />

              <Button
                onClick={handleConfirmPayment}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Continue with {selectedToken}
              </Button>
            </>
          )}

          {/* Step 3: Payment Instructions */}
          {paymentStep === 'confirm_payment' && (
            <>
              {paymentAmounts
                .filter(a => a.tokenType === selectedToken)
                .map(amount => (
                  <PaymentInstructions
                    key={amount.tokenType}
                    tokenType={amount.tokenType}
                    amount={amount.requiredAmount}
                    totalAmount={amount.totalAmount}
                    merchantAccountId={merchantAccountId}
                    paymentLinkId={paymentLinkId}
                  />
                ))}

              <Button
                onClick={handleStartMonitoring}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                I've Sent the Payment
              </Button>
            </>
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
