import 'server-only';

import { getAgreementExtractionProvider } from '@/lib/agreement-analyzer/ai/get-agreement-extraction-provider';
import type { ExecutiveSummaryGenerationInput } from '@/lib/agreement-analyzer/ai/types';
import { buildExecutiveSummaryStructuredInput } from '@/lib/agreement-analyzer/extraction/core/build-executive-summary-input';
import type {
  AgreementExecutiveSummary,
  AgreementReportJson,
} from '@/lib/agreement-analyzer/extraction/extraction-types';
import { loggers } from '@/lib/logger';

export type GenerateExecutiveSummaryInput = ExecutiveSummaryGenerationInput;

export async function generateExecutiveSummary(
  input: GenerateExecutiveSummaryInput
): Promise<AgreementExecutiveSummary | null> {
  const provider = getAgreementExtractionProvider('claude');

  if (!provider.isConfigured()) {
    loggers.api.warn('Executive summary skipped — Claude provider is not configured');
    return null;
  }

  try {
    const result = await provider.generateExecutiveSummary(input);
    return result.summary;
  } catch (error) {
    loggers.api.warn('Executive summary generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      settlementReadinessScore: input.settlementReadinessScore,
      partyCount: input.reportJson.parties.length,
      obligationCount: input.reportJson.obligations.length,
    });
    return null;
  }
}

export async function enrichReportJsonWithExecutiveSummary(input: {
  extractionJson: unknown;
  reportJson: AgreementReportJson;
  settlementReadinessScore: number;
}): Promise<AgreementReportJson> {
  const executiveSummary = await generateExecutiveSummary({
    extractionJson: input.extractionJson,
    reportJson: input.reportJson,
    settlementReadinessScore: input.settlementReadinessScore,
  });

  if (!executiveSummary) {
    return input.reportJson;
  }

  return {
    ...input.reportJson,
    executiveSummary,
  };
}

export { buildExecutiveSummaryStructuredInput };
