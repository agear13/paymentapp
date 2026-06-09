import 'server-only';

import {
  AGREEMENT_ANALYZER_ANALYTICS_EVENTS,
  type AgreementAnalyzerAnalyticsEvent,
  type AgreementAnalyzerAnalyticsProperties,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics-types';
import { log } from '@/lib/logger';

export { AGREEMENT_ANALYZER_ANALYTICS_EVENTS };
export type { AgreementAnalyzerAnalyticsEvent, AgreementAnalyzerAnalyticsProperties };

export function trackAgreementAnalyzerEvent(
  event: AgreementAnalyzerAnalyticsEvent,
  properties?: AgreementAnalyzerAnalyticsProperties
): void {
  log.info('agreement_analyzer.analytics', {
    event,
    ...(properties ?? {}),
    timestamp: new Date().toISOString(),
  });
}
