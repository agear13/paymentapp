'use client';

import { CheckCircle2, Download, FileSearch, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDemoCampaignDeliverables } from '@/lib/demo/demo-reports';
import { useMarketingDeliverableDownload } from '@/hooks/use-marketing-deliverable-download';
import { DemoDownloadPreparationDialog } from '@/components/marketing-labs/demo-download-preparation-dialog';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

type CampaignStrategyReadyPanelProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
  onApprove: () => void;
};

export function CampaignStrategyReadyPanel({
  state,
  engine,
  onApprove,
}: CampaignStrategyReadyPanelProps) {
  const deliverables = getDemoCampaignDeliverables({
    campaignId: state.campaignContext.campaign.id,
    companyName: state.campaignContext.company.name,
    campaignTitle: state.campaignContext.campaign.title,
  });
  const strategy = deliverables.reports.strategy;
  const { download, downloading, prepOpen, prepStep, prepTarget } = useMarketingDeliverableDownload(
    engine,
    state
  );

  return (
    <>
      <DemoDownloadPreparationDialog open={prepOpen} step={prepStep} target={prepTarget} />

      <section
        id="campaign-strategy-ready"
        className="scroll-mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.05] to-background shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              <CardTitle className="text-lg">Campaign Strategy Ready for Approval</CardTitle>
            </div>
            <CardDescription>
              Phase 1 complete — your AI Marketing Team has finished research, SEO, and campaign planning.
              Review the strategy report, then approve to begin creative production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSearch className="size-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{strategy.title}</p>
                  <p className="text-xs font-medium text-primary">{strategy.statusLabel}</p>
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {strategy.includes.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3 shrink-0 text-primary/70" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void download('strategy')}
                disabled={downloading}
              >
                <Download className="mr-2 size-4" />
                Download Campaign Strategy Report
              </Button>
              <Button
                variant="secondary"
                onClick={() => void download('strategy')}
                disabled={downloading}
              >
                <FileSearch className="mr-2 size-4" />
                Review Campaign Package
              </Button>
              <Button onClick={onApprove} disabled={downloading}>
                <Send className="mr-2 size-4" />
                Approve Campaign Package
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Creative assets are not included at this stage. Approving dispatches the package to the AI
              Creative Team for production.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
