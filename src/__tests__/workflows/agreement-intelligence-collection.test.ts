import {
  canStartNewExtraction,
  collectionStatusForExtraction,
  lifecycleForAgreementView,
  matchesAgreementCollectionFilter,
  pickCurrentAgreement,
  shouldCreateNewCurrentAgreement,
  toAgreementCollectionItem,
} from '@/lib/workflows/agreement-intelligence/agreement-collection';
import type { organization_workflow_agreements } from '@prisma/client';
import { startNewWorkflowAgreement, getWorkflowAgreementContext } from '@/lib/workflows/agreement-intelligence/agreement-service.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflows: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    organization_workflow_agreements: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/workflows/organization-workflows.server', () => ({
  getOrganizationWorkflowById: jest.fn().mockResolvedValue({
    templateSlug: 'agreement-intelligence',
  }),
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  getPilotSnapshotForUser: jest.fn().mockResolvedValue({ deals: [], participants: [] }),
}));

jest.mock('@/lib/workflows/agreement-intelligence/operational-hub-summary.server', () => ({
  buildWorkflowOperationalHubSummary: jest.fn().mockResolvedValue(null),
}));

const { prisma } = jest.requireMock('@/lib/server/prisma');

const ORG = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WF = 'wf-11111111-1111-1111-1111-111111111111';
const AGR = 'agr-22222222-2222-2222-2222-222222222222';

function agreementRow(
  overrides: Partial<organization_workflow_agreements> = {}
): organization_workflow_agreements {
  return {
    id: AGR,
    organization_id: ORG,
    organization_workflow_id: WF,
    source_type: 'PASTE',
    title: 'Festival Revenue Share Agreement',
    original_filename: null,
    mime_type: null,
    file_size_bytes: null,
    storage_key: null,
    source_text: 'Venue pays Promoter 20%.',
    extraction_status: 'READY_FOR_REVIEW',
    extraction_result: { parties: [{ id: 'p1' }, { id: 'p2' }] } as never,
    commercial_graph: null,
    approved_structure: null,
    extraction_error: null,
    extracted_at: new Date('2026-08-17T10:30:00Z'),
    approved_at: null,
    approved_by_user_id: null,
    pilot_deal_id: null,
    bootstrap_error: null,
    bootstrapped_at: null,
    is_current: true,
    created_at: new Date('2026-08-17T10:00:00Z'),
    updated_at: new Date('2026-08-17T11:00:00Z'),
    ...overrides,
  };
}

describe('Agreement Intelligence collection', () => {
  it('maps real extraction statuses without inventing archived', () => {
    expect(collectionStatusForExtraction('EXTRACTING', null)).toEqual({
      statusFilter: 'processing',
      statusLabel: 'Extracting terms',
    });
    expect(collectionStatusForExtraction('READY_FOR_REVIEW', null).statusFilter).toBe(
      'ready_for_review'
    );
    expect(collectionStatusForExtraction('APPROVED', new Date()).statusFilter).toBe(
      'approved_active'
    );
    expect(collectionStatusForExtraction('FAILED', null).statusFilter).toBe('failed');
  });

  it('builds list items from persisted agreement rows', () => {
    const item = toAgreementCollectionItem(agreementRow());
    expect(item.title).toBe('Festival Revenue Share Agreement');
    expect(item.participantCount).toBe(2);
    expect(item.href).toBe(`/workspace/workflows/agreement-intelligence/${AGR}`);
    expect(item.statusFilter).toBe('ready_for_review');
    expect(matchesAgreementCollectionFilter(item, 'all')).toBe(true);
    expect(matchesAgreementCollectionFilter(item, 'processing')).toBe(false);
  });

  it('does not start a new extraction while one is in progress', () => {
    expect(
      canStartNewExtraction({
        current: { extractionStatus: 'EXTRACTING' },
        workflowLifecycle: 'EXTRACTING',
      })
    ).toBe(false);
    expect(
      canStartNewExtraction({
        current: { extractionStatus: 'READY_FOR_REVIEW' },
        workflowLifecycle: 'READY_FOR_REVIEW',
      })
    ).toBe(true);
  });

  it('preserves the existing agreement row when starting a new extraction', async () => {
    const existing = agreementRow({ extraction_result: null });
    prisma.organization_workflows.findFirst
      .mockResolvedValueOnce({
        id: WF,
        organization_id: ORG,
        template_slug: 'agreement-intelligence',
        lifecycle_status: 'READY_FOR_REVIEW',
        status: 'DEPLOYED',
        configuration: {},
        agreements: [existing],
      })
      .mockResolvedValueOnce({
        id: WF,
        organization_id: ORG,
        template_slug: 'agreement-intelligence',
        lifecycle_status: 'AWAITING_INPUT',
        status: 'DEPLOYED',
        configuration: {},
        agreements: [existing],
      });
    prisma.organization_workflow_agreements.updateMany.mockResolvedValue({ count: 1 });
    prisma.organization_workflows.update.mockResolvedValue({});

    const result = await startNewWorkflowAgreement(ORG, WF);

    expect(prisma.organization_workflow_agreements.updateMany).not.toHaveBeenCalled();
    expect(prisma.organization_workflows.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: 'AWAITING_INPUT' },
      })
    );
    expect(result.lifecycleStatus).toBe('AWAITING_INPUT');
    expect(result.agreement?.id).toBe(AGR);
    expect(result.agreement?.isCurrent).toBe(true);
  });

  it('opens a new current row only after start_new leaves the previous extraction intact', () => {
    expect(
      shouldCreateNewCurrentAgreement({
        current: {
          source_text: 'Venue pays Promoter 20%.',
          extraction_result: { parties: [] },
          extraction_status: 'READY_FOR_REVIEW',
        },
        workflowLifecycle: 'AWAITING_INPUT',
      })
    ).toBe(true);
    expect(
      shouldCreateNewCurrentAgreement({
        current: {
          source_text: 'Venue pays Promoter 20%.',
          extraction_result: { parties: [] },
          extraction_status: 'APPROVED',
        },
        workflowLifecycle: 'AWAITING_INPUT',
      })
    ).toBe(true);
    expect(
      shouldCreateNewCurrentAgreement({
        current: {
          source_text: 'Venue pays Promoter 20%.',
          extraction_result: { parties: [] },
          extraction_status: 'APPROVED',
        },
        workflowLifecycle: 'ACTIVE',
      })
    ).toBe(false);
    expect(
      shouldCreateNewCurrentAgreement({
        current: {
          source_text: 'Venue pays Promoter 20%.',
          extraction_result: null,
          extraction_status: 'FAILED',
        },
        workflowLifecycle: 'EXTRACTION_FAILED',
      })
    ).toBe(false);
  });

  it('keeps a demoted approved agreement addressable in the collection', () => {
    const item = toAgreementCollectionItem(
      agreementRow({
        extraction_status: 'APPROVED',
        is_current: false,
        bootstrapped_at: new Date('2026-08-17T12:05:00Z'),
      })
    );
    expect(item.isCurrent).toBe(false);
    expect(item.href).toBe(`/workspace/workflows/agreement-intelligence/${AGR}`);
    expect(item.statusFilter).toBe('approved_active');
  });

  it('picks the most recently updated current row if more than one is marked current', () => {
    const older = agreementRow({
      id: 'agr-old',
      is_current: true,
      updated_at: new Date('2026-08-17T10:00:00Z'),
    });
    const newer = agreementRow({
      id: 'agr-new',
      is_current: true,
      updated_at: new Date('2026-08-17T12:00:00Z'),
    });
    expect(pickCurrentAgreement([older, newer])?.id).toBe('agr-new');
  });

  it('maps a previous agreement independently of the current workflow lifecycle', () => {
    expect(
      lifecycleForAgreementView({
        isCurrent: false,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'READY_FOR_REVIEW',
        bootstrappedAt: null,
      })
    ).toBe('READY_FOR_REVIEW');
    expect(
      lifecycleForAgreementView({
        isCurrent: false,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'APPROVED',
        bootstrappedAt: null,
        bootstrapError: 'Sync failed',
      })
    ).toBe('BOOTSTRAP_FAILED');
  });

  it('opens a current persisted agreement instead of New extraction after start_new', () => {
    expect(
      lifecycleForAgreementView({
        isCurrent: true,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'READY_FOR_REVIEW',
        bootstrappedAt: null,
      })
    ).toBe('READY_FOR_REVIEW');
    expect(
      lifecycleForAgreementView({
        isCurrent: true,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'APPROVED',
        bootstrappedAt: '2026-08-17T12:05:00Z',
      })
    ).toBe('ACTIVE');
    expect(
      lifecycleForAgreementView({
        isCurrent: true,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'FAILED',
        bootstrappedAt: null,
      })
    ).toBe('EXTRACTION_FAILED');
  });

  it('keeps workflow operational lifecycle for a current agreement that is still driving the workflow', () => {
    expect(
      lifecycleForAgreementView({
        isCurrent: true,
        workflowLifecycle: 'PARTICIPANT_SETUP',
        extractionStatus: 'APPROVED',
        bootstrappedAt: '2026-08-17T12:05:00Z',
      })
    ).toBe('PARTICIPANT_SETUP');
    expect(
      lifecycleForAgreementView({
        isCurrent: true,
        workflowLifecycle: 'AWAITING_INPUT',
        extractionStatus: 'PENDING',
        bootstrappedAt: null,
      })
    ).toBe('AWAITING_INPUT');
  });

  it('returns the viewed agreement lifecycle when loading a current row after start_new', async () => {
    const existing = agreementRow({
      extraction_status: 'READY_FOR_REVIEW',
      extraction_result: null,
    });
    prisma.organization_workflows.findFirst.mockResolvedValue({
      id: WF,
      organization_id: ORG,
      template_slug: 'agreement-intelligence',
      lifecycle_status: 'AWAITING_INPUT',
      status: 'DEPLOYED',
      configuration: {},
      agreements: [existing],
    });

    const context = await getWorkflowAgreementContext(ORG, WF, undefined, AGR);

    expect(context.lifecycleStatus).toBe('READY_FOR_REVIEW');
    expect(context.agreement?.id).toBe(AGR);
    expect(context.hubSummary.hasAgreement).toBe(true);
    expect(context.hubSummary.extractionComplete).toBe(true);
    expect(context.hubSummary.canReview).toBe(true);
  });
});
