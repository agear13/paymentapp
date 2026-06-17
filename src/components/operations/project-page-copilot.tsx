'use client';

import Link from 'next/link';
import { ArrowRight, Check, Lightbulb, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import {
  analyseWorkspace,
  type CommercialDecisionResult,
} from '@/components/workflow/commercial-decision-engine';

export type ProjectPageCopilotPage = 'money' | 'people' | 'history';

type ProjectPageCopilotProps = {
  page: ProjectPageCopilotPage;
  projectId?: string;
  agreementName?: string;
  guidance?: OperationalGuidanceBundle | null;
  kpis?: OperationalKPIs | null;
  workspaceContext?: WorkspaceOperationalContext | null;
  activation?: WorkspaceActivationSnapshot | null;
  auditEntries?: OperationalAuditEntry[];
};

/* ─── Why? expandable reasoning ─── */

function ReasoningExpander({ reasoning }: { reasoning: string[] }) {
  const [open, setOpen] = React.useState(false);

  if (reasoning.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        Why?
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 pl-1">
          {reasoning.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-border">•</span>
              <span className="capitalize-first">{r}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ─── History page — no action needed ─── */

function HistoryGuidance() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/10 px-4 py-3">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/50" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">Nothing needs your attention here.</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          This page records business milestones and operational history.
        </p>
      </div>
    </div>
  );
}

/* ─── Outcome-first guidance banner ─── */

type GuidanceBannerProps = {
  decision: CommercialDecisionResult;
  page: 'money' | 'people';
};

function GuidanceBanner({ decision, page }: GuidanceBannerProps) {
  const rec = decision.recommendedAction;

  // Filter recommendation to this page
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

  if (!isRelevant || !rec) {
    // Positive state — all good on this page
    const positiveMessage =
      page === 'money'
        ? "Payment setup is on track. Revenue can flow once the agreement is fully prepared."
        : "All team members have approved. Payouts are unlocked.";

    return (
      <div className="flex items-start gap-3 rounded-lg border border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.04)] px-4 py-3">
        <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[rgb(29,111,66)]" aria-hidden />
        <p className="text-sm text-muted-foreground">{positiveMessage}</p>
      </div>
    );
  }

  // Outcome-first action banner
  const headlineByPage: Record<'money' | 'people', string> = {
    money: "Let's enable payments.",
    people: "Let's finish approvals.",
  };

  return (
    <div className="rounded-lg border border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.04)] px-4 py-4 space-y-3">
      {/* Headline */}
      <div>
        <p className="text-sm font-semibold text-foreground">
          {headlineByPage[page]}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
          {rec.explanation}
        </p>
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
            Estimated time: <span className="font-medium text-foreground">{rec.estimatedMinutes} minutes</span>
          </p>
        ) : (
          <span />
        )}
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
      </div>

      {/* Why? expandable reasoning */}
      <ReasoningExpander reasoning={decision.reasoning} />
    </div>
  );
}

/* ─── Main component ─── */

/**
 * Per-agreement-page copilot guidance banner.
 *
 * Powered by the Commercial Decision Engine — every message is deterministic,
 * outcome-first, and contextual to the current page.
 *
 * Shows:
 *   - What to do (action)
 *   - Why (reasoning, expandable via "Why?")
 *   - What it unlocks (consequences, ✓ list)
 *   - Estimated time + Continue CTA
 *
 * History page always shows orientation only — no actions.
 */
export function ProjectPageCopilot({
  page,
  projectId,
  agreementName,
  guidance,
  kpis,
  workspaceContext,
  activation,
  auditEntries,
}: ProjectPageCopilotProps) {
  if (page === 'history') {
    return <HistoryGuidance />;
  }

  // When projectId is missing, fall back to legacy simple banner
  if (!projectId) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.04)] px-4 py-3">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[rgb(124,92,255)]" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {page === 'money'
            ? 'Manage how revenue flows into this agreement and configure your payment provider.'
            : 'Add team members, configure their earnings, and request approvals before payouts can be released.'}
        </p>
      </div>
    );
  }

  const decision = analyseWorkspace({
    projectId,
    agreementName,
    kpis: kpis ?? null,
    releaseConfidence: guidance?.releaseConfidence ?? null,
    workspaceContext: workspaceContext ?? null,
    activation: activation ?? null,
    auditEntries,
  });

  return <GuidanceBanner decision={decision} page={page} />;
}
