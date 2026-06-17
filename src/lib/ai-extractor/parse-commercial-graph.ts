/**
 * Non-blocking parsers for v5 commercial graph fields.
 */

import { z } from 'zod';
import type {
  ExtractedAgreementOwner,
  ExtractedCommercialDependency,
  ExtractedCompensationTerm,
  ExtractedOperationalObligation,
  ExtractionConfidence,
} from './extraction-types';
import { FlexibleExtractionFieldSchema } from './extraction-field-schema';
import { parseArrayItemsNonBlocking } from './parse-array-non-blocking';

const F = FlexibleExtractionFieldSchema;

const CompensationTermSchema = z.object({
  id: z.string(),
  type: z.enum([
    'fixed_fee',
    'revenue_share',
    'instalment',
    'milestone',
    'conditional_bonus',
    'attribution',
  ]),
  label: F(z.string()),
  amount: F(z.number().nullable()),
  percentage: F(z.number().nullable()),
  trigger: F(z.string().nullable()),
  deadline: F(z.string().nullable()),
  revenueBasis: F(z.string().nullable()),
  sequenceIndex: z.number().nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low', 'absent']).optional(),
  rawSnippet: z.string().optional(),
});

const OperationalObligationSchema = z.object({
  id: z.string(),
  description: F(z.string()),
  category: F(z.string().nullable()),
});

const CommercialDependencySchema = z.object({
  id: z.string(),
  description: F(z.string()),
  type: F(
    z.enum([
      'attendance_threshold',
      'delivery_completion',
      'funds_cleared',
      'event_timing',
      'other',
    ])
  ),
  blocksSettlement: F(z.boolean()),
  relatedCompensationId: F(z.string().nullable()),
  relatedDeliverableId: F(z.string().nullable()),
});

const AgreementOwnerSchema = z.object({
  name: F(z.string()),
  responsibilities: z.array(F(z.string())).optional(),
});

export function parseCompensationTermsNonBlocking(raw: unknown): {
  items: ExtractedCompensationTerm[];
  droppedCount: number;
} {
  const parsed = parseArrayItemsNonBlocking(CompensationTermSchema, raw, 'compensationTerm');
  return {
    items: parsed.items.map((item) => ({
      ...item,
      confidence: (item.confidence ?? 'medium') as ExtractionConfidence,
      sequenceIndex: item.sequenceIndex ?? null,
    })),
    droppedCount: parsed.droppedCount,
  };
}

export function parseOperationalObligationsNonBlocking(raw: unknown): {
  items: ExtractedOperationalObligation[];
  droppedCount: number;
} {
  const parsed = parseArrayItemsNonBlocking(OperationalObligationSchema, raw, 'operationalObligation');
  return {
    items: parsed.items.map((item) => ({
      id: item.id,
      description: item.description,
      category: {
        value: item.category.value as ExtractedOperationalObligation['category']['value'],
        confidence: item.category.confidence,
      },
    })),
    droppedCount: parsed.droppedCount,
  };
}

export function parseCommercialDependenciesNonBlocking(raw: unknown): {
  items: ExtractedCommercialDependency[];
  droppedCount: number;
} {
  const parsed = parseArrayItemsNonBlocking(CommercialDependencySchema, raw, 'commercialDependency');
  return { items: parsed.items, droppedCount: parsed.droppedCount };
}

export function parseAgreementOwnerNonBlocking(raw: unknown): ExtractedAgreementOwner | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const result = AgreementOwnerSchema.safeParse(raw);
  if (!result.success) return undefined;
  return {
    name: result.data.name,
    responsibilities: result.data.responsibilities ?? [],
  };
}
