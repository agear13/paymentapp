import fs from 'fs';
import path from 'path';
import validQuote from './fixtures/wise-quote-aud-idr.fixture.json';
import { flagshipWiseRouteSubject } from '@/lib/connected-intelligence/flagship-route';
import { mapWiseQuotePayloadToObservations } from '@/lib/connected-intelligence/wise-economic-adapter';
import { parseRbaAudFxObservation } from '@/lib/route-intelligence/rba-fx-adapter';
import { routeSubjectKey } from '@/lib/route-intelligence/route-subject';

const FETCHED_AT = new Date('2026-09-11T01:30:00.000Z');
const RBA_FIXTURE = fs.readFileSync(
  [
    path.join(process.cwd(), '__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
    path.join(process.cwd(), 'src/__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
  ].find((candidate) => fs.existsSync(candidate)) ??
    path.join(process.cwd(), '__tests__/route-intelligence/fixtures/rba-rss-cb-exchange-rates.fixture.xml'),
  'utf8'
);

describe('mapWiseQuotePayloadToObservations', () => {
  it('maps a valid Wise quote onto the flagship RouteSubject', () => {
    const mapped = mapWiseQuotePayloadToObservations(validQuote, FETCHED_AT, {
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok || !mapped.observations) return;

    const { route, fee, fx } = mapped.observations;
    expect(route.providerId).toBe('wise');
    expect(route.offeringId).toBe('wise-international');
    expect(route.mechanismId).toBe('international_bank');
    expect(route.corridor).toEqual({ origin: 'AU', destination: 'ID' });
    expect(route.currencyPair).toEqual({ source: 'AUD', target: 'IDR' });
    expect(route.networkRail).toBe('unknown');
    expect(routeSubjectKey(route)).toBe(routeSubjectKey(flagshipWiseRouteSubject()));

    expect(fee.observationType).toBe('provider_fee_observation');
    expect(fee.value.feeAmount).toBe(12.4);
    expect(fee.value.feeCurrency).toBe('AUD');
    expect(fee.value.feeModel).toBe('fixed');
    expect(fee.provenance).toBe('externally_sourced');

    expect(fx.observationType).toBe('route_fx_observation');
    expect(fx.value.rateKind).toBe('provider_quoted');
    expect(fx.value.exchangeRate).toBe(12422.11);
    expect(fx.value.includesSpread).toBe(true);
  });

  it('keeps the Wise quote distinct from the RBA mid-market reference', () => {
    const mapped = mapWiseQuotePayloadToObservations(validQuote, FETCHED_AT, {
      sourceCurrency: 'AUD',
      destinationCurrency: 'IDR',
    });
    expect(mapped.ok).toBe(true);
    if (!mapped.ok || !mapped.observations) return;
    const rba = parseRbaAudFxObservation(RBA_FIXTURE, mapped.observations.route, FETCHED_AT);
    expect(rba.ok).toBe(true);
    if (!rba.ok) return;
    expect(rba.observation.value.rateKind).toBe('mid_market_reference');
    expect(mapped.observations.fx.value.rateKind).toBe('provider_quoted');
    expect(mapped.observations.fx.value.exchangeRate).not.toBe(rba.observation.value.exchangeRate);
    expect(mapped.observations.fx.sourceId).not.toBe(rba.observation.sourceId);
  });
});
