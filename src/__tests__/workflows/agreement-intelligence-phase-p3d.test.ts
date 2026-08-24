import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  refreshWorkflowActivation,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import {
  agreementIntelligencePilotDealId,
} from '@/lib/workflows/agreement-intelligence/bootstrap-agreement-intelligence.server';
import {
  buildNeedsAttention,
  buildOperationalActions,
  buildOperationalObligations,
  buildOperationalParticipants,
  buildSettlementSummary,
  buildUpcomingActions,
  buildWorkflowActivity,
  isOperationalCoordinationBlocked,
} from '@/lib/workflows/agreement-intelligence/operational-hub-coordination.server';
import { buildWorkflowOperationalHubSummary } from '@/lib/workflows/agreement-intelligence/operational-hub-summary.server';
import {
  canRetryBootstrap,
  isOperationalWorkflow,
  showsOperationalHub,
} from '@/lib/workflows/agreement-intelligence/lifecycle';
import {
  filterCompensatedParticipants,
  isParticipantSetupComplete,
  participantSetupStatusLabel,
  resolvePostBootstrapLifecycle,
  workflowRequiresParticipantSetup,
} from '@/lib/workflows/agreement-intelligence/participant-setup.server';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import type { ApprovedAgreementStructure } from '@/lib/workflows/agreement-intelligence/types';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WF_ID = 'wf-11111111-1111-1111-1111-111111111111';
const AGREEMENT_ID = 'agr-22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-1';
const PILOT_DEAL_ID = agreementIntelligencePilotDealId(AGREEMENT_ID);

function compensatedParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-apex',
    name: 'Apex Promotions',
    email: 'promoter@example.com',
    role: 'Introducer',
    dealId: PILOT_DEAL_ID,
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

function reviewForm(): ReviewFormState {
  return {
    projectName: 'Festival Revenue Share Agreement',
    sourceType: 'paste',
    parties: [
      {
        id: 'ep-venue',
        name: 'Venue Co',
        role: 'Venue',
        email: '',
        revenueSharePct: null,
        participationModel: 'revenue_share',
      },
      {
        id: 'ep-1',
        name: 'Apex Promotions',
        role: 'Promoter',
        email: '',
        revenueSharePct: 20,
        participationModel: 'revenue_share',
      },
      {
        id: 'ep-2',
        name: 'DJ Nova',
        role: 'DJ',
        email: '',
        revenueSharePct: 10,
        participationModel: 'revenue_share',
      },
    ],
    settlementRules: [],
    paymentTerms: [],
  };
}

describe('Agreement Intelligence P3-D activation and participant setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.deal_network_pilot_obligations.findMany.mockResolvedValue([]);
  });

  it('requires participant setup when compensated participants are pending approval', () => {
    const participants = [compensatedParticipant(), compensatedParticipant({ id: 'p-dj', name: 'DJ Nova' })];
    expect(
      workflowRequiresParticipantSetup({
        compensatedParticipants: participants,
        operatorApprovalRequired: true,
      })
    ).toBe(true);
    expect(resolvePostBootstrapLifecycle({ compensatedParticipants: participants, operatorApprovalRequired: true })).toBe(
      'PARTICIPANT_SETUP'
    );
  });

  it('moves directly to ACTIVE when no compensated participants require setup', () => {
    const participants = [
      compensatedParticipant({
        approvalStatus: 'Approved',
        approvedAt: '2026-08-18T08:00:00.000Z',
        onboardingStatus: 'COMPLETE',
      }),
    ];
    expect(
      workflowRequiresParticipantSetup({
        compensatedParticipants: participants,
        operatorApprovalRequired: false,
      })
    ).toBe(false);
    expect(resolvePostBootstrapLifecycle({ compensatedParticipants: participants, operatorApprovalRequired: false })).toBe(
      'ACTIVE'
    );
  });

  it('skips approval gate when operator approval is not required', () => {
    const participants = [compensatedParticipant({ approvalStatus: 'Pending approval', onboardingStatus: 'COMPLETE' })];
    expect(
      isParticipantSetupComplete({
        compensatedParticipants: participants,
        operatorApprovalRequired: false,
      })
    ).toBe(true);
  });

  it('shows operational hub during PARTICIPANT_SETUP and only marks ACTIVE as fully operational', () => {
    expect(showsOperationalHub('PARTICIPANT_SETUP')).toBe(true);
    expect(isOperationalWorkflow('PARTICIPANT_SETUP')).toBe(false);
    expect(isOperationalWorkflow('ACTIVE')).toBe(true);
  });

  it('builds ACTIVE hub summary with obligations and separated settlement', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday following each event weekend' }],
      participants: [
        compensatedParticipant(),
        compensatedParticipant({
          id: 'p-dj',
          name: 'DJ Nova',
          role: 'Contributor',
          commissionValue: 10,
          compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 10 },
        }),
      ],
    });

    const summary = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'PARTICIPANT_SETUP',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday following each event weekend',
      operatorApprovalRequired: true,
      reviewForm: reviewForm(),
      agreementMeta: {
        createdAt: '2026-08-18T08:00:00.000Z',
        extractedAt: '2026-08-18T08:05:00.000Z',
        approvedAt: '2026-08-18T08:10:00.000Z',
        bootstrappedAt: '2026-08-18T08:11:00.000Z',
        sourceType: 'PASTE',
      },
    });

    expect(summary.isActivationComplete).toBe(false);
    expect(summary.participants.some((row) => row.statusLabel === 'Awaiting approval')).toBe(true);
    expect(summary.obligations).toHaveLength(2);
    expect(summary.settlement.schedule).toMatch(/Friday/i);
    expect(summary.actions.some((row) => row.disposition === 'REQUIRES_APPROVAL')).toBe(true);
    expect(summary.activity.some((row) => row.label === 'Commercial graph activated')).toBe(true);
  });

  it('preserves contractual party vs compensated participant distinction', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [compensatedParticipant()],
    });

    const summary = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'PARTICIPANT_SETUP',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      operatorApprovalRequired: true,
      reviewForm: reviewForm(),
    });

    expect(summary.contractualPartyCount).toBe(2);
    expect(summary.compensatedParticipantCount).toBe(1);
    expect(summary.participants.find((row) => row.name === 'Venue Co')?.partyKind).toBe('contractual_party');
  });

  it('does not expose payment execution in operational actions', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [compensatedParticipant()],
    });

    const summary = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'PARTICIPANT_SETUP',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      reviewForm: reviewForm(),
    });

    const serialized = JSON.stringify(summary.actions);
    expect(serialized).not.toMatch(/release payout|execute payment|send money|create invoice/i);
  });

  it('rejects cross-organization refresh activation access', async () => {
    prisma.organization_workflows.findFirst.mockResolvedValue(null);
    await expect(
      refreshWorkflowActivation({
        organizationId: ORG_B,
        workflowId: WF_ID,
        userId: USER_ID,
      })
    ).rejects.toThrow();
  });

  it('surfaces invite and review actions for pending participant approval', () => {
    const participants = buildOperationalParticipants({
      reviewForm: reviewForm(),
      pilotParticipants: [compensatedParticipant()],
      pilotDealId: PILOT_DEAL_ID,
      commercialGraph: null,
      operatorApprovalRequired: true,
    });
    const obligations = buildOperationalObligations({
      participants: [compensatedParticipant()],
      obligationRows: [],
      settlementCadence: 'Every Friday',
      agreementOwner: 'Venue Co',
    });
    const settlement = buildSettlementSummary({
      schedule: 'Every Friday',
      operatorApprovalRequired: true,
    });
    const actions = buildOperationalActions({
      participants,
      obligations,
      settlement,
      operatorApprovalRequired: true,
    });

    expect(actions.some((row) => row.label.includes('Send approval request for Apex Promotions'))).toBe(true);
    expect(actions.every((row) => row.disposition !== 'READY' || !/payment|payout|invoice/i.test(row.label))).toBe(
      true
    );
  });

  it('marks participant setup complete after approval and onboarding completion', () => {
    const ready = compensatedParticipant({
      approvalStatus: 'Approved',
      approvedAt: '2026-08-18T08:12:00.000Z',
      onboardingStatus: 'COMPLETE',
      agreementSharedAt: '2026-08-18T08:08:00.000Z',
    });
    expect(participantSetupStatusLabel(ready, true)).toBe('Ready');
    expect(
      isParticipantSetupComplete({
        compensatedParticipants: [ready],
        operatorApprovalRequired: true,
      })
    ).toBe(true);
  });

  it('refresh activation advances PARTICIPANT_SETUP to ACTIVE when setup is complete', async () => {
    const agreementRecord = {
      id: AGREEMENT_ID,
      organization_id: ORG_A,
      organization_workflow_id: WF_ID,
      source_type: 'PASTE',
      title: 'Festival Revenue Share Agreement',
      pilot_deal_id: PILOT_DEAL_ID,
      bootstrapped_at: new Date('2026-08-18T08:11:00.000Z'),
      approved_structure: null,
      extraction_result: null,
      commercial_graph: null,
      created_at: new Date('2026-08-18T08:00:00.000Z'),
      updated_at: new Date('2026-08-18T08:11:00.000Z'),
    };

    prisma.organization_workflows.findFirst
      .mockResolvedValueOnce({
        id: WF_ID,
        organization_id: ORG_A,
        template_slug: 'agreement-intelligence',
        lifecycle_status: 'PARTICIPANT_SETUP',
        configuration: { defaultSettlementCurrency: 'AUD', operatorApprovalRequired: true },
        agreement: agreementRecord,
      })
      .mockResolvedValueOnce({
        id: WF_ID,
        organization_id: ORG_A,
        template_slug: 'agreement-intelligence',
        lifecycle_status: 'ACTIVE',
        configuration: { defaultSettlementCurrency: 'AUD', operatorApprovalRequired: true },
        agreement: agreementRecord,
      });
    prisma.organization_workflows.update.mockResolvedValue({});
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [
        compensatedParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2026-08-18T08:12:00.000Z',
          onboardingStatus: 'COMPLETE',
        }),
      ],
    });

    const context = await refreshWorkflowActivation({
      organizationId: ORG_A,
      workflowId: WF_ID,
      userId: USER_ID,
    });

    expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: 'ACTIVE' },
      })
    );
    expect(context.lifecycleStatus).toBe('ACTIVE');
  });

  it('builds fully operational ACTIVE hub summary when activation is complete', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [
        compensatedParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2026-08-18T08:12:00.000Z',
          onboardingStatus: 'COMPLETE',
        }),
      ],
    });

    const summary = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'ACTIVE',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      operatorApprovalRequired: true,
      reviewForm: reviewForm(),
    });

    expect(summary.isActivationComplete).toBe(true);
    expect(summary.isOperational).toBe(true);
    expect(summary.obligations[0]?.status).toBe('Active');
    expect(summary.settlement.nextSettlementLabel).toBeNull();
    expect(summary.needsAttention.some((row) => row.label.includes('Funding required'))).toBe(true);
  });

  it('derives needs attention and upcoming actions from persisted participant state', () => {
    const participants = buildOperationalParticipants({
      reviewForm: reviewForm(),
      pilotParticipants: [
        compensatedParticipant(),
        compensatedParticipant({ id: 'p-dj', name: 'DJ Nova', approvalStatus: 'Approved', onboardingStatus: 'INCOMPLETE' }),
      ],
      pilotDealId: PILOT_DEAL_ID,
      commercialGraph: null,
      operatorApprovalRequired: true,
    });
    const obligations = buildOperationalObligations({
      participants: [compensatedParticipant()],
      obligationRows: [],
      settlementCadence: 'Every Friday',
      agreementOwner: 'Venue Co',
    });
    const settlement = buildSettlementSummary({
      schedule: 'Every Friday',
      operatorApprovalRequired: true,
    });

    const needsAttention = buildNeedsAttention({
      participants,
      obligations,
      settlement,
      operatorApprovalRequired: true,
    });
    const upcomingActions = buildUpcomingActions({ participants, settlement });

    expect(needsAttention.some((row) => row.label.includes('Apex Promotions — approval required'))).toBe(
      true
    );
    expect(needsAttention.some((row) => row.label.includes('DJ Nova — onboarding incomplete'))).toBe(
      true
    );
    expect(upcomingActions.some((row) => row.label.includes('Review Apex Promotions approval'))).toBe(
      true
    );
    expect(upcomingActions.some((row) => row.label.includes('Review upcoming settlement'))).toBe(true);
  });

  it('builds activity timeline from agreement milestones and participant audit events', () => {
    const activity = buildWorkflowActivity({
      agreementTitle: 'Festival Revenue Share Agreement',
      createdAt: '2026-08-18T08:00:00.000Z',
      extractedAt: '2026-08-18T08:05:00.000Z',
      approvedAt: '2026-08-18T08:10:00.000Z',
      bootstrappedAt: '2026-08-18T08:11:00.000Z',
      sourceType: 'PASTE',
      pilotParticipants: [
        compensatedParticipant({
          approvalStatus: 'Approved',
          approvedAt: '2026-08-18T08:12:00.000Z',
        }),
      ],
      pilotDealId: PILOT_DEAL_ID,
    });

    expect(activity.some((row) => row.label === 'Agreement pasted')).toBe(true);
    expect(activity.some((row) => row.label === 'Commercial graph activated')).toBe(true);
    expect(activity.some((row) => row.label.toLowerCase().includes('approved'))).toBe(true);
  });

  it('blocks coordination actions when workflow deployment is paused', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [compensatedParticipant()],
    });

    const paused = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'ACTIVE',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      reviewForm: reviewForm(),
      workflowDeploymentStatus: 'PAUSED',
    });
    const resumed = await buildWorkflowOperationalHubSummary({
      userId: USER_ID,
      lifecycleStatus: 'ACTIVE',
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      reviewForm: reviewForm(),
      workflowDeploymentStatus: 'DEPLOYED',
    });

    expect(isOperationalCoordinationBlocked('PAUSED')).toBe(true);
    expect(paused.coordinationBlocked).toBe(true);
    expect(paused.actions).toHaveLength(0);
    expect(paused.upcomingActions[0]?.label).toMatch(/paused/i);
    expect(paused.participants.length).toBeGreaterThan(0);
    expect(resumed.coordinationBlocked).toBe(false);
    expect(resumed.actions.length).toBeGreaterThan(0);
  });

  it('does not duplicate participants or obligations on repeated hub refresh', async () => {
    getPilotSnapshotForUser.mockResolvedValue({
      deals: [{ id: PILOT_DEAL_ID, payoutTrigger: 'Every Friday' }],
      participants: [
        compensatedParticipant({ approvalStatus: 'Approved', onboardingStatus: 'COMPLETE' }),
        compensatedParticipant({
          id: 'p-dj',
          name: 'DJ Nova',
          approvalStatus: 'Approved',
          onboardingStatus: 'COMPLETE',
          commissionValue: 10,
          compensationProfile: { compensationType: 'REVENUE_SHARE', percentage: 10 },
        }),
      ],
    });

    const input = {
      userId: USER_ID,
      lifecycleStatus: 'ACTIVE' as const,
      pilotDealId: PILOT_DEAL_ID,
      agreementTitle: 'Festival Revenue Share Agreement',
      extractionSettlement: 'Every Friday',
      reviewForm: reviewForm(),
    };

    const first = await buildWorkflowOperationalHubSummary(input);
    const second = await buildWorkflowOperationalHubSummary(input);

    expect(first.participantCount).toBe(second.participantCount);
    expect(first.obligationCount).toBe(second.obligationCount);
    expect(first.participants.map((row) => row.name)).toEqual(second.participants.map((row) => row.name));
  });
});

describe('Agreement Intelligence P3-D service integration hooks', () => {
  it('exports participant setup helpers for compensated participant filtering', () => {
    expect(filterCompensatedParticipants([compensatedParticipant()])).toHaveLength(1);
  });

  it('keeps bootstrap retry available from PARTICIPANT_SETUP', () => {
    expect(canRetryBootstrap('BOOTSTRAP_FAILED')).toBe(true);
    expect(canRetryBootstrap('PARTICIPANT_SETUP')).toBe(false);
  });
});
