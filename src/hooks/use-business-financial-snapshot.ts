'use client';

import * as React from 'react';
import type { AgreementHealthPortfolioSummary, AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import {
  deriveBusinessFinancialSnapshot,
  type BusinessFinancialSnapshot,
} from '@/lib/commercial/business-financial-snapshot';
import {
  loadProjectCommercialFinancialSnapshot,
  type ProjectFinancialRecord,
} from '@/lib/commercial/load-project-commercial-financial-snapshot';
import type { QueueTask } from '@/components/operations/operational-queue';

export type UseBusinessFinancialSnapshotOptions = {
  healthSnapshots: AgreementHealthSnapshot[];
  portfolio: AgreementHealthPortfolioSummary | null;
  priorities?: QueueTask[];
  currency?: string;
  enabled?: boolean;
};

export type BusinessFinancialSnapshotState = {
  business: BusinessFinancialSnapshot | null;
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Loads per-project CommercialFinancialSnapshots and aggregates them into a
 * workspace-level BusinessFinancialSnapshot for the dashboard.
 */
export function useBusinessFinancialSnapshot(
  options: UseBusinessFinancialSnapshotOptions
): BusinessFinancialSnapshotState {
  const enabled = options.enabled ?? true;
  const [projectRecords, setProjectRecords] = React.useState<ProjectFinancialRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const healthSnapshots = options.healthSnapshots;
  const snapshotKey = React.useMemo(
    () => healthSnapshots.map((s) => s.projectId).sort().join(','),
    [healthSnapshots]
  );

  const reload = React.useCallback(async () => {
    if (!enabled || healthSnapshots.length === 0) {
      setProjectRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const records = await Promise.all(
        healthSnapshots.map(async (snap) => {
          const snapshot = await loadProjectCommercialFinancialSnapshot(
            snap.projectId,
            snap.projectId,
            options.currency
          );
          return {
            projectId: snap.projectId,
            agreementName: snap.agreementName,
            snapshot,
          } satisfies ProjectFinancialRecord;
        })
      );
      setProjectRecords(records);
    } catch {
      setProjectRecords([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, snapshotKey, healthSnapshots, options.currency]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const business = React.useMemo(
    () =>
      deriveBusinessFinancialSnapshot({
        projectRecords,
        healthSnapshots,
        portfolio: options.portfolio,
        priorities: options.priorities,
        currency: options.currency,
      }),
    [projectRecords, healthSnapshots, options.portfolio, options.priorities, options.currency]
  );

  return { business, loading, reload };
}
