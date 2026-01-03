/**
 * FX Snapshot Service
 * 
 * Service for creating and managing FX rate snapshots at payment link
 * creation and settlement times.
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import type { FxSnapshot, FxSnapshotType } from '@prisma/client';
import type { Currency, FxSnapshotData } from './types';
import { getRateProviderFactory } from './rate-provider-factory';
import { getRateCache } from './rate-cache';
import { randomUUID } from 'crypto';

const logger = log.child({ domain: 'fx:snapshot' });

/**
 * Snapshot validation result
 */
interface SnapshotValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * FX Snapshot Service
 */
export class FxSnapshotService {
  /**
   * Create FX snapshot for a payment link
   */
  async createSnapshot(data: FxSnapshotData): Promise<FxSnapshot> {
    logger.info(
      {
        paymentLinkId: data.paymentLinkId,
        snapshotType: data.snapshotType,
        tokenType: data.tokenType,
        pair: `${data.baseCurrency}/${data.quoteCurrency}`,
      },
      'Creating FX snapshot'
    );

    try {
      // Validate snapshot data
      this.validateSnapshotData(data);

      // Create snapshot in database
      const snapshot = await prisma.fxSnapshot.create({
        data: {
          paymentLinkId: data.paymentLinkId,
          snapshotType: data.snapshotType,
          tokenType: data.tokenType,
          baseCurrency: data.baseCurrency,
          quoteCurrency: data.quoteCurrency,
          rate: data.rate,
          provider: data.provider,
          capturedAt: data.capturedAt || new Date(),
        },
      });

      logger.info(
        { snapshotId: snapshot.id, tokenType: data.tokenType, rate: snapshot.rate.toString() },
        'FX snapshot created'
      );

      return snapshot;
    } catch (error) {
      logger.error(
        { error, data },
        'Failed to create FX snapshot'
      );
      throw error;
    }
  }

  /**
   * Capture creation-time snapshot for a payment link (single token)
   */
  async captureCreationSnapshot(
    paymentLinkId: string,
    baseCurrency: Currency,
    quoteCurrency: Currency,
    tokenType?: Currency
  ): Promise<FxSnapshot> {
    logger.info(
      { paymentLinkId, tokenType, pair: `${baseCurrency}/${quoteCurrency}` },
      'Capturing creation-time snapshot'
    );

    // Get rate from cache or provider
    const rate = await this.fetchRate(baseCurrency, quoteCurrency);

    // Create snapshot
    return this.createSnapshot({
      paymentLinkId,
      snapshotType: 'CREATION',
      tokenType,
      baseCurrency,
      quoteCurrency,
      rate: rate.rate,
      provider: rate.provider,
      capturedAt: rate.timestamp,
    });
  }

  /**
   * Capture creation-time snapshots for all tokens (HBAR, USDC, USDT, AUDD)
   * OPTIMIZED: Parallel rate fetching + batch database insert
   */
  async captureAllCreationSnapshots(
    paymentLinkId: string,
    quoteCurrency: Currency
  ): Promise<FxSnapshot[]> {
    logger.info(
      { paymentLinkId, quoteCurrency },
      'Capturing creation-time snapshots for all tokens'
    );

    const tokens: Currency[] = ['HBAR', 'USDC', 'USDT', 'AUDD'];
    
    // 📊 PERFORMANCE: Fetch rates in parallel (4 concurrent requests)
    // This reduces 4 sequential API calls to 1 batch
    const ratePromises = tokens.map(token => 
      this.fetchRate(token, quoteCurrency).catch(error => {
        logger.warn({ token, error }, 'Failed to fetch rate for token');
        return null;
      })
    );

    const rates = await Promise.all(ratePromises);

    // 📊 PERFORMANCE: Prepare batch insert data
    const capturedAt = new Date(); // Same timestamp for all snapshots
    const snapshotData = tokens
      .map((token, i) => {
        const rate = rates[i];
        if (!rate) return null;

        return {
          id: randomUUID(),
          paymentLinkId,
          snapshotType: 'CREATION' as const,
          tokenType: token,
          baseCurrency: token,
          quoteCurrency,
          rate: rate.rate,
          provider: rate.provider,
          capturedAt: rate.timestamp || capturedAt,
        };
      })
      .filter((data): data is NonNullable<typeof data> => data !== null);

    // 📊 PERFORMANCE: Batch insert all snapshots in a single DB query
    // This reduces 4 sequential inserts (~200ms) to 1 batch insert (~50ms)
    if (snapshotData.length > 0) {
      const result = await prisma.fxSnapshot.createMany({
        data: snapshotData,
        skipDuplicates: true, // Safety net
      });

      logger.info(
        { paymentLinkId, count: result.count, tokens: snapshotData.map(s => s.tokenType) },
        'Batch created FX snapshots for all tokens'
      );
    }

    // Fetch the created snapshots to return (with IDs)
    const snapshots = await prisma.fxSnapshot.findMany({
      where: {
        paymentLinkId,
        snapshotType: 'CREATION',
        tokenType: { in: tokens },
      },
      orderBy: { capturedAt: 'desc' },
      take: tokens.length,
    });

    logger.info(
      { paymentLinkId, count: snapshots.length },
      'Created creation-time snapshots for all tokens'
    );

    return snapshots;
  }

  /**
   * Capture settlement-time snapshot for a payment link (single token)
   */
  async captureSettlementSnapshot(
    paymentLinkId: string,
    baseCurrency: Currency,
    quoteCurrency: Currency,
    tokenType?: Currency
  ): Promise<FxSnapshot> {
    logger.info(
      { paymentLinkId, tokenType, pair: `${baseCurrency}/${quoteCurrency}` },
      'Capturing settlement-time snapshot'
    );

    // Always fetch fresh rate for settlement (bypass cache)
    const factory = getRateProviderFactory();
    const rate = await factory.getRate(baseCurrency, quoteCurrency);

    // Create snapshot
    return this.createSnapshot({
      paymentLinkId,
      snapshotType: 'SETTLEMENT',
      tokenType,
      baseCurrency,
      quoteCurrency,
      rate: rate.rate,
      provider: rate.provider,
      capturedAt: rate.timestamp,
    });
  }

  /**
   * Get all snapshots for a payment link
   */
  async getSnapshots(paymentLinkId: string): Promise<FxSnapshot[]> {
    return prisma.fxSnapshot.findMany({
      where: { paymentLinkId },
      orderBy: { capturedAt: 'asc' },
    });
  }

  /**
   * Get specific snapshot by type
   */
  async getSnapshotByType(
    paymentLinkId: string,
    snapshotType: FxSnapshotType,
    tokenType?: Currency
  ): Promise<FxSnapshot | null> {
    return prisma.fxSnapshot.findFirst({
      where: {
        paymentLinkId,
        snapshotType,
        ...(tokenType && { tokenType }),
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  /**
   * Get snapshots by token type
   */
  async getSnapshotsByToken(
    paymentLinkId: string,
    tokenType: Currency
  ): Promise<FxSnapshot[]> {
    return prisma.fxSnapshot.findMany({
      where: {
        paymentLinkId,
        tokenType,
      },
      orderBy: { capturedAt: 'asc' },
    });
  }

  /**
   * Get creation snapshot rate
   */
  async getCreationRate(
    paymentLinkId: string,
    tokenType?: Currency
  ): Promise<number | null> {
    const snapshot = await this.getSnapshotByType(paymentLinkId, 'CREATION', tokenType);
    return snapshot ? parseFloat(snapshot.rate.toString()) : null;
  }

  /**
   * Get settlement snapshot rate
   */
  async getSettlementRate(
    paymentLinkId: string,
    tokenType?: Currency
  ): Promise<number | null> {
    const snapshot = await this.getSnapshotByType(paymentLinkId, 'SETTLEMENT', tokenType);
    return snapshot ? parseFloat(snapshot.rate.toString()) : null;
  }

  /**
   * Calculate rate variance between creation and settlement
   */
  async calculateRateVariance(
    paymentLinkId: string,
    tokenType?: Currency
  ): Promise<{
    creationRate: number;
    settlementRate: number;
    variance: number;
    variancePercent: number;
  } | null> {
    const creationRate = await this.getCreationRate(paymentLinkId, tokenType);
    const settlementRate = await this.getSettlementRate(paymentLinkId, tokenType);

    if (!creationRate || !settlementRate) {
      return null;
    }

    const variance = settlementRate - creationRate;
    const variancePercent = (variance / creationRate) * 100;

    return {
      creationRate,
      settlementRate,
      variance,
      variancePercent,
    };
  }

  /**
   * Validate snapshot (sanity checks on rate)
   */
  validateSnapshot(snapshot: FxSnapshot): SnapshotValidation {
    const result: SnapshotValidation = {
      isValid: true,
      warnings: [],
      errors: [],
    };

    const rate = parseFloat(snapshot.rate.toString());

    // Check if rate is positive
    if (rate <= 0) {
      result.isValid = false;
      result.errors.push('Rate must be positive');
    }

    // Check for extreme rates (potential errors)
    if (rate < 0.000001) {
      result.warnings.push('Rate is very low, please verify');
    }

    if (rate > 1000000) {
      result.warnings.push('Rate is very high, please verify');
    }

    // Check for USDC/USD peg (should be close to 1.0)
    if (
      snapshot.baseCurrency === 'USDC' &&
      snapshot.quoteCurrency === 'USD'
    ) {
      if (Math.abs(rate - 1.0) > 0.05) {
        result.warnings.push('USDC/USD rate deviates significantly from 1.0 peg');
      }
    }

    // Check for USDT/USD peg (should be close to 1.0)
    if (
      snapshot.baseCurrency === 'USDT' &&
      snapshot.quoteCurrency === 'USD'
    ) {
      if (Math.abs(rate - 1.0) > 0.05) {
        result.warnings.push('USDT/USD rate deviates significantly from 1.0 peg');
      }
    }

    // Check for AUDD/AUD peg (should be close to 1.0)
    if (
      snapshot.baseCurrency === 'AUDD' &&
      snapshot.quoteCurrency === 'AUD'
    ) {
      if (Math.abs(rate - 1.0) > 0.05) {
        result.warnings.push('AUDD/AUD rate deviates significantly from 1.0 peg');
      }
    }

    return result;
  }

  /**
   * Fetch rate from cache or provider
   */
  private async fetchRate(base: Currency, quote: Currency) {
    // Try cache first
    const cache = getRateCache();
    const cachedRate = cache.get(base, quote);

    if (cachedRate) {
      logger.debug({ base, quote }, 'Using cached rate');
      return cachedRate;
    }

    // Fetch from provider
    const factory = getRateProviderFactory();
    const rate = await factory.getRate(base, quote);

    // Cache the rate
    cache.set(rate);

    return rate;
  }

  /**
   * Validate snapshot data before creation
   */
  private validateSnapshotData(data: FxSnapshotData): void {
    if (!data.paymentLinkId) {
      throw new Error('Payment link ID is required');
    }

    if (!data.baseCurrency || !data.quoteCurrency) {
      throw new Error('Both base and quote currencies are required');
    }

    if (!data.rate || data.rate <= 0) {
      throw new Error('Rate must be a positive number');
    }

    if (!data.provider) {
      throw new Error('Provider is required');
    }

    if (!['CREATION', 'SETTLEMENT'].includes(data.snapshotType)) {
      throw new Error('Invalid snapshot type');
    }
  }
}

/**
 * Singleton instance
 */
let serviceInstance: FxSnapshotService | null = null;

/**
 * Get FX snapshot service singleton
 */
export const getFxSnapshotService = (): FxSnapshotService => {
  if (!serviceInstance) {
    serviceInstance = new FxSnapshotService();
  }
  return serviceInstance;
};


