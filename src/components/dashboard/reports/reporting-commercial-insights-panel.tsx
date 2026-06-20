'use client';

/**
 * Reporting Commercial Insights Panel
 *
 * Sprint 7.5 — integrates the Commercial Explainability Engine into the
 * Reporting Overview page.
 *
 * The same drawers used on the dashboard are reused here — zero duplicate
 * calculations. The panel simply provides the entry points ("View Sources")
 * that open the canonical explainability drawers.
 *
 * Architecture:
 *   - Consumes the same `useOperationalCoordinationState` hook as the dashboard.
 *   - Derives the forecast identically to `CommercialPositionCards`.
 *   - Renders "View Sources" next to every figure.
 *   - On click, opens the appropriate drawer from `@/components/commercial/explainability`.
 */

import * as React from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  deriveCommercialForecast,
  formatForecastAmount,
  type CommercialForecastResult,
} from '@/lib/commercial/commercial-forecast';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import {
  RevenueBreakdownDrawer,
  ObligationsBreakdownDrawer,
  NetForecastBreakdownDrawer,
  CashReadinessBreakdownDrawer,
  ConfidenceBreakdownDrawer,
} from '@/components/commercial/explainability';

type DrawerKind = 'revenue' | 'obligations' | 'net_forecast' | 'cash_readiness' | 'confidence' | null;

type InsightRowProps = {
  label: string;
  value: string;
  subvalue?: string;
  accent?: 'positive' | 'negative' | 'neutral';
  onViewSources: () => void;
};

function InsightRow({ label, value, subvalue, accent = 'neutral', onViewSources }: InsightRowProps) {
  const accentClass =
    accent === 'positive' ? 'text-green-700' :
    accent === 'negative' ? 'text-red-600' :
    'text-foreground';

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {subvalue && <p className="text-xs text-muted-foreground mt-0.5">{subvalue}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn('text-sm font-bold tabular-nums', accentClass)}>{value}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onViewSources}
        >
          View Sources
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ReportingCommercialInsightsPanel({
  currency = 'AUD',
  projectId,
}: {
  currency?: string;
  /** When provided, explainability drawer items link back to the agreement. */
  projectId?: string;
}) {
  const { guidance, loading } = useOperationalCoordinationState({
    traceSurface: 'reporting-commercial-insights-panel',
  });

  const [openDrawer, setOpenDrawer] = React.useState<DrawerKind>(null);

  const forecast = React.useMemo<CommercialForecastResult | null>(() => {
    const rc = guidance.releaseConfidence;
    if (!rc) return null;

    const confirmedFunding = rc.collectedRevenue ?? 0;
    const obligationsTotal = rc.reservedObligations ?? 0;
    const readyToRelease = rc.readyToRelease ?? 0;
    const heldBack = rc.heldBack ?? 0;

    return deriveCommercialForecast({
      fundingSources: [],
      treasury: {
        currency,
        fundingSourceCount: confirmedFunding > 0 ? 1 : 0,
        totalExpectedInflows: confirmedFunding,
        // confirmedFunding = payments cleared for release.
        // heldBack = collected but not yet cleared; pending not forecast.
        confirmedFunding: readyToRelease,
        pendingFunding: heldBack,
        forecastFunding: 0,
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
      releaseConfidence: rc,
      currency,
    });
  }, [guidance.releaseConfidence, currency]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (!forecast) return null;

  const { forecastPosition, cashReadiness, overallConfidence } = forecast;
  const isSurplus = forecastPosition.status === 'surplus';
  const isDeficit = forecastPosition.status === 'deficit';
  const netValue =
    forecastPosition.status === 'insufficient_data'
      ? '—'
      : `${forecastPosition.forecastBalance >= 0 ? '+' : ''}${formatForecastAmount(forecastPosition.forecastBalance, currency)}`;

  return (
    <>
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-1">
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Commercial Position</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Every figure links to its underlying sources. Select "View Sources" to see the evidence.
          </p>
        </div>

        <div className="mt-4">
          {/* Expected Revenue */}
          <InsightRow
            label="Expected Revenue"
            value={
              forecast.totalExpectedRevenue > 0
                ? formatForecastAmount(forecast.totalExpectedRevenue, currency)
                : `${currency} 0.00`
            }
            subvalue={
              forecast.confirmedRevenue > 0
                ? `${formatForecastAmount(forecast.confirmedRevenue, currency)} confirmed`
                : 'No revenue sources yet'
            }
            accent={forecast.totalExpectedRevenue > 0 ? 'positive' : 'neutral'}
            onViewSources={() => setOpenDrawer('revenue')}
          />

          {/* Expected Obligations */}
          <InsightRow
            label="Expected Obligations"
            value={
              forecast.totalCommitments > 0
                ? formatForecastAmount(forecast.totalCommitments, currency)
                : `${currency} 0.00`
            }
            subvalue={
              forecast.fixedCommitments.length > 0
                ? `${forecast.fixedCommitments.length} fixed commitment${forecast.fixedCommitments.length !== 1 ? 's' : ''}`
                : undefined
            }
            accent="neutral"
            onViewSources={() => setOpenDrawer('obligations')}
          />

          {/* Net Forecast */}
          <InsightRow
            label="Net Forecast"
            value={netValue}
            subvalue={
              isSurplus ? 'Surplus' :
              isDeficit ? 'Shortfall' :
              forecastPosition.status === 'break_even' ? 'Break even' :
              undefined
            }
            accent={isSurplus ? 'positive' : isDeficit ? 'negative' : 'neutral'}
            onViewSources={() => setOpenDrawer('net_forecast')}
          />

          {/* Cash Readiness */}
          <InsightRow
            label="Cash Readiness"
            value={cashReadiness.canEveryoneBePaid ? 'YES' : 'NO'}
            subvalue={
              cashReadiness.canEveryoneBePaid && cashReadiness.expectedBalanceAfterSettlement != null
                ? `+${formatForecastAmount(cashReadiness.expectedBalanceAfterSettlement, currency)} after settlement`
                : cashReadiness.forecastShortfall != null
                  ? `-${formatForecastAmount(cashReadiness.forecastShortfall, currency)} shortfall`
                  : undefined
            }
            accent={cashReadiness.canEveryoneBePaid ? 'positive' : 'negative'}
            onViewSources={() => setOpenDrawer('cash_readiness')}
          />

          {/* Commercial Confidence */}
          <InsightRow
            label="Commercial Confidence"
            value={
              overallConfidence.level === 'INSUFFICIENT_DATA'
                ? '—'
                : `${overallConfidence.score}%`
            }
            subvalue={
              overallConfidence.level !== 'INSUFFICIENT_DATA'
                ? overallConfidence.summary
                : 'Add revenue sources to calculate confidence'
            }
            accent={
              overallConfidence.score >= 80 ? 'positive' :
              overallConfidence.score >= 50 ? 'neutral' :
              'negative'
            }
            onViewSources={() => setOpenDrawer('confidence')}
          />
        </div>
      </div>

      {/* Drawers — identical to those used on the dashboard, with projectId for deep-links */}
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
  );
}
