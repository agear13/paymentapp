'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import {
  deriveWorkflowContext,
  type WorkflowStage,
} from '@/components/workflow/workflow-context';
import { analyseWorkspace } from '@/components/workflow/commercial-decision-engine';

/* ─── Progress bar ─── */

function WorkflowProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full bg-border/50 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[rgb(124,92,255)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
        {pct}%
      </span>
    </div>
  );
}

/* ─── Stage pill ─── */

const stagePillColor: Partial<Record<WorkflowStage, string>> = {
  'setup':                'bg-border/60 text-muted-foreground',
  'configuring':          'bg-amber-100/80 text-amber-800',
  'collecting-approvals': 'bg-blue-100/80 text-blue-800',
  'preparing-payments':   'bg-amber-100/80 text-amber-800',
  'ready-to-collect':     'bg-[rgba(124,92,255,0.12)] text-[rgb(124,92,255)]',
  'collecting-revenue':   'bg-[rgba(124,92,255,0.12)] text-[rgb(124,92,255)]',
  'ready-to-release':     'bg-[rgba(29,111,66,0.12)] text-[rgb(29,111,66)]',
  'operational':          'bg-[rgba(29,111,66,0.12)] text-[rgb(29,111,66)]',
};

/* ─── Skeleton loader ─── */

function WorkflowHeaderSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-white/60 px-5 py-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-3 w-24 bg-muted/60 rounded" />
        <div className="h-3 w-10 bg-muted/40 rounded" />
      </div>
      <div className="h-1.5 w-full bg-muted/40 rounded-full" />
      <div className="flex items-center justify-between gap-3">
        <div className="h-3 w-48 bg-muted/50 rounded" />
        <div className="h-7 w-24 bg-muted/40 rounded-lg" />
      </div>
    </div>
  );
}

/* ─── WorkflowHeader ─── */

/**
 * Persistent workflow header — appears at the top of every agreement workspace page.
 *
 * Answers three questions without any extra navigation:
 *   1. Where am I?        → Stage title + progress bar
 *   2. What's next?       → Next action description
 *   3. What happens after? → Hint text (brief outcome)
 *
 * The Continue button always routes to the next required workflow step.
 * Routes are derived from WorkflowContext — never hardcoded.
 */
export function WorkflowHeader() {
  const { deal, summary, projectParticipants, projectId, loading: wsLoading } =
    useProjectWorkspace();

  const {
    kpis,
    guidance,
    workspaceContext,
    activation,
    loading: opLoading,
  } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    treasury: summary?.treasury ?? undefined,
    enabled: Boolean(deal),
    traceSurface: 'workflow-header',
  });

  const isLoading = wsLoading || opLoading;

  if (isLoading && !deal) return <WorkflowHeaderSkeleton />;
  if (!deal || !summary) return null;

  const ctx = deriveWorkflowContext({
    projectId,
    agreementName: summary.name,
    kpis: kpis ?? null,
    releaseConfidence: guidance.releaseConfidence ?? null,
    workspaceContext: workspaceContext ?? null,
    activation: activation ?? null,
  });

  // Get consequence-first action detail from Decision Engine
  const decision = analyseWorkspace({
    projectId,
    agreementName: summary.name,
    kpis: kpis ?? null,
    releaseConfidence: guidance.releaseConfidence ?? null,
    workspaceContext: workspaceContext ?? null,
    activation: activation ?? null,
  });

  const recommended = decision.recommendedAction;

  if (ctx.isCompleted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.04)] px-5 py-3">
        <Check className="h-4 w-4 text-[rgb(29,111,66)] shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[rgb(29,111,66)]">
            {summary.name} is commercially operational
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Revenue is flowing and all obligations are confirmed.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-xs">
          <Link href={ctx.continueHref}>
            View activity
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-4 space-y-3">
      {/* Mission header: "Continue preparing [Agreement]" */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Mission
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">
            {decision.conversationalSummary.split('.')[0]}.
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-0.5',
            stagePillColor[ctx.currentStage] ?? 'bg-border/60 text-muted-foreground'
          )}
        >
          {ctx.stageTitle}
        </span>
      </div>

      {/* Progress bar */}
      <WorkflowProgressBar pct={ctx.completionPercentage} />

      {/* Consequence-first action + CTA */}
      {recommended ? (
        <div className="flex items-start justify-between gap-4 flex-wrap pt-0.5">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground leading-snug">{recommended.title}</p>
            {recommended.consequences.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Unlocks: {recommended.consequences.slice(0, 2).join(' · ')}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {ctx.nextActionMinutes > 0 ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                {ctx.nextActionMinutes} min
              </span>
            ) : null}
            <Button
              asChild
              size="sm"
              className="h-8 px-4 text-sm font-semibold bg-foreground hover:bg-foreground/90 text-background border-0"
            >
              <Link href={ctx.continueHref}>
                Continue
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 flex-wrap pt-0.5">
          <p className="text-sm text-muted-foreground leading-snug">{ctx.nextActionHint}</p>
          <Button
            asChild
            size="sm"
            className="h-8 px-4 text-sm font-semibold bg-foreground hover:bg-foreground/90 text-background border-0 shrink-0"
          >
            <Link href={ctx.continueHref}>
              Continue
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
