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

function fourMilestones(amount: number, label: (index: number) => string) {
  return [1, 2, 3, 4].map((index) => ({
    id: `ms-${index}`,
    type: 'milestone' as const,
    label: field(label(index)),
    amount: field(amount === -1 ? index : amount),
    percentage: field(null, 'absent'),
    trigger: field('Within 30 days of invoice date'),
    deadline: field(null, 'absent'),
    revenueBasis: field(null, 'absent'),
    sequenceIndex: index,
    confidence: 'high' as const,
  }));
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
        compensationTerms: fourMilestones(25_000, (index) => `Milestone ${index}`),
      }),
    ],
  });
}

/**
 * Production dual-write: review modal shows four compensation milestones,
 * while paymentTerms is collapsed to a single A$25,000 row.
 */
export function abcRetailCollapsedPaymentTermExtraction(): ExtractionResult {
  return {
    ...abcRetailAcmeSupplyProductionExtraction(),
    paymentTerms: [
      {
        description: field('Milestone payment'),
        amount: field(25_000),
        currency: field('AUD'),
        dueCondition: field('Within 30 days of invoice date'),
      },
    ],
  };
}

/** Amount field holds sequence indexes; money lives on the label. */
export function abcRetailSequenceAmountExtraction(): ExtractionResult {
  const result = abcRetailAcmeSupplyProductionExtraction();
  return {
    ...result,
    paymentTerms: [
      {
        description: field('Milestone 1'),
        amount: field(1),
        currency: field('AUD'),
        dueCondition: field('Within 30 days of invoice date'),
      },
    ],
    parties: [
      {
        ...result.parties[0],
        compensationTerms: fourMilestones(-1, (index) => `A$25,000 milestone ${index}`),
      },
    ],
  };
}
