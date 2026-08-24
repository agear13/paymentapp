import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  compensationKindOf,
  listMissingPayoutFields,
  referralEligibilityOf,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';
import {
  buildOperationalActions,
  buildOperationalParticipants,
} from '@/lib/workflows/agreement-intelligence/operational-hub-coordination.server';
import {
  runParticipantCoordinationAction,
} from '@/lib/workflows/agreement-intelligence/participant-coordination.server';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findFirst: jest.fn(),
    },
    organization_workflow_agreements: {
      findFirst: jest.fn(),
    },
    organization_services: {
      findMany: jest.fn(),
    },
    deal_network_pilot_participants: {
      findUnique: jest.fn(),
    },
    deal_network_pilot_obligations: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
  updatePilotParticipantPayload: jest.fn(),
  issueAndPersistParticipantAttribution: jest.fn(),
}));

jest.mock('@/lib/participant-portal/participant-portal.server', () => ({
  ensureParticipantPortalToken: jest.fn(),
}));

jest.mock('@/lib/commercial/payment-request.server', () => ({
  generatePaymentRequestForParticipant: jest.fn(),
}));

jest.mock('@/lib/referrals/ensure-referral-issuance', () => ({
  ensureReferralIssuance: jest.fn(),
  resolveOrganizationIdForPilotDeal: jest.fn(),
}));

jest.mock('@/lib/operations/orchestration/operational-mutation-orchestrator.server', () => ({
  orchestrateOperationalMutation: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/commercial/dispatch-commercial-notification.server', () => ({
  dispatchCommercialNotification: jest.fn(),
}));

jest.mock('@/lib/workflows/agreement-intelligence/agreement-service.server', () => ({
  getWorkflowAgreementContext: jest.fn(),
  refreshWorkflowActivation: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { getPilotSnapshotForUser, updatePilotParticipantPayload } = jest.requireMock(
  '@/lib/deal-network-demo/pilot-snapshot.server'
);
const { ensureParticipantPortalToken } = jest.requireMock(
  '@/lib/participant-portal/participant-portal.server'
);
const { generatePaymentRequestForParticipant } = jest.requireMock(
  '@/lib/commercial/payment-request.server'
);
const { ensureReferralIssuance, resolveOrganizationIdForPilotDeal } = jest.requireMock(
  '@/lib/referrals/ensure-referral-issuance'
);
const { getWorkflowAgreementContext, refreshWorkflowActivation } = jest.requireMock(
  '@/lib/workflows/agreement-intelligence/agreement-service.server'
);

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF = 'wf-11111111-1111-1111-1111-111111111111';
const USER = 'user-1';
const DEAL = 'aiwf-wf-11111111-1111-1111-1111-111111111111';

function participant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-apex',
    name: 'Apex Promotions',
    email: 'promoter@example.com',
    role: 'Introducer',
    dealId: DEAL,
    inviteToken: 'token-1',
    participantPortalToken: 'portal-1',
    approvalStatus: 'Pending approval',
    status: 'Pending',
    inviteStatus: 'Invited',
    onboardingStatus: 'NOT_STARTED',
    commissionKind: 'pct_deal_value',
    commissionValue: 20,
    participationModel: 'revenue_share',
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: 20,
    },
    ...overrides,
  } as DemoParticipant;
}

function workflowRow() {
  return {
    id: WF,
    organization_id: ORG,
    template_slug: 'agreement-intelligence',
    status: 'DEPLOYED',
    lifecycle_status: 'PARTICIPANT_SETUP',
    configuration: { operatorApprovalRequired: true, defaultSettlementCurrency: 'AUD' },
    agreements: [{ pilot_deal_id: DEAL, is_current: true }],
  };
}

describe('Agreement Intelligence P3-E participant coordination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization_workflows.findFirst.mockResolvedValue(workflowRow());
    prisma.organization_services.findMany.mockResolvedValue([
      { id: 'svc-1', name: 'Summer Launch Party' },
    ]);
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [participant()],
    });
    refreshWorkflowActivation.mockResolvedValue(undefined);
    getWorkflowAgreementContext.mockResolvedValue({
      workflowId: WF,
      operationalSummary: { participants: [] },
    });
  });

  it('maps revenue-share vs fixed payment referral eligibility', () => {
    const catalog = [{ id: 'svc-1', name: 'Summer Launch Party' }];
    expect(compensationKindOf(participant())).toBe('revenue_share');
    expect(referralEligibilityOf(participant(), catalog).status).toBe('ready');
    expect(
      referralEligibilityOf(
        participant({
          compensationProfile: { compensationType: 'FIXED_FEE', fixedAmount: 2500 },
          commissionKind: 'fixed_amount',
          commissionValue: 2500,
        }),
        catalog
      ).status
    ).toBe('not_applicable');
    expect(referralEligibilityOf(participant(), []).status).toBe('service_required');
  });

  it('lists missing payout fields from submitted onboarding', () => {
    const missing = listMissingPayoutFields(
      participant({
        supplierOnboarding: {
          payment: {
            preference: 'bank_account',
            bankDetails: { accountName: null, bsb: null, accountNumber: null },
            alternativePaymentMethod: null,
          },
          abn: { abn: null, abnNotApplicable: false },
          gst: { gstStatus: 'pending' },
        },
      })
    );
    expect(missing).toEqual(['Preferred payout method', 'ABN', 'GST information']);
  });

  it('does not push contractual parties into payout/referral setup', () => {
    const rows = buildOperationalParticipants({
      reviewForm: {
        projectName: 'Festival',
        sourceType: 'paste',
        parties: [
          { id: 'venue', name: 'Venue Co', role: 'Venue', email: '', revenueSharePct: null },
          { id: 'apex', name: 'Apex Promotions', role: 'Promoter', email: '', revenueSharePct: 20 },
        ],
        settlementRules: [],
        paymentTerms: [],
      } as ReviewFormState,
      pilotParticipants: [participant()],
      pilotDealId: DEAL,
      commercialGraph: null,
      operatorApprovalRequired: true,
      catalogItems: [{ id: 'svc-1', name: 'Summer Launch Party' }],
    });
    const venue = rows.find((row) => row.name === 'Venue Co');
    expect(venue?.partyKind).toBe('contractual_party');
    expect(venue?.payoutSetupStatus).toBe('not_applicable');
    expect(venue?.referralStatus).toBe('not_applicable');
    expect(venue?.nextActionKind).toBe('none');
    expect(venue?.manageUrl).toBeNull();
  });

  it('exposes request-approval as the first compensated-participant action', () => {
    const rows = buildOperationalParticipants({
      reviewForm: null,
      pilotParticipants: [participant()],
      pilotDealId: DEAL,
      commercialGraph: null,
      operatorApprovalRequired: true,
      catalogItems: [{ id: 'svc-1', name: 'Summer Launch Party' }],
    });
    const actions = buildOperationalActions({
      participants: rows,
      obligations: [],
      settlement: { schedule: null, approvalRequired: true, nextSettlementLabel: null },
      operatorApprovalRequired: true,
    });
    expect(actions.some((row) => row.kind === 'request_approval')).toBe(true);
    expect(JSON.stringify(actions)).not.toMatch(/release payout|execute payment|send money/i);
  });

  it('requests approval idempotently without duplicating invitations', async () => {
    const existing = participant({
      agreementSharedAt: '2026-08-19T00:00:00.000Z',
      participantPortalToken: 'portal-1',
    });
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [existing],
    });
    ensureParticipantPortalToken.mockResolvedValue({
      participant: existing,
      token: 'portal-1',
      created: false,
    });

    const first = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'request_approval',
    });
    const second = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'request_approval',
    });

    expect(updatePilotParticipantPayload).not.toHaveBeenCalled();
    expect(first.coordination.created).toBe(false);
    expect(second.coordination.created).toBe(false);
    expect(first.coordination.workspaceUrl).toBe(second.coordination.workspaceUrl);
  });

  it('requests payout details through the existing payment-request engine', async () => {
    const approved = participant({ approvalStatus: 'Approved', approvedAt: '2026-08-19T01:00:00.000Z' });
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [approved],
    });
    generatePaymentRequestForParticipant.mockResolvedValue({
      participant: approved,
      portalUrl: '/participant/portal-1?step=payout',
      tokenExpiresAt: '2026-08-20T00:00:00.000Z',
      emailSent: false,
    });

    const result = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'request_payout_details',
    });

    expect(generatePaymentRequestForParticipant).toHaveBeenCalledWith('p-apex', USER, {
      sendEmail: true,
    });
    expect(result.coordination.portalUrl).toContain('payout');
  });

  it('refuses payout request before agreement approval', async () => {
    await expect(
      runParticipantCoordinationAction({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        action: 'request_payout_details',
      })
    ).rejects.toThrow(/approve the agreement/i);
    expect(generatePaymentRequestForParticipant).not.toHaveBeenCalled();
  });

  it('approves and flags submitted payout details without executing payment', async () => {
    const submitted = participant({
      approvalStatus: 'Approved',
      supplierOnboarding: {
        submission: { submittedAt: '2026-08-19T02:00:00.000Z', declarationAccepted: true },
        lifecycle: 'SUBMITTED',
        events: [],
        payment: {
          preference: 'bank_account',
          bankDetails: { accountName: 'Apex', bsb: '062000', accountNumber: '12345678' },
          alternativePaymentMethod: null,
        },
        abn: { abn: '51824753556', abnNotApplicable: false },
        gst: { gstStatus: 'yes' },
      },
    });
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [submitted],
    });
    updatePilotParticipantPayload.mockImplementation(async (_id: string, _user: string, patch: Partial<DemoParticipant>) => ({
      ...submitted,
      ...patch,
    }));

    const approved = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'approve_payout_details',
    });
    expect(approved.coordination.created).toBe(true);

    const flagged = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'flag_payout_details',
      missingFields: ['GST information'],
    });
    expect(String(flagged.coordination.requestedChanges)).toContain('GST information');
    expect(JSON.stringify(approved)).not.toMatch(/execute payment|release payout/i);
  });

  it('activates a revenue-share referral idempotently and skips fixed payments', async () => {
    const ready = participant({
      approvalStatus: 'Approved',
      payoutVerificationConfirmed: true,
      onboardingStatus: 'COMPLETE',
    });
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [ready],
    });
    prisma.deal_network_pilot_participants.findUnique.mockResolvedValue({
      id: 'p-apex',
      deal_id: DEAL,
      invite_token: 'token-1',
      participant_payload: ready,
      deal: { user_id: USER, id: DEAL, deal_payload: { dealName: 'Festival' } },
    });
    resolveOrganizationIdForPilotDeal.mockResolvedValue(ORG);
    ensureReferralIssuance.mockResolvedValue({
      code: 'PAPEX',
      referralUrl: 'https://app.provvypay.com/r/PAPEX',
      created: true,
    });
    updatePilotParticipantPayload.mockResolvedValue({
      ...ready,
      referralCode: 'PAPEX',
      customerCommerceUrl: 'https://app.provvypay.com/r/PAPEX',
    });

    const first = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'activate_referral',
    });
    expect(first.coordination.referralUrl).toContain('/r/PAPEX');
    expect(first.coordination.qrUrl).toBe('/api/referral/PAPEX/qr');

    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [
        {
          ...ready,
          referralCode: 'PAPEX',
          customerCommerceUrl: 'https://app.provvypay.com/r/PAPEX',
        },
      ],
    });
    ensureReferralIssuance.mockClear();
    const second = await runParticipantCoordinationAction({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      action: 'activate_referral',
    });
    expect(ensureReferralIssuance).not.toHaveBeenCalled();
    expect(second.coordination.created).toBe(false);
    expect(second.coordination.referralUrl).toBe(first.coordination.referralUrl);

    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [
        participant({
          id: 'p-fixed',
          compensationProfile: { compensationType: 'FIXED_FEE', fixedAmount: 500 },
          commissionKind: 'fixed_amount',
          commissionValue: 500,
          approvalStatus: 'Approved',
        }),
      ],
    });
    await expect(
      runParticipantCoordinationAction({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-fixed',
        action: 'activate_referral',
      })
    ).rejects.toThrow(/fixed payment/i);
  });

  it('rejects cross-organization participant coordination', async () => {
    prisma.organization_workflows.findFirst.mockResolvedValue(null);
    await expect(
      runParticipantCoordinationAction({
        organizationId: 'org-other',
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        action: 'request_approval',
      })
    ).rejects.toThrow(/not found/i);
  });

  it('does not coordinate contractual parties', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: DEAL }],
      participants: [
        participant({
          id: 'p-venue',
          name: 'Venue Co',
          compensationProfile: undefined,
          commissionKind: 'fixed_amount',
          commissionValue: 0,
        }),
      ],
    });
    await expect(
      runParticipantCoordinationAction({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-venue',
        action: 'request_payout_details',
      })
    ).rejects.toThrow(/contractual/i);
  });
});
