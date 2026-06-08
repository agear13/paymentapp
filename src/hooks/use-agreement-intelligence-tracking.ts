'use client';

import * as React from 'react';
import type { AgreementIntelligenceOutput } from '@/lib/agreements/intelligence/agreement-intelligence.types';
import {
  trackAgreementIntelligence,
  trackOutcomeOnce,
} from '@/lib/agreements/validation/agreement-intelligence-analytics';

const SECTION_EVENT_MAP: Record<string, 'health_section_viewed' | 'blocker_panel_viewed' | 'settlement_readiness_viewed' | 'funding_funnel_viewed'> = {
  'briefing-health': 'health_section_viewed',
  'briefing-blockers': 'blocker_panel_viewed',
  'briefing-settlement': 'settlement_readiness_viewed',
  'briefing-funnel': 'funding_funnel_viewed',
};

type UseAgreementIntelligenceTrackingOptions = {
  projectId: string;
  agreementName?: string;
  intelligence: AgreementIntelligenceOutput | null;
  enabled?: boolean;
};

export function useAgreementIntelligenceTracking({
  projectId,
  agreementName,
  intelligence,
  enabled = true,
}: UseAgreementIntelligenceTrackingOptions) {
  const openedAtRef = React.useRef<number | null>(null);
  const recommendationActedRef = React.useRef(false);
  const recommendationIdRef = React.useRef<string | null>(null);
  const seenSectionsRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!enabled || !intelligence) return;

    openedAtRef.current = Date.now();
    trackAgreementIntelligence('briefing_viewed', { projectId, agreementName });

    trackAgreementIntelligence('health_score_recorded', {
      projectId,
      agreementName,
      healthScore: intelligence.health.score,
      healthCategory: intelligence.health.categoryLabel,
      settlementReadinessScore: intelligence.snapshot.settlementReadinessScore,
    });

    if (intelligence.primaryRecommendation) {
      recommendationIdRef.current = intelligence.primaryRecommendation.action;
      trackAgreementIntelligence('recommendation_viewed', {
        projectId,
        agreementName,
        recommendationId: intelligence.primaryRecommendation.action,
        recommendationAction: intelligence.primaryRecommendation.action,
      });
    }

    if (intelligence.snapshot.participantCount > 0) {
      trackOutcomeOnce('outcome_first_participant', { projectId, agreementName });
    }
    if (intelligence.snapshot.obligationCount > 0) {
      trackOutcomeOnce('outcome_first_obligation', { projectId, agreementName });
    }
    if (intelligence.health.score >= 75 || intelligence.snapshot.settlementReadinessScore >= 75) {
      trackOutcomeOnce('outcome_settlement_readiness', {
        projectId,
        agreementName,
        healthScore: intelligence.health.score,
      });
    }

    const settlementReleased = intelligence.fundingFunnel.some(
      (step) => step.id === 'settlement-released' && step.status === 'complete'
    );
    if (settlementReleased) {
      trackOutcomeOnce('outcome_settlement_release', { projectId, agreementName });
    }

    return () => {
      const openedAt = openedAtRef.current;
      if (openedAt) {
        trackAgreementIntelligence('briefing_dwell_recorded', {
          projectId,
          agreementName,
          dwellMs: Date.now() - openedAt,
        });
      }

      if (
        intelligence.primaryRecommendation &&
        recommendationIdRef.current &&
        !recommendationActedRef.current
      ) {
        trackAgreementIntelligence('recommendation_dismissed', {
          projectId,
          agreementName,
          recommendationId: recommendationIdRef.current,
          recommendationAction: recommendationIdRef.current,
        });
      }
    };
  }, [enabled, intelligence, projectId, agreementName]);

  React.useEffect(() => {
    if (!enabled || !intelligence) return;

    const elements = Object.keys(SECTION_EVENT_MAP)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const sectionId = entry.target.id;
          if (seenSectionsRef.current.has(sectionId)) continue;
          seenSectionsRef.current.add(sectionId);
          const eventName = SECTION_EVENT_MAP[sectionId];
          if (eventName) {
            trackAgreementIntelligence(eventName, { projectId, agreementName, sectionId });
          }
        }
      },
      { threshold: 0.35 }
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [enabled, intelligence, projectId, agreementName]);

  const markRecommendationActed = React.useCallback(() => {
    recommendationActedRef.current = true;
  }, []);

  const markRecommendationCompleted = React.useCallback(
    (recommendationAction: string) => {
      trackAgreementIntelligence('recommendation_completed', {
        projectId,
        agreementName,
        recommendationId: recommendationAction,
        recommendationAction,
      });
    },
    [projectId, agreementName]
  );

  return { markRecommendationActed, markRecommendationCompleted };
}
