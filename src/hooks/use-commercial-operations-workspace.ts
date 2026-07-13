'use client';

/**
 * Loads and assembles the Commercial Operations Workspace read model.
 * Consumes existing domain services — no duplicate calculations.
 */

import * as React from 'react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { deriveCommercialFinancialSnapshot } from '@/lib/commercial/commercial-financial-snapshot';
import { loadCommercialFinancialInputs } from '@/lib/commercial/load-commercial-financial-inputs';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting';
import { deriveCommercialTasks } from '@/lib/commercial/commercial-task-engine';
import { deriveAgreementIntelligence } from '@/lib/agreements/intelligence/agreement-intelligence-engine';
import { deriveWorkspaceStatusFromParticipants } from '@/lib/commercial/participant-workflow-adapter';
import { commercialTimingFromDeal } from '@/lib/commercial-timing/commercial-timing-payload';
import { resolveCommercialTiming } from '@/lib/commercial-timing/resolve-commercial-timing';
import {
  runCommercialAutomation,
  buildCommercialTrigger,
  CommercialTriggerKind,
  deriveScheduledAutomationJobs,
} from '@/lib/commercial-automation';
import { resolveRulesForPolicy } from '@/lib/commercial-automation/rule-engine';
import {
  deriveAiCashflowWarningsExtension,
} from '@/lib/commercial-forecasting/extensions/ai-recommendations';
import {
  deriveAiRuleRecommendationsExtension as deriveAutomationAiRecommendations,
} from '@/lib/commercial-automation/extensions/ai-recommendations';
import {
  buildInvoiceAccountingStatus,
  buildParticipantTaskContexts,
  deriveCommercialOperationsWorkspace,
  type CommercialOperationsWorkspaceView,
  type AiRecommendationItem,
  type ParticipantActivityItem,
} from '@/lib/commercial-operations';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  emptyOperationalGraphFunding,
  emptyOperationalGraphSummary,
} from '@/lib/operations/selectors/operational-coordination-snapshot';

export type UseCommercialOperationsWorkspaceOptions = {
  projectId: string;
  deal: RecentDeal | null;
  summary: ProjectWorkspaceSummary | null;
  participants: DemoParticipant[];
  kpis: OperationalKPIs | null;
  guidance: OperationalGuidanceBundle | null;
  graph: OperationalCoordinationSnapshot | null;
  workspaceContext: WorkspaceOperationalContext | null;
  auditEntries: OperationalAuditEntry[];
  enabled?: boolean;
};

export type CommercialOperationsWorkspaceState = {
  workspace: CommercialOperationsWorkspaceView | null;
  loading: boolean;
  reload: () => Promise<void>;
};

function buildAiRecommendations(
  forecastingInput: Parameters<typeof deriveCommercialForecasting>[0],
  automationInput: Parameters<typeof runCommercialAutomation>[0]
): AiRecommendationItem[] {
  const items: AiRecommendationItem[] = [];

  const cashflowExt = deriveAiCashflowWarningsExtension(forecastingInput);
  for (const rec of cashflowExt.recommendations) {
    items.push({
      id: rec.id,
      category: 'cashflow',
      title: rec.title,
      message: rec.message,
      severity: rec.severity === 'critical' ? 'critical' : rec.severity === 'warning' ? 'warning' : 'info',
    });
  }

  const automationExt = deriveAutomationAiRecommendations(automationInput);
  for (const rec of automationExt.recommendations) {
    items.push({
      id: rec.id,
      category: 'automation',
      title: rec.ruleName,
      message: rec.reason,
      severity: rec.confidence === 'high' ? 'warning' : 'info',
    });
  }

  return items;
}

function buildParticipantActivity(
  auditEntries: OperationalAuditEntry[],
  participants: DemoParticipant[]
): ParticipantActivityItem[] {
  return auditEntries
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12)
    .map((entry) => ({
      id: entry.id,
      label: entry.title,
      description: entry.description ?? entry.type,
      occurredAt: entry.timestamp,
      participantName:
        participants.find((p) => p.id === entry.participantId)?.name ?? null,
    }));
}

function inferAutomationTrigger(
  participants: DemoParticipant[],
  forecasting: ReturnType<typeof deriveCommercialForecasting>
): CommercialTriggerKind {
  if (forecasting.risks.some((r) => r.category === 'late_customer_payment')) {
    return CommercialTriggerKind.InvoiceOverdue;
  }
  const missingPayout = participants.some(
    (p) => p.approvalStatus === 'Approved' && !p.supplierOnboarding?.payment?.bankDetails
  );
  if (missingPayout) return CommercialTriggerKind.AgreementApproved;
  if (forecasting.risks.length > 0) return CommercialTriggerKind.ForecastRiskRaised;
  return CommercialTriggerKind.Manual;
}

export function useCommercialOperationsWorkspace(
  options: UseCommercialOperationsWorkspaceOptions
): CommercialOperationsWorkspaceState {
  const enabled = options.enabled ?? true;
  const [loading, setLoading] = React.useState(true);
  const [workspace, setWorkspace] = React.useState<CommercialOperationsWorkspaceView | null>(null);

  const reload = React.useCallback(async () => {
    if (!enabled || !options.deal || !options.summary) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { deal, summary, participants, projectId } = options;
      const inputs = await loadCommercialFinancialInputs(projectId, deal.id);
      const currency = inputs.treasury?.currency ?? deal.projectValueCurrency ?? 'AUD';
      const agreementTiming = commercialTimingFromDeal(deal);
      const commercialTiming = resolveCommercialTiming({
        agreementDefaults: agreementTiming,
        documentTiming: null,
      });

      const financialSnapshot = deriveCommercialFinancialSnapshot({
        projectId,
        dealId: deal.id,
        fundingSources: inputs.fundingSources,
        treasury: inputs.treasury,
        obligationRows: inputs.obligationRows,
        releaseConfidence: options.guidance?.releaseConfidence ?? null,
        currency,
        kpis: options.kpis ?? null,
      });

      const forecastingInput = {
        projectId,
        dealId: deal.id,
        agreementId: deal.id,
        currency,
        agreementTiming,
        fundingSources: inputs.fundingSources,
        treasury: inputs.treasury,
        obligationRows: inputs.obligationRows,
        releaseConfidence: options.guidance?.releaseConfidence ?? null,
        settlementForecasts: participants
          .filter((p) => p.approvalStatus === 'Approved')
          .map((p) => ({
            participantId: p.id,
            participantName: p.name,
            amount: p.commissionValue ?? 0,
            currency,
            settlementReady: p.payoutSettlementStatus === 'Approved',
            agreementApproved: p.approvalStatus === 'Approved',
          })),
      };

      const forecasting = deriveCommercialForecasting(forecastingInput);
      const workspaceWorkflow = deriveWorkspaceStatusFromParticipants(participants, projectId);
      const taskResult = deriveCommercialTasks({
        projectId,
        participants: buildParticipantTaskContexts(participants),
        paymentProviderConnected: Boolean(
          options.workspaceContext?.stripeConfigured ||
            options.workspaceContext?.anyRailConfigured
        ),
        revenueCollectionEnabled: inputs.fundingSources.length > 0,
      });

      const coordinationGraph = options.graph ?? {
        participants: [],
        obligations: [],
        summary: emptyOperationalGraphSummary(),
        funding: emptyOperationalGraphFunding(),
      };

      const intelligence = options.guidance
        ? deriveAgreementIntelligence({
            projectId,
            deal,
            summary,
            participants,
            obligationRows: inputs.obligationRows,
            treasury: inputs.treasury,
            kpis: options.kpis ?? null,
            graph: coordinationGraph,
            guidance: options.guidance,
            workspaceContext: options.workspaceContext ?? {
              hasOrganization: true,
              onboardingCompleted: true,
              defaultCurrency: currency,
              stripeConfigured: false,
              wiseConfigured: false,
              hederaConfigured: false,
              projectCount: 1,
              primaryProjectId: projectId,
              participantCount: participants.length,
              participantsConfiguredCount: 0,
              obligationCount: inputs.obligationRows.length,
              paymentLinkCount: 0,
              collectionPreferenceDecideLater: false,
              releaseEligibleCount: 0,
              releaseBatchCount: 0,
            },
          })
        : null;

      const automationTrigger = inferAutomationTrigger(participants, forecasting);
      const automationInput = {
        projectId,
        dealId: deal.id,
        currency,
        policyId: 'default' as const,
        trigger: buildCommercialTrigger(automationTrigger, {
          occurredAt: new Date().toISOString(),
          projectId,
          dealId: deal.id,
        }),
        participants: participants.map((p) => ({
          participantId: p.id,
          participantName: p.name,
          agreementApproved: p.approvalStatus === 'Approved',
          payoutDetailsSubmitted: Boolean(p.supplierOnboarding?.payment?.bankDetails),
          workspaceCreated: Boolean(p.supplierOnboarding),
        })),
        forecastingInput,
        forecast: forecasting,
      };

      const automationPreview = runCommercialAutomation(automationInput);
      const scheduledJobs = deriveScheduledAutomationJobs(
        automationInput,
        resolveRulesForPolicy('default')
      );

      const view = deriveCommercialOperationsWorkspace({
        projectId,
        dealId: deal.id,
        agreementName: summary.name,
        currency,
        financialSnapshot,
        forecasting,
        workspaceWorkflow,
        tasks: taskResult.tasks,
        operationalRisks: taskResult.risks,
        briefingSnapshot: intelligence?.snapshot ?? null,
        commercialTiming,
        invoiceAccountingStatus: buildInvoiceAccountingStatus(participants, projectId),
        automationPreview,
        scheduledAutomationCount: scheduledJobs.filter((j) => j.status === 'pending').length,
        participantActivity: buildParticipantActivity(options.auditEntries, participants),
        aiRecommendations: buildAiRecommendations(forecastingInput, automationInput),
      });

      setWorkspace(view);
    } catch {
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    options.deal,
    options.summary,
    options.participants,
    options.projectId,
    options.kpis,
    options.guidance,
    options.graph,
    options.workspaceContext,
    options.auditEntries,
  ]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { workspace, loading, reload };
}
