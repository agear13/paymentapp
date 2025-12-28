/**
 * POST /api/hedera/payment-amounts
 * Calculate required payment amounts for all three tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFxService } from '@/lib/fx';
import {
  ESTIMATED_FEES,
  type TokenType,
  TOKEN_CONFIG,
} from '@/lib/hedera/constants';
import type { TokenPaymentAmount } from '@/lib/hedera/types';
import { log } from '@/lib/logger';
import { handleApiError } from '@/lib/api/middleware';
import { formatTokenAmount, isStablecoin } from '@/lib/hedera/token-service';

const requestSchema = z.object({
  fiatAmount: z.number().positive(),
  fiatCurrency: z.string().length(3),
  walletBalances: z
    .object({
      HBAR: z.string(),
      USDC: z.string(),
      USDT: z.string(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fiatAmount, fiatCurrency, walletBalances } =
      requestSchema.parse(body);

    log.info({ fiatAmount, fiatCurrency }, 'Calculating payment amounts');

    const fxService = getFxService();
    const tokens: TokenType[] = ['HBAR', 'USDC', 'USDT'];

    // Calculate amounts for all three tokens in parallel
    const calculations = await Promise.all(
      tokens.map(async (tokenType) => {
        const calc = await fxService.calculateCryptoAmount(
          fiatAmount,
          fiatCurrency,
          tokenType
        );

        const estimatedFee = ESTIMATED_FEES[tokenType];
        const totalAmount = calc.targetAmount + estimatedFee;

        return {
          tokenType,
          calculation: calc,
          estimatedFee,
          totalAmount,
        };
      })
    );

    // Determine recommended token
    const paymentAmounts: TokenPaymentAmount[] = calculations.map(
      ({ tokenType, calculation, estimatedFee, totalAmount }, index) => {
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
          requiredAmount: formatTokenAmount(
            calculation.targetAmount,
            tokenType
          ),
          requiredAmountRaw: calculation.targetAmount,
          fiatAmount: fiatAmount.toFixed(2),
          fiatCurrency,
          rate: `${calculation.rate.toFixed(8)} ${fiatCurrency}/${tokenType}`,
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
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return handleApiError(error, 'Failed to calculate payment amounts');
  }
}












