'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { AgreementPrimaryRecommendation } from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackRecommendationCtaClick } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import { cn } from '@/lib/utils';

type BriefingRecommendedActionHeroProps = {
  recommendation: AgreementPrimaryRecommendation | null;
  projectId?: string;
  agreementName?: string;
  onRecommendationCtaClick?: () => void;
};

const urgencyClass: Record<AgreementPrimaryRecommendation['urgency'], string> = {
  critical: 'border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/20',
  high: 'border-[rgba(124,92,255,0.25)]',
  medium: 'border-[rgba(124,92,255,0.18)]',
  low: 'border-border/60',
};

const urgencyLabel: Record<AgreementPrimaryRecommendation['urgency'], string> = {
  critical: 'Urgent',
  high: 'High priority',
  medium: 'Next step',
  low: 'Suggested',
};

export function BriefingRecommendedActionHero({
  recommendation,
  projectId,
  agreementName,
  onRecommendationCtaClick,
}: BriefingRecommendedActionHeroProps) {
  if (!recommendation) {
    return (
      <section
        id="briefing-recommendation"
        className="scroll-mt-28 surface-intelligence p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <IntelligenceBadge />
        <p className="text-sm font-semibold mt-3">Current recommendation</p>
        <p className="text-sm text-muted-foreground mt-2">
          Coordination is in progress. Review settlement readiness below for next steps.
        </p>
      </section>
    );
  }

  return (
    <section
      id="briefing-recommendation"
      className={cn(
        'scroll-mt-28 surface-intelligence p-6 sm:p-8 border-2 animate-in fade-in slide-in-from-bottom-2 duration-500',
        urgencyClass[recommendation.urgency]
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="space-y-4 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <IntelligenceBadge />
            <Badge
              variant="outline"
              className={cn(
                recommendation.urgency === 'critical' &&
                  'border-amber-500/40 text-amber-800 dark:text-amber-300'
              )}
            >
              {urgencyLabel[recommendation.urgency]}
            </Badge>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(124,92,255)]">
              Current recommendation
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mt-2 leading-snug">
              {recommendation.action}
            </h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 max-w-3xl">
            <div className="rounded-lg bg-white/70 dark:bg-background/40 px-4 py-3 border border-[rgba(124,92,255,0.08)]">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reason
              </dt>
              <dd className="text-sm mt-1 leading-relaxed">{recommendation.reason}</dd>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-background/40 px-4 py-3 border border-[rgba(124,92,255,0.08)]">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Impact
              </dt>
              <dd className="text-sm mt-1 leading-relaxed">{recommendation.impact}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0">
          <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(124,92,255,0.1)]">
            <Sparkles className="h-6 w-6 text-[rgb(124,92,255)]" />
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link
              href={recommendation.ctaHref}
              onClick={() => {
                onRecommendationCtaClick?.();
                if (projectId) {
                  trackRecommendationCtaClick({
                    projectId,
                    agreementName,
                    recommendationId: recommendation.action,
                    recommendationAction: recommendation.action,
                  });
                }
              }}
            >
              {recommendation.ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
