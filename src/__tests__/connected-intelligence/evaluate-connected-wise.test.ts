import fs from 'fs';
import path from 'path';
import validQuote from './fixtures/wise-quote-aud-idr.fixture.json';
import { compareLandingRoutes, rankLandingRoutes } from '@/lib/journey/landing-route-comparison';
import { evaluateConnectedWiseFlagship } from '@/lib/connected-intelligence/evaluate-connected-wise';
import { FLAGSHIP_AMOUNT, flagshipWiseRouteSubject } from '@/lib/connected-intelligence/flagship-route';
import type { WiseIntelligenceConsentState } from '@/lib/connected-intelligence/types';
import { buildProviderFeeObservation } from '@/lib/route-intelligence/observation';
import { buildRouteFxObservation } from '@/lib/route-intelligence/economic-observation';
import { getRouteEconomicState } from '@/lib/route-intelligence/economic-state';
import { calculateTotalCost } from '@/lib/route-intelligence/total-cost';
import { decideRoute } from '@/lib/route-intelligence/decide-route';
import { flagshipDecisionPayment } from '@/lib/connected-intelligence/flagship-route';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const STALE_NOW = new Date('2026-09-14T00:00:01.000Z');

const FLAGSHIP_QUERY = {
  originCountry: 'AU' as const,
  destinationCountry: 'ID' as const,
  amount: FLAGSHIP_AMOUNT,
  currency: 'AUD' as const,
  destinationCurrency: 'IDR',
  transactionType: 'supplier_payment' as const,
  priority: 'lowest_cost' as const,
};

const RBA_FIXTURE = fs.readFileSync(
  [
    path.join(process.cwd(), '__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
    path.join(process.cwd(), 'src/__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
  ].find((candidate) => fs.existsSync(candidate)) ??
    path.join(process.cwd(), '__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
  'utf8'
);

function consented(orgId: string): WiseIntelligenceConsentState {
  return {
    organizationId: orgId,
    connected: true,
    profilePresent: true,
    consented: true,
    consentedAt: '2026-09-11T00:00:00.000Z',
    revokedAt: null,
  };
}

function unconsented(orgId: string, revoked = false): WiseIntelligenceConsentState {
  return {
    organizationId: orgId,
    connected: true,
    profilePresent: true,
    consented: false,
    consentedAt: null,
    revokedAt: revoked ? '2026-09-11T02:00:00.000Z' : null,
  };
}

describe('evaluateConnectedWiseFlagship', () => {
  it('blocks a fetch when intelligence consent is missing', async () => {
    const result = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => unconsented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote: jest.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'consent_required' });
  });

  it('blocks a fetch when intelligence consent was revoked', async () => {
    const result = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => unconsented('org-a', true),
      loadProfileId: async () => 'profile-a',
      requestQuote: jest.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'consent_revoked' });
  });

  it('does not call the Wise quote client without consent', async () => {
    const requestQuote = jest.fn();
    await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => unconsented('org-a'),
      requestQuote,
    });
    expect(requestQuote).not.toHaveBeenCalled();
  });

  it('returns known connected Wise economics with RBA reference on the same AUD→IDR pair', async () => {
    const result = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => consented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote: async () => ({ ok: true, payload: validQuote }),
      rbaPayload: RBA_FIXTURE,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.insight.wise.status).toBe('known');
    expect(result.insight.wise.rateKind).toBe('provider_quoted');
    expect(result.insight.wise.feeAmount).toBe(12.4);
    expect(result.insight.wise.exchangeRate).toBe(12422.11);
    expect(result.insight.reference.rateKind).toBe('mid_market_reference');
    expect(result.insight.reference.exchangeRate).toBe(12655);
    expect(result.insight.reference.exchangeRate).not.toBe(result.insight.wise.exchangeRate);
    expect(result.insight.totalCost.state).toBe('known');
    expect(result.insight.shadowMode).toBe('shadow');
    expect(result.insight.comparableProvidersUnknown).toBe(true);
    expect(result.insight.publicRankingUnchanged).toBe(true);
    expect(result.insight.publicRecommendedOfferingId).toBe('wise-international');
    expect(result.insight.interpretation.join(' ')).not.toMatch(/cheapest|switch to|better than OFX/i);
    expect(result.insight.interpretation.some((item) => item.includes('comparable customer-specific'))).toBe(
      true
    );
  });

  it('marks an old RBA reference as stale while keeping freshly fetched Wise economics known', async () => {
    const result = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => consented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote: async () => ({ ok: true, payload: validQuote }),
      rbaPayload: RBA_FIXTURE,
      now: STALE_NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insight.wise.status).toBe('known');
    expect(result.insight.totalCost.state).toBe('known');
    expect(result.insight.reference.status).toBe('stale');
  });

  it('fails closed when the Wise quote fee is missing', async () => {
    const { paymentOptions: _ignored, ...withoutFee } = validQuote;
    const result = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => consented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote: async () => ({ ok: true, payload: withoutFee }),
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.insight.wise.status).toBe('unknown');
    expect(result.insight.totalCost.state).toBe('unknown');
    expect(result.insight.totalCost.reason).toBe('missing_fee');
  });

  it('scopes quote reads to the requesting organisation profile', async () => {
    const requestQuote = jest.fn(async ({ profileId }: { profileId: string }) => ({
      ok: true as const,
      payload: { ...validQuote, id: `quote-${profileId}` },
    }));

    const orgA = await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => consented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote,
      rbaPayload: RBA_FIXTURE,
      now: NOW,
    });
    const orgB = await evaluateConnectedWiseFlagship('org-b', {
      readConsent: async () => consented('org-b'),
      loadProfileId: async () => 'profile-b',
      requestQuote,
      rbaPayload: RBA_FIXTURE,
      now: NOW,
    });

    expect(requestQuote).toHaveBeenCalledTimes(2);
    expect(requestQuote.mock.calls[0]?.[0]?.profileId).toBe('profile-a');
    expect(requestQuote.mock.calls[1]?.[0]?.profileId).toBe('profile-b');
    expect(orgA.ok && orgB.ok).toBe(true);
    if (!orgA.ok || !orgB.ok) return;
    expect(orgA.insight.wise.quoteId).toBe('quote-profile-a');
    expect(orgB.insight.wise.quoteId).toBe('quote-profile-b');
    expect(orgA.insight.organizationId).toBe('org-a');
    expect(orgB.insight.organizationId).toBe('org-b');
  });

  it('does not change the public AU→ID ranking while evaluating connected economics', async () => {
    const beforeRank = rankLandingRoutes(FLAGSHIP_QUERY).map((item) => item.id);
    const beforeCompare = compareLandingRoutes(FLAGSHIP_QUERY);

    await evaluateConnectedWiseFlagship('org-a', {
      readConsent: async () => consented('org-a'),
      loadProfileId: async () => 'profile-a',
      requestQuote: async () => ({ ok: true, payload: validQuote }),
      rbaPayload: RBA_FIXTURE,
      now: NOW,
    });

    const afterRank = rankLandingRoutes(FLAGSHIP_QUERY).map((item) => item.id);
    const afterCompare = compareLandingRoutes(FLAGSHIP_QUERY);
    expect(afterRank).toEqual(beforeRank);
    expect(afterCompare.recommendedOffering.id).toBe(beforeCompare.recommendedOffering.id);
    expect(afterCompare.offerings.map((item) => item.id)).toEqual(
      beforeCompare.offerings.map((item) => item.id)
    );
  });
});

describe('connected Wise economic state', () => {
  it('produces a known total cost only with complete provider fee and FX', () => {
    const route = flagshipWiseRouteSubject();
    const fetchedAt = NOW.toISOString();
    const fee = buildProviderFeeObservation({
      route,
      amount: FLAGSHIP_AMOUNT,
      sourceCurrency: 'AUD',
      feeAmount: 12.4,
      feeCurrency: 'AUD',
      feeModel: 'fixed',
      feePercent: null,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fee-hash',
    });
    const fx = buildRouteFxObservation({
      route,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      sourceAmount: FLAGSHIP_AMOUNT,
      destinationAmount: 124100000,
      exchangeRate: 12422.11,
      rateKind: 'provider_quoted',
      rateSource: 'wise_connected_quote',
      includesSpread: true,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fx-hash',
    });

    const economic = getRouteEconomicState(
      route,
      { feeObservations: [fee], fxObservations: [fx] },
      { now: NOW, amount: FLAGSHIP_AMOUNT }
    );
    expect(calculateTotalCost(economic).state).toBe('known');
  });

  it('keeps stale fee and FX evidence from producing a known total cost', () => {
    const route = flagshipWiseRouteSubject();
    const staleFetchedAt = '2026-09-11T01:00:00.000Z';
    const staleNow = new Date('2026-09-11T12:00:00.000Z');
    const fee = buildProviderFeeObservation({
      route,
      amount: FLAGSHIP_AMOUNT,
      sourceCurrency: 'AUD',
      feeAmount: 12.4,
      feeCurrency: 'AUD',
      feeModel: 'fixed',
      feePercent: null,
      observedAt: staleFetchedAt,
      fetchedAt: staleFetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fee-hash',
    });
    const fx = buildRouteFxObservation({
      route,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      sourceAmount: FLAGSHIP_AMOUNT,
      destinationAmount: 124100000,
      exchangeRate: 12422.11,
      rateKind: 'provider_quoted',
      rateSource: 'wise_connected_quote',
      includesSpread: true,
      observedAt: staleFetchedAt,
      fetchedAt: staleFetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fx-hash',
    });

    const economic = getRouteEconomicState(
      route,
      { feeObservations: [fee], fxObservations: [fx] },
      { now: staleNow, amount: FLAGSHIP_AMOUNT }
    );
    expect(calculateTotalCost(economic)).toEqual({ state: 'unknown', reason: 'stale_fee' });
  });

  it('rejects indicative FX as known provider economics', () => {
    const route = flagshipWiseRouteSubject();
    const fetchedAt = NOW.toISOString();
    const fee = buildProviderFeeObservation({
      route,
      amount: FLAGSHIP_AMOUNT,
      sourceCurrency: 'AUD',
      feeAmount: 12.4,
      feeCurrency: 'AUD',
      feeModel: 'fixed',
      feePercent: null,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fee-hash',
    });
    const indicativeFx = buildRouteFxObservation({
      route,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      sourceAmount: FLAGSHIP_AMOUNT,
      destinationAmount: 124100000,
      exchangeRate: 12422.11,
      rateKind: 'indicative',
      rateSource: 'catalog',
      includesSpread: null,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'catalog',
      sourceUrl: 'https://example.test/catalog',
      rawHash: 'fx-hash',
    });

    const economic = getRouteEconomicState(
      route,
      { feeObservations: [fee], fxObservations: [indicativeFx] },
      { now: NOW, amount: FLAGSHIP_AMOUNT }
    );
    expect(calculateTotalCost(economic)).toEqual({ state: 'unknown', reason: 'indicative_fx' });
  });
});

describe('connected Wise shadow decision', () => {
  it('feeds connected observations into decideRoute without changing public ranking inputs', () => {
    const route = flagshipWiseRouteSubject();
    const fetchedAt = NOW.toISOString();
    const fee = buildProviderFeeObservation({
      route,
      amount: FLAGSHIP_AMOUNT,
      sourceCurrency: 'AUD',
      feeAmount: 12.4,
      feeCurrency: 'AUD',
      feeModel: 'fixed',
      feePercent: null,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fee-hash',
    });
    const fx = buildRouteFxObservation({
      route,
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
      sourceAmount: FLAGSHIP_AMOUNT,
      destinationAmount: 124100000,
      exchangeRate: 12422.11,
      rateKind: 'provider_quoted',
      rateSource: 'wise_connected_quote',
      includesSpread: true,
      observedAt: '2026-09-11T01:00:00.000Z',
      fetchedAt,
      sourceId: 'wise_connected_quote',
      sourceUrl: 'https://wise.com',
      rawHash: 'fx-hash',
    });

    const decision = decideRoute(flagshipDecisionPayment(), [{ route }], {
      feeObservations: [fee],
      fxObservations: [fx],
      now: NOW,
    });
    expect(decision.mode).toBe('shadow');
    expect(decision.recommended?.economic.fee.state).toBe('known');
    expect(decision.recommended?.economic.fx.state).toBe('known');
    expect(decision.confidence.level).not.toBe('high');
  });
});
