import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import {
  deriveParticipantCommercialWorkflowState,
  deriveCommercialState,
} from '@/lib/commercial/workflows/derive-commercial-state';
import {
  deriveParticipantSettlementWorkflowState,
  deriveSettlementState,
} from '@/lib/commercial/workflows/derive-settlement-state';
import {
  deriveParticipantAccountingWorkflowState,
  deriveAccountingState,
} from '@/lib/commercial/workflows/derive-accounting-state';
import { deriveParticipantWorkflows } from '@/lib/commercial/workflows/derive-participant-workflows';
import { mapLegacyParticipantLifecycleStage } from '@/lib/commercial/workflows/map-legacy-lifecycle-stage';
import { deriveParticipantCommercialLifecycle } from '@/lib/commercial/participant-commercial-lifecycle';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

const deal: RecentDeal = {
  id: 'proj-test-1',
  dealName: 'Summer Festival',
  partner: 'Acme Events',
  value: 100000,
  introducer: 'Alice',
  closer: 'Bob',
  status: 'Approved',
  lastUpdated: '2026-01-01',
  paymentStatus: 'Not Paid',
};

import { approvedParticipantWithVerifiedPayout } from '@/__tests__/fixtures/participant-workflow-fixtures';

describe('workflow independence', () => {
  it('commercial completion does not require Xero export', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    const commercial = deriveParticipantCommercialWorkflowState(participant);
    const accounting = deriveParticipantAccountingWorkflowState(participant);

    expect(commercial.state).toBe('COMMERCIAL_SETTLEMENT_READY');
    expect(accounting.state).toBe('NOT_EXPORTED');
  });

  it('settlement can be ready while accounting remains pending', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    const settlement = deriveParticipantSettlementWorkflowState(participant);
    const accounting = deriveParticipantAccountingWorkflowState(participant);

    expect(settlement.state).toBe('READY');
    expect(accounting.state).toBe('NOT_EXPORTED');
  });

  it('accounting failure does not revert commercial completion', () => {
    const participant = {
      ...approvedParticipantWithVerifiedPayout(deal),
      paymentSetup: {
        ...approvedParticipantWithVerifiedPayout(deal).paymentSetup,
        xeroLastAttemptAt: '2026-06-05T00:00:00.000Z',
        xeroSyncStatus: 'failed' as const,
        xeroFailureReason: 'Xero API timeout',
      },
    };

    const commercial = deriveParticipantCommercialWorkflowState(participant);
    const accounting = deriveParticipantAccountingWorkflowState(participant);

    expect(commercial.state).toBe('COMMERCIAL_SETTLEMENT_READY');
    expect(accounting.state).toBe('FAILED');
  });

  it('legacy lifecycle still maps accounting sync to SETTLEMENT_READY', () => {
    const participant = {
      ...approvedParticipantWithVerifiedPayout(deal),
      paymentSetup: {
        ...approvedParticipantWithVerifiedPayout(deal).paymentSetup,
        xeroExportedAt: '2026-06-05T00:00:00.000Z',
        xeroSyncStatus: 'synced' as const,
      },
    };

    const workflows = deriveParticipantWorkflows(participant);
    expect(mapLegacyParticipantLifecycleStage(participant, workflows)).toBe('SETTLEMENT_READY');
    expect(deriveParticipantCommercialLifecycle(participant)).toBe('SETTLEMENT_READY');
  });

  it('legacy lifecycle keeps XERO_INVOICE before accounting export', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    expect(deriveParticipantCommercialLifecycle(participant)).toBe('XERO_INVOICE');
  });

  it('project-level derive functions return per-participant results', () => {
    const participants = [approvedParticipantWithVerifiedPayout(deal)];
    const context = { projectId: deal.id, projectName: deal.dealName, participants };

    expect(deriveCommercialState(context)).toHaveLength(1);
    expect(deriveSettlementState(context)).toHaveLength(1);
    expect(deriveAccountingState(context)).toHaveLength(1);
  });
});
