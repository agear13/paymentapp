import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import type { LandingPriorityId, LandingSearchQuery, LandingTransactionTypeId } from '@/lib/journey/landing-route-model';

function query(overrides: Partial<LandingSearchQuery>): LandingSearchQuery {
  return { ...DEFAULT_LANDING_SEARCH, ...overrides };
}

function rankedMechanisms(input: LandingSearchQuery) {
  return rankLandingRoutes(input).map((entry) => entry.id);
}

function comparisonShape(input: LandingSearchQuery) {
  const result = compareLandingRoutes(input);
  return {
    mechanisms: rankedMechanisms(input),
    offeringIds: result.offerings.map((item) => item.id),
    recommendedProvider: result.recommendedOffering.offering.providerId,
    recommendedOffering: result.recommendedOffering.offering.id,
    genericBest: result.genericBest.id,
  };
}

describe('route ranking goldens — cross-border Australia → Indonesia', () => {
  const corridor = { originCountry: 'AU' as const, destinationCountry: 'ID' as const };

  it('supplier payment + lowest cost', () => {
    expect(comparisonShape(query({ ...corridor, transactionType: 'supplier_payment', priority: 'lowest_cost' }))).toEqual({
      mechanisms: ['international_bank', 'local_currency_settlement', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: [
        'wise-international',
        'airwallex-international',
        'ofx-international',
        'bank-swift',
        'wise-local',
        'airwallex-local',
        'digital-dollar',
        'stripe-checkout',
        'paypal-checkout',
      ],
      recommendedProvider: 'wise',
      recommendedOffering: 'wise-international',
      genericBest: 'international_bank',
    });
  });

  it('supplier payment + fastest', () => {
    expect(comparisonShape(query({ ...corridor, transactionType: 'supplier_payment', priority: 'fastest' }))).toEqual({
      mechanisms: ['stablecoin_settlement', 'card_checkout', 'local_currency_settlement', 'international_bank'],
      offeringIds: [
        'digital-dollar',
        'stripe-checkout',
        'paypal-checkout',
        'airwallex-local',
        'wise-local',
        'airwallex-international',
        'wise-international',
        'ofx-international',
        'bank-swift',
      ],
      recommendedProvider: 'digital_dollar',
      recommendedOffering: 'digital-dollar',
      genericBest: 'stablecoin_settlement',
    });
  });

  it('supplier payment + simplest', () => {
    expect(comparisonShape(query({ ...corridor, transactionType: 'supplier_payment', priority: 'simplest' }))).toEqual({
      mechanisms: ['international_bank', 'card_checkout', 'local_currency_settlement', 'stablecoin_settlement'],
      offeringIds: [
        'bank-swift',
        'wise-international',
        'airwallex-international',
        'ofx-international',
        'stripe-checkout',
        'paypal-checkout',
        'wise-local',
        'airwallex-local',
        'digital-dollar',
      ],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-swift',
      genericBest: 'international_bank',
    });
  });

  it('does not treat Thailand as a different corridor from Indonesia yet', () => {
    const indonesia = comparisonShape(query({ destinationCountry: 'ID' }));
    const thailand = comparisonShape(query({ destinationCountry: 'TH' }));
    expect(thailand.mechanisms).toEqual(indonesia.mechanisms);
    expect(thailand.offeringIds).toEqual(indonesia.offeringIds);
    expect(thailand.recommendedOffering).toEqual(indonesia.recommendedOffering);
  });
});

describe('route ranking goldens — domestic Australia → Australia', () => {
  const cases: Array<{
    transactionType: LandingTransactionTypeId;
    priority: LandingPriorityId;
    mechanisms: string[];
    offeringIds: string[];
    recommendedProvider: string;
    recommendedOffering: string;
    genericBest: string;
  }> = [
    {
      transactionType: 'supplier_payment',
      priority: 'lowest_cost',
      mechanisms: ['domestic_bank', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: ['bank-domestic', 'digital-dollar', 'stripe-checkout', 'paypal-checkout'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'supplier_payment',
      priority: 'fastest',
      mechanisms: ['stablecoin_settlement', 'card_checkout', 'domestic_bank'],
      offeringIds: ['digital-dollar', 'stripe-checkout', 'paypal-checkout', 'bank-domestic'],
      recommendedProvider: 'digital_dollar',
      recommendedOffering: 'digital-dollar',
      genericBest: 'stablecoin_settlement',
    },
    {
      transactionType: 'supplier_payment',
      priority: 'simplest',
      mechanisms: ['domestic_bank', 'card_checkout', 'stablecoin_settlement'],
      offeringIds: ['bank-domestic', 'stripe-checkout', 'paypal-checkout', 'digital-dollar'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'customer_collection',
      priority: 'lowest_cost',
      mechanisms: ['domestic_bank', 'direct_debit', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: ['bank-domestic', 'direct-debit', 'digital-dollar', 'stripe-checkout', 'paypal-checkout'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'customer_collection',
      priority: 'fastest',
      mechanisms: ['card_checkout', 'stablecoin_settlement', 'direct_debit', 'domestic_bank'],
      offeringIds: ['stripe-checkout', 'paypal-checkout', 'digital-dollar', 'bank-domestic', 'direct-debit'],
      recommendedProvider: 'stripe',
      recommendedOffering: 'stripe-checkout',
      genericBest: 'card_checkout',
    },
    {
      transactionType: 'customer_collection',
      priority: 'simplest',
      mechanisms: ['card_checkout', 'domestic_bank', 'direct_debit', 'stablecoin_settlement'],
      offeringIds: ['stripe-checkout', 'paypal-checkout', 'bank-domestic', 'direct-debit', 'digital-dollar'],
      recommendedProvider: 'stripe',
      recommendedOffering: 'stripe-checkout',
      genericBest: 'card_checkout',
    },
    {
      transactionType: 'contractor_payroll',
      priority: 'lowest_cost',
      mechanisms: ['domestic_bank', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: ['bank-domestic', 'digital-dollar', 'stripe-checkout', 'paypal-checkout'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'contractor_payroll',
      priority: 'fastest',
      mechanisms: ['stablecoin_settlement', 'card_checkout', 'domestic_bank'],
      offeringIds: ['digital-dollar', 'stripe-checkout', 'paypal-checkout', 'bank-domestic'],
      recommendedProvider: 'digital_dollar',
      recommendedOffering: 'digital-dollar',
      genericBest: 'stablecoin_settlement',
    },
    {
      transactionType: 'contractor_payroll',
      priority: 'simplest',
      mechanisms: ['domestic_bank', 'card_checkout', 'stablecoin_settlement'],
      offeringIds: ['bank-domestic', 'stripe-checkout', 'paypal-checkout', 'digital-dollar'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'revenue_share',
      priority: 'lowest_cost',
      mechanisms: ['domestic_bank', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: ['bank-domestic', 'digital-dollar', 'stripe-checkout', 'paypal-checkout'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'revenue_share',
      priority: 'fastest',
      mechanisms: ['card_checkout', 'stablecoin_settlement', 'domestic_bank'],
      offeringIds: ['stripe-checkout', 'digital-dollar', 'paypal-checkout', 'bank-domestic'],
      recommendedProvider: 'stripe',
      recommendedOffering: 'stripe-checkout',
      genericBest: 'card_checkout',
    },
    {
      transactionType: 'revenue_share',
      priority: 'simplest',
      mechanisms: ['card_checkout', 'domestic_bank', 'stablecoin_settlement'],
      offeringIds: ['stripe-checkout', 'paypal-checkout', 'bank-domestic', 'digital-dollar'],
      recommendedProvider: 'stripe',
      recommendedOffering: 'stripe-checkout',
      genericBest: 'card_checkout',
    },
    {
      transactionType: 'intercompany',
      priority: 'lowest_cost',
      mechanisms: ['domestic_bank', 'stablecoin_settlement', 'card_checkout'],
      offeringIds: ['bank-domestic', 'digital-dollar', 'stripe-checkout', 'paypal-checkout'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
    {
      transactionType: 'intercompany',
      priority: 'fastest',
      mechanisms: ['stablecoin_settlement', 'card_checkout', 'domestic_bank'],
      offeringIds: ['digital-dollar', 'stripe-checkout', 'paypal-checkout', 'bank-domestic'],
      recommendedProvider: 'digital_dollar',
      recommendedOffering: 'digital-dollar',
      genericBest: 'stablecoin_settlement',
    },
    {
      transactionType: 'intercompany',
      priority: 'simplest',
      mechanisms: ['domestic_bank', 'card_checkout', 'stablecoin_settlement'],
      offeringIds: ['bank-domestic', 'stripe-checkout', 'paypal-checkout', 'digital-dollar'],
      recommendedProvider: 'bank',
      recommendedOffering: 'bank-domestic',
      genericBest: 'domestic_bank',
    },
  ];

  it.each(cases)('$transactionType + $priority', (expected) => {
    expect(
      comparisonShape(
        query({
          originCountry: 'AU',
          destinationCountry: 'AU',
          transactionType: expected.transactionType,
          priority: expected.priority,
        })
      )
    ).toEqual({
      mechanisms: expected.mechanisms,
      offeringIds: expected.offeringIds,
      recommendedProvider: expected.recommendedProvider,
      recommendedOffering: expected.recommendedOffering,
      genericBest: expected.genericBest,
    });
  });
});
