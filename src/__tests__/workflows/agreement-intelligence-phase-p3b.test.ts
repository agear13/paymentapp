import {
  buildWorkflowAgreementHubSummary,
} from '@/lib/workflows/agreement-intelligence/hub-summary';
import {
  approveWorkflowAgreementStructure,
  getWorkflowAgreementContext,
  runWorkflowAgreementExtraction,
  submitPastedAgreement,
} from '@/lib/workflows/agreement-intelligence/agreement-service.server';
import { WorkflowAgreementError } from '@/lib/workflows/agreement-intelligence/types';
import { deployWorkflowToOrganization } from '@/lib/workflows/deploy-workflow';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

jest.mock('@/lib/server/prisma', () => {
  const prisma = {
    organization_workflows: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization_workflow_agreements: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    deal_network_pilot_obligations: {
      count: jest.fn().mockResolvedValue(0),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return { prisma };
});

jest.mock('@/lib/entitlements/resolve-context.server', () => ({
  resolveEntitlementContext: jest.fn().mockResolvedValue({
    organizationId: 'org-a',
    userId: 'user-1',
    pilotBypass: true,
    plan: 'professional',
    status: 'active',
    usage: { aiImportCount: 0, agreementCount: 0, teamMemberCount: 1, workspaceCount: 1 },
  }),
}));

jest.mock('@/lib/entitlements/workspace-entitlements', () => ({
  evaluateFeature: jest.fn().mockReturnValue({ allowed: true }),
}));

jest.mock('@/lib/workflows/organization-workflows.server', () => ({
  getOrganizationWorkflowById: jest.fn(),
}));

jest.mock('@/lib/ai-extractor/extraction-service', () => ({
  extractAgreementFromText: jest.fn(),
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
  getPilotSnapshotForUser: jest.fn().mockResolvedValue({ deals: [], participants: [] }),
  syncPilotSnapshotForUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/onboarding/refresh-onboarding-project-obligations.server', () => ({
  refreshProjectObligationsAfterParticipantPersist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/workflows/agreement-intelligence/operational-hub-summary.server', () => ({
  buildWorkflowOperationalHubSummary: jest.fn().mockResolvedValue(null),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');
const { getOrganizationWorkflowById } = jest.requireMock('@/lib/workflows/organization-workflows.server');
const { extractAgreementFromText } = jest.requireMock('@/lib/ai-extractor/extraction-service');

const ORG_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WF_ID = 'wf-11111111-1111-1111-1111-111111111111';
const AGREEMENT_ID = 'agr-22222222-2222-2222-2222-222222222222';

function workflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WF_ID,
    organization_id: ORG_A,
    template_slug: 'agreement-intelligence',
    template_version: '1.0.0',
    status: 'DEPLOYED',
    lifecycle_status: 'AWAITING_INPUT',
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
    extraction_status: 'PENDING',
    extraction_result: null,
    commercial_graph: null,
    approved_structure: null,
    extraction_error: null,
    extracted_at: null,
    approved_at: null,
    approved_by_user_id: null,
    is_current: true,
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

describe('Phase P3-B — Agreement Intelligence workflow workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization_workflows.findUnique.mockReset();
    prisma.organization_workflows.findFirst.mockReset();
    prisma.organization_workflows.findMany.mockReset();
    prisma.organization_workflows.create.mockReset();
    prisma.organization_workflows.update.mockReset();
    prisma.organization_workflow_agreements.findUnique.mockReset();
    prisma.organization_workflow_agreements.findFirst.mockReset();
    prisma.organization_workflow_agreements.create.mockReset();
    prisma.organization_workflow_agreements.update.mockReset();
    prisma.organization_workflow_agreements.updateMany.mockReset();
    extractAgreementFromText.mockReset();
    extractAgreementFromText.mockResolvedValue(sampleExtraction());
    getOrganizationWorkflowById.mockReset();
    getOrganizationWorkflowById.mockResolvedValue({
      id: WF_ID,
      organizationId: ORG_A,
      templateSlug: 'agreement-intelligence',
      templateVersion: '1.0.0',
      status: 'DEPLOYED',
      lifecycleStatus: 'AWAITING_INPUT',
      configuration: {},
      deployedAt: '2026-08-17T10:00:00Z',
      pausedAt: null,
      createdAt: '2026-08-17T10:00:00Z',
      updatedAt: '2026-08-17T10:00:00Z',
      template: {
        slug: 'agreement-intelligence',
        name: 'Agreement Intelligence',
        summary: 'summary',
        icon: null,
        template: { version: '1.0.0', category: 'agreement_intelligence', deployable: true },
      },
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  });

  describe('deployment → input', () => {
    it('deployed Agreement Intelligence enters AWAITING_INPUT', async () => {
      prisma.organization_workflows.findUnique.mockResolvedValue(null);
      prisma.organization_workflows.create.mockResolvedValue(workflowRow());

      const result = await deployWorkflowToOrganization({
        organizationId: ORG_A,
        userId: 'user-1',
        templateSlug: 'agreement-intelligence',
      });

      expect(result.created).toBe(true);
      expect(prisma.organization_workflows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifecycle_status: 'AWAITING_INPUT',
          }),
        })
      );
    });

    it('upload associates agreement with correct workflow', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(workflowRow());
      prisma.organization_workflows.findUnique.mockResolvedValue({ lifecycle_status: 'AWAITING_INPUT' });
      prisma.organization_workflow_agreements.findFirst.mockResolvedValueOnce(null);
      prisma.organization_workflow_agreements.updateMany.mockResolvedValue({ count: 0 });
      prisma.organization_workflow_agreements.create.mockResolvedValue(agreementRow());
      prisma.organization_workflows.update.mockResolvedValue(workflowRow({ lifecycle_status: 'EXTRACTING' }));
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        agreementRow({ extraction_status: 'EXTRACTING' })
      );
      extractAgreementFromText.mockResolvedValue(sampleExtraction());
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(
        agreementRow({ extraction_status: 'READY_FOR_REVIEW', extraction_result: sampleExtraction() })
      );
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'READY_FOR_REVIEW',
          agreement: agreementRow({
            extraction_status: 'READY_FOR_REVIEW',
            extraction_result: sampleExtraction(),
          }),
        })
      );

      const context = await submitPastedAgreement({
        organizationId: ORG_A,
        workflowId: WF_ID,
        text: agreementRow().source_text,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.organization_workflow_agreements.updateMany).toHaveBeenCalledWith({
        where: { organization_workflow_id: WF_ID, is_current: true },
        data: { is_current: false },
      });
      expect(prisma.organization_workflow_agreements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: ORG_A,
            organization_workflow_id: WF_ID,
            is_current: true,
          }),
        })
      );
      expect(context.lifecycleStatus).toBe('READY_FOR_REVIEW');
      expect(context.agreement?.organizationWorkflowId).toBe(WF_ID);
    });

    it('demotes the previous current agreement and creates the new one in one transaction', async () => {
      const previous = agreementRow({
        extraction_status: 'READY_FOR_REVIEW',
        extraction_result: sampleExtraction(),
      });
      const created = agreementRow({
        id: 'agr-new-4444-4444-4444-444444444444',
        is_current: true,
        extraction_status: 'PENDING',
      });
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'AWAITING_INPUT',
          agreement: previous,
          agreements: [previous],
        })
      );
      prisma.organization_workflows.findUnique.mockResolvedValue({
        lifecycle_status: 'AWAITING_INPUT',
      });
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(previous);
      prisma.organization_workflow_agreements.updateMany.mockResolvedValue({ count: 1 });
      prisma.organization_workflow_agreements.create.mockResolvedValue(created);
      prisma.organization_workflows.update.mockResolvedValue(
        workflowRow({ lifecycle_status: 'EXTRACTING' })
      );
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        created
      );
      extractAgreementFromText.mockResolvedValue(sampleExtraction());
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'READY_FOR_REVIEW',
          agreements: [
            { ...previous, is_current: false },
            {
              ...created,
              extraction_status: 'READY_FOR_REVIEW',
              extraction_result: sampleExtraction(),
              is_current: true,
            },
          ],
        })
      );

      await submitPastedAgreement({
        organizationId: ORG_A,
        workflowId: WF_ID,
        text: 'Venue pays Promoter 25%.',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const updateManyOrder = prisma.organization_workflow_agreements.updateMany.mock.invocationCallOrder[0];
      const createOrder = prisma.organization_workflow_agreements.create.mock.invocationCallOrder[0];
      expect(updateManyOrder).toBeLessThan(createOrder);
      expect(prisma.organization_workflow_agreements.updateMany).toHaveBeenCalledWith({
        where: { organization_workflow_id: WF_ID, is_current: true },
        data: { is_current: false },
      });
      expect(prisma.organization_workflow_agreements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_current: true,
            source_text: 'Venue pays Promoter 25%.',
          }),
        })
      );
    });

    it('creates a new current row after explicit New extraction from an approved agreement', async () => {
      const previous = agreementRow({
        extraction_status: 'APPROVED',
        extraction_result: sampleExtraction(),
        approved_structure: { reviewForm: sampleReviewForm() },
        approved_at: new Date('2026-08-17T12:00:00Z'),
        bootstrapped_at: new Date('2026-08-17T12:05:00Z'),
        pilot_deal_id: `aiwf-${AGREEMENT_ID}`,
        is_current: true,
      });
      const created = agreementRow({
        id: 'agr-new-5555-5555-5555-555555555555',
        is_current: true,
        extraction_status: 'PENDING',
        source_text: 'Saturday Beach Event. Venue pays Promoter 30%.',
      });
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'AWAITING_INPUT',
          agreement: previous,
          agreements: [previous],
        })
      );
      prisma.organization_workflows.findUnique.mockResolvedValue({
        lifecycle_status: 'AWAITING_INPUT',
      });
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(previous);
      prisma.organization_workflow_agreements.updateMany.mockResolvedValue({ count: 1 });
      prisma.organization_workflow_agreements.create.mockResolvedValue(created);
      prisma.organization_workflows.update.mockResolvedValue(
        workflowRow({ lifecycle_status: 'EXTRACTING' })
      );
      prisma.organization_workflow_agreements.update.mockResolvedValue(created);
      extractAgreementFromText.mockResolvedValue(sampleExtraction());
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'READY_FOR_REVIEW',
          agreements: [
            { ...previous, is_current: false },
            {
              ...created,
              extraction_status: 'READY_FOR_REVIEW',
              extraction_result: sampleExtraction(),
              is_current: true,
            },
          ],
        })
      );

      await submitPastedAgreement({
        organizationId: ORG_A,
        workflowId: WF_ID,
        text: 'Saturday Beach Event. Venue pays Promoter 30%.',
      });

      expect(prisma.organization_workflow_agreements.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: AGREEMENT_ID } })
      );
      expect(prisma.organization_workflow_agreements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_workflow_id: WF_ID,
            is_current: true,
            source_text: 'Saturday Beach Event. Venue pays Promoter 30%.',
          }),
        })
      );
      expect(prisma.organization_workflow_agreements.updateMany).toHaveBeenCalledWith({
        where: { organization_workflow_id: WF_ID, is_current: true },
        data: { is_current: false },
      });
    });

    it('keeps an approved agreement current when new-row creation fails inside the transaction', async () => {
      const previous = agreementRow({
        extraction_status: 'APPROVED',
        extraction_result: sampleExtraction(),
        approved_at: new Date('2026-08-17T12:00:00Z'),
        is_current: true,
      });
      const store = new Map([[previous.id, { ...previous }]]);

      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'AWAITING_INPUT',
          agreement: previous,
          agreements: [previous],
        })
      );

      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => {
        const snapshot = new Map(
          [...store.entries()].map(([id, row]) => [id, { ...row }])
        );
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          organization_workflows: {
            findUnique: jest.fn().mockResolvedValue({ lifecycle_status: 'AWAITING_INPUT' }),
          },
          organization_workflow_agreements: {
            findFirst: jest.fn(async () => [...store.values()].find((row) => row.is_current) ?? null),
            updateMany: jest.fn(
              async ({
                where,
                data,
              }: {
                where: { organization_workflow_id: string; is_current: boolean };
                data: { is_current: boolean };
              }) => {
                let count = 0;
                for (const [id, row] of store) {
                  if (
                    row.organization_workflow_id === where.organization_workflow_id &&
                    row.is_current === true
                  ) {
                    store.set(id, { ...row, ...data });
                    count += 1;
                  }
                }
                return { count };
              }
            ),
            create: jest.fn(async () => {
              throw new Error('insert failed');
            }),
            update: jest.fn(),
          },
        };
        try {
          return await fn(tx as typeof prisma);
        } catch (error) {
          store.clear();
          for (const [id, row] of snapshot) store.set(id, row);
          throw error;
        }
      });

      await expect(
        submitPastedAgreement({
          organizationId: ORG_A,
          workflowId: WF_ID,
          text: 'Saturday Beach Event. Venue pays Promoter 30%.',
        })
      ).rejects.toThrow('insert failed');

      expect(store.get(previous.id)?.is_current).toBe(true);
      expect(store.get(previous.id)?.extraction_status).toBe('APPROVED');
    });

    it('rejects overwrite of an approved agreement unless New extraction put the workflow in AWAITING_INPUT', async () => {
      const previous = agreementRow({
        extraction_status: 'APPROVED',
        extraction_result: sampleExtraction(),
        is_current: true,
      });
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'ACTIVE',
          agreement: previous,
          agreements: [previous],
        })
      );

      await expect(
        submitPastedAgreement({
          organizationId: ORG_A,
          workflowId: WF_ID,
          text: 'Saturday Beach Event. Venue pays Promoter 30%.',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_STATE',
        message: expect.stringMatching(/already approved or active/i),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.organization_workflow_agreements.create).not.toHaveBeenCalled();
      expect(prisma.organization_workflow_agreements.update).not.toHaveBeenCalled();
    });

    it('retries a failed extraction in place instead of creating a duplicate row', async () => {
      const failed = agreementRow({
        extraction_status: 'FAILED',
        extraction_error: 'Model error',
        is_current: true,
      });
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'EXTRACTION_FAILED',
          agreement: failed,
          agreements: [failed],
        })
      );
      prisma.organization_workflows.findUnique.mockResolvedValue({
        lifecycle_status: 'EXTRACTION_FAILED',
      });
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(failed);
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        agreementRow({
          extraction_status: 'PENDING',
          source_text: 'Venue pays Promoter 20%. Retry.',
        })
      );
      prisma.organization_workflows.update.mockResolvedValue(
        workflowRow({ lifecycle_status: 'EXTRACTING' })
      );
      extractAgreementFromText.mockResolvedValue(sampleExtraction());
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'READY_FOR_REVIEW',
          agreement: agreementRow({
            extraction_status: 'READY_FOR_REVIEW',
            extraction_result: sampleExtraction(),
          }),
        })
      );

      await submitPastedAgreement({
        organizationId: ORG_A,
        workflowId: WF_ID,
        text: 'Venue pays Promoter 20%. Retry.',
      });

      expect(prisma.organization_workflow_agreements.create).not.toHaveBeenCalled();
      expect(prisma.organization_workflow_agreements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGREEMENT_ID },
          data: expect.objectContaining({
            source_text: 'Venue pays Promoter 20%. Retry.',
            extraction_status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('extraction', () => {
    it('successful extraction moves to READY_FOR_REVIEW', async () => {
      prisma.organization_workflows.findFirst
        .mockResolvedValueOnce(
          workflowRow({
            lifecycle_status: 'EXTRACTING',
            agreement: agreementRow({ extraction_status: 'EXTRACTING' }),
          })
        )
        .mockResolvedValueOnce(
          workflowRow({
            lifecycle_status: 'READY_FOR_REVIEW',
            agreement: agreementRow({
              extraction_status: 'READY_FOR_REVIEW',
              extraction_result: sampleExtraction(),
            }),
          })
        );
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(
        agreementRow({ extraction_status: 'EXTRACTING' })
      );
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        agreementRow({ extraction_status: 'READY_FOR_REVIEW' })
      );
      extractAgreementFromText.mockResolvedValue(sampleExtraction());

      const context = await runWorkflowAgreementExtraction(ORG_A, WF_ID, AGREEMENT_ID, { force: true });
      expect(context.lifecycleStatus).toBe('READY_FOR_REVIEW');
      expect(context.agreement?.extractionStatus).toBe('READY_FOR_REVIEW');
    });

    it('failure produces recoverable failure state', async () => {
      prisma.organization_workflows.findFirst
        .mockResolvedValueOnce(
          workflowRow({
            agreement: agreementRow(),
          })
        )
        .mockResolvedValueOnce(
          workflowRow({
            lifecycle_status: 'EXTRACTION_FAILED',
            agreement: agreementRow({ extraction_status: 'FAILED', extraction_error: 'Model error' }),
          })
        );
      prisma.organization_workflow_agreements.findFirst.mockResolvedValue(agreementRow());
      extractAgreementFromText.mockRejectedValue(new Error('Model error'));

      await expect(
        runWorkflowAgreementExtraction(ORG_A, WF_ID, AGREEMENT_ID, { force: true })
      ).rejects.toMatchObject({
        code: 'EXTRACTION_FAILED',
      });

      expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lifecycle_status: 'EXTRACTION_FAILED' },
        })
      );
    });

    it('duplicate processing is idempotent', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'READY_FOR_REVIEW',
          agreement: agreementRow({
            extraction_status: 'READY_FOR_REVIEW',
            extraction_result: sampleExtraction(),
          }),
        })
      );

      const context = await runWorkflowAgreementExtraction(ORG_A, WF_ID);
      expect(extractAgreementFromText).not.toHaveBeenCalled();
      expect(context.lifecycleStatus).toBe('READY_FOR_REVIEW');
    });
  });

  describe('review and approval', () => {
    it('cannot approve before extraction completes', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(
        workflowRow({
          lifecycle_status: 'EXTRACTING',
          agreement: agreementRow({ extraction_status: 'EXTRACTING' }),
        })
      );

      await expect(
        approveWorkflowAgreementStructure({
          organizationId: ORG_A,
          workflowId: WF_ID,
          userId: 'user-1',
          reviewForm: sampleReviewForm(),
          extractionResult: sampleExtraction(),
        })
      ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    });

    it('approval bootstraps commercial workflow and transitions to ACTIVE', async () => {
      const extraction = sampleExtraction();
      prisma.organization_workflows.findFirst
        .mockResolvedValueOnce(
          workflowRow({
            lifecycle_status: 'READY_FOR_REVIEW',
            agreement: agreementRow({
              extraction_status: 'READY_FOR_REVIEW',
              extraction_result: extraction,
            }),
          })
        )
        .mockResolvedValueOnce(
          workflowRow({
            lifecycle_status: 'ACTIVE',
            agreement: agreementRow({
              extraction_status: 'APPROVED',
              extraction_result: extraction,
              approved_at: new Date('2026-08-17T11:00:00Z'),
              approved_by_user_id: 'user-1',
              pilot_deal_id: `aiwf-${AGREEMENT_ID}`,
              bootstrapped_at: new Date('2026-08-17T11:00:00Z'),
            }),
          })
        );
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        agreementRow({ extraction_status: 'APPROVED' })
      );
      prisma.organization_workflows.update.mockResolvedValue({});

      const context = await approveWorkflowAgreementStructure({
        organizationId: ORG_A,
        workflowId: WF_ID,
        userId: 'user-1',
        reviewForm: sampleReviewForm(),
        extractionResult: extraction,
      });

      expect(prisma.organization_workflow_agreements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extraction_status: 'APPROVED',
            approved_by_user_id: 'user-1',
            pilot_deal_id: `aiwf-${AGREEMENT_ID}`,
          }),
        })
      );
      expect(context.lifecycleStatus).toBe('ACTIVE');
    });
  });

  describe('security / tenant isolation', () => {
    it('cross-org workflow access rejected', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(null);

      await expect(getWorkflowAgreementContext(ORG_B, WF_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('cross-org agreement access rejected on extraction', async () => {
      prisma.organization_workflows.findFirst.mockResolvedValue(null);

      await expect(
        runWorkflowAgreementExtraction(ORG_B, WF_ID, AGREEMENT_ID, { force: true })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('hub summary', () => {
    it('renders metrics from persisted extraction data', () => {
      const extraction = sampleExtraction();
      const summary = buildWorkflowAgreementHubSummary({
        lifecycleStatus: 'READY_FOR_REVIEW',
        configuration: { defaultSettlementCurrency: 'AUD', operatorApprovalRequired: true },
        agreement: {
          id: AGREEMENT_ID,
          organizationId: ORG_A,
          organizationWorkflowId: WF_ID,
          sourceType: 'PASTE',
          title: extraction.projectName.value,
          originalFilename: null,
          mimeType: null,
          fileSizeBytes: null,
          storageKey: null,
          sourceText: 'text',
          extractionStatus: 'READY_FOR_REVIEW',
          extractionResult: extraction,
          commercialGraph: null,
          approvedStructure: null,
          extractionError: null,
          extractedAt: new Date().toISOString(),
          approvedAt: null,
          approvedByUserId: null,
          pilotDealId: null,
          bootstrapError: null,
          bootstrappedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      expect(summary.participantCount).toBe(3);
      expect(summary.revenueShareCount).toBe(2);
      expect(summary.settlementSchedule).toBe('Every Friday');
      expect(summary.canReview).toBe(true);
      expect(summary.extractionComplete).toBe(true);
      expect(summary.oneLiner).toEqual(expect.any(String));
    });
  });
});
