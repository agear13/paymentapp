import {
  type AgreementAnalyzerAnalyticsEvent,
  type AgreementAnalyzerAnalyticsProperties,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics-types';

const ANALYTICS_ENDPOINT = '/api/agreement-analyzer/analytics';

/** Fire-and-forget Agreement Analyzer instrumentation from the browser. */
export function trackAgreementAnalyzerClientEvent(
  event: AgreementAnalyzerAnalyticsEvent,
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
  };

  try {
    window.dispatchEvent(new CustomEvent('provvypay:agreement-analyzer', { detail: payload }));
  } catch {
    /* ignore */
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* analytics must not block report UX */
  });
}

export function trackAgreementReportDemoClicked(
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  trackAgreementAnalyzerClientEvent('agreement_report_demo_clicked', properties);
}

export function trackAgreementAnalyzerDemoClick(
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  trackAgreementAnalyzerClientEvent('agreement_analyzer_demo_click', properties);
}

export function trackAgreementAnalyzerPageViewed(
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  trackAgreementAnalyzerClientEvent('agreement_analyzer_page_viewed', properties);
}

export function trackAgreementAnalyzerUploadStarted(
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  trackAgreementAnalyzerClientEvent('agreement_analyzer_upload_started', properties);
}

export function trackAgreementAnalyzerUploadCompleted(
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  trackAgreementAnalyzerClientEvent('agreement_analyzer_upload_completed', properties);
}
