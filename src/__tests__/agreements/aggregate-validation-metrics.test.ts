import { aggregateAgreementIntelligenceValidation } from '@/lib/agreements/validation/aggregate-validation-metrics';
import type { StoredAgreementIntelligenceEvent } from '@/lib/agreements/validation/agreement-intelligence-validation-store.server';

function event(
  partial: Partial<StoredAgreementIntelligenceEvent> &
    Pick<StoredAgreementIntelligenceEvent, 'event' | 'timestamp'>
): StoredAgreementIntelligenceEvent {
  return {
    userId: 'user-1',
    properties: {},
    path: '/dashboard/projects/p1',
    ...partial,
  };
}

describe('aggregateAgreementIntelligenceValidation', () => {
  it('aggregates usage, recommendation effectiveness, health accuracy, and feedback', () => {
    const events: StoredAgreementIntelligenceEvent[] = [
      event({
        event: 'briefing_viewed',
        timestamp: '2026-06-01T10:00:00.000Z',
        properties: { projectId: 'p1', agreementName: 'Alpha' },
      }),
      event({
        event: 'briefing_dwell_recorded',
        timestamp: '2026-06-01T10:05:00.000Z',
        properties: { projectId: 'p1', dwellMs: 120000 },
      }),
      event({
        event: 'recommendation_viewed',
        timestamp: '2026-06-01T10:00:05.000Z',
        properties: {
          projectId: 'p1',
          recommendationAction: 'Add participants',
        },
      }),
      event({
        event: 'recommendation_acted_upon',
        timestamp: '2026-06-01T10:01:00.000Z',
        properties: {
          projectId: 'p1',
          recommendationAction: 'Add participants',
        },
      }),
      event({
        event: 'recommendation_dismissed',
        timestamp: '2026-06-01T10:02:00.000Z',
        properties: {
          projectId: 'p1',
          recommendationAction: 'Connect payment provider',
        },
      }),
      event({
        event: 'health_score_recorded',
        timestamp: '2026-06-01T10:00:10.000Z',
        properties: { projectId: 'p1', healthCategory: 'Healthy' },
      }),
      event({
        event: 'outcome_settlement_readiness',
        timestamp: '2026-06-01T12:00:00.000Z',
        properties: { projectId: 'p1' },
      }),
      event({
        event: 'feedback_recommendation_helpful',
        timestamp: '2026-06-01T10:03:00.000Z',
        properties: { helpful: true },
      }),
      event({
        event: 'feedback_blocker_understood_no',
        timestamp: '2026-06-01T10:04:00.000Z',
        properties: { understood: false },
      }),
    ];

    const report = aggregateAgreementIntelligenceValidation(events);

    expect(report.usage.briefingViews).toBe(1);
    expect(report.usage.recommendationViews).toBe(1);
    expect(report.usage.recommendationActedUpon).toBe(1);
    expect(report.usage.averageDwellMs).toBe(120000);
    expect(report.usage.uniqueAgreementsViewed).toBe(1);

    expect(report.recommendationEffectiveness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendationAction: 'Add participants',
          viewed: 1,
          actedUpon: 1,
          actionRate: 100,
        }),
      ])
    );

    expect(report.healthAccuracy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          healthCategory: 'Healthy',
          count: 1,
          settlementReadinessReached: 1,
          predictiveRate: 100,
        }),
      ])
    );

    expect(report.feedback.recommendationHelpfulYes).toBe(1);
    expect(report.feedback.blockerUnderstoodNo).toBe(1);

    const readinessTiming = report.outcomeTiming.find(
      (row) => row.outcome === 'Time to settlement readiness'
    );
    expect(readinessTiming?.eventCount).toBe(1);
    expect(readinessTiming?.medianHoursFromBriefing).toBe(2);
  });

  it('respects since window filter', () => {
    const events: StoredAgreementIntelligenceEvent[] = [
      event({
        event: 'briefing_viewed',
        timestamp: '2026-05-01T10:00:00.000Z',
        properties: { projectId: 'old' },
      }),
      event({
        event: 'briefing_viewed',
        timestamp: '2026-06-05T10:00:00.000Z',
        properties: { projectId: 'new' },
      }),
    ];

    const report = aggregateAgreementIntelligenceValidation(events, {
      since: '2026-06-01T00:00:00.000Z',
    });

    expect(report.eventCount).toBe(1);
    expect(report.usage.briefingViews).toBe(1);
    expect(report.usage.uniqueAgreementsViewed).toBe(1);
  });
});
