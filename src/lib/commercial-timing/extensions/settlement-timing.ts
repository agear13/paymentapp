/**
 * Settlement timing — expected vs actual settlement dates.
 *
 * Reuses existing settlement workflow; does not duplicate settlement logic.
 */

import type { SettlementTimingView } from '@/lib/commercial-timing/types';
import type { ResolvedCommercialTiming } from '@/lib/commercial-timing/types';

export type SettlementTimingInput = {
  /** From commercial timing (agreement or document). */
  resolvedTiming: ResolvedCommercialTiming;
  /** Actual settlement from payment_settlements.settled_at or funding actual_settlement_date. */
  actualSettlementDate?: string | Date | null;
};

/** Derive settlement timing view from commercial timing and actual settlement. */
export function deriveSettlementTiming(input: SettlementTimingInput): SettlementTimingView {
  const expected =
    input.resolvedTiming.expectedSettlementDate ??
    null;

  let actual: string | null = null;
  if (input.actualSettlementDate) {
    const d =
      input.actualSettlementDate instanceof Date
        ? input.actualSettlementDate
        : new Date(input.actualSettlementDate);
    if (!Number.isNaN(d.getTime())) {
      actual = d.toISOString();
    }
  }

  let onSchedule: boolean | null = null;
  if (actual && expected) {
    onSchedule = new Date(actual).getTime() <= new Date(expected).getTime();
  } else if (actual && !expected) {
    onSchedule = true;
  }

  return {
    expectedSettlementDate: expected,
    actualSettlementDate: actual,
    onSchedule,
  };
}

/** Attach expected settlement from funding source when commercial timing is unset. */
export function mergeFundingSettlementExpectation(
  timing: ResolvedCommercialTiming,
  fundingExpectedSettlementDate?: string | null
): ResolvedCommercialTiming {
  if (timing.expectedSettlementDate || !fundingExpectedSettlementDate) {
    return timing;
  }
  return {
    ...timing,
    expectedSettlementDate: fundingExpectedSettlementDate,
    inheritedFields: [...timing.inheritedFields],
    overriddenFields: timing.overriddenFields,
    hasTiming: true,
  };
}
