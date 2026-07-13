import type { Prisma } from '@prisma/client';
import {
  parseDocumentCommercialTiming,
  serializeDocumentCommercialTiming,
} from '@/lib/commercial-timing/serialization';
import type { DocumentCommercialTiming } from '@/lib/commercial-timing/types';

/** Parse commercial_timing JSON from a payment_links row. */
export function commercialTimingFromPaymentLink(
  row: { commercial_timing?: Prisma.JsonValue | null }
): DocumentCommercialTiming | null {
  return parseDocumentCommercialTiming(row.commercial_timing);
}

/** Serialize for payment_links.commercial_timing column. */
export function commercialTimingToPaymentLinkJson(
  timing: DocumentCommercialTiming | null
): Prisma.InputJsonValue | undefined {
  if (!timing) return undefined;
  return serializeDocumentCommercialTiming(timing) as Prisma.InputJsonValue;
}
