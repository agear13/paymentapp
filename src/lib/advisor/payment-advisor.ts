import {

  compareLandingRoutes,

  LANDING_COMPARISON_DISCLAIMER,

  type LandingComparisonResult,

} from '@/lib/journey/landing-route-comparison';

import { explainLandingRecommendation } from '@/lib/journey/landing-recommendation-explanation';

import type { LandingProviderResult } from '@/lib/journey/landing-provider-search';

import { LANDING_PROVIDER_CATALOG_UPDATED } from '@/lib/journey/landing-provider-catalog';

import { PAYMENT_INTELLIGENCE_SNAPSHOT_DATE } from '@/lib/journey/payment-intelligence-feed';

import {

  getPublicRouteIntelligenceSnapshot,

  type PublicRouteIntelligenceSnapshotInput,

} from '@/lib/route-intelligence';

import {

  FLAGSHIP_ADVISOR_PAYMENT,

  parsePaymentAdvisorContext,

  resolveAdvisorParameterUsage,

  toLandingSearchQuery,

  type PaymentAdvisorPaymentContext,

  type PaymentAdvisorPaymentContextInput,

} from '@/lib/advisor/payment-advisor-context';

import {

  type PaymentAdvisorIntentId,

  resolvePaymentAdvisorIntent,

} from '@/lib/advisor/payment-advisor-intents';

import {

  buildAdvisorMonitoringSnapshot,

  formatMonitoringAnswer,

} from '@/lib/advisor/payment-advisor-monitoring';

import type {

  AdvisorDataFreshness,

  AdvisorOfferingSnapshot,

  AdvisorScenarioComparison,

  PaymentAdvisorResponse,

} from '@/lib/advisor/payment-advisor-types';



export type PaymentAdvisorAskInput = {

  intent?: string | null;

  question?: string | null;

  payment?: Partial<PaymentAdvisorPaymentContextInput> | null;

  intelligence?: PublicRouteIntelligenceSnapshotInput;

};



export type PaymentAdvisorAskResult = PaymentAdvisorResponse;



type AdvisorRunContext = {

  paymentContext: PaymentAdvisorPaymentContext;

  comparison: LandingComparisonResult;

  intelligence: PublicRouteIntelligenceSnapshotInput;

  dataFreshness: AdvisorDataFreshness;

};



function pricingKind(item: LandingProviderResult): AdvisorOfferingSnapshot['pricing']['kind'] {

  if (item.live) return 'live_connected';

  if (item.pricing.type === 'indicative') return 'indicative_catalogue';

  return 'unknown';

}



function toOfferingSnapshot(item: LandingProviderResult): AdvisorOfferingSnapshot {

  return {

    offeringId: item.id,

    providerId: item.offering.providerId,

    providerName: item.offering.providerName,

    productName: item.offering.productName,

    rank: item.rank,

    isRecommended: item.isRecommended,

    pricing: {

      kind: pricingKind(item),

      totalLabel: item.indicativeCostLabel,

      amount: item.indicativeCost,

      live: item.live,

      sourceType: item.source.type,

      retrievedAt: item.source.retrievedAt,

    },

    availability: {

      type: item.availability.type,

      provenance: item.availability.provenance,

    },

    whyShort: item.whyShort,

  };

}



function buildDataFreshness(

  intelligence: PublicRouteIntelligenceSnapshotInput,

  pricingKindValue: AdvisorOfferingSnapshot['pricing']['kind'],

  monitoringKind: AdvisorDataFreshness['monitoringKind']

): AdvisorDataFreshness {

  const snapshot = getPublicRouteIntelligenceSnapshot(intelligence);

  return {

    snapshotKind: snapshot.kind,

    catalogueUpdated: LANDING_PROVIDER_CATALOG_UPDATED,

    intelligenceSnapshotDate: PAYMENT_INTELLIGENCE_SNAPSHOT_DATE,

    pricingKind: pricingKindValue,

    monitoringKind,

    disclaimer: LANDING_COMPARISON_DISCLAIMER,

  };

}



function runAdvisorContext(

  paymentContext: PaymentAdvisorPaymentContext,

  intelligence: PublicRouteIntelligenceSnapshotInput

): AdvisorRunContext {

  const query = toLandingSearchQuery(paymentContext);

  const comparison = compareLandingRoutes(query, intelligence);

  const recommendedPricingKind = pricingKind(comparison.recommendedOffering);

  const monitoringKind =

    intelligence.wisePaymentsHealth?.kind === 'current' ? 'monitored_operational' : 'unavailable';



  return {

    paymentContext,

    comparison,

    intelligence,

    dataFreshness: buildDataFreshness(intelligence, recommendedPricingKind, monitoringKind),

  };

}



function baseResponse(

  intent: PaymentAdvisorIntentId,

  run: AdvisorRunContext,

  partial: Partial<PaymentAdvisorResponse>

): PaymentAdvisorResponse {

  const parameterUsage = resolveAdvisorParameterUsage(run.paymentContext);

  const recommended = toOfferingSnapshot(run.comparison.recommendedOffering);

  const alternatives = run.comparison.offerings

    .filter((item) => item.id !== run.comparison.recommendedOffering.id)

    .slice(0, 5)

    .map(toOfferingSnapshot);



  return {

    intent,

    paymentContext: run.paymentContext,

    parameterUsage,

    recommendation: recommended,

    alternatives,

    reasons: [],

    tradeoffs: [],

    unknowns: [],

    explanation: null,

    scenarioComparison: null,

    monitoring: null,

    evidence: [],

    dataFreshness: run.dataFreshness,

    answer: '',

    ...partial,

  };

}



function buildExplanation(run: AdvisorRunContext) {

  const snapshot = getPublicRouteIntelligenceSnapshot(run.intelligence);

  return explainLandingRecommendation(run.comparison, {

    capabilities: snapshot.capabilities,

    health: run.intelligence.wisePaymentsHealth,

    incidents: run.intelligence.wiseIncidents,

    now: run.intelligence.now,

  });

}



function formatExplanationAnswer(explanation: ReturnType<typeof buildExplanation>, disclaimer: string): string {

  const sections: string[] = [explanation.summary];



  if (explanation.confidence) {

    sections.push(`Confidence: ${explanation.confidence.label}.`);

  }

  if (explanation.reasons.length > 0) {

    sections.push('', 'Reasons:', ...explanation.reasons.map((item) => `- ${item.text}`));

  }

  if (explanation.tradeoffs.length > 0) {

    sections.push('', 'Trade-offs:', ...explanation.tradeoffs.map((item) => `- ${item.text}`));

  }

  if (explanation.unknowns.length > 0) {

    sections.push('', 'Unknowns:', ...explanation.unknowns.map((item) => `- ${item.text}`));

  }

  if (explanation.evidence.length > 0) {

    sections.push(

      '',

      'Evidence consulted:',

      ...explanation.evidence.map((item) => `- ${item.label} (${item.host})`)

    );

  }

  if (explanation.status !== 'explained') {

    sections.push(

      '',

      `Explanation status: ${explanation.status}. Provvy will not invent reasons beyond current route evidence.`

    );

  }

  sections.push('', disclaimer);

  return sections.join('\n');

}



function answerBestRailRecommendation(run: AdvisorRunContext): PaymentAdvisorResponse {

  const { comparison } = run;

  const recommended = toOfferingSnapshot(comparison.recommendedOffering);



  const lines = [

    comparison.headline,

    comparison.contextLine,

    comparison.recommendedWhy,

    '',

    `Recommended provider: ${recommended.providerName} (${recommended.productName}).`,

    `Indicative total (${recommended.pricing.kind.replace(/_/g, ' ')}): ${recommended.pricing.totalLabel}. ${recommended.whyShort}`,

    '',

    'Other routes considered:',

    ...run.comparison.offerings

      .filter((item) => item.id !== comparison.recommendedOffering.id)

      .slice(0, 3)

      .map(

        (item) =>

          `- ${item.offering.providerName} (${item.indicativeCostLabel}, rank ${item.rank}, ${pricingKind(item).replace(/_/g, ' ')}) — ${item.whyShort}`

      ),

    '',

    comparison.disclaimer,

  ];



  return baseResponse('best_rail_recommendation', run, {

    answer: lines.join('\n'),

  });

}



function answerExplainRecommendation(run: AdvisorRunContext): PaymentAdvisorResponse {

  const explanation = buildExplanation(run);



  return baseResponse('explain_recommendation', run, {

    reasons: explanation.reasons,

    tradeoffs: explanation.tradeoffs,

    unknowns: explanation.unknowns,

    evidence: explanation.evidence,

    explanation: {

      status: explanation.status,

      summary: explanation.summary,

      confidence: explanation.confidence,

      displayedOfferingId: explanation.displayedOfferingId,

      displayedProviderName: explanation.displayedProviderName,

    },

    answer: formatExplanationAnswer(explanation, run.comparison.disclaimer),

  });

}



function buildScenarioComparison(run: AdvisorRunContext): AdvisorScenarioComparison | null {

  const airwallexOffering =

    run.comparison.offerings.find((item) => item.offering.providerId === 'airwallex') ?? null;

  const recommended = toOfferingSnapshot(run.comparison.recommendedOffering);



  if (!airwallexOffering) {

    return {

      scenarioProviderId: 'airwallex',

      scenarioOffering: null,

      recommendedOffering: recommended,

      comparedOfferings: [],

      scenarioIsRecommended: false,

    };

  }



  const scenario = toOfferingSnapshot(airwallexOffering);

  const comparedIds = new Set([airwallexOffering.id, run.comparison.recommendedOffering.id]);

  const wise = run.comparison.offerings.find((item) => item.offering.providerId === 'wise');

  if (wise) comparedIds.add(wise.id);



  return {

    scenarioProviderId: 'airwallex',

    scenarioOffering: scenario,

    recommendedOffering: recommended,

    comparedOfferings: run.comparison.offerings

      .filter((item) => comparedIds.has(item.id))

      .map(toOfferingSnapshot),

    scenarioIsRecommended: airwallexOffering.id === run.comparison.recommendedOffering.id,

  };

}



function answerAirwallexScenarioComparison(run: AdvisorRunContext): PaymentAdvisorResponse {

  const scenarioComparison = buildScenarioComparison(run);

  const { comparison } = run;



  if (!scenarioComparison?.scenarioOffering) {

    return baseResponse('airwallex_scenario_comparison', run, {

      scenarioComparison,

      answer:

        'Airwallex is not in the eligible route set for this payment with current intelligence inputs.',

    });

  }



  const airwallex = scenarioComparison.scenarioOffering;

  const recommended = scenarioComparison.recommendedOffering;

  const wise = scenarioComparison.comparedOfferings.find((item) => item.providerId === 'wise');



  const lines = [

    `Scenario: ${comparison.contextLine}`,

    '',

    scenarioComparison.scenarioIsRecommended

      ? `Airwallex is the current recommendation (${airwallex.pricing.totalLabel}, ${airwallex.pricing.kind.replace(/_/g, ' ')}).`

      : `Airwallex ranks #${airwallex.rank} (${airwallex.pricing.totalLabel}) while ${recommended.providerName} is the current recommendation.`,

    `${airwallex.providerName}: ${airwallex.whyShort}`,

  ];



  if (wise) {

    lines.push(

      '',

      'Compared with Wise on the same inputs:',

      `- ${wise.providerName} (${wise.pricing.totalLabel}, rank ${wise.rank}, ${wise.pricing.kind.replace(/_/g, ' ')}) — ${wise.whyShort}`

    );

    if (

      airwallex.pricing.amount !== null &&

      wise.pricing.amount !== null &&

      airwallex.pricing.amount !== wise.pricing.amount

    ) {

      lines.push(

        `- Indicative catalogue total difference: ${Math.abs(airwallex.pricing.amount - wise.pricing.amount).toLocaleString('en-AU', { style: 'currency', currency: comparison.query.currency })} — not a live quote.`

      );

    } else {

      lines.push('- Indicative totals are catalogue-based; Provvy does not claim a live executable quote here.');

    }

  }



  lines.push(

    '',

    'What could change this comparison:',

    ...comparison.whatCouldChange.map((item) => `- ${item}`),

    '',

    comparison.disclaimer

  );



  return baseResponse('airwallex_scenario_comparison', run, {

    scenarioComparison,

    answer: lines.join('\n'),

  });

}



function answerWiseRailHealth(run: AdvisorRunContext): PaymentAdvisorResponse {

  const snapshot = getPublicRouteIntelligenceSnapshot(run.intelligence);

  const monitoring = buildAdvisorMonitoringSnapshot({

    health: run.intelligence.wisePaymentsHealth,

    paymentIncidents: snapshot.incidents,

    otherIncidents: snapshot.otherIncidents,

  });



  const wiseOffering = run.comparison.offerings.find((item) => item.offering.providerId === 'wise');

  const lines = [

    ...formatMonitoringAnswer(monitoring),

    '',

    'Active Wise payment incidents:',

    ...(monitoring.activePaymentIncidents.length > 0

      ? monitoring.activePaymentIncidents.map(

          (item) => `${item.title} — ${item.status}, ${item.impact}. ${item.description}`

        )

      : ['None attached to the current snapshot.']),

  ];



  if (monitoring.otherIncidents.length > 0) {

    lines.push('', 'Other Wise incidents:');

    lines.push(

      ...monitoring.otherIncidents.map(

        (item) => `${item.title} — ${item.status}, ${item.impact}. ${item.description}`

      )

    );

  }



  if (wiseOffering) {

    const snapshotOffering = toOfferingSnapshot(wiseOffering);

    lines.push(

      '',

      `Wise route on this payment (${run.comparison.contextLine}): rank #${snapshotOffering.rank}, availability ${snapshotOffering.availability.type} (${snapshotOffering.availability.provenance}).`

    );

    const eligibility = wiseOffering.operationalEligibility;

    if (eligibility) {

      const reasonText =

        eligibility.reasons.length > 0 ? eligibility.reasons.join(', ') : 'no eligibility flags';

      lines.push(`Operational eligibility: ${eligibility.status} (${reasonText}).`);

    }

  }



  lines.push(

    '',

    run.dataFreshness.snapshotKind === 'catalog_static'

      ? 'Monitoring note: catalogue-only until Wise observations are loaded.'

      : 'Monitoring note: catalogue plus attached Wise observations.',

    '',

    LANDING_COMPARISON_DISCLAIMER

  );



  return baseResponse('wise_rail_health', run, {

    monitoring,

    dataFreshness: {

      ...run.dataFreshness,

      monitoringKind: monitoring.status === 'current' ? 'monitored_operational' : 'unavailable',

    },

    answer: lines.join('\n'),

  });

}



export function answerPaymentAdvisorQuestion(

  input: PaymentAdvisorAskInput

): PaymentAdvisorAskResult | { error: string } {

  const intent = resolvePaymentAdvisorIntent(input);

  if (!intent) {

    return {

      error:

        'Provvy can answer the four demo payment-rail questions. Provide an intent plus optional structured payment parameters.',

    };

  }



  const parsed = parsePaymentAdvisorContext(input.payment);

  if (!parsed.ok) {

    return { error: parsed.error };

  }



  const intelligence = input.intelligence ?? {};

  const run = runAdvisorContext(parsed.context, intelligence);



  switch (intent) {

    case 'best_rail_recommendation':

      return answerBestRailRecommendation(run);

    case 'explain_recommendation':

      return answerExplainRecommendation(run);

    case 'airwallex_scenario_comparison':

      return answerAirwallexScenarioComparison(run);

    case 'wise_rail_health':

      return answerWiseRailHealth(run);

  }

}



export { FLAGSHIP_ADVISOR_PAYMENT };


