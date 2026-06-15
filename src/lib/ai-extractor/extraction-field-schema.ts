import { z } from 'zod';

const CONFIDENCE_VALUES = ['high', 'medium', 'low', 'absent'] as const;
export type ExtractionConfidenceValue = (typeof CONFIDENCE_VALUES)[number];

function coerceConfidence(raw: unknown, fallback: ExtractionConfidenceValue = 'medium'): ExtractionConfidenceValue {
  if (typeof raw === 'string' && CONFIDENCE_VALUES.includes(raw as ExtractionConfidenceValue)) {
    return raw as ExtractionConfidenceValue;
  }
  return fallback;
}

/**
 * Accepts legacy flat scalars (e.g. partyId: "ep-1") and partial field objects
 * missing confidence (e.g. amount: { value: 1000 }).
 */
export function coerceExtractionField<T>(
  raw: unknown,
  defaultConfidence: ExtractionConfidenceValue = 'medium'
): unknown {
  if (raw === null || raw === undefined) {
    return raw;
  }
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return { value: raw, confidence: defaultConfidence };
  }
  if (Array.isArray(raw)) {
    return { value: raw, confidence: defaultConfidence };
  }
  if (typeof raw === 'object' && 'value' in raw) {
    const obj = raw as { value: unknown; confidence?: unknown; rawSnippet?: unknown };
    return {
      value: obj.value,
      confidence: coerceConfidence(obj.confidence, defaultConfidence),
      ...(obj.rawSnippet !== undefined ? { rawSnippet: obj.rawSnippet } : {}),
    };
  }
  return raw;
}

export const ExtractionFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.enum(CONFIDENCE_VALUES),
    rawSnippet: z.string().nullable().optional(),
  });

export const FlexibleExtractionFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.preprocess(
    (val) => coerceExtractionField(val),
    ExtractionFieldSchema(valueSchema)
  );

export function logExtractorParticipantCount(stage: string, count: number): void {
  logExtractorDebugSnapshot({ [stage]: count });
}

export function logExtractorDebugSnapshot(metrics: Record<string, number>): void {
  const body = Object.entries(metrics)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  console.error(`[extractor-debug]\n${body}`);
}
