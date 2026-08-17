'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Settings2,
  Upload,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { useWorkflowAgreement } from '@/hooks/use-workflow-agreement';
import { WORKFLOW_LIFECYCLE_LABELS } from '@/lib/workflows/agreement-intelligence/lifecycle';
import { AgreementIntelligenceInputModal } from '@/components/journey/lovable/agreement-intelligence-input-modal';
import { ExtractionReviewModal } from '@/components/ai-extractor/extraction-review-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function AgreementIntelligenceHubScreen() {
  const { getBySlug, loading: workflowsLoading } = useDeployedWorkflows();
  const template = getWorkflowBySlug('agreement-intelligence');
  const installed = getBySlug('agreement-intelligence');

  const {
    context,
    loading: agreementLoading,
    error,
    submitting,
    refresh,
    submitPaste,
    submitUpload,
    retryExtraction,
    retryBootstrap,
    updateConfiguration,
  } = useWorkflowAgreement(installed?.id ?? null);

  const [inputOpen, setInputOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);

  const loading = workflowsLoading || agreementLoading;

  if (loading) {
    return (
      <div className="animate-fade-up py-16 text-center text-[13px] text-ink-soft">
        Loading workflow…
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="animate-fade-up space-y-6 pb-16">
        <Link
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="text-xl font-semibold">Agreement Intelligence</h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            This workflow is not installed in your workspace yet.
          </p>
          <Link
            href={COMMERCIAL_OS_ROUTES.workflowDetail('agreement-intelligence')}
            className="mt-4 inline-flex rounded-xl bg-gradient-purple px-4 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Add from Workflow Library
          </Link>
        </div>
      </div>
    );
  }

  const hub = context?.hubSummary;
  const operational = context?.operationalSummary;
  const agreement = context?.agreement;
  const extraction = agreement?.extractionResult;
  const lifecycleStatus = context?.lifecycleStatus ?? installed.lifecycleStatus ?? 'AWAITING_INPUT';
  const statusLabel = WORKFLOW_LIFECYCLE_LABELS[lifecycleStatus] ?? lifecycleStatus;
  const showEmptyState = !hub?.hasAgreement || lifecycleStatus === 'AWAITING_INPUT';
  const isExtracting =
    lifecycleStatus === 'EXTRACTING' ||
    lifecycleStatus === 'BOOTSTRAPPING' ||
    submitting;
  const isActive = lifecycleStatus === 'ACTIVE';
  const isBootstrapFailed = lifecycleStatus === 'BOOTSTRAP_FAILED';
  const isLocked =
    lifecycleStatus === 'APPROVED' ||
    lifecycleStatus === 'ACTIVE' ||
    lifecycleStatus === 'BOOTSTRAPPING';

  return (
    <div className="animate-fade-up space-y-8 pb-16">
      <Link
        href={COMMERCIAL_OS_ROUTES.workspace}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workspace
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-border p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {template?.name ?? 'Agreement Intelligence'}
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] text-ink-soft">
                Turn your agreements into structured commercial workflows.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                {isActive ? 'ACTIVE' : `Status: ${statusLabel}`}
              </div>
              {isActive && operational && (
                <p className="mt-2 text-[13px] text-ink-soft">
                  1 Agreement · {operational.participantCount} Participants ·{' '}
                  {operational.obligationCount} Obligations
                </p>
              )}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen((v) => !v)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configuration
          </Button>
        </div>

        {configOpen && context?.configuration && (
          <div className="border-b border-border bg-secondary/10 px-8 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Default settlement currency</Label>
                <Select
                  value={context.configuration.defaultSettlementCurrency}
                  onValueChange={(value: 'AUD' | 'USD') =>
                    void updateConfiguration({
                      ...context.configuration,
                      defaultSettlementCurrency: value,
                    }).then((ok) => {
                      if (ok) toast.success('Configuration updated');
                    })
                  }
                  disabled={isLocked || submitting}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Operator approval required</p>
                  <p className="text-[12px] text-ink-soft">
                    Require explicit approval before activation in later phases.
                  </p>
                </div>
                <Switch
                  checked={context.configuration.operatorApprovalRequired}
                  onCheckedChange={(checked) =>
                    void updateConfiguration({
                      ...context.configuration,
                      operatorApprovalRequired: checked,
                    }).then((ok) => {
                      if (ok) toast.success('Configuration updated');
                    })
                  }
                  disabled={isLocked || submitting}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 p-8">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
              {error}
            </div>
          )}

          {showEmptyState && !isExtracting && (
            <div className="space-y-6">
              <p className="max-w-2xl text-[14px] text-foreground">
                Upload or paste a commercial agreement. Provvy extracts parties, obligations,
                settlement terms, and revenue shares for your review — no payments are executed in
                this phase.
              </p>
              <ol className="grid gap-3 text-[13px] text-ink-soft md:grid-cols-2">
                <li>1. Upload agreement</li>
                <li>2. Provvy extracts commercial terms</li>
                <li>3. Review the extracted structure</li>
                <li>4. Approve the workflow</li>
                <li className="md:col-span-2">5. Track obligations and participants after activation</li>
              </ol>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => setInputOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Agreement
                </Button>
                <Button type="button" variant="outline" onClick={() => setInputOpen(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Paste Agreement Text
                </Button>
              </div>
            </div>
          )}

          {isExtracting && lifecycleStatus === 'BOOTSTRAPPING' && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-4 text-[14px] text-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Creating participants, obligations, and settlement structure…
            </div>
          )}

          {isExtracting && lifecycleStatus !== 'BOOTSTRAPPING' && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-4 text-[14px] text-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Extracting commercial terms from your agreement…
            </div>
          )}

          {hub?.hasAgreement && !showEmptyState && !isExtracting && isActive && operational && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {operational.agreementTitle ?? hub.title ?? 'Agreement'}
                </h2>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Commercial structure is active. Payments are not executed automatically — use
                  existing funding and release flows when ready.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Participants" value={operational.participantCount} />
                <MetricCard label="Obligations" value={operational.obligationCount} />
                <MetricCard
                  label="Settlement schedule"
                  value={operational.settlementSchedule ?? 'Not captured'}
                />
              </div>

              {operational.participants.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Participants
                  </p>
                  <ul className="mt-3 space-y-2">
                    {operational.participants.map((participant) => (
                      <li key={participant.id} className="text-[14px]">
                        <span className="font-medium">{participant.name}</span>
                        {participant.role ? (
                          <span className="text-ink-soft"> · {participant.role}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {operational.obligations.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Obligations
                  </p>
                  <ul className="mt-3 space-y-2">
                    {operational.obligations.map((obligation) => (
                      <li key={obligation.id} className="text-[14px]">
                        <span className="font-medium">{obligation.label}</span>
                        <span className="text-ink-soft"> — {obligation.amountLabel}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {operational.settlementSchedule && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Settlement schedule
                  </p>
                  <p className="mt-3 text-[14px] font-medium">{operational.settlementSchedule}</p>
                </div>
              )}

              {operational.upcomingActions.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Upcoming actions
                  </p>
                  <ul className="mt-3 space-y-2">
                    {operational.upcomingActions.map((action) => (
                      <li key={`${action.label}-${action.detail}`} className="text-[14px]">
                        <span className="font-medium">{action.label}</span>
                        <span className="text-ink-soft"> — {action.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Active
                {agreement?.bootstrappedAt
                  ? ` · ${new Date(agreement.bootstrappedAt).toLocaleString()}`
                  : ''}
              </div>
            </div>
          )}

          {hub?.hasAgreement && !showEmptyState && !isExtracting && !isActive && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">{hub.title ?? 'Agreement'}</h2>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {isBootstrapFailed
                    ? 'Structure was approved but activation failed. Retry to create the commercial workflow.'
                    : 'Review AI-extracted terms before approving. Extracted data is not automatically correct.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Participants" value={hub.participantCount} />
                <MetricCard label="Obligations identified" value={hub.obligationCount} />
                <MetricCard label="Revenue shares" value={hub.revenueShareCount} />
                <MetricCard
                  label="Settlement schedule"
                  value={hub.settlementSchedule ?? 'Not captured'}
                />
                <MetricCard
                  label="Approval required"
                  value={hub.approvalRequired ? 'Yes' : 'No'}
                />
                <MetricCard label="Workflow status" value={statusLabel} />
              </div>

              {extraction && extraction.parties.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                    Participants (AI extracted)
                  </p>
                  <ul className="mt-3 space-y-2">
                    {extraction.parties.map((party) => (
                      <li key={party.id} className="text-[14px]">
                        <span className="font-medium">{party.name.value ?? 'Unnamed participant'}</span>
                        {party.role.value ? (
                          <span className="text-ink-soft"> — {party.role.value}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lifecycleStatus === 'EXTRACTION_FAILED' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
                  <p className="text-[14px] font-medium text-amber-900 dark:text-amber-200">
                    Extraction failed
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {agreement?.extractionError ?? 'Provvy could not extract structure from this agreement.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="outline" disabled={submitting} onClick={() => void retryExtraction()}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry extraction
                    </Button>
                    <Button type="button" disabled={submitting} onClick={() => setInputOpen(true)}>
                      Upload different agreement
                    </Button>
                  </div>
                </div>
              )}

              {isBootstrapFailed && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
                  <p className="text-[14px] font-medium text-amber-900 dark:text-amber-200">
                    Activation failed
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {agreement?.bootstrapError ??
                      'Could not create participants and obligations from the approved structure.'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {hub.canReview && extraction && (
                  <Button type="button" onClick={() => setReviewOpen(true)}>
                    Review Agreement
                  </Button>
                )}
                {hub.canRetryBootstrap && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => void retryBootstrap()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry activation
                  </Button>
                )}
                {!isLocked && hub.canUpload && (
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => setInputOpen(true)}>
                    Replace agreement
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AgreementIntelligenceInputModal
        open={inputOpen}
        onOpenChange={setInputOpen}
        submitting={submitting}
        onUpload={submitUpload}
        onPaste={submitPaste}
      />

      {extraction && installed.id && (
        <ExtractionReviewModal
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          result={extraction}
          entryPoint="workflow_agreement"
          sourceType="other"
          rawConversationText={agreement?.sourceText ?? undefined}
          workflowId={installed.id}
          onComplete={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}
