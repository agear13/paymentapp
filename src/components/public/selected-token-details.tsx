'use client';

/**
 * Selected Token Details Component
 * Shows payment breakdown for the selected token only
 */

import { Card, CardContent } from '@/components/ui/card';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { getTokenIcon } from '@/lib/hedera/token-service';

interface SelectedTokenDetailsProps {
  selectedToken: TokenType;
  paymentAmounts: TokenPaymentAmount[];
  fiatAmount: string;
  fiatCurrency: string;
}

export function SelectedTokenDetails({
  selectedToken,
  paymentAmounts,
  fiatAmount,
  fiatCurrency,
}: SelectedTokenDetailsProps) {
  const selectedAmount = paymentAmounts.find(
    (a) => a.tokenType === selectedToken
  );

  if (!selectedAmount) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-4 border-b">
            <span className="text-2xl">{getTokenIcon(selectedToken)}</span>
            <h3 className="text-lg font-semibold">
              Payment details — {selectedToken}
            </h3>
          </div>

          <div className="space-y-3 text-sm">
            {/* Amount Due */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount due</span>
              <div className="text-right">
                <div className="font-mono font-medium">
                  {selectedAmount.requiredAmount} {selectedToken}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fiatAmount} {fiatCurrency}
                </div>
              </div>
            </div>

            {/* Estimated Fee */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Network fee</span>
              <span className="font-mono font-medium text-muted-foreground">
                + {selectedAmount.estimatedFee} {selectedToken}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t pt-3">
              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total to pay</span>
                <span className="font-mono font-bold text-lg">
                  {selectedAmount.totalAmount} {selectedToken}
                </span>
              </div>
            </div>

            {/* Exchange Rate */}
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Exchange rate</span>
                <span className="font-mono text-muted-foreground">
                  {selectedAmount.rate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

