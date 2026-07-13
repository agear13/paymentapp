/**
 * Commercial Operations Workspace read model tests.
 */

import { deriveCommercialOperationsWorkspace } from '@/lib/commercial-operations';
import { deriveCommercialForecast } from '@/lib/commercial/commercial-forecast';
import { deriveCommercialFinancialSnapshot } from '@/lib/commercial/commercial-financial-snapshot';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting';
import { deriveCommercialTasks } from '@/lib/commercial/commercial-task-engine';
import { deriveWorkspaceWorkflowStatus } from '@/lib/commercial/workflow-integration';

const PROJECT_ID = 'proj-001';
const DEAL_ID = 'deal-001';

function makeFinancialSnapshot() {
  return deriveCommercialFinancialSnapshot({
    projectId: PROJECT_ID,
    dealId: DEAL_ID,
    fundingSources: [
      {
        id: 'fs-1',
        projectId: PROJECT_ID,
        organizationId: null,
        name: 'Customer',
        description: null,
        sourceType: 'REVENUE',
        amount: 50000,
        currency: 'AUD',
        status: 'PENDING',
        confidenceLevel: 'HIGH',
        expectedSettlementDate: '2026-08-15',
        actualSettlementDate: null,
        linkedInvoiceId: null,
        linkedPaymentId: null,
        notes: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
    ],
    treasury: null,
    obligationRows: [],
    releaseConfidence: null,
    currency: 'AUD',
  });
}

describe('deriveCommercialOperationsWorkspace', () => {
  it('assembles workspace view from existing domain services', () => {
    const financialSnapshot = makeFinancialSnapshot();
    const forecasting = deriveCommercialForecasting({
      projectId: PROJECT_ID,
      dealId: DEAL_ID,
      currency: 'AUD',
      fundingSources: financialSnapshot.forecast.incomingRevenue.map((r) => ({
        id: r.id,
        projectId: PROJECT_ID,
        organizationId: null,
        name: r.sourceName,
        description: null,
        sourceType: 'REVENUE' as const,
        amount: r.amount,
        currency: 'AUD',
        status: 'PENDING' as const,
        confidenceLevel: 'HIGH' as const,
        expectedSettlementDate: r.expectedDate,
        actualSettlementDate: null,
        linkedInvoiceId: null,
        linkedPaymentId: null,
        notes: null,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      })),
      treasury: null,
      obligationRows: [],
      releaseConfidence: null,
    });

    const workspaceWorkflow = deriveWorkspaceWorkflowStatus([]);
    const tasks = deriveCommercialTasks({ projectId: PROJECT_ID, participants: [] });

    const view = deriveCommercialOperationsWorkspace({
      projectId: PROJECT_ID,
      dealId: DEAL_ID,
      agreementName: 'Sunset Sessions',
      currency: 'AUD',
      financialSnapshot,
      forecasting,
      workspaceWorkflow,
      tasks: tasks.tasks,
      operationalRisks: tasks.risks,
      briefingSnapshot: null,
      commercialTiming: null,
      invoiceAccountingStatus: [],
      automationPreview: null,
      scheduledAutomationCount: 0,
      participantActivity: [],
      aiRecommendations: [],
    });

    expect(view.agreementName).toBe('Sunset Sessions');
    expect(view.forecastSummary.totalRevenue).toBeGreaterThan(0);
    expect(view.financialSnapshot.forecast.totalExpectedRevenue).toBe(
      deriveCommercialForecast({
        fundingSources: financialSnapshot.forecast.incomingRevenue.length
          ? [
              {
                id: 'fs-1',
                projectId: PROJECT_ID,
                organizationId: null,
                name: 'Customer',
                description: null,
                sourceType: 'REVENUE',
                amount: 50000,
                currency: 'AUD',
                status: 'PENDING',
                confidenceLevel: 'HIGH',
                expectedSettlementDate: '2026-08-15',
                actualSettlementDate: null,
                linkedInvoiceId: null,
                linkedPaymentId: null,
                notes: null,
                createdAt: '2026-06-01T00:00:00.000Z',
                updatedAt: '2026-06-01T00:00:00.000Z',
              },
            ]
          : [],
        treasury: null,
        obligationRows: [],
        releaseConfidence: null,
        currency: 'AUD',
      }).totalExpectedRevenue
    );
  });
});
