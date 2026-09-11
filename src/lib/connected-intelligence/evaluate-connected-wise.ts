import 'server-only';

import { compareLandingRoutes, DEFAULT_LANDING_SEARCH } from '@/lib/journey/landing-route-comparison';
import { CORRIDOR_CAPABILITY_MATRIX } from '@/lib/route-intelligence/capability-matrix';
import { decideRoute } from '@/lib/route-intelligence/decide-route';
import { getRouteEconomicState } from '@/lib/route-intelligence/economic-state';
import { isObservationFresh } from '@/lib/route-intelligence/observation';
import { observeRbaAudFx } from '@/lib/route-intelligence/rba-fx-adapter';
import { compareShadowDecision } from '@/lib/route-intelligence/shadow-compare';
import { calculateTotalCost } from '@/lib/route-intelligence/total-cost';
import type { RouteFxObservation } from '@/lib/route-intelligence/types';
import {
  canFetchConnectedWiseEconomics,
  readWiseIntelligenceConsent,
  type WiseIntelligenceConsentState,
} from '@/lib/connected-intelligence/consent';
import type { ConnectedWiseInsight } from '@/lib/connected-intelligence/types';

export type { ConnectedWiseInsight };
import { interpretConnectedWiseEconomics } from '@/lib/connected-intelligence/explanation';
import {
  FLAGSHIP_AMOUNT,
  FLAGSHIP_DESTINATION_CURRENCY,
  FLAGSHIP_SOURCE_CURRENCY,
  flagshipBankRouteSubject,
  flagshipDecisionPayment,
  flagshipOfxRouteSubject,
} from '@/lib/connected-intelligence/flagship-route';
import { mapWiseQuotePayloadToObservations } from '@/lib/connected-intelligence/wise-economic-adapter';
import { requestWiseFlagshipQuote } from '@/lib/connected-intelligence/wise-quote-client';
import { prisma } from '@/lib/server/prisma';

export type ConnectedWiseBlockedReason =
  | 'unauthenticated'
  | 'forbidden'
  | 'consent_required'
  | 'consent_revoked'
  | 'wise_not_connected'
  | 'missing_profile';

export type EvaluateConnectedWiseResult =
  | { ok: true; insight: ConnectedWiseInsight }
  | { ok: false; reason: ConnectedWiseBlockedReason | string };

export type EvaluateConnectedWiseDeps = {
  readConsent?: typeof readWiseIntelligenceConsent;
  loadProfileId?: (organizationId: string) => Promise<string | null>;
  requestQuote?: typeof requestWiseFlagshipQuote;
  observeReferenceFx?: typeof observeRbaAudFx;
  now?: Date;
  rbaPayload?: unknown;
};

const FLAGSHIP_QUERY = {
  ...DEFAULT_LANDING_SEARCH,
  originCountry: 'AU' as const,
  destinationCountry: 'ID' as const,
  amount: FLAGSHIP_AMOUNT,
  currency: 'AUD' as const,
  destinationCurrency: 'IDR',
  transactionType: 'supplier_payment' as const,
  priority: 'lowest_cost' as const,
};

async function defaultLoadProfileId(organizationId: string): Promise<string | null> {
  const row = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: { wise_profile_id: true },
  });
  return row?.wise_profile_id?.trim() || null;
}

function blockedByConsent(state: WiseIntelligenceConsentState): ConnectedWiseBlockedReason | null {
  if (!state.connected) return 'wise_not_connected';
  if (!state.profilePresent) return 'missing_profile';
  if (!state.consented) {
    return state.revokedAt ? 'consent_revoked' : 'consent_required';
  }
  return null;
}

function emptyWise(unknownReason: string | null, status: 'unknown' | 'unavailable' = 'unavailable') {
  return {
    status,
    quoteId: null,
    sourceAmount: null,
    destinationAmount: null,
    feeAmount: null,
    feeCurrency: null,
    exchangeRate: null,
    rateKind: null,
    fetchedAt: null,
    observedAt: null,
    unknownReason,
  } as ConnectedWiseInsight['wise'];
}

export async function evaluateConnectedWiseFlagship(
  organizationId: string,
  deps: EvaluateConnectedWiseDeps = {}
): Promise<EvaluateConnectedWiseResult> {
  const now = deps.now ?? new Date();
  const readConsent = deps.readConsent ?? readWiseIntelligenceConsent;
  const consent = await readConsent(organizationId);
  const blocked = blockedByConsent(consent);
  if (blocked) return { ok: false, reason: blocked };
  if (!canFetchConnectedWiseEconomics(consent)) {
    return { ok: false, reason: 'consent_required' };
  }

  const loadProfileId = deps.loadProfileId ?? defaultLoadProfileId;
  const profileId = await loadProfileId(organizationId);
  if (!profileId) return { ok: false, reason: 'missing_profile' };

  const requestQuote = deps.requestQuote ?? requestWiseFlagshipQuote;
  const quoteResult = await requestQuote({
    profileId,
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    targetCurrency: FLAGSHIP_DESTINATION_CURRENCY,
    sourceAmount: FLAGSHIP_AMOUNT,
  });
  if (!quoteResult.ok) {
    return { ok: false, reason: quoteResult.reason };
  }

  const mapped = mapWiseQuotePayloadToObservations(quoteResult.payload, now, {
    sourceCurrency: FLAGSHIP_SOURCE_CURRENCY,
    destinationCurrency: FLAGSHIP_DESTINATION_CURRENCY,
  });
  if (!mapped.ok || !mapped.observations) {
    const publicResult = compareLandingRoutes(FLAGSHIP_QUERY);
    const interpretation = interpretConnectedWiseEconomics({
      wiseRate: null,
      referenceRate: null,
      feeAmount: null,
      feeCurrency: null,
      totalCost: { state: 'unknown', reason: 'missing_fee' },
      comparableProvidersUnknown: true,
    });
    return {
      ok: true,
      insight: {
        organizationId,
        corridor: { origin: 'AU', destination: 'ID' },
        currencyPair: { source: 'AUD', target: 'IDR' },
        amount: FLAGSHIP_AMOUNT,
        wise: emptyWise(mapped.ok ? 'incomplete' : mapped.reason, 'unknown'),
        reference: {
          status: 'unavailable',
          exchangeRate: null,
          rateKind: 'mid_market_reference',
          label: 'RBA official AUD reference',
          observedAt: null,
        },
        totalCost: {
          state: 'unknown',
          sourceAmount: null,
          explicitFeeAmount: null,
          destinationAmount: null,
          effectiveRate: null,
          reason: mapped.ok ? 'incomplete_fee' : mapped.reason,
        },
        interpretation: interpretation.statements,
        unknowns: interpretation.unknowns,
        comparableProvidersUnknown: true,
        publicRankingUnchanged: true,
        publicRecommendedOfferingId: publicResult.recommendedOffering.id,
        shadowMode: 'shadow',
      },
    };
  }

  const { fee, fx, quoteId, route } = mapped.observations;
  const observeReferenceFx = deps.observeReferenceFx ?? observeRbaAudFx;
  const referenceResult = await observeReferenceFx({
    route,
    now,
    payload: deps.rbaPayload,
  });
  const referenceObservation: RouteFxObservation | null = referenceResult.ok
    ? referenceResult.observation
    : null;

  const economic = getRouteEconomicState(
    route,
    { feeObservations: [fee], fxObservations: [fx] },
    { now, amount: FLAGSHIP_AMOUNT }
  );
  const totalCost = calculateTotalCost(economic);

  const publicResult = compareLandingRoutes(FLAGSHIP_QUERY);
  const decision = decideRoute(
    flagshipDecisionPayment(),
    [{ route }, { route: flagshipOfxRouteSubject() }, { route: flagshipBankRouteSubject() }],
    {
      capabilities: CORRIDOR_CAPABILITY_MATRIX,
      feeObservations: [fee],
      fxObservations: [fx],
      now,
    }
  );
  compareShadowDecision(
    {
      recommendedOfferingId: publicResult.recommendedOffering.id,
      orderedOfferingIds: publicResult.offerings.map((item) => item.id),
    },
    decision
  );

  const referenceStatus: ConnectedWiseInsight['reference']['status'] = !referenceObservation
    ? 'unavailable'
    : isObservationFresh(referenceObservation, now)
      ? 'known'
      : 'stale';

  const interpretation = interpretConnectedWiseEconomics({
    wiseRate: fx.value.exchangeRate,
    referenceRate: referenceObservation?.value.exchangeRate ?? null,
    feeAmount: fee.value.feeAmount,
    feeCurrency: fee.value.feeCurrency,
    totalCost,
    comparableProvidersUnknown: true,
  });

  return {
    ok: true,
    insight: {
      organizationId,
      corridor: { origin: 'AU', destination: 'ID' },
      currencyPair: { source: 'AUD', target: 'IDR' },
      amount: FLAGSHIP_AMOUNT,
      wise: {
        status: totalCost.state === 'known' ? 'known' : 'unknown',
        quoteId,
        sourceAmount: fx.value.sourceAmount,
        destinationAmount: fx.value.destinationAmount,
        feeAmount: fee.value.feeAmount,
        feeCurrency: fee.value.feeCurrency,
        exchangeRate: fx.value.exchangeRate,
        rateKind: 'provider_quoted',
        fetchedAt: fx.fetchedAt,
        observedAt: fx.observedAt,
        unknownReason: totalCost.state === 'known' ? null : totalCost.reason,
      },
      reference: {
        status: referenceStatus,
        exchangeRate: referenceObservation?.value.exchangeRate ?? null,
        rateKind: 'mid_market_reference',
        label: 'RBA official AUD reference',
        observedAt: referenceObservation?.observedAt ?? null,
      },
      totalCost: {
        state: totalCost.state,
        sourceAmount: totalCost.state === 'known' ? totalCost.sourceAmount : FLAGSHIP_AMOUNT,
        explicitFeeAmount: totalCost.state === 'known' ? totalCost.explicitFeeAmount : fee.value.feeAmount,
        destinationAmount: totalCost.state === 'known' ? totalCost.destinationAmount : null,
        effectiveRate: totalCost.state === 'known' ? totalCost.effectiveRate : null,
        reason: totalCost.state === 'known' ? null : totalCost.reason,
      },
      interpretation: interpretation.statements,
      unknowns: interpretation.unknowns,
      comparableProvidersUnknown: true,
      publicRankingUnchanged: true,
      publicRecommendedOfferingId: publicResult.recommendedOffering.id,
      shadowMode: decision.mode,
    },
  };
}
