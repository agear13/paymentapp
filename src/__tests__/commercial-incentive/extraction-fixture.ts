import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { field, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';

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

/** Runtime shape shown in Agreement Intelligence for the ABC Retail / Acme Supply demo. */
export function abcRetailAcmeSupplyProductionExtraction(): ExtractionResult {
  return incentiveExtraction({
    projectName: field('Commercial Supply Agreement'),
    paymentTerms: [],
    settlementRules: [
      {
        trigger: field('Each milestone invoice payable within 30 days of invoice date'),
        basis: field(null, 'absent'),
      },
    ],
    parties: [
      testParty({
        id: 'acme-supply',
        name: field('Acme Supply Indonesia'),
        role: field('Supplier'),
        notes: field(
          "Payment by bank transfer to supplier's Indonesian bank account. No early-payment discount included."
        ),
        compensationTerms: [1, 2, 3, 4].map((index) => ({
          id: `ms-${index}`,
          type: 'milestone' as const,
          label: field(`Milestone ${index}`),
          amount: field(25_000),
          percentage: field(null, 'absent'),
          trigger: field('Within 30 days of invoice date'),
          deadline: field(null, 'absent'),
          revenueBasis: field(null, 'absent'),
          sequenceIndex: index,
          confidence: 'high' as const,
        })),
      }),
    ],
  });
}
