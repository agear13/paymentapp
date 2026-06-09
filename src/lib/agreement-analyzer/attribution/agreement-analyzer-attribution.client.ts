import {
  AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY,
  AGREEMENT_ANALYZER_ATTRIBUTION_TTL_MS,
  type AgreementAnalyzerAttribution,
  type StoredAgreementAnalyzerAttribution,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution-types';
import {
  hasAttributionSignal,
  normalizeAgreementAnalyzerAttribution,
  parseUtmSearchParams,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';

function readStoredAttribution(now = Date.now()): AgreementAnalyzerAttribution | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAgreementAnalyzerAttribution;
    if (!parsed?.data || !parsed.expiresAt) return null;

    if (Date.parse(parsed.expiresAt) <= now) {
      window.localStorage.removeItem(AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY);
      return null;
    }

    return normalizeAgreementAnalyzerAttribution(parsed.data);
  } catch {
    return null;
  }
}

function writeStoredAttribution(attribution: AgreementAnalyzerAttribution, now = Date.now()): void {
  if (typeof window === 'undefined') return;

  const payload: StoredAgreementAnalyzerAttribution = {
    data: attribution,
    expiresAt: new Date(now + AGREEMENT_ANALYZER_ATTRIBUTION_TTL_MS).toISOString(),
  };

  try {
    window.localStorage.setItem(
      AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* localStorage unavailable */
  }
}

/**
 * First-touch capture for /agreement-analyzer visits.
 * Preserves existing attribution until the 90-day TTL expires.
 */
export function captureAgreementAnalyzerAttribution(
  search = typeof window !== 'undefined' ? window.location.search : ''
): AgreementAnalyzerAttribution | null {
  const existing = readStoredAttribution();
  if (existing) {
    return existing;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const searchParams = new URLSearchParams(search);
  const utm = parseUtmSearchParams(searchParams);
  const referrer = document.referrer?.trim() || null;
  const landingPage = `${window.location.pathname}${window.location.search}`;

  const attribution = normalizeAgreementAnalyzerAttribution({
    ...utm,
    referrer,
    landing_page: landingPage,
    first_touch_at: new Date().toISOString(),
  });

  if (!hasAttributionSignal(attribution)) {
    return null;
  }

  writeStoredAttribution(attribution);
  return attribution;
}

export function getStoredAgreementAnalyzerAttribution(): AgreementAnalyzerAttribution | null {
  return readStoredAttribution();
}

export function serializeAttributionForUpload(
  attribution: AgreementAnalyzerAttribution | null
): string | null {
  if (!attribution) return null;
  return JSON.stringify(attribution);
}
