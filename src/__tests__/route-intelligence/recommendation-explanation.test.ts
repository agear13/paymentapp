import fs from 'fs';
import path from 'path';
import { compareLandingRoutes, DEFAULT_LANDING_SEARCH, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import { explainLandingRecommendation } from '@/lib/journey/landing-recommendation-explanation';
import {
  buildProviderFeeObservation,
  buildRailRegulatoryObservation,
  buildRouteAvailabilityObservation,
  buildRouteFxObservation,
  buildRouteSettlementObservation,
  compareShadowDecision,
  CORRIDOR_CAPABILITY_MATRIX,
  createRouteSubject,
  decideRoute,
  explanationContainsFabricatedClaim,
  observationStaleAfter,
  toRecommendationExplanation,
  WISE_PAYMENTS_COMPONENT_ID,
} from '@/lib/route-intelligence';
import type { DecisionPayment, RouteDecision } from '@/lib/route-intelligence/decision-types';
import type { ProviderOperationalHealthObservation, RouteSubject } from '@/lib/route-intelligence/types';

const NOW = new Date('2026-09-10T15:00:00.000Z');

function route(input: {
  providerId: RouteSubject['providerId'];
  offeringId: string;
  mechanismId: RouteSubject['mechanismId'];
  origin: string;
  destination: string;
  source: string | null;
  target: string | null;
  rail?: string;
}): RouteSubject {
  return createRouteSubject({
    providerId: input.providerId,
    offeringId: input.offeringId,
    mechanismId: input.mechanismId,
    corridor: { origin: input.origin, destination: input.destination },
    sourceCurrency: input.source,
    destinationCurrency: input.target,
    networkRail: input.rail ?? 'unknown',
  });
}

const WISE_EUR_IDR = route({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  origin: 'DE',
  destination: 'ID',
  source: 'EUR',
  target: 'IDR',
});

const WISE_AUD_IDR = route({
  providerId: 'wise',
  offeringId: 'wise-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
});

const OFX_AUD_IDR = route({
  providerId: 'ofx',
  offeringId: 'ofx-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
});

const OFX_AUD_IDR_NPP = route({
  providerId: 'ofx',
  offeringId: 'ofx-international',
  mechanismId: 'international_bank',
  origin: 'AU',
  destination: 'ID',
  source: 'AUD',
  target: 'IDR',
  rail: 'npp',
});

function payment(overrides: Partial<DecisionPayment> = {}): DecisionPayment {
  return {
    origin: 'AU',
    destination: 'ID',
    sourceCurrency: 'AUD',
    destinationCurrency: 'IDR',
    amount: 10000,
    transactionType: 'supplier_payment',
    priority: 'lowest_cost',
    ...overrides,
  };
}

function fee(subject: RouteSubject, feeAmount: number) {
  return buildProviderFeeObservation({
    route: subject,
    amount: 10000,
    sourceCurrency: subject.currencyPair.source,
    feeAmount,
    feeCurrency: subject.currencyPair.source,
    feeModel: 'fixed',
    feePercent: null,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase11_fee_fixture',
    sourceUrl: 'https://example.test/route-intelligence/fee-fixture',
    rawHash: `fee-${subject.offeringId}-${feeAmount}`,
  });
}

function fx(
  subject: RouteSubject,
  rate: number,
  overrides: { fetchedAt?: string; rateKind?: 'mid_market_reference' | 'indicative' | 'provider_quoted'; sourceUrl?: string } = {}
) {
  return buildRouteFxObservation({
    route: subject,
    sourceCurrency: subject.currencyPair.source,
    destinationCurrency: subject.currencyPair.target,
    sourceAmount: null,
    exchangeRate: rate,
    rateKind: overrides.rateKind ?? 'mid_market_reference',
    rateSource: 'phase11_fx_fixture',
    includesSpread: false,
    observedAt: '2026-09-10T00:00:00.000Z',
    fetchedAt: overrides.fetchedAt ?? '2026-09-10T14:00:00.000Z',
    sourceId: 'phase11_fx_fixture',
    sourceUrl: overrides.sourceUrl ?? 'https://example.test/route-intelligence/fx-fixture',
    rawHash: `fx-${subject.offeringId}-${rate}`,
  });
}

function settle(subject: RouteSubject, band: 'instant' | 'multi_day') {
  return buildRouteSettlementObservation({
    route: subject,
    band,
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase11_settlement_fixture',
    sourceUrl: 'https://example.test/route-intelligence/settlement-fixture',
    rawHash: `settle-${subject.offeringId}-${band}`,
  });
}

function avail(subject: RouteSubject) {
  return buildRouteAvailabilityObservation({
    route: subject,
    status: 'available',
    paymentType: 'supplier_payment',
    observedAt: '2026-09-10T13:00:00.000Z',
    fetchedAt: '2026-09-10T14:00:00.000Z',
    sourceId: 'phase11_availability_fixture',
    sourceUrl: 'https://example.test/route-intelligence/availability-fixture',
    rawHash: `avail-${subject.offeringId}`,
  });
}

function health(status: ProviderOperationalHealthObservation['value']['componentStatus']): ProviderOperationalHealthObservation {
  const fetchedAt = '2026-09-10T14:00:00.000Z';
  return {
    observationType: 'provider_operational_health',
    subjectKind: 'provider_component',
    subjectId: 'wise:payments',
    providerId: 'wise',
    value: {
      pageIndicator: status === 'operational' ? 'none' : 'major',
      pageDescription: status === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
      componentName: 'Payments',
      componentStatus: status,
    },
    observedAt: '2026-09-10T13:09:10.107Z',
    fetchedAt,
    sourceId: 'wise_statuspage',
    sourceUrl: 'https://status.wise.com/api/v2/summary.json',
    provenance: 'externally_sourced',
    confidence: 'high',
    staleAfter: observationStaleAfter(fetchedAt).toISOString(),
    rawHash: `health-${status}`,
    rawEvidence: {
      pageUpdatedAt: '2026-09-10T13:09:10.107Z',
      pageIndicator: status === 'operational' ? 'none' : 'major',
      pageDescription: status === 'operational' ? 'All Systems Operational' : 'Outage',
      componentId: WISE_PAYMENTS_COMPONENT_ID,
      componentName: 'Payments',
      componentStatus: status,
    },
  };
}

function explainDecision(
  decision: RouteDecision,
  displayedOfferingId: string,
  displayedProviderName: string
) {
  return toRecommendationExplanation(decision, {
    displayedOfferingId,
    displayedProviderName,
    comparison: compareShadowDecision(
      {
        recommendedOfferingId: displayedOfferingId,
        orderedOfferingIds: [displayedOfferingId],
      },
      decision
    ),
    offeringNames: {
      'wise-international': 'Wise',
      'ofx-international': 'OFX',
    },
  });
}

describe('recommendation explanation mapping', () => {
  it('maps a supported capability into a customer-facing reason', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.status).toBe('explained');
    expect(explanation.reasons.some((item) => item.kind === 'capability_supported')).toBe(true);
    expect(explanation.reasons.find((item) => item.kind === 'capability_supported')?.text).toMatch(
      /capability evidence/i
    );
    expect(explanationContainsFabricatedClaim(explanation)).toBe(false);
  });

  it('maps fresh operational health into an operational reason and evidence label', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      health: health('operational'),
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.reasons.some((item) => item.kind === 'operationally_clear')).toBe(true);
    expect(explanation.evidence.some((item) => item.label === 'Wise Statuspage')).toBe(true);
    expect(explanation.evidence.every((item) => !item.label.includes('http'))).toBe(true);
  });

  it('maps a sourced permitted regulatory observation, not missing regulation', () => {
    const without = explainDecision(
      decideRoute(payment(), [{ route: WISE_AUD_IDR }], { now: NOW }),
      'wise-international',
      'Wise'
    );
    expect(without.reasons.some((item) => item.kind === 'regulatory_clear')).toBe(false);

    const decision = decideRoute(payment(), [{ route: OFX_AUD_IDR_NPP }], {
      now: NOW,
      regulatoryObservations: [
        buildRailRegulatoryObservation({
          railId: 'npp',
          jurisdiction: 'AU',
          paymentType: 'supplier_payment',
          status: 'permitted',
          observedAt: '2026-09-10T13:00:00.000Z',
          fetchedAt: '2026-09-10T14:00:00.000Z',
          sourceId: 'phase11_reg_fixture',
          sourceUrl: 'https://www.rba.gov.au/payments-and-infrastructure/new-payments-platform/about-npp.html',
          source: 'rba_npp',
          rawHash: 'reg-npp-permitted',
        }),
      ],
    });
    const explanation = explainDecision(decision, 'ofx-international', 'OFX');
    expect(explanation.displayedProviderName).toBe('OFX');
    expect(explanation.reasons.some((item) => item.kind === 'regulatory_clear')).toBe(true);
    expect(explanation.evidence.some((item) => item.host === 'www.rba.gov.au')).toBe(true);
  });

  it('maps sourced economics without calling the route cheapest', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }, { route: OFX_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AUD_IDR, 20), fee(OFX_AUD_IDR, 80)],
      fxObservations: [fx(WISE_AUD_IDR, 2.5), fx(OFX_AUD_IDR, 2.4)],
      now: NOW,
    });
    const explanation = explainDecision(decision, decision.recommended?.route.offeringId ?? 'wise-international', 'Wise');
    if (explanation.status === 'explained') {
      expect(explanation.reasons.some((item) => item.kind === 'lower_evidenced_cost' || item.kind === 'objective_alignment')).toBe(
        true
      );
      expect(explanation.reasons.every((item) => !/cheapest route/i.test(item.text))).toBe(true);
    }
    expect(explanationContainsFabricatedClaim(explanation)).toBe(false);
  });

  it('maps Phase 9 decision confidence without percentages', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.confidence?.level).toBe(decision.confidence.level);
    expect(['High', 'Moderate', 'Low', 'Unknown']).toContain(explanation.confidence?.label);
    expect(JSON.stringify(explanation)).not.toMatch(/\d+%/);
  });

  it('translates unknown rail and missing quote into customer language', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.unknowns.some((item) => item.kind === 'unknown_network_rail')).toBe(true);
    expect(explanation.unknowns.some((item) => item.kind === 'missing_provider_quote')).toBe(true);
    expect(explanation.unknowns.join(' ')).not.toContain('RouteSubject');
    expect(explanation.unknowns.join(' ')).not.toContain('networkRail');
  });

  it('surfaces stale evidence instead of treating it as current', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AUD_IDR, 20)],
      fxObservations: [fx(WISE_AUD_IDR, 2.5, { fetchedAt: '2026-09-10T10:00:00.000Z' })],
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.unknowns.some((item) => item.kind === 'stale_evidence')).toBe(true);
    expect(explanation.reasons.some((item) => item.kind === 'lower_evidenced_cost')).toBe(false);
    expect(explanation.confidence?.level).not.toBe('high');
  });

  it('does not treat indicative FX as sourced economic evidence', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee(WISE_AUD_IDR, 20)],
      fxObservations: [fx(WISE_AUD_IDR, 2.5, { rateKind: 'indicative' })],
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.reasons.some((item) => item.kind === 'lower_evidenced_cost')).toBe(false);
    expect(explanation.reasons.some((item) => item.kind === 'better_evidenced_fx')).toBe(false);
    expect(explanation.unknowns.some((item) => item.kind === 'indicative_fx')).toBe(true);
  });

  it('uses an honest insufficient state when there is nothing to say', () => {
    const emptyDecision: RouteDecision = {
      mode: 'shadow',
      payment: payment(),
      recommended: decideRoute(payment(), [{ route: WISE_AUD_IDR }], { now: NOW }).recommended,
      alternatives: [],
      confidence: { level: 'unknown', reasons: ['no_recommendable_route'] },
      decisionNotes: ['mode:shadow'],
    };
    if (emptyDecision.recommended) {
      emptyDecision.recommended = {
        ...emptyDecision.recommended,
        positives: [],
        tradeoffs: [],
        unknowns: [],
        factors: emptyDecision.recommended.factors.map((factor) => ({ ...factor, state: 'known' })),
      };
    }
    const explanation = toRecommendationExplanation(emptyDecision, {
      displayedOfferingId: 'wise-international',
      displayedProviderName: 'Wise',
      comparison: {
        sameRecommendation: true,
        changedRecommendation: false,
        changedOrdering: false,
        insufficientEvidence: true,
        divergenceReasons: ['decision_evidence_limited'],
        rankingRecommendedOfferingId: 'wise-international',
        decisionRecommendedOfferingId: 'wise-international',
      },
    });
    expect(explanation.status).toBe('insufficient');
    expect(explanation.reasons).toEqual([]);
    expect(explanation.summary).toMatch(/still gathering route evidence/i);
  });
});

describe('shadow vs displayed recommendation', () => {
  it('explains only when the shadow decision agrees with the displayed offering', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.status).toBe('explained');
    expect(explanation.displayedOfferingId).toBe('wise-international');
  });

  it('does not claim the displayed route was chosen by the decision engine when they disagree', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }, { route: OFX_AUD_IDR }], {
      now: NOW,
    });
    const displayed = 'wise-international';
    const explanation = toRecommendationExplanation(decision, {
      displayedOfferingId: displayed,
      displayedProviderName: 'Wise',
      comparison: compareShadowDecision(
        { recommendedOfferingId: displayed, orderedOfferingIds: [displayed, 'ofx-international'] },
        decision
      ),
    });
    if (decision.recommended?.route.offeringId !== displayed) {
      expect(explanation.status).toBe('disagreement');
      expect(explanation.reasons).toEqual([]);
      expect(explanation.confidence).toBeNull();
      expect(explanation.summary).toMatch(/still comparing the available routes/i);
      expect(explanation.summary).not.toMatch(/decision engine|shadow|OFX is the winner/i);
    }
  });
});

describe('ECB and AUD→IDR honesty', () => {
  it('can mention ECB only for a EUR pair with sourced ECB evidence', () => {
    const decision = decideRoute(
      payment({ origin: 'DE', sourceCurrency: 'EUR' }),
      [{ route: WISE_EUR_IDR }],
      {
        now: NOW,
        fxObservations: [
          fx(WISE_EUR_IDR, 20414.13, {
            sourceUrl: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
          }),
        ],
      }
    );
    const explanation = explainDecision(decision, 'wise-international', 'Wise');
    expect(explanation.reasons.some((item) => item.kind === 'better_evidenced_fx')).toBe(true);
    expect(explanation.evidence.some((item) => item.host === 'www.ecb.europa.eu')).toBe(true);
    expect(explanation.summary).not.toMatch(/executable customer quote/i);
  });

  it('keeps AUD → IDR unknown and does not attach ECB evidence', () => {
    const publicResult = compareLandingRoutes(DEFAULT_LANDING_SEARCH);
    expect(publicResult.recommendedOffering.id).toBe('wise-international');
    const explanation = explainLandingRecommendation(publicResult);
    expect(explanation.evidence.some((item) => item.host === 'www.ecb.europa.eu')).toBe(false);
    expect(explanation.reasons.some((item) => item.kind === 'better_evidenced_fx')).toBe(false);
    expect(explanation.reasons.some((item) => item.kind === 'lower_evidenced_cost')).toBe(false);
    if (explanation.status === 'explained') {
      expect(explanation.unknowns.some((item) => item.kind === 'missing_provider_quote')).toBe(true);
    } else {
      expect(explanation.summary).toMatch(/still comparing|still gathering/i);
    }
  });
});

describe('no fabricated claims or Wise-only logic', () => {
  it('never invents percentages, live pricing, or guaranteed settlement', () => {
    const decision = decideRoute(payment(), [{ route: WISE_AUD_IDR }, { route: OFX_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      settlementObservations: [settle(WISE_AUD_IDR, 'instant'), settle(OFX_AUD_IDR, 'multi_day')],
      availabilityObservations: [avail(WISE_AUD_IDR)],
      now: NOW,
    });
    const explanation = explainDecision(decision, decision.recommended?.route.offeringId ?? 'wise-international', 'Wise');
    expect(explanationContainsFabricatedClaim(explanation)).toBe(false);
    expect(JSON.stringify(explanation)).not.toMatch(/98%|live pricing|guaranteed settlement/i);
  });

  it('works for OFX without Wise-specific copy', () => {
    const decision = decideRoute(payment(), [{ route: OFX_AUD_IDR }], {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      now: NOW,
    });
    const explanation = explainDecision(decision, 'ofx-international', 'OFX');
    expect(explanation.displayedProviderName).toBe('OFX');
    expect(explanation.displayedOfferingId).toBe('ofx-international');
    expect(JSON.stringify(explanation)).not.toMatch(/Wise/);
  });
});

describe('public comparison boundary', () => {
  it('does not change ranking or fetch when explaining the public result', () => {
    const query = { ...DEFAULT_LANDING_SEARCH, destinationCurrency: 'IDR' };
    const before = compareLandingRoutes(query);
    const fetchSpy = jest.spyOn(global, 'fetch');
    const explanation = explainLandingRecommendation(before);
    const after = compareLandingRoutes(query);
    expect(after.offerings.map((item) => item.id)).toEqual(before.offerings.map((item) => item.id));
    expect(after.recommendedOffering.id).toBe(before.recommendedOffering.id);
    expect(rankLandingRoutes(query)[0]?.id).toBe('international_bank');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(explanation.displayedOfferingId).toBe(before.recommendedOffering.id);
  });

  it('is not imported by ranking or eligibility modules', () => {
    const files = [
      path.join(process.cwd(), 'lib/journey/landing-route-rank.ts'),
      path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/route-eligibility.ts'),
      path.join(process.cwd(), 'lib/route-intelligence/decide-route.ts'),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toContain('toRecommendationExplanation');
      expect(source).not.toContain('explainLandingRecommendation');
    }
    const comparison = fs.readFileSync(path.join(process.cwd(), 'lib/journey/landing-route-comparison.ts'), 'utf8');
    expect(comparison).not.toContain('decideRoute(');
  });
});
