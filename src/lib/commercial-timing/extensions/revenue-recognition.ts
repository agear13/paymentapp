/**
 * Revenue recognition extension points.
 *
 * Do not implement revenue recognition logic yet — these functions define
 * the architecture for future deferred revenue, accrual, and recognition engines.
 */

import type { ResolvedCommercialTiming } from '@/lib/commercial-timing/types';

export type RevenueRecognitionPlaceholder = {
  /** Extension point — not yet implemented. */
  status: 'not_implemented';
  recognitionPeriod: ResolvedCommercialTiming['recognitionPeriod'];
  servicePeriodStart: ResolvedCommercialTiming['servicePeriodStart'];
  servicePeriodEnd: ResolvedCommercialTiming['servicePeriodEnd'];
  message: string;
};

export type DeferredRevenuePlaceholder = {
  status: 'not_implemented';
  amount: number | null;
  currency: string | null;
  message: string;
};

export type AccrualEntryPlaceholder = {
  status: 'not_implemented';
  entries: [];
  message: string;
};

/** Derive revenue recognition schedule from commercial timing. Placeholder. */
export function deriveRevenueRecognition(
  timing: ResolvedCommercialTiming,
  amount: number,
  currency: string
): RevenueRecognitionPlaceholder {
  return {
    status: 'not_implemented',
    recognitionPeriod: timing.recognitionPeriod ?? null,
    servicePeriodStart: timing.servicePeriodStart ?? null,
    servicePeriodEnd: timing.servicePeriodEnd ?? null,
    message: `Revenue recognition for ${amount} ${currency} will derive from commercial timing when implemented.`,
  };
}

/** Derive deferred revenue balance from commercial timing. Placeholder. */
export function deriveDeferredRevenue(
  timing: ResolvedCommercialTiming,
  amount: number,
  currency: string
): DeferredRevenuePlaceholder {
  return {
    status: 'not_implemented',
    amount,
    currency,
    message: `Deferred revenue will use service period ${timing.servicePeriodStart ?? '?'} – ${timing.servicePeriodEnd ?? '?'} when implemented.`,
  };
}

/** Derive accrual journal entries from commercial timing. Placeholder. */
export function deriveAccrualEntries(
  timing: ResolvedCommercialTiming
): AccrualEntryPlaceholder {
  return {
    status: 'not_implemented',
    entries: [],
    message: `Accrual entries will derive from recognition period ${timing.recognitionPeriod ? `${timing.recognitionPeriod.year}-${timing.recognitionPeriod.month}` : 'unset'} when implemented.`,
  };
}
