import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  CORRIDOR_CAPABILITY_MATRIX,
  coverageQueryFromSearch,
  evaluateOfferingCoverage,
  getPublicRouteIntelligenceSnapshot,
} from '@/lib/route-intelligence';

const supplierAud = {
  ...DEFAULT_LANDING_SEARCH,
  originCountry: 'AU' as const,
  transactionType: 'supplier_payment' as const,
  priority: 'lowest_cost' as const,
  currency: 'AUD',
};

describe('corridor eligibility', () => {
  it('keeps the public AU → ID set unchanged when destination currency is unknown', () => {
    const result = compareLandingRoutes(supplierAud);
    expect(result.offerings.map((item) => item.id)).toEqual([
      'wise-international',
      'airwallex-international',
      'ofx-international',
      'bank-swift',
      'wise-local',
      'airwallex-local',
      'digital-dollar',
      'stripe-checkout',
      'paypal-checkout',
    ]);
    expect(result.offerings.find((item) => item.id === 'wise-international')?.coverageStatus).toBe(
      'supported'
    );
    expect(result.offerings.find((item) => item.id === 'airwallex-international')?.coverageUncertainty).toBe(
      true
    );
    expect(result.offerings.find((item) => item.id === 'digital-dollar')?.coverageStatus).toBe(
      'unspecified'
    );
  });

  it('excludes unsupported IDR SWIFT while keeping THB and SGD SWIFT eligible', () => {
    const indonesia = compareLandingRoutes({
      ...supplierAud,
      destinationCountry: 'ID',
      destinationCurrency: 'IDR',
    });
    const thailand = compareLandingRoutes({
      ...supplierAud,
      destinationCountry: 'TH',
      destinationCurrency: 'THB',
    });
    const singapore = compareLandingRoutes({
      ...supplierAud,
      destinationCountry: 'SG',
      destinationCurrency: 'SGD',
    });

    expect(indonesia.offerings.map((item) => item.id)).not.toContain('airwallex-international');
    expect(thailand.offerings.map((item) => item.id)).toContain('airwallex-international');
    expect(singapore.offerings.map((item) => item.id)).toContain('airwallex-international');

    expect(indonesia.offerings.find((item) => item.id === 'wise-international')?.coverageStatus).toBe(
      'supported'
    );
    expect(thailand.offerings.find((item) => item.id === 'airwallex-local')?.coverageStatus).toBe(
      'supported'
    );
    expect(singapore.offerings.find((item) => item.id === 'ofx-international')?.coverageStatus).toBe(
      'supported'
    );
  });

  it('does not apply supplier-send evidence to customer collection', () => {
    const coverage = evaluateOfferingCoverage(
      'wise-international',
      coverageQueryFromSearch({
        ...supplierAud,
        destinationCountry: 'ID',
        destinationCurrency: 'IDR',
        transactionType: 'customer_collection',
      }),
      CORRIDOR_CAPABILITY_MATRIX
    );
    expect(coverage.status).toBe('unspecified');
    expect(coverage.eligible).toBe(true);
    expect(coverage.uncertainty).toBe(true);
  });

  it('keeps currency-pair constraints from treating IDR support as THB support', () => {
    const idrOnThailand = evaluateOfferingCoverage(
      'airwallex-local',
      {
        origin: 'AU',
        destination: 'TH',
        sourceCurrency: 'AUD',
        destinationCurrency: 'IDR',
        transactionType: 'supplier_payment',
      },
      CORRIDOR_CAPABILITY_MATRIX
    );
    expect(idrOnThailand.status).toBe('unspecified');
  });

  it('does not change rankLandingRoutes scores', () => {
    const before = rankLandingRoutes(DEFAULT_LANDING_SEARCH);
    const after = rankLandingRoutes({
      ...DEFAULT_LANDING_SEARCH,
      destinationCurrency: 'IDR',
    });
    expect(after).toEqual(before);
    expect(after.map((entry) => entry.id)).toEqual([
      'international_bank',
      'local_currency_settlement',
      'stablecoin_settlement',
      'card_checkout',
    ]);
  });

  it('does not feed developments into coverage', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot();
    const fromDevelopments = evaluateOfferingCoverage(
      'wise-international',
      coverageQueryFromSearch({ ...supplierAud, destinationCountry: 'ID' }),
      snapshot.developments as never
    );
    expect(fromDevelopments.status).toBe('unspecified');
    expect(fromDevelopments.matchedCapabilityIds).toEqual([]);
  });
});
