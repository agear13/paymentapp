'use client';

import * as React from 'react';
import { ImagePlus, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingJob, MarketingWorkspaceState } from '@/lib/marketing-jobs/types';
import {
  getActiveStageLabel,
  isVisualJobInFlight,
  isVisualJobReadyForDispatch,
  readAssetsJsonFile,
  selectVisualGenerationJob,
} from '@/lib/marketing-jobs';
import { CreativeDispatchDialog } from '@/components/marketing-labs/creative-dispatch-dialog';
import { CampaignPackageCard } from '@/components/marketing-labs/campaign-package-card';

type VisualGenerationSectionProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
};

export function VisualGenerationSection({ state, engine }: VisualGenerationSectionProps) {
  const [busy, setBusy] = React.useState(false);
  const [dispatchOpen, setDispatchOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const visualJob = selectVisualGenerationJob(state.jobs);
  const visualInFlight = state.jobs.some(isVisualJobInFlight);
  const readyForDispatch = visualJob ? isVisualJobReadyForDispatch(visualJob) : false;
  const alreadyDispatched = state.creativeDispatch.status === 'dispatched';

  const handleGenerateVisuals = () => {
    try {
      engine.createVisualGenerationJob();
      toast.success('AI Creative Team assigned — visual generation job queued.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create visual generation job.');
    }
  };

  const handleDispatchConfirm = () => {
    try {
      engine.dispatchToCreativeTeam(visualJob?.id);
      setDispatchOpen(false);
      toast.success('Campaign package dispatched to the AI Creative Team.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not dispatch campaign package.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const raw = await readAssetsJsonFile(file);
      const result = engine.importGeneratedAssets(raw);
      toast.success(`Imported ${result.importedCount} asset${result.importedCount === 1 ? '' : 's'}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import assets.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="visual-generation" className="scroll-mt-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Visual Generation</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Dispatch campaign planning to the AI Creative Team, then import completed assets back into
          Provvypay.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Creative Team</CardTitle>
          <CardDescription>Campaign: {state.campaignContext.campaign.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visualJob ? (
            <VisualJobProgress job={visualJob} dispatched={alreadyDispatched} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Start visual generation to activate the AI Creative Team workflow.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3 border-t pt-6">
          <Button onClick={handleGenerateVisuals} disabled={visualInFlight}>
            <ImagePlus className="mr-2 size-4" />
            Generate Visuals
          </Button>
          <Button
            variant="default"
            onClick={() => setDispatchOpen(true)}
            disabled={!readyForDispatch || alreadyDispatched}
          >
            <Send className="mr-2 size-4" />
            Dispatch to AI Creative Team
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={busy}>
            <Upload className="mr-2 size-4" />
            Import Generated Assets
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </CardFooter>
      </Card>

      <CampaignPackageCard state={state} />

      <CreativeDispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        onConfirm={handleDispatchConfirm}
      />
    </section>
  );
}

function VisualJobProgress({ job, dispatched }: { job: MarketingJob; dispatched: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{getActiveStageLabel(job)}</Badge>
        <span className="text-muted-foreground tabular-nums">{job.progress}%</span>
        {dispatched ? (
          <span className="text-[rgb(29,111,66)]">Dispatched to AI Creative Team</span>
        ) : isVisualJobReadyForDispatch(job) ? (
          <span className="text-muted-foreground">Ready for dispatch</span>
        ) : null}
      </div>
      <Progress value={job.progress} className="h-2" />
    </div>
  );
}
