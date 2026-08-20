import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { executeCommercialParticipantAction } from '@/lib/participants/coordinate-commercial-participant.server';
import {
  addReferralManagementPromoter,
  ReferralManagementError,
  runReferralManagementAction,
} from '@/lib/workflows/referral-management/promoter.server';
import { REFERRAL_MANAGEMENT_SLUG } from '@/lib/workflows/referral-management/constants';
import { compensationKindOf } from '@/lib/workflows/agreement-intelligence/participant-coordination';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    organization_services: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([{ id: 'svc-1', name: 'Summer Launch Party' }]),
    },
    deal_network_pilot_deals: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    deal_network_pilot_participants: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment_links: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    commission_obligation_items: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
  upsertPilotDealForUser: jest.fn(),
  createPilotParticipantForUser: jest.fn(),
  updatePilotParticipantPayload: jest.fn(),
  issueAndPersistParticipantAttribution: jest.fn(),
}));

jest.mock('@/lib/operations/orchestration/operational-mutation-orchestrator.server', () => ({
  orchestrateOperationalMutation: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/commissions/attribution-earnings.server', () => ({
  listAttributionEarningsForOrganization: jest.fn().mockResolvedValue([]),
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

jest.mock('@/lib/commercial/dispatch-commercial-notification.server', () => ({
  dispatchCommercialNotification: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const {
  getPilotSnapshotForUser,
  createPilotParticipantForUser,
  updatePilotParticipantPayload,
} = jest.requireMock('@/lib/deal-network-demo/pilot-snapshot.server');
const { ensureReferralIssuance, resolveOrganizationIdForPilotDeal } = jest.requireMock(
  '@/lib/referrals/ensure-referral-issuance'
);
const { generatePaymentRequestForParticipant } = jest.requireMock(
  '@/lib/commercial/payment-request.server'
);

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF = 'wf-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER = 'user-1';
const SERVICE = '11111111-1111-1111-1111-111111111111';

function promoter(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-apex',
    name: 'Apex Promotions',
    email: 'apex@example.com',
    role: 'Connector',
    commissionKind: 'pct_deal_value',
    commissionValue: 20,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'invite-1',
    dealId: `rmwf-${WF}`,
    compensationProfile: {
      compensationType: 'REVENUE_SHARE',
      percentage: 20,
      configured: true,
      configuredAt: '2026-08-20T00:00:00.000Z',
      commissionServiceIds: [SERVICE],
      commissionSourceMode: 'selected',
      customerAttributionEnabled: true,
      revenueSources: [],
    },
    ...overrides,
  } as DemoParticipant;
}

describe('P4 — Referral Management workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization_workflows.findFirst.mockResolvedValue({
      id: WF,
      organization_id: ORG,
      template_slug: REFERRAL_MANAGEMENT_SLUG,
      status: 'DEPLOYED',
      lifecycle_status: 'ACTIVE',
      configuration: {},
    });
    prisma.organization_workflows.findUnique.mockResolvedValue(null);
    prisma.organization_services.findFirst.mockResolvedValue({ id: SERVICE, name: 'Summer Launch Party' });
    prisma.organization_services.findMany.mockResolvedValue([{ id: SERVICE, name: 'Summer Launch Party' }]);
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [] });
    createPilotParticipantForUser.mockImplementation((_userId: string, participant: DemoParticipant) =>
      Promise.resolve(participant)
    );
  });

  it('adds a promoter without Agreement Intelligence and without duplicating email', async () => {
    const created = await addReferralManagementPromoter({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      name: 'Apex Promotions',
      email: 'apex@example.com',
      role: 'Promoter',
      compensation: { kind: 'revenue_share', percentage: 20, serviceId: SERVICE },
    });
    expect(created.created).toBe(true);
    expect(created.participant.email).toBe('apex@example.com');
    expect(compensationKindOf(created.participant)).toBe('revenue_share');
    expect(JSON.stringify(created)).not.toMatch(/execute payment|release payout/i);

    getPilotSnapshotForUser.mockResolvedValue({
      deals: [],
      participants: [created.participant],
    });
    await expect(
      addReferralManagementPromoter({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        name: 'Apex Duplicate',
        email: 'apex@example.com',
        role: 'Promoter',
        compensation: { kind: 'revenue_share', percentage: 20, serviceId: SERVICE },
      })
    ).rejects.toMatchObject({ status: 409, name: 'ReferralManagementError' });
  });

  it('E: import reuses an existing compensated participant by exact email', async () => {
    const existing = promoter({ email: 'apex@example.com' });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    const result = await addReferralManagementPromoter({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      name: 'Apex Promotions',
      email: 'apex@example.com',
      role: 'Promoter',
      compensation: { kind: 'revenue_share', percentage: 20, serviceId: SERVICE },
      reuseExisting: true,
    });
    expect(result.created).toBe(false);
    expect(result.reused).toBe(true);
    expect(result.participant.id).toBe('p-apex');
    expect(createPilotParticipantForUser).not.toHaveBeenCalled();
  });

  it('F: cannot configure a promoter against a service that is not in this organization', async () => {
    prisma.organization_services.findFirst.mockResolvedValue(null);
    await expect(
      addReferralManagementPromoter({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        name: 'Apex Promotions',
        email: 'apex@example.com',
        role: 'Promoter',
        compensation: {
          kind: 'revenue_share',
          percentage: 20,
          serviceId: '99999999-9999-9999-9999-999999999999',
        },
      })
    ).rejects.toMatchObject({ status: 422, name: 'ReferralManagementError' });
    expect(prisma.organization_services.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG,
          active: true,
        }),
      })
    );
    expect(createPilotParticipantForUser).not.toHaveBeenCalled();
  });

  it('refuses to fabricate a destination when the catalogue is empty', async () => {
    prisma.organization_services.findFirst.mockResolvedValue(null);
    await expect(
      addReferralManagementPromoter({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        name: 'Apex Promotions',
        email: 'apex@example.com',
        role: 'Promoter',
        compensation: { kind: 'revenue_share', percentage: 20, serviceId: SERVICE },
      })
    ).rejects.toBeInstanceOf(ReferralManagementError);
  });

  it('blocks mutations when the workflow is paused', async () => {
    prisma.organization_workflows.findFirst.mockResolvedValue({
      id: WF,
      organization_id: ORG,
      template_slug: REFERRAL_MANAGEMENT_SLUG,
      status: 'PAUSED',
      lifecycle_status: 'ACTIVE',
      configuration: {},
    });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [promoter()] });
    await expect(
      runReferralManagementAction({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        action: 'request_approval',
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a participant that is not in the operator snapshot', async () => {
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [] });
    await expect(
      runReferralManagementAction({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'someone-else',
        action: 'activate_referral',
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('reuses ensureReferralIssuance idempotently for revenue-share promoters', async () => {
    const approved = promoter({ approvalStatus: 'Approved' });
    prisma.deal_network_pilot_participants.findUnique.mockResolvedValue({
      id: approved.id,
      deal_id: approved.dealId,
      deal: { user_id: USER, deal_id: approved.dealId, deal_payload: { dealName: 'Referral Management' } },
    });
    resolveOrganizationIdForPilotDeal.mockResolvedValue(ORG);
    ensureReferralIssuance
      .mockResolvedValueOnce({
        created: true,
        code: 'APEX20',
        referralUrl: 'https://example.test/r/APEX20',
      })
      .mockResolvedValueOnce({
        created: false,
        code: 'APEX20',
        referralUrl: 'https://example.test/r/APEX20',
      });
    updatePilotParticipantPayload.mockResolvedValue({
      ...approved,
      referralCode: 'APEX20',
      customerCommerceUrl: 'https://example.test/r/APEX20',
    });

    const first = await executeCommercialParticipantAction({
      participant: approved,
      userId: USER,
      organizationId: ORG,
      action: 'activate_referral',
    });
    expect(first.created).toBe(true);
    expect(first.referralUrl).toMatch(/\/r\//);
    expect(ensureReferralIssuance).toHaveBeenCalled();

    const second = await executeCommercialParticipantAction({
      participant: {
        ...approved,
        referralCode: 'APEX20',
        customerCommerceUrl: 'https://example.test/r/APEX20',
      },
      userId: USER,
      organizationId: ORG,
      action: 'activate_referral',
    });
    expect(second.created).toBe(false);
    expect(second.referralUrl).toBe(first.referralUrl);
  });

  it('does not issue a referral for fixed commission', async () => {
    await expect(
      executeCommercialParticipantAction({
        participant: promoter({
          commissionKind: 'fixed_amount',
          commissionValue: 2500,
          compensationProfile: {
            compensationType: 'FIXED_FEE',
            fixedAmount: 2500,
            configured: true,
            configuredAt: '2026-08-20T00:00:00.000Z',
            revenueSources: [],
          },
        }),
        userId: USER,
        organizationId: ORG,
        action: 'activate_referral',
      })
    ).rejects.toMatchObject({ status: 422 });
    expect(ensureReferralIssuance).not.toHaveBeenCalled();
  });

  it('requests payout details through the existing payment-request engine', async () => {
    generatePaymentRequestForParticipant.mockResolvedValue({
      participant: promoter({ approvalStatus: 'Approved' }),
      portalUrl: '/participant/token',
      emailSent: false,
    });
    const result = await executeCommercialParticipantAction({
      participant: promoter({ approvalStatus: 'Approved' }),
      userId: USER,
      organizationId: ORG,
      action: 'request_payout_details',
    });
    expect(generatePaymentRequestForParticipant).toHaveBeenCalled();
    expect(result.portalUrl).toMatch(/participant/);
    expect(JSON.stringify(result)).not.toMatch(/execute payment|release payout/i);
  });
});
