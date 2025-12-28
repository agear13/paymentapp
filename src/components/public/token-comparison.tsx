'use client';

/**
 * Token Comparison Component
 * Shows side-by-side comparison of all three payment options
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { getTokenIcon, isStablecoin } from '@/lib/hedera/token-service';

interface TokenComparisonProps {
  paymentAmounts: TokenPaymentAmount[];
  fiatAmount: string;
  fiatCurrency: string;
}

export function TokenComparison({
  paymentAmounts,
  fiatAmount,
  fiatCurrency,
}: TokenComparisonProps) {
  // Sort by recommended first, then by total amount
  const sortedAmounts = [...paymentAmounts].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Options Comparison</CardTitle>
        <CardDescription>
          All amounts for {fiatAmount} {fiatCurrency} payment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {sortedAmounts.map((amount) => (
            <Card
              key={amount.tokenType}
              className={`relative ${
                amount.isRecommended
                  ? 'border-green-600 bg-green-50 dark:bg-green-950/20'
                  : ''
              }`}
            >
              <CardContent className="pt-6">
                {amount.isRecommended && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Recommended
                  </Badge>
                )}

                {/* Token Header */}
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">
                    {getTokenIcon(amount.tokenType)}
                  </div>
                  <div className="font-bold text-lg">{amount.tokenType}</div>
                  {isStablecoin(amount.tokenType) && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Stablecoin
                    </Badge>
                  )}
                </div>

                {/* Amount Details */}
                <div className="space-y-3">
                  {/* Required Amount */}
                  <div className="text-center pb-3 border-b">
                    <div className="text-sm text-muted-foreground mb-1">
                      Required Amount
                    </div>
                    <div className="font-mono text-xl font-bold">
                      {amount.requiredAmount}
                    </div>
                  </div>

                  {/* Fee */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. Fee:</span>
                    <span className="font-mono">{amount.estimatedFee}</span>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between font-semibold border-t pt-3">
                    <span>Total:</span>
                    <span className="font-mono">{amount.totalAmount}</span>
                  </div>

                  {/* Exchange Rate */}
                  <div className="text-xs text-center text-muted-foreground pt-2 border-t">
                    <div>1 {amount.tokenType} =</div>
                    <div className="font-mono">{amount.rate}</div>
                  </div>

                  {/* Recommendation Reason */}
                  {amount.recommendationReason && (
                    <div className="text-xs text-center p-2 rounded-md bg-muted">
                      {amount.recommendationReason}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Rate Volatility Indicator */}
        <div className="mt-6 pt-6 border-t">
          <div className="text-sm font-medium mb-3">Price Stability</div>
          <div className="grid gap-3 md:grid-cols-3">
            {sortedAmounts.map((amount) => (
              <div
                key={`volatility-${amount.tokenType}`}
                className="flex items-center justify-between rounded-md bg-muted/50 p-3"
              >
                <span className="text-sm font-medium">
                  {amount.tokenType}
                </span>
                {isStablecoin(amount.tokenType) ? (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <Minus className="h-4 w-4" />
                    <span>Stable</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    <span>Volatile</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tolerance Information */}
        <div className="mt-4 p-4 rounded-md bg-muted/50 text-sm">
          <div className="font-medium mb-2">Payment Tolerance</div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>HBAR:</span>
              <span>±0.5% (volatile token)</span>
            </div>
            <div className="flex justify-between">
              <span>USDC / USDT / AUDD:</span>
              <span>±0.1% (stablecoins)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}






