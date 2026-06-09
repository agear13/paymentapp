import type {
  AgreementExtractionResult,
  AgreementReportJson,
  AgreementSettlementReadiness,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildSettlementReadiness(
  extraction: AgreementExtractionResult
): AgreementSettlementReadiness {
  let score = Math.round(extraction.confidenceScore * 100);
  const factors: string[] = [];

  if (extraction.parties.length === 0) {
    score -= 20;
    factors.push('No parties identified.');
  }
  if (extraction.obligations.length === 0) {
    score -= 20;
    factors.push('No payment obligations identified.');
  }
  if (extraction.paymentConditions.length === 0) {
    score -= 10;
    factors.push('Payment conditions are unclear.');
  }
  if (extraction.missingInformation.length > 0) {
    const penalty = Math.min(30, extraction.missingInformation.length * 5);
    score -= penalty;
    factors.push(`${extraction.missingInformation.length} missing information item(s) detected.`);
  }
  if (extraction.risks.length > 0) {
    const penalty = Math.min(20, extraction.risks.length * 4);
    score -= penalty;
    factors.push(`${extraction.risks.length} risk item(s) flagged.`);
  }

  score = clampScore(score);

  let summary = 'Agreement appears ready for settlement review.';
  if (score < 40) {
    summary = 'Agreement requires substantial clarification before settlement.';
  } else if (score < 70) {
    summary = 'Agreement has gaps that should be resolved before settlement.';
  }

  if (factors.length === 0) {
    factors.push('Core parties, obligations, and payment conditions were identified.');
  }

  return { score, summary, factors };
}

export function buildAgreementReportJson(
  extraction: AgreementExtractionResult
): AgreementReportJson {
  return {
    parties: extraction.parties,
    revenueSplits: extraction.revenueSplits,
    paymentConditions: extraction.paymentConditions,
    obligations: extraction.obligations,
    risks: extraction.risks,
    missingInformation: extraction.missingInformation,
    settlementReadiness: buildSettlementReadiness(extraction),
  };
}
