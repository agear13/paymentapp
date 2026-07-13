/**
 * Agreement Intelligence — commercial timing extraction extension points.
 *
 * AI should populate commercial timing where possible; never fabricate values.
 * Avoid duplicate extraction logic — this module is the single extension surface.
 */

import { assignCommercialTimingField } from '@/lib/commercial-timing/assign-timing-field';
import type { AgreementCommercialTiming, CommercialTimingFields } from '@/lib/commercial-timing/types';
import { parseAgreementCommercialTiming } from '@/lib/commercial-timing/serialization';

/** Raw hints from agreement intelligence or AI extraction — all optional. */
export type CommercialTimingExtractionHints = Partial<CommercialTimingFields> & {
  /** Source label for audit (e.g. 'event_date', 'service_month', 'payment_due'). */
  extractionSources?: Partial<Record<keyof CommercialTimingFields, string>>;
  /** Confidence 0–1 per field when available. */
  confidence?: Partial<Record<keyof CommercialTimingFields, number>>;
};

export type CommercialTimingExtractionResult = {
  /** Parsed timing — only fields with valid extracted values. */
  timing: AgreementCommercialTiming;
  /** Fields that were successfully extracted. */
  extractedFields: (keyof CommercialTimingFields)[];
  /** Fields explicitly not found (never fabricated). */
  missingFields: (keyof CommercialTimingFields)[];
};

const ALL_FIELDS: (keyof CommercialTimingFields)[] = [
  'servicePeriodStart',
  'servicePeriodEnd',
  'recognitionPeriod',
  'expectedPaymentDate',
  'expectedSettlementDate',
];

/**
 * Apply extraction hints to agreement timing.
 * Only includes fields present in hints — never fabricates.
 */
export function applyCommercialTimingExtraction(
  hints: CommercialTimingExtractionHints | null | undefined
): CommercialTimingExtractionResult {
  if (!hints) {
    return {
      timing: {},
      extractedFields: [],
      missingFields: ALL_FIELDS,
    };
  }

  const { extractionSources: _sources, confidence: _confidence, ...raw } = hints;
  const timing = parseAgreementCommercialTiming(raw);

  const extractedFields = ALL_FIELDS.filter((f) => timing[f] != null);
  const missingFields = ALL_FIELDS.filter((f) => timing[f] == null);

  return { timing, extractedFields, missingFields };
}

/** Merge extracted timing into existing agreement timing without overwriting set values. */
export function mergeExtractedCommercialTiming(
  existing: AgreementCommercialTiming,
  extracted: AgreementCommercialTiming
): AgreementCommercialTiming {
  const merged = { ...existing };
  for (const field of ALL_FIELDS) {
    if (merged[field] == null && extracted[field] != null) {
      assignCommercialTimingField(merged, field, extracted[field]!);
    }
  }
  return merged;
}

/** Extension point for Agreement Intelligence engine — extract timing from agreement context. */
export function extractCommercialTimingFromAgreementIntelligence(input: {
  /** Free-text agreement notes, extracted conversation, or contract snippets. */
  agreementText?: string | null;
  /** Structured hints from AI extractor or analyzer report. */
  extractionHints?: CommercialTimingExtractionHints | null;
  /** Existing agreement timing — preserved when extraction finds nothing. */
  existingTiming?: AgreementCommercialTiming | null;
}): CommercialTimingExtractionResult {
  const fromHints = applyCommercialTimingExtraction(input.extractionHints);
  const merged = mergeExtractedCommercialTiming(
    input.existingTiming ?? {},
    fromHints.timing
  );

  const extractedFields = ALL_FIELDS.filter(
    (f) => fromHints.timing[f] != null
  );
  const missingFields = ALL_FIELDS.filter((f) => merged[f] == null);

  return {
    timing: merged,
    extractedFields,
    missingFields,
  };
}
