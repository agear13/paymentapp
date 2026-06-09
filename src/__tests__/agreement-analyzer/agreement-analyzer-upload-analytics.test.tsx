import { AGREEMENT_ANALYZER_ANALYTICS_EVENTS } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics-types';
import {
  trackAgreementAnalyzerUploadCompleted,
  trackAgreementAnalyzerUploadStarted,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics';

describe('agreement analyzer upload funnel analytics', () => {
  it('registers landing page and upload funnel events', () => {
    expect(AGREEMENT_ANALYZER_ANALYTICS_EVENTS).toEqual(
      expect.arrayContaining([
        'agreement_analyzer_page_viewed',
        'agreement_analyzer_upload_started',
        'agreement_analyzer_upload_completed',
        'agreement_analyzer_customer',
      ])
    );
  });

  it('exposes client helpers for upload funnel tracking', () => {
    expect(typeof trackAgreementAnalyzerUploadStarted).toBe('function');
    expect(typeof trackAgreementAnalyzerUploadCompleted).toBe('function');
  });
});
