import type { AgreementBriefingSnapshot } from '@/lib/agreements/agreement-briefing.model';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import type { AgreementCommercialTiming } from '@/lib/commercial-timing/types';

export type AgreementRecommendationUrgency = 'critical' | 'high' | 'medium' | 'low';

export type AgreementPrimaryRecommendation = {
  action: string;
  reason: string;
  impact: string;
  ctaLabel: string;
  ctaHref: string;
  urgency: AgreementRecommendationUrgency;
};

export type AgreementSettlementBlocker = {
  id: string;
  label: string;
  severity: 'blocking' | 'warning';
  owner: string;
  resolution: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type AgreementFundingFunnelStepStatus = 'complete' | 'attention' | 'pending';

export type AgreementFundingFunnelStep = {
  id: string;
  label: string;
  status: AgreementFundingFunnelStepStatus;
  detail?: string;
};

export type AgreementParticipantActionPriority = 'high' | 'medium' | 'low';

export type AgreementParticipantAction = {
  participantId: string;
  participantName: string;
  role: string;
  requiredAction: string;
  status: string;
  priority: AgreementParticipantActionPriority;
  ctaLabel?: string;
  ctaHref?: string;
  isBlocking: boolean;
};

export type AgreementIntelligenceOutput = {
  snapshot: AgreementBriefingSnapshot;
  primaryRecommendation: AgreementPrimaryRecommendation | null;
  settlementBlockers: AgreementSettlementBlocker[];
  fundingFunnel: AgreementFundingFunnelStep[];
  participantActions: AgreementParticipantAction[];
  health: AgreementHealthSnapshot;
  /** Extracted or existing commercial timing — never fabricated. */
  commercialTiming?: AgreementCommercialTiming | null;
};
