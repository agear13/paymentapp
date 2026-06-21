'use client';

import * as React from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Upload,
} from 'lucide-react';
import { marketingToasts } from '@/lib/marketing-jobs/notifications';
import { MarketingActionButton } from '@/components/marketing-labs/marketing-action-button';
import { MarketingContextualLoader } from '@/components/marketing-labs/marketing-contextual-loader';
import { MarketingEmptyState } from '@/components/marketing-labs/marketing-empty-state';
import { MARKETING_EMPTY_STATES } from '@/lib/marketing-labs/empty-states';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MarketingJobEngine } from '@/lib/marketing-jobs/job-engine';
import type { MarketingWorkspaceState, SpecialistPipelineEntry } from '@/lib/marketing-jobs/types';
import {
  buildActivityFeed,
  buildApprovalSummary,
  buildCampaignCompletion,
  buildCampaignStatus,
  buildPackageHealthView,
  buildProductionFeedMessages,
  buildSpecialistPipeline,
  getSpecialistDetail,
  readAssetsJsonFile,
  selectVisualGenerationJob,
} from '@/lib/marketing-jobs';
import { getDispatchManifestItems } from '@/lib/marketing-jobs/creative-team';
import { isVisualJobInFlight, isVisualJobReadyForDispatch } from '@/lib/marketing-jobs/simulation';
import { getSpecialistIcon } from '@/components/marketing-labs/specialist-icon';
import { CreativeProductionCompletePanel } from '@/components/marketing-labs/creative-production-complete-panel';
import type { MarketingImportReveal } from '@/components/marketing-labs/marketing-import-reveal';
import { selectReadyAssetCount } from '@/lib/marketing-jobs/job-engine';

type MarketingCommandCentreProps = {
  state: MarketingWorkspaceState;
  engine: MarketingJobEngine;
  importReveal?: MarketingImportReveal | null;
  onAssetsImported?: (importedCount: number) => void;
};

function statusBadgeClass(status: SpecialistPipelineEntry['status']): string {
  switch (status) {
    case 'completed':
      return 'border-[rgba(29,111,66,0.35)] bg-[rgba(29,111,66,0.06)] text-[rgb(29,111,66)]';
    case 'working':
      return 'border-primary/35 bg-primary/5 text-primary';
    default:
      return '';
  }
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function MarketingCommandCentre({
  state,
  engine,
  importReveal,
  onAssetsImported,
}: MarketingCommandCentreProps) {
  const [busy, setBusy] = React.useState(false);
  const [approvalOpen, setApprovalOpen] = React.useState(false);
  const [selectedSpecialistId, setSelectedSpecialistId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const visualJob = selectVisualGenerationJob(state.jobs);
  const campaignStatus = buildCampaignStatus(state, visualJob);
  const pipeline = buildSpecialistPipeline(visualJob);
  const activityFeed = buildActivityFeed(visualJob);
  const productionFeed = buildProductionFeedMessages(visualJob);
  const packageHealth = buildPackageHealthView(visualJob);
  const approvalSummary = buildApprovalSummary(state, visualJob);
  const completion = buildCampaignCompletion(state);
  const inFlight = state.jobs.some(isVisualJobInFlight);
  const readyForApproval = Boolean(visualJob && isVisualJobReadyForDispatch(visualJob));
  const specialistDetail = selectedSpecialistId ? getSpecialistDetail(selectedSpecialistId) : null;

  const scrollTo = (hash: string) => () => {
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartTeam = async () => {
    try {
      engine.createVisualGenerationJob();
      marketingToasts.teamStarted(scrollTo('#marketing-command-centre'));
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Could not start the AI Marketing Team.');
      throw error;
    }
  };

  const handleApproveDispatch = async () => {
    try {
      engine.approveAndDispatch(visualJob?.id);
      setApprovalOpen(false);
      marketingToasts.dispatchStarted();
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Dispatch failed.');
      throw error;
    }
  };

  const handleRevision = async () => {
    try {
      engine.returnPackageForRevision();
      setApprovalOpen(false);
      marketingToasts.packageRevision();
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Could not return for revision.');
      throw error;
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const raw = await readAssetsJsonFile(file);
      const result = engine.importGeneratedAssets(raw);
      onAssetsImported?.(result.importedCount);
      marketingToasts.assetsImported(scrollTo('#marketing-operations'));
    } catch (error) {
      marketingToasts.error(error instanceof Error ? error.message : 'Could not import Creative Assets.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="marketing-command-centre" className="scroll-mt-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">AI Marketing Command Centre</h2>
          <p className="text-sm text-muted-foreground">
            Live coordination across your AI Marketing Team specialists.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!visualJob || (!inFlight && !readyForApproval && state.creativeDispatch.status !== 'dispatched') ? (
            <MarketingActionButton
              idleLabel={
                <>
                  <Play className="mr-2 size-4" />
                  Start AI Marketing Team
                </>
              }
              loadingLabel="Assigning specialists…"
              successLabel="AI Marketing Team started ✓"
              onAction={handleStartTeam}
              disabled={inFlight}
            />
          ) : null}
          {readyForApproval && state.packageApproval.status === 'pending' ? (
            <Button onClick={() => setApprovalOpen(true)}>Approve Campaign Package</Button>
          ) : null}
          {state.creativeDispatch.status === 'dispatched' &&
          state.creativeDispatch.creativeProductionStatus !== 'complete' ? (
            <>
              {busy ? <MarketingContextualLoader context="creative-production" className="max-w-xs" /> : null}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <Upload className="mr-2 size-4" />
                {busy ? 'Importing…' : 'Import Creative Assets'}
              </Button>
            </>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {inFlight ? (
        <MarketingContextualLoader context="ai-marketing-team" />
      ) : null}

      {!visualJob && !inFlight ? (
        <MarketingEmptyState content={MARKETING_EMPTY_STATES.commandCentre} onCta={handleStartTeam} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <CampaignStatusPanel status={campaignStatus} packageHealth={packageHealth} state={state} />
          <SpecialistPipelinePanel pipeline={pipeline} onSelect={setSelectedSpecialistId} />
          <ProductionFeedPanel messages={productionFeed} activity={activityFeed} />
        </div>
      )}

      {visualJob ? (
        <div className="grid gap-4 lg:grid-cols-2 animate-in fade-in duration-300">
          <ProductionDocumentsPanel packageHealth={packageHealth} inFlight={inFlight} />
          <CampaignPackagePanel packageHealth={packageHealth} state={state} inFlight={inFlight} />
        </div>
      ) : null}

      {state.dispatchDeployment.running ? (
        <>
          <MarketingContextualLoader context="creative-dispatch" />
          <DispatchDeploymentPanel steps={state.dispatchDeployment.steps} />
        </>
      ) : null}

      {state.creativeDispatch.status === 'dispatched' &&
      state.creativeDispatch.creativeProductionStatus !== 'complete' ? (
        <CreativeProductionPanel state={state} />
      ) : null}

      {state.creativeDispatch.creativeProductionStatus === 'complete' ? (
        <CreativeProductionCompletePanel
          importedCount={
            importReveal?.importedCount ??
            (selectReadyAssetCount(state.assets) || (completion?.creativeAssetsProduced ?? 0))
          }
        />
      ) : null}

      {completion ? (
        <CampaignCompletionPanel completion={completion} engine={engine} />
      ) : null}

      <ApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        summary={approvalSummary}
        manifest={getDispatchManifestItems()}
        onApprove={handleApproveDispatch}
        onRevision={handleRevision}
      />

      <SpecialistDetailDrawer
        open={Boolean(selectedSpecialistId && specialistDetail)}
        onOpenChange={(open) => !open && setSelectedSpecialistId(null)}
        specialist={specialistDetail}
        pipelineEntry={pipeline.find((p) => p.id === selectedSpecialistId) ?? null}
      />
    </section>
  );
}

function CampaignStatusPanel({
  status,
  packageHealth,
  state,
}: {
  status: ReturnType<typeof buildCampaignStatus>;
  packageHealth: ReturnType<typeof buildPackageHealthView>;
  state: MarketingWorkspaceState;
}) {
  return (
    <Card className="h-full animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle className="text-base">Campaign Status</CardTitle>
        <CardDescription>{state.campaignContext.campaign.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-semibold">{status.headline}</p>
          <p className="text-sm text-muted-foreground">{status.detail}</p>
        </div>
        <Progress value={status.progress} className="h-2" />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Package health</p>
            <p className="font-semibold tabular-nums">{packageHealth.healthPercent}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Files</p>
            <p className="font-semibold tabular-nums">{packageHealth.filesGenerated}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecialistPipelinePanel({
  pipeline,
  onSelect,
}: {
  pipeline: SpecialistPipelineEntry[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="h-full animate-in fade-in duration-300 xl:col-span-1">
      <CardHeader>
        <CardTitle className="text-base">AI Specialists</CardTitle>
        <CardDescription>One specialist active at a time</CardDescription>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {pipeline.map((entry) => {
          const Icon = getSpecialistIcon(entry.icon);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{entry.role}</p>
                    <p className="text-xs text-muted-foreground">{entry.currentTask}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn('shrink-0 capitalize', statusBadgeClass(entry.status))}>
                  {entry.status === 'working' ? 'Working' : entry.status === 'completed' ? 'Completed' : 'Waiting'}
                </Badge>
              </div>
              {entry.status === 'working' ? (
                <Progress value={entry.progress} className="mt-2 h-1.5" />
              ) : null}
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular-nums">{entry.confidence}% confidence</span>
                {entry.completedAt ? (
                  <span className="tabular-nums">{formatTime(entry.completedAt)}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProductionFeedPanel({
  messages,
  activity,
}: {
  messages: string[];
  activity: ReturnType<typeof buildActivityFeed>;
}) {
  return (
    <Card className="h-full animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle className="text-base">Production Feed</CardTitle>
        <CardDescription>Live specialist activity from the AI Marketing Team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI Activity
          </p>
          <ol className="max-h-48 space-y-3 overflow-y-auto">
            {activity.map((entry) => (
              <li key={entry.id} className="flex gap-2 text-sm">
                {entry.status === 'completed' ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[rgb(29,111,66)]" />
                ) : entry.status === 'working' ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">{entry.role}</p>
                  <p className="text-muted-foreground">{entry.message}</p>
                  {entry.timestamp ? (
                    <p className="text-xs tabular-nums text-muted-foreground">{formatTime(entry.timestamp)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductionDocumentsPanel({
  packageHealth,
  inFlight,
}: {
  packageHealth: ReturnType<typeof buildPackageHealthView>;
  inFlight: boolean;
}) {
  return (
    <Card className="transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-base">Production Documents</CardTitle>
        <CardDescription>Campaign documents produced by the AI Marketing Team</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {inFlight ? <MarketingContextualLoader context="campaign-package" className="mb-3" /> : null}
        {packageHealth.documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{doc.label}</span>
            <Badge variant="outline" className={cn(doc.status === 'complete' && statusBadgeClass('completed'))}>
              {doc.status === 'complete' ? 'Complete' : doc.status === 'generating' ? 'Generating…' : 'Waiting'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CampaignPackagePanel({
  packageHealth,
  state,
  inFlight,
}: {
  packageHealth: ReturnType<typeof buildPackageHealthView>;
  state: MarketingWorkspaceState;
  inFlight: boolean;
}) {
  return (
    <Card className="transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-base">Campaign Package</CardTitle>
        <CardDescription>
          {packageHealth.readyForDispatch ? 'Ready for dispatch to AI Creative Team' : 'Building Campaign Package…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {inFlight ? <MarketingContextualLoader context="campaign-package" /> : null}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Files generated</p>
            <p className="text-lg font-semibold tabular-nums">{packageHealth.filesGenerated}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Package health</p>
            <p className="text-lg font-semibold tabular-nums">{packageHealth.healthPercent}%</p>
          </div>
        </div>
        <div className="space-y-2">
          {packageHealth.documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{doc.label}</span>
              <span className="font-medium capitalize">{doc.status === 'complete' ? 'Complete' : doc.status === 'generating' ? 'Generating' : 'Waiting'}</span>
            </div>
          ))}
        </div>
        {state.packageApproval.status === 'pending' ? (
          <p className="text-sm text-primary">Awaiting client approval before dispatch.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DispatchDeploymentPanel({
  steps,
}: {
  steps: MarketingWorkspaceState['dispatchDeployment']['steps'];
}) {
  return (
    <Card className="animate-in fade-in slide-in-from-top-2 duration-300">
      <CardHeader>
        <CardTitle className="text-base">Dispatching to AI Creative Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            {step.status === 'complete' ? (
              <CheckCircle2 className="size-4 text-[rgb(29,111,66)]" />
            ) : step.status === 'active' ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Circle className="size-4 text-muted-foreground" />
            )}
            <span className={step.status === 'pending' ? 'text-muted-foreground' : ''}>{step.label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreativeProductionPanel({ state }: { state: MarketingWorkspaceState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Creative Team</CardTitle>
        <CardDescription>Creative production in progress</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-semibold">Running</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Estimated completion</p>
          <p className="font-semibold">{state.creativeDispatch.estimatedProductionMinutes} minutes</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="font-semibold">{state.creativeDispatch.productionPhase}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCompletionPanel({
  completion,
  engine,
}: {
  completion: NonNullable<ReturnType<typeof buildCampaignCompletion>>;
  engine: MarketingJobEngine;
}) {
  return (
    <Card className="border-[rgba(29,111,66,0.25)] bg-[rgba(29,111,66,0.03)] animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle className="text-base">Campaign Complete</CardTitle>
        <CardDescription>Production finished — ready for Marketing Operations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Creative Assets" value={String(completion.creativeAssetsProduced)} />
          <Metric label="Campaign Documents" value={String(completion.campaignDocuments)} />
          <Metric label="Estimated Time Saved" value={`${completion.estimatedTimeSavedHours} Hours`} />
          <Metric label="AI Specialists" value={String(completion.aiSpecialists)} />
          <Metric label="Quality Assurance" value={completion.qualityAssurance} />
          <Metric label="Brand Compliance" value={`${completion.brandCompliance}%`} />
          <Metric label="Knowledge Coverage" value={`${completion.knowledgeCoverage}%`} />
          <Metric label="Client Report" value={completion.clientReportReady ? 'Ready' : 'Pending'} />
          <Metric label="AI Team Report" value={completion.aiTeamReportReady ? 'Ready' : 'Pending'} />
        </div>

        <div className="rounded-lg border bg-background px-4 py-3">
          <p className="text-xs text-muted-foreground">Campaign Status</p>
          <p className="text-sm font-semibold text-primary">{completion.campaignStatus}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => engine.downloadClientReport()}>
            Download Client Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => engine.downloadAiTeamReport()}>
            Download AI Team Performance Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => engine.downloadCampaignPackage()}>
            View Campaign Package
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#campaign-assets">View Creative Assets</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#marketing-operations">Marketing Operations</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ApprovalDialog({
  open,
  onOpenChange,
  summary,
  manifest,
  onApprove,
  onRevision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReturnType<typeof buildApprovalSummary>;
  manifest: string[];
  onApprove: () => void;
  onRevision: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve Campaign Package</DialogTitle>
          <DialogDescription>Review the Campaign Package before sending to the AI Creative Team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Files included</p>
              <p className="font-semibold">{summary.filesIncluded}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. creative time</p>
              <p className="font-semibold">{summary.estimatedCreativeMinutes} min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">AI confidence</p>
              <p className="font-semibold">{summary.aiConfidence}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Knowledge coverage</p>
              <p className="font-semibold">{summary.knowledgeCoverage}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Brand compliance</p>
              <p className="font-semibold">{summary.brandCompliance}%</p>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            {manifest.slice(0, 6).map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-[rgb(29,111,66)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onRevision}>
            <RotateCcw className="mr-2 size-4" />
            Return for Revision
          </Button>
          <Button onClick={onApprove}>
            <Send className="mr-2 size-4" />
            Approve &amp; Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpecialistDetailDrawer({
  open,
  onOpenChange,
  specialist,
  pipelineEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialist: ReturnType<typeof getSpecialistDetail> | null;
  pipelineEntry: SpecialistPipelineEntry | null;
}) {
  if (!specialist) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{specialist.role}</SheetTitle>
          <SheetDescription>{specialist.currentObjective}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6 px-1">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current objective
            </p>
            <p className="text-sm">{specialist.currentObjective}</p>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inputs</p>
            <ul className="space-y-1">
              {specialist.inputs.map((input) => (
                <li key={input} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-3.5 text-[rgb(29,111,66)]" />
                  {input}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outputs</p>
            <ul className="space-y-1">
              {specialist.outputs.map((output) => (
                <li key={output} className="text-sm text-muted-foreground">
                  {output}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reasoning</p>
            <p className="text-sm text-muted-foreground">{specialist.reasoning}</p>
          </section>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-semibold tabular-nums">{specialist.confidence}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. duration</p>
              <p className="text-lg font-semibold tabular-nums">{specialist.estimatedDurationMinutes} min</p>
            </div>
          </div>
          {pipelineEntry?.status ? (
            <Badge variant="outline" className={cn('capitalize', statusBadgeClass(pipelineEntry.status))}>
              {pipelineEntry.status}
            </Badge>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
