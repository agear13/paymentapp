'use client';

/**
 * Commercial Position Cards
 *
 * Six live cards for the operator dashboard that answer the core commercial question:
 * "What is the financial state of my business right now?"
 *
 * All figures derive exclusively from `CommercialFinancialSnapshot` — the shared
 * commercial engine used by both dashboard and agreement overview surfaces.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Check, Minus, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatForecastAmount,
} from '@/lib/commercial/commercial-forecast';
import {
  type CommercialHealthLevel,
} from '@/lib/commercial/commercial-health';
import type { CommercialFinancialSnapshot } from '@/lib/commercial/commercial-financial-snapshot';
import {
  RevenueBreakdownDrawer,
  ObligationsBreakdownDrawer,
  NetForecastBreakdownDrawer,
  CashReadinessBreakdownDrawer,
  ConfidenceBreakdownDrawer,
} from '@/components/commercial/explainability';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

export type CommercialPositionCardsProps = {
  snapshot: CommercialFinancialSnapshot | null | undefined;
  loading?: boolean;
  className?: string;
  projectId?: string;
};

type DrawerKind = 'revenue' | 'obligations' | 'net_forecast' | 'cash_readiness' | 'confidence' | null;

/* ─── Main component ────────────────────────────────────────────────────────── */

export function CommercialPositionCards({
  snapshot,
  loading = false,
  className,
  projectId,
}: CommercialPositionCardsProps) {
  const [openDrawer, setOpenDrawer] = React.useState<DrawerKind>(null);

  const forecast = snapshot?.forecast ?? null;
  const health = snapshot?.health ?? null;

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

  const curr = snapshot?.currency ?? forecast?.currency ?? 'AUD';
  const pos = forecast?.forecastPosition;
  const cashReady = forecast?.cashReadiness;
  const isSurplus = pos?.status === 'surplus';
  const isDeficit = pos?.status === 'deficit';

  return (
    <>
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6', className)}>
        {/* 1. Commercial Position */}
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
              : forecast
                ? formatForecastAmount(0, curr)
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
          interactive={!!forecast}
          onClick={forecast ? () => setOpenDrawer('revenue') : undefined}
        />

        {/* 3. Expected Obligations */}
        <PositionCard
          label="Expected Obligations"
          value={
            forecast
              ? formatForecastAmount(forecast.totalCommitments, curr)
              : '—'
          }
          subvalue={
            forecast && forecast.fixedCommitments.length > 0
              ? `${forecast.fixedCommitments.length} fixed commitment${forecast.fixedCommitments.length !== 1 ? 's' : ''}`
              : forecast && forecast.totalCommitments === 0
                ? 'No obligations configured'
                : undefined
          }
          accent="neutral"
          icon={forecast && forecast.totalCommitments > 0 ? <ArrowDown className="h-4 w-4 text-muted-foreground" /> : null}
          interactive={!!forecast}
          onClick={forecast ? () => setOpenDrawer('obligations') : undefined}
        />

        {/* 4. Net Forecast */}
        <PositionCard
          label="Net Forecast"
          value={
            pos && pos.status !== 'insufficient_data'
              ? (pos.forecastBalance >= 0 ? '+' : '') +
                formatForecastAmount(pos.forecastBalance, curr)
              : pos
                ? formatForecastAmount(pos.forecastBalance, curr)
                : '—'
          }
          subvalue={
            isSurplus
              ? 'Surplus'
              : isDeficit
                ? 'Shortfall'
                : pos?.status === 'break_even'
                  ? 'Break even'
                  : pos?.status === 'insufficient_data'
                    ? 'No revenue sources'
                    : undefined
          }
          accent={isSurplus ? 'positive' : isDeficit ? 'negative' : 'neutral'}
          icon={
            isSurplus ? (
              <ArrowUp className="h-4 w-4" />
            ) : isDeficit ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )
          }
          interactive={!!forecast}
          onClick={forecast ? () => setOpenDrawer('net_forecast') : undefined}
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
                : cashReady && !cashReady.canEveryoneBePaid
                  ? cashReady.primaryBlocker ?? undefined
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
          interactive={!!forecast}
          onClick={forecast ? () => setOpenDrawer('cash_readiness') : undefined}
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
          interactive={!!forecast}
          onClick={forecast ? () => setOpenDrawer('confidence') : undefined}
        />
      </div>

      {forecast && (
        <>
          <RevenueBreakdownDrawer
            open={openDrawer === 'revenue'}
            onOpenChange={(v) => setOpenDrawer(v ? 'revenue' : null)}
            forecast={forecast}
            projectId={projectId}
          />
          <ObligationsBreakdownDrawer
            open={openDrawer === 'obligations'}
            onOpenChange={(v) => setOpenDrawer(v ? 'obligations' : null)}
            forecast={forecast}
            projectId={projectId}
          />
          <NetForecastBreakdownDrawer
            open={openDrawer === 'net_forecast'}
            onOpenChange={(v) => setOpenDrawer(v ? 'net_forecast' : null)}
            forecast={forecast}
            projectId={projectId}
          />
          <CashReadinessBreakdownDrawer
            open={openDrawer === 'cash_readiness'}
            onOpenChange={(v) => setOpenDrawer(v ? 'cash_readiness' : null)}
            forecast={forecast}
            projectId={projectId}
          />
          <ConfidenceBreakdownDrawer
            open={openDrawer === 'confidence'}
            onOpenChange={(v) => setOpenDrawer(v ? 'confidence' : null)}
            forecast={forecast}
            projectId={projectId}
          />
        </>
      )}
    </>
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
  interactive = false,
  onClick,
}: {
  label: string;
  value: string;
  subvalue?: string;
  accent: CardAccent;
  icon: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
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
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      className={cn(
        'rounded-xl border bg-card px-4 py-3.5 space-y-2 min-h-[80px] flex flex-col justify-between',
        borderClass[accent],
        interactive && 'cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
          {label}
        </p>
        {interactive && (
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
        )}
      </div>
      <div className="space-y-0.5">
        <div className={cn('flex items-center gap-1.5', accentClass[accent])}>
          {icon}
          <span className="text-base font-bold tabular-nums leading-none">{value}</span>
        </div>
        {subvalue && (
          <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">{subvalue}</p>
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
