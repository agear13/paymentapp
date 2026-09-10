import type { RouteEconomicState, TotalCostResult } from '@/lib/route-intelligence/types';

function sameCurrency(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.trim().toUpperCase() === right.trim().toUpperCase());
}

/**
 * Deterministic total-cost foundation.
 * Does not invent missing fees or FX.
 * Refuses to compute when provider-quoted FX may already include spread
 * that would be double-counted with a percentage markup.
 */
export function calculateTotalCost(state: RouteEconomicState): TotalCostResult {
  const sourceAmount = state.amount;
  if (sourceAmount === null || !Number.isFinite(sourceAmount)) {
    return { state: 'unknown', reason: 'missing_source_amount' };
  }

  const feeFact = state.fee;
  if (feeFact.state === 'stale') return { state: 'unknown', reason: 'stale_fee' };
  if (feeFact.state === 'unavailable') return { state: 'unknown', reason: 'unavailable_fee' };
  if (feeFact.state === 'unknown') return { state: 'unknown', reason: 'unknown_fee' };
  const fee = feeFact.observation?.value;
  if (!fee) return { state: 'unknown', reason: 'missing_fee' };

  const sourceCurrency = state.route.currencyPair.source ?? fee.sourceCurrency;
  const destinationCurrency = state.route.currencyPair.target;
  if (!sourceCurrency) return { state: 'unknown', reason: 'currency_mismatch' };

  const domestic = sameCurrency(sourceCurrency, destinationCurrency);

  let explicitFeeAmount: number | null = null;
  if (fee.feeModel === 'fixed' && fee.feeAmount !== null) {
    explicitFeeAmount = fee.feeAmount;
  } else if (fee.feeModel === 'percentage' && fee.feePercent !== null) {
    explicitFeeAmount = sourceAmount * (fee.feePercent / 100);
  } else if (fee.feeModel === 'tiered') {
    return { state: 'unknown', reason: 'incomplete_fee' };
  } else if (fee.feeAmount !== null) {
    explicitFeeAmount = fee.feeAmount;
  } else {
    return { state: 'unknown', reason: 'incomplete_fee' };
  }

  const feeCurrency = fee.feeCurrency ?? sourceCurrency;
  if (!sameCurrency(feeCurrency, sourceCurrency)) {
    return { state: 'unknown', reason: 'currency_mismatch' };
  }

  if (domestic) {
    return {
      state: 'known',
      sourceAmount,
      sourceCurrency,
      explicitFeeAmount,
      explicitFeeCurrency: feeCurrency,
      destinationAmount: sourceAmount - explicitFeeAmount,
      destinationCurrency: destinationCurrency ?? sourceCurrency,
      effectiveRate: 1,
      method: 'same_currency_net',
    };
  }

  const fxFact = state.fx;
  if (fxFact.state === 'stale') return { state: 'unknown', reason: 'stale_fx' };
  if (fxFact.state === 'unavailable') return { state: 'unknown', reason: 'unavailable_fx' };
  if (fxFact.state === 'unknown') return { state: 'unknown', reason: 'unknown_fx' };
  const fx = fxFact.observation?.value;
  if (!fx) return { state: 'unknown', reason: 'missing_fx' };
  if (fx.rateKind === 'indicative') return { state: 'unknown', reason: 'indicative_fx' };
  if (fx.exchangeRate === null || !Number.isFinite(fx.exchangeRate) || fx.exchangeRate <= 0) {
    return { state: 'unknown', reason: 'incomplete_fx' };
  }
  if (
    (fx.sourceCurrency && !sameCurrency(fx.sourceCurrency, sourceCurrency)) ||
    (fx.destinationCurrency && destinationCurrency && !sameCurrency(fx.destinationCurrency, destinationCurrency))
  ) {
    return { state: 'unknown', reason: 'currency_mismatch' };
  }
  if (!destinationCurrency) return { state: 'unknown', reason: 'currency_mismatch' };

  const percentMarkup = fee.feeModel === 'percentage' && fee.feePercent !== null;
  if (fx.includesSpread === true && percentMarkup) {
    return { state: 'unknown', reason: 'double_count_risk' };
  }
  if (fx.includesSpread === null && fx.rateKind === 'provider_quoted' && percentMarkup) {
    return { state: 'unknown', reason: 'double_count_risk' };
  }

  const destinationAmount = (sourceAmount - explicitFeeAmount) * fx.exchangeRate;
  return {
    state: 'known',
    sourceAmount,
    sourceCurrency,
    explicitFeeAmount,
    explicitFeeCurrency: feeCurrency,
    destinationAmount,
    destinationCurrency,
    effectiveRate: destinationAmount / sourceAmount,
    method: 'source_fee_then_convert',
  };
}
