'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { projectOverviewPath } from '@/lib/projects/project-routes';
import { stageFromScore } from '@/components/workflow/workflow-context';

type AgreementsOperationalGridProps = {
  snapshots: AgreementHealthSnapshot[];
  loading?: boolean;
};

/* ─── Canonical 8-stage workflow pipeline ─── */

type StageDisplay = {
  id: string;
  label: string;
};

/**
 * Canonical stages aligned with WorkflowStage from workflow-context.ts.
 * Labels are human-readable; order matches STAGE_ORDER.
 */
const WORKFLOW_STAGES: StageDisplay[] = [
  { id: 'setup',                label: 'Created' },
  { id: 'configuring',          label: 'Team' },
  { id: 'collecting-approvals', label: 'Approvals' },
  { id: 'preparing-payments',   label: 'Payments' },
  { id: 'ready-to-collect',     label: 'Ready' },
  { id: 'collecting-revenue',   label: 'Collecting' },
  { id: 'ready-to-release',     label: 'Settlement' },
  { id: 'operational',          label: 'Live' },
];

const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  WORKFLOW_STAGES.map((s, i) => [s.id, i])
);

/**
 * Derives the pipeline index from a health score using the canonical
 * STAGE_COMPLETION thresholds. This guarantees that the pipeline display
 * always agrees with CommercialBrain's workflowStage.
 */
function deriveStageIndex(score: number): number {
  return STAGE_INDEX[stageFromScore(score)] ?? 0;
}


/* ─── Helpers ─── */

function nextAction(snapshot: AgreementHealthSnapshot): string {
  return snapshot.reducesScore[0] ?? snapshot.categoryReason;
}

function estimateMinutes(action: string): number {
  if (/connect stripe|payment provider/i.test(action)) return 5;
  if (/send.*agreement|participation/i.test(action)) return 2;
  if (/release|payout/i.test(action)) return 1;
  if (/review|approve/i.test(action)) return 3;
  return 2;
}

function scoreTone(score: number) {
  if (score >= 80) return 'text-[rgb(29,111,66)]';
  if (score >= 55) return 'text-amber-700';
  return 'text-red-700';
}

/* ─── Components ─── */

/**
 * V5 agreement cards — workflow visualization is primary, readiness % is secondary.
 * Each card shows: Agreement name · Workflow pipeline · Next action · Open →
 * Max 3 data points. One CTA. Scans vertically in under 3 seconds.
 */
export function AgreementsOperationalGrid({
  snapshots,
  loading,
}: AgreementsOperationalGridProps) {
  if (loading && snapshots.length === 0) {
    return (
      <section aria-label={PRODUCT_TERMINOLOGY.yourProjects} className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{PRODUCT_TERMINOLOGY.yourProjects}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-border/60 bg-muted/15 animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!loading && snapshots.length === 0) {
    return (
      <section aria-label={PRODUCT_TERMINOLOGY.yourProjects} className="space-y-2.5">
        <h2 className="text-sm font-semibold text-foreground">{PRODUCT_TERMINOLOGY.yourProjects}</h2>
        <div className="rounded-xl border border-dashed border-border/60 bg-white/40 px-5 py-8 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">{PRODUCT_TERMINOLOGY.noProjectsYet}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create your first project to begin coordinating commercial relationships.
          </p>
        </div>
      </section>
    );
  }

  const sorted = [...snapshots].sort((a, b) => a.score - b.score);

  return (
    <section aria-label={PRODUCT_TERMINOLOGY.yourProjects} className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{PRODUCT_TERMINOLOGY.yourProjects}</h2>
        <span className="text-xs text-muted-foreground">{snapshots.length} active</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((snap) => (
          <AgreementCard key={snap.projectId} snapshot={snap} />
        ))}
      </div>
    </section>
  );
}

function AgreementCard({ snapshot }: { snapshot: AgreementHealthSnapshot }) {
  const href = projectOverviewPath(snapshot.projectId);
  const currentStageIndex = deriveStageIndex(snapshot.score);
  const action = nextAction(snapshot);
  const mins = estimateMinutes(action);
  const isComplete = snapshot.category === 'excellent';

  return (
    <Link
      href={href}
      className="group rounded-xl border border-border/60 bg-white/60 hover:bg-white/85 hover:border-border/80 transition-all duration-150 p-4 flex flex-col gap-3.5"
    >
      {/* Name + score */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug truncate">
          {snapshot.agreementName}
        </p>
        <span className={cn('text-xs font-semibold tabular-nums shrink-0', scoreTone(snapshot.score))}>
          {snapshot.score}%
        </span>
      </div>

      {/* Workflow pipeline — primary visual */}
      <div className="flex items-center gap-0.5">
        {WORKFLOW_STAGES.map((stage, i) => {
          const isDone = i < currentStageIndex;
          const isActive = i === currentStageIndex;
          const isFuture = i > currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0 gap-0.5">
              {/* Stage indicator */}
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <div
                  className={cn(
                    'h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                    isDone && 'bg-[rgb(29,111,66)]',
                    isActive &&
                      'bg-white border-2 border-[rgb(29,111,66)] ring-2 ring-[rgba(29,111,66,0.15)]',
                    isFuture && 'bg-muted/30 border border-border/40'
                  )}
                >
                  {isDone ? (
                    <Check className="h-2 w-2 text-white" aria-hidden />
                  ) : isActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(29,111,66)]" />
                  ) : null}
                </div>
                <p
                  className={cn(
                    'text-[9px] text-center truncate w-full leading-none px-0.5',
                    isDone && 'text-muted-foreground/50',
                    isActive && 'font-semibold text-foreground text-[10px]',
                    isFuture && 'text-muted-foreground/30'
                  )}
                >
                  {stage.label}
                </p>
              </div>

              {/* Connector */}
              {i < WORKFLOW_STAGES.length - 1 ? (
                <div
                  className={cn(
                    'h-0.5 w-2 shrink-0 rounded-full mb-3',
                    i < currentStageIndex ? 'bg-[rgb(29,111,66)]' : 'bg-border/40'
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Next action footer */}
      {!isComplete && action ? (
        <div className="border-t border-border/30 pt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next action
            </p>
            <p className="text-xs text-foreground/80 leading-snug mt-0.5 truncate">
              {action}
              {mins > 0 ? (
                <span className="text-muted-foreground"> · {mins} min</span>
              ) : null}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </div>
      ) : (
        <div className="border-t border-border/30 pt-2.5 flex items-center justify-between gap-2">
          <p className="text-xs text-[rgb(29,111,66)] font-medium">
            {isComplete ? 'Ready for settlement' : 'In progress'}
          </p>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      )}
    </Link>
  );
}
