/**
 * @jest-environment jsdom
 */
import {
  AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY,
  AGREEMENT_ANALYZER_ATTRIBUTION_TTL_MS,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution-types';
import {
  attributionToAnalyticsProperties,
  hasAttributionSignal,
  normalizeAgreementAnalyzerAttribution,
  parseAttributionPayload,
  parseUtmSearchParams,
} from '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution';

describe('agreement analyzer attribution parsing', () => {
  it('parses UTM parameters from search params', () => {
    const params = new URLSearchParams(
      'utm_source=linkedin&utm_medium=organic&utm_campaign=agreement-analyzer-launch&utm_content=cta&utm_term=payments'
    );

    expect(parseUtmSearchParams(params)).toEqual({
      utm_source: 'linkedin',
      utm_medium: 'organic',
      utm_campaign: 'agreement-analyzer-launch',
      utm_content: 'cta',
      utm_term: 'payments',
    });
  });

  it('normalizes attribution payloads and maps to analytics properties', () => {
    const normalized = normalizeAgreementAnalyzerAttribution({
      utm_source: ' linkedin ',
      utm_medium: 'organic',
      utm_campaign: 'agreement-analyzer-launch',
      referrer: 'https://www.linkedin.com/feed/',
      landing_page: '/agreement-analyzer?utm_source=linkedin',
      first_touch_at: '2026-06-09T10:00:00.000Z',
    });

    expect(hasAttributionSignal(normalized)).toBe(true);
    expect(attributionToAnalyticsProperties(normalized)).toEqual({
      utm_source: 'linkedin',
      utm_medium: 'organic',
      utm_campaign: 'agreement-analyzer-launch',
      utm_content: null,
      utm_term: null,
      referrer: 'https://www.linkedin.com/feed/',
      landing_page: '/agreement-analyzer?utm_source=linkedin',
      first_touch_at: '2026-06-09T10:00:00.000Z',
    });
  });

  it('parses attribution JSON payloads from upload form data', () => {
    const payload = parseAttributionPayload(
      JSON.stringify({
        utm_source: 'linkedin',
        utm_medium: 'organic',
        utm_campaign: 'agreement-analyzer-launch',
      })
    );

    expect(payload?.utm_source).toBe('linkedin');
    expect(payload?.utm_campaign).toBe('agreement-analyzer-launch');
  });
});

describe('agreement analyzer first-touch capture', () => {
  const originalReferrer = Object.getOwnPropertyDescriptor(document, 'referrer');

  beforeEach(() => {
    localStorage.clear();
    jest.resetModules();

    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://www.linkedin.com/',
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/agreement-analyzer',
        search:
          '?utm_source=linkedin&utm_medium=organic&utm_campaign=agreement-analyzer-launch',
      },
    });
  });

  afterEach(() => {
    if (originalReferrer) {
      Object.defineProperty(document, 'referrer', originalReferrer);
    }
  });

  it('stores first-touch attribution without overwriting on subsequent visits', async () => {
    const {
      captureAgreementAnalyzerAttribution,
      getStoredAgreementAnalyzerAttribution,
    } = await import('@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client');

    const firstCapture = captureAgreementAnalyzerAttribution();
    expect(firstCapture?.utm_source).toBe('linkedin');
    expect(firstCapture?.referrer).toBe('https://www.linkedin.com/');
    expect(firstCapture?.landing_page).toBe(
      '/agreement-analyzer?utm_source=linkedin&utm_medium=organic&utm_campaign=agreement-analyzer-launch'
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/agreement-analyzer',
        search: '?utm_source=google&utm_medium=cpc&utm_campaign=retargeting',
      },
    });

    const secondCapture = captureAgreementAnalyzerAttribution();
    expect(secondCapture?.utm_source).toBe('linkedin');
    expect(secondCapture?.utm_campaign).toBe('agreement-analyzer-launch');
    expect(getStoredAgreementAnalyzerAttribution()?.utm_source).toBe('linkedin');
  });

  it('expires stored attribution after the 90-day TTL', async () => {
    const { captureAgreementAnalyzerAttribution } = await import(
      '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client'
    );

    const firstCapture = captureAgreementAnalyzerAttribution();
    expect(firstCapture?.utm_source).toBe('linkedin');

    const stored = localStorage.getItem(AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored as string) as { expiresAt: string };
    parsed.expiresAt = new Date(Date.now() - 1_000).toISOString();
    localStorage.setItem(AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/agreement-analyzer',
        search: '?utm_source=google&utm_medium=cpc&utm_campaign=retargeting',
      },
    });

    const refreshed = captureAgreementAnalyzerAttribution();
    expect(refreshed?.utm_source).toBe('google');
    expect(refreshed?.utm_campaign).toBe('retargeting');
  });

  it('uses a 90-day TTL for stored attribution', async () => {
    const { captureAgreementAnalyzerAttribution } = await import(
      '@/lib/agreement-analyzer/attribution/agreement-analyzer-attribution.client'
    );

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    captureAgreementAnalyzerAttribution();

    const stored = JSON.parse(
      localStorage.getItem(AGREEMENT_ANALYZER_ATTRIBUTION_STORAGE_KEY) as string
    ) as { expiresAt: string };

    expect(Date.parse(stored.expiresAt)).toBe(now + AGREEMENT_ANALYZER_ATTRIBUTION_TTL_MS);
  });
});
