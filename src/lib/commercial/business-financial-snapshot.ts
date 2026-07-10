/**
 * Business Financial Snapshot
 *
 * Workspace-level aggregation layer for the Business Dashboard.
 * Consumes per-project CommercialFinancialSnapshot values — never recalculates
 * revenue, obligations, or forecast math independently.
 */

import type { AgreementHealthPortfolioSummary, AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import {
  aggregateCommercialFinancialSnapshots,
  type CommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import type { ProjectFinancialRecord } from '@/lib/commercial/load-project-commercial-financial-snapshot';
import type { QueueTask } from '@/components/operations/operational-queue';

export type BusinessProjectHealthBreakdown = {
  healthy: number;
  attentionRequired: number;
  atRisk: number;
  blocked: number;
  total: number;
};

export type BusinessCashReadinessBreakdown = {
  readyCount: number;
  notReadyCount: number;
  totalCount: number;
  requiresFundingCount: number;
};

export type BusinessFinancialSnapshot = {
  /** Aggregated commercial position across all active projects. */
  commercial: CommercialFinancialSnapshot;
  currency: string;
  activeProjects: number;
  completedProjects: number;
  projectHealth: BusinessProjectHealthBreakdown;
  cashReadiness: BusinessCashReadinessBreakdown;
  /** Per-project snapshots used for aggregation (drill-down). */
  projectRecords: ProjectFinancialRecord[];
  /** Sorted business-wide priority queue derived from attention items. */
  priorities: QueueTask[];
};

function isHealthyCategory(category: AgreementHealthSnapshot['category']): boolean {
  return category === 'excellent' || category === 'healthy';
}

function isBlockedCategory(category: AgreementHealthSnapshot['category']): boolean {
  return category === 'critical' || category === 'at_risk';
}

export function deriveBusinessFinancialSnapshot(input: {
  projectRecords: ProjectFinancialRecord[];
  healthSnapshots: AgreementHealthSnapshot[];
  portfolio: AgreementHealthPortfolioSummary | null;
  priorities?: QueueTask[];
  currency?: string;
}): BusinessFinancialSnapshot | null {
  const { projectRecords, healthSnapshots, portfolio, priorities = [] } = input;

  if (projectRecords.length === 0 && (portfolio?.totalAgreements ?? 0) === 0) {
    return null;
  }

  const currency =
    input.currency ??
    projectRecords[0]?.snapshot.currency ??
    'AUD';

  const snapshots = projectRecords.map((r) => r.snapshot);
  const commercial =
    snapshots.length > 0
      ? aggregateCommercialFinancialSnapshots(snapshots, currency)
      : null;

  if (!commercial) {
    return null;
  }

  const healthByProject = new Map(healthSnapshots.map((s) => [s.projectId, s]));

  let healthy = 0;
  let attentionRequired = 0;
  let atRisk = 0;
  let blocked = 0;

  for (const snap of healthSnapshots) {
    if (isHealthyCategory(snap.category)) healthy += 1;
    else if (snap.category === 'attention_required') attentionRequired += 1;
    else if (isBlockedCategory(snap.category)) {
      if (snap.category === 'critical') blocked += 1;
      else atRisk += 1;
    }
  }

  let readyCount = 0;
  let requiresFundingCount = 0;

  for (const record of projectRecords) {
    const health = healthByProject.get(record.projectId);
    const cashReady = record.snapshot.forecast.cashReadiness.canEveryoneBePaid;
    const hasRevenue = record.snapshot.hasRevenueSources;
    const hasObligations = record.snapshot.forecast.totalCommitments > 0;

    if (cashReady) {
      readyCount += 1;
    } else if (hasObligations && !hasRevenue) {
      requiresFundingCount += 1;
    }
  }

  const totalCount = projectRecords.length;
  const notReadyCount = Math.max(0, totalCount - readyCount);

  return {
    commercial,
    currency,
    activeProjects: portfolio?.totalAgreements ?? healthSnapshots.length,
    completedProjects: 0,
    projectHealth: {
      healthy,
      attentionRequired,
      atRisk,
      blocked,
      total: healthSnapshots.length,
    },
    cashReadiness: {
      readyCount,
      notReadyCount,
      totalCount,
      requiresFundingCount,
    },
    projectRecords,
    priorities,
  };
}
