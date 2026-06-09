import { computeStructuralFitScore } from '@/lib/agreement-analyzer/scoring/compute-structural-fit-score';
import type {
  LeadPriorityBand,
  LeadRecommendedUseCase,
  LeadScoringSignals,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-types';
import type {
  AgreementProvvypayFit,
  AgreementReportJson,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

const USE_CASE_HEADLINES: Record<LeadRecommendedUseCase, string> = {
  'Event Revenue Sharing': 'Strong fit for event revenue sharing',
  'Venue Settlement': 'Well suited to venue revenue settlement',
  'Client Fund Coordination': 'Useful for client fund coordination workflows',
  'Multi Party Settlement': 'Relevant for multi-party settlement coordination',
  'Obligation Management': 'General obligation tracking opportunity',
};

const PRIORITY_FIT_LABELS: Record<LeadPriorityBand, string> = {
  IDEAL_ICP: 'Ideal Provvypay fit',
  HIGH: 'Strong Provvypay fit',
  MEDIUM: 'Moderate Provvypay fit',
  LOW: 'Limited Provvypay fit',
};

function buildStrengths(signals: LeadScoringSignals): string[] {
  const strengths: string[] = [];

  if (signals.revenueShareDetected) {
    strengths.push('Revenue-sharing terms were identified in this agreement.');
  }
  if (signals.hospitalityDetected) {
    strengths.push('Hospitality or venue operating patterns were detected.');
  }
  if (signals.eventDetected) {
    strengths.push('Event promotion or ticketing patterns were detected.');
  }
  if (signals.accountantDetected) {
    strengths.push('Accountant or trust-account coordination patterns were detected.');
  }
  if (signals.multiPartyDetected) {
    strengths.push('Multiple parties require coordinated settlement.');
  }
  if (signals.revenueSplitCount > 0) {
    strengths.push(
      `${signals.revenueSplitCount} revenue split rule${signals.revenueSplitCount === 1 ? '' : 's'} were extracted.`
    );
  }
  if (signals.obligationCount > 0) {
    strengths.push(
      `${signals.obligationCount} payment obligation${signals.obligationCount === 1 ? '' : 's'} were identified.`
    );
  }

  if (strengths.length === 0) {
    strengths.push('Core agreement obligations were extracted for review.');
  }

  return strengths;
}

function buildConsiderations(
  signals: LeadScoringSignals,
  reportJson: AgreementReportJson,
  settlementComplexityScore: number
): string[] {
  const considerations: string[] = [];

  if (signals.multiPartyDetected) {
    considerations.push(
      'Multi-party structures often rely on spreadsheets and manual transfers without automation.'
    );
  }
  if (reportJson.settlementReadiness.score < 70) {
    considerations.push(
      'Settlement readiness gaps may need clarification before automated payout execution.'
    );
  }
  if (settlementComplexityScore > 40) {
    considerations.push('Higher settlement complexity may require staged rollout of automation.');
  }
  if (signals.revenueSplitCount === 0) {
    considerations.push('No revenue-sharing split rules were identified for automated allocation.');
  }

  return considerations;
}

function buildSummary(input: {
  fitScore: number;
  fitLabel: string;
  recommendedUseCase: LeadRecommendedUseCase;
}): string {
  return `${input.fitLabel} (${input.fitScore}/100). Provvypay is most relevant for ${input.recommendedUseCase.toLowerCase()} workflows based on the extracted agreement structure.`;
}

export function buildProvvypayFit(
  extractionJson: unknown,
  reportJson: AgreementReportJson
): AgreementProvvypayFit {
  const {
    structuralFitScore,
    priorityBand,
    recommendedUseCase,
    settlementComplexityScore,
    signals,
  } = computeStructuralFitScore({ extractionJson, reportJson });

  return {
    fitScore: structuralFitScore,
    priorityBand,
    fitLabel: PRIORITY_FIT_LABELS[priorityBand],
    recommendedUseCase,
    settlementComplexityScore,
    headline: USE_CASE_HEADLINES[recommendedUseCase],
    summary: buildSummary({
      fitScore: structuralFitScore,
      fitLabel: PRIORITY_FIT_LABELS[priorityBand],
      recommendedUseCase,
    }),
    strengths: buildStrengths(signals),
    considerations: buildConsiderations(signals, reportJson, settlementComplexityScore),
    signals: {
      revenueShareDetected: signals.revenueShareDetected,
      hospitalityDetected: signals.hospitalityDetected,
      eventDetected: signals.eventDetected,
      accountantDetected: signals.accountantDetected,
      multiPartyDetected: signals.multiPartyDetected,
    },
  };
}
