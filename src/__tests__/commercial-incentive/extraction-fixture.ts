import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { field } from '@/lib/ai-extractor/test-helpers/party-fixture';

export function incentiveExtraction(
  overrides: Partial<ExtractionResult> = {}
): ExtractionResult {
  return {
    projectName: field('Inventory purchase'),
    projectDescription: field('Four-batch inventory supply'),
    projectValue: field(100_000),
    currency: field('AUD'),
    counterparty: field('ABC Retail Pty Ltd'),
    parties: [],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: 'fixture',
    extractedAt: '2026-09-17T00:00:00.000Z',
    schemaVersion: 'v5',
    ...overrides,
  };
}

export function net30FourMilestones(): ExtractionResult {
  return incentiveExtraction({
    paymentTerms: [1, 2, 3, 4].map((batch) => ({
      description: field(`Batch ${batch} delivery`),
      amount: field(25_000),
      currency: field('AUD'),
      dueCondition: field('Net 30'),
    })),
  });
}
