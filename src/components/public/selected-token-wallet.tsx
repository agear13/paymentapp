'use client';

/**
 * Selected Token Wallet Component
 * Shows wallet balance and connection status for selected token only
 */

import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Wallet } from 'lucide-react';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { getTokenIcon } from '@/lib/hedera/token-service';

interface SelectedTokenWalletProps {
  selectedToken: TokenType;
  paymentAmounts: TokenPaymentAmount[];
  isWalletConnected: boolean;
  walletBalances?: {
    HBAR: string;
    USDC: string;
    USDT: string;
    AUDD: string;
  };
}

export function SelectedTokenWallet({
  selectedToken,
  paymentAmounts,
  isWalletConnected,
  walletBalances,
}: SelectedTokenWalletProps) {
  const selectedAmount = paymentAmounts.find(
    (a) => a.tokenType === selectedToken
  );

  if (!selectedAmount) {
    return null;
  }

  // Not connected - show prompt
  if (!isWalletConnected) {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Wallet className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-900 mb-1">
                Connect wallet to continue
              </p>
              <p className="text-sm text-purple-700">
                Your wallet connection is required to complete the payment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected - show balance
  const balance = walletBalances ? walletBalances[selectedToken] : null;
  const hasBalance =
    balance && parseFloat(balance) >= parseFloat(selectedAmount.totalAmount);
  const balanceNumber = balance ? parseFloat(balance) : 0;

  return (
    <Card className={hasBalance ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getTokenIcon(selectedToken)}</span>
              <span className="font-medium">Your {selectedToken} balance</span>
            </div>
          </div>

          {balance !== null ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Available:</span>
                <span className="font-mono text-lg font-semibold">
                  {balanceNumber.toFixed(4)} {selectedToken}
                </span>
              </div>

              {!hasBalance && (
                <div className="flex items-start gap-2 pt-3 border-t border-amber-300">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-amber-900 font-medium">
                      Insufficient balance
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      You need {selectedAmount.totalAmount} {selectedToken} to complete this payment.
                      {selectedToken !== 'HBAR' && ' You also need a small amount of HBAR for network fees.'}
                    </p>
                  </div>
                </div>
              )}

              {hasBalance && (
                <div className="pt-3 border-t border-green-300">
                  <p className="text-sm text-green-700">
                    ✓ Sufficient balance to complete payment
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Loading balance...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

