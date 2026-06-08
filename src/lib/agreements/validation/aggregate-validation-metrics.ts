import type { AgreementIntelligenceEvent } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import type { StoredAgreementIntelligenceEvent } from '@/lib/agreements/validation/agreement-intelligence-validation-store.server';

export type ValidationUsageMetrics = {
  briefingViews: number;
  healthSectionViews: number;
  recommendationViews: number;
  recommendationCtaClicks: number;
  recommendationActedUpon: number;
  recommendationDismissed: number;
  recommendationCompleted: number;
  blockerPanelViews: number;
  blockerCtaClicks: number;
  participantActionClicks: number;
  settlementReadinessViews: number;
  averageDwellMs: number | null;
  uniqueAgreementsViewed: number;
  uniqueUsers: number;
};

export type RecommendationEffectivenessRow = {
  recommendationAction: string;
  viewed: number;
  actedUpon: number;
  dismissed: number;
  completed: number;
  actionRate: number;
  completionRate: number;
};

export type HealthAccuracyRow = {
  healthCategory: string;
  count: number;
  settlementReadinessReached: number;
  settlementReleaseReached: number;
  predictiveRate: number;
};

export type OutcomeTimingRow = {
  outcome: string;
  eventCount: number;
  medianHoursFromBriefing: number | null;
};

export type AgreementIntelligenceValidationReport = {
  generatedAt: string;
  windowStart: string | null;
  eventCount: number;
  usage: ValidationUsageMetrics;
  recommendationEffectiveness: RecommendationEffectivenessRow[];
  healthAccuracy: HealthAccuracyRow[];
  outcomeTiming: OutcomeTimingRow[];
  feedback: {
    recommendationHelpfulYes: number;
    recommendationHelpfulNo: number;
    blockerUnderstoodYes: number;
    blockerUnderstoodNo: number;
  };
};

function countEvents(events: StoredAgreementIntelligenceEvent[], name: AgreementIntelligenceEvent): number {
  return events.filter((e) => e.event === name).length;
}

function uniqueValues(events: StoredAgreementIntelligenceEvent[], pick: (e: StoredAgreementIntelligenceEvent) => string | undefined): number {
  return new Set(events.map(pick).filter(Boolean)).size;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function aggregateAgreementIntelligenceValidation(
  events: StoredAgreementIntelligenceEvent[],
  options?: { since?: string }
): AgreementIntelligenceValidationReport {
  const sinceMs = options?.since ? Date.parse(options.since) : 0;
  const filtered = sinceMs
    ? events.filter((event) => Date.parse(event.timestamp) >= sinceMs)
    : events;

  const dwellEvents = filtered.filter((e) => e.event === 'briefing_dwell_recorded');
  const dwellValues = dwellEvents
    .map((e) => Number(e.properties.dwellMs))
    .filter((n) => Number.isFinite(n) && n > 0);

  const recommendationMap = new Map<
    string,
    { viewed: number; actedUpon: number; dismissed: number; completed: number }
  >();

  for (const event of filtered) {
    const action = String(event.properties.recommendationAction ?? 'Unknown recommendation');
    if (
      event.event === 'recommendation_viewed' ||
      event.event === 'recommendation_cta_clicked' ||
      event.event === 'recommendation_acted_upon' ||
      event.event === 'recommendation_dismissed' ||
      event.event === 'recommendation_completed'
    ) {
      const row = recommendationMap.get(action) ?? {
        viewed: 0,
        actedUpon: 0,
        dismissed: 0,
        completed: 0,
      };
      if (event.event === 'recommendation_viewed') row.viewed += 1;
      if (event.event === 'recommendation_acted_upon' || event.event === 'recommendation_cta_clicked') {
        row.actedUpon += 1;
      }
      if (event.event === 'recommendation_dismissed') row.dismissed += 1;
      if (event.event === 'recommendation_completed') row.completed += 1;
      recommendationMap.set(action, row);
    }
  }

  const recommendationEffectiveness = [...recommendationMap.entries()]
    .map(([recommendationAction, row]) => ({
      recommendationAction,
      viewed: row.viewed,
      actedUpon: row.actedUpon,
      dismissed: row.dismissed,
      completed: row.completed,
      actionRate: row.viewed > 0 ? Math.round((row.actedUpon / row.viewed) * 100) : 0,
      completionRate: row.actedUpon > 0 ? Math.round((row.completed / row.actedUpon) * 100) : 0,
    }))
    .sort((a, b) => b.viewed - a.viewed);

  const healthByCategory = new Map<
    string,
    { count: number; settlementReadinessReached: number; settlementReleaseReached: number }
  >();

  const readinessByProject = new Set(
    filtered.filter((e) => e.event === 'outcome_settlement_readiness').map((e) => String(e.properties.projectId))
  );
  const releaseByProject = new Set(
    filtered.filter((e) => e.event === 'outcome_settlement_release').map((e) => String(e.properties.projectId))
  );

  for (const event of filtered) {
    if (event.event !== 'health_score_recorded') continue;
    const category = String(event.properties.healthCategory ?? 'unknown');
    const projectId = String(event.properties.projectId ?? '');
    const row = healthByCategory.get(category) ?? {
      count: 0,
      settlementReadinessReached: 0,
      settlementReleaseReached: 0,
    };
    row.count += 1;
    if (projectId && readinessByProject.has(projectId)) row.settlementReadinessReached += 1;
    if (projectId && releaseByProject.has(projectId)) row.settlementReleaseReached += 1;
    healthByCategory.set(category, row);
  }

  const healthAccuracy = [...healthByCategory.entries()]
    .map(([healthCategory, row]) => ({
      healthCategory,
      count: row.count,
      settlementReadinessReached: row.settlementReadinessReached,
      settlementReleaseReached: row.settlementReleaseReached,
      predictiveRate:
        row.count > 0 ? Math.round((row.settlementReadinessReached / row.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const outcomeLabels: Record<string, string> = {
    outcome_first_agreement: 'Time to first agreement',
    outcome_first_participant: 'Time to first participant',
    outcome_first_obligation: 'Time to first obligation',
    outcome_settlement_readiness: 'Time to settlement readiness',
    outcome_settlement_release: 'Time to settlement release',
  };

  const briefingFirstSeen = new Map<string, number>();
  for (const event of filtered) {
    if (event.event !== 'briefing_viewed') continue;
    const projectId = String(event.properties.projectId ?? event.userId);
    const ts = Date.parse(event.timestamp);
    if (!briefingFirstSeen.has(projectId) || ts < briefingFirstSeen.get(projectId)!) {
      briefingFirstSeen.set(projectId, ts);
    }
  }

  const outcomeTiming: OutcomeTimingRow[] = Object.entries(outcomeLabels).map(([outcome, label]) => {
    const outcomeEvents = filtered.filter((e) => e.event === outcome);
    const deltas: number[] = [];
    for (const event of outcomeEvents) {
      const anchorKey = String(event.properties.projectId ?? event.userId);
      const anchor = briefingFirstSeen.get(anchorKey);
      if (!anchor) continue;
      deltas.push((Date.parse(event.timestamp) - anchor) / (1000 * 60 * 60));
    }
    const med = median(deltas);
    return {
      outcome: label,
      eventCount: outcomeEvents.length,
      medianHoursFromBriefing: med == null ? null : Math.round(med * 10) / 10,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    windowStart: options?.since ?? (filtered[0]?.timestamp ?? null),
    eventCount: filtered.length,
    usage: {
      briefingViews: countEvents(filtered, 'briefing_viewed'),
      healthSectionViews: countEvents(filtered, 'health_section_viewed'),
      recommendationViews: countEvents(filtered, 'recommendation_viewed'),
      recommendationCtaClicks: countEvents(filtered, 'recommendation_cta_clicked'),
      recommendationActedUpon: countEvents(filtered, 'recommendation_acted_upon'),
      recommendationDismissed: countEvents(filtered, 'recommendation_dismissed'),
      recommendationCompleted: countEvents(filtered, 'recommendation_completed'),
      blockerPanelViews: countEvents(filtered, 'blocker_panel_viewed'),
      blockerCtaClicks: countEvents(filtered, 'blocker_cta_clicked'),
      participantActionClicks: countEvents(filtered, 'participant_action_clicked'),
      settlementReadinessViews: countEvents(filtered, 'settlement_readiness_viewed'),
      averageDwellMs: dwellValues.length > 0 ? Math.round(dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length) : null,
      uniqueAgreementsViewed: uniqueValues(filtered, (e) =>
        e.properties.projectId ? String(e.properties.projectId) : undefined
      ),
      uniqueUsers: uniqueValues(filtered, (e) => e.userId),
    },
    recommendationEffectiveness,
    healthAccuracy,
    outcomeTiming,
    feedback: {
      recommendationHelpfulYes: countEvents(filtered, 'feedback_recommendation_helpful'),
      recommendationHelpfulNo: countEvents(filtered, 'feedback_recommendation_not_helpful'),
      blockerUnderstoodYes: countEvents(filtered, 'feedback_blocker_understood_yes'),
      blockerUnderstoodNo: countEvents(filtered, 'feedback_blocker_understood_no'),
    },
  };
}
