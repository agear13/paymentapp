export const AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY = 'agreement_analyzer_attribution';

/** First-touch attribution TTL — 90 days. */
export const AGREEMENT_ANALYZER_ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type AgreementAnalyzerAttribution = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_touch_at: string | null;
};

export type AgreementAnalyzerAttributionInput = Partial<{
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_page: string | null;
  first_touch_at: string | Date | null;
}>;

export type StoredAgreementAnalyzerAttribution = {
  data: AgreementAnalyzerAttribution;
  expiresAt: string;
};
