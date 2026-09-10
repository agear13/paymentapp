import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import {
  evaluateLatestObservation,
  getPublicRouteIntelligenceSnapshot,
  observationStaleAfter,
} from '@/lib/route-intelligence';
import type { LandingSearchQuery } from '@/lib/journey/landing-route-model';
import type { ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';
import fs from 'fs';
import path from 'path';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function query(overrides: Partial<LandingSearchQuery> = {}): LandingSearchQuery {
  return {
    ...DEFAULT_LANDING_SEARCH,
    originCountry: 'AU',
    destinationCountry: 'ID',
    transactionType: 'supplier_payment',
    priority: 'lowest_cost',
    ...overrides,
  };
}

function health(
  componentStatus: ProviderOperationalHealthObservation['value']['componentStatus']
): ProviderOperationalHealthObservation {
  const fetchedAt = '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Partial System Outage',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus,
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: 'abc',
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: componentStatus === 'operational' ? 'none' : 'major',
      pageDescription: componentStatus === 'operational' ? 'All Systems Operational' : 'Partial System Outage',
      componentId: '2jxb8y760wrd',
      componentName: 'Payments',
      componentStatus,
    },
  };
}

function comparisonShape(input: LandingSearchQuery) {
  const result = compareLandingRoutes(input);
  return {
    mechanisms: rankLandingRoutes(input).map((entry) => entry.id),
    offeringIds: result.offerings.map((item) => item.id),
    recommendedProvider: result.recommendedOffering.offering.providerId,
    recommendedOffering: result.recommendedOffering.offering.id,
    genericBest: result.genericBest.id,
  };
}

const GOLDEN_AU_ID_SUPPLIER_LOWEST_COST = {
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
};

describe('Phase 3 observation does not change ranking', () => {
  it('keeps golden ranking when no Wise observation exists', () => {
    expect(comparisonShape(query())).toEqual(GOLDEN_AU_ID_SUPPLIER_LOWEST_COST);
  });

  it('keeps golden ranking when Wise Payments is operational', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health('operational'), NOW),
    });
    expect(snapshot.offerings.find((item) => item.id === 'wise-international')?.availability.provenance).toBe(
      'externally_sourced'
    );
    expect(comparisonShape(query())).toEqual(GOLDEN_AU_ID_SUPPLIER_LOWEST_COST);
  });

  it('keeps golden ranking when Wise Payments is degraded', () => {
    getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health('degraded_performance'), NOW),
    });
    expect(comparisonShape(query())).toEqual(GOLDEN_AU_ID_SUPPLIER_LOWEST_COST);
    expect(rankLandingRoutes(query())[0]?.id).toBe('international_bank');
  });

  it('keeps golden ranking when Wise Payments is in major outage', () => {
    const snapshot = getPublicRouteIntelligenceSnapshot({
      wisePaymentsHealth: evaluateLatestObservation(health('major_outage'), NOW),
    });
    expect(
      snapshot.offerings.find((item) => item.id === 'wise-international')?.availability
    ).toMatchObject({
      provenance: 'externally_sourced',
      componentStatus: 'major_outage',
    });
    expect(comparisonShape(query())).toEqual(GOLDEN_AU_ID_SUPPLIER_LOWEST_COST);
  });

  it('does not let the public comparison import or call status.wise.com', () => {
    const comparison = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      'utf8'
    );
    const snapshot = fs.readFileSync(
      path.join(process.cwd(), 'lib/route-intelligence/snapshot.ts'),
      'utf8'
    );
    const rank = fs.readFileSync(
      path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'),
      'utf8'
    );
    expect(comparison).not.toContain('status.wise.com');
    expect(comparison).not.toContain('fetch(');
    expect(rank).not.toContain('status.wise.com');
    expect(rank).not.toContain('fetch(');
    expect(snapshot).not.toContain('fetch(');
    expect(snapshot).not.toContain('wise-status-adapter');
  });
});
