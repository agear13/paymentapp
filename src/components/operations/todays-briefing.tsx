'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { AttentionItem } from '@/lib/operations/severity';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import type { OperationalAction } from '@/lib/operations/explainability/types';

type TodaysBriefingProps = {
  operatorName?: string;
  attentionItems: AttentionItem[];
  kpis: OperationalKPIs | null | undefined;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  snapshots: AgreementHealthSnapshot[];
  primaryAction: OperationalAction | null;
  loading?: boolean;
};

function greeting(name?: string): string {
  const h = new Date().getHours();
  const salutation =
    h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${salutation}, ${name}.` : `${salutation}.`;
}

type BulletItem = {
  text: string;
  tone?: 'default' | 'positive' | 'urgent';
};

function deriveBullets(
  attentionItems: AttentionItem[],
  kpis: OperationalKPIs | null | undefined,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  snapshots: AgreementHealthSnapshot[]
): BulletItem[] {
  const bullets: BulletItem[] = [];

  const activeCount = snapshots.length;
  if (activeCount > 0) {
    bullets.push({
      text: `${activeCount} agreement${activeCount === 1 ? '' : 's'} in progress`,
    });
  }

  const revenue = releaseConfidence?.collectedRevenue ?? 0;
  const currency = releaseConfidence?.currency ?? 'AUD';
  if (revenue > 0) {
    bullets.push({
      text: `${formatCompactCurrency(revenue, currency)} awaiting settlement`,
      tone: 'positive',
    });
  }

  const participantsWaiting = attentionItems.filter(
    (i) =>
      (i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED') &&
      /participant|approval|invite/i.test(i.title + ' ' + i.explanation)
  ).length;
  if (participantsWaiting > 0) {
    bullets.push({
      text: `${participantsWaiting} participant${participantsWaiting === 1 ? '' : 's'} waiting for approval`,
      tone: 'urgent',
    });
  }

  const payoutReady = kpis?.releaseEligibleCount ?? 0;
  if (payoutReady > 0) {
    bullets.push({
      text: `${payoutReady} payout${payoutReady === 1 ? '' : 's'} ready to release`,
      tone: 'positive',
    });
  }

  return bullets.slice(0, 4);
}

function deriveEstimatedMinutes(action: OperationalAction | null): number {
  if (!action) return 0;
  const map = { critical: 1, high: 3, medium: 6, low: 10 };
  return map[action.urgency] ?? 3;
}

/**
 * Today's Briefing — the very first thing an operator sees.
 * Replaces "opening software" with "starting work."
 * Decision → Action → Explanation. Not the other way around.
 */
export function TodaysBriefing({
  operatorName,
  attentionItems,
  kpis,
  releaseConfidence,
  snapshots,
  primaryAction,
  loading,
}: TodaysBriefingProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-5 space-y-3 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="space-y-2">
          <div className="h-3 w-64 bg-muted/70 rounded" />
          <div className="h-3 w-52 bg-muted/70 rounded" />
        </div>
      </div>
    );
  }

  const bullets = deriveBullets(attentionItems, kpis, releaseConfidence, snapshots);
  const primaryAgreement = [...snapshots].sort((a, b) => a.score - b.score)[0];
  const focusName = primaryAgreement?.agreementName ?? null;
  const estimatedMinutes = deriveEstimatedMinutes(primaryAction);
  const destination = primaryAction?.destination ?? (primaryAgreement ? `/dashboard/projects/${encodeURIComponent(primaryAgreement.projectId)}` : null);

  const hasSomethingToReport = bullets.length > 0 || focusName;
  if (!hasSomethingToReport) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-gradient-to-br from-white via-white to-[rgba(124,92,255,0.03)]',
        'px-5 py-5 space-y-4'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{greeting(operatorName)}</p>
          {bullets.length > 0 ? (
            <p className="text-sm text-muted-foreground mt-0.5">Your business today:</p>
          ) : null}
        </div>
        <Sparkles className="h-4 w-4 text-[rgb(124,92,255)] shrink-0 mt-0.5 opacity-70" aria-hidden />
      </div>

      {/* Day summary bullets */}
      {bullets.length > 0 ? (
        <ul className="space-y-1.5">
          {bullets.map((b) => (
            <li key={b.text} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                  b.tone === 'positive' && 'bg-[rgb(29,111,66)]',
                  b.tone === 'urgent' && 'bg-amber-500',
                  (!b.tone || b.tone === 'default') && 'bg-muted-foreground/50'
                )}
                aria-hidden
              />
              <span
                className={cn(
                  b.tone === 'positive' && 'text-foreground',
                  b.tone === 'urgent' && 'text-foreground',
                  (!b.tone || b.tone === 'default') && 'text-muted-foreground'
                )}
              >
                {b.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Recommended focus */}
      {focusName ? (
        <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended focus today
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              Finish preparing{' '}
              <span className="text-foreground">{focusName}</span>
              {estimatedMinutes > 0 ? (
                <span className="text-muted-foreground font-normal">
                  {' '}— {estimatedMinutes} min
                </span>
              ) : null}
            </p>
          </div>
          {destination ? (
            <Button
              asChild
              size="sm"
              className="h-8 text-xs bg-foreground hover:bg-foreground/90 text-background border-0 shrink-0"
            >
              <Link href={destination}>
                Start
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
