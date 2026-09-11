export type WiseQuoteParseFailureReason =
  | 'malformed'
  | 'missing_fee'
  | 'malformed_fee'
  | 'ambiguous_fee'
  | 'currency_mismatch'
  | 'incomplete_fx'
  | 'incomplete_amounts';

export type ParsedWiseQuoteFee = {
  feeAmount: number;
  feeCurrency: string;
  feeModel: 'fixed';
};

export type ParsedWiseQuote = {
  quoteId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  exchangeRate: number;
  fee: ParsedWiseQuoteFee;
  observedAt: string;
};

export type WiseQuoteParseResult =
  | { ok: true; quote: ParsedWiseQuote }
  | { ok: false; reason: WiseQuoteParseFailureReason };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function quoteIdFrom(payload: Record<string, unknown>): string | null {
  if (typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  if (typeof payload.id === 'number' && Number.isFinite(payload.id)) return String(payload.id);
  if (typeof payload.uuid === 'string' && payload.uuid.trim()) return payload.uuid.trim();
  return null;
}

function feeFromOption(option: Record<string, unknown>, sourceCurrency: string): ParsedWiseQuoteFee | null {
  const fee = asRecord(option.fee);
  if (!fee) return null;
  const feeAmount = asFiniteNumber(fee.total);
  if (feeAmount === null || feeAmount < 0) return null;
  const declaredCurrency = fee.currency === undefined ? sourceCurrency : asCurrency(fee.currency);
  if (!declaredCurrency) return null;
  if (declaredCurrency !== sourceCurrency) return null;
  return { feeAmount, feeCurrency: declaredCurrency, feeModel: 'fixed' };
}

function enabledPaymentOptions(payload: Record<string, unknown>): Record<string, unknown>[] {
  const options = payload.paymentOptions;
  if (!Array.isArray(options)) return [];
  return options
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => {
      if (!item) return false;
      return item.disabled !== true;
    });
}

/**
 * Fail-closed parse of a Wise quote payload.
 * Does not invent fees, triangulate FX, or pick among unequal payment options.
 */
export function parseWiseQuotePayload(
  payload: unknown,
  expected: { sourceCurrency: string; destinationCurrency: string }
): WiseQuoteParseResult {
  const record = asRecord(payload);
  if (!record) return { ok: false, reason: 'malformed' };

  const sourceCurrency = asCurrency(record.sourceCurrency);
  const destinationCurrency = asCurrency(record.targetCurrency ?? record.destinationCurrency);
  if (!sourceCurrency || !destinationCurrency) return { ok: false, reason: 'currency_mismatch' };
  if (sourceCurrency !== expected.sourceCurrency.toUpperCase()) return { ok: false, reason: 'currency_mismatch' };
  if (destinationCurrency !== expected.destinationCurrency.toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  const sourceAmount = asFiniteNumber(record.sourceAmount);
  const destinationAmount = asFiniteNumber(record.targetAmount ?? record.destinationAmount);
  if (sourceAmount === null || sourceAmount <= 0 || destinationAmount === null || destinationAmount <= 0) {
    return { ok: false, reason: 'incomplete_amounts' };
  }

  const exchangeRate = asFiniteNumber(record.rate);
  if (exchangeRate === null || exchangeRate <= 0) return { ok: false, reason: 'incomplete_fx' };

  const quoteId = quoteIdFrom(record);
  if (!quoteId) return { ok: false, reason: 'malformed' };

  const options = enabledPaymentOptions(record);
  if (options.length === 0) return { ok: false, reason: 'missing_fee' };

  const fees = options.map((option) => feeFromOption(option, sourceCurrency));
  if (fees.some((fee) => fee === null)) return { ok: false, reason: 'malformed_fee' };
  const parsedFees = fees as ParsedWiseQuoteFee[];
  const first = parsedFees[0];
  if (
    parsedFees.some(
      (fee) => fee.feeAmount !== first.feeAmount || fee.feeCurrency !== first.feeCurrency
    )
  ) {
    return { ok: false, reason: 'ambiguous_fee' };
  }

  const observedAt =
    typeof record.createdTime === 'string' && !Number.isNaN(new Date(record.createdTime).getTime())
      ? new Date(record.createdTime).toISOString()
      : typeof record.created === 'string' && !Number.isNaN(new Date(record.created).getTime())
        ? new Date(record.created).toISOString()
        : null;
  if (!observedAt) return { ok: false, reason: 'malformed' };

  return {
    ok: true,
    quote: {
      quoteId,
      sourceAmount,
      sourceCurrency,
      destinationAmount,
      destinationCurrency,
      exchangeRate,
      fee: first,
      observedAt,
    },
  };
}
