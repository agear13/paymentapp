/**
 * Commercial Operations Workspace — read model types.
 *
 * View aggregation only. No new domain models.
 */

import type { CommercialFinancialSnapshot } from '@/lib/commercial/commercial-financial-snapshot';
import type { CommercialTask, CommercialOperationalRisk } from '@/lib/commercial/commercial-task-engine';
import type { CommercialForecastingResult } from '@/lib/commercial-forecasting/types';
import type { CommercialAutomationResult } from '@/lib/commercial-automation/types';
import type { WorkspaceWorkflowIntegrationStatus } from '@/lib/commercial/workflow-integration';
import type { AgreementBriefingSnapshot } from '@/lib/agreements/agreement-briefing.model';
import type { ResolvedCommercialTiming } from '@/lib/commercial-timing/types';
import type { AutomationActivityEvent } from '@/lib/commercial-automation/types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';

export type AiRecommendationItem = {
  id: string;
  category: 'forecast' | 'automation' | 'settlement' | 'cashflow';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
};

export type ParticipantActivityItem = {
  id: string;
  label: string;
  description: string;
  occurredAt: string;
  participantName?: string | null;
};

export type InvoiceAccountingStatusItem = {
  participantId: string;
  participantName: string;
  invoiceState: string;
  accountingState: string;
  settlementState: string;
};

export type SettlementProgressSummary = {
  readyCount: number;
  pendingCount: number;
  completeCount: number;
  blockedCount: number;
  totalParticipants: number;
  settlementReadiness: boolean;
  waitingToRelease: number;
  currency: string;
};

export type CommercialOperationsWorkspaceView = {
  projectId: string;
  dealId: string;
  agreementName: string;
  currency: string;
  /** Commercial health from financial snapshot + briefing. */
  health: {
    level: string;
    label: string;
    summary: string;
    settlementReadinessScore: number;
  };
  /** Next actions from task engine + workflow inbox. */
  nextActions: CommercialTask[];
  topPriorityAction: string | null;
  /** Upcoming forecast events (not occurred). */
  upcomingEvents: CommercialForecastingResult['events'];
  /** Forecast summary slice. */
  forecastSummary: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
    expectedCashBalance: number;
    overallConfidence: string;
    outstandingReceivables: number;
    outstandingPayables: number;
  };
  /** First 3 timeline months for bar preview. */
  forecastTimelinePreview: CommercialForecastingResult['timeline'];
  settlementProgress: SettlementProgressSummary;
  invoiceAccountingStatus: InvoiceAccountingStatusItem[];
  automationActivity: AutomationActivityEvent[];
  scheduledAutomationCount: number;
  participantActivity: ParticipantActivityItem[];
  commercialRisks: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
  }>;
  aiRecommendations: AiRecommendationItem[];
  /** Underlying read models for child components. */
  financialSnapshot: CommercialFinancialSnapshot;
  forecasting: CommercialForecastingResult;
  workspaceWorkflow: WorkspaceWorkflowIntegrationStatus;
  briefingSnapshot: AgreementBriefingSnapshot | null;
  commercialTiming: ResolvedCommercialTiming | null;
  automationPreview: CommercialAutomationResult | null;
};

export type DeriveCommercialOperationsWorkspaceInput = {
  projectId: string;
  dealId: string;
  agreementName: string;
  currency: string;
  financialSnapshot: CommercialFinancialSnapshot;
  forecasting: CommercialForecastingResult;
  workspaceWorkflow: WorkspaceWorkflowIntegrationStatus;
  tasks: CommercialTask[];
  operationalRisks: CommercialOperationalRisk[];
  briefingSnapshot: AgreementBriefingSnapshot | null;
  commercialTiming: ResolvedCommercialTiming | null;
  invoiceAccountingStatus: InvoiceAccountingStatusItem[];
  automationPreview: CommercialAutomationResult | null;
  scheduledAutomationCount: number;
  participantActivity: ParticipantActivityItem[];
  aiRecommendations: AiRecommendationItem[];
};
