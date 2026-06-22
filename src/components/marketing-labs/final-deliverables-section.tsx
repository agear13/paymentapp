'use client';

import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buildCampaignCompletion } from '@/lib/marketing-jobs/command-centre';
import { CampaignDeliverableDownloads } from '@/components/marketing-labs/campaign-deliverable-downloads';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

type FinalDeliverablesSectionProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

export function FinalDeliverablesSection({ state, engine }: FinalDeliverablesSectionProps) {
  const completion = buildCampaignCompletion(state);

  return (
    <section
      id="final-deliverables"
      className="scroll-mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.04] via-background to-[rgba(29,111,66,0.03)] shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            <CardTitle className="text-lg">Final Deliverables</CardTitle>
          </div>
          <CardDescription>
            Your AI marketing agency has completed the campaign — polished reports and packages ready for
            client approval and publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {completion ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                `${completion.creativeAssetsProduced} Creative Assets`,
                `${completion.campaignDocuments} Campaign Documents`,
                'Client Report Ready',
                'AI Team Performance Report Ready',
                completion.qualityAssurance === 'Passed'
                  ? 'Quality Assurance Passed'
                  : 'Quality Assurance Pending',
                `Brand Compliance ${completion.brandCompliance}%`,
                `Knowledge Coverage ${completion.knowledgeCoverage}%`,
              ].map((line) => (
                <li key={line} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-[rgb(29,111,66)]" />
                  <span className="font-medium">{line}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-lg border border-primary/15 bg-primary/[0.03] px-4 py-3">
            <p className="text-xs text-muted-foreground">Estimated Time Saved</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {completion?.estimatedTimeSavedHours ?? 11.2} Hours
            </p>
          </div>

          <CampaignDeliverableDownloads state={state} engine={engine} variant="final" />
        </CardContent>
      </Card>
    </section>
  );
}
