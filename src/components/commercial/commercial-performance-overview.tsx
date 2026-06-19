'use client';

/**
 * CommercialPerformanceOverview
 *
 * The canonical UI surface for commercial performance.
 *
 * Design rules:
 *   - No charts unless they communicate something impossible to express in numbers.
 *   - No gauges, donut charts, or decorative visualisations.
 *   - No duplicated metrics.
 *   - No AI summaries — only fact-derived, operator-facing language.
 *   - One operator question answered per section.
 *   - Everything immediately actionable.
 *
 * Sections (7):
 *   1. Cash Position        — "Where does my money sit right now?"
 *   2. Event Profitability  — "How profitable is this agreement?"
 *   3. Commercial Health    — "Is the business in a good commercial position?"
 *   4. Revenue Confidence   — "How certain is my revenue?"
 *   5. Commercial Variance  — "Am I ahead or behind forecast?"
 *   6. Variance Timeline    — "Why has commercial performance changed?"
 *   7. Portfolio Performance — "How are all my projects performing?"
 *
 * All values derive from deriveCommercialPerformance().
 * This component never calculates — it only renders.
 */

import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3,
  Minus,
  ChevronRight,
} from 'lucide-react';

import type {
  CommercialPerformanceResult,
  CashPosition,
  EventProfitability,
  CommercialHealthSummary,
  RevenueConfidenceResult,
  CommercialVarianceResult,
  VarianceTimelineEntry,
  CommercialPerformanceStatus,
  PortfolioPerformanceResult,
  PortfolioProjectSummary,
} from '@/lib/commercial/commercial-performance';

/* ─── Utilities ─────────────────────────────────────────────────────────── */

function fmt(amount: number, currency = 'AUD'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000)}k`;
  }
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function statusBadge(status: CommercialPerformanceStatus) {
  const map: Record<CommercialPerformanceStatus, { label: string; className: string }> = {
    healthy: { label: 'Healthy', className: 'bg-green-50 text-green-700 border-green-200' },
    watch: { label: 'Watch', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    attention: { label: 'Attention', className: 'bg-red-50 text-red-700 border-red-200' },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {status === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'watch' && <Clock className="h-3 w-3" />}
      {status === 'attention' && <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function SectionHeader({ question, title }: { question: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{question}</p>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function MetricRow({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: 'positive' | 'negative' | 'neutral';
}) {
  const valueClass =
    emphasis === 'positive'
      ? 'text-green-700'
      : emphasis === 'negative'
      ? 'text-red-700'
      : 'text-foreground';
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Section 1: Cash Position ───────────────────────────────────────────── */

function CashPositionSection({ cash }: { cash: CashPosition }) {
  return (
    <div>
      <SectionHeader question="Where does my money sit right now?" title="Cash Position" />
      <div className="rounded-lg border bg-card p-4">
        <MetricRow
          label="Confirmed Revenue"
          value={fmt(cash.today, cash.currency)}
          sub="Cleared and confirmed"
          emphasis="positive"
        />
        <MetricRow
          label="Expected Revenue"
          value={fmt(cash.expected, cash.currency)}
          sub="All incoming sources"
        />
        <MetricRow label="Committed Costs" value={fmt(cash.committed, cash.currency)} />
        <MetricRow
          label="Paid Out"
          value={fmt(cash.paid, cash.currency)}
          sub="Released to suppliers"
        />
        <MetricRow
          label="Outstanding"
          value={fmt(cash.outstanding, cash.currency)}
          sub="Remaining to pay"
          emphasis={cash.outstanding > 0 ? 'neutral' : 'positive'}
        />
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Forecast Position</span>
            <span
              className={`text-sm font-bold ${
                cash.forecastPosition >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {cash.forecastPosition >= 0 ? '+' : ''}
              {fmt(cash.forecastPosition, cash.currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {cash.canCoverCommitments
              ? 'Revenue is sufficient to meet all commitments.'
              : 'Revenue may not cover all commitments.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 2: Event Profitability ─────────────────────────────────────── */

function EventProfitabilitySection({ prof }: { prof: EventProfitability }) {
  return (
    <div>
      <SectionHeader question="How profitable is this agreement?" title={prof.projectName} />
      <div className="rounded-lg border bg-card p-4">
        <MetricRow label="Revenue" value={fmt(prof.revenue, prof.currency)} emphasis="positive" />
        <MetricRow label="Committed Costs" value={fmt(prof.committedCosts, prof.currency)} />
        <MetricRow label="Paid Out" value={fmt(prof.paid, prof.currency)} />
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-sm font-semibold">Forecast Margin</span>
          <div className="text-right">
            <span
              className={`text-base font-bold ${
                prof.forecastMargin >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {prof.forecastMargin >= 0 ? '+' : ''}
              {fmt(prof.forecastMargin, prof.currency)}
            </span>
            {prof.marginPercent !== null && (
              <p className="text-xs text-muted-foreground">{prof.marginPercent}% margin</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Cash Collected</p>
          <p className="text-sm font-semibold mt-1">
            {prof.cashCollectedPercent !== null ? `${prof.cashCollectedPercent}%` : '—'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-sm font-semibold mt-1">{fmt(prof.outstandingCommitments, prof.currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Avg Cost / Supplier</p>
          <p className="text-sm font-semibold mt-1">
            {prof.averageCostPerParticipant !== null
              ? fmt(prof.averageCostPerParticipant, prof.currency)
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 3: Commercial Health ──────────────────────────────────────── */

function CommercialHealthSection({ health }: { health: CommercialHealthSummary }) {
  return (
    <div>
      <SectionHeader question="Is the business in a good commercial position?" title="Commercial Health" />
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">{health.summary}</span>
          {statusBadge(health.status)}
        </div>

        <ul className="space-y-1.5">
          {health.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{reason}</span>
            </li>
          ))}
        </ul>

        {health.nextMilestone && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Next milestone</p>
            <p className="text-sm font-medium text-foreground">{health.nextMilestone}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section 4: Revenue Confidence ──────────────────────────────────────── */

function RevenueConfidenceSection({ confidence }: { confidence: RevenueConfidenceResult }) {
  const levelColors: Record<string, string> = {
    HIGH: 'text-green-700',
    MEDIUM: 'text-amber-700',
    LOW: 'text-red-700',
  };

  return (
    <div>
      <SectionHeader question="How certain is my revenue?" title="Revenue Confidence" />
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Confirmed</p>
            <p className="text-sm font-semibold text-green-700 mt-1">
              {fmt(confidence.confirmedRevenue, confidence.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-sm font-semibold text-amber-700 mt-1">
              {fmt(confidence.expectedRevenue, confidence.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Forecast</p>
            <p className="text-sm font-semibold text-muted-foreground mt-1">
              {fmt(confidence.forecastRevenue, confidence.currency)}
            </p>
          </div>
        </div>

        <div className="divide-y">
          {confidence.sources.map((source, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{source.source}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{fmt(source.expectedAmount, source.currency)}</span>
                  <span className={`text-xs font-semibold ${levelColors[source.confidenceLevel]}`}>
                    {source.confidenceScore}%
                  </span>
                </div>
              </div>
              {source.reasons.length > 0 && (
                <p className="text-xs text-muted-foreground">{source.reasons[0]}</p>
              )}
            </div>
          ))}
        </div>

        {confidence.sources.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No revenue sources recorded.
          </div>
        )}

        <div className="p-4 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Overall confidence
          </span>
          <span className={`text-sm font-bold ${levelColors[confidence.overallLevel]}`}>
            {confidence.overallLevel === 'HIGH'
              ? 'High confidence'
              : confidence.overallLevel === 'MEDIUM'
              ? 'Medium confidence'
              : 'Low confidence'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 5: Commercial Variance ────────────────────────────────────── */

function CommercialVarianceSection({ variance }: { variance: CommercialVarianceResult }) {
  return (
    <div>
      <SectionHeader question="Am I ahead or behind forecast?" title="Commercial Variance" />
      <div className="rounded-lg border bg-card">
        {variance.items.map((item) => (
          <div key={item.category} className="border-b last:border-0 p-4">
            <div className="flex items-start justify-between mb-1">
              <span className="text-sm font-medium">{item.label}</span>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  {item.isBehindForecast ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                  ) : item.difference > 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      item.isBehindForecast
                        ? 'text-red-700'
                        : item.difference > 0
                        ? 'text-green-700'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {item.difference >= 0 ? '+' : ''}
                    {typeof item.difference === 'number' && !isNaN(item.difference)
                      ? item.category === 'settlement' || item.category === 'payments'
                        ? item.difference.toString()
                        : fmt(item.difference, item.currency)
                      : '—'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.category === 'settlement' || item.category === 'payments' ? (
                    `${item.actual} / ${item.forecast}`
                  ) : (
                    `${fmt(item.actual, item.currency)} vs ${fmt(item.forecast, item.currency)}`
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section 6: Variance Timeline ──────────────────────────────────────── */

function VarianceTimelineSection({ entries }: { entries: VarianceTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div>
        <SectionHeader
          question="Why has commercial performance changed?"
          title="Variance Timeline"
        />
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No financial events recorded yet. The timeline will build as the agreement progresses.
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader question="Why has commercial performance changed?" title="Variance Timeline" />
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-0">
          {entries.map((entry, i) => (
            <div key={entry.eventId} className="relative flex items-start gap-4 pb-6">
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                {entry.marginDelta !== null && entry.marginDelta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : entry.marginDelta !== null && entry.marginDelta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                ) : (
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(entry.occurredAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  {entry.forecastMarginAt !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {entry.forecastMarginAt >= 0 ? '+' : ''}
                        {fmt(entry.forecastMarginAt, entry.currency)}
                      </p>
                      {entry.marginDelta !== null && entry.marginDelta !== 0 && (
                        <p
                          className={`text-xs font-medium ${
                            entry.marginDelta > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {entry.marginDelta > 0 ? '+' : ''}
                          {fmt(entry.marginDelta, entry.currency)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{entry.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Section 7: Portfolio Performance ──────────────────────────────────── */

function PortfolioProjectRow({ project }: { project: PortfolioProjectSummary }) {
  return (
    <div className="flex items-start gap-3 p-4 border-b last:border-0">
      <div className="shrink-0 mt-0.5">{statusBadge(project.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate">{project.projectName}</p>
          <p
            className={`text-sm font-bold shrink-0 ${
              project.forecastMargin >= 0 ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {project.forecastMargin >= 0 ? '+' : ''}
            {fmt(project.forecastMargin, project.currency)}
          </p>
        </div>
        {project.primaryRisk && (
          <p className="text-xs text-muted-foreground mt-0.5">{project.primaryRisk}</p>
        )}
        {project.nextAction && (
          <p className="text-xs text-foreground/70 mt-1 flex items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {project.nextAction}
          </p>
        )}
      </div>
    </div>
  );
}

function PortfolioPerformanceSection({
  portfolio,
}: {
  portfolio: PortfolioPerformanceResult;
}) {
  return (
    <div>
      <SectionHeader
        question="How are all my projects performing?"
        title="Portfolio Performance"
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border bg-red-50 border-red-100 p-3 text-center">
          <p className="text-xs text-red-600 font-medium">Attention</p>
          <p className="text-xl font-bold text-red-700 mt-1">{portfolio.attentionCount}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 border-amber-100 p-3 text-center">
          <p className="text-xs text-amber-600 font-medium">Watch</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{portfolio.watchCount}</p>
        </div>
        <div className="rounded-lg border bg-green-50 border-green-100 p-3 text-center">
          <p className="text-xs text-green-600 font-medium">Healthy</p>
          <p className="text-xl font-bold text-green-700 mt-1">{portfolio.healthyCount}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {portfolio.projects.map((project) => (
          <PortfolioProjectRow key={project.projectId} project={project} />
        ))}
        {portfolio.projects.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No projects in this portfolio.
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">Combined forecast margin</span>
        <span
          className={`text-sm font-bold ${
            portfolio.totalForecastMargin >= 0 ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {portfolio.totalForecastMargin >= 0 ? '+' : ''}
          {fmt(portfolio.totalForecastMargin, portfolio.currency)}
        </span>
      </div>
    </div>
  );
}

/* ─── Root component ─────────────────────────────────────────────────────── */

export type CommercialPerformanceOverviewProps = {
  performance: CommercialPerformanceResult;
  /** Optional: pass portfolio to render Section 7. */
  portfolio?: PortfolioPerformanceResult;
  className?: string;
};

/**
 * CommercialPerformanceOverview
 *
 * Renders all 7 commercial performance sections.
 * Receives a CommercialPerformanceResult — never calculates independently.
 *
 * Usage:
 *   const perf = deriveCommercialPerformance(input);
 *   <CommercialPerformanceOverview performance={perf} />
 */
export function CommercialPerformanceOverview({
  performance,
  portfolio,
  className,
}: CommercialPerformanceOverviewProps) {
  const {
    cashPosition,
    eventProfitability,
    commercialHealth,
    revenueConfidence,
    commercialVariance,
    varianceTimeline,
  } = performance;

  return (
    <div className={`space-y-8 ${className ?? ''}`}>
      {/* 1. Cash Position */}
      <CashPositionSection cash={cashPosition} />

      {/* 2. Event Profitability */}
      <EventProfitabilitySection prof={eventProfitability} />

      {/* 3. Commercial Health */}
      <CommercialHealthSection health={commercialHealth} />

      {/* 4. Revenue Confidence */}
      <RevenueConfidenceSection confidence={revenueConfidence} />

      {/* 5. Commercial Variance */}
      <CommercialVarianceSection variance={commercialVariance} />

      {/* 6. Variance Timeline */}
      <VarianceTimelineSection entries={varianceTimeline} />

      {/* 7. Portfolio Performance (optional) */}
      {portfolio && <PortfolioPerformanceSection portfolio={portfolio} />}
    </div>
  );
}
