import 'server-only';

import { buildSettlementRiskAssessment } from '@/lib/agreement-analyzer/extraction/build-settlement-risk-assessment';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { loggers } from '@/lib/logger';

export function enrichReportJsonWithSettlementRiskAssessment(input: {
  reportJson: AgreementReportJson;
  extractionJson: unknown;
}): AgreementReportJson {
  try {
    const settlementRiskAssessment = buildSettlementRiskAssessment(
      input.extractionJson,
      input.reportJson
    );

    return {
      ...input.reportJson,
      settlementRiskAssessment,
    };
  } catch (error) {
    loggers.api.warn('Settlement risk assessment generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      partyCount: input.reportJson.parties.length,
      riskCount: input.reportJson.risks.length,
    });
    return input.reportJson;
  }
}
