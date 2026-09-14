import { compareLandingRoutes } from '@/lib/journey/landing-route-comparison';
import { explainLandingRecommendation } from '@/lib/journey/landing-recommendation-explanation';
import {
  evaluateLatestObservation,
  explanationContainsFabricatedClaim,
  observationStaleAfter,
} from '@/lib/route-intelligence';
import { type ProviderOperationalHealthObservation } from '@/lib/route-intelligence/types';
import { answerPaymentAdvisorQuestion } from '@/lib/advisor/payment-advisor';
import {
  FLAGSHIP_ADVISOR_PAYMENT,
  parsePaymentAdvisorContext,
  resolveAdvisorParameterUsage,
  toLandingSearchQuery as advisorToLandingSearchQuery,
} from '@/lib/advisor/payment-advisor-context';
import { resolvePaymentAdvisorIntent } from '@/lib/advisor/payment-advisor-intents';



const NOW = new Date('2026-09-10T15:00:00.000Z');



function wiseHealthObservation(): ProviderOperationalHealthObservation {

  const fetchedAt = '2026-09-10T14:00:00.000Z';

  return {

    observationType: 'provider_operational_health',

    subjectKind: 'provider_component',

    subjectId: 'wise:payments',

    providerId: 'wise',

    value: {

      pageIndicator: 'none',

      pageDescription: 'All Systems Operational',

      componentId: '2jxb8y760wrd',

      componentName: 'Payments',

      componentStatus: 'operational',

    },

    observedAt: '2026-09-10T13:09:10.107Z',

    fetchedAt,

    sourceId: 'wise_statuspage',

    sourceUrl: 'https://status.wise.com/api/v2/summary.json',

    provenance: 'externally_sourced',

    confidence: 'high',

    staleAfter: observationStaleAfter(fetchedAt).toISOString(),

    rawHash: 'abc',

    rawEvidence: {},

  };

}



function flagshipPayment(overrides: Record<string, unknown> = {}) {

  return {

    intent: 'best_rail_recommendation' as const,

    payment: {

      origin: FLAGSHIP_ADVISOR_PAYMENT.origin,

      destination: FLAGSHIP_ADVISOR_PAYMENT.destination,

      amount: FLAGSHIP_ADVISOR_PAYMENT.amount,

      sourceCurrency: FLAGSHIP_ADVISOR_PAYMENT.sourceCurrency,

      destinationCurrency: FLAGSHIP_ADVISOR_PAYMENT.destinationCurrency,

      priority: FLAGSHIP_ADVISOR_PAYMENT.priority,

      transactionType: FLAGSHIP_ADVISOR_PAYMENT.transactionType,

      ...overrides,

    },

  };

}



describe('payment advisor context', () => {

  it('defaults to the flagship AU→ID A$100k supplier payment', () => {

    const parsed = parsePaymentAdvisorContext();

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;

    expect(parsed.context).toEqual(FLAGSHIP_ADVISOR_PAYMENT);

  });



  it('maps balanced priority to engine best_fit', () => {

    const usage = resolveAdvisorParameterUsage({

      ...FLAGSHIP_ADVISOR_PAYMENT,

      priority: 'balanced',

    });

    expect(usage.enginePriority).toBe('best_fit');

    expect(usage.requestedPriority).toBe('balanced');

    expect(usage.contextualOnly).not.toContain('priority');

  });



  it('preserves reliability priority as contextual-only', () => {

    const usage = resolveAdvisorParameterUsage({

      ...FLAGSHIP_ADVISOR_PAYMENT,

      priority: 'reliability',

    });

    expect(usage.enginePriority).toBe('best_fit');

    expect(usage.requestedPriority).toBe('reliability');

    expect(usage.contextualOnly).toContain('priority');

  });

});



describe('resolvePaymentAdvisorIntent', () => {

  it('matches the flagship demo question', () => {

    expect(

      resolvePaymentAdvisorIntent({

        question: 'How should I pay my Indonesian supplier A$100,000?',

      })

    ).toBe('best_rail_recommendation');

  });

});



describe('answerPaymentAdvisorQuestion', () => {

  it('handles A$100k AU→ID and derives recommendation from compareLandingRoutes', () => {

    const parsed = parsePaymentAdvisorContext(flagshipPayment().payment);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;



    const query = advisorToLandingSearchQuery(parsed.context);

    const engine = compareLandingRoutes(query);



    const result = answerPaymentAdvisorQuestion(flagshipPayment());

    expect('error' in result).toBe(false);

    if ('error' in result) return;



    expect(result.paymentContext.amount).toBe(100_000);

    expect(result.paymentContext.destination).toBe('ID');

    expect(result.recommendation?.providerName).toBe(engine.recommendedOffering.offering.providerName);

    expect(result.recommendation?.offeringId).toBe(engine.recommendedOffering.id);

    expect(result.answer).toMatch(/100,000|100000/);

    expect(result.dataFreshness.pricingKind).toBe('indicative_catalogue');

  });



  it('changes indicative pricing when amount changes', () => {

    const low = answerPaymentAdvisorQuestion(

      flagshipPayment({ amount: 10_000 })

    );

    const high = answerPaymentAdvisorQuestion(

      flagshipPayment({ amount: 100_000 })

    );

    expect('error' in low).toBe(false);

    expect('error' in high).toBe(false);

    if ('error' in low || 'error' in high) return;



    expect(low.recommendation?.pricing.amount).not.toBeNull();

    expect(high.recommendation?.pricing.amount).not.toBeNull();

    expect(high.recommendation!.pricing.amount!).toBeGreaterThan(low.recommendation!.pricing.amount!);

  });



  it('passes priority through to the intelligence engine', () => {
    const balanced = answerPaymentAdvisorQuestion(flagshipPayment({ priority: 'balanced' }));
    const cheapest = answerPaymentAdvisorQuestion(flagshipPayment({ priority: 'lowest_cost' }));
    const fastest = answerPaymentAdvisorQuestion(flagshipPayment({ priority: 'fastest' }));

    expect('error' in balanced).toBe(false);
    expect('error' in cheapest).toBe(false);
    expect('error' in fastest).toBe(false);
    if ('error' in balanced || 'error' in cheapest || 'error' in fastest) return;

    expect(balanced.parameterUsage.enginePriority).toBe('best_fit');
    expect(cheapest.parameterUsage.enginePriority).toBe('lowest_cost');
    expect(fastest.parameterUsage.enginePriority).toBe('fastest');
    expect(balanced.recommendation?.offeringId).toBe(
      compareLandingRoutes(advisorToLandingSearchQuery(FLAGSHIP_ADVISOR_PAYMENT)).recommendedOffering.id
    );
    expect(fastest.recommendation?.offeringId).not.toBe(balanced.recommendation?.offeringId);
  });



  it('derives explanation reasons from RecommendationExplanation only', () => {

    const parsed = parsePaymentAdvisorContext(flagshipPayment().payment);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;



    const query = advisorToLandingSearchQuery(parsed.context);

    const comparison = compareLandingRoutes(query);

    const explanation = explainLandingRecommendation(comparison);



    const result = answerPaymentAdvisorQuestion({

      intent: 'explain_recommendation',

      payment: flagshipPayment().payment,

    });

    expect('error' in result).toBe(false);

    if ('error' in result) return;



    expect(result.reasons).toEqual(explanation.reasons);

    expect(result.tradeoffs).toEqual(explanation.tradeoffs);

    expect(result.unknowns).toEqual(explanation.unknowns);

    expect(result.evidence).toEqual(explanation.evidence);

    expect(explanationContainsFabricatedClaim({

      status: explanation.status,

      displayedOfferingId: explanation.displayedOfferingId,

      displayedProviderName: explanation.displayedProviderName,

      objective: explanation.objective,

      objectiveLabel: explanation.objectiveLabel,

      confidence: explanation.confidence,

      reasons: result.reasons,

      tradeoffs: result.tradeoffs,

      unknowns: result.unknowns,

      evidence: result.evidence,

      summary: result.explanation?.summary ?? '',

    })).toBe(false);

  });



  it('uses catalogue intelligence data for Airwallex scenario comparison', () => {

    const parsed = parsePaymentAdvisorContext(flagshipPayment().payment);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;



    const query = advisorToLandingSearchQuery(parsed.context);

    const comparison = compareLandingRoutes(query);

    const airwallex = comparison.offerings.find((item) => item.offering.providerId === 'airwallex');



    const result = answerPaymentAdvisorQuestion({

      intent: 'airwallex_scenario_comparison',

      payment: flagshipPayment().payment,

    });

    expect('error' in result).toBe(false);

    if ('error' in result || !airwallex) return;



    expect(result.scenarioComparison?.scenarioOffering?.pricing.kind).toBe('indicative_catalogue');

    expect(result.scenarioComparison?.scenarioOffering?.pricing.totalLabel).toBe(airwallex.indicativeCostLabel);

    expect(result.scenarioComparison?.scenarioOffering?.pricing.live).toBe(false);

    expect(result.answer).not.toMatch(/live quotes guaranteed|executable quote guaranteed/i);

  });



  it('reports unavailable monitoring honestly when no observation exists', () => {

    const result = answerPaymentAdvisorQuestion({

      intent: 'wise_rail_health',

      payment: flagshipPayment().payment,

    });

    expect('error' in result).toBe(false);

    if ('error' in result) return;



    expect(result.monitoring?.status).toBe('unavailable');

    expect(result.monitoring?.freshness.isStale).toBe(true);

    expect(result.monitoring?.source).toBeNull();

    expect(result.dataFreshness.monitoringKind).toBe('unavailable');

    expect(result.answer).not.toMatch(/real-time/i);

  });



  it('reports observation freshness without claiming real-time monitoring', () => {

    const result = answerPaymentAdvisorQuestion({

      intent: 'wise_rail_health',

      payment: flagshipPayment().payment,

      intelligence: {

        now: NOW,

        wisePaymentsHealth: evaluateLatestObservation(wiseHealthObservation(), NOW),

        wiseIncidents: [],

      },

    });

    expect('error' in result).toBe(false);

    if ('error' in result) return;



    expect(result.monitoring?.status).toBe('current');

    expect(result.monitoring?.freshness.maxAgeHours).toBe(3);

    expect(result.monitoring?.freshness.label).toMatch(/not real-time/i);

    expect(result.monitoring?.observedAt).toBe('2026-09-10T13:09:10.107Z');

    expect(result.dataFreshness.monitoringKind).toBe('monitored_operational');

  });



  it('reports stale monitoring when the observation is outside the freshness window', () => {

    const staleNow = new Date('2026-09-14T00:00:01.000Z');

    const result = answerPaymentAdvisorQuestion({

      intent: 'wise_rail_health',

      payment: flagshipPayment().payment,

      intelligence: {

        now: staleNow,

        wisePaymentsHealth: evaluateLatestObservation(wiseHealthObservation(), staleNow),

        wiseIncidents: [],

      },

    });

    expect('error' in result).toBe(false);

    if ('error' in result) return;



    expect(result.monitoring?.status).toBe('stale');

    expect(result.monitoring?.freshness.isStale).toBe(true);

    expect(result.monitoring?.freshness.label).toMatch(/stale/i);

  });



  it('returns guidance when the question does not match demo intents', () => {

    const result = answerPaymentAdvisorQuestion({ question: 'What is the weather?' });

    expect(result).toEqual(

      expect.objectContaining({

        error: expect.stringMatching(/four demo payment-rail questions/i),

      })

    );

  });

});


