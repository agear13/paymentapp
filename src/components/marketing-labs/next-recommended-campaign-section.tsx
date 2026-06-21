'use client';

import { Play } from 'lucide-react';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';
import { MarketingActionButton } from '@/components/marketing-labs/marketing-action-button';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { buildNextCampaignRecommendation, isCreativeAssetsReady } from '@/lib/marketing-jobs/campaign-lifecycle';

type NextRecommendedCampaignSectionProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

export function NextRecommendedCampaignSection({ state, engine }: NextRecommendedCampaignSectionProps) {
  if (!isCreativeAssetsReady(state)) return null;

  const recommendation = buildNextCampaignRecommendation();
  const canGenerate =
    state.campaignLifecycle.phase === 'operations_complete' ||
    state.campaignLifecycle.publishingApproval.status === 'approved';

  const handleGenerate = async () => {
    try {
      engine.generateRecommendedCampaign();
      marketingToasts.campaignGenerated();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Could not start campaign.');
      throw error;
    }
  };

  return (
    <section id="next-campaign" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Next Recommended Campaign</h2>
        <p className="text-sm text-muted-foreground">Continuous growth — your AI marketing roadmap.</p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Recommended topic</CardTitle>
          <CardDescription>Deterministic recommendation — replace with AI engine in a future phase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground">Topic</p>
            <p className="text-lg font-semibold">{recommendation.topic}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {recommendation.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Est. organic traffic" value={recommendation.estimatedOrganicTraffic.toLocaleString()} />
            <Metric label="Est. assets" value={String(recommendation.estimatedAssets)} />
            <Metric label="Est. production time" value={`${recommendation.estimatedProductionMinutes} min`} />
            <Metric label="Business goal" value={recommendation.businessGoal} />
          </div>

          <MarketingActionButton
            idleLabel={
              <>
                <Play className="mr-2 size-4" />
                Generate Campaign
              </>
            }
            loadingLabel="Generating…"
            successLabel="Campaign created ✓"
            onAction={handleGenerate}
            disabled={!canGenerate}
          />
          {!canGenerate ? (
            <p className="text-xs text-muted-foreground">
              Approve publishing to unlock the next campaign recommendation.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
