'use client';

/**
 * Commercial Position Cards
 *
 * Six live cards for the operator dashboard that answer the core commercial question:
 * "What is the financial state of my business right now?"
 *
 * Cards:
 *   1. Commercial Position  — overall health level
 *   2. Expected Revenue     — total incoming
 *   3. Expected Obligations — total commitments
 *   4. Net Forecast         — position (surplus / deficit)
 *   5. Cash Readiness       — can everyone be paid?
 *   6. Commercial Confidence — overall confidence level
 *
 * All figures derive exclusively from `deriveCommercialForecast()` and
 * `deriveCommercialHealth()`. No independent calculations in this component.
 *
 * Design:
 *   - Operator language only. No accounting jargon.
 *   - One answer per card. No charts.
 *   - Primary colour: green (surplus/healthy), red (deficit/blocked), amber (attention).
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Check, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  deriveCommercialForecast,
  formatForecastAmount,
  type CommercialForecastResult,
} from '@/lib/commercial/commercial-forecast';
import {
  deriveCommercialHealth,
  type CommercialHealthScore,
  type CommercialHealthLevel,
} from '@/lib/commercial/commercial-health';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { CommercialDecisionResult } from '@/components/workflow/commercial-decision-engine';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

export type CommercialPositionCardsProps = {
  releaseConfidence: ReleaseConfidenceSnapshot | null | undefined;
  kpis: OperationalKPIs | null | undefined;
  decision?: CommercialDecisionResult | null;
  currency?: string;
  loading?: boolean;
  className?: string;
};

/* ─── Main component ────────────────────────────────────────────────────────── */

export function CommercialPositionCards({
  releaseConfidence,
  kpis,
  decision,
  currency = 'AUD',
  loading = false,
  className,
}: CommercialPositionCardsProps) {
  // Derive forecast from available workspace data
  // At the dashboard level we use release confidence figures as aggregates
  const forecast = React.useMemo<CommercialForecastResult | null>(() => {
    if (!releaseConfidence) return null;

    const confirmedFunding = releaseConfidence.collectedRevenue ?? 0;
    const obligationsTotal = releaseConfidence.reservedObligations ?? 0;
    const readyToRelease = releaseConfidence.readyToRelease ?? 0;
    const heldBack = releaseConfidence.heldBack ?? 0;

    return deriveCommercialForecast({
      fundingSources: [],
      treasury: {
        currency,
        fundingSourceCount: confirmedFunding > 0 ? 1 : 0,
        totalExpectedInflows: confirmedFunding,
        confirmedFunding,
        pendingFunding: 0,
        forecastFunding: heldBack,
        clearedFunding: readyToRelease,
        obligationsTotal,
        obligationsReady: readyToRelease,
        obligationsAwaitingFunding: heldBack,
        operationalReadiness: readyToRelease > 0 ? 'ready' : 'awaiting_funding',
        projectHealth:
          confirmedFunding >= obligationsTotal
            ? 'healthy'
            : confirmedFunding > 0
              ? 'partially_funded'
              : 'forecast_heavy',
        hasFundingSources: confirmedFunding > 0,
        fundingLabel: '',
        fundingSubcopy: '',
      },
      obligationRows: [],
      releaseConfidence: releaseConfidence ?? null,
      currency,
    });
  }, [releaseConfidence, currency]);

  const health = React.useMemo<CommercialHealthScore | null>(() => {
    if (!forecast && !decision && !kpis) return null;
    return deriveCommercialHealth(forecast ?? null, decision ?? null, kpis ?? null);
  }, [forecast, decision, kpis]);

  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <PositionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!forecast && !health) return null;

  const curr = currency;
  const pos = forecast?.forecastPosition;
  const cashReady = forecast?.cashReadiness;
  const isSurplus = pos?.status === 'surplus';
  const isDeficit = pos?.status === 'deficit';

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6', className)}>
      {/* 1. Commercial Position — overall health */}
      <PositionCard
        label="Commercial Position"
        value={health?.level ? healthLevelLabel(health.level) : '—'}
        subvalue={health?.summary ?? undefined}
        accent={health ? healthLevelAccent(health.level) : 'neutral'}
        icon={health ? healthLevelIcon(health.level) : null}
      />

      {/* 2. Expected Revenue */}
      <PositionCard
        label="Expected Revenue"
        value={
          forecast && forecast.totalExpectedRevenue > 0
            ? formatForecastAmount(forecast.totalExpectedRevenue, curr)
            : '—'
        }
        subvalue={
          forecast && forecast.confirmedRevenue > 0
            ? `${formatForecastAmount(forecast.confirmedRevenue, curr)} confirmed`
            : forecast && forecast.totalExpectedRevenue === 0
              ? 'No revenue sources yet'
              : undefined
        }
        accent={forecast && forecast.totalExpectedRevenue > 0 ? 'positive' : 'neutral'}
        icon={forecast && forecast.totalExpectedRevenue > 0 ? <ArrowUp className="h-4 w-4" /> : null}
      />

      {/* 3. Expected Obligations */}
      <PositionCard
        label="Expected Obligations"
        value={
          forecast && forecast.totalCommitments > 0
            ? formatForecastAmount(forecast.totalCommitments, curr)
            : '—'
        }
        subvalue={
          forecast && forecast.fixedCommitments.length > 0
            ? `${forecast.fixedCommitments.length} fixed commitment${forecast.fixedCommitments.length !== 1 ? 's' : ''}`
            : undefined
        }
        accent="neutral"
        icon={forecast && forecast.totalCommitments > 0 ? <ArrowDown className="h-4 w-4 text-muted-foreground" /> : null}
      />

      {/* 4. Net Forecast */}
      <PositionCard
        label="Net Forecast"
        value={
          pos && pos.status !== 'insufficient_data'
            ? (pos.forecastBalance >= 0 ? '+' : '') +
              formatForecastAmount(pos.forecastBalance, curr)
            : '—'
        }
        subvalue={
          isSurplus
            ? 'Surplus'
            : isDeficit
              ? 'Shortfall'
              : pos?.status === 'break_even'
                ? 'Break even'
                : undefined
        }
        accent={
          isSurplus ? 'positive' : isDeficit ? 'negative' : 'neutral'
        }
        icon={
          isSurplus ? (
            <ArrowUp className="h-4 w-4" />
          ) : isDeficit ? (
            <ArrowDown className="h-4 w-4" />
          ) : (
            <Minus className="h-4 w-4" />
          )
        }
      />

      {/* 5. Cash Readiness */}
      <PositionCard
        label="Cash Readiness"
        value={
          cashReady
            ? cashReady.canEveryoneBePaid
              ? 'YES'
              : 'NO'
            : '—'
        }
        subvalue={
          cashReady?.canEveryoneBePaid && cashReady.expectedBalanceAfterSettlement != null
            ? `+${formatForecastAmount(cashReady.expectedBalanceAfterSettlement, curr)} after settlement`
            : cashReady?.forecastShortfall != null
              ? `-${formatForecastAmount(cashReady.forecastShortfall, curr)} shortfall`
              : undefined
        }
        accent={
          cashReady
            ? cashReady.canEveryoneBePaid
              ? 'positive'
              : 'negative'
            : 'neutral'
        }
        icon={
          cashReady ? (
            cashReady.canEveryoneBePaid ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )
          ) : null
        }
      />

      {/* 6. Commercial Confidence */}
      <PositionCard
        label="Commercial Confidence"
        value={
          forecast
            ? forecast.overallConfidence.level === 'INSUFFICIENT_DATA'
              ? '—'
              : `${forecast.overallConfidence.score}%`
            : '—'
        }
        subvalue={
          forecast?.overallConfidence.level && forecast.overallConfidence.level !== 'INSUFFICIENT_DATA'
            ? forecast.overallConfidence.level
            : undefined
        }
        accent={
          forecast?.overallConfidence.score != null
            ? forecast.overallConfidence.score >= 80
              ? 'positive'
              : forecast.overallConfidence.score >= 50
                ? 'warning'
                : 'negative'
            : 'neutral'
        }
        icon={null}
      />
    </div>
  );
}

/* ─── Individual card ───────────────────────────────────────────────────────── */

type CardAccent = 'positive' | 'negative' | 'warning' | 'neutral';

function PositionCard({
  label,
  value,
  subvalue,
  accent,
  icon,
}: {
  label: string;
  value: string;
  subvalue?: string;
  accent: CardAccent;
  icon: React.ReactNode;
}) {
  const accentClass: Record<CardAccent, string> = {
    positive: 'text-green-700',
    negative: 'text-red-600',
    warning: 'text-amber-600',
    neutral: 'text-foreground',
  };

  const borderClass: Record<CardAccent, string> = {
    positive: 'border-green-100',
    negative: 'border-red-100',
    warning: 'border-amber-100',
    neutral: 'border-border/50',
  };

  return (
    <div
      className={cn(
        'rounded-xl border bg-card px-4 py-3.5 space-y-2 min-h-[80px] flex flex-col justify-between',
        borderClass[accent]
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
        {label}
      </p>
      <div className="space-y-0.5">
        <div className={cn('flex items-center gap-1.5', accentClass[accent])}>
          {icon}
          <span className="text-base font-bold tabular-nums leading-none">{value}</span>
        </div>
        {subvalue && (
          <p className="text-[11px] text-muted-foreground leading-tight">{subvalue}</p>
        )}
      </div>
    </div>
  );
}

function PositionCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-card px-4 py-3.5 space-y-2 min-h-[80px] animate-pulse">
      <div className="h-2.5 w-20 bg-muted rounded" />
      <div className="h-5 w-14 bg-muted rounded mt-2" />
    </div>
  );
}

/* ─── Health level helpers ──────────────────────────────────────────────────── */

function healthLevelLabel(level: CommercialHealthLevel): string {
  const LABELS: Record<CommercialHealthLevel, string> = {
    excellent: 'Excellent',
    good: 'Good',
    attention: 'Needs attention',
    at_risk: 'At risk',
    blocked: 'Blocked',
  };
  return LABELS[level];
}

function healthLevelAccent(level: CommercialHealthLevel): CardAccent {
  switch (level) {
    case 'excellent':
    case 'good':
      return 'positive';
    case 'attention':
      return 'warning';
    case 'at_risk':
    case 'blocked':
      return 'negative';
  }
}

function healthLevelIcon(level: CommercialHealthLevel): React.ReactNode {
  if (level === 'excellent' || level === 'good') {
    return <Check className="h-4 w-4" />;
  }
  if (level === 'blocked') {
    return <X className="h-4 w-4" />;
  }
  return null;
}
