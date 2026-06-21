'use client';

import * as React from 'react';
import { Megaphone } from 'lucide-react';
import { useMarketingJobs } from '@/hooks/use-marketing-jobs';
import { MARKETING_DEMO_BRAND } from '@/lib/marketing-jobs/demo-brand';
import { MarketingCommandCentre } from '@/components/marketing-labs/marketing-command-centre';
import { MarketingOperationsSection } from '@/components/marketing-labs/marketing-operations-section';
import { CampaignAssetsSection } from '@/components/marketing-labs/campaign-assets-section';
import { CampaignInsightsSection } from '@/components/marketing-labs/campaign-insights-section';
import { AiTeamPerformanceSection } from '@/components/marketing-labs/ai-team-performance-section';
import { NextRecommendedCampaignSection } from '@/components/marketing-labs/next-recommended-campaign-section';
import { MarketingRoadmapSection } from '@/components/marketing-labs/marketing-roadmap-section';
import { CompanyBrainSection } from '@/components/marketing-labs/company-brain-section';
import { CampaignsSection } from '@/components/marketing-labs/campaigns-section';
import { MarketingDashboardSection } from '@/components/marketing-labs/marketing-dashboard-section';
import { MarketingWalkthrough, MarketingWalkthroughReplayButton } from '@/components/marketing-labs/marketing-walkthrough';
import { MarketingDemoPanel } from '@/components/marketing-labs/marketing-demo-panel';
import type { MarketingImportReveal } from '@/components/marketing-labs/marketing-import-reveal';

/** Delay before Creative Assets table fades in after import celebration. */
const ASSETS_TABLE_REVEAL_MS = 1_800;

export type { MarketingImportReveal };

type MarketingPageClientProps = {
  companyId: string;
  companyName: string;
};

export function MarketingPageClient({ companyId, companyName }: MarketingPageClientProps) {
  const { state, engine } = useMarketingJobs({ companyId, companyName });
  const [importReveal, setImportReveal] = React.useState<MarketingImportReveal | null>(null);
  const revealTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  const handleAssetsImported = React.useCallback((importedCount: number) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setImportReveal({ importedCount, tableRevealed: false });
    revealTimerRef.current = setTimeout(() => {
      setImportReveal((prev) => (prev ? { ...prev, tableRevealed: true } : null));
    }, ASSETS_TABLE_REVEAL_MS);
  }, []);

  return (
    <div className="space-y-14 pb-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{MARKETING_DEMO_BRAND} Marketing</h1>
              <p className="text-sm text-muted-foreground">
                Your AI marketing operating system — Company Brain to publishing, in one place.
              </p>
            </div>
          </div>
          <MarketingWalkthroughReplayButton />
        </div>
        <MarketingWalkthrough />
      </div>

      <MarketingCommandCentre
        state={state}
        engine={engine}
        importReveal={importReveal}
        onAssetsImported={handleAssetsImported}
      />
      <MarketingOperationsSection state={state} engine={engine} />
      <CampaignAssetsSection state={state} importReveal={importReveal} />
      <CompanyBrainSection />
      <CampaignsSection engine={engine} />
      <CampaignInsightsSection state={state} />
      <AiTeamPerformanceSection state={state} engine={engine} />
      <NextRecommendedCampaignSection state={state} engine={engine} />
      <MarketingRoadmapSection state={state} />
      <MarketingDashboardSection state={state} />
      <MarketingDemoPanel engine={engine} />
    </div>
  );
}
