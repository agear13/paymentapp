import validQuote from './fixtures/wise-quote-aud-idr.fixture.json';
import { parseWiseQuotePayload } from '@/lib/connected-intelligence/wise-quote-parse';

const EXPECTED = { sourceCurrency: 'AUD', destinationCurrency: 'IDR' };

describe('parseWiseQuotePayload', () => {
  it('parses an explicit AUD fee and AUD→IDR rate', () => {
    const result = parseWiseQuotePayload(validQuote, EXPECTED);
    expect(result).toEqual({
      ok: true,
      quote: {
        quoteId: 'quote-flagship-aud-idr',
        sourceAmount: 10000,
        sourceCurrency: 'AUD',
        destinationAmount: 124100000,
        destinationCurrency: 'IDR',
        exchangeRate: 12422.11,
        fee: { feeAmount: 12.4, feeCurrency: 'AUD', feeModel: 'fixed' },
        observedAt: '2026-09-11T01:00:00.000Z',
      },
    });
  });

  it('fails closed when the fee is missing', () => {
    const { paymentOptions: _ignored, ...withoutOptions } = validQuote;
    expect(parseWiseQuotePayload(withoutOptions, EXPECTED)).toEqual({
      ok: false,
      reason: 'missing_fee',
    });
  });

  it('fails closed when the fee is malformed', () => {
    expect(
      parseWiseQuotePayload(
        {
          ...validQuote,
          paymentOptions: [{ disabled: false, fee: { total: 'not-a-fee' } }],
        },
        EXPECTED
      )
    ).toEqual({ ok: false, reason: 'malformed_fee' });
  });

  it('fails closed when payment options disagree on fee', () => {
    expect(
      parseWiseQuotePayload(
        {
          ...validQuote,
          paymentOptions: [
            validQuote.paymentOptions[0],
            {
              ...validQuote.paymentOptions[0],
              fee: { ...validQuote.paymentOptions[0].fee, total: 40 },
            },
          ],
        },
        EXPECTED
      )
    ).toEqual({ ok: false, reason: 'ambiguous_fee' });
  });

  it('fails closed on a currency mismatch', () => {
    expect(parseWiseQuotePayload({ ...validQuote, targetCurrency: 'USD' }, EXPECTED)).toEqual({
      ok: false,
      reason: 'currency_mismatch',
    });
  });

  it('fails closed when the rate is missing', () => {
    const { rate: _rate, ...rest } = validQuote;
    expect(parseWiseQuotePayload(rest, EXPECTED)).toEqual({ ok: false, reason: 'incomplete_fx' });
  });
});
