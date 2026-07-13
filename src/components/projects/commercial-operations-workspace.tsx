'use client';

/**
 * Commercial Operations Workspace — project-level operating system view.
 *
 * Surfaces all commercial domain services as read models.
 * No local business logic — consumes useCommercialOperationsWorkspace().
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useOperationalAuditStore } from '@/hooks/use-operational-audit-store';
import { useCommercialOperationsWorkspace } from '@/hooks/use-commercial-operations-workspace';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useCommercialBrain } from '@/components/workflow/commercial-brain-context';
import { ProjectOperationalLoadingState } from '@/components/projects/project-operational-loading-state';
import { CommercialPositionCards } from '@/components/operations/commercial-position-cards';
import { MoneyWaitingPanel } from '@/components/operations/money-waiting-panel';
import { OperatorInbox } from '@/components/commercial/operator-inbox/operator-inbox';
import { CommercialTimeline as CanonicalCommercialTimeline } from '@/components/commercial/commercial-timeline';
import { buildCommercialTimeline } from '@/lib/commercial/commercial-timeline-events';
import { deriveConversationImportAuditTimeline } from '@/lib/operations/audit/conversation-import-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import { COMMERCIAL_FORECAST_CONFIDENCE_LABELS } from '@/lib/commercial-forecasting/types';
import { FORECAST_EVENT_CATEGORY_LABELS } from '@/lib/commercial-forecasting/types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import {
  projectFundingPath,
  projectParticipantsPath,
  projectPlanningPath,
} from '@/lib/projects/project-routes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CommercialOperationsWorkspaceView } from '@/lib/commercial-operations';

type CommercialOperationsWorkspaceProps = {
  projectId: string;
};

function HealthBadge({ level, label }: { level: string; label: string }) {
  const variant =
    level === 'excellent' || level === 'good'
      ? 'default'
      : level === 'blocked' || level === 'at_risk'
        ? 'destructive'
        : 'secondary';
  return <Badge variant={variant}>{label}</Badge>;
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="mt-0.5 rounded-md bg-muted p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function UpcomingEventsSection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  if (workspace.upcomingEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No upcoming commercial events forecast.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {workspace.upcomingEvents.map((event) => (
        <li
          key={event.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {FORECAST_EVENT_CATEGORY_LABELS[event.category] ?? event.label}
            </p>
            <p className="text-xs text-muted-foreground truncate">{event.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium tabular-nums">{event.date}</p>
            {event.amount != null ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatForecastAmount(event.amount, event.currency)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ForecastSummarySection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  const { forecastSummary, currency } = workspace;
  const confidenceLabel =
    COMMERCIAL_FORECAST_CONFIDENCE_LABELS[
      forecastSummary.overallConfidence as keyof typeof COMMERCIAL_FORECAST_CONFIDENCE_LABELS
    ] ?? forecastSummary.overallConfidence;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Forecast revenue', value: forecastSummary.totalRevenue },
          { label: 'Forecast costs', value: forecastSummary.totalCosts },
          { label: 'Net forecast', value: forecastSummary.netProfit },
          { label: 'Expected cash', value: forecastSummary.expectedCashBalance },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {formatForecastAmount(item.value, currency)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">Confidence: {confidenceLabel}</Badge>
        <Badge variant="outline">
          Receivables: {formatForecastAmount(forecastSummary.outstandingReceivables, currency)}
        </Badge>
        <Badge variant="outline">
          Payables: {formatForecastAmount(forecastSummary.outstandingPayables, currency)}
        </Badge>
      </div>
      {workspace.forecastTimelinePreview.length > 0 ? (
        <div className="space-y-2 pt-1">
          {workspace.forecastTimelinePreview.map((month) => (
            <div key={`${month.period.year}-${month.period.month}`} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{month.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatForecastAmount(month.revenue, currency)} revenue
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full"
                  style={{ width: `${Math.round(month.revenueBar * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SettlementProgressSection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  const sp = workspace.settlementProgress;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Ready to release', value: sp.readyCount, icon: CheckCircle2 },
        { label: 'Pending', value: sp.pendingCount, icon: Clock },
        { label: 'Complete', value: sp.completeCount, icon: CheckCircle2 },
        { label: 'Blocked', value: sp.blockedCount, icon: AlertTriangle },
      ].map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-border/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InvoiceAccountingSection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  if (workspace.invoiceAccountingStatus.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No participant invoice or accounting status yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b">
            <th className="pb-2 pr-4 font-medium">Participant</th>
            <th className="pb-2 pr-4 font-medium">Commercial</th>
            <th className="pb-2 pr-4 font-medium">Accounting</th>
            <th className="pb-2 font-medium">Settlement</th>
          </tr>
        </thead>
        <tbody>
          {workspace.invoiceAccountingStatus.map((row) => (
            <tr key={row.participantId} className="border-b border-border/30 last:border-0">
              <td className="py-2.5 pr-4 font-medium">{row.participantName}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{row.invoiceState}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{row.accountingState}</td>
              <td className="py-2.5 text-muted-foreground">{row.settlementState}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutomationActivitySection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  if (workspace.automationActivity.length === 0 && workspace.scheduledAutomationCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">No automation activity yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {workspace.scheduledAutomationCount > 0 ? (
        <Badge variant="secondary">
          {workspace.scheduledAutomationCount} scheduled automation
          {workspace.scheduledAutomationCount === 1 ? '' : 's'} pending
        </Badge>
      ) : null}
      <ul className="space-y-2">
        {workspace.automationActivity.map((event) => (
          <li key={event.id} className="flex items-center gap-2 text-sm">
            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="font-medium">{event.label}</span>
            <span className="text-muted-foreground truncate">— {event.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiRecommendationsSection({ workspace }: { workspace: CommercialOperationsWorkspaceView }) {
  if (workspace.aiRecommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        AI recommendations will appear here when extension points detect opportunities.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {workspace.aiRecommendations.map((rec) => (
        <li
          key={rec.id}
          className="flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2.5"
        >
          <Sparkles className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{rec.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{rec.message}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommercialOperationsWorkspace({ projectId }: CommercialOperationsWorkspaceProps) {
  const { deal, summary, projectParticipants, loading, notFound, refresh, invalidate } =
    useProjectWorkspace();

  const storeEntries = useOperationalAuditStore({ projectId });
  const auditEntries = React.useMemo(() => {
    if (!deal) return storeEntries;
    const fromDeal = deriveConversationImportAuditTimeline([deal], projectId);
    return mergeAuditTimeline(storeEntries, fromDeal);
  }, [deal, projectId, storeEntries]);

  const {
    kpis,
    guidance,
    graph,
    workspaceContext,
    loading: coordinationLoading,
  } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    enabled: Boolean(deal),
    traceSurface: 'commercial-operations-workspace',
  });

  useCommercialBrain();

  const { workspace, loading: workspaceLoading, reload } = useCommercialOperationsWorkspace({
    projectId,
    deal,
    summary,
    participants: projectParticipants,
    kpis,
    guidance,
    graph,
    workspaceContext,
    auditEntries,
    enabled: Boolean(deal && summary),
  });

  const commercialTimeline = React.useMemo(
    () => buildCommercialTimeline({ auditEntries, projectId }),
    [auditEntries, projectId]
  );

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if ((loading || coordinationLoading) && !workspace) {
    return <ProjectOperationalLoadingState variant="loading" />;
  }

  if (notFound || !deal || !summary) {
    return (
      <ProjectOperationalLoadingState
        variant="error"
        message={`${PRODUCT_TERMINOLOGY.projectNotFound} It may still be syncing.`}
      />
    );
  }

  if (!workspace) {
    return (
      <ProjectOperationalLoadingState
        variant="configuring"
        message="Loading commercial operations…"
        onRetry={() => {
          invalidate('all');
          void refresh({ scope: 'all', force: true });
          void reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{workspace.agreementName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Commercial Operations Workspace</p>
          </div>
          <HealthBadge level={workspace.health.level} label={workspace.health.label} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
          {workspace.health.summary || guidance?.explanation?.explainability?.headline}
        </p>
        {workspace.topPriorityAction ? (
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium">Next:</span>
            <span>{workspace.topPriorityAction}</span>
          </div>
        ) : null}
      </div>

      {/* Financial position */}
      <section className="space-y-3">
        <SectionHeader
          icon={DollarSign}
          title="Commercial position"
          description="Live financial state from the commercial engine"
        />
        <CommercialPositionCards
          snapshot={workspace.financialSnapshot}
          projectId={projectId}
        />
        <MoneyWaitingPanel snapshot={workspace.financialSnapshot} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next actions */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={CheckCircle2}
              title="Next required actions"
              description="From the commercial task engine"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={projectParticipantsPath(projectId)}>
                    View all
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {workspace.nextActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending actions.</p>
            ) : (
              <ul className="space-y-2">
                {workspace.nextActions.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-lg border border-border/50 px-3 py-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{task.title}</p>
                      <Badge variant={task.priority === 'critical' ? 'destructive' : 'secondary'}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{task.commercialImpact}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Operator inbox */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={Users}
              title="Participant actions"
              description="Workflow integration status"
            />
          </CardHeader>
          <CardContent>
            <OperatorInbox
              workspaceStatus={workspace.workspaceWorkflow}
              projectId={projectId}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={Calendar}
              title="Upcoming commercial events"
              description="What happens next — from commercial forecasting"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={projectPlanningPath(projectId)}>Planning</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <UpcomingEventsSection workspace={workspace} />
          </CardContent>
        </Card>

        {/* Forecast summary */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={TrendingUp}
              title="Forecast summary"
              description="Committed revenue, costs, and cashflow"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href={projectFundingPath(projectId)}>Funding</Link>
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            <ForecastSummarySection workspace={workspace} />
          </CardContent>
        </Card>
      </div>

      {/* Settlement progress */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={DollarSign}
            title="Settlement progress"
            description={`${workspace.health.settlementReadinessScore}% settlement readiness`}
          />
        </CardHeader>
        <CardContent>
          <SettlementProgressSection workspace={workspace} />
        </CardContent>
      </Card>

      {/* Invoice & accounting */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={FileText}
            title="Invoice & accounting status"
            description="Per-participant workflow projections"
          />
        </CardHeader>
        <CardContent>
          <InvoiceAccountingSection workspace={workspace} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Automation */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={Zap}
              title="Automation activity"
              description="Deterministic rule executions"
            />
          </CardHeader>
          <CardContent>
            <AutomationActivitySection workspace={workspace} />
          </CardContent>
        </Card>

        {/* Risks */}
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader
              icon={AlertTriangle}
              title="Commercial risks"
              description="From forecasting and task engine"
            />
          </CardHeader>
          <CardContent>
            {workspace.commercialRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active commercial risks.</p>
            ) : (
              <ul className="space-y-2">
                {workspace.commercialRisks.map((risk) => (
                  <li
                    key={risk.id}
                    className="rounded-lg border border-border/50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{risk.title}</p>
                      <Badge variant={risk.severity === 'high' ? 'destructive' : 'secondary'}>
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{risk.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Bot}
            title="AI recommendations"
            description="Extension points — recommendations only, automation executes"
          />
        </CardHeader>
        <CardContent>
          <AiRecommendationsSection workspace={workspace} />
        </CardContent>
      </Card>

      {/* Participant activity */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Activity}
            title="Recent participant activity"
            description="Project history from operational audit"
          />
        </CardHeader>
        <CardContent>
          {workspace.participantActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {workspace.participantActivity.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {new Date(item.occurredAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Commercial timeline (advanced) */}
      <details
        className="rounded-xl border border-border/60 bg-card"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Commercial timeline & history</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')}
          />
        </summary>
        <div className="px-5 pb-5 border-t border-border/30 pt-4">
          <CanonicalCommercialTimeline events={commercialTimeline} />
        </div>
      </details>
    </div>
  );
}
