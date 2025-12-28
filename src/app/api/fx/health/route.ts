/**
 * FX Health Check API Endpoint
 * 
 * GET /api/fx/health
 * 
 * Check health of FX rate providers and cache
 */

import { NextResponse } from 'next/server';
import { getFxService } from '@/lib/fx';
import { log } from '@/lib/logger';

const logger = log.child({ domain: 'api:fx:health' });

/**
 * GET /api/fx/health
 * 
 * Check health of FX system
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "providers": {
 *       "coingecko": true,
 *       "hedera_mirror": true
 *     },
 *     "cache": {
 *       "size": 10,
 *       "activeCount": 8
 *     },
 *     "metadata": [...]
 *   }
 * }
 */
export async function GET() {
  try {
    logger.info('Checking FX system health');

    const fxService = getFxService();

    // Check provider health
    const providerHealth = await fxService.checkProviderHealth();

    // Get cache stats
    const cacheStats = fxService.getCacheStats();

    // Get provider metadata
    const metadata = await fxService.getProviderMetadata();

    // Overall health is OK if at least one provider is available
    const isHealthy = Object.values(providerHealth).some(healthy => healthy);

    return NextResponse.json({
      success: true,
      healthy: isHealthy,
      data: {
        providers: providerHealth,
        cache: cacheStats,
        metadata,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Health check failed');

    return NextResponse.json(
      {
        success: false,
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    );
  }
}













