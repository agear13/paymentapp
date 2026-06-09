import {
  ACCOUNTANT_KEYWORDS,
  EVENT_KEYWORDS,
  HOSPITALITY_KEYWORDS,
  REVENUE_SHARE_KEYWORDS,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-keywords';
import type {
  LeadEngagementSignals,
  LeadPriorityBand,
  LeadRecommendedUseCase,
  LeadScoreComputation,
  LeadScoringSignals,
} from '@/lib/agreement-analyzer/scoring/lead-scoring-types';
import { parsePublicReportJson } from '@/lib/agreement-analyzer/report-types';

const COMPLEXITY_CAP = 100;
const OVERALL_SCORE_CAP = 100;

function countRevenueSplitItems(items: unknown[]): number {
  let count = 0;

  for (const item of items) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      if (Array.isArray(record.splits)) {
        count += record.splits.length;
        continue;
      }
    }
    count += 1;
  }

  return count;
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStringValues);
  }

  return [];
}

function collectSearchableText(values: unknown[]): string {
  return values.flatMap(collectStringValues).join(' ').toLowerCase();
}

function containsKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase());
}

function detectKeywordGroup(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => containsKeyword(text, keyword));
}

export function extractLeadScoringSignals(
  extractionJson: unknown,
  reportJson: unknown
): LeadScoringSignals {
  const report = parsePublicReportJson(reportJson);
  const searchableText = collectSearchableText([extractionJson, reportJson]);

  const partyCount = report?.parties.length ?? 0;
  const obligationCount = report?.obligations.length ?? 0;
  const riskCount = report?.risks.length ?? 0;
  const revenueSplitCount = countRevenueSplitItems(report?.revenueSplits ?? []);
  const paymentConditionCount = report?.paymentConditions.length ?? 0;

  return {
    revenueShareDetected: detectKeywordGroup(searchableText, REVENUE_SHARE_KEYWORDS),
    hospitalityDetected: detectKeywordGroup(searchableText, HOSPITALITY_KEYWORDS),
    eventDetected: detectKeywordGroup(searchableText, EVENT_KEYWORDS),
    accountantDetected: detectKeywordGroup(searchableText, ACCOUNTANT_KEYWORDS),
    multiPartyDetected: partyCount >= 3,
    partyCount,
    obligationCount,
    riskCount,
    revenueSplitCount,
    paymentConditionCount,
  };
}

export function calculateSettlementComplexityScore(signals: LeadScoringSignals): number {
  const raw =
    signals.revenueSplitCount * 5 +
    signals.paymentConditionCount * 3 +
    signals.obligationCount * 2 +
    signals.riskCount * 2;

  return Math.min(COMPLEXITY_CAP, raw);
}

export function calculateStructuralFitScore(
  signals: LeadScoringSignals,
  settlementComplexityScore: number
): number {
  let score = 0;

  if (signals.revenueShareDetected) score += 30;
  if (signals.multiPartyDetected) score += 15;
  if (settlementComplexityScore > 40) score += 15;
  if (settlementComplexityScore > 70) score += 25;
  if (signals.hospitalityDetected) score += 10;
  if (signals.eventDetected) score += 10;
  if (signals.accountantDetected) score += 10;

  return Math.min(OVERALL_SCORE_CAP, score);
}

export function calculateEngagementBonus(engagement: LeadEngagementSignals): number {
  let bonus = 0;

  if (engagement.reportViewed) bonus += 10;
  if (engagement.emailOpened) bonus += 5;
  if (engagement.emailClicked) bonus += 5;
  if (engagement.demoClicked) bonus += 10;
  if (engagement.demoBooked) bonus += 15;

  return bonus;
}

export function calculateOverallLeadScore(
  structuralFitScore: number,
  engagementBonus: number
): number {
  return Math.min(OVERALL_SCORE_CAP, structuralFitScore + engagementBonus);
}

export function resolvePriorityBand(overallScore: number): LeadPriorityBand {
  if (overallScore >= 90) return 'IDEAL_ICP';
  if (overallScore >= 70) return 'HIGH';
  if (overallScore >= 40) return 'MEDIUM';
  return 'LOW';
}

export function resolveRecommendedUseCase(signals: LeadScoringSignals): LeadRecommendedUseCase {
  if (signals.revenueShareDetected && signals.eventDetected) {
    return 'Event Revenue Sharing';
  }
  if (signals.revenueShareDetected && signals.hospitalityDetected) {
    return 'Venue Settlement';
  }
  if (signals.accountantDetected) {
    return 'Client Fund Coordination';
  }
  if (signals.multiPartyDetected) {
    return 'Multi Party Settlement';
  }
  return 'Obligation Management';
}

export function computeLeadScore(input: {
  extractionJson: unknown;
  reportJson: unknown;
  engagement?: Partial<LeadEngagementSignals>;
}): LeadScoreComputation {
  const signals = extractLeadScoringSignals(input.extractionJson, input.reportJson);
  const engagement: LeadEngagementSignals = {
    reportViewed: input.engagement?.reportViewed ?? false,
    emailOpened: input.engagement?.emailOpened ?? false,
    emailClicked: input.engagement?.emailClicked ?? false,
    demoClicked: input.engagement?.demoClicked ?? false,
    demoBooked: input.engagement?.demoBooked ?? false,
  };

  const settlementComplexityScore = calculateSettlementComplexityScore(signals);
  const structuralFitScore = calculateStructuralFitScore(signals, settlementComplexityScore);
  const engagementBonus = calculateEngagementBonus(engagement);
  const overallScore = calculateOverallLeadScore(structuralFitScore, engagementBonus);

  return {
    signals,
    engagement,
    settlementComplexityScore,
    structuralFitScore,
    engagementBonus,
    overallScore,
    priorityBand: resolvePriorityBand(overallScore),
    recommendedUseCase: resolveRecommendedUseCase(signals),
  };
}
