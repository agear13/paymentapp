/**
 * FX Rates API Endpoint
 * 
 * GET /api/fx/rates?base=HBAR&quote=USD
 * GET /api/fx/rates?pairs=HBAR/USD,USDC/USD
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFxService } from '@/lib/fx';
import { log } from '@/lib/logger';
import type { Currency } from '@/lib/fx/types';

const logger = log.child({ domain: 'api:fx:rates' });

/**
 * GET /api/fx/rates
 * 
 * Fetch current exchange rates
 * 
 * Query parameters:
 * - base: Base currency (e.g., HBAR)
 * - quote: Quote currency (e.g., USD)
 * - pairs: Multiple pairs separated by comma (e.g., HBAR/USD,USDC/USD)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const base = searchParams.get('base');
    const quote = searchParams.get('quote');
    const pairsParam = searchParams.get('pairs');

    const fxService = getFxService();

    // Handle multiple pairs request
    if (pairsParam) {
      const pairStrings = pairsParam.split(',').map(p => p.trim());
      const pairs = pairStrings.map(pairStr => {
        const [b, q] = pairStr.split('/');
        if (!b || !q) {
          throw new Error(`Invalid pair format: ${pairStr}. Expected format: BASE/QUOTE`);
        }
        return { base: b as Currency, quote: q as Currency };
      });

      logger.info({ pairs }, 'Fetching multiple rates');

      const rates = await fxService.getRates(pairs);

      return NextResponse.json({
        success: true,
        data: rates,
        count: rates.length,
      });
    }

    // Handle single pair request
    if (!base || !quote) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: base and quote (or pairs)',
          example: '/api/fx/rates?base=HBAR&quote=USD',
        },
        { status: 400 }
      );
    }

    logger.info({ base, quote }, 'Fetching single rate');

    const rate = await fxService.getRate(base as Currency, quote as Currency);

    return NextResponse.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch rates');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rates',
      },
      { status: 500 }
    );
  }
}













