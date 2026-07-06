/**
 * POST /api/hedera/payment-amounts
 * Calculate required payment amounts for all supported tokens (HBAR, USDC, USDT, AUDD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ESTIMATED_FEES,
  type TokenType,
} from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';
import { formatTokenAmount, isStablecoin } from '@/lib/hedera/token-service';
import { calculateSimpleTokenCheckoutAmounts } from '@/lib/payments/token-checkout-amounts.server';

const requestSchema = z.object({
  fiatAmount: z.number().positive(),
  fiatCurrency: z.string().length(3),
  walletBalances: z
    .object({
      HBAR: z.string(),
      USDC: z.string(),
      USDT: z.string(),
      AUDD: z.string(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fiatAmount, fiatCurrency, walletBalances } =
      requestSchema.parse(body);

    log.info('Calculating payment amounts', { fiatAmount, fiatCurrency });

    const tokens: TokenType[] = ['HBAR', 'USDC', 'USDT', 'AUDD'];

    const baseAmounts = await calculateSimpleTokenCheckoutAmounts({
      fiatAmount,
      fiatCurrency,
      tokens,
      defaultRecommendedToken: 'USDC',
      formatAmount: (amount, tokenType) =>
        formatTokenAmount(amount, tokenType as TokenType),
    });

    const calculations = baseAmounts.map((item) => {
      const tokenType = item.tokenType as TokenType;
      const estimatedFee = ESTIMATED_FEES[tokenType];
      const totalAmount = item.requiredAmountRaw + estimatedFee;
      return {
        tokenType,
        item,
        estimatedFee,
        totalAmount,
      };
    });

    const paymentAmounts: TokenPaymentAmount[] = calculations.map(
      ({ tokenType, item, estimatedFee, totalAmount }) => {
        // Recommendation logic
        let isRecommended = false;
        let recommendationReason = '';

        // Check if user has sufficient balance
        const hasBalance = walletBalances
          ? parseFloat(walletBalances[tokenType]) >= totalAmount
          : false;

        // Recommend stablecoins first if user has balance
        if (isStablecoin(tokenType) && hasBalance) {
          isRecommended = true;
          recommendationReason = 'Stable value + sufficient balance';
        } else if (isStablecoin(tokenType)) {
          recommendationReason = 'Stable value, no price volatility';
        } else if (tokenType === 'HBAR' && hasBalance) {
          recommendationReason = 'Native token with sufficient balance';
        } else {
          recommendationReason = 'Native token, lowest fee';
        }

        // If no tokens have balance, recommend USDC by default
        if (
          !calculations.some((c) => {
            const bal = walletBalances?.[c.tokenType];
            return bal && parseFloat(bal) >= c.totalAmount;
          }) &&
          tokenType === 'USDC'
        ) {
          isRecommended = true;
          recommendationReason = 'Recommended stablecoin';
        }

        return {
          tokenType,
          requiredAmount: item.requiredAmount,
          requiredAmountRaw: item.requiredAmountRaw,
          fiatAmount: item.fiatAmount,
          fiatCurrency: item.fiatCurrency,
          rate: item.rate,
          estimatedFee: formatTokenAmount(estimatedFee, tokenType),
          totalAmount: formatTokenAmount(totalAmount, tokenType),
          isRecommended,
          recommendationReason,
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        fiatAmount,
        fiatCurrency,
        paymentAmounts,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return handleApiError(error, 500);
  }
}












