'use client';

/**
 * Token Selector Component
 * Allows user to select payment token (HBAR, USDC, USDT, or AUDD)
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Info } from 'lucide-react';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { getTokenIcon, isStablecoin } from '@/lib/hedera/token-service';

interface TokenSelectorProps {
  paymentAmounts: TokenPaymentAmount[];
  selectedToken: TokenType;
  onTokenSelect: (token: TokenType) => void;
  walletBalances?: {
    HBAR: string;
    USDC: string;
    USDT: string;
    AUDD: string;
  };
}

export function TokenSelector({
  paymentAmounts,
  selectedToken,
  onTokenSelect,
  walletBalances,
}: TokenSelectorProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Select Payment Token</h3>
            <p className="text-sm text-muted-foreground">
              Choose how you want to pay
            </p>
          </div>

          <RadioGroup
            value={selectedToken}
            onValueChange={(value) => onTokenSelect(value as TokenType)}
            className="space-y-3"
          >
            {paymentAmounts.map((amount) => {
              const hasBalance = walletBalances
                ? parseFloat(walletBalances[amount.tokenType]) >=
                  parseFloat(amount.totalAmount)
                : false;
              const balance = walletBalances
                ? walletBalances[amount.tokenType]
                : null;

              return (
                <div key={amount.tokenType}>
                  <Label
                    htmlFor={amount.tokenType}
                    className="flex cursor-pointer"
                  >
                    <Card
                      className={`flex-1 transition-all ${
                        selectedToken === amount.tokenType
                          ? 'border-primary ring-2 ring-primary ring-offset-2'
                          : 'hover:border-primary/50'
                      }`}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        {/* Radio button */}
                        <RadioGroupItem
                          value={amount.tokenType}
                          id={amount.tokenType}
                        />

                        {/* Token icon and name */}
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">
                            {getTokenIcon(amount.tokenType)}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {amount.tokenType}
                              </span>
                              {isStablecoin(amount.tokenType) && (
                                <Badge variant="secondary" className="text-xs">
                                  Stable
                                </Badge>
                              )}
                              {amount.isRecommended && (
                                <Badge className="text-xs bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Recommended
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {amount.recommendationReason ||
                                (isStablecoin(amount.tokenType)
                                  ? 'Stable value'
                                  : 'Native token')}
                            </p>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <div className="font-mono font-semibold">
                            {amount.requiredAmount}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            + {amount.estimatedFee} fee
                          </div>
                          {balance && (
                            <div
                              className={`text-xs mt-1 ${
                                hasBalance
                                  ? 'text-green-600'
                                  : 'text-destructive'
                              }`}
                            >
                              Balance: {parseFloat(balance).toFixed(4)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {/* Selected token details */}
          {selectedToken && (
            <div className="rounded-md bg-muted p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">Payment Details</p>
                  {paymentAmounts
                    .filter((a) => a.tokenType === selectedToken)
                    .map((amount) => (
                      <div key={amount.tokenType} className="space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Amount:</span>
                          <span className="font-mono">
                            {amount.requiredAmount} {amount.tokenType}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Est. Fee:</span>
                          <span className="font-mono">
                            {amount.estimatedFee} {amount.tokenType}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Total:</span>
                          <span className="font-mono">
                            {amount.totalAmount} {amount.tokenType}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                          <span>Exchange Rate:</span>
                          <span className="font-mono">{amount.rate}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

