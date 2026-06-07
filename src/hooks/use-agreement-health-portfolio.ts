'use client';

import * as React from 'react';
import type {
  AgreementHealthPortfolioSummary,
  AgreementHealthSnapshot,
} from '@/lib/agreements/health/agreement-health.types';
import { summarizeAgreementHealthPortfolio } from '@/lib/agreements/health/agreement-health-portfolio';
import { loadAgreementHealthPortfolio } from '@/lib/agreements/health/load-agreement-health-portfolio';

export function useAgreementHealthPortfolio(options?: { enabled?: boolean; recordTrend?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [loading, setLoading] = React.useState(true);
  const [snapshots, setSnapshots] = React.useState<AgreementHealthSnapshot[]>([]);
  const [portfolio, setPortfolio] = React.useState<AgreementHealthPortfolioSummary | null>(null);

  const reload = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const next = await loadAgreementHealthPortfolio({
        recordTrend: options?.recordTrend ?? true,
      });
      setSnapshots(next);
      setPortfolio(summarizeAgreementHealthPortfolio(next));
    } finally {
      setLoading(false);
    }
  }, [enabled, options?.recordTrend]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, snapshots, portfolio, reload };
}
