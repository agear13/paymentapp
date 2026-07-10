'use client';

/**
 * Project Commercial Forecast
 *
 * Answers the single operator question: "Can we afford to meet every commercial commitment?"
 *
 * Layout (top → bottom):
 *   1. Forecast Position   — one-glance surplus/deficit card
 *   2. Cash Readiness      — "Can everyone be paid?" yes/no with reason
 *   3. Money Coming In     — individual revenue sources with confidence
 *   4. Money Going Out     — fixed / revenue-share / conditional (never merged)
 *   5. Commercial Risks    — only shown when risks exist
 *   6. Payment Evidence    — evidence management (add/view sources)
 *   7. Advanced Details    — raw numbers, treasury health, full obligation list
 *
 * No component may perform financial calculations independently.
 * All figures come from deriveCommercialForecast().
 */

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  DollarSign,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { toOperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import { ProjectPageCopilot } from '@/components/operations/project-page-copilot';
import {
  deriveCommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import { loadCommercialFinancialInputs } from '@/lib/commercial/load-commercial-financial-inputs';
import {
  formatForecastAmount,
  formatForecastBalance,
  type CommercialForecastResult,
  type CommercialRisk,
  type CommitmentItem,
  type IncomingRevenueItem,
} from '@/lib/commercial/commercial-forecast';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ─── Main component ────────────────────────────────────────────────────────── */

export function ProjectCommercialForecast() {
  const { summary, projectId, deal, projectParticipants, refresh, invalidate } =
    useProjectWorkspace();

  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [fundingSources, setFundingSources] = React.useState<ProjectFundingSourceDto[]>([]);
  const [obligationRows, setObligationRows] = React.useState<BriefingObligationRowInput[]>([]);
  const [loading, setLoading] = React.useState(true);

  const { guidance, workspaceContext, activation, reloadCoordinationSnapshot } =
    useOperationalCoordinationState({
      scope: 'project',
      project: deal ?? undefined,
      participants: projectParticipants,
      treasury: treasury ?? summary?.treasury ?? undefined,
      enabled: Boolean(deal),
      traceSurface: 'project-commercial-forecast',
    });

  const operationalSyncHandlers = React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate,
        refreshSilent: (scope) =>
          refresh({ scope: scope ?? 'all', silent: true, force: true }),
        reloadCoordinationSnapshot,
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    [invalidate, refresh, reloadCoordinationSnapshot]
  );

  const loadForecastData = React.useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const inputs = await loadCommercialFinancialInputs(projectId, deal.id);
      setTreasury(inputs.treasury);
      setObligationRows(inputs.obligationRows);
      setFundingSources(inputs.fundingSources);
    } catch {
      // Non-fatal — fallback to empty inputs
    } finally {
      setLoading(false);
    }
  }, [deal, projectId]);

  React.useEffect(() => {
    void loadForecastData();
  }, [loadForecastData]);

  if (!summary) return null;

  const defaultCurrency = summary.currencyLabel?.includes('AUD') ? 'AUD' : 'USD';

  const financialSnapshot = deriveCommercialFinancialSnapshot({
    projectId,
    dealId: deal?.id ?? null,
    fundingSources,
    treasury: treasury ?? null,
    obligationRows,
    releaseConfidence: guidance?.releaseConfidence ?? null,
    currency: defaultCurrency,
  });

  const forecast = financialSnapshot.forecast;

  const onTreasuryChange = () => {
    void refresh({ scope: 'all', silent: true, force: true });
    void loadForecastData();
  };

  return (
    <div className="space-y-6">
      <ProjectPageCopilot page="money" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Commercial Forecast</p>
      </div>

      {/* 1. Forecast Position */}
      <ForecastPositionCard forecast={forecast} loading={loading} />

      {/* 2. Cash Readiness */}
      <CashReadinessCard forecast={forecast} loading={loading} />

      {/* 3. Money Coming In */}
      <MoneyComingInSection forecast={forecast} loading={loading} />

      {/* 4. Money Going Out */}
      <MoneyGoingOutSection forecast={forecast} loading={loading} />

      {/* 5. Commercial Risks — hidden when none */}
      {forecast.commercialRisks.length > 0 && (
        <CommercialRisksSection risks={forecast.commercialRisks} />
      )}

      {/* 6. Payment Evidence — funding source management */}
      <PaymentEvidenceSection
        projectId={projectId}
        defaultCurrency={defaultCurrency}
        operationalSyncHandlers={operationalSyncHandlers}
        onTreasuryChange={onTreasuryChange}
      />

      {/* 7. Advanced Details */}
      <AdvancedForecastDetails forecast={forecast} treasury={treasury} />
    </div>
  );
}

/* ─── 1. Forecast Position ──────────────────────────────────────────────────── */

function ForecastPositionCard({
  forecast,
  loading,
}: {
  forecast: CommercialForecastResult;
  loading: boolean;
}) {
  const { forecastPosition, currency } = forecast;
  const isSurplus = forecastPosition.status === 'surplus';
  const isDeficit = forecastPosition.status === 'deficit';
  const noData = forecastPosition.status === 'insufficient_data';

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Forecast Position
      </p>

      {noData ? (
        <p className="text-sm text-muted-foreground">
          Add revenue sources to see the forecast position.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {/* Money Coming In */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Money Coming In
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '—' : formatForecastAmount(forecastPosition.totalExpectedRevenue, currency)}
            </p>
          </div>

          {/* Money Going Out */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
              Money Going Out
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {loading ? '—' : formatForecastAmount(forecastPosition.totalCommitments, currency)}
            </p>
          </div>

          {/* Position */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CircleDot className="h-3 w-3" />
              Forecast Position
            </p>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                isSurplus && 'text-green-700',
                isDeficit && 'text-red-600',
                !isSurplus && !isDeficit && 'text-foreground'
              )}
            >
              {loading ? '—' : formatForecastBalance(forecastPosition.forecastBalance, currency)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 2. Cash Readiness ─────────────────────────────────────────────────────── */

function CashReadinessCard({
  forecast,
  loading,
}: {
  forecast: CommercialForecastResult;
  loading: boolean;
}) {
  const { cashReadiness, currency } = forecast;
  const { canEveryoneBePaid, primaryBlocker } = cashReadiness;

  return (
    <div
      className={cn(
        'rounded-xl border p-6 space-y-3',
        canEveryoneBePaid
          ? 'border-green-200 bg-green-50/40'
          : 'border-red-200 bg-red-50/40'
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Can everyone be paid?
      </p>

      {loading ? (
        <p className="text-muted-foreground text-sm">Calculating…</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-full p-1.5',
                canEveryoneBePaid
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {canEveryoneBePaid ? (
                <Check className="h-5 w-5" />
              ) : (
                <X className="h-5 w-5" />
              )}
            </div>
            <p className="text-2xl font-bold">
              {canEveryoneBePaid ? 'YES' : 'NO'}
            </p>
          </div>

          {canEveryoneBePaid && cashReadiness.expectedBalanceAfterSettlement != null && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Expected balance after settlement</p>
              <p className="text-lg font-semibold text-green-700">
                {formatForecastBalance(cashReadiness.expectedBalanceAfterSettlement, currency)}
              </p>
            </div>
          )}

          {!canEveryoneBePaid && cashReadiness.forecastShortfall != null && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Forecast shortfall</p>
              <p className="text-lg font-semibold text-red-600">
                -{formatForecastAmount(cashReadiness.forecastShortfall, currency)}
              </p>
            </div>
          )}

          {primaryBlocker && (
            <div className="pt-1 space-y-0.5">
              <p className="text-xs text-muted-foreground">Primary reason</p>
              <p className="text-sm text-foreground">{primaryBlocker}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── 3. Money Coming In ────────────────────────────────────────────────────── */

function MoneyComingInSection({
  forecast,
  loading,
}: {
  forecast: CommercialForecastResult;
  loading: boolean;
}) {
  const { incomingRevenue, currency } = forecast;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Money Coming In
        </p>
        {incomingRevenue.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {incomingRevenue.length} source{incomingRevenue.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading revenue sources…</p>
      ) : incomingRevenue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-6 px-4 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No revenue sources added yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add expected payments below to generate a commercial forecast.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incomingRevenue.map((item) => (
            <RevenueSourceCard key={item.id} item={item} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}

function RevenueSourceCard({
  item,
  currency,
}: {
  item: IncomingRevenueItem;
  currency: string;
}) {
  const [showConfidence, setShowConfidence] = React.useState(false);

  const statusColour =
    item.status === 'confirmed'
      ? 'bg-green-50 text-green-700 border-green-200'
      : item.status === 'overdue'
        ? 'bg-red-50 text-red-700 border-red-200'
        : item.status === 'forecast'
          ? 'bg-slate-50 text-slate-600 border-slate-200'
          : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.sourceName}</p>
          {item.sourceType && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{item.sourceType}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {formatForecastAmount(item.amount, item.currency || currency)}
          </p>
          <Badge variant="outline" className={cn('text-xs mt-0.5', statusColour)}>
            {item.statusLabel}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {item.expectedDate ? (
          <span>
            Expected{' '}
            {new Date(item.expectedDate).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
            })}
          </span>
        ) : (
          <span className="text-muted-foreground/50">No date set</span>
        )}

        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setShowConfidence((v) => !v)}
        >
          <span
            className={cn(
              'font-medium',
              item.confidence.score >= 80
                ? 'text-green-700'
                : item.confidence.score >= 50
                  ? 'text-amber-700'
                  : 'text-red-600'
            )}
          >
            Confidence {item.confidence.label}
          </span>
          {showConfidence ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>

      {showConfidence && (
        <div className="pt-1 space-y-1 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground">Why?</p>
          {item.confidence.reasons.map((reason, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {reason.positive ? (
                <Check className="h-3 w-3 text-green-600 shrink-0" />
              ) : (
                <CircleDot className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              <span className={reason.positive ? 'text-foreground' : 'text-muted-foreground'}>
                {reason.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 4. Money Going Out ────────────────────────────────────────────────────── */

function MoneyGoingOutSection({
  forecast,
  loading,
}: {
  forecast: CommercialForecastResult;
  loading: boolean;
}) {
  const { fixedCommitments, revenueShareCommitments, conditionalCommitments, currency } = forecast;
  const totalCommitments =
    fixedCommitments.length + revenueShareCommitments.length + conditionalCommitments.length;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <TrendingDown className="h-4 w-4 text-muted-foreground" />
        Money Going Out
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading commitments…</p>
      ) : totalCommitments === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-4 px-4">
          <p className="text-sm text-muted-foreground">
            No commercial commitments yet. Participant earnings will appear here once configured.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fixed commitments — shown first, easiest to understand */}
          {fixedCommitments.length > 0 && (
            <CommitmentGroup
              title="Fixed Commitments"
              subtitle="Amounts that must be paid regardless of revenue"
              commitments={fixedCommitments}
              currency={currency}
              accentClass="bg-slate-50 border-slate-200"
            />
          )}

          {/* Revenue share — variable, shown separately */}
          {revenueShareCommitments.length > 0 && (
            <CommitmentGroup
              title="Revenue Share"
              subtitle="Payments calculated as a percentage of revenue"
              commitments={revenueShareCommitments}
              currency={currency}
              accentClass="bg-blue-50/40 border-blue-200/60"
            />
          )}

          {/* Conditional — only show if triggered */}
          {conditionalCommitments.length > 0 && (
            <CommitmentGroup
              title="Conditional Payments"
              subtitle="Only triggered if specific conditions are met"
              commitments={conditionalCommitments}
              currency={currency}
              accentClass="bg-amber-50/40 border-amber-200/60"
            />
          )}
        </div>
      )}
    </div>
  );
}

function CommitmentGroup({
  title,
  subtitle,
  commitments,
  currency,
  accentClass,
}: {
  title: string;
  subtitle: string;
  commitments: CommitmentItem[];
  currency: string;
  accentClass: string;
}) {
  return (
    <div className={cn('rounded-lg border p-4 space-y-3', accentClass)}>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-2">
        {commitments.map((commitment) => (
          <div
            key={commitment.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground">{commitment.participantName}</span>
              {commitment.participantRole && (
                <span className="text-muted-foreground/70 ml-1.5 text-xs">
                  · {commitment.participantRole}
                </span>
              )}
              {commitment.condition && (
                <span className="text-muted-foreground text-xs ml-2 italic">
                  {commitment.condition}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-medium tabular-nums">{commitment.amountLabel}</span>
              {commitment.funded ? (
                <span className="text-green-600 text-xs">funded</span>
              ) : (
                <span className="text-muted-foreground/50 text-xs">unfunded</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 5. Commercial Risks ───────────────────────────────────────────────────── */

function CommercialRisksSection({ risks }: { risks: CommercialRisk[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        Commercial Risks
      </p>

      <div className="space-y-2">
        {risks.map((risk) => (
          <CommercialRiskCard key={risk.id} risk={risk} />
        ))}
      </div>
    </div>
  );
}

function CommercialRiskCard({ risk }: { risk: CommercialRisk }) {
  const [expanded, setExpanded] = React.useState(risk.severity === 'high');

  const severityClass =
    risk.severity === 'high'
      ? 'border-red-200 bg-red-50/30'
      : risk.severity === 'medium'
        ? 'border-amber-200 bg-amber-50/20'
        : 'border-border/60 bg-card';

  const iconClass =
    risk.severity === 'high' ? 'text-red-600' : risk.severity === 'medium' ? 'text-amber-600' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border px-4 py-3 space-y-2', severityClass)}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', iconClass)} />
          <p className="text-sm font-medium text-foreground leading-snug">{risk.title}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 pl-5">
          <p className="text-xs text-muted-foreground leading-relaxed">{risk.explanation}</p>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">Commercial consequence</p>
            <p className="text-xs text-muted-foreground">{risk.consequence}</p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">Recommended action</p>
            <p className="text-xs text-muted-foreground">{risk.recommendedAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 6. Payment Evidence ───────────────────────────────────────────────────── */

function PaymentEvidenceSection({
  projectId,
  defaultCurrency,
  operationalSyncHandlers,
  onTreasuryChange,
}: {
  projectId: string;
  defaultCurrency: string;
  operationalSyncHandlers: ReturnType<typeof toOperationalSyncHandlers>;
  onTreasuryChange: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border border-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">Payment Evidence</span>
        <span className="text-xs text-muted-foreground mr-auto ml-3">
          Remittance advice, deposit confirmations, receipts
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/40 p-5">
          <ProjectFundingSourcesPanel
            projectId={projectId}
            defaultCurrency={defaultCurrency}
            operationalSyncHandlers={operationalSyncHandlers}
            onTreasuryChange={onTreasuryChange}
          />
        </div>
      )}
    </div>
  );
}

/* ─── 7. Advanced Details ───────────────────────────────────────────────────── */

function AdvancedForecastDetails({
  forecast,
  treasury,
}: {
  forecast: CommercialForecastResult;
  treasury: ProjectTreasurySummary | null;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border border-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-muted-foreground">Advanced details</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/40 px-5 py-4 space-y-4 text-sm">
          {/* Treasury health */}
          {treasury && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Treasury
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Confirmed funding</dt>
                <dd className="font-medium tabular-nums">
                  {formatForecastAmount(treasury.confirmedFunding, forecast.currency)}
                </dd>
                <dt className="text-muted-foreground">Pending funding</dt>
                <dd className="font-medium tabular-nums">
                  {formatForecastAmount(treasury.pendingFunding, forecast.currency)}
                </dd>
                <dt className="text-muted-foreground">Forecast funding</dt>
                <dd className="font-medium tabular-nums">
                  {formatForecastAmount(treasury.forecastFunding, forecast.currency)}
                </dd>
                <dt className="text-muted-foreground">Obligations total</dt>
                <dd className="font-medium tabular-nums">
                  {formatForecastAmount(treasury.obligationsTotal, forecast.currency)}
                </dd>
                <dt className="text-muted-foreground">Obligations ready</dt>
                <dd className="font-medium tabular-nums">
                  {formatForecastAmount(treasury.obligationsReady, forecast.currency)}
                </dd>
                <dt className="text-muted-foreground">Health</dt>
                <dd className="font-medium capitalize">{treasury.projectHealth.replace(/_/g, ' ')}</dd>
              </dl>
            </div>
          )}

          {/* Forecast confidence */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Forecast Confidence
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  forecast.overallConfidence.level === 'HIGH' && 'bg-green-50 text-green-700 border-green-200',
                  forecast.overallConfidence.level === 'MEDIUM' && 'bg-amber-50 text-amber-700 border-amber-200',
                  forecast.overallConfidence.level === 'LOW' && 'bg-red-50 text-red-700 border-red-200'
                )}
              >
                {forecast.overallConfidence.level} — {forecast.overallConfidence.score}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{forecast.overallConfidence.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
