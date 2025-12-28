/**
 * FX Rate Management System
 * 
 * Comprehensive rate management including:
 * - Rate scheduling and refresh
 * - Custom rate overrides
 * - Rate comparison and analysis
 * - Alert thresholds
 * - Historical tracking
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { convertCurrency, clearExchangeRateCache } from './currency-converter';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface RateOverride {
  id: string;
  organizationId: string;
  baseCurrency: string;
  quoteCurrency: string;
  overrideRate: number;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  reason?: string;
  createdBy?: string;
}

export interface RateComparison {
  baseCurrency: string;
  quoteCurrency: string;
  currentRate: number;
  previousRate?: number;
  changePercent?: number;
  changeDirection: 'up' | 'down' | 'stable';
  timestamp: Date;
}

export interface RateAlert {
  id: string;
  organizationId: string;
  baseCurrency: string;
  quoteCurrency: string;
  thresholdType: 'above' | 'below' | 'change_percent';
  thresholdValue: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
}

export interface RateScheduleConfig {
  organizationId: string;
  refreshIntervalMinutes: number;
  enabledCurrencyPairs: string[]; // e.g., ['USD/EUR', 'USD/GBP']
  autoRefresh: boolean;
}

// ============================================================================
// Rate Override Management
// ============================================================================

/**
 * Creates a custom rate override for an organization
 */
export async function createRateOverride(
  organizationId: string,
  baseCurrency: string,
  quoteCurrency: string,
  overrideRate: number,
  effectiveFrom: Date,
  effectiveUntil?: Date,
  reason?: string,
  createdBy?: string
): Promise<RateOverride> {
  log.info(
    { organizationId, baseCurrency, quoteCurrency, overrideRate },
    'Creating rate override'
  );

  const override = await prisma.fx_rate_overrides.create({
    data: {
      id: uuidv4(),
      organization_id: organizationId,
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      override_rate: overrideRate,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
      reason,
      created_by: createdBy,
    },
  });

  // Clear cache to ensure override is used
  clearExchangeRateCache();

  return {
    id: override.id,
    organizationId: override.organization_id,
    baseCurrency: override.base_currency,
    quoteCurrency: override.quote_currency,
    overrideRate: Number(override.override_rate),
    effectiveFrom: override.effective_from,
    effectiveUntil: override.effective_until ?? undefined,
    reason: override.reason ?? undefined,
    createdBy: override.created_by ?? undefined,
  };
}

/**
 * Gets active rate override for a currency pair
 */
export async function getActiveRateOverride(
  organizationId: string,
  baseCurrency: string,
  quoteCurrency: string
): Promise<RateOverride | null> {
  const now = new Date();

  const override = await prisma.fx_rate_overrides.findFirst({
    where: {
      organization_id: organizationId,
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      effective_from: { lte: now },
      OR: [
        { effective_until: null },
        { effective_until: { gte: now } },
      ],
    },
    orderBy: {
      effective_from: 'desc',
    },
  });

  if (!override) return null;

  return {
    id: override.id,
    organizationId: override.organization_id,
    baseCurrency: override.base_currency,
    quoteCurrency: override.quote_currency,
    overrideRate: Number(override.override_rate),
    effectiveFrom: override.effective_from,
    effectiveUntil: override.effective_until ?? undefined,
    reason: override.reason ?? undefined,
    createdBy: override.created_by ?? undefined,
  };
}

/**
 * Expires a rate override
 */
export async function expireRateOverride(
  overrideId: string,
  effectiveUntil?: Date
): Promise<void> {
  log.info({ overrideId }, 'Expiring rate override');

  await prisma.fx_rate_overrides.update({
    where: { id: overrideId },
    data: {
      effective_until: effectiveUntil ?? new Date(),
    },
  });

  clearExchangeRateCache();
}

// ============================================================================
// Rate History Tracking
// ============================================================================

/**
 * Records a rate to history
 */
export async function recordRateToHistory(
  baseCurrency: string,
  quoteCurrency: string,
  rate: number,
  provider: string,
  metadata?: Record<string, any>
): Promise<void> {
  await prisma.fx_rate_history.create({
    data: {
      id: uuidv4(),
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      rate,
      provider,
      metadata: metadata ?? null,
    },
  });
}

/**
 * Gets rate history for a currency pair
 */
export async function getRateHistory(
  baseCurrency: string,
  quoteCurrency: string,
  fromDate: Date,
  toDate: Date = new Date()
): Promise<Array<{ rate: number; recordedAt: Date; provider: string }>> {
  const history = await prisma.fx_rate_history.findMany({
    where: {
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      recorded_at: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: {
      recorded_at: 'asc',
    },
    select: {
      rate: true,
      recorded_at: true,
      provider: true,
    },
  });

  return history.map((h) => ({
    rate: Number(h.rate),
    recordedAt: h.recorded_at,
    provider: h.provider,
  }));
}

// ============================================================================
// Rate Comparison
// ============================================================================

/**
 * Compares current rate with historical rate
 */
export async function compareRates(
  baseCurrency: string,
  quoteCurrency: string,
  compareWithDate?: Date
): Promise<RateComparison> {
  // Get current rate
  const currentRate = await convertCurrency(1, baseCurrency, quoteCurrency);

  let previousRate: number | undefined;
  let changePercent: number | undefined;
  let changeDirection: 'up' | 'down' | 'stable' = 'stable';

  if (compareWithDate) {
    // Get historical rate closest to the comparison date
    const historicalRate = await prisma.fx_rate_history.findFirst({
      where: {
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        recorded_at: {
          lte: compareWithDate,
        },
      },
      orderBy: {
        recorded_at: 'desc',
      },
    });

    if (historicalRate) {
      previousRate = Number(historicalRate.rate);
      changePercent = ((currentRate - previousRate) / previousRate) * 100;

      if (changePercent > 0.1) {
        changeDirection = 'up';
      } else if (changePercent < -0.1) {
        changeDirection = 'down';
      }
    }
  }

  return {
    baseCurrency,
    quoteCurrency,
    currentRate,
    previousRate,
    changePercent,
    changeDirection,
    timestamp: new Date(),
  };
}

/**
 * Gets rate comparison for multiple currency pairs
 */
export async function compareMultipleRates(
  currencyPairs: Array<{ base: string; quote: string }>,
  compareWithDate?: Date
): Promise<RateComparison[]> {
  const comparisons: RateComparison[] = [];

  for (const pair of currencyPairs) {
    const comparison = await compareRates(
      pair.base,
      pair.quote,
      compareWithDate
    );
    comparisons.push(comparison);
  }

  return comparisons;
}

// ============================================================================
// Rate Scheduling
// ============================================================================

/**
 * Refreshes rates for enabled currency pairs
 */
export async function refreshRatesForOrganization(
  organizationId: string
): Promise<{ refreshed: number; failed: number }> {
  log.info({ organizationId }, 'Refreshing rates for organization');

  // Get organization's enabled currencies
  const merchantSettings = await prisma.merchant_settings.findUnique({
    where: { organization_id: organizationId },
    select: {
      enabled_currencies: true,
      default_currency: true,
    },
  });

  if (!merchantSettings) {
    log.warn({ organizationId }, 'No merchant settings found');
    return { refreshed: 0, failed: 0 };
  }

  const enabledCurrencies = merchantSettings.enabled_currencies || ['USD'];
  const baseCurrency = merchantSettings.default_currency || 'USD';

  let refreshed = 0;
  let failed = 0;

  // Refresh rates for all enabled currencies against base currency
  for (const quoteCurrency of enabledCurrencies) {
    if (quoteCurrency === baseCurrency) continue;

    try {
      const rate = await convertCurrency(1, baseCurrency, quoteCurrency);
      
      await recordRateToHistory(
        baseCurrency,
        quoteCurrency,
        rate,
        'scheduled_refresh',
        { organizationId }
      );

      refreshed++;
    } catch (error: any) {
      log.error(
        { organizationId, baseCurrency, quoteCurrency, error: error.message },
        'Failed to refresh rate'
      );
      failed++;
    }
  }

  log.info(
    { organizationId, refreshed, failed },
    'Rate refresh complete'
  );

  return { refreshed, failed };
}

/**
 * Schedules automatic rate refresh for an organization
 * This would typically be called by a cron job or background worker
 */
export async function scheduleRateRefresh(
  organizationId: string,
  intervalMinutes: number = 5
): Promise<void> {
  log.info(
    { organizationId, intervalMinutes },
    'Scheduling rate refresh'
  );

  // In a production system, this would:
  // 1. Register a job in a queue (e.g., Bull, Agenda)
  // 2. Set up a cron schedule
  // 3. Use a distributed scheduler (e.g., AWS EventBridge)

  // For now, we'll just log the intent
  log.info(
    { organizationId, intervalMinutes },
    'Rate refresh schedule created (implementation pending)'
  );
}

// ============================================================================
// Rate Alerts
// ============================================================================

/**
 * Checks if a rate alert threshold has been triggered
 */
export async function checkRateAlert(
  organizationId: string,
  baseCurrency: string,
  quoteCurrency: string,
  thresholdType: 'above' | 'below' | 'change_percent',
  thresholdValue: number
): Promise<RateAlert> {
  const currentRate = await convertCurrency(1, baseCurrency, quoteCurrency);
  let triggered = false;

  if (thresholdType === 'above') {
    triggered = currentRate > thresholdValue;
  } else if (thresholdType === 'below') {
    triggered = currentRate < thresholdValue;
  } else if (thresholdType === 'change_percent') {
    // Compare with rate from 24 hours ago
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const comparison = await compareRates(baseCurrency, quoteCurrency, yesterday);
    
    if (comparison.changePercent !== undefined) {
      triggered = Math.abs(comparison.changePercent) > thresholdValue;
    }
  }

  return {
    id: uuidv4(),
    organizationId,
    baseCurrency,
    quoteCurrency,
    thresholdType,
    thresholdValue,
    currentValue: currentRate,
    triggered,
    triggeredAt: triggered ? new Date() : undefined,
  };
}

/**
 * Checks multiple rate alerts
 */
export async function checkMultipleRateAlerts(
  alerts: Array<{
    organizationId: string;
    baseCurrency: string;
    quoteCurrency: string;
    thresholdType: 'above' | 'below' | 'change_percent';
    thresholdValue: number;
  }>
): Promise<RateAlert[]> {
  const results: RateAlert[] = [];

  for (const alert of alerts) {
    const result = await checkRateAlert(
      alert.organizationId,
      alert.baseCurrency,
      alert.quoteCurrency,
      alert.thresholdType,
      alert.thresholdValue
    );
    results.push(result);
  }

  return results;
}

// ============================================================================
// Rate Analysis
// ============================================================================

/**
 * Gets rate statistics for a currency pair
 */
export async function getRateStatistics(
  baseCurrency: string,
  quoteCurrency: string,
  days: number = 30
): Promise<{
  average: number;
  min: number;
  max: number;
  volatility: number;
  trend: 'upward' | 'downward' | 'stable';
}> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const history = await getRateHistory(baseCurrency, quoteCurrency, fromDate);

  if (history.length === 0) {
    throw new Error('No historical data available for rate statistics');
  }

  const rates = history.map((h) => h.rate);
  const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const min = Math.min(...rates);
  const max = Math.max(...rates);

  // Calculate volatility (standard deviation)
  const squaredDiffs = rates.map((rate) => Math.pow(rate - average, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / rates.length;
  const volatility = Math.sqrt(variance);

  // Determine trend (simple linear regression)
  const firstRate = rates[0];
  const lastRate = rates[rates.length - 1];
  const changePercent = ((lastRate - firstRate) / firstRate) * 100;

  let trend: 'upward' | 'downward' | 'stable' = 'stable';
  if (changePercent > 1) {
    trend = 'upward';
  } else if (changePercent < -1) {
    trend = 'downward';
  }

  return {
    average,
    min,
    max,
    volatility,
    trend,
  };
}

/**
 * Exports rate history to CSV format
 */
export function exportRateHistoryToCSV(
  history: Array<{ rate: number; recordedAt: Date; provider: string }>,
  baseCurrency: string,
  quoteCurrency: string
): string {
  let csv = `Date,Time,${baseCurrency}/${quoteCurrency},Provider\n`;

  history.forEach((record) => {
    const date = record.recordedAt.toISOString().split('T')[0];
    const time = record.recordedAt.toISOString().split('T')[1].split('.')[0];
    csv += `${date},${time},${record.rate},${record.provider}\n`;
  });

  return csv;
}







