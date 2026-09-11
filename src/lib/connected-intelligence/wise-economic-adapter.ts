import { createHash } from 'crypto';
import { buildProviderFeeObservation } from '@/lib/route-intelligence/observation';
import { buildRouteFxObservation } from '@/lib/route-intelligence/economic-observation';
import type { ProviderFeeObservation, RouteFxObservation, RouteSubject } from '@/lib/route-intelligence/types';
import { flagshipWiseRouteSubject } from '@/lib/connected-intelligence/flagship-route';
import {
  parseWiseQuotePayload,
  type ParsedWiseQuote,
  type WiseQuoteParseResult,
} from '@/lib/connected-intelligence/wise-quote-parse';

export const WISE_CONNECTED_QUOTE_SOURCE_ID = 'wise_connected_quote';
/** Public product host — not the credentialed API and not a live quote URL. */
export const WISE_CONNECTED_QUOTE_SOURCE_URL = 'https://wise.com';

export type ConnectedWiseObservations = {
  route: RouteSubject;
  fee: ProviderFeeObservation;
  fx: RouteFxObservation;
  quoteId: string;
};

function evidenceHash(quote: ParsedWiseQuote): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        quoteId: quote.quoteId,
        sourceAmount: quote.sourceAmount,
        sourceCurrency: quote.sourceCurrency,
        destinationAmount: quote.destinationAmount,
        destinationCurrency: quote.destinationCurrency,
        exchangeRate: quote.exchangeRate,
        feeAmount: quote.fee.feeAmount,
        feeCurrency: quote.fee.feeCurrency,
      })
    )
    .digest('hex');
}

export function mapParsedWiseQuoteToObservations(
  quote: ParsedWiseQuote,
  fetchedAt: Date
): ConnectedWiseObservations {
  const route = flagshipWiseRouteSubject();
  const fetchedAtIso = fetchedAt.toISOString();
  const rawHash = evidenceHash(quote);

  const fee = buildProviderFeeObservation({
    route,
    amount: quote.sourceAmount,
    sourceCurrency: quote.sourceCurrency,
    feeAmount: quote.fee.feeAmount,
    feeCurrency: quote.fee.feeCurrency,
    feeModel: 'fixed',
    feePercent: null,
    observedAt: quote.observedAt,
    fetchedAt: fetchedAtIso,
    sourceId: WISE_CONNECTED_QUOTE_SOURCE_ID,
    sourceUrl: WISE_CONNECTED_QUOTE_SOURCE_URL,
    rawHash,
  });

  const fx = buildRouteFxObservation({
    route,
    sourceCurrency: quote.sourceCurrency,
    destinationCurrency: quote.destinationCurrency,
    sourceAmount: quote.sourceAmount,
    destinationAmount: quote.destinationAmount,
    exchangeRate: quote.exchangeRate,
    rateKind: 'provider_quoted',
    rateSource: WISE_CONNECTED_QUOTE_SOURCE_ID,
    includesSpread: true,
    observedAt: quote.observedAt,
    fetchedAt: fetchedAtIso,
    sourceId: WISE_CONNECTED_QUOTE_SOURCE_ID,
    sourceUrl: WISE_CONNECTED_QUOTE_SOURCE_URL,
    rawHash,
  });

  return { route, fee, fx, quoteId: quote.quoteId };
}

export function mapWiseQuotePayloadToObservations(
  payload: unknown,
  fetchedAt: Date,
  expected: { sourceCurrency: string; destinationCurrency: string }
): WiseQuoteParseResult & { observations?: ConnectedWiseObservations } {
  const parsed = parseWiseQuotePayload(payload, expected);
  if (!parsed.ok) return parsed;
  return {
    ...parsed,
    observations: mapParsedWiseQuoteToObservations(parsed.quote, fetchedAt),
  };
}
