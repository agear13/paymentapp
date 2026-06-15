import { z } from 'zod';
import type { ExtractedSettlementEvent } from './extraction-types';
import { FlexibleExtractionFieldSchema } from './extraction-field-schema';

const ObligationStatusSchema = z.enum([
  'draft',
  'confirmed',
  'pending',
  'conditional',
  'fulfilled',
  'disputed',
]);

const ExtractedSettlementEventSchema = z.object({
  partyId: FlexibleExtractionFieldSchema(z.string()),
  partyName: FlexibleExtractionFieldSchema(z.string()),
  type: FlexibleExtractionFieldSchema(
    z.enum(['fixed_fee', 'revenue_share', 'bonus', 'milestone', 'attribution'])
  ),
  amount: FlexibleExtractionFieldSchema(z.number().nullable()),
  percentage: FlexibleExtractionFieldSchema(z.number().nullable()),
  trigger: FlexibleExtractionFieldSchema(z.string().nullable()),
  condition: FlexibleExtractionFieldSchema(z.string().nullable()),
  status: ObligationStatusSchema,
});

export function parseSettlementEventsNonBlocking(raw: unknown): {
  events: ExtractedSettlementEvent[];
  droppedCount: number;
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { events: [], droppedCount: 0 };
  }

  const events: ExtractedSettlementEvent[] = [];
  let droppedCount = 0;

  for (const item of raw) {
    const result = ExtractedSettlementEventSchema.safeParse(item);
    if (result.success) {
      events.push(result.data);
    } else {
      droppedCount += 1;
      console.error(
        '[ai-extractor] Dropped invalid settlementEvent:',
        JSON.stringify(result.error.issues)
      );
    }
  }

  return { events, droppedCount };
}
