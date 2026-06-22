'use client';

import * as React from 'react';
import { runDemoDownloadPreparation } from '@/lib/demo/demo-download';
import { isDemoModeEnabled } from '@/lib/demo/demo-mode';
import type { MarketingDeliverableTarget } from '@/lib/demo/marketing-download-service';
import {
  downloadMarketingDeliverableAfterPrep,
  executeMarketingDeliverableDownload,
  notifyMarketingDeliverableMissing,
  validateMarketingDeliverableExists,
} from '@/lib/demo/marketing-download-service';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

export function useMarketingDeliverableDownload(
  engine: MarketingJobEngine,
  state: MarketingWorkspaceState
) {
  const [prepOpen, setPrepOpen] = React.useState(false);
  const [prepStep, setPrepStep] = React.useState(0);
  const [prepTarget, setPrepTarget] = React.useState<MarketingDeliverableTarget | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const download = React.useCallback(
    async (target: MarketingDeliverableTarget) => {
      if (downloading) return;

      if (isDemoModeEnabled()) {
        const exists = await validateMarketingDeliverableExists(target, state);
        if (!exists) {
          notifyMarketingDeliverableMissing(target, state);
          return;
        }

        setDownloading(true);
        setPrepTarget(target);
        setPrepStep(0);
        setPrepOpen(true);

        try {
          await runDemoDownloadPreparation(setPrepStep);
          await downloadMarketingDeliverableAfterPrep(target, state);
        } finally {
          setPrepOpen(false);
          setPrepTarget(null);
          setPrepStep(0);
          setDownloading(false);
        }
        return;
      }

      setDownloading(true);
      try {
        await executeMarketingDeliverableDownload(target, { engine, state });
      } finally {
        setDownloading(false);
      }
    },
    [downloading, engine, state]
  );

  return {
    download,
    downloading,
    prepOpen,
    prepStep,
    prepTarget,
  };
}
