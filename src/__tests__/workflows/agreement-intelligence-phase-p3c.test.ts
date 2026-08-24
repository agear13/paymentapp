import {
  approveWorkflowAgreementStructure,
  retryWorkflowAgreementBootstrap,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import {
  agreementIntelligencePilotDealId,
  bootstrapAgreementIntelligenceCommercialGraph,
} from '@/lib/workflows/agreement-intelligence/bootstrap-agreement-intelligence.server';
import { referralManagementDealId } from '@/lib/workflows/referral-management/constants';
import { buildWorkflowOperationalHubSummary } from '@/lib/workflows/agreement-intelligence/operational-hub-summary.server';
import { canRetryBootstrap, isOperationalWorkflow } from '@/lib/workflows/agreement-intelligence/lifecycle';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import type { ApprovedAgreementStructure } from '@/lib/workflows/agreement-intelligence/types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organization_workflow_agreements: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    deal_network_pilot_obligations: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    organization_services: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user_organizations: {
      findUnique: jest.fn().mockResolvedValue({ id: 'mem-1' }),
    },
  },
}));

jest.mock('@/lib/ai-extractor/commercial-graph', () => ({
  buildCommercialGraph: jest.fn((result: ExtractionResult) => ({
    schemaVersion: 'v5',
    commercialStructure: {
      participantCount: result.parties.length,
      settlementBlockers: [],
    },
    participantCards: [],
  })),
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn(),
  syncPilotSnapshotForUser: jest.fn(),
}));

jest.mock('@/lib/onboarding/refresh-onboarding-project-obligations.server', () => ({
  refreshProjectObligationsAfterParticipantPersist: jest.fn(),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { getPilotSnapshotForUser, syncPilotSnapshotForUser } = jest.requireMock(
  '@/lib/deal-network-demo/pilot-snapshot.server'
);
const { refreshProjectObligationsAfterParticipantPersist } = jest.requireMock(
  '@/lib/onboarding/refresh-onboarding-project-obligations.server'
);

const ORG_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF_ID = 'wf-11111111-1111-1111-1111-111111111111';
const AGREEMENT_ID = 'agr-22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-1';
const PILOT_DEAL_ID = agreementIntelligencePilotDealId(WF_ID);

function workflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WF_ID,
    organization_id: ORG_A,
    template_slug: 'agreement-intelligence',
    template_version: '1.0.0',
    status: 'DEPLOYED',
    lifecycle_status: 'READY_FOR_REVIEW',
    configuration: {
      defaultSettlementCurrency: 'AUD',
      operatorApprovalRequired: true,
    },
    deployed_at: new Date('2026-08-17T10:00:00Z'),
    paused_at: null,
    created_at: new Date('2026-08-17T10:00:00Z'),
    updated_at: new Date('2026-08-17T10:00:00Z'),
    agreement: null,
    ...overrides,
  };
}

function agreementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AGREEMENT_ID,
    organization_id: ORG_A,
    organization_workflow_id: WF_ID,
    source_type: 'PASTE',
    title: 'Festival Revenue Share Agreement',
    original_filename: null,
    mime_type: null,
    file_size_bytes: null,
    storage_key: null,
    source_text: 'Venue pays Promoter 20%. Promoter pays DJ 10%. Settlement every Friday.',
    extraction_status: 'READY_FOR_REVIEW',
    extraction_result: sampleExtraction(),
    commercial_graph: null,
    approved_structure: null,
    extraction_error: null,
    extracted_at: new Date('2026-08-17T10:30:00Z'),
    approved_at: null,
    approved_by_user_id: null,
    pilot_deal_id: null,
    bootstrap_error: null,
    bootstrapped_at: null,
    created_at: new Date('2026-08-17T10:00:00Z'),
    updated_at: new Date('2026-08-17T10:00:00Z'),
    ...overrides,
  };
}

function sampleExtraction(): ExtractionResult {
  return {
    projectName: { value: 'Festival Revenue Share Agreement', confidence: 'high' },
    projectDescription: { value: null, confidence: 'absent' },
    projectValue: { value: null, confidence: 'absent' },
    currency: { value: 'AUD', confidence: 'medium' },
    counterparty: { value: null, confidence: 'absent' },
    parties: [
      {
        id: 'p1',
        name: { value: 'Venue', confidence: 'high' },
        email: { value: null, confidence: 'absent' },
        role: { value: 'Partner', confidence: 'high' },
        participationModel: { value: 'fixed_payout', confidence: 'medium' },
        fixedAmount: { value: null, confidence: 'absent' },
        revenueSharePct: { value: null, confidence: 'absent' },
        deliverables: [],
        conditionalPayments: [],
        milestones: [],
        serviceCategories: { value: [], confidence: 'absent' },
        conditions: [],
        dependencies: [],
        notes: { value: null, confidence: 'absent' },
      },
      {
        id: 'p2',
        name: { value: 'Promoter', confidence: 'high' },
        email: { value: null, confidence: 'absent' },
        role: { value: 'Referrer', confidence: 'high' },
        participationModel: { value: 'revenue_share', confidence: 'high' },
        fixedAmount: { value: null, confidence: 'absent' },
        revenueSharePct: { value: 20, confidence: 'high' },
        deliverables: [],
        conditionalPayments: [],
        milestones: [],
        serviceCategories: { value: [], confidence: 'absent' },
        conditions: [],
        dependencies: [],
        notes: { value: null, confidence: 'absent' },
      },
      {
        id: 'p3',
        name: { value: 'DJ', confidence: 'high' },
        email: { value: null, confidence: 'absent' },
        role: { value: 'Contractor', confidence: 'high' },
        participationModel: { value: 'revenue_share', confidence: 'high' },
        fixedAmount: { value: null, confidence: 'absent' },
        revenueSharePct: { value: 10, confidence: 'high' },
        deliverables: [],
        conditionalPayments: [],
        milestones: [],
        serviceCategories: { value: [], confidence: 'absent' },
        conditions: [],
        dependencies: [],
        notes: { value: null, confidence: 'absent' },
      },
    ],
    paymentTerms: [
      {
        description: { value: 'Settlement', confidence: 'high' },
        amount: { value: null, confidence: 'absent' },
        currency: { value: 'AUD', confidence: 'medium' },
        dueCondition: { value: 'Every Friday', confidence: 'high' },
      },
    ],
    settlementRules: [
      {
        trigger: { value: 'Every Friday', confidence: 'high' },
        basis: { value: 'Weekly settlement', confidence: 'medium' },
      },
    ],
    settlementEvents: [],
    uncertainties: [],
    overallConfidence: 'medium',
    sourceHint: null,
    extractedAt: new Date().toISOString(),
    schemaVersion: 'v5',
  };
}

function sampleReviewForm(): ReviewFormState {
  return {
    entryPoint: 'workflow_agreement',
    existingDealId: undefined,
    sourceType: 'other',
    projectName: 'Festival Revenue Share Agreement',
    projectDescription: '',
    projectValue: null,
    currency: 'AUD',
    counterparty: '',
    parties: [
      {
        id: 'p1',
        name: 'Venue',
        email: '',
        role: 'Partner',
        participationModel: 'fixed_payout',
        fixedAmount: null,
        revenueSharePct: null,
        deliverables: [],
        milestones: [],
        notes: '',
      },
      {
        id: 'p2',
        name: 'Promoter',
        email: '',
        role: 'Referrer',
        participationModel: 'revenue_share',
        fixedAmount: null,
        revenueSharePct: 20,
        deliverables: [],
        milestones: [],
        notes: '',
      },
      {
        id: 'p3',
        name: 'DJ',
        email: '',
        role: 'Contractor',
        participationModel: 'revenue_share',
        fixedAmount: null,
        revenueSharePct: 10,
        deliverables: [],
        milestones: [],
        notes: '',
      },
    ],
    duplicateResolutions: {},
    extractedCurrencyCode: 'AUD',
    extractedCurrencyUnsupported: false,
    currencyConfidence: 'medium',
  };
}

function approvedStructure(): ApprovedAgreementStructure {
  const extractionResult = sampleExtraction();
  return {
    reviewForm: sampleReviewForm(),
    extractionResult,
    commercialGraph: {
      schemaVersion: 'v5',
      commercialStructure: { participantCount: 3, settlementBlockers: [] },
      participantCards: [],
    },
    approvedAt: new Date().toISOString(),
    approvedByUserId: USER_ID,
  };
}

function compensatedPilotParticipants() {
  return [
    { id: 'p1', dealId: PILOT_DEAL_ID, name: 'Venue', role: 'Partner' },
    {
      id: 'p2',
      dealId: PILOT_DEAL_ID,
      name: 'Promoter',
      role: 'Referrer',
      approvalStatus: 'Pending approval',
      onboardingStatus: 'NOT_STARTED',
      commissionKind: 'pct_deal_value',
      commissionValue: 20,
      compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 20 },
    },
    {
      id: 'p3',
      dealId: PILOT_DEAL_ID,
      name: 'DJ',
      role: 'Contractor',
      approvalStatus: 'Pending approval',
      onboardingStatus: 'NOT_STARTED',
      commissionKind: 'pct_deal_value',
      commissionValue: 10,
      compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 10 },
    },
  ];
}

describe('Phase P3-C — Agreement Intelligence commercial bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPilotSnapshotForUser.mockResolvedValue({ deals: [], participants: [] });
    syncPilotSnapshotForUser.mockResolvedValue(undefined);
    refreshProjectObligationsAfterParticipantPersist.mockResolvedValue(undefined);
    prisma.user_organizations.findUnique.mockResolvedValue({ id: 'mem-1' });
    prisma.deal_network_pilot_obligations.count.mockResolvedValue(4);
    prisma.deal_network_pilot_obligations.findMany.mockResolvedValue([
      { id: 'ob-1', obligation_type: 'PARTICIPANT', amount_owed: 0, currency: 'AUD', status: 'DRAFT' },
    ]);
    prisma.organization_workflows.findUnique.mockResolvedValue(null);
    prisma.organization_workflows.findMany.mockResolvedValue([]);
  });

  it('uses stable pilot deal id derived from workflow instance', () => {
    expect(agreementIntelligencePilotDealId(WF_ID)).toBe(`aiwf-${WF_ID}`);
  });

  it('approval bootstraps pilot graph and transitions to PARTICIPANT_SETUP when setup is required', async () => {
    const extraction = sampleExtraction();
    prisma.organization_workflows.findFirst
      .mockResolvedValueOnce(
        workflowRow({
          agreement: agreementRow({ extraction_result: extraction }),
        })
      )
      .mockResolvedValueOnce(
        workflowRow({
          lifecycle_status: 'PARTICIPANT_SETUP',
          agreement: agreementRow({
            extraction_status: 'APPROVED',
            extraction_result: extraction,
            pilot_deal_id: PILOT_DEAL_ID,
            bootstrapped_at: new Date('2026-08-17T11:00:00Z'),
          }),
        })
      );
    prisma.organization_workflow_agreements.update.mockResolvedValue(agreementRow());
    prisma.organization_workflows.update.mockResolvedValue({});
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: compensatedPilotParticipants(),
    });

    const context = await approveWorkflowAgreementStructure({
      organizationId: ORG_A,
      workflowId: WF_ID,
      userId: USER_ID,
      reviewForm: sampleReviewForm(),
      extractionResult: extraction,
    });

    expect(syncPilotSnapshotForUser).toHaveBeenCalled();
    expect(refreshProjectObligationsAfterParticipantPersist).toHaveBeenCalledWith(
      USER_ID,
      PILOT_DEAL_ID
    );
    expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: 'PARTICIPANT_SETUP' },
      })
    );
    expect(context.lifecycleStatus).toBe('PARTICIPANT_SETUP');
  });

  it('bootstrap failure leaves workflow in BOOTSTRAP_FAILED, not ACTIVE', async () => {
    const extraction = sampleExtraction();
    prisma.organization_workflows.findFirst
      .mockResolvedValueOnce(
        workflowRow({
          agreement: agreementRow({ extraction_result: extraction }),
        })
      )
      .mockResolvedValueOnce(
        workflowRow({
          lifecycle_status: 'BOOTSTRAP_FAILED',
          agreement: agreementRow({
            extraction_status: 'APPROVED',
            bootstrap_error: 'Sync failed',
          }),
        })
      );
    prisma.organization_workflow_agreements.update.mockResolvedValue(agreementRow());
    syncPilotSnapshotForUser.mockRejectedValue(new Error('Sync failed'));

    const context = await approveWorkflowAgreementStructure({
      organizationId: ORG_A,
      workflowId: WF_ID,
      userId: USER_ID,
      reviewForm: sampleReviewForm(),
      extractionResult: extraction,
    });

    expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: 'BOOTSTRAP_FAILED' },
      })
    );
    expect(context.lifecycleStatus).toBe('BOOTSTRAP_FAILED');
    expect(context.lifecycleStatus).not.toBe('ACTIVE');
  });

  it('retry bootstrap is idempotent for activated workflows', async () => {
    prisma.organization_workflows.findFirst
      .mockResolvedValueOnce(
        workflowRow({
          lifecycle_status: 'BOOTSTRAP_FAILED',
          agreement: agreementRow({
            extraction_status: 'APPROVED',
            approved_structure: approvedStructure(),
            pilot_deal_id: PILOT_DEAL_ID,
          }),
        })
      )
      .mockResolvedValueOnce(
        workflowRow({
          lifecycle_status: 'PARTICIPANT_SETUP',
          agreement: agreementRow({
            extraction_status: 'APPROVED',
            approved_structure: approvedStructure(),
            pilot_deal_id: PILOT_DEAL_ID,
            bootstrapped_at: new Date('2026-08-17T11:30:00Z'),
          }),
        })
      );
    prisma.organization_workflows.update.mockResolvedValue({});
    prisma.organization_workflow_agreements.update.mockResolvedValue(agreementRow());
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: compensatedPilotParticipants(),
    });

    await retryWorkflowAgreementBootstrap({
      organizationId: ORG_A,
      workflowId: WF_ID,
      userId: USER_ID,
    });

    expect(syncPilotSnapshotForUser).toHaveBeenCalledTimes(1);
    expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: 'PARTICIPANT_SETUP' },
      })
    );
  });

  it('operational hub summary exposes participants and settlement when ACTIVE', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [
        {
          id: 'p2',
          dealId: PILOT_DEAL_ID,
          name: 'Promoter',
          role: 'Referrer',
          approvalStatus: 'Pending approval',
          compensationProfile: {
            compensationType: 'REVENUE_SHARE',
            percentage: 20,
          },
        },
      ],
    });

    const summary = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'ACTIVE',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
    });

    expect(summary.isOperational).toBe(true);
    expect(summary.participantCount).toBe(1);
    expect(summary.participants[0]?.name).toBe('Promoter');
    expect(summary.obligations.some((row) => row.label.includes('Promoter revenue share'))).toBe(
      true
    );
    expect(summary.obligations.some((row) => /settlement schedule/i.test(row.label))).toBe(
      false
    );
    expect(summary.settlementSchedule).toBe('Every Friday');
  });

  it('lifecycle helpers distinguish operational and retryable states', () => {
    expect(isOperationalWorkflow('ACTIVE')).toBe(true);
    expect(isOperationalWorkflow('BOOTSTRAP_FAILED')).toBe(false);
    expect(canRetryBootstrap('BOOTSTRAP_FAILED')).toBe(true);
    expect(canRetryBootstrap('READY_FOR_REVIEW')).toBe(false);
  });

  it('bootstrap merges into existing snapshot without replacing unrelated deals', async () => {
    getPilotSnapshotForUser
      .mockResolvedValueOnce({
        deals: [{ id: 'other-deal', name: 'Other' }],
        participants: [{ id: 'other-p', dealId: 'other-deal', name: 'Other' }],
      })
      .mockResolvedValueOnce({
        deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
        participants: compensatedPilotParticipants().slice(1),
      });

    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: USER_ID,
      organizationWorkflowId: WF_ID,
      approvedStructure: approvedStructure(),
    });

    const syncCall = syncPilotSnapshotForUser.mock.calls[0];
    expect(syncCall?.[1].some((deal: { id: string }) => deal.id === 'other-deal')).toBe(true);
    expect(syncCall?.[1].some((deal: { id: string }) => deal.id === PILOT_DEAL_ID)).toBe(true);
  });

  it('reuses an existing Referral Management promoter by exact org-scoped email', async () => {
    const rmWorkflowId = 'wf-rm-33333333-3333-3333-3333-333333333333';
    const rmDealId = referralManagementDealId(rmWorkflowId);
    const existingId = 'rm-apex-existing';
    const structure = approvedStructure();
    structure.reviewForm.parties[1] = {
      ...structure.reviewForm.parties[1],
      name: 'Apex Promotions',
      email: '  Apex@Example.com ',
    };
    structure.extractionResult.parties[1] = {
      ...structure.extractionResult.parties[1],
      name: { value: 'Apex Promotions', confidence: 'high' },
      email: { value: 'apex@example.com', confidence: 'high' },
    };

    prisma.organization_workflows.findUnique.mockResolvedValue({
      id: WF_ID,
      organization_id: ORG_A,
    });
    prisma.organization_workflows.findMany.mockResolvedValue([{ id: WF_ID }, { id: rmWorkflowId }]);
    getPilotSnapshotForUser
      .mockResolvedValueOnce({
        deals: [{ id: rmDealId, name: 'Referral Management' }],
        participants: [
          {
            id: existingId,
            dealId: rmDealId,
            name: 'Apex Promotions',
            email: 'apex@example.com',
            role: 'Promoter',
            inviteToken: 'invite-existing',
            referralCode: 'APEX20',
            customerCommerceUrl: 'https://example.test/r/APEX20',
            commissionKind: 'pct_deal_value',
            commissionValue: 20,
            compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 20 },
          },
        ],
      })
      .mockResolvedValueOnce({
        deals: [{ id: PILOT_DEAL_ID }],
        participants: [{ id: existingId, dealId: PILOT_DEAL_ID, email: 'apex@example.com' }],
      });

    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: USER_ID,
      organizationWorkflowId: WF_ID,
      approvedStructure: structure,
    });

    const syncedParticipants = syncPilotSnapshotForUser.mock.calls[0]?.[2] as Array<{
      id: string;
      dealId?: string;
      email?: string;
      referralCode?: string;
      customerCommerceUrl?: string;
    }>;
    const apexRows = syncedParticipants.filter(
      (row) => row.email?.trim().toLowerCase() === 'apex@example.com'
    );
    expect(apexRows).toHaveLength(1);
    expect(apexRows[0]?.id).toBe(existingId);
    expect(apexRows[0]?.dealId).toBe(PILOT_DEAL_ID);
    expect(apexRows[0]?.referralCode).toBe('APEX20');
    expect(apexRows[0]?.customerCommerceUrl).toBe('https://example.test/r/APEX20');
    expect(syncedParticipants.filter((row) => row.id === existingId)).toHaveLength(1);
  });

  it('does not merge compensated participants by name alone', async () => {
    const rmDealId = referralManagementDealId('wf-rm-other');
    const structure = approvedStructure();
    structure.reviewForm.parties[1] = {
      ...structure.reviewForm.parties[1],
      name: 'Apex Promotions',
      email: 'apex@example.com',
    };

    prisma.organization_workflows.findUnique.mockResolvedValue({
      id: WF_ID,
      organization_id: ORG_A,
    });
    prisma.organization_workflows.findMany.mockResolvedValue([
      { id: WF_ID },
      { id: 'wf-rm-other' },
    ]);
    getPilotSnapshotForUser
      .mockResolvedValueOnce({
        deals: [{ id: rmDealId }],
        participants: [
          {
            id: 'rm-same-name',
            dealId: rmDealId,
            name: 'Apex Promotions',
            email: 'different@example.com',
            role: 'Promoter',
            commissionKind: 'pct_deal_value',
            commissionValue: 20,
            compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 20 },
          },
        ],
      })
      .mockResolvedValueOnce({ deals: [{ id: PILOT_DEAL_ID }], participants: [] });

    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: USER_ID,
      organizationWorkflowId: WF_ID,
      approvedStructure: structure,
    });

    const syncedParticipants = syncPilotSnapshotForUser.mock.calls[0]?.[2] as Array<{
      id: string;
      email?: string;
    }>;
    expect(syncedParticipants.some((row) => row.id === 'rm-same-name')).toBe(true);
    expect(
      syncedParticipants.filter((row) => row.email?.trim().toLowerCase() === 'apex@example.com')
    ).toHaveLength(1);
    expect(syncedParticipants.find((row) => row.email === 'apex@example.com')?.id).not.toBe(
      'rm-same-name'
    );
  });

  it('stamps the workflow organization on newly created bootstrap participants', async () => {
    prisma.organization_workflows.findUnique.mockResolvedValue({
      id: WF_ID,
      organization_id: ORG_A,
    });
    prisma.organization_workflows.findMany.mockResolvedValue([{ id: WF_ID }]);
    prisma.user_organizations.findUnique.mockResolvedValue({ id: 'mem-1' });

    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: USER_ID,
      organizationWorkflowId: WF_ID,
      approvedStructure: approvedStructure(),
    });

    const stamp = syncPilotSnapshotForUser.mock.calls[0]?.[3] as {
      sourceOrganizationIdForNewIds?: { organizationId: string; participantIds: Set<string> };
    };
    expect(stamp?.sourceOrganizationIdForNewIds?.organizationId).toBe(ORG_A);
    expect(stamp?.sourceOrganizationIdForNewIds?.participantIds.size).toBeGreaterThan(0);
  });

  it('does not backfill source organization on reused participant rows', async () => {
    const rmWorkflowId = 'wf-rm-33333333-3333-3333-3333-333333333333';
    const rmDealId = referralManagementDealId(rmWorkflowId);
    const existingId = 'rm-apex-existing';
    const structure = approvedStructure();
    structure.reviewForm.parties[1] = {
      ...structure.reviewForm.parties[1],
      name: 'Apex Promotions',
      email: 'apex@example.com',
    };
    structure.extractionResult.parties[1] = {
      ...structure.extractionResult.parties[1],
      name: { value: 'Apex Promotions', confidence: 'high' },
      email: { value: 'apex@example.com', confidence: 'high' },
    };

    prisma.organization_workflows.findUnique.mockResolvedValue({
      id: WF_ID,
      organization_id: ORG_A,
    });
    prisma.organization_workflows.findMany.mockResolvedValue([{ id: WF_ID }, { id: rmWorkflowId }]);
    getPilotSnapshotForUser
      .mockResolvedValueOnce({
        deals: [{ id: rmDealId, name: 'Referral Management' }],
        participants: [
          {
            id: existingId,
            dealId: rmDealId,
            name: 'Apex Promotions',
            email: 'apex@example.com',
            role: 'Promoter',
            inviteToken: 'invite-existing',
            referralCode: 'APEX20',
            commissionKind: 'pct_deal_value',
            commissionValue: 20,
            compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 20 },
          },
        ],
      })
      .mockResolvedValueOnce({
        deals: [{ id: PILOT_DEAL_ID }],
        participants: [{ id: existingId, dealId: PILOT_DEAL_ID }],
      });

    await bootstrapAgreementIntelligenceCommercialGraph({
      userId: USER_ID,
      organizationWorkflowId: WF_ID,
      approvedStructure: structure,
    });

    const stamp = syncPilotSnapshotForUser.mock.calls[0]?.[3] as {
      sourceOrganizationIdForNewIds?: { organizationId: string; participantIds: Set<string> };
    };
    expect(stamp?.sourceOrganizationIdForNewIds?.participantIds.has(existingId)).toBe(false);
  });
});
