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

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
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
    },
  },
}));

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
      prisma.organization_workflow_agreements.findUnique.mockResolvedValue(null);
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

      expect(prisma.organization_workflow_agreements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: ORG_A,
            organization_workflow_id: WF_ID,
          }),
        })
      );
      expect(context.lifecycleStatus).toBe('READY_FOR_REVIEW');
      expect(context.agreement?.organizationWorkflowId).toBe(WF_ID);
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

    it('approval records user + timestamp and persists approved state', async () => {
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
            lifecycle_status: 'APPROVED',
            agreement: agreementRow({
              extraction_status: 'APPROVED',
              extraction_result: extraction,
              approved_at: new Date('2026-08-17T11:00:00Z'),
              approved_by_user_id: 'user-1',
            }),
          })
        );
      prisma.organization_workflow_agreements.update.mockResolvedValue(
        agreementRow({ extraction_status: 'APPROVED' })
      );

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
          }),
        })
      );
      expect(context.lifecycleStatus).toBe('APPROVED');
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      expect(summary.participantCount).toBe(3);
      expect(summary.revenueShareCount).toBe(2);
      expect(summary.settlementSchedule).toBe('Every Friday');
      expect(summary.canReview).toBe(true);
    });
  });
});
