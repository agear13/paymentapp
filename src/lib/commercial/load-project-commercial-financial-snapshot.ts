/**
 * Loads a per-project CommercialFinancialSnapshot from existing commercial inputs.
 * Used by the business dashboard to aggregate project snapshots — no duplicate math.
 */

import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import {
  deriveCommercialFinancialSnapshot,
  type CommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import { loadCommercialFinancialInputs } from '@/lib/commercial/load-commercial-financial-inputs';
import { deriveReleaseConfidence } from '@/lib/operations/explainability/release-confidence';
import { defaultWorkspaceContext } from '@/lib/operations/types/operational-context';

export async function loadProjectCommercialFinancialSnapshot(
  projectId: string,
  dealId: string,
  currency = 'AUD'
): Promise<CommercialFinancialSnapshot> {
  const inputs = await loadCommercialFinancialInputs(projectId, dealId);
  const treasury = inputs.treasury;
  const resolvedCurrency = treasury?.currency ?? currency;

  const releaseConfidence = treasury
    ? deriveReleaseConfidence({
        workspace: {
          ...defaultWorkspaceContext(),
          defaultCurrency: resolvedCurrency,
          obligationCount: treasury.obligationsTotal ?? inputs.obligationRows.length,
          releaseEligibleCount: treasury.obligationsReady ?? 0,
        },
        treasury,
        currency: resolvedCurrency,
      })
    : null;

  return deriveCommercialFinancialSnapshot({
    projectId,
    dealId,
    fundingSources: inputs.fundingSources,
    treasury,
    obligationRows: inputs.obligationRows,
    releaseConfidence,
    currency: resolvedCurrency,
    kpis: null,
    decision: null,
  });
}

export type ProjectFinancialRecord = {
  projectId: string;
  agreementName: string;
  snapshot: CommercialFinancialSnapshot;
};
