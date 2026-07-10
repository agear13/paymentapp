'use client';

import * as React from 'react';
import type { CommercialDecisionResult } from '@/components/workflow/commercial-decision-engine';
import {
  aggregateCommercialFinancialSnapshots,
  deriveCommercialFinancialSnapshot,
  type CommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import { loadCommercialFinancialInputs } from '@/lib/commercial/load-commercial-financial-inputs';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';

export type UseCommercialFinancialSnapshotOptions = {
  /** Single agreement scope. */
  projectId?: string | null;
  dealId?: string | null;
  /** Multi-agreement workspace scope. */
  agreements?: Array<{ projectId: string; dealId: string }>;
  currency?: string;
  releaseConfidence?: ReleaseConfidenceSnapshot | null;
  kpis?: OperationalKPIs | null;
  decision?: CommercialDecisionResult | null;
  enabled?: boolean;
};

export type CommercialFinancialSnapshotState = {
  snapshot: CommercialFinancialSnapshot | null;
  treasury: ProjectTreasurySummary | null;
  fundingSources: ProjectFundingSourceDto[];
  obligationRows: BriefingObligationRowInput[];
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Loads authoritative commercial inputs and derives the unified financial snapshot.
 * Dashboard and agreement pages must both use this hook.
 */
export function useCommercialFinancialSnapshot(
  options: UseCommercialFinancialSnapshotOptions = {}
): CommercialFinancialSnapshotState {
  const enabled = options.enabled ?? true;
  const currency = options.currency ?? options.releaseConfidence?.currency ?? 'AUD';

  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [fundingSources, setFundingSources] = React.useState<ProjectFundingSourceDto[]>([]);
  const [obligationRows, setObligationRows] = React.useState<BriefingObligationRowInput[]>([]);
  const [multiSnapshots, setMultiSnapshots] = React.useState<CommercialFinancialSnapshot[]>([]);
  const [loading, setLoading] = React.useState(true);

  const agreements = options.agreements;
  const singleProjectId = options.projectId;
  const singleDealId = options.dealId;

  const reload = React.useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (agreements && agreements.length > 0) {
        const results = await Promise.all(
          agreements.map(async ({ projectId, dealId }) => {
            const inputs = await loadCommercialFinancialInputs(projectId, dealId);
            return deriveCommercialFinancialSnapshot({
              projectId,
              dealId,
              fundingSources: inputs.fundingSources,
              treasury: inputs.treasury,
              obligationRows: inputs.obligationRows,
              releaseConfidence: options.releaseConfidence ?? null,
              currency,
              kpis: options.kpis ?? null,
              decision: options.decision ?? null,
            });
          })
        );
        setMultiSnapshots(results);
        setTreasury(null);
        setFundingSources([]);
        setObligationRows([]);
        return;
      }

      if (!singleProjectId || !singleDealId) {
        setTreasury(null);
        setFundingSources([]);
        setObligationRows([]);
        setMultiSnapshots([]);
        return;
      }

      const inputs = await loadCommercialFinancialInputs(singleProjectId, singleDealId);
      setTreasury(inputs.treasury);
      setFundingSources(inputs.fundingSources);
      setObligationRows(inputs.obligationRows);
      setMultiSnapshots([]);
    } catch {
      setTreasury(null);
      setFundingSources([]);
      setObligationRows([]);
      setMultiSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    agreements,
    singleProjectId,
    singleDealId,
    currency,
    options.releaseConfidence,
    options.kpis,
    options.decision,
  ]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const snapshot = React.useMemo<CommercialFinancialSnapshot | null>(() => {
    if (multiSnapshots.length > 0) {
      return aggregateCommercialFinancialSnapshots(multiSnapshots, currency);
    }

    if (!singleProjectId || !singleDealId) return null;

    return deriveCommercialFinancialSnapshot({
      projectId: singleProjectId,
      dealId: singleDealId,
      fundingSources,
      treasury,
      obligationRows,
      releaseConfidence: options.releaseConfidence ?? null,
      currency,
      kpis: options.kpis ?? null,
      decision: options.decision ?? null,
    });
  }, [
    multiSnapshots,
    singleProjectId,
    singleDealId,
    fundingSources,
    treasury,
    obligationRows,
    options.releaseConfidence,
    options.kpis,
    options.decision,
    currency,
  ]);

  return {
    snapshot,
    treasury,
    fundingSources,
    obligationRows,
    loading,
    reload,
  };
}
