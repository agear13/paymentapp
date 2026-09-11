import { createHash } from 'crypto';
import type {
  EconomicAdapterFailureReason,
  EconomicAdapterReadResult,
  EconomicSourceAdapter,
  EconomicSourceReadInput,
} from '@/lib/route-intelligence/economic-adapter';
import { buildRouteFxObservation } from '@/lib/route-intelligence/economic-observation';
import type { RouteFxObservation, RouteSubject } from '@/lib/route-intelligence/types';

/**
 * Official ECB euro foreign-exchange reference rates.
 * Daily TARGET-business-day publication. Not a provider quote and not AUD/IDR.
 */
export const ECB_EURO_FX_SOURCE_ID = 'ecb_euro_fx_ref';
export const ECB_EURO_FX_HOST = 'www.ecb.europa.eu';
export const ECB_EURO_FX_SOURCE_PATH = '/stats/eurofxref/eurofxref-daily.xml';
export const ECB_EURO_FX_SOURCE_URL = `https://${ECB_EURO_FX_HOST}${ECB_EURO_FX_SOURCE_PATH}`;
export const ECB_EURO_FX_FETCH_TIMEOUT_MS = 10_000;
export const ECB_EURO_FX_MAX_BODY_BYTES = 64 * 1024;
/** Daily official series: 72h covers a weekend without claiming intra-day freshness. */
export const ECB_EURO_FX_STALE_AFTER_MS = 72 * 60 * 60 * 1000;
export const ECB_EURO_FX_BASE_CURRENCY = 'EUR';

export const ECB_EURO_FX_WHAT_THIS_PROVES = [
  'ECB publishes a daily euro foreign-exchange reference rate against listed currencies.',
  'This is not a provider executable customer quote.',
  'This is not an AUD/IDR rate. AUD and IDR appear only as separate EUR crosses.',
  'This does not establish a payment corridor, network rail, fee, or settlement time.',
] as const;

export type EcbFxAdapterResult = EconomicAdapterReadResult<RouteFxObservation>;

type ParsedEcbDocument = {
  cubeTime: string;
  rates: ReadonlyMap<string, number>;
};

function normalizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function isAllowlistedEcbUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === ECB_EURO_FX_HOST &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === ECB_EURO_FX_SOURCE_PATH
    );
  } catch {
    return false;
  }
}

function looksLikeEcbEnvelope(xml: string): boolean {
  return (
    xml.includes('eurofxref') &&
    (xml.includes('gesmes:Envelope') || xml.includes('gesmes:Sender') || xml.includes('European Central Bank'))
  );
}

function parseCubeAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([A-Za-z_:][\w:.-]*)\s*=\s*(['"])(.*?)\2/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw))) {
    attrs[match[1]] = match[3];
  }
  return attrs;
}

function parseOfficialRate(raw: string): number | null {
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) return null;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function parseEcbDocument(payload: unknown): ParsedEcbDocument | null {
  if (typeof payload !== 'string' || !payload.trim() || !looksLikeEcbEnvelope(payload)) {
    return null;
  }

  const cubeRe = /<Cube\b([^>]*)\/?>/gi;
  const times = new Set<string>();
  const rates = new Map<string, number>();
  let cubeMatch: RegExpExecArray | null;

  while ((cubeMatch = cubeRe.exec(payload))) {
    const attrs = parseCubeAttributes(cubeMatch[1] ?? '');
    if (attrs.time) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(attrs.time)) return null;
      times.add(attrs.time);
    }
    if (attrs.currency || attrs.rate) {
      const currency = normalizeCurrency(attrs.currency);
      const rate = attrs.rate ? parseOfficialRate(attrs.rate) : null;
      if (!currency || rate === null) return null;
      const existing = rates.get(currency);
      if (existing !== undefined && existing !== rate) return null;
      rates.set(currency, rate);
    }
  }

  if (times.size !== 1 || rates.size === 0) return null;
  const cubeTime = [...times][0];
  if (!cubeTime) return null;
  return { cubeTime, rates };
}

export function ecbEuroFxStaleAfter(observedAt: Date | string): Date {
  const observed = typeof observedAt === 'string' ? new Date(observedAt) : observedAt;
  return new Date(observed.getTime() + ECB_EURO_FX_STALE_AFTER_MS);
}

function observedAtFromCubeDate(cubeTime: string): string | null {
  const observedAt = new Date(`${cubeTime}T00:00:00.000Z`);
  if (Number.isNaN(observedAt.getTime())) return null;
  return observedAt.toISOString();
}

function routeCurrencies(route: RouteSubject): {
  source: string | null;
  destination: string | null;
} {
  return {
    source: normalizeCurrency(route.currencyPair.source),
    destination: normalizeCurrency(route.currencyPair.target),
  };
}

/**
 * Deterministic parse of an official-source-shaped ECB document.
 * Emits only when the subject source currency is EUR and the target is listed.
 * Does not invert, triangulate, or invent a corridor/rail.
 */
export function parseEcbEuroFxObservation(
  payload: unknown,
  route: RouteSubject,
  fetchedAt: Date
): EcbFxAdapterResult {
  const { source, destination } = routeCurrencies(route);
  if (!source || !destination) {
    return { ok: false, reason: 'insufficient_route_dimensions' };
  }
  if (source !== ECB_EURO_FX_BASE_CURRENCY) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  const document = parseEcbDocument(payload);
  if (!document) {
    return { ok: false, reason: 'malformed' };
  }

  const exchangeRate = document.rates.get(destination);
  if (exchangeRate === undefined) {
    return { ok: false, reason: 'missing_rate' };
  }

  const observedAt = observedAtFromCubeDate(document.cubeTime);
  if (!observedAt) {
    return { ok: false, reason: 'malformed' };
  }

  const rawHash = createHash('sha256')
    .update(
      JSON.stringify({
        cubeTime: document.cubeTime,
        sourceCurrency: ECB_EURO_FX_BASE_CURRENCY,
        destinationCurrency: destination,
        exchangeRate,
      })
    )
    .digest('hex');

  const observation = buildRouteFxObservation({
    route,
    sourceCurrency: ECB_EURO_FX_BASE_CURRENCY,
    destinationCurrency: destination,
    sourceAmount: null,
    destinationAmount: null,
    exchangeRate,
    rateKind: 'mid_market_reference',
    rateSource: ECB_EURO_FX_SOURCE_ID,
    includesSpread: false,
    observedAt,
    fetchedAt: fetchedAt.toISOString(),
    sourceId: ECB_EURO_FX_SOURCE_ID,
    sourceUrl: ECB_EURO_FX_SOURCE_URL,
    provenance: 'externally_sourced',
    rawHash,
  });

  return {
    ok: true,
    observation: {
      ...observation,
      staleAfter: ecbEuroFxStaleAfter(observedAt).toISOString(),
    },
  };
}

function failureReasonFromError(error: unknown): Extract<EconomicAdapterFailureReason, 'timeout' | 'http_failure'> {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
    return 'timeout';
  }
  return 'http_failure';
}

export async function fetchEcbEuroFxDocument(input?: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}): Promise<
  | { ok: true; payload: string }
  | { ok: false; reason: Extract<EconomicAdapterFailureReason, 'http_failure' | 'timeout' | 'malformed'> }
> {
  const url = input?.url ?? ECB_EURO_FX_SOURCE_URL;
  if (!isAllowlistedEcbUrl(url)) {
    return { ok: false, reason: 'http_failure' };
  }

  const fetcher = input?.fetcher ?? fetch;
  const timeoutMs = input?.timeoutMs ?? ECB_EURO_FX_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: 'http_failure' };
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > ECB_EURO_FX_MAX_BODY_BYTES) {
      return { ok: false, reason: 'malformed' };
    }

    const payload = await response.text();
    if (Buffer.byteLength(payload, 'utf8') > ECB_EURO_FX_MAX_BODY_BYTES) {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, reason: failureReasonFromError(error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side official ECB read. Does not fabricate an observation on failure.
 */
export async function observeEcbEuroFx(
  input: EconomicSourceReadInput
): Promise<EcbFxAdapterResult> {
  const fetchedAt = input.now ?? new Date();
  if (input.payload !== undefined) {
    return parseEcbEuroFxObservation(input.payload, input.route, fetchedAt);
  }

  const fetched = await fetchEcbEuroFxDocument({
    fetcher: input.fetcher,
    timeoutMs: input.timeoutMs,
  });
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }
  return parseEcbEuroFxObservation(fetched.payload, input.route, fetchedAt);
}

export function createEcbEuroFxAdapter(): EconomicSourceAdapter {
  return {
    sourceId: ECB_EURO_FX_SOURCE_ID,
    sourceUrl: ECB_EURO_FX_SOURCE_URL,
    readFx: (input) => {
      if (input.payload === undefined) return null;
      const parsed = parseEcbEuroFxObservation(input.payload, input.route, input.now ?? new Date());
      return parsed.ok ? parsed.observation : null;
    },
    fetchFx: (input) => observeEcbEuroFx(input),
  };
}
