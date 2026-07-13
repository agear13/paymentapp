import { buildProjectParticipant } from '@/lib/projects/participant-entitlement';
import { approvedParticipantWithVerifiedPayout } from '@/__tests__/fixtures/participant-workflow-fixtures';
import {
  deriveParticipantCommercialState,
  deriveParticipantWorkspaceExperience,
  needsWorkspaceAgreementApproval,
  showsCommercialWorkspace,
} from '@/lib/participant-portal/participant-workspace-state';
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

describe('deriveParticipantCommercialState', () => {
  it('returns INVITED before agreement is shared', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    expect(deriveParticipantCommercialState(p)).toBe('INVITED');
    expect(deriveParticipantWorkspaceExperience('INVITED')).toBe('awaiting_send');
  });

  it('returns AGREEMENT_PENDING after invitation is shared', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    const shared = {
      ...p,
      agreementSharedAt: '2026-06-01T00:00:00.000Z',
      inviteSentAt: '2026-06-01T00:00:00.000Z',
      agreementLifecycle: 'SHARED' as const,
    };
    expect(deriveParticipantCommercialState(shared)).toBe('AGREEMENT_PENDING');
    expect(needsWorkspaceAgreementApproval('AGREEMENT_PENDING')).toBe(true);
    expect(deriveParticipantWorkspaceExperience('AGREEMENT_PENDING')).toBe('agreement_review');
  });

  it('returns AGREEMENT_ACCEPTED or ACTIVE after approval', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    const approved = {
      ...p,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-01T00:00:00.000Z',
      agreementLifecycle: 'ACCEPTED' as const,
    };
    const state = deriveParticipantCommercialState(approved);
    expect(['AGREEMENT_ACCEPTED', 'ACTIVE']).toContain(state);
    expect(showsCommercialWorkspace(state)).toBe(true);
    expect(deriveParticipantWorkspaceExperience(state)).toBe('commercial');
  });

  it('returns SETTLEMENT_PENDING when settlement workflow is ready', () => {
    const participant = approvedParticipantWithVerifiedPayout(deal);
    expect(deriveParticipantCommercialState(participant)).toBe('SETTLEMENT_PENDING');
    expect(showsCommercialWorkspace('SETTLEMENT_PENDING')).toBe(true);
  });

  it('returns PAID when payout is complete', () => {
    const p = buildProjectParticipant({
      name: 'Sarah',
      role: 'Promoter',
      project: deal,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      commissionValue: 1200,
      enableCustomerAttribution: false,
    });
    const paid = {
      ...p,
      approvalStatus: 'Approved' as const,
      approvedAt: '2026-06-01T00:00:00.000Z',
      payoutSettlementStatus: 'Paid' as const,
    };
    expect(deriveParticipantCommercialState(paid)).toBe('PAID');
  });
});
