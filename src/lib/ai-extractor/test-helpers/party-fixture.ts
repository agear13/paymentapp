import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';

export function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

export function testParty(overrides: Partial<ExtractedParty> = {}): ExtractedParty {
  return {
    id: 'ep-1',
    name: field('Alex'),
    email: field(null, 'absent'),
    role: field('Contractor'),
    participationModel: field('fixed_payout'),
    fixedAmount: field(null, 'absent'),
    revenueSharePct: field(null, 'absent'),
    deliverables: [],
    deliverablesLegacy: field([]),
    conditionalPayments: [],
    milestones: [],
    serviceCategories: field([]),
    conditions: [],
    dependencies: [],
    notes: field(null, 'absent'),
    ...overrides,
  };
}

export function legacyDeliverables(items: string[]) {
  return { deliverablesLegacy: field(items) };
}
