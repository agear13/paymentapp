/**
 * Commercial Operations Workspace — read model assembler.
 *
 * Consumes existing domain services. No new business logic.
 */

import type { DeriveCommercialOperationsWorkspaceInput, CommercialOperationsWorkspaceView } from '@/lib/commercial-operations/types';

/** Assemble the project-level commercial operations workspace view. */
export function deriveCommercialOperationsWorkspace(
  input: DeriveCommercialOperationsWorkspaceInput
): CommercialOperationsWorkspaceView {
  const { financialSnapshot, forecasting, workspaceWorkflow, tasks, briefingSnapshot } = input;

  const healthLevel = financialSnapshot.health.level;
  const healthLabels: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Good',
    attention: 'Needs attention',
    at_risk: 'At risk',
    blocked: 'Blocked',
  };

  const settlement = financialSnapshot.settlement;
  const participants = workspaceWorkflow.participants;

  const settlementProgress = {
    readyCount: participants.filter((p) => p.stage === 'ready_to_release').length,
    pendingCount: participants.filter((p) =>
      ['awaiting_funding', 'awaiting_settlement', 'awaiting_xero_export'].includes(p.stage)
    ).length,
    completeCount: participants.filter((p) => p.stage === 'complete').length,
    blockedCount: workspaceWorkflow.deadEnds.length,
    totalParticipants: participants.length,
    settlementReadiness: settlement.settlementReadiness,
    waitingToRelease: settlement.readyToRelease,
    currency: input.currency,
  };

  const upcomingEvents = forecasting.events
    .filter((e) => !e.occurred)
    .slice(0, 8);

  const nextActions = tasks
    .filter((t) => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 6);

  const commercialRisks = [
    ...forecasting.risks.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      severity: r.severity,
    })),
    ...input.operationalRisks.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.explanation,
      severity: r.severity,
    })),
  ].slice(0, 8);

  const automationActivity =
    input.automationPreview?.activityEvents.slice(0, 6) ?? [];

  return {
    projectId: input.projectId,
    dealId: input.dealId,
    agreementName: input.agreementName,
    currency: input.currency,
    health: {
      level: healthLevel,
      label: healthLabels[healthLevel] ?? healthLevel,
      summary: financialSnapshot.health.primaryAction ?? financialSnapshot.health.summary,
      settlementReadinessScore: briefingSnapshot?.settlementReadinessScore ?? 0,
    },
    nextActions,
    topPriorityAction:
      workspaceWorkflow.topPriority?.nextAction ??
      nextActions[0]?.action ??
      null,
    upcomingEvents,
    forecastSummary: {
      totalRevenue: forecasting.revenue.totalForecastRevenue,
      totalCosts: forecasting.costs.totalForecastCosts,
      netProfit: forecasting.profit.netProfit,
      expectedCashBalance: forecasting.cashflow.expectedCashBalance,
      overallConfidence: forecasting.overallConfidence,
      outstandingReceivables: forecasting.cashflow.outstandingReceivables,
      outstandingPayables: forecasting.cashflow.outstandingPayables,
    },
    forecastTimelinePreview: forecasting.timeline.slice(0, 3),
    settlementProgress,
    invoiceAccountingStatus: input.invoiceAccountingStatus,
    automationActivity,
    scheduledAutomationCount: input.scheduledAutomationCount,
    participantActivity: input.participantActivity.slice(0, 8),
    commercialRisks,
    aiRecommendations: input.aiRecommendations.slice(0, 6),
    financialSnapshot,
    forecasting,
    workspaceWorkflow,
    briefingSnapshot,
    commercialTiming: input.commercialTiming,
    automationPreview: input.automationPreview,
  };
}
