import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { executeCommercialParticipantAction } from '@/lib/participants/coordinate-commercial-participant.server';
import {
  addReferralManagementPromoter,
  lookupReferralPromoterByEmail,
  ReferralManagementError,
  runReferralManagementAction,
  updateReferralManagementPromoterServices,
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
      update: jest.fn(),
      updateMany: jest.fn(),
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
const SERVICE_B = '22222222-2222-2222-2222-222222222222';

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
    expect(created.participant.compensationProfile?.commissionServiceIds).toEqual([SERVICE]);
    expect(created.participant.referralCommerce?.enabledServiceIds).toEqual([SERVICE]);
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
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      details: {
        existing: expect.objectContaining({
          email: 'apex@example.com',
          name: 'Apex Promotions',
          participantId: created.participant.id,
          manageUrl: `/workspace/workflows/referral-management?participant=${created.participant.id}`,
        }),
      },
    });
  });

  it('looks up an existing promoter by email before save', async () => {
    const existing = promoter({
      name: 'Jenny',
      email: 'alishajayne13@gmail.com',
      role: 'Promoter',
    });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([
      { id: SERVICE, name: 'Summer Launch Party' },
    ]);
    await expect(
      lookupReferralPromoterByEmail({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        email: '  AlishaJayne13@gmail.com ',
      })
    ).resolves.toEqual({
      existing: expect.objectContaining({
        participantId: 'p-apex',
        name: 'Jenny',
        email: 'alishajayne13@gmail.com',
        role: 'Promoter',
        manageUrl: '/workspace/workflows/referral-management?participant=p-apex',
      }),
    });
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
    prisma.organization_services.findMany.mockResolvedValue([]);
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
    expect(prisma.organization_services.findMany).toHaveBeenCalledWith(
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
    prisma.organization_services.findMany.mockResolvedValue([]);
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

  it('scopes a promoter to multiple selected catalogue services', async () => {
    prisma.organization_services.findMany.mockResolvedValue([
      { id: SERVICE, name: 'Summer Launch Party' },
      { id: SERVICE_B, name: 'Premium consultation' },
    ]);
    const created = await addReferralManagementPromoter({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      name: 'Apex Promotions',
      email: 'apex@example.com',
      role: 'Promoter',
      compensation: {
        kind: 'revenue_share',
        percentage: 20,
        serviceIds: [SERVICE, SERVICE_B],
      },
    });
    expect(created.created).toBe(true);
    expect(created.participant.compensationProfile?.commissionServiceIds).toEqual([
      SERVICE,
      SERVICE_B,
    ]);
    expect(created.participant.referralCommerce?.enabledServiceIds).toEqual([
      SERVICE,
      SERVICE_B,
    ]);
  });

  it('updates eligible services and refreshes an issued referral checkout config', async () => {
    const existing = promoter({
      approvalStatus: 'Approved',
      referralCode: 'APEX20',
      customerCommerceUrl: 'https://example.test/r/APEX20',
    });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([
      { id: SERVICE, name: 'Summer Launch Party' },
      { id: SERVICE_B, name: 'Premium consultation' },
    ]);
    updatePilotParticipantPayload.mockImplementation(
      (_id: string, _user: string, patch: DemoParticipant) => Promise.resolve({ ...existing, ...patch })
    );
    ensureReferralIssuance.mockResolvedValue({
      created: false,
      code: 'APEX20',
      referralUrl: 'https://example.test/r/APEX20',
    });

    const result = await updateReferralManagementPromoterServices({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      serviceIds: [SERVICE, SERVICE_B],
    });

    expect(updatePilotParticipantPayload).toHaveBeenCalled();
    const firstPatch = updatePilotParticipantPayload.mock.calls[0][2] as DemoParticipant;
    expect(firstPatch.compensationProfile?.commissionServiceIds).toEqual([SERVICE, SERVICE_B]);
    expect(firstPatch.referralCommerce?.enabledServiceIds).toEqual([SERVICE, SERVICE_B]);
    expect(ensureReferralIssuance).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceParticipantId: 'p-apex',
        referralCommerce: expect.objectContaining({
          enabledServiceIds: [SERVICE, SERVICE_B],
        }),
      })
    );
    expect(result.context).toBeTruthy();
  });

  it('does not create a promoter when zero services are selected', async () => {
    await expect(
      addReferralManagementPromoter({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        name: 'Apex Promotions',
        email: 'apex@example.com',
        role: 'Promoter',
        compensation: { kind: 'revenue_share', percentage: 20, serviceIds: [] },
      })
    ).rejects.toMatchObject({ status: 422, name: 'ReferralManagementError' });
    expect(createPilotParticipantForUser).not.toHaveBeenCalled();
  });

  it('does not issue a selected-mode referral when the promoter has zero services', async () => {
    await expect(
      executeCommercialParticipantAction({
        participant: promoter({
          approvalStatus: 'Approved',
          compensationProfile: {
            compensationType: 'REVENUE_SHARE',
            percentage: 20,
            configured: true,
            configuredAt: '2026-08-20T00:00:00.000Z',
            commissionSourceMode: 'selected',
            commissionServiceIds: [],
            customerAttributionEnabled: true,
            revenueSources: [],
          },
          referralCommerce: {
            commissionMode: 'project_revenue_share',
            enabledServiceIds: [],
          },
        }),
        userId: USER,
        organizationId: ORG,
        action: 'activate_referral',
      })
    ).rejects.toMatchObject({ status: 422 });
    expect(ensureReferralIssuance).not.toHaveBeenCalled();
  });

  it('replacing eligible services drops removed ids from the issued checkout config', async () => {
    const existing = promoter({
      approvalStatus: 'Approved',
      referralCode: 'APEX20',
      customerCommerceUrl: 'https://example.test/r/APEX20',
      compensationProfile: {
        compensationType: 'REVENUE_SHARE',
        percentage: 20,
        configured: true,
        configuredAt: '2026-08-20T00:00:00.000Z',
        commissionServiceIds: [SERVICE, SERVICE_B],
        commissionSourceMode: 'selected',
        customerAttributionEnabled: true,
        revenueSources: [],
      },
      referralCommerce: {
        commissionMode: 'project_revenue_share',
        enabledServiceIds: [SERVICE, SERVICE_B],
        createReferralLink: true,
      },
    });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([{ id: SERVICE, name: 'Summer Launch Party' }]);
    updatePilotParticipantPayload.mockImplementation(
      (_id: string, _user: string, patch: DemoParticipant) => Promise.resolve({ ...existing, ...patch })
    );
    ensureReferralIssuance.mockResolvedValue({
      created: false,
      code: 'APEX20',
      referralUrl: 'https://example.test/r/APEX20',
    });

    await updateReferralManagementPromoterServices({
      organizationId: ORG,
      workflowId: WF,
      userId: USER,
      participantId: 'p-apex',
      serviceIds: [SERVICE],
    });

    const persisted = updatePilotParticipantPayload.mock.calls[0][2] as DemoParticipant;
    expect(persisted.compensationProfile?.commissionServiceIds).toEqual([SERVICE]);
    expect(persisted.referralCommerce?.enabledServiceIds).toEqual([SERVICE]);
    expect(persisted.referralCommerce?.enabledServiceIds).not.toContain(SERVICE_B);
    expect(ensureReferralIssuance).toHaveBeenCalledWith(
      expect.objectContaining({
        referralCommerce: expect.objectContaining({
          enabledServiceIds: [SERVICE],
        }),
      })
    );
    const issuedIds = ensureReferralIssuance.mock.calls[0][0].referralCommerce.enabledServiceIds;
    expect(issuedIds).toEqual([SERVICE]);
    expect(issuedIds).not.toContain(SERVICE_B);
  });

  it('rejects a failed serviceIds update without writing payload or checkout config', async () => {
    const existing = promoter({
      approvalStatus: 'Approved',
      referralCode: 'APEX20',
      customerCommerceUrl: 'https://example.test/r/APEX20',
    });
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([]);

    await expect(
      updateReferralManagementPromoterServices({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        serviceIds: [],
      })
    ).rejects.toMatchObject({ status: 422, name: 'ReferralManagementError' });
    expect(updatePilotParticipantPayload).not.toHaveBeenCalled();
    expect(ensureReferralIssuance).not.toHaveBeenCalled();
  });

  it('cannot assign a service from another organization through the PATCH path', async () => {
    const existing = promoter();
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([]);

    await expect(
      updateReferralManagementPromoterServices({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        serviceIds: ['99999999-9999-9999-9999-999999999999'],
      })
    ).rejects.toMatchObject({ status: 422, name: 'ReferralManagementError' });
    expect(prisma.organization_services.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG,
          active: true,
          id: { in: ['99999999-9999-9999-9999-999999999999'] },
        }),
      })
    );
    expect(updatePilotParticipantPayload).not.toHaveBeenCalled();
    expect(ensureReferralIssuance).not.toHaveBeenCalled();
  });

  it('cannot newly assign an archived service, and does not touch historical invoices', async () => {
    const existing = promoter();
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [existing] });
    prisma.organization_services.findMany.mockResolvedValue([]);

    await expect(
      updateReferralManagementPromoterServices({
        organizationId: ORG,
        workflowId: WF,
        userId: USER,
        participantId: 'p-apex',
        serviceIds: [SERVICE],
      })
    ).rejects.toMatchObject({ status: 422, name: 'ReferralManagementError' });
    expect(prisma.organization_services.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: ORG,
          active: true,
        }),
      })
    );
    expect(updatePilotParticipantPayload).not.toHaveBeenCalled();
    expect(prisma.payment_links.update).not.toHaveBeenCalled();
    expect(prisma.payment_links.updateMany).not.toHaveBeenCalled();
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
