export type AgreementHealthCategory =
  | 'excellent'
  | 'healthy'
  | 'attention_required'
  | 'at_risk'
  | 'critical';

export type AgreementHealthFactorStatus = 'positive' | 'warning' | 'negative';

export type AgreementHealthWeights = {
  settlementReadiness: number;
  blockerSeverity: number;
  approvalProgress: number;
  fundingProgress: number;
  participantCompleteness: number;
  obligationCompletion: number;
  commercialTermsCompleteness: number;
  infrastructureReadiness: number;
};

export const DEFAULT_AGREEMENT_HEALTH_WEIGHTS: AgreementHealthWeights = {
  settlementReadiness: 0.2,
  blockerSeverity: 0.18,
  approvalProgress: 0.14,
  fundingProgress: 0.14,
  participantCompleteness: 0.12,
  obligationCompletion: 0.1,
  commercialTermsCompleteness: 0.06,
  infrastructureReadiness: 0.06,
};

export type AgreementHealthSignals = {
  settlementReadiness: number;
  blockerSeverity: number;
  approvalProgress: number;
  fundingProgress: number;
  participantCompleteness: number;
  obligationCompletion: number;
  commercialTermsCompleteness: number;
  infrastructureReadiness: number;
};

export type AgreementHealthFactor = {
  id: string;
  label: string;
  status: AgreementHealthFactorStatus;
  detail: string;
  dimension: keyof AgreementHealthSignals;
  dimensionScore: number;
  improvesScoreHint?: string;
};

export type AgreementHealthTrendDirection = 'improved' | 'declined' | 'stable';

export type AgreementHealthTrend = {
  delta: number;
  direction: AgreementHealthTrendDirection;
  label: string;
  contributingFactors: string[];
  previousScore: number | null;
};

export type AgreementHealthSnapshot = {
  projectId: string;
  agreementName: string;
  score: number;
  category: AgreementHealthCategory;
  categoryLabel: string;
  categoryReason: string;
  signals: AgreementHealthSignals;
  weights: AgreementHealthWeights;
  factors: AgreementHealthFactor[];
  improvesScore: string[];
  reducesScore: string[];
  trend: AgreementHealthTrend;
  agreementValue: number;
  blockerCount: number;
  releaseReadyCount: number;
  recordedAt: string;
};

export type AgreementHealthPortfolioSummary = {
  totalAgreements: number;
  averageScore: number;
  byCategory: Record<AgreementHealthCategory, number>;
  categoryLabels: Record<AgreementHealthCategory, string>;
  snapshots: AgreementHealthSnapshot[];
};

export type AgreementComparativeRank =
  | 'highest_risk'
  | 'highest_value'
  | 'closest_to_settlement'
  | 'most_blocked'
  | 'recently_improved'
  | 'recently_deteriorated';

export const AGREEMENT_HEALTH_CATEGORY_LABELS: Record<AgreementHealthCategory, string> = {
  excellent: 'Excellent',
  healthy: 'Healthy',
  attention_required: 'Attention Required',
  at_risk: 'At Risk',
  critical: 'Critical',
};

export const AGREEMENT_COMPARATIVE_RANK_LABELS: Record<AgreementComparativeRank, string> = {
  highest_risk: 'Highest risk',
  highest_value: 'Highest value',
  closest_to_settlement: 'Closest to settlement',
  most_blocked: 'Most blocked',
  recently_improved: 'Recently improved',
  recently_deteriorated: 'Recently deteriorated',
};

export function normalizeHealthWeights(
  weights: Partial<AgreementHealthWeights> = {}
): AgreementHealthWeights {
  const merged: AgreementHealthWeights = { ...DEFAULT_AGREEMENT_HEALTH_WEIGHTS, ...weights };
  const total = Object.values(merged).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_AGREEMENT_HEALTH_WEIGHTS;
  const normalized = {} as AgreementHealthWeights;
  for (const key of Object.keys(merged) as (keyof AgreementHealthWeights)[]) {
    normalized[key] = merged[key] / total;
  }
  return normalized;
}

export function healthCategoryFromScore(score: number): AgreementHealthCategory {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'healthy';
  if (score >= 60) return 'attention_required';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

export function healthCategoryReason(category: AgreementHealthCategory, score: number): string {
  switch (category) {
    case 'excellent':
      return `Score ${score} — coordination is strong with minimal settlement friction.`;
    case 'healthy':
      return `Score ${score} — agreement is progressing well with minor gaps to close.`;
    case 'attention_required':
      return `Score ${score} — specific blockers or missing setup need operator attention.`;
    case 'at_risk':
      return `Score ${score} — multiple coordination gaps are delaying settlement readiness.`;
    case 'critical':
      return `Score ${score} — urgent setup or approval work is blocking this agreement.`;
  }
}
