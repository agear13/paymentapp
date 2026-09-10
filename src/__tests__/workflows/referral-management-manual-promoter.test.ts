import { buildManualAddPromoterInput } from '@/lib/workflows/referral-management/manual-promoter-input';

const SERVICE = '11111111-1111-1111-1111-111111111111';

describe('manual promoter input', () => {
  it('creates an internal Provvy-service relationship with the selected catalogue ids', () => {
    expect(
      buildManualAddPromoterInput({
        name: 'Apex Promotions',
        email: 'apex@example.com',
        role: 'Promoter',
        compensationKind: 'revenue_share',
        percentage: 20,
        serviceIds: [SERVICE],
        earningSourceType: 'internal_service',
      })
    ).toEqual({
      name: 'Apex Promotions',
      email: 'apex@example.com',
      phone: undefined,
      role: 'Promoter',
      roleLabel: undefined,
      compensation: {
        kind: 'revenue_share',
        percentage: 20,
        serviceIds: [SERVICE],
        earningSource: { type: 'internal_service' },
      },
    });
  });

  it('still requires a catalogue service for the internal path', () => {
    expect(
      buildManualAddPromoterInput({
        name: 'Apex Promotions',
        role: 'Promoter',
        compensationKind: 'revenue_share',
        percentage: 20,
        serviceIds: [],
        earningSourceType: 'internal_service',
      })
    ).toEqual({ error: 'Select at least one eligible service.' });
  });

  it('creates a Weso external relationship without a Provvy catalogue service', () => {
    expect(
      buildManualAddPromoterInput({
        name: 'Rachel Smith',
        email: 'rachel@example.com',
        role: 'Affiliate',
        roleLabel: 'Community Organiser',
        compensationKind: 'revenue_share',
        percentage: 2,
        serviceIds: [],
        earningSourceType: 'external',
        externalProvider: 'Weso',
        externalService: 'Weso App Store',
        attributionMethod: 'discount_code',
        audienceDiscountPct: 10,
      })
    ).toEqual({
      name: 'Rachel Smith',
      email: 'rachel@example.com',
      phone: undefined,
      role: 'Affiliate',
      roleLabel: 'Community Organiser',
      compensation: {
        kind: 'revenue_share',
        percentage: 2,
        earningSource: {
          type: 'external',
          externalProvider: 'Weso',
          externalService: 'Weso App Store',
          attributionMethod: 'discount_code',
          audienceDiscountPct: 10,
        },
      },
    });
  });

  it('requires an external platform and does not invent a catalogue service', () => {
    expect(
      buildManualAddPromoterInput({
        name: 'Rachel Smith',
        role: 'Affiliate',
        compensationKind: 'revenue_share',
        percentage: 2,
        serviceIds: [],
        earningSourceType: 'external',
        externalProvider: '',
      })
    ).toEqual({ error: 'Enter the external platform this affiliate earns on.' });
  });
});
