'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import { buildCampaignInsights, isCreativeAssetsReady } from '@/lib/marketing-jobs/campaign-lifecycle';

type CampaignInsightsSectionProps = {
  state: MarketingWorkspaceState;
};

function InsightMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function CampaignInsightsSection({ state }: CampaignInsightsSectionProps) {
  if (!isCreativeAssetsReady(state)) return null;

  const insights = buildCampaignInsights(state);
  if (!insights) return null;

  return (
    <section id="campaign-insights" className="scroll-mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Campaign Insights</h2>
          <p className="text-sm text-muted-foreground">Planning estimates for this campaign cycle.</p>
        </div>
        <Badge variant="outline">AI Projections</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projected performance</CardTitle>
          <CardDescription>
            These are AI planning estimates — not live analytics. Actual results will vary.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InsightMetric label="Expected Organic Reach" value={insights.expectedOrganicReach.toLocaleString()} />
          <InsightMetric label="Expected Website Visits" value={insights.expectedWebsiteVisits.toLocaleString()} />
          <InsightMetric label="Estimated Leads" value={insights.estimatedLeads} />
          <InsightMetric label="Estimated Production Saving" value={`${insights.estimatedProductionSavingHours} Hours`} />
          <InsightMetric label="Knowledge Gaps Identified" value={insights.knowledgeGapsIdentified} />
          <InsightMetric label="Recommendations" value={insights.recommendations} />
        </CardContent>
      </Card>
    </section>
  );
}
