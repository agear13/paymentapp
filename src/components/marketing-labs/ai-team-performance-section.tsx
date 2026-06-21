'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import { buildAiTeamPerformance } from '@/lib/marketing-jobs/command-centre';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import { MARKETING_EMPTY_STATES } from '@/lib/marketing-labs/empty-states';
import { MarketingContextualLoader } from '@/components/marketing-labs/marketing-contextual-loader';

type AiTeamPerformanceSectionProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

function PerformanceMetric({
  label,
  value,
  suffix = '%',
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  const numeric = typeof value === 'number';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value}
          {numeric ? suffix : ''}
        </span>
      </div>
      {numeric ? <Progress value={value} className="h-1.5 transition-all duration-500" /> : null}
    </div>
  );
}

export function AiTeamPerformanceSection({ state, engine }: AiTeamPerformanceSectionProps) {
  const metrics = buildAiTeamPerformance(state);
  const showFullReport = state.creativeDispatch.creativeProductionStatus === 'complete';

  return (
    <section id="ai-team-performance" className="scroll-mt-6 space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI Team Performance Report</h2>
        <p className="text-sm text-muted-foreground">
          Quality, compliance, and efficiency from your AI Marketing Team specialists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance summary</CardTitle>
          <CardDescription>
            {showFullReport
              ? 'Final metrics match your downloadable AI Team Performance Report.'
              : 'Scores update as the AI Marketing Team completes campaign planning.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showFullReport ? (
            <div className="space-y-4">
              <MarketingContextualLoader context="reports" />
              <MarketingEmptyState content={MARKETING_EMPTY_STATES.aiPerformance} ctaHref="#marketing-command-centre" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <PerformanceMetric label="Business Knowledge Coverage" value={metrics.businessKnowledgeCoverage} />
                <PerformanceMetric label="Brand Compliance" value={metrics.brandCompliance} />
                <PerformanceMetric label="Content Quality" value={metrics.contentQuality} />
                <PerformanceMetric label="Creative Readiness" value={metrics.creativeReadiness} />
                <PerformanceMetric label="Marketing Confidence" value={metrics.marketingConfidence} />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Overall AI Team Performance</p>
                  <p className="text-2xl font-bold tabular-nums">{metrics.overallPerformance}%</p>
                </div>
                <Progress value={metrics.overallPerformance} className="mt-3 h-2" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Est. human time saved</p>
                  <p className="text-lg font-semibold tabular-nums">{metrics.estimatedHumanTimeSavedHours} hours</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Creative Assets produced</p>
                  <p className="text-lg font-semibold tabular-nums">{metrics.assetsProduced}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recommendations generated</p>
                  <p className="text-lg font-semibold tabular-nums">{metrics.recommendationsGenerated}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Knowledge gaps identified</p>
                  <p className="text-lg font-semibold tabular-nums">{metrics.knowledgeGapsIdentified}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => engine.downloadClientReport()}>
                  Download Client Report
                </Button>
                <Button variant="outline" size="sm" onClick={() => engine.downloadAiTeamReport()}>
                  Download AI Team Performance Report
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
