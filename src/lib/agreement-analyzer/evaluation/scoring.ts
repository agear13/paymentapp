import type {
  EvaluationMetricScore,
  ExpectedAgreementEvaluation,
  NormalizedActualExtraction,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import {
  flattenRevenueSplitItems,
  partiesSemanticallyMatch,
  revenueSplitsSemanticallyMatch,
  scoreMinimumCountAlignment,
  scoreRelationshipClassificationSemantic,
  scoreSemanticArrayAlignment,
} from '@/lib/agreement-analyzer/evaluation/semantic-matching';

function toMetricScore(result: {
  score: number;
  expectedCount: number;
  actualCount: number;
  matchedCount: number;
}): EvaluationMetricScore {
  return {
    score: result.score,
    expectedCount: result.expectedCount,
    actualCount: result.actualCount,
    matchedCount: result.matchedCount,
  };
}

export function scoreAgreementEvaluation(
  agreementId: string,
  expected: ExpectedAgreementEvaluation,
  actual: NormalizedActualExtraction
) {
  const relationshipClassification = toMetricScore(
    scoreRelationshipClassificationSemantic(
      expected.commercialRelationshipType,
      actual.commercialRelationshipType
    )
  );
  const parties = toMetricScore(
    scoreSemanticArrayAlignment(expected.parties, actual.parties, partiesSemanticallyMatch)
  );
  const revenueSplits = toMetricScore(
    scoreSemanticArrayAlignment(
      expected.revenueSplits,
      flattenRevenueSplitItems(actual.revenueSplits),
      revenueSplitsSemanticallyMatch
    )
  );
  const obligations = toMetricScore(
    scoreMinimumCountAlignment(expected.obligationCount, actual.obligations.length)
  );
  const risks = toMetricScore(
    scoreMinimumCountAlignment(expected.riskCount, actual.risks.length)
  );
  const missingClauses = toMetricScore(
    scoreMinimumCountAlignment(expected.missingClauseCount, actual.missingInformation.length)
  );

  const overall =
    Math.round(
      ((relationshipClassification.score +
        parties.score +
        revenueSplits.score +
        obligations.score +
        risks.score +
        missingClauses.score) /
        6) *
        10
    ) / 10;

  const notes: string[] = [];
  if (relationshipClassification.score < 100 && actual.commercialRelationshipType) {
    notes.push(
      `Relationship type mismatch: expected "${expected.commercialRelationshipType}", actual "${actual.commercialRelationshipType}".`
    );
  }

  return {
    agreementId,
    commercialRelationshipType: expected.commercialRelationshipType,
    category: expected.category,
    difficulty: expected.difficulty,
    status: 'evaluated' as const,
    metrics: {
      relationshipClassification,
      parties,
      revenueSplits,
      obligations,
      risks,
      missingClauses,
      overall,
    },
    notes: notes.length > 0 ? notes : undefined,
  };
}

export function zeroScoreAgreementEvaluation(
  agreementId: string,
  expected: ExpectedAgreementEvaluation,
  status: 'missing_actual' | 'invalid_actual',
  notes?: string[]
) {
  const zeroMetric = (expectedCount = 0): EvaluationMetricScore => ({
    score: 0,
    expectedCount,
    actualCount: 0,
    matchedCount: 0,
  });

  return {
    agreementId,
    commercialRelationshipType: expected.commercialRelationshipType,
    category: expected.category,
    difficulty: expected.difficulty,
    status,
    metrics: {
      relationshipClassification: zeroMetric(1),
      parties: zeroMetric(expected.parties.length),
      revenueSplits: zeroMetric(expected.revenueSplits.length),
      obligations: zeroMetric(expected.obligationCount),
      risks: zeroMetric(expected.riskCount),
      missingClauses: zeroMetric(expected.missingClauseCount),
      overall: 0,
    },
    notes,
  };
}
