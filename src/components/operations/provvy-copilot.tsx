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
import type { QueueTask } from '@/components/operations/operational-queue';

type ProvvyCopilotProps = {
  operatorName?: string;
  attentionItems: AttentionItem[];
  kpis: OperationalKPIs | null | undefined;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  snapshots: AgreementHealthSnapshot[];
  queueTasks: QueueTask[];
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
      body: "Let's create your first commercial agreement and I'll guide you through preparing it for payments.",
      ctaLabel: 'Create agreement',
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
        ? `${healthyAgreements[0]?.agreementName ?? 'Your agreement'} is now ready for payouts. I'd recommend checking on ${secondAgreement.agreementName} next.`
        : `${primaryAgreement?.agreementName ?? 'Your agreement'} is now ready for payouts.`,
      ctaLabel: 'View agreements',
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
    return {
      eyebrow: greeting(operatorName),
      headline: `Revenue is waiting. Completing ${actionItems.length === 1 ? 'one action' : `${actionItems.length} actions`} today will unlock ${formatCompactCurrency(collectedRevenue, currency)} in customer payments.`,
      steps,
      estimatedMinutes: totalMinutes,
      outcome: 'Customer payments begin flowing today.',
      ctaLabel: 'Fix now',
      ctaHref: paymentBlocker.ctaHref,
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

    // Multiple agreements, some need attention
    if (totalAgreements > 1 && healthyAgreements.length > 0) {
      return {
        eyebrow: greeting(operatorName),
        headline: `${healthyAgreements.length} ${healthyAgreements.length === 1 ? 'agreement is' : 'agreements are'} progressing well.`,
        body: `${primaryAgreement.agreementName} needs attention before payouts can be released.`,
        steps,
        estimatedMinutes: totalMinutes > 0 ? totalMinutes : undefined,
        outcome: 'Settlement cleared across all agreements.',
        ctaLabel: `Fix ${primaryAgreement.agreementName}`,
        ctaHref: `/dashboard/projects/${encodeURIComponent(primaryAgreement.projectId)}`,
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
      ctaHref: primaryTasks[0]?.ctaHref ?? `/dashboard/projects/${encodeURIComponent(primaryAgreement.projectId)}`,
      tone: 'action',
    };
  }

  // Fallback
  return {
    eyebrow: greeting(operatorName),
    headline: `${totalAgreements} agreement${totalAgreements === 1 ? '' : 's'} in progress.`,
    body:
      actionItems.length > 0
        ? `${actionItems.length} action${actionItems.length === 1 ? '' : 's'} need your attention.`
        : undefined,
    ctaLabel: 'View agreements',
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

  const narrative = buildNarrative(
    operatorName,
    attentionItems,
    kpis,
    releaseConfidence,
    snapshots,
    queueTasks
  );

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
      {/* Eyebrow greeting */}
      {narrative.eyebrow ? (
        <p className="text-sm text-muted-foreground">{narrative.eyebrow}</p>
      ) : null}

      {/* Headline */}
      <p className="text-base font-semibold text-foreground leading-snug">
        {narrative.headline}
      </p>

      {/* Body copy */}
      {narrative.body ? (
        <p className="text-sm text-muted-foreground leading-snug">{narrative.body}</p>
      ) : null}

      {/* Ordered checklist */}
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

      {/* Footer: outcome + time + CTA */}
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
                : narrative.tone === 'empty'
                  ? 'bg-foreground hover:bg-foreground/90 text-background border-0'
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
    </div>
  );
}
