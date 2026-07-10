'use client';

import Link from 'next/link';
import { ArrowRight, Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { AttentionItem } from '@/lib/operations/severity';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { PRODUCT_TERMINOLOGY, projectCountLabel, projectsProgressingLabel, projectsNeedAttentionLabel } from '@/lib/product/product-terminology';
import type { QueueTask } from '@/components/operations/operational-queue';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { analyseWorkspace } from '@/components/workflow/commercial-decision-engine';
import type { FocusItem, WorkspaceMode } from '@/components/workflow/operations-manager';
import { CommercialInsights, shouldShowInsights } from '@/components/workflow/commercial-insights';

type ProvvyCopilotProps = {
  operatorName?: string;
  attentionItems: AttentionItem[];
  kpis: OperationalKPIs | null | undefined;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  snapshots: AgreementHealthSnapshot[];
  queueTasks: QueueTask[];
  auditEntries?: OperationalAuditEntry[];
  /** From Operations Manager — overrides internally-derived headline */
  openingSummary?: string;
  /** From Operations Manager — "Good afternoon, Alisha." */
  greeting?: string;
  /** From Operations Manager — numbered focus items */
  todaysFocus?: FocusItem[];
  /** Workspace maturity mode */
  workspaceMode?: WorkspaceMode;
  loading?: boolean;
};

/* ─── Narrative states ─── */

type CopilotNarrative = {
  eyebrow?: string;
  headline: string;
  body?: string;
  steps?: string[];
  outcome?: string;
  estimatedMinutes?: number;
  ctaLabel: string;
  ctaHref?: string;
  tone: 'action' | 'positive' | 'waiting' | 'empty';
};

function greeting(name?: string): string {
  const h = new Date().getHours();
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${base}, ${name}.` : `${base}.`;
}

/**
 * Resolves the correct workflow CTA href for an agreement, based on what is blocking.
 * Never sends the operator to an already-completed step.
 *
 * Priority:
 *   1. Explicit href if one is provided (most specific)
 *   2. Payment provider issue → Money tab
 *   3. Participant / approval issue → People tab
 *   4. Obligations / settlement issue → Money tab (obligations live under Money)
 *   5. Default → overview (agreement briefing)
 */
function resolveWorkflowCtaHref(
  projectId: string,
  opts: {
    explicitHref?: string;
    hint?: string;
  } = {}
): string {
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}`;

  if (opts.explicitHref) return opts.explicitHref;

  const hint = (opts.hint ?? '').toLowerCase();

  if (/stripe|payment provider|merchant|connect payment|payment rail/i.test(hint)) {
    return `${base}/funding`;
  }
  if (/participant|approval|invite|agreement share|team member|send agreement/i.test(hint)) {
    return `${base}/participants`;
  }
  if (/obligation|payout|allocation|settlement/i.test(hint)) {
    return `${base}/funding`;
  }

  return base;
}

function buildNarrative(
  operatorName: string | undefined,
  attentionItems: AttentionItem[],
  kpis: OperationalKPIs | null | undefined,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  snapshots: AgreementHealthSnapshot[],
  queueTasks: QueueTask[]
): CopilotNarrative {
  const currency = releaseConfidence?.currency ?? 'AUD';
  const readyToRelease = releaseConfidence?.readyToRelease ?? 0;
  const collectedRevenue = releaseConfidence?.collectedRevenue ?? 0;
  const totalAgreements = snapshots.length;
  const criticalItems = attentionItems.filter((i) => i.severity === 'CRITICAL');
  const actionItems = attentionItems.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED'
  );
  const primaryAgreement = [...snapshots].sort((a, b) => a.score - b.score)[0];
  const healthyAgreements = snapshots.filter(
    (s) => s.category === 'excellent' || s.category === 'healthy'
  );
  const needsWorkAgreements = snapshots.filter(
    (s) => s.category !== 'excellent'
  );

  // ── Empty workspace
  if (totalAgreements === 0) {
    return {
      headline: 'Welcome to Provvypay.',
      body: "Let's create your first project and I'll guide you through preparing it for payments.",
      ctaLabel: PRODUCT_TERMINOLOGY.createProject,
      ctaHref: '/dashboard/onboarding',
      tone: 'empty',
    };
  }

  // ── Ready to release payouts
  if (readyToRelease > 0 && actionItems.length === 0) {
    return {
      eyebrow: greeting(operatorName),
      headline: `${formatCompactCurrency(readyToRelease, currency)} is ready to release.`,
      body: 'All participants are approved and obligations are confirmed. You can release payouts now.',
      outcome: 'Participants receive their settlement payments today.',
      ctaLabel: 'Release payouts',
      ctaHref: primaryAgreement
        ? `/dashboard/projects/${encodeURIComponent(primaryAgreement.projectId)}/payouts`
        : undefined,
      tone: 'positive',
    };
  }

  // ── All agreements healthy, no work needed
  if (needsWorkAgreements.length === 0 && actionItems.length === 0) {
    const secondAgreement = healthyAgreements[1];
    return {
      eyebrow: greeting(operatorName),
      headline: 'Everything is progressing well.',
      body: secondAgreement
        ? `${healthyAgreements[0]?.agreementName ?? 'Your project'} is now ready for payouts. I'd recommend checking on ${secondAgreement.agreementName} next.`
        : `${primaryAgreement?.agreementName ?? 'Your project'} is now ready for payouts.`,
      ctaLabel: `View ${PRODUCT_TERMINOLOGY.projectsLower}`,
      tone: 'positive',
    };
  }

  // ── Revenue is blocked by payment setup
  const paymentBlocker = criticalItems.find((i) =>
    /connect stripe|payment provider|stripe/i.test(i.title + ' ' + i.explanation)
  );
  if (collectedRevenue > 0 && paymentBlocker) {
    const primaryTasks = queueTasks.filter(
      (t) =>
        primaryAgreement &&
        (t.context.toLowerCase().includes(primaryAgreement.agreementName.toLowerCase()) ||
          primaryAgreement.agreementName.toLowerCase().includes(t.context.toLowerCase()))
    );
    const steps = primaryTasks.slice(0, 3).map((t) => t.title);
    const totalMinutes = primaryTasks.slice(0, 3).reduce((s, t) => s + t.estimatedMinutes, 0);
    const blockerHref = primaryAgreement
      ? resolveWorkflowCtaHref(primaryAgreement.projectId, {
          explicitHref: paymentBlocker.ctaHref,
          hint: paymentBlocker.title + ' ' + paymentBlocker.explanation,
        })
      : paymentBlocker.ctaHref;
    return {
      eyebrow: greeting(operatorName),
      headline: `Revenue is waiting. Completing ${actionItems.length === 1 ? 'one action' : `${actionItems.length} actions`} today will unlock ${formatCompactCurrency(collectedRevenue, currency)} in customer payments.`,
      steps,
      estimatedMinutes: totalMinutes,
      outcome: 'Customer payments begin flowing today.',
      ctaLabel: 'Connect payment provider',
      ctaHref: blockerHref,
      tone: 'waiting',
    };
  }

  // ── Primary agreement almost ready — main case
  if (primaryAgreement && actionItems.length > 0) {
    const primaryTasks = queueTasks.filter(
      (t) =>
        t.context.toLowerCase().trim() === primaryAgreement.agreementName.toLowerCase().trim() ||
        primaryAgreement.agreementName.toLowerCase().includes(t.context.toLowerCase())
    );
    const steps = primaryTasks.slice(0, 3).map((t) => t.title);
    const totalMinutes = primaryTasks.slice(0, 3).reduce((s, t) => s + t.estimatedMinutes, 0);

    // Determine the most appropriate next tab based on the top action
    const topActionItem = actionItems[0];
    const topTask = primaryTasks[0];
    const nextHint =
      (topActionItem ? topActionItem.title + ' ' + (topActionItem.explanation ?? '') : '') +
      ' ' +
      (topTask ? topTask.title : '');
    const smartCtaHref = resolveWorkflowCtaHref(primaryAgreement.projectId, {
      explicitHref: topTask?.ctaHref,
      hint: nextHint,
    });

    // Multiple agreements, some need attention
    if (totalAgreements > 1 && healthyAgreements.length > 0) {
      return {
        eyebrow: greeting(operatorName),
        headline: `${projectsProgressingLabel(healthyAgreements.length)} progressing well.`,
        body: `${primaryAgreement.agreementName} needs attention before payouts can be released.`,
        steps,
        estimatedMinutes: totalMinutes > 0 ? totalMinutes : undefined,
        outcome: 'Settlement cleared across all projects.',
        ctaLabel: `Continue ${primaryAgreement.agreementName}`,
        ctaHref: smartCtaHref,
        tone: 'action',
      };
    }

    // Single focus agreement
    const minuteStr = totalMinutes > 0 ? `in about ${totalMinutes} minutes` : 'today';
    return {
      eyebrow: greeting(operatorName),
      headline: `I can have ${primaryAgreement.agreementName} ready to collect customer payments ${minuteStr}.`,
      body: steps.length > 0 ? 'We only need to:' : undefined,
      steps,
      estimatedMinutes: totalMinutes > 0 ? totalMinutes : undefined,
      outcome: 'Customer payments can begin today.',
      ctaLabel: 'Continue',
      ctaHref: smartCtaHref,
      tone: 'action',
    };
  }

  // Fallback
  return {
    eyebrow: greeting(operatorName),
    headline: `${projectCountLabel(totalAgreements)} in progress.`,
    body:
      actionItems.length > 0
        ? `${actionItems.length} action${actionItems.length === 1 ? '' : 's'} need your attention.`
        : undefined,
    ctaLabel: `View ${PRODUCT_TERMINOLOGY.projectsLower}`,
    tone: 'action',
  };
}

/* ─── Component ─── */

/**
 * Provvy Copilot — the proactive intelligence layer.
 * Replaces Business Pulse with an operations manager voice.
 * First-person. Specific. Always recommends one thing. Always has a CTA.
 */
export function ProvvyCopilot({
  operatorName,
  attentionItems,
  kpis,
  releaseConfidence,
  snapshots,
  queueTasks,
  auditEntries,
  openingSummary,
  greeting,
  todaysFocus,
  workspaceMode,
  loading,
}: ProvvyCopilotProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-5 space-y-3 animate-pulse">
        <div className="h-3 w-32 bg-muted/60 rounded" />
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-1/2 bg-muted/60 rounded" />
          <div className="h-3 w-2/5 bg-muted/40 rounded" />
        </div>
      </div>
    );
  }

  // Adaptive interface: operational/mature businesses get insights instead of guidance
  // The product becomes quieter as the business matures — mostly outcomes, not instructions.
  if (workspaceMode && shouldShowInsights(workspaceMode) && (!todaysFocus || todaysFocus.length === 0)) {
    return (
      <CommercialInsights
        mode={workspaceMode}
        kpis={kpis ?? null}
        releaseConfidence={releaseConfidence ?? null}
        auditEntries={auditEntries ?? []}
      />
    );
  }

  // Derive narrative from legacy buildNarrative (workspace-level, multi-agreement)
  const narrative = buildNarrative(
    operatorName,
    attentionItems,
    kpis,
    releaseConfidence,
    snapshots,
    queueTasks
  );

  // Augment with Decision Engine memory when a primary agreement exists
  const primaryAgreement = [...snapshots].sort((a, b) => a.score - b.score)[0];
  const engineDecision =
    primaryAgreement && auditEntries
      ? analyseWorkspace({
          projectId: primaryAgreement.projectId,
          agreementName: primaryAgreement.agreementName,
          kpis: kpis ?? null,
          releaseConfidence: releaseConfidence ?? null,
          workspaceContext: null,
          activation: null,
          attentionItems,
          auditEntries,
        })
      : null;

  // Override headline with conversational summary when memory is available
  const memoryLine =
    engineDecision?.memory?.lastActionSentence &&
    engineDecision.memory.todayIntentSentence
      ? `${engineDecision.memory.lastActionSentence} ${engineDecision.memory.todayIntentSentence}`
      : null;

  const borderClass = {
    action: 'border-border/70',
    positive: 'border-[rgba(29,111,66,0.25)]',
    waiting: 'border-amber-200/70',
    empty: 'border-border/50',
  }[narrative.tone];

  const bgClass = {
    action: 'bg-white/70',
    positive: 'bg-[rgba(29,111,66,0.03)]',
    waiting: 'bg-amber-50/30',
    empty: 'bg-white/50',
  }[narrative.tone];

  return (
    <div
      className={cn(
        'rounded-xl border px-5 py-5 space-y-4',
        borderClass,
        bgClass
      )}
    >
      {/* Greeting — from Operations Manager or time-based fallback */}
      {(greeting ?? narrative.eyebrow ?? memoryLine) ? (
        <p className={cn(
          'text-sm text-muted-foreground',
          memoryLine && !greeting ? 'italic' : ''
        )}>
          {greeting ?? (memoryLine || narrative.eyebrow)}
        </p>
      ) : null}

      {/* Opening summary — from Operations Manager, or internally-derived headline */}
      <p className="text-base font-semibold text-foreground leading-snug">
        {openingSummary ?? narrative.headline}
      </p>

      {/* Today's Focus — numbered list from Operations Manager */}
      {todaysFocus && todaysFocus.length > 0 ? (
        <ol className="space-y-3 pt-1">
          {todaysFocus.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted/60 text-[10px] font-semibold text-muted-foreground mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{item.headline}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.context}</p>
                {item.estimatedMinutes > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated work: <span className="font-medium text-foreground">{item.estimatedMinutes} minutes</span>
                  </p>
                ) : null}
              </div>
              <Link
                href={item.href}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[rgb(124,92,255)] hover:text-[rgb(108,78,235)] transition-colors mt-0.5"
              >
                {item.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <>
          {/* Fallback: body copy */}
          {narrative.body ? (
            <p className="text-sm text-muted-foreground leading-snug">{narrative.body}</p>
          ) : null}

          {/* Fallback: ordered checklist */}
          {narrative.steps && narrative.steps.length > 0 ? (
            <ul className="space-y-1.5">
              {narrative.steps.map((step, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <Circle className="h-3.5 w-3.5 text-border shrink-0" aria-hidden />
                  <span className="text-foreground/85">{step}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Fallback: footer CTA */}
          <div
            className={cn(
              'flex items-end justify-between gap-4 flex-wrap',
              (narrative.outcome || narrative.estimatedMinutes) && 'pt-3 border-t border-border/30'
            )}
          >
            <div className="space-y-0.5">
              {narrative.estimatedMinutes ? (
                <p className="text-xs text-muted-foreground">
                  Estimated time —{' '}
                  <span className="font-medium text-foreground">
                    {narrative.estimatedMinutes} minute{narrative.estimatedMinutes === 1 ? '' : 's'}
                  </span>
                </p>
              ) : null}
              {narrative.outcome ? (
                <p className="text-xs text-muted-foreground">
                  Expected outcome —{' '}
                  <span className="font-medium text-foreground">{narrative.outcome}</span>
                </p>
              ) : null}
            </div>

            {narrative.ctaHref ? (
              <Button
                asChild
                size="sm"
                className={cn(
                  'shrink-0 h-8 text-sm font-semibold',
                  narrative.tone === 'positive'
                    ? 'bg-[rgb(29,111,66)] hover:bg-[rgb(22,95,55)] text-white border-0'
                    : 'bg-foreground hover:bg-foreground/90 text-background border-0'
                )}
              >
                <Link href={narrative.ctaHref}>
                  {narrative.ctaLabel}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">{narrative.ctaLabel}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
