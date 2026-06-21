'use client';

import * as React from 'react';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import {
  disposeMarketingJobEngine,
  getOrCreateMarketingJobEngine,
  type MarketingJobEngine,
} from '@/lib/marketing-jobs/job-engine';

type UseMarketingJobsInput = {
  companyId: string;
  companyName: string;
};

type UseMarketingJobsResult = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

export function useMarketingJobs(input: UseMarketingJobsInput): UseMarketingJobsResult {
  const engine = React.useMemo(
    () => getOrCreateMarketingJobEngine(input),
    [input.companyId, input.companyName]
  );

  const [state, setState] = React.useState<MarketingWorkspaceState>(() => engine.getState());

  React.useEffect(() => {
    setState(engine.getState());
    return engine.subscribe(setState);
  }, [engine]);

  React.useEffect(() => {
    return () => {
      disposeMarketingJobEngine(input.companyId);
    };
  }, [input.companyId]);

  return { state, engine };
}
