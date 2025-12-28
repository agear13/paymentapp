/**
 * FX Calculate API Endpoint
 * 
 * POST /api/fx/calculate
 * 
 * Calculate conversion amounts between currencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFxService } from '@/lib/fx';
import { log } from '@/lib/logger';
import type { Currency } from '@/lib/fx/types';
import { z } from 'zod';

const logger = log.child({ domain: 'api:fx:calculate' });

/**
 * Request body schema
 */
const calculateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  fromCurrency: z.string().length(3, 'Currency must be 3 characters').or(z.string().length(4)),
  toCurrency: z.string().length(3, 'Currency must be 3 characters').or(z.string().length(4)),
  direction: z.enum(['fiat-to-crypto', 'crypto-to-fiat']).optional(),
});

/**
 * POST /api/fx/calculate
 * 
 * Calculate conversion between currencies
 * 
 * Request body:
 * {
 *   "amount": 100,
 *   "fromCurrency": "AUD",
 *   "toCurrency": "HBAR",
 *   "direction": "fiat-to-crypto"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = calculateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { amount, fromCurrency, toCurrency, direction } = validation.data;

    logger.info({ amount, fromCurrency, toCurrency, direction }, 'Calculating conversion');

    const fxService = getFxService();

    // Determine conversion direction
    const isFiatToCrypto = direction === 'fiat-to-crypto' || 
      (['USD', 'AUD', 'EUR', 'GBP', 'CAD', 'NZD', 'SGD'].includes(fromCurrency) &&
       ['HBAR', 'USDC'].includes(toCurrency));

    let result;

    if (isFiatToCrypto) {
      result = await fxService.calculateCryptoAmount(
        amount,
        fromCurrency as Currency,
        toCurrency as Currency
      );
    } else {
      result = await fxService.calculateFiatAmount(
        amount,
        fromCurrency as Currency,
        toCurrency as Currency
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        formatted: {
          sourceAmount: fxService.formatAmount(result.sourceAmount, result.sourceCurrency),
          targetAmount: fxService.formatAmount(result.targetAmount, result.targetCurrency),
          rate: fxService.formatRate(result.rate),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to calculate conversion');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate conversion',
      },
      { status: 500 }
    );
  }
}













