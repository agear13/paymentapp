import {
  calculateSettlementComplexityScore,
  calculateStructuralFitScore,
  extractLeadScoringSignals,
  resolvePriorityBand,
  resolveRecommendedUseCase,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-engine';
import type {
  LeadPriorityBand,
  LeadRecommendedUseCase,
  LeadScoringSignals,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-types';

export type StructuralFitScoreResult = {
  structuralFitScore: number;
  priorityBand: LeadPriorityBand;
  recommendedUseCase: LeadRecommendedUseCase;
  settlementComplexityScore: number;
  signals: LeadScoringSignals;
};

export function computeStructuralFitScore(input: {
  extractionJson: unknown;
  reportJson: unknown;
}): StructuralFitScoreResult {
  const signals = extractLeadScoringSignals(input.extractionJson, input.reportJson);
  const settlementComplexityScore = calculateSettlementComplexityScore(signals);
  const structuralFitScore = calculateStructuralFitScore(signals, settlementComplexityScore);

  return {
    structuralFitScore,
    priorityBand: resolvePriorityBand(structuralFitScore),
    recommendedUseCase: resolveRecommendedUseCase(signals),
    settlementComplexityScore,
    signals,
  };
}
