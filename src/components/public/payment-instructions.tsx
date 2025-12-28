'use client';

/**
 * Payment Instructions Component
 * Shows how to complete payment with selected token
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { TokenType } from '@/lib/hedera/constants';
import { getTokenIcon } from '@/lib/hedera/token-service';

interface PaymentInstructionsProps {
  tokenType: TokenType;
  amount: string;
  totalAmount: string;
  merchantAccountId: string;
  memo?: string;
  paymentLinkId: string;
}

export function PaymentInstructions({
  tokenType,
  amount,
  totalAmount,
  merchantAccountId,
  memo,
  paymentLinkId,
}: PaymentInstructionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{getTokenIcon(tokenType)}</span>
          Payment Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Amount */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge>Step 1</Badge>
            <span className="text-sm font-medium">Send Exactly</span>
          </div>
          <div className="rounded-md bg-muted p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-2xl font-bold">
                  {totalAmount} {tokenType}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Includes network fee
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(totalAmount, 'amount')}
              >
                {copiedField === 'amount' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Recipient */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge>Step 2</Badge>
            <span className="text-sm font-medium">Send To</span>
          </div>
          <div className="rounded-md bg-muted p-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm break-all pr-2">
                {merchantAccountId}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(merchantAccountId, 'accountId')
                }
              >
                {copiedField === 'accountId' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 3: Memo (Optional) */}
        {memo && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge>Step 3</Badge>
              <span className="text-sm font-medium">
                Include Memo (Optional)
              </span>
            </div>
            <div className="rounded-md bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm break-all pr-2">{memo}</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(memo, 'memo')}
                >
                  {copiedField === 'memo' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div className="rounded-md border border-yellow-600/20 bg-yellow-50 dark:bg-yellow-950/20 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Important Notes
              </p>
              <ul className="space-y-1 text-yellow-800 dark:text-yellow-200 list-disc list-inside">
                <li>
                  Send <strong>exactly</strong> {totalAmount} {tokenType}
                </li>
                <li>
                  Use the <strong>{tokenType}</strong> token only
                </li>
                <li>
                  Payment will be detected automatically within 30 seconds
                </li>
                <li>
                  Do not close this page until payment is confirmed
                </li>
                {tokenType === 'USDC' || tokenType === 'USDT' || tokenType === 'AUDD' ? (
                  <li>
                    Ensure your wallet is associated with{' '}
                    <strong>{tokenType}</strong> token
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>

        {/* Tolerance Info */}
        <div className="text-xs text-center text-muted-foreground">
          <p>
            Payment tolerance:{' '}
            {tokenType === 'HBAR' ? '±0.5%' : '±0.1%'}
          </p>
          <p className="mt-1">
            Reference: {paymentLinkId.slice(0, 8)}...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}






