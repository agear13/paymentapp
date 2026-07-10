'use client';

import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

/**
 * ProjectPageCopilot — per-page guidance banner for agreement workspace pages.
 *
 * Powered by the CommercialBrainContext — no independent engine calls.
 * The Decision Engine runs once in CommercialBrainProvider (via project-workspace-shell).
 * This component reads the shared result via useCommercialBrain().
 *
 * Uses WhyExpander for the universal "Why?" reasoning disclosure.
 * Uses CommercialInsights for mature/operational workspaces.
 *
 * Pages:
 *   money   — outcome-first banner if payment/settlement action needed
 *   people  — outcome-first banner if approvals/earnings action needed
 *   history — orientation only (no actions)
 */

import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCommercialBrain } from '@/components/workflow/commercial-brain-context';
import { WhyExpander } from '@/components/workflow/why-expander';
import { CommercialInsights, shouldShowInsights } from '@/components/workflow/commercial-insights';
import { buildWorkspaceExperience } from '@/components/workflow/operations-manager';
import type { CommercialDecisionResult } from '@/components/workflow/commercial-decision-engine';

export type ProjectPageCopilotPage = 'money' | 'people' | 'history';

/* ─── History orientation ─── */

function HistoryGuidance() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/10 px-4 py-3">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">Nothing needs your attention here.</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          This page records business milestones and operational history {PRODUCT_TERMINOLOGY.forThisProject}.
        </p>
      </div>
    </div>
  );
}

/* ─── Page-level guidance banner ─── */

type GuidanceBannerProps = {
  decision: CommercialDecisionResult;
  page: 'money' | 'people';
};

function GuidanceBanner({ decision, page }: GuidanceBannerProps) {
  const rec = decision.recommendedAction;

  // Is this recommendation relevant to the current page?
  const isRelevant =
    page === 'money'
      ? rec &&
        (rec.tier === 'money_blocked' ||
          rec.tier === 'payment_provider' ||
          rec.tier === 'settlement_blocked')
      : page === 'people'
        ? rec &&
          (rec.tier === 'approvals_pending' ||
            rec.tier === 'earnings_config' ||
            rec.tier === 'participants_missing')
        : false;

  // No relevant action for this page — positive state
  if (!isRelevant || !rec) {
    const positiveMessage =
      page === 'money'
        ? 'Payment setup is on track. Revenue can flow once the agreement is fully prepared.'
        : 'All team members have approved. Payouts are unlocked.';

    return (
      <div className="flex items-start gap-3 rounded-lg border border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.04)] px-4 py-3">
        <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[rgb(29,111,66)]" aria-hidden />
        <p className="text-sm text-muted-foreground">{positiveMessage}</p>
      </div>
    );
  }

  // Page-contextual headline
  const pageHeadline: Record<'money' | 'people', string> = {
    money: "Let's enable payments.",
    people: "Let's finish approvals.",
  };

  return (
    <div className="rounded-lg border border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.04)] px-4 py-4 space-y-3">
      {/* Outcome-first headline */}
      <div>
        <p className="text-sm font-semibold text-foreground">{pageHeadline[page]}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{rec.explanation}</p>
      </div>

      {/* What this unlocks */}
      {rec.consequences.length > 0 ? (
        <ul className="space-y-1">
          {rec.consequences.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-[rgb(124,92,255)] shrink-0" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Footer: time + CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        {rec.estimatedMinutes > 0 ? (
          <p className="text-xs text-muted-foreground">
            Estimated time:{' '}
            <span className="font-medium text-foreground">{rec.estimatedMinutes} minutes</span>
          </p>
        ) : (
          <span />
        )}
        {/*
         * When on the people page with approvals_pending tier, the recommended
         * action href points to this very page (/participants). Navigating to it
         * creates a dead loop. Instead, scroll the operator down to the first
         * card that requires action — the Approval Centre cards are below this banner.
         */}
        {page === 'people' && rec.tier === 'approvals_pending' ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-foreground hover:bg-foreground/90 text-background border-0"
            onClick={() => {
              const firstPending = document.querySelector<HTMLElement>(
                '[data-approval-card][data-pending="true"]'
              );
              const approvalCentre = document.getElementById('approval-centre-cards');
              const target = firstPending ?? approvalCentre;
              target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            See approval queue
            <ArrowDown className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          <Button
            asChild
            size="sm"
            className="h-7 px-3 text-xs font-semibold bg-foreground hover:bg-foreground/90 text-background border-0"
          >
            <Link href={rec.href}>
              {rec.label}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>

      {/* Universal Why? expander */}
      <WhyExpander reasoning={decision.reasoning} />
    </div>
  );
}

/* ─── Main export ─── */

/**
 * Per-agreement-page guidance banner.
 *
 * Reads from CommercialBrainContext — no props needed except `page`.
 * The engine runs once in CommercialBrainProvider; this component reads it.
 *
 * For operational/mature workspaces, shows CommercialInsights instead of guidance.
 */
export function ProjectPageCopilot({ page }: { page: ProjectPageCopilotPage }) {
  const { decision, workflowCtx, loading } = useCommercialBrain();

  // History page always shows orientation
  if (page === 'history') return <HistoryGuidance />;

  // Still loading
  if (loading || !decision || !workflowCtx) {
    return (
      <div className="h-12 rounded-lg border border-border/30 bg-muted/20 animate-pulse" />
    );
  }

  // Operational/mature businesses get insights instead of workflow guidance
  const experience = buildWorkspaceExperience({
    snapshots: [],
    kpis: null,
    releaseConfidence: null,
    workspaceContext: null,
    activation: null,
    attentionItems: [],
    auditEntries: decision.memory ? [] : [],
  });

  if (shouldShowInsights(experience.workspaceMode) && workflowCtx.isCompleted) {
    return null; // WorkflowHeader already shows the operational success strip
  }

  return <GuidanceBanner decision={decision} page={page} />;
}
