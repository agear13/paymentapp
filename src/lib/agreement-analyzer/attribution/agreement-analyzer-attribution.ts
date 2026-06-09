import type {
  AgreementAnalyzerAttribution,
  AgreementAnalyzerAttributionInput,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution-types';

const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const MAX_FIELD_LENGTH = 255;
const MAX_TEXT_LENGTH = 2048;

function trimToMax(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function parseUtmSearchParams(
  searchParams: URLSearchParams
): Pick<
  AgreementAnalyzerAttribution,
  'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'
> {
  const parsed = {} as Pick<
    AgreementAnalyzerAttribution,
    'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'
  >;

  for (const key of UTM_PARAM_KEYS) {
    parsed[key] = trimToMax(searchParams.get(key), MAX_FIELD_LENGTH);
  }

  return parsed;
}

export function normalizeAgreementAnalyzerAttribution(
  input: AgreementAnalyzerAttributionInput
): AgreementAnalyzerAttribution {
  const firstTouchAt =
    input.first_touch_at instanceof Date
      ? input.first_touch_at.toISOString()
      : typeof input.first_touch_at === 'string'
        ? input.first_touch_at
        : null;

  return {
    utm_source: trimToMax(input.utm_source, MAX_FIELD_LENGTH),
    utm_medium: trimToMax(input.utm_medium, MAX_FIELD_LENGTH),
    utm_campaign: trimToMax(input.utm_campaign, MAX_FIELD_LENGTH),
    utm_content: trimToMax(input.utm_content, MAX_FIELD_LENGTH),
    utm_term: trimToMax(input.utm_term, MAX_FIELD_LENGTH),
    referrer: trimToMax(input.referrer, MAX_TEXT_LENGTH),
    landing_page: trimToMax(input.landing_page, MAX_TEXT_LENGTH),
    first_touch_at: firstTouchAt,
  };
}

export function hasAttributionSignal(attribution: AgreementAnalyzerAttribution): boolean {
  return (
    attribution.utm_source != null ||
    attribution.utm_medium != null ||
    attribution.utm_campaign != null ||
    attribution.utm_content != null ||
    attribution.utm_term != null ||
    attribution.referrer != null ||
    attribution.landing_page != null
  );
}

export function attributionToAnalyticsProperties(
  attribution: AgreementAnalyzerAttribution | AgreementAnalyzerAttributionInput | null | undefined
): Record<string, string | null> {
  if (!attribution) return {};

  const normalized = normalizeAgreementAnalyzerAttribution(attribution);

  return {
    utm_source: normalized.utm_source,
    utm_medium: normalized.utm_medium,
    utm_campaign: normalized.utm_campaign,
    utm_content: normalized.utm_content,
    utm_term: normalized.utm_term,
    referrer: normalized.referrer,
    landing_page: normalized.landing_page,
    first_touch_at: normalized.first_touch_at,
  };
}

export function parseAttributionPayload(
  value: unknown
): AgreementAnalyzerAttribution | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as AgreementAnalyzerAttributionInput;
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeAgreementAnalyzerAttribution(parsed);
  } catch {
    return null;
  }
}
