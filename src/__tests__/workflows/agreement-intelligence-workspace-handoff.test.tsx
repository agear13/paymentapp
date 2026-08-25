/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { WorkflowAgreementContext } from '@/hooks/use-workflow-agreement';

const mockUseWorkflowAgreement = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

jest.mock('@/components/ai-extractor/extraction-review-modal', () => ({
  ExtractionReviewModal: () => null,
}));

jest.mock('@/hooks/use-deployed-workflows', () => {
  const installed = {
    id: 'wf-ai',
    organizationId: 'org-a',
    templateSlug: 'agreement-intelligence',
    templateVersion: '1.0.0',
    status: 'DEPLOYED',
    lifecycleStatus: 'ACTIVE',
    configuration: {},
    deployedAt: '2026-08-17T10:00:00Z',
    pausedAt: null,
    createdAt: '2026-08-17T10:00:00Z',
    updatedAt: '2026-08-17T10:00:00Z',
    template: {
      slug: 'agreement-intelligence',
      name: 'Agreement Intelligence',
      summary: 'Turn your agreements into structured commercial workflows.',
      icon: null,
      template: { version: '1.0.0', category: 'agreement_intelligence', deployable: true },
    },
  };
  return {
    useDeployedWorkflows: () => ({
      loading: false,
      isInstalled: () => true,
      getBySlug: () => installed,
      workflows: [installed],
    }),
  };
});

jest.mock('@/hooks/use-workflow-agreement', () => ({
  useWorkflowAgreement: (...args: unknown[]) => mockUseWorkflowAgreement(...args),
}));

import { AgreementIntelligenceHubScreen } from '@/components/journey/lovable/agreement-intelligence-hub-screen';

function hookResult(context: WorkflowAgreementContext) {
  return {
    context,
    loading: false,
    error: null,
    submitting: false,
    coordinating: false,
    refresh: jest.fn(),
    submitPaste: jest.fn(),
    submitUpload: jest.fn(),
    retryExtraction: jest.fn(),
    retryBootstrap: jest.fn(),
    updateConfiguration: jest.fn(),
    coordinateParticipant: jest.fn(),
    shareExtraction: jest.fn(),
    startNew: jest.fn(),
  };
}

function baseAgreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agr-linked',
    organizationId: 'org-a',
    organizationWorkflowId: 'wf-ai',
    sourceType: 'PASTE' as const,
    title: 'Saturday Beach Event',
    originalFilename: null,
    mimeType: null,
    fileSizeBytes: null,
    storageKey: null,
    sourceText: 'Saturday Beach Event agreement',
    extractionStatus: 'APPROVED' as const,
    extractionResult: null,
    commercialGraph: null,
    approvedStructure: { approvedAt: '2026-08-24T00:00:00.000Z' },
    extractionError: null,
    extractedAt: '2026-08-24T00:00:00.000Z',
    approvedAt: '2026-08-24T12:00:00.000Z',
    approvedByUserId: 'user-1',
    pilotDealId: 'aiwf-agr-linked',
    bootstrapError: null,
    bootstrappedAt: '2026-08-24T12:05:00.000Z',
    isCurrent: true,
    createdAt: '2026-08-17T10:00:00Z',
    updatedAt: '2026-08-24T12:05:00.000Z',
    ...overrides,
  };
}

function hubSummary(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Saturday Beach Event',
    lifecycleStatus: 'ACTIVE',
    extractionStatus: 'APPROVED',
    participantCount: 1,
    obligationCount: 1,
    revenueShareCount: 1,
    settlementSchedule: null,
    approvalRequired: true,
    hasAgreement: true,
    canReview: false,
    canApprove: false,
    canUpload: false,
    canRetryExtraction: false,
    canRetryBootstrap: false,
    isOperational: true,
    showsOperationalHub: true,
    extractionComplete: false,
    oneLiner: null,
    ...overrides,
  };
}

describe('Agreement Intelligence Commercial Workspace handoff UI', () => {
  beforeEach(() => {
    mockUseWorkflowAgreement.mockReset();
  });

  it('lets an already bootstrapped agreement open its Commercial Workspace', () => {
    mockUseWorkflowAgreement.mockReturnValue(
      hookResult({
        workflowId: 'wf-ai',
        lifecycleStatus: 'ACTIVE',
        configuration: {
          defaultSettlementCurrency: 'AUD',
          operatorApprovalRequired: true,
        },
        agreement: baseAgreement(),
        hubSummary: hubSummary(),
        operationalSummary: null,
      })
    );

    render(<AgreementIntelligenceHubScreen agreementId="agr-linked" />);

    const cta = screen.getByTestId('open-commercial-workspace');
    expect(cta).toHaveAttribute('href', '/workspace/arrangements/aiwf-agr-linked');
    expect(cta).toHaveTextContent('Open Commercial Workspace');
  });

  it('does not show Open Commercial Workspace when the agreement has no workspace', () => {
    mockUseWorkflowAgreement.mockReturnValue(
      hookResult({
        workflowId: 'wf-ai',
        lifecycleStatus: 'APPROVED',
        configuration: {
          defaultSettlementCurrency: 'AUD',
          operatorApprovalRequired: true,
        },
        agreement: baseAgreement({
          pilotDealId: null,
          bootstrappedAt: null,
        }),
        hubSummary: hubSummary({
          lifecycleStatus: 'APPROVED',
          canReview: false,
          isOperational: false,
          showsOperationalHub: false,
        }),
        operationalSummary: null,
      })
    );

    render(<AgreementIntelligenceHubScreen agreementId="agr-linked" />);

    expect(screen.queryByTestId('open-commercial-workspace')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-commercial-workspace-from-agreement')).toHaveTextContent(
      'Create Commercial Workspace'
    );
  });
});
