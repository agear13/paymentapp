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
 * Official RBA daily exchange rates (units of foreign currency per AUD).
 * Not a provider quote and not an executable customer rate.
 */
export const RBA_AUD_FX_SOURCE_ID = 'rba_aud_fx_ref';
export const RBA_AUD_FX_HOST = 'www.rba.gov.au';
export const RBA_AUD_FX_SOURCE_PATH = '/rss/rss-cb-exchange-rates.xml';
export const RBA_AUD_FX_SOURCE_URL = `https://${RBA_AUD_FX_HOST}${RBA_AUD_FX_SOURCE_PATH}`;
export const RBA_AUD_FX_FETCH_TIMEOUT_MS = 10_000;
export const RBA_AUD_FX_MAX_BODY_BYTES = 256 * 1024;
/** Daily official series: 72h covers a weekend without claiming intra-day freshness. */
export const RBA_AUD_FX_STALE_AFTER_MS = 72 * 60 * 60 * 1000;
export const RBA_AUD_FX_BASE_CURRENCY = 'AUD';

export const RBA_AUD_FX_WHAT_THIS_PROVES = [
  'RBA publishes a daily Australian-dollar foreign-exchange reference rate against listed currencies, including IDR.',
  'This is not a provider executable customer quote.',
  'This does not establish a payment corridor, network rail, fee, or settlement time.',
  'This must not be triangulated with ECB euro crosses.',
] as const;

export type RbaFxAdapterResult = EconomicAdapterReadResult<RouteFxObservation>;

type ParsedRbaDocument = {
  period: string;
  rates: ReadonlyMap<string, number>;
};

function normalizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function isAllowlistedRbaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === RBA_AUD_FX_HOST &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === RBA_AUD_FX_SOURCE_PATH
    );
  } catch {
    return false;
  }
}

function looksLikeRbaDocument(xml: string): boolean {
  return (
    xml.includes('rba.gov.au') &&
    (xml.includes('cb:exchangeRate') || xml.includes('exchangeRate')) &&
    (xml.includes('cb:targetCurrency') || xml.includes('targetCurrency'))
  );
}

function innerText(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${tag}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const text = match[1]?.replace(/<[^>]+>/g, '').trim();
    if (text) values.push(text);
  }
  return values;
}

function parseOfficialRate(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(cleaned)) return null;
  const rate = Number(cleaned);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function parseRbaDocument(payload: unknown): ParsedRbaDocument | null {
  if (typeof payload !== 'string' || !payload.trim() || !looksLikeRbaDocument(payload)) {
    return null;
  }

  const itemRe = /<(?:[A-Za-z0-9_]+:)?item\b[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?item>/gi;
  const items = payload.match(itemRe) ?? [];
  if (items.length === 0) return null;

  const rates = new Map<string, number>();
  const periods = new Set<string>();

  for (const item of items) {
    const bases = innerText(item, 'baseCurrency').map(normalizeCurrency);
    const base = bases[0] ?? RBA_AUD_FX_BASE_CURRENCY;
    if (base !== RBA_AUD_FX_BASE_CURRENCY) continue;

    const target = normalizeCurrency(innerText(item, 'targetCurrency')[0]);
    const value = parseOfficialRate(innerText(item, 'value')[0] ?? '');
    const period = innerText(item, 'period')[0];
    if (!target || value === null || !period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      return null;
    }
    const existing = rates.get(target);
    if (existing !== undefined && existing !== value) return null;
    rates.set(target, value);
    periods.add(period);
  }

  if (periods.size !== 1 || rates.size === 0) return null;
  const period = [...periods][0];
  if (!period) return null;
  return { period, rates };
}

export function rbaAudFxStaleAfter(observedAt: Date | string): Date {
  const observed = typeof observedAt === 'string' ? new Date(observedAt) : observedAt;
  return new Date(observed.getTime() + RBA_AUD_FX_STALE_AFTER_MS);
}

function observedAtFromPeriod(period: string): string | null {
  const observedAt = new Date(`${period}T00:00:00.000Z`);
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
 * Deterministic parse of an official-source-shaped RBA RSS-CB document.
 * Emits only when the subject source currency is AUD and the target is listed.
 * Does not invert, triangulate, or invent a corridor/rail.
 */
export function parseRbaAudFxObservation(
  payload: unknown,
  route: RouteSubject,
  fetchedAt: Date
): RbaFxAdapterResult {
  const { source, destination } = routeCurrencies(route);
  if (!source || !destination) {
    return { ok: false, reason: 'insufficient_route_dimensions' };
  }
  if (source !== RBA_AUD_FX_BASE_CURRENCY) {
    return { ok: false, reason: 'currency_mismatch' };
  }

  const document = parseRbaDocument(payload);
  if (!document) {
    return { ok: false, reason: 'malformed' };
  }

  const exchangeRate = document.rates.get(destination);
  if (exchangeRate === undefined) {
    return { ok: false, reason: 'missing_rate' };
  }

  const observedAt = observedAtFromPeriod(document.period);
  if (!observedAt) {
    return { ok: false, reason: 'malformed' };
  }

  const rawHash = createHash('sha256')
    .update(
      JSON.stringify({
        period: document.period,
        sourceCurrency: RBA_AUD_FX_BASE_CURRENCY,
        destinationCurrency: destination,
        exchangeRate,
      })
    )
    .digest('hex');

  const observation = buildRouteFxObservation({
    route,
    sourceCurrency: RBA_AUD_FX_BASE_CURRENCY,
    destinationCurrency: destination,
    sourceAmount: null,
    destinationAmount: null,
    exchangeRate,
    rateKind: 'mid_market_reference',
    rateSource: RBA_AUD_FX_SOURCE_ID,
    includesSpread: false,
    observedAt,
    fetchedAt: fetchedAt.toISOString(),
    sourceId: RBA_AUD_FX_SOURCE_ID,
    sourceUrl: RBA_AUD_FX_SOURCE_URL,
    provenance: 'externally_sourced',
    rawHash,
  });

  return {
    ok: true,
    observation: {
      ...observation,
      staleAfter: rbaAudFxStaleAfter(observedAt).toISOString(),
    },
  };
}

function failureReasonFromError(error: unknown): Extract<EconomicAdapterFailureReason, 'timeout' | 'http_failure'> {
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
    return 'timeout';
  }
  return 'http_failure';
}

export async function fetchRbaAudFxDocument(input?: {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  url?: string;
}): Promise<
  | { ok: true; payload: string }
  | { ok: false; reason: Extract<EconomicAdapterFailureReason, 'http_failure' | 'timeout' | 'malformed'> }
> {
  const url = input?.url ?? RBA_AUD_FX_SOURCE_URL;
  if (!isAllowlistedRbaUrl(url)) {
    return { ok: false, reason: 'http_failure' };
  }

  const fetcher = input?.fetcher ?? fetch;
  const timeoutMs = input?.timeoutMs ?? RBA_AUD_FX_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, reason: 'http_failure' };
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > RBA_AUD_FX_MAX_BODY_BYTES) {
      return { ok: false, reason: 'malformed' };
    }

    const payload = await response.text();
    if (Buffer.byteLength(payload, 'utf8') > RBA_AUD_FX_MAX_BODY_BYTES) {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, reason: failureReasonFromError(error) };
  } finally {
    clearTimeout(timer);
  }
}

export async function observeRbaAudFx(input: EconomicSourceReadInput): Promise<RbaFxAdapterResult> {
  const fetchedAt = input.now ?? new Date();
  if (input.payload !== undefined) {
    return parseRbaAudFxObservation(input.payload, input.route, fetchedAt);
  }

  const fetched = await fetchRbaAudFxDocument({
    fetcher: input.fetcher,
    timeoutMs: input.timeoutMs,
  });
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason };
  }
  return parseRbaAudFxObservation(fetched.payload, input.route, fetchedAt);
}

export function createRbaAudFxAdapter(): EconomicSourceAdapter {
  return {
    sourceId: RBA_AUD_FX_SOURCE_ID,
    sourceUrl: RBA_AUD_FX_SOURCE_URL,
    readFx: (input) => {
      if (input.payload === undefined) return null;
      const parsed = parseRbaAudFxObservation(input.payload, input.route, input.now ?? new Date());
      return parsed.ok ? parsed.observation : null;
    },
    fetchFx: (input) => observeRbaAudFx(input),
  };
}
