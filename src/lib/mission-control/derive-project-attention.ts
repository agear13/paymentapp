import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import { projectOverviewPath, projectPlanningPath, projectSettlementPath } from '@/lib/projects/project-routes';
import type { ProjectAttentionItem } from '@/lib/mission-control/types';

const CATEGORY_URGENCY: Record<AgreementHealthSnapshot['category'], number> = {
  critical: 0,
  at_risk: 1,
  attention_required: 2,
  healthy: 8,
  excellent: 9,
};

function commercialHealthLabel(
  level: string | undefined,
  categoryLabel: string
): string {
  if (!level) return categoryLabel;
  const map: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Healthy',
    attention: 'Needs attention',
    at_risk: 'At risk',
    blocked: 'Blocked',
  };
  return map[level] ?? categoryLabel;
}

export function deriveProjectsRequiringAttention(input: {
  business: BusinessFinancialSnapshot | null;
  healthSnapshots: AgreementHealthSnapshot[];
}): ProjectAttentionItem[] {
  const { business, healthSnapshots } = input;
  if (!business && healthSnapshots.length === 0) return [];

  const recordByProject = new Map(
    (business?.projectRecords ?? []).map((r) => [r.projectId, r])
  );

  const items: ProjectAttentionItem[] = [];

  for (const snap of healthSnapshots) {
    const record = recordByProject.get(snap.projectId);
    const surplus = record?.snapshot.forecast.forecastPosition.forecastSurplus;
    const cashReady = record?.snapshot.forecast.cashReadiness.canEveryoneBePaid;
    const healthLevel = record?.snapshot.health.level;

    const needsAttention =
      (snap.category !== 'excellent' && snap.category !== 'healthy') ||
      (surplus != null && surplus < 0) ||
      cashReady === false;

    if (!needsAttention) continue;

    let reason = snap.categoryReason;
    let recommendedAction = snap.improvesScore[0] ?? 'Open project';
    let href = projectOverviewPath(snap.projectId);
    let urgency = CATEGORY_URGENCY[snap.category] + snap.blockerCount;

    if (surplus != null && surplus < 0) {
      reason = 'Forecast negative';
      recommendedAction = 'Review Planning';
      href = projectPlanningPath(snap.projectId);
      urgency = Math.min(urgency, 1);
    } else if (cashReady === false && record?.snapshot.forecast.cashReadiness.primaryBlocker) {
      reason = 'Settlement blocked';
      recommendedAction = 'Review settlement';
      href = projectSettlementPath(snap.projectId);
      urgency = Math.min(urgency, 2);
    } else if (snap.blockerCount > 0) {
      reason = `${snap.blockerCount} blocker${snap.blockerCount > 1 ? 's' : ''} active`;
      recommendedAction = snap.improvesScore[0] ?? 'Resolve blockers';
    } else if (!record?.snapshot.hasRevenueSources && record?.snapshot.forecast.totalCommitments > 0) {
      reason = 'Participant earnings missing';
      recommendedAction = 'Configure earnings';
      href = projectOverviewPath(snap.projectId);
    }

    items.push({
      projectId: snap.projectId,
      projectName: snap.agreementName,
      commercialHealth: commercialHealthLabel(healthLevel, snap.categoryLabel),
      reason,
      recommendedAction,
      href,
      urgency,
    });
  }

  return items.sort((a, b) => a.urgency - b.urgency || a.projectName.localeCompare(b.projectName));
}

export function formatProjectSurplus(
  surplus: number | undefined,
  currency: string
): string | null {
  if (surplus == null) return null;
  return formatForecastAmount(surplus, currency);
}
