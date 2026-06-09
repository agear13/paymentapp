import { formatReportItem } from '@/lib/agreement-analyzer/format-report-items';
import { extractLeadScoringSignals } from '@/lib/agreement-analyzer/scoring/lead-scoring-engine';
import type {
  AgreementReportJson,
  AgreementSettlementRiskAssessment,
  AgreementSettlementRiskLevel,
} from '@/lib/agreement-analyzer/extraction/extraction-types';

const RISK_SCORE_CAP = 100;

const POTENTIAL_IMPACT: Record<AgreementSettlementRiskLevel, string> = {
  LOW: 'Minor operational ambiguities detected.',
  MEDIUM:
    'These issues may create settlement delays or manual reconciliation work.',
  HIGH: 'These issues could result in payment disputes, delayed settlements, reconciliation overhead, or incorrect revenue allocation.',
};

const RECOMMENDATION: Record<AgreementSettlementRiskLevel, string> = {
  LOW: 'Continue monitoring settlement processes.',
  MEDIUM: 'Review agreement gaps before future settlements.',
  HIGH: 'Consider formalising settlement rules and automating settlement workflows.',
};

function resolveRiskLevel(riskScore: number): AgreementSettlementRiskLevel {
  if (riskScore <= 30) return 'LOW';
  if (riskScore <= 60) return 'MEDIUM';
  return 'HIGH';
}

function formatIssueItem(item: unknown): string {
  const formatted = formatReportItem(item).trim();
  return formatted.length > 0 ? formatted : 'Unspecified agreement issue';
}

function collectUniqueIssues(reportJson: AgreementReportJson): string[] {
  const issues: string[] = [];

  for (const item of [...reportJson.risks, ...reportJson.missingInformation]) {
    const formatted = formatIssueItem(item);
    if (!issues.includes(formatted)) {
      issues.push(formatted);
    }
    if (issues.length >= 5) {
      break;
    }
  }

  return issues;
}

export function buildSettlementRiskAssessment(
  extractionJson: unknown,
  reportJson: AgreementReportJson
): AgreementSettlementRiskAssessment {
  const signals = extractLeadScoringSignals(extractionJson, reportJson);
  const readinessScore = reportJson.settlementReadiness.score;
  const partyCount = reportJson.parties.length;

  let riskScore = 0;

  riskScore += reportJson.risks.length * 12;
  riskScore += reportJson.missingInformation.length * 8;

  if (readinessScore < 50) {
    riskScore += 20;
  }
  if (readinessScore < 25) {
    riskScore += 15;
  }

  if (signals.revenueShareDetected) {
    riskScore += 10;
  }

  if (partyCount >= 3) {
    riskScore += 10;
  }

  riskScore = Math.min(RISK_SCORE_CAP, riskScore);

  const riskLevel = resolveRiskLevel(riskScore);
  const issues = collectUniqueIssues(reportJson);

  return {
    riskScore,
    riskLevel,
    issueCount: issues.length,
    issues,
    potentialImpact: POTENTIAL_IMPACT[riskLevel],
    recommendation: RECOMMENDATION[riskLevel],
  };
}
