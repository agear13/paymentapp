import type { LandingProviderOffering } from '@/lib/journey/landing-provider-catalog';

export type LandingPricingType = 'indicative' | 'live';
export type LandingAvailabilityType = 'typical' | 'live';

export type LandingResultPricing = {
  type: LandingPricingType;
  currency: string;
  amount: number | null;
  fee: number | null;
  fx: number | null;
  timestamp: string | null;
  totalLabel: string;
  feeLabel: string | null;
  fxLabel: string | null;
};

export type LandingResultAvailability = {
  type: LandingAvailabilityType;
};

export type LandingResultSource = {
  type: 'static_catalog' | 'provider_api';
  provider: string;
  retrievedAt: string | null;
};

const INDICATIVE_SPREAD = 0.3;

export function formatIndicativeMoney(amount: number, currency: string): string {
  const rounded = roundIndicative(amount);
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `~${currency} ${rounded}`;
  }
}

export function formatIndicativeRange(low: number, high: number, currency: string): string {
  const a = roundIndicative(Math.min(low, high));
  const b = roundIndicative(Math.max(low, high));
  if (a === b) return `~${formatIndicativeMoney(a, currency)}`;
  const start = formatIndicativeMoney(a, currency);
  const end = formatIndicativeMoney(b, currency).replace(/^[^\d-]+/, '');
  return `~${start}–${end}`;
}

export function roundIndicative(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount < 10) return Math.round(amount);
  if (amount < 100) return Math.round(amount / 5) * 5;
  if (amount < 500) return Math.round(amount / 10) * 10;
  return Math.round(amount / 25) * 25;
}

function bandFromPercent(percent: number, amount: number): { low: number; high: number; mid: number } {
  const mid = amount * (percent / 100);
  const low = amount * ((percent * (1 - INDICATIVE_SPREAD)) / 100);
  const high = amount * ((percent * (1 + INDICATIVE_SPREAD)) / 100);
  return { low, high, mid };
}

function bandFromFixed(fixed: number): { low: number; high: number; mid: number } {
  return {
    mid: fixed,
    low: fixed * 0.6,
    high: Math.max(fixed, fixed * 1.6),
  };
}

export function buildIndicativePricing(
  offering: LandingProviderOffering,
  amount: number,
  currency: string
): LandingResultPricing {
  const { fee } = offering;

  if (fee.model === 'qualitative') {
    return {
      type: 'indicative',
      currency,
      amount: null,
      fee: null,
      fx: null,
      timestamp: null,
      totalLabel: 'Indicative pricing',
      feeLabel: 'Typical provider fee',
      fxLabel: null,
    };
  }

  const percent = fee.percent ?? 0;
  const fixed = fee.fixed ?? 0;
  const percentBand = percent ? bandFromPercent(percent, amount) : { low: 0, high: 0, mid: 0 };
  const fixedBand = fixed ? bandFromFixed(fixed) : { low: 0, high: 0, mid: 0 };

  const treatsPercentAsFx =
    offering.providerType === 'fx_transfer' || offering.providerType === 'bank';
  const hasSeparateFee = Boolean(fixed) && treatsPercentAsFx;

  let feeLow = 0;
  let feeHigh = 0;
  let feeMid = 0;
  let fxLow = 0;
  let fxHigh = 0;
  let fxMid = 0;

  if (treatsPercentAsFx) {
    fxLow = percentBand.low;
    fxHigh = percentBand.high;
    fxMid = percentBand.mid;
    feeLow = fixedBand.low;
    feeHigh = fixedBand.high;
    feeMid = fixedBand.mid;
  } else {
    feeLow = percentBand.low + fixedBand.low;
    feeHigh = percentBand.high + fixedBand.high;
    feeMid = percentBand.mid + fixedBand.mid;
  }

  const totalLow = feeLow + fxLow;
  const totalHigh = feeHigh + fxHigh;
  const totalMid = Math.round(feeMid + fxMid);

  const showFx = fxHigh > 0;
  const showFee = feeHigh > 0 && (hasSeparateFee || !treatsPercentAsFx);

  return {
    type: 'indicative',
    currency,
    amount: totalMid,
    fee: showFee ? Math.round(feeMid) : null,
    fx: showFx ? Math.round(fxMid) : null,
    timestamp: null,
    totalLabel:
      totalHigh <= 0
        ? `~${formatIndicativeMoney(0, currency)}`
        : formatIndicativeRange(totalLow, totalHigh, currency),
    feeLabel: showFee ? `Fee ${formatIndicativeRange(feeLow, feeHigh, currency)}` : null,
    fxLabel: showFx ? `FX cost ${formatIndicativeRange(fxLow, fxHigh, currency)}` : null,
  };
}

export function buildTypicalAvailability(): LandingResultAvailability {
  return { type: 'typical' };
}

export function buildCatalogSource(providerName: string): LandingResultSource {
  return {
    type: 'static_catalog',
    provider: providerName,
    retrievedAt: null,
  };
}

export function pricingFreshnessLabel(pricing: LandingResultPricing): string {
  if (pricing.type === 'live' && pricing.timestamp) {
    return `Live · updated ${relativeTimestamp(pricing.timestamp)}`;
  }
  return 'Indicative';
}

export function relativeTimestamp(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'just now';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

export const INDICATIVE_ESTIMATE_COPY =
  "Indicative estimates based on the provider catalogue and typical route characteristics. They are not live quotes and may differ from the provider's current price.";
