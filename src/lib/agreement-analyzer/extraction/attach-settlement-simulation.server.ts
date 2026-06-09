import 'server-only';

import { buildSettlementSimulation } from '@/lib/agreement-analyzer/extraction/build-settlement-simulation';
import type { AgreementReportJson } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { loggers } from '@/lib/logger';

export function enrichReportJsonWithSettlementSimulation(input: {
  reportJson: AgreementReportJson;
  extractionJson: unknown;
}): AgreementReportJson {
  try {
    const settlementSimulation = buildSettlementSimulation(
      input.reportJson,
      input.extractionJson
    );

    return {
      ...input.reportJson,
      settlementSimulation,
    };
  } catch (error) {
    loggers.api.warn('Settlement simulation generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      partyCount: input.reportJson.parties.length,
      revenueSplitCount: input.reportJson.revenueSplits.length,
    });
    return input.reportJson;
  }
}
