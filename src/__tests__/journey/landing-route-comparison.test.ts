import {
  compareLandingRoutes,
  DEFAULT_LANDING_SEARCH,
  formatLandingAmount,
  LANDING_COMPARISON_DISCLAIMER,
  LANDING_PRIORITIES,
  LANDING_TRANSACTION_TYPES,
  landingSearchIsValid,
  objectiveFromLandingSearch,
  parseLandingAmount,
} from '@/lib/journey/landing-route-comparison';
import {
  EMPTY_LANDING_FILTERS,
  filterProviderResults,
  sortProviderResults,
} from '@/lib/journey/landing-provider-search';

describe('compareLandingRoutes', () => {
  it('returns multiple ranked provider routes for the default cross-border supplier payment', () => {
    const result = compareLandingRoutes(DEFAULT_LANDING_SEARCH);

    expect(result.offerings.length).toBeGreaterThan(5);
    expect(result.offerings.filter((item) => item.isRecommended)).toHaveLength(1);
    expect(result.recommendedOffering.offering.providerId).toBe('wise');
    expect(result.genericBest.id).toBe('international_bank');
    expect(result.headline).toContain('Wise');
    expect(result.disclaimer).toBe(LANDING_COMPARISON_DISCLAIMER);
    expect(result.disclaimer).toMatch(/not live quotes/i);
    result.offerings.forEach((item) => {
      expect(item.live).toBe(false);
      expect(item.pricingStatus).toBe('indicative');
      expect(item.pricing.type).toBe('indicative');
      expect(item.availability.type).toBe('typical');
      expect(item.source.type).toBe('static_catalog');
      expect(item.source.retrievedAt).toBeNull();
      expect(item.pricing.timestamp).toBeNull();
    });
  });

  it('keeps the asked-for payment prominent', () => {
    const result = compareLandingRoutes(DEFAULT_LANDING_SEARCH);

    expect(result.contextLine).toMatch(/10,000/);
    expect(result.contextLine).toContain('Supplier payment');
    expect(result.contextLine).toContain('Australia → Indonesia');
    expect(result.contextLine).toContain('Lowest total cost');
  });

  it('explains the ranking from supplied inputs rather than unknown business facts', () => {
    const result = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    expect(result.recommendedWhy).toMatch(/lowest total cost/i);
    expect(result.recommendedWhy).toMatch(/Wise/);
    expect(result.whatCouldChange.join(' ')).toMatch(/negotiated FX rates/i);
    expect(result.confidence.explanation).toMatch(/does not yet know/i);
    expect(JSON.stringify(result.confidence)).not.toMatch(/%/);
  });

  it('prefers Stripe checkout when collecting and prioritising speed', () => {
    const result = compareLandingRoutes({
      ...DEFAULT_LANDING_SEARCH,
      originCountry: 'AU',
      destinationCountry: 'AU',
      transactionType: 'customer_collection',
      priority: 'fastest',
    });

    expect(result.genericBest.id).toBe('card_checkout');
    expect(result.recommendedOffering.offering.providerId).toBe('stripe');
  });

  it('prefers domestic bank when paying a local supplier for lowest cost', () => {
    const result = compareLandingRoutes({
      ...DEFAULT_LANDING_SEARCH,
      destinationCountry: 'AU',
      transactionType: 'supplier_payment',
      priority: 'lowest_cost',
    });

    expect(result.genericBest.id).toBe('domestic_bank');
    expect(result.offerings.some((item) => item.offering.mechanism === 'international_bank')).toBe(
      false
    );
    expect(result.contextLine).not.toContain('→');
  });

  it('changes the recommended provider when the visitor optimises for speed', () => {
    const cost = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    const fast = compareLandingRoutes({ ...DEFAULT_LANDING_SEARCH, priority: 'fastest' });

    expect(cost.recommendedOffering.offering.providerId).toBe('wise');
    expect(fast.recommendedOffering.offering.providerId).toBe('digital_dollar');
    expect(fast.recommendedOffering.offering.productName).toMatch(/digital-dollar/i);
  });

  it('prefers the familiar bank transfer when the visitor optimises for simplest', () => {
    const simple = compareLandingRoutes({ ...DEFAULT_LANDING_SEARCH, priority: 'simplest' });
    expect(simple.recommendedOffering.offering.providerId).toBe('bank');
  });

  it('returns routes for Australia to Thailand without live quotes', () => {
    const result = compareLandingRoutes({
      ...DEFAULT_LANDING_SEARCH,
      destinationCountry: 'TH',
    });
    expect(result.offerings.length).toBeGreaterThan(5);
    expect(result.contextLine).toContain('Australia → Thailand');
    expect(result.offerings.every((item) => item.pricing.type === 'indicative')).toBe(true);
  });

  it('does not invent live quotes or claim personalised knowledge', () => {
    const result = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    const joined = JSON.stringify(result);

    expect(joined).not.toMatch(/\$\d+\.\d{2} fee/i);
    expect(joined).not.toMatch(/guarantees? savings/i);
    expect(joined).not.toMatch(/live payment availability/i);
    expect(joined).not.toMatch(/"live":true/);
    result.offerings.forEach((item) => {
      expect(item.indicativeCostLabel).toMatch(/~|Indicative|varies/i);
      expect(item.indicativeCostLabel).not.toMatch(/\d+\.\d{2}/);
    });
  });

  it('returns provider offerings across types and priorities', () => {
    for (const type of LANDING_TRANSACTION_TYPES) {
      for (const priority of LANDING_PRIORITIES) {
        const crossBorder = compareLandingRoutes({
          ...DEFAULT_LANDING_SEARCH,
          transactionType: type.id,
          priority: priority.id,
        });
        const domestic = compareLandingRoutes({
          ...DEFAULT_LANDING_SEARCH,
          destinationCountry: 'AU',
          transactionType: type.id,
          priority: priority.id,
        });
        expect(crossBorder.offerings.length).toBeGreaterThan(3);
        expect(domestic.offerings.length).toBeGreaterThan(2);
      }
    }
  });

  it('filters bank transfers and re-sorts by speed without a new engine', () => {
    const result = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    const banks = filterProviderResults(result.offerings, {
      ...EMPTY_LANDING_FILTERS,
      paymentMethods: ['bank_transfer'],
    });
    expect(banks.length).toBeGreaterThan(0);
    expect(banks.every((item) => item.offering.paymentMethods.includes('bank_transfer'))).toBe(
      true
    );

    const fastest = sortProviderResults(result.offerings, 'fastest');
    expect(fastest[0]?.offering.speedBand).toBe('instant');
  });

  it('maps transaction types to assessment objectives', () => {
    expect(objectiveFromLandingSearch(DEFAULT_LANDING_SEARCH)).toBe('reduce-admin');
    expect(
      objectiveFromLandingSearch({
        ...DEFAULT_LANDING_SEARCH,
        transactionType: 'customer_collection',
      })
    ).toBe('paid-faster');
  });
});

describe('landing search helpers', () => {
  it('accepts the default query and rejects an empty amount', () => {
    expect(landingSearchIsValid(DEFAULT_LANDING_SEARCH)).toBe(true);
    expect(landingSearchIsValid({ ...DEFAULT_LANDING_SEARCH, amount: 0 })).toBe(false);
  });

  it('parses and formats amounts without inventing FX', () => {
    expect(parseLandingAmount('10,000')).toBe(10000);
    expect(formatLandingAmount(10000, 'AUD')).toContain('10,000');
  });
});
