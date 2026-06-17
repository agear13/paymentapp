'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { AttentionItem } from '@/lib/operations/severity';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';

type BusinessPulseProps = {
  attentionItems: AttentionItem[];
  kpis: OperationalKPIs | null | undefined;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  snapshots: AgreementHealthSnapshot[];
  totalEstimatedMinutes: number;
  loading?: boolean;
};

/* ─── Narrative generation ─── */

type PulseNarrative = {
  lines: string[];
  tone: 'positive' | 'neutral' | 'attention';
};

function buildNarrative(
  attentionItems: AttentionItem[],
  kpis: OperationalKPIs | null | undefined,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  snapshots: AgreementHealthSnapshot[],
  totalMinutes: number
): PulseNarrative {
  const criticalCount = attentionItems.filter((i) => i.severity === 'CRITICAL').length;
  const actionCount = attentionItems.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED'
  ).length;
  const revenue = releaseConfidence?.collectedRevenue ?? 0;
  const currency = releaseConfidence?.currency ?? 'AUD';
  const readyToRelease = releaseConfidence?.readyToRelease ?? 0;
  const participantsWaiting = releaseConfidence?.blockedParticipantCount ?? 0;
  const totalAgreements = snapshots.length;
  const healthyAgreements = snapshots.filter(
    (s) => s.category === 'excellent' || s.category === 'healthy'
  ).length;
  const needsAttentionAgreements = totalAgreements - healthyAgreements;
  const primaryAgreement = [...snapshots].sort((a, b) => a.score - b.score)[0];

  // Empty state — no agreements
  if (totalAgreements === 0) {
    return {
      lines: [
        'No agreements yet.',
        'Create your first agreement to begin coordinating commercial relationships.',
      ],
      tone: 'neutral',
    };
  }

  // Revenue is blocked
  const isPaymentUnconnected = attentionItems.some((i) =>
    /connect stripe|payment provider|stripe/i.test(i.title)
  );
  if (revenue > 0 && isPaymentUnconnected) {
    const lines = [
      `${formatCompactCurrency(revenue, currency)} is waiting to move.`,
    ];
    const participants = participantsWaiting > 0
      ? ` and inviting ${participantsWaiting} ${participantsWaiting === 1 ? 'participant' : 'participants'}`
      : '';
    lines.push(`Connecting your payment provider${participants} will unlock customer payments.`);
    if (totalMinutes > 0) lines.push(`Estimated work today: ${totalMinutes} minutes.`);
    return { lines, tone: 'attention' };
  }

  // Ready to release
  if (readyToRelease > 0 && actionCount === 0) {
    return {
      lines: [
        `${formatCompactCurrency(readyToRelease, currency)} is ready to release.`,
        'All participants are approved and obligations are confirmed.',
        `Release payouts whenever you are ready.`,
      ],
      tone: 'positive',
    };
  }

  // Multiple agreements, some need attention
  if (totalAgreements > 1 && needsAttentionAgreements > 0) {
    const lines: string[] = [];
    if (healthyAgreements > 0) {
      lines.push(
        `${healthyAgreements} ${healthyAgreements === 1 ? 'agreement is' : 'agreements are'} progressing well.`
      );
    }
    lines.push(
      `${needsAttentionAgreements} ${needsAttentionAgreements === 1 ? 'agreement needs' : 'agreements need'} attention before payouts can be released.`
    );
    if (totalMinutes > 0) lines.push(`Estimated work today: ${totalMinutes} minutes.`);
    return { lines, tone: 'attention' };
  }

  // Single agreement, almost ready
  if (
    primaryAgreement &&
    (primaryAgreement.category === 'healthy' || primaryAgreement.category === 'attention_required')
  ) {
    const lines: string[] = [
      `${primaryAgreement.agreementName} is almost ready to begin collecting payments.`,
    ];
    if (participantsWaiting === 1) {
      lines.push('Only one participant still needs approval.');
    } else if (participantsWaiting > 1) {
      lines.push(`${participantsWaiting} participants still need approval.`);
    } else if (criticalCount > 0) {
      const blocker = attentionItems.find((i) => i.severity === 'CRITICAL');
      if (blocker) {
        lines.push(`One action is blocking progress: ${blocker.title.toLowerCase()}.`);
      }
    }
    if (totalMinutes > 0) lines.push(`Estimated work today: ${totalMinutes} minutes.`);
    return { lines, tone: actionCount > 0 ? 'attention' : 'positive' };
  }

  // All excellent
  if (healthyAgreements === totalAgreements && actionCount === 0) {
    return {
      lines: [
        'Everything is progressing well.',
        totalAgreements === 1
          ? `${primaryAgreement?.agreementName ?? 'Your agreement'} is on track.`
          : `All ${totalAgreements} agreements are on track.`,
      ],
      tone: 'positive',
    };
  }

  // Default — work to do
  const lines: string[] = [];
  if (totalAgreements === 1 && primaryAgreement) {
    lines.push(`${primaryAgreement.agreementName} is in progress.`);
  } else {
    lines.push(`${totalAgreements} agreements are in progress.`);
  }
  if (actionCount > 0) {
    lines.push(
      `${actionCount} ${actionCount === 1 ? 'action needs' : 'actions need'} your attention today.`
    );
  }
  if (totalMinutes > 0) lines.push(`Estimated work today: ${totalMinutes} minutes.`);
  return { lines, tone: actionCount > 0 ? 'attention' : 'neutral' };
}

/* ─── Component ─── */

/**
 * Business Pulse — the very first thing an operator reads.
 * AI-style narrative summary: no percentages, no system terminology.
 * Maximum 4 lines. Tells operators what changed, what's blocked, and how long it takes.
 */
export function BusinessPulse({
  attentionItems,
  kpis,
  releaseConfidence,
  snapshots,
  totalEstimatedMinutes,
  loading,
}: BusinessPulseProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3 w-3 rounded-full bg-muted" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 bg-muted/80 rounded" />
          <div className="h-3 w-1/2 bg-muted/60 rounded" />
        </div>
      </div>
    );
  }

  const { lines, tone } = buildNarrative(
    attentionItems,
    kpis,
    releaseConfidence,
    snapshots,
    totalEstimatedMinutes
  );

  const borderColor = {
    positive: 'border-[rgba(29,111,66,0.2)]',
    attention: 'border-[rgba(245,158,11,0.25)]',
    neutral: 'border-border/60',
  }[tone];

  const zapColor = {
    positive: 'text-[rgb(29,111,66)]',
    attention: 'text-amber-600',
    neutral: 'text-muted-foreground/60',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-xl border bg-white/70 px-5 py-4 space-y-2.5',
        borderColor
      )}
    >
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <Zap
          className={cn('h-3 w-3 shrink-0', zapColor)}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Business Pulse
        </p>
      </div>

      {/* Narrative lines — each is a sentence, max 4 */}
      <div className="space-y-1">
        {lines.map((line, i) => (
          <p
            key={i}
            className={cn(
              'leading-snug',
              i === 0
                ? 'text-sm font-semibold text-foreground'
                : 'text-sm text-muted-foreground'
            )}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
