import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { WorkspaceTimelineEvent } from '@/lib/workspace-timeline/types';
import type { BusinessHealthCard } from '@/lib/mission-control/types';

function timelineFilterHref(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return `/dashboard/calendar${search ? `?${search}` : ''}`;
}

function healthLevelStatus(
  level: string
): BusinessHealthCard['status'] {
  if (level === 'excellent' || level === 'good') return 'healthy';
  if (level === 'attention') return 'attention';
  if (level === 'at_risk' || level === 'blocked') return 'blocked';
  return 'neutral';
}

export function deriveBusinessHealthCards(input: {
  business: BusinessFinancialSnapshot | null;
  timelineEvents: WorkspaceTimelineEvent[];
}): BusinessHealthCard[] {
  const { business, timelineEvents } = input;
  if (!business) return [];

  const commercial = business.commercial;
  const forecast = commercial.forecast;
  const currency = business.currency;
  const surplus = forecast.forecastPosition.forecastSurplus;
  const cashReady = forecast.cashReadiness.canEveryoneBePaid;
  const atRiskCount = business.projectHealth.atRisk + business.projectHealth.blocked;

  const settlementWaiting =
    commercial.settlement.waitingForApprovals + commercial.settlement.readyToRelease;
  const accountingSynced = timelineEvents.filter(
    (e) => e.type === 'accounting_synced' && e.status !== 'pending'
  ).length;
  const accountingPending = timelineEvents.filter(
    (e) => e.layer === 'accounting' && e.importance !== 'low'
  ).length;

  return [
    {
      id: 'commercial_position',
      label: 'Commercial Position',
      value: commercial.health.summary,
      detail: `${formatForecastAmount(forecast.totalExpectedRevenue, currency)} revenue`,
      status: healthLevelStatus(commercial.health.level),
      timelineHref: timelineFilterHref({ layer: 'commercial' }),
    },
    {
      id: 'cash_readiness',
      label: 'Cash Readiness',
      value: cashReady ? 'Everyone can be paid' : 'Action required',
      detail: forecast.cashReadiness.primaryBlocker,
      status: cashReady ? 'healthy' : 'blocked',
      timelineHref: timelineFilterHref({ type: 'cash_shortfall' }),
    },
    {
      id: 'forecast_surplus',
      label: 'Forecast Surplus',
      value: formatForecastAmount(surplus, currency),
      detail: surplus >= 0 ? 'Forecast is positive' : 'Forecast is negative',
      status: surplus >= 0 ? 'healthy' : 'attention',
      timelineHref: timelineFilterHref({ layer: 'commercial' }),
    },
    {
      id: 'projects_active',
      label: 'Projects Active',
      value: String(business.activeProjects),
      detail: `${business.projectHealth.healthy} healthy`,
      status: 'neutral',
      timelineHref: timelineFilterHref({ layer: 'operational' }),
    },
    {
      id: 'projects_at_risk',
      label: 'Projects At Risk',
      value: String(atRiskCount),
      detail:
        atRiskCount > 0
          ? `${business.projectHealth.attentionRequired} also need attention`
          : 'No projects at risk',
      status: atRiskCount > 0 ? 'attention' : 'healthy',
      timelineHref: timelineFilterHref({ type: 'commercial_risk' }),
    },
    {
      id: 'settlement_waiting',
      label: 'Settlement Waiting',
      value: settlementWaiting > 0 ? formatForecastAmount(settlementWaiting, currency) : 'None',
      detail:
        commercial.settlement.readyToRelease > 0
          ? `${formatForecastAmount(commercial.settlement.readyToRelease, currency)} ready to release`
          : null,
      status:
        commercial.settlement.readyToRelease > 0
          ? 'healthy'
          : settlementWaiting > 0
            ? 'attention'
            : 'healthy',
      timelineHref: timelineFilterHref({ layer: 'settlement' }),
    },
    {
      id: 'accounting_synced',
      label: 'Accounting Synced',
      value: accountingSynced > 0 ? `${accountingSynced} synced` : 'Up to date',
      detail: accountingPending > 0 ? `${accountingPending} items need attention` : null,
      status: accountingPending > 0 ? 'attention' : 'healthy',
      timelineHref: timelineFilterHref({ layer: 'accounting' }),
    },
  ];
}
