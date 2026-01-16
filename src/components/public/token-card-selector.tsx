'use client';

/**
 * Token Card Selector Component - Progressive Disclosure UI
 * Compact token selection cards without detailed math
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import type { TokenType } from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { getTokenIcon } from '@/lib/hedera/token-service';

interface TokenCardSelectorProps {
  paymentAmounts: TokenPaymentAmount[];
  selectedToken: TokenType;
  onTokenSelect: (token: TokenType) => void;
}

export function TokenCardSelector({
  paymentAmounts,
  selectedToken,
  onTokenSelect,
}: TokenCardSelectorProps) {
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  const getTokenDescription = (tokenType: TokenType): string => {
    switch (tokenType) {
      case 'USDC':
        return 'Recommended stablecoin';
      case 'USDT':
        return 'Stablecoin';
      case 'AUDD':
        return 'AUD stablecoin';
      case 'HBAR':
        return 'Native token · Lowest fee · Price may vary';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Choose how you want to pay</h3>
          <p className="text-sm text-muted-foreground">
            Select your preferred token
          </p>
        </div>
        <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <Info className="h-4 w-4 mr-1" />
              Fees & price details
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Fees & Price Information</DialogTitle>
              <DialogDescription>
                Understanding token volatility and payment tolerance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Token Types</h4>
                <div className="space-y-2">
                  <div className="rounded-md bg-muted p-3">
                    <div className="font-medium text-green-600 mb-1">
                      Stablecoins (USDC, USDT, AUDD)
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Value is pegged to fiat currency. Price stays stable during payment.
                    </p>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <div className="font-medium text-yellow-600 mb-1">
                      HBAR (Native Token)
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Value can fluctuate. Lowest network fees but price may vary.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Payment Tolerance</h4>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between text-xs">
                    <span>HBAR:</span>
                    <span className="font-mono">±0.5% tolerance</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Stablecoins:</span>
                    <span className="font-mono">±0.1% tolerance</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Small price movements during payment are automatically accepted within these ranges.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Network Fees</h4>
                <p className="text-xs text-muted-foreground">
                  All transactions include a small network fee (~$0.0001). 
                  This is added to your total payment amount.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {paymentAmounts.map((amount) => {
          const isSelected = selectedToken === amount.tokenType;
          
          return (
            <Card
              key={amount.tokenType}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-2 bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => onTokenSelect(amount.tokenType)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTokenSelect(amount.tokenType);
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Pay with ${amount.tokenType}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl mt-1 flex-shrink-0">
                    {getTokenIcon(amount.tokenType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">
                        {amount.tokenType}
                      </span>
                      {amount.isRecommended && (
                        <Badge className="text-xs bg-green-600 hover:bg-green-700">
                          Best
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getTokenDescription(amount.tokenType)}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-primary-foreground"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

