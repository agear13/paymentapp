/**
 * POST /api/public/pay/[shortCode]/evm/payment-amounts
 * Calculate required EVM token amounts for MetaMask checkout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EVM_SETTLEMENT_TOKENS, type EvmSettlementToken } from '@/lib/evm/tokens';
import { handleApiError } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { calculateSimpleTokenCheckoutAmounts } from '@/lib/payments/token-checkout-amounts.server';

const requestSchema = z.object({
  fiatAmount: z.number().positive(),
  fiatCurrency: z.string().length(3),
});

export type EvmTokenPaymentAmount = {
  tokenType: EvmSettlementToken;
  requiredAmount: string;
  requiredAmountRaw: number;
  fiatAmount: string;
  fiatCurrency: string;
  rate: string;
  exchangeRate: number;
  isRecommended: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fiatAmount, fiatCurrency } = requestSchema.parse(body);

    log.info('Calculating EVM payment amounts', { fiatAmount, fiatCurrency });

    const paymentAmounts = (await calculateSimpleTokenCheckoutAmounts({
      fiatAmount,
      fiatCurrency,
      tokens: EVM_SETTLEMENT_TOKENS,
      defaultRecommendedToken: 'USDC',
    })) as EvmTokenPaymentAmount[];

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
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return handleApiError(error, 500);
  }
}
