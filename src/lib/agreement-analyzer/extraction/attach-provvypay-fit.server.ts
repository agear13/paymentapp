import 'server-only';

import { trackAgreementAnalyzerEvent } from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';
import { buildProvvypayFit } from '@/lib/agreement-analyzer/extraction/build-provvypay-fit';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { loggers } from '@/lib/logger';

export function enrichReportJsonWithProvvypayFit(input: {
  reportJson: AgreementReportJson;
  extractionJson: unknown;
}): AgreementReportJson {
  try {
    const provvypayFit = buildProvvypayFit(input.extractionJson, input.reportJson);

    trackAgreementAnalyzerEvent('agreement_structural_fit_calculated', {
      structuralFitScore: provvypayFit.fitScore,
      priorityBand: provvypayFit.priorityBand,
      recommendedUseCase: provvypayFit.recommendedUseCase,
    });

    return {
      ...input.reportJson,
      provvypayFit,
    };
  } catch (error) {
    loggers.api.warn('Provvypay fit generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      partyCount: input.reportJson.parties.length,
      revenueSplitCount: input.reportJson.revenueSplits.length,
    });
    return input.reportJson;
  }
}
