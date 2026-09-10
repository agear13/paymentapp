import { readFileSync } from 'fs';
import path from 'path';
import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { approvedParticipantWithVerifiedPayout } from '@/__tests__/fixtures/participant-workflow-fixtures';
import { deriveParticipantCommercialLifecycle } from '@/lib/commercial/participant-commercial-lifecycle';
import { deriveCommercialTasks } from '@/lib/commercial/commercial-task-engine';
import { buildParticipantTaskContexts } from '@/lib/commercial-operations/build-workspace-inputs';
import {
  deriveSupplierReviewSettlementActions,
  XERO_EXPORT_SKIPPED_COPY,
} from '@/lib/commercial/supplier-review-settlement-actions';
import { deriveParticipantWorkflows } from '@/lib/commercial/workflows/derive-participant-workflows';
import { mapLegacyParticipantLifecycleStage } from '@/lib/commercial/workflows/map-legacy-lifecycle-stage';
import { resolvePersistedObligationStatus } from '@/lib/operations/derivations/derive-obligation-allocation-status';
import { classifyWorkspaceStatus } from '@/lib/settlement/workspace-settlement';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';

const deal: RecentDeal = {
  id: 'proj-xero-optional',
  dealName: 'Xero Optional Settlement',
  partner: 'Acme Events',
  value: 100000,
  introducer: 'Alice',
  closer: 'Bob',
  status: 'Approved',
  lastUpdated: '2026-01-01',
  paymentStatus: 'Not Paid',
};

function readSrc(relativePath: string): string {
  return readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
}

function unverifiedParticipant() {
  const p = buildProjectParticipant({
    name: 'Alex',
    email: 'alex@example.com',
    role: 'Contractor',
    project: deal,
    participationModel: 'fixed_payout',
    commissionKind: 'fixed_amount',
    commissionValue: 1200,
    enableCustomerAttribution: false,
  });
  return {
    ...p,
    approvalStatus: 'Approved' as const,
    approvedAt: '2026-06-01T00:00:00.000Z',
    agreementUrl: `/participant/${p.participantPortalToken}`,
    supplierOnboarding: {
      lifecycle: 'SUBMITTED' as const,
      submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
    },
    payoutVerificationConfirmed: false,
  };
}

describe('Xero-optional settlement readiness', () => {
  it('maps a Xero-disconnected approved funded obligation to AVAILABLE_FOR_PAYOUT', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    expect(participant.paymentSetup?.xeroExportedAt).toBeFalsy();

    const status = resolvePersistedObligationStatus({
      participant,
      deal,
      moneyConfirmed: true,
      fullyFunded: true,
    });

    expect(status).toBe(DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT);
    expect(classifyWorkspaceStatus({ status })).toBe('ready');
    expect(deriveParticipantCommercialLifecycle(participant)).toBe('SETTLEMENT_READY');
  });

  it('does not call the Xero export path from operator verification', () => {
    const review = readSrc(
      'components/commercial/supplier-onboarding/supplier-onboarding-review-screen.tsx'
    );
    expect(review).not.toContain('handleVerifyAndPushSupplierBill');
    expect(review).toContain('Verify supplier details');
    expect(review).toContain('/supplier-onboarding/approve');

    const verifyHandler =
      review.split('const handleApprove')[1]?.split('const handleXeroExport')[0] ?? '';
    expect(verifyHandler).not.toContain('/xero-export');
  });

  it('does not show an actionable Push to Xero CTA when Xero is disconnected', () => {
    const actions = deriveSupplierReviewSettlementActions({
      lifecycle: 'APPROVED',
      xeroConnected: false,
    });
    expect(actions.showPushToXeroAction).toBe(false);
    expect(actions.showXeroSkippedCopy).toBe(true);
    expect(actions.xeroSkippedCopy).toBe(XERO_EXPORT_SKIPPED_COPY);
  });

  it('preserves the existing Xero export action when Xero is connected', () => {
    const actions = deriveSupplierReviewSettlementActions({
      lifecycle: 'APPROVED',
      xeroConnected: true,
    });
    expect(actions.showPushToXeroAction).toBe(true);
    expect(actions.showXeroSkippedCopy).toBe(false);

    const exportRoute = readSrc(
      'app/api/deal-network-pilot/participants/[participantId]/xero-export/route.ts'
    );
    expect(exportRoute).toContain('createSupplierBillInXero');
  });

  it('shows Verify supplier details after submission and never auto-exports', () => {
    const actions = deriveSupplierReviewSettlementActions({
      lifecycle: 'SUBMITTED',
      xeroConnected: true,
    });
    expect(actions.showVerifyAction).toBe(true);
    expect(actions.verifyLabel).toBe('Verify supplier details');
    expect(actions.showPushToXeroAction).toBe(false);
  });

  it('keeps missing operator approval blocked from Releases', () => {
    const participant = unverifiedParticipant();
    const status = resolvePersistedObligationStatus({
      participant,
      deal,
      moneyConfirmed: true,
      fullyFunded: true,
    });
    expect(status).not.toBe(DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT);
    expect(classifyWorkspaceStatus({ status })).not.toBe('ready');
  });

  it('maps supplier-onboarding APPROVED without the legacy boolean to UNFUNDED when unfunded', () => {
    const participant = {
      ...unverifiedParticipant(),
      supplierOnboarding: {
        lifecycle: 'APPROVED' as const,
        submission: { submittedAt: '2026-06-03T00:00:00.000Z', declarationAccepted: true },
        operator: { approvedAt: '2026-06-04T00:00:00.000Z', xeroExportedAt: null, notes: null },
      },
      payoutVerificationConfirmed: false,
    };
    const status = resolvePersistedObligationStatus({
      participant,
      deal,
      moneyConfirmed: false,
      fullyFunded: false,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.UNFUNDED);
  });

  it('maps an approved operator-confirmed unfunded obligation to UNFUNDED', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    const status = resolvePersistedObligationStatus({
      participant,
      deal,
      moneyConfirmed: false,
      fullyFunded: false,
    });
    expect(status).toBe(DealNetworkPilotObligationStatus.UNFUNDED);
    expect(classifyWorkspaceStatus({ status })).not.toBe('ready');
  });

  it('does not generate an export_to_xero task when Xero is disconnected', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    const contexts = buildParticipantTaskContexts([participant], { xeroConnected: false });
    expect(contexts[0]?.accounting.xeroStatus).toBe('not_required');

    const result = deriveCommercialTasks({
      projectId: deal.id,
      currentDate: '2026-06-15',
      participants: contexts,
      xeroConnected: false,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
    });
    expect(result.tasks.some((task) => task.taskType === 'export_to_xero')).toBe(false);
  });

  it('still generates export_to_xero when Xero is connected and export is pending', () => {
    const result = deriveCommercialTasks({
      projectId: deal.id,
      currentDate: '2026-06-15',
      xeroConnected: true,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
      participants: [
        {
          participant: {
            id: 'p-1',
            name: 'Sarah',
            role: 'Contractor',
            email: 'sarah@example.com',
          },
          agreement: {
            approved: true,
            agreementGenerated: true,
            earningsConfigured: true,
            sentAt: '2026-06-01',
          },
          invoice: {
            state: 'verified',
            requestedAt: '2026-06-02',
            receivedAt: '2026-06-03',
            invoiceDueDate: null,
            invoiceAmount: 1200,
            obligationAmount: 1200,
          },
          taxDetails: { abn: '51824753556', gstRegistered: false, abnValid: true },
          bankDetails: {
            bsb: '062000',
            accountNumber: '12345678',
            accountName: 'Sarah',
            complete: true,
          },
          funding: { status: 'funded' },
          accounting: { xeroStatus: 'pending' },
          obligation: { amount: 1200, currency: 'AUD', type: 'fixed_fee' },
        },
      ],
    });
    const task = result.tasks.find((item) => item.taskType === 'export_to_xero');
    expect(task).toBeTruthy();
    expect(task?.commercialImpact).not.toMatch(/cannot be released/i);
  });

  it('refreshes obligations after operator approval via the existing orchestrator', () => {
    const approveRoute = readSrc(
      'app/api/deal-network-pilot/participants/[participantId]/supplier-onboarding/approve/route.ts'
    );
    expect(approveRoute).toContain('orchestrateOperationalMutation');
    expect(approveRoute).toContain("'payout_verification'");

    const coordinator = readSrc('lib/participants/coordinate-commercial-participant.server.ts');
    expect(coordinator).toContain('mutation: \'payout_verification\'');
  });

  it('does not treat missing Xero sync as a settlement blocker in the legacy mapper', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    const workflows = deriveParticipantWorkflows(participant);
    expect(workflows.accounting.state).toBe('NOT_EXPORTED');
    expect(mapLegacyParticipantLifecycleStage(participant, workflows)).toBe('SETTLEMENT_READY');
  });

  it('leaves payout-batch and rail orchestrator files on the existing write path', () => {
    const create = readSrc('app/api/payout-batches/create/route.ts');
    const submit = readSrc('app/api/payout-batches/[id]/submit/route.ts');
    const selector = readSrc('lib/payouts/select-payout-rail.ts');
    const orchestrator = readSrc('lib/payouts/execute-payout-release.server.ts');
    const settlementScreen = readSrc(
      'components/journey/lovable/workspace-settlement-screen.tsx'
    );
    expect(create).toContain('orchestrateOperationalMutation');
    expect(submit).toContain('orchestrateOperationalMutation');
    expect(selector.length).toBeGreaterThan(0);
    expect(orchestrator).toContain('Canonical outbound payout orchestrator');
    expect(settlementScreen).toContain('WorkspaceSettlementRailIntelligence');
  });
});
