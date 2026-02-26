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

/** DB column limits: base/quote are VarChar(10), provider is VarChar(100) */
const CURRENCY_MIN_LEN = 3;
const CURRENCY_MAX_LEN = 10;
const PROVIDER_MAX_LEN = 100;
const CURRENCY_PATTERN = /^[A-Z0-9]{3,10}$/;

/** Valid token_type values for CREATION snapshots */
export const CREATION_TOKEN_TYPES = ['HBAR', 'USDC', 'USDT', 'AUDD'] as const;
export type CreationTokenType = (typeof CREATION_TOKEN_TYPES)[number];

/** Canonical short provider IDs to stay within VarChar(100) */
const PROVIDER_CANONICAL: Record<string, string> = {
  coingecko: 'coingecko',
  'hedera-mirror': 'hedera-mirror',
  'hedera_mirror': 'hedera-mirror',
  stripe: 'stripe',
  wise: 'wise',
  hedera: 'hedera',
};

export class FxSnapshotValidationError extends Error {
  constructor(
    message: string,
    public readonly paymentLinkId: string,
    public readonly fieldName: string,
    public readonly valueLength: number
  ) {
    super(message);
    this.name = 'FxSnapshotValidationError';
  }
}

/**
 * Normalize base/quote currency codes for VarChar(10) columns.
 * Trim + uppercase, allow 3–10 chars, pattern ^[A-Z0-9]{3,10}$.
 * Stores real codes (e.g. 'HBAR', 'USD') without mapping.
 */
function normalizeCurrencyCode(
  value: string,
  fieldName: string,
  paymentLinkId: string
): string {
  const out = (value ?? '').trim().toUpperCase();
  if (out.length < CURRENCY_MIN_LEN || out.length > CURRENCY_MAX_LEN || !CURRENCY_PATTERN.test(out)) {
    throw new FxSnapshotValidationError(
      `FX snapshot ${fieldName} must be 3–10 uppercase letters/digits [A-Z0-9], got length ${out.length}`,
      paymentLinkId,
      fieldName,
      out.length
    );
  }
  return out;
}

/**
 * Ensure provider fits VarChar(100): use canonical short ID or truncate.
 */
function normalizeProvider(provider: string): string {
  const key = (provider ?? '').trim().toLowerCase();
  const canonical = PROVIDER_CANONICAL[key];
  if (canonical) return canonical;
  const raw = (provider ?? '').trim();
  if (raw.length <= PROVIDER_MAX_LEN) return raw;
  return raw.slice(0, PROVIDER_MAX_LEN);
}

type CreationSnapshotRow = {
  id: string;
  payment_link_id: string;
  snapshot_type: 'CREATION' | 'SETTLEMENT';
  token_type: string | null;
  base_currency: string;
  quote_currency: string;
  rate: number;
  provider: string;
  captured_at: Date;
};

/**
 * Validate and normalize every row for createMany so we never violate column constraints.
 * - base_currency / quote_currency: trim + uppercase, 3–10 chars, ^[A-Z0-9]{3,10}$ (real codes e.g. HBAR, USD).
 * - provider: <= 100 chars (canonicalize or truncate).
 * - snapshot_type: CREATION or SETTLEMENT only.
 * - token_type: for CREATION must be HBAR/USDC/USDT/AUDD; can be null for SETTLEMENT.
 * Exported for unit tests.
 */
export function validateAndNormalizeCreationRows(
  rows: CreationSnapshotRow[],
  paymentLinkId: string
): CreationSnapshotRow[] {
  const out: CreationSnapshotRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.snapshot_type !== 'CREATION' && r.snapshot_type !== 'SETTLEMENT') {
      logger.error(
        { paymentLinkId, constraint: 'snapshot_type', value: r.snapshot_type },
        'FX_DB_WRITE_FAIL'
      );
      throw new FxSnapshotValidationError(
        `snapshot_type must be CREATION or SETTLEMENT, got ${r.snapshot_type}`,
        paymentLinkId,
        'snapshot_type',
        (r.snapshot_type ?? '').length
      );
    }
    if (r.snapshot_type === 'CREATION') {
      const validTokens = new Set<string>(CREATION_TOKEN_TYPES);
      if (r.token_type == null || !validTokens.has(r.token_type)) {
        logger.error(
          { paymentLinkId, constraint: 'token_type', tokenType: r.token_type },
          'FX_DB_WRITE_FAIL'
        );
        throw new FxSnapshotValidationError(
          `CREATION token_type must be one of HBAR/USDC/USDT/AUDD, got ${r.token_type ?? 'null'}`,
          paymentLinkId,
          'token_type',
          (r.token_type ?? '').length
        );
      }
    }
    const base = normalizeCurrencyCode(r.base_currency ?? '', 'base_currency', paymentLinkId);
    const quote = normalizeCurrencyCode(r.quote_currency ?? '', 'quote_currency', paymentLinkId);
    const provider = normalizeProvider(r.provider ?? '');
    out.push({
      ...r,
      base_currency: base,
      quote_currency: quote,
      provider,
    });
  }
  return out;
}

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
      this.validateSnapshotData(data);

      const capturedAt = data.capturedAt || new Date();
      const base = normalizeCurrencyCode(data.baseCurrency, 'base_currency', data.paymentLinkId);
      const quote = normalizeCurrencyCode(data.quoteCurrency, 'quote_currency', data.paymentLinkId);
      const provider = normalizeProvider(data.provider);
      const snapshot = await prisma.fx_snapshots.create({
        data: {
          payment_link_id: data.paymentLinkId,
          snapshot_type: data.snapshotType,
          token_type: data.tokenType ?? null,
          base_currency: base,
          quote_currency: quote,
          rate: data.rate,
          provider,
          captured_at: capturedAt,
        },
      });

      logger.info(
        { snapshotId: snapshot.id, tokenType: data.tokenType, rate: snapshot.rate.toString() },
        'FX snapshot created'
      );

      return snapshot as FxSnapshot;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          paymentLinkId: data.paymentLinkId,
          error: err.message,
          stack: err.stack,
        },
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

    const capturedAt = new Date();
    const snapshotData = tokens
      .map((token, i) => {
        const rate = rates[i];
        if (!rate) return null;
        const ts = rate.timestamp || capturedAt;
        return {
          id: randomUUID(),
          payment_link_id: paymentLinkId,
          snapshot_type: 'CREATION' as const,
          token_type: token,
          base_currency: token,
          quote_currency: quoteCurrency,
          rate: rate.rate,
          provider: rate.provider,
          captured_at: ts,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (snapshotData.length > 0) {
      const rowCount = snapshotData.length;
      let rows: CreationSnapshotRow[];
      try {
        rows = validateAndNormalizeCreationRows(snapshotData as CreationSnapshotRow[], paymentLinkId);
      } catch (validationErr: unknown) {
        const e = validationErr instanceof Error ? validationErr : new Error(String(validationErr));
        logger.error(
          {
            paymentLinkId,
            rowCount,
            errName: e.name,
            errMessage: e.message,
            constraint: validationErr instanceof FxSnapshotValidationError ? validationErr.fieldName : undefined,
            stack: e.stack,
          },
          'FX_DB_WRITE_FAIL'
        );
        throw validationErr;
      }
      logger.info(
        {
          paymentLinkId,
          rowCount,
          providerLens: rows.map((r) => (r.provider ?? '').length),
          baseLens: rows.map((r) => (r.base_currency ?? '').trim().length),
          quoteLens: rows.map((r) => (r.quote_currency ?? '').trim().length),
        },
        'FX_DB_WRITE_PRECHECK'
      );
      try {
        const result = await prisma.fx_snapshots.createMany({
          data: rows,
          skipDuplicates: true,
        });
        const tokenList = rows.map((s) => s.token_type);
        logger.info(
          { paymentLinkId, insertedCount: result.count, rowCount, tokens: tokenList },
          'FX_DB_WRITE_SUCCESS'
        );
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        logger.error(
          {
            paymentLinkId,
            rowCount,
            errName: e.name,
            errMessage: e.message,
            stack: e.stack,
          },
          'FX_DB_WRITE_FAIL'
        );
        throw err;
      }
    } else {
      logger.warn(
        { paymentLinkId, quoteCurrency },
        'No FX creation snapshots inserted (all rate fetches failed or returned null)'
      );
    }

    const snapshots = await prisma.fx_snapshots.findMany({
      where: {
        payment_link_id: paymentLinkId,
        snapshot_type: 'CREATION',
        token_type: { in: tokens },
      },
      orderBy: { captured_at: 'desc' },
      take: tokens.length,
    });

    return snapshots as FxSnapshot[];
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
    return prisma.fx_snapshots.findMany({
      where: { payment_link_id: paymentLinkId },
      orderBy: { captured_at: 'asc' },
    }) as Promise<FxSnapshot[]>;
  }

  /**
   * Get specific snapshot by type
   */
  async getSnapshotByType(
    paymentLinkId: string,
    snapshotType: FxSnapshotType,
    tokenType?: Currency
  ): Promise<FxSnapshot | null> {
    const row = await prisma.fx_snapshots.findFirst({
      where: {
        payment_link_id: paymentLinkId,
        snapshot_type: snapshotType,
        ...(tokenType && { token_type: tokenType }),
      },
      orderBy: { captured_at: 'desc' },
    });
    return row as FxSnapshot | null;
  }

  /**
   * Get snapshots by token type
   */
  async getSnapshotsByToken(
    paymentLinkId: string,
    tokenType: Currency
  ): Promise<FxSnapshot[]> {
    return prisma.fx_snapshots.findMany({
      where: {
        payment_link_id: paymentLinkId,
        token_type: tokenType,
      },
      orderBy: { captured_at: 'asc' },
    }) as Promise<FxSnapshot[]>;
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
    const base = (snapshot as { base_currency?: string }).base_currency ?? (snapshot as { baseCurrency?: string }).baseCurrency;
    const quote = (snapshot as { quote_currency?: string }).quote_currency ?? (snapshot as { quoteCurrency?: string }).quoteCurrency;

    if (rate <= 0) {
      result.isValid = false;
      result.errors.push('Rate must be positive');
    }

    if (rate < 0.000001) {
      result.warnings.push('Rate is very low, please verify');
    }

    if (rate > 1000000) {
      result.warnings.push('Rate is very high, please verify');
    }

    if (
      base === 'USDC' &&
      quote === 'USD'
    ) {
      if (Math.abs(rate - 1.0) > 0.05) {
        result.warnings.push('USDC/USD rate deviates significantly from 1.0 peg');
      }
    }

    if (
      base === 'USDT' &&
      quote === 'USD'
    ) {
      if (Math.abs(rate - 1.0) > 0.05) {
        result.warnings.push('USDT/USD rate deviates significantly from 1.0 peg');
      }
    }

    if (
      base === 'AUDD' &&
      quote === 'AUD'
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

  /**
   * Create a SETTLEMENT snapshot inside a Prisma transaction (for payment confirmation).
   * Use this when confirming payment so the snapshot and event are in the same transaction.
   * Normalizes base/quote to 3–10 chars and provider to <=100 chars to satisfy DB constraints.
   */
  async createSettlementSnapshotInTx(
    tx: Pick<typeof prisma, 'fx_snapshots'>,
    data: {
      payment_link_id: string;
      snapshot_type: 'SETTLEMENT';
      token_type: Currency | null;
      base_currency: string;
      quote_currency: string;
      rate: number;
      provider: string;
      captured_at: Date;
    }
  ): Promise<FxSnapshot> {
    const paymentLinkId = data.payment_link_id;
    const base = normalizeCurrencyCode(data.base_currency, 'base_currency', paymentLinkId);
    const quote = normalizeCurrencyCode(data.quote_currency, 'quote_currency', paymentLinkId);
    const provider = normalizeProvider(data.provider);
    const snapshot = await tx.fx_snapshots.create({
      data: {
        payment_link_id: data.payment_link_id,
        snapshot_type: data.snapshot_type,
        token_type: data.token_type,
        base_currency: base,
        quote_currency: quote,
        rate: data.rate,
        provider,
        captured_at: data.captured_at,
      },
    });
    logger.info(
      { paymentLinkId: data.payment_link_id, tokenType: data.token_type, provider },
      'Settlement FX snapshot created in transaction'
    );
    return snapshot as FxSnapshot;
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


