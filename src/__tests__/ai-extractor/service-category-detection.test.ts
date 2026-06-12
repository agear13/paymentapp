import { inferServiceCategoriesForParty } from '@/lib/ai-extractor/service-category-detection';
import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';

function field<T>(value: T, confidence: 'high' | 'medium' | 'low' | 'absent' = 'high') {
  return { value, confidence };
}

function party(overrides: Partial<ExtractedParty>): ExtractedParty {
  return {
    id: 'ep-1',
    name: field('Alex'),
    email: field(null, 'absent'),
    role: field('Contractor'),
    participationModel: field('fixed_payout'),
    fixedAmount: field(600),
    revenueSharePct: field(null, 'absent'),
    deliverables: field(['Event photography', '50 edited images']),
    milestones: [],
    serviceCategories: field([]),
    conditions: [],
    dependencies: [],
    notes: field(null, 'absent'),
    ...overrides,
  };
}

describe('inferServiceCategoriesForParty', () => {
  it('infers Photography from deliverables instead of generic contractor role', () => {
    expect(inferServiceCategoriesForParty(party({}))).toEqual(['Photography']);
  });

  it('prefers extracted serviceCategories when present', () => {
    expect(
      inferServiceCategoriesForParty(
        party({ serviceCategories: field(['Graphic Design', 'Marketing']) })
      )
    ).toEqual(['Graphic Design', 'Marketing']);
  });
});
