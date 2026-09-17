import type {
  EarlyPaymentIncentiveRecord,
  EarlyPaymentIncentiveRecommendation,
} from '@/lib/commercial-incentive/types';

export function buildIncentiveDecisionRecord(input: {
  recommendation: EarlyPaymentIncentiveRecommendation;
  action: 'approve' | 'dismiss';
  sourceAgreementId: string;
  workflowId: string;
  decidedByUserId: string;
  decidedAt?: string;
}): EarlyPaymentIncentiveRecord {
  return {
    kind: input.recommendation.kind,
    origin: input.recommendation.origin,
    status: input.action === 'approve' ? 'approved' : 'dismissed',
    compensationType: input.recommendation.compensationType,
    policyId: input.recommendation.policyId,
    standardDays: input.recommendation.standardDays,
    acceleratedDays: input.recommendation.acceleratedDays,
    incentivePercent: input.recommendation.incentivePercent,
    sourceDueLabel: input.recommendation.sourceDueLabel,
    sourceAgreementId: input.sourceAgreementId,
    workflowId: input.workflowId,
    economics: input.recommendation.economics,
    trigger: input.recommendation.trigger,
    label: input.recommendation.label,
    decidedAt: input.decidedAt ?? new Date().toISOString(),
    decidedByUserId: input.decidedByUserId,
  };
}
