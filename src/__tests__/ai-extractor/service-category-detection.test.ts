import { inferServiceCategoriesForParty } from '@/lib/ai-extractor/service-category-detection';
import { field, legacyDeliverables, testParty } from '@/lib/ai-extractor/test-helpers/party-fixture';

describe('inferServiceCategoriesForParty', () => {
  it('infers PHOTOGRAPHY from deliverables instead of generic contractor role', () => {
    expect(
      inferServiceCategoriesForParty(
        testParty({
          ...legacyDeliverables(['Event photography', '50 edited images']),
        })
      )
    ).toEqual(['PHOTOGRAPHY']);
  });

  it('prefers extracted serviceCategories when present', () => {
    expect(
      inferServiceCategoriesForParty(
        testParty({
          serviceCategories: field(['GRAPHIC_DESIGN', 'MARKETING']),
        })
      )
    ).toEqual(['GRAPHIC_DESIGN', 'MARKETING']);
  });
});
