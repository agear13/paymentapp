/** Agreement Intelligence validation instrumentation — fire-and-forget, non-blocking. */

export const AGREEMENT_INTELLIGENCE_EVENTS = [
  'briefing_viewed',
  'briefing_dwell_recorded',
  'health_section_viewed',
  'recommendation_viewed',
  'recommendation_cta_clicked',
  'recommendation_acted_upon',
  'recommendation_dismissed',
  'recommendation_completed',
  'blocker_panel_viewed',
  'blocker_cta_clicked',
  'participant_action_clicked',
  'settlement_readiness_viewed',
  'funding_funnel_viewed',
  'feedback_recommendation_helpful',
  'feedback_recommendation_not_helpful',
  'feedback_blocker_understood_yes',
  'feedback_blocker_understood_no',
  'outcome_first_agreement',
  'outcome_first_participant',
  'outcome_first_obligation',
  'outcome_settlement_readiness',
  'outcome_settlement_release',
  'health_score_recorded',
] as const;

export type AgreementIntelligenceEvent = (typeof AGREEMENT_INTELLIGENCE_EVENTS)[number];

export type AgreementIntelligenceEventProperties = {
  projectId?: string | null;
  agreementName?: string | null;
  recommendationId?: string | null;
  recommendationAction?: string | null;
  blockerId?: string | null;
  blockerLabel?: string | null;
  participantId?: string | null;
  sectionId?: string | null;
  dwellMs?: number;
  healthScore?: number;
  healthCategory?: string | null;
  settlementReadinessScore?: number | null;
  releaseConfidenceLevel?: string | null;
  helpful?: boolean;
  understood?: boolean;
  outcomeLabel?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

const ANALYTICS_ENDPOINT = '/api/agreements/intelligence/analytics';

export function trackAgreementIntelligence(
  event: AgreementIntelligenceEvent,
  properties?: AgreementIntelligenceEventProperties
): void {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
  };

  try {
    window.dispatchEvent(new CustomEvent('provvypay:agreement-intelligence', { detail: payload }));
  } catch {
    /* ignore */
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* validation telemetry must not block coordination UI */
  });
}

export function trackRecommendationCtaClick(
  properties: AgreementIntelligenceEventProperties & {
    recommendationId: string;
    recommendationAction: string;
  }
): void {
  trackAgreementIntelligence('recommendation_cta_clicked', properties);
  trackAgreementIntelligence('recommendation_acted_upon', properties);
}

export function trackBlockerCtaClick(
  properties: AgreementIntelligenceEventProperties & {
    blockerId: string;
    blockerLabel: string;
  }
): void {
  trackAgreementIntelligence('blocker_cta_clicked', properties);
}

export function trackParticipantActionClick(
  properties: AgreementIntelligenceEventProperties & {
    participantId: string;
  }
): void {
  trackAgreementIntelligence('participant_action_clicked', properties);
}

export function trackIntelligenceFeedback(
  kind: 'recommendation' | 'blocker',
  helpful: boolean
): void {
  if (kind === 'recommendation') {
    trackAgreementIntelligence(
      helpful ? 'feedback_recommendation_helpful' : 'feedback_recommendation_not_helpful',
      { helpful }
    );
    return;
  }
  trackAgreementIntelligence(
    helpful ? 'feedback_blocker_understood_yes' : 'feedback_blocker_understood_no',
    { understood: helpful }
  );
}

const OUTCOME_DEDUPE_PREFIX = 'provvypay:ai-outcome:';

export function trackOutcomeOnce(
  outcome: Extract<
    AgreementIntelligenceEvent,
    | 'outcome_first_agreement'
    | 'outcome_first_participant'
    | 'outcome_first_obligation'
    | 'outcome_settlement_readiness'
    | 'outcome_settlement_release'
  >,
  properties?: AgreementIntelligenceEventProperties
): void {
  if (typeof window === 'undefined') return;
  const key = `${OUTCOME_DEDUPE_PREFIX}${outcome}:${properties?.projectId ?? 'workspace'}`;
  if (window.localStorage.getItem(key)) return;
  window.localStorage.setItem(key, new Date().toISOString());
  trackAgreementIntelligence(outcome, properties);
}
