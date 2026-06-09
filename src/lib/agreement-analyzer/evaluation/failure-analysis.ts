import type {
  ExpectedAgreementEvaluation,
  NormalizedActualExtraction,
} from '@/lib/agreement-analyzer/evaluation/evaluation-types';
import {
  extractPartySignature,
  extractRevenueSplitSignature,
  flattenRevenueSplitItems,
  normalizeComparableListItem,
  partiesSemanticallyMatch,
  revenueSplitsSemanticallyMatch,
  tokenOverlapScore,
} from '@/lib/agreement-analyzer/evaluation/semantic-matching';

function findMissingExpectedItems(
  expectedItems: unknown[],
  actualItems: unknown[],
  matcher: (expectedItem: unknown, actualItem: unknown) => boolean
): string[] {
  const missing: string[] = [];

  for (const expectedItem of expectedItems) {
    const matched = actualItems.some((actualItem) => matcher(expectedItem, actualItem));
    if (!matched) {
      missing.push(normalizeComparableListItem(expectedItem));
    }
  }

  return missing.filter(Boolean);
}

export type AgreementFailureAnalysis = {
  agreementId: string;
  overallScore: number;
  missingParties: string[];
  missingRevenueSplits: string[];
  missingObligations: number;
  missingRisks: number;
  missingClauses: number;
};

export function analyzeAgreementFailures(
  agreementId: string,
  overallScore: number,
  expected: ExpectedAgreementEvaluation,
  actual: NormalizedActualExtraction
): AgreementFailureAnalysis | null {
  if (overallScore >= 80) {
    return null;
  }

  const missingObligations = Math.max(0, expected.obligationCount - actual.obligations.length);
  const missingRisks = Math.max(0, expected.riskCount - actual.risks.length);
  const missingClauses = Math.max(0, expected.missingClauseCount - actual.missingInformation.length);

  return {
    agreementId,
    overallScore,
    missingParties: findMissingExpectedItems(expected.parties, actual.parties, partiesSemanticallyMatch),
    missingRevenueSplits: findMissingExpectedItems(
      expected.revenueSplits,
      flattenRevenueSplitItems(actual.revenueSplits),
      revenueSplitsSemanticallyMatch
    ),
    missingObligations,
    missingRisks,
    missingClauses,
  };
}

export type BenchmarkMismatchDetail = {
  agreementId: string;
  metric: string;
  expectedValue: string;
  actualValue: string;
  currentScore: number;
  humanWouldAccept: boolean;
  rejectionReasons: string[];
};

export function diagnosePartyMismatch(expectedItem: unknown, actualItem: unknown): string[] {
  const expected = extractPartySignature(expectedItem);
  const actual = extractPartySignature(actualItem);
  const reasons: string[] = [];

  const nameScore = tokenOverlapScore(expected.name, actual.name);
  if (nameScore < 0.72) {
    reasons.push(
      nameScore === 0
        ? 'Party name missing in actual extraction'
        : `Party name fuzzy match too low (${Math.round(nameScore * 100)}%)`
    );
  }

  if (expected.role && actual.role && expected.role !== actual.role) {
    reasons.push(`Role synonym mismatch ("${expected.role}" vs "${actual.role}")`);
  } else if (expected.role && !actual.role) {
    reasons.push('Role stored under a different field in actual extraction (e.g. alias instead of role)');
  }

  return reasons;
}

export function diagnoseRevenueSplitMismatch(expectedItem: unknown, actualItem: unknown): string[] {
  const expected = extractRevenueSplitSignature(expectedItem);
  const actual = extractRevenueSplitSignature(actualItem);
  const reasons: string[] = [];

  const partyScore = tokenOverlapScore(expected.party, actual.party);
  if (partyScore < 0.72) {
    reasons.push('Beneficiary/party field naming differs or company name mismatch');
  }

  if (expected.percentage != null && actual.percentage != null && expected.percentage !== actual.percentage) {
    reasons.push(`Percentage mismatch (${expected.percentage}% vs ${actual.percentage}%)`);
  }

  if (expected.basis && actual.basis) {
    const basisScore = tokenOverlapScore(expected.basis, actual.basis);
    if (basisScore < 0.35) {
      reasons.push('Revenue basis wording differs');
    }
  }

  return reasons;
}
