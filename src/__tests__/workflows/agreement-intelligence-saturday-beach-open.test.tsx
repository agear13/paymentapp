/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

const AGREEMENT_ID = 'agr-saturday-beach-event';

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

jest.mock('@/hooks/use-deployed-workflows', () => {
  const installed = {
    id: 'wf-ai',
    organizationId: 'org-a',
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

jest.mock('@/hooks/use-workflow-agreement-list', () => ({
  useWorkflowAgreementList: () => ({
    data: {
      workflowId: 'wf-ai',
      lifecycleStatus: 'AWAITING_INPUT',
      currentAgreementId: 'agr-saturday-beach-event',
      canStartNew: true,
      agreements: [
        {
          id: 'agr-saturday-beach-event',
          title: 'Saturday Beach Event',
          statusFilter: 'ready_for_review',
          statusLabel: 'Ready for review',
          extractionStatus: 'READY_FOR_REVIEW',
          participantCount: 1,
          updatedAt: '2026-08-24T00:00:00.000Z',
          isCurrent: true,
          href: '/workspace/workflows/agreement-intelligence/agr-saturday-beach-event',
        },
      ],
    },
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-workflow-agreement', () => {
  const { field, testParty } = require('@/lib/ai-extractor/test-helpers/party-fixture');
  const extraction = {
    projectName: field('Saturday Beach Event'),
    projectDescription: field(null, 'absent'),
    projectValue: field(null, 'absent'),
    currency: field('AUD'),
    counterparty: field('Apex'),
    parties: [
      testParty({
        id: 'apex',
        name: field('Apex Promotions'),
        email: field('apex@example.com'),
        role: field('Promoter'),
        participationModel: field('revenue_share'),
        revenueSharePct: field(20),
      }),
    ],
    paymentTerms: [],
    uncertainties: [],
    overallConfidence: 'high',
    sourceHint: null,
    extractedAt: '2026-08-24T00:00:00.000Z',
  };
  const context = {
    workflowId: 'wf-ai',
    lifecycleStatus: 'READY_FOR_REVIEW',
    configuration: {
      defaultSettlementCurrency: 'AUD',
      operatorApprovalRequired: true,
    },
    agreement: {
      id: 'agr-saturday-beach-event',
      organizationId: 'org-a',
      organizationWorkflowId: 'wf-ai',
      sourceType: 'PASTE',
      title: 'Saturday Beach Event',
      originalFilename: null,
      mimeType: null,
      fileSizeBytes: null,
      storageKey: null,
      sourceText: 'Saturday Beach Event agreement text',
      extractionStatus: 'READY_FOR_REVIEW',
      extractionResult: extraction,
      commercialGraph: null,
      approvedStructure: null,
      extractionError: null,
      extractedAt: '2026-08-24T00:00:00.000Z',
      approvedAt: null,
      approvedByUserId: null,
      pilotDealId: null,
      bootstrapError: null,
      bootstrappedAt: null,
      isCurrent: true,
      createdAt: '2026-08-17T10:00:00Z',
      updatedAt: '2026-08-24T00:00:00Z',
    },
    hubSummary: {
      title: 'Saturday Beach Event',
      lifecycleStatus: 'READY_FOR_REVIEW',
      extractionStatus: 'READY_FOR_REVIEW',
      participantCount: 1,
      obligationCount: 1,
      revenueShareCount: 1,
      settlementSchedule: 'Every Friday',
      approvalRequired: true,
      hasAgreement: true,
      canReview: true,
      canApprove: true,
      canUpload: false,
      canRetryExtraction: false,
      canRetryBootstrap: false,
      isOperational: false,
      showsOperationalHub: false,
      extractionComplete: true,
      oneLiner: 'Apex Promotions receives 20% revenue share.',
    },
    operationalSummary: null,
    operatorEmail: 'ops@provvy.test',
  };
  return {
    useWorkflowAgreement: (_workflowId: string | null, agreementId?: string | null) => ({
      context: agreementId === 'agr-saturday-beach-event' ? context : null,
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
    }),
  };
});

import { AgreementIntelligenceIndexScreen } from '@/components/journey/lovable/agreement-intelligence-index-screen';
import { AgreementIntelligenceHubScreen } from '@/components/journey/lovable/agreement-intelligence-hub-screen';

describe('Production path: Saturday Beach Event opens existing extraction', () => {
  it('collection card links to the agreement detail URL, not New extraction', () => {
    render(<AgreementIntelligenceIndexScreen />);

    const card = screen.getByTestId('agreement-card');
    expect(card).toHaveAttribute(
      'href',
      `/workspace/workflows/agreement-intelligence/${AGREEMENT_ID}`
    );
    expect(screen.getByText('Saturday Beach Event')).toBeInTheDocument();
    expect(screen.getByTestId('new-extraction')).toBeInTheDocument();
    expect(card).not.toHaveAttribute('href', expect.stringContaining('new=1'));
  });

  it('detail hub shows the extracted Saturday Beach Event instead of empty intake', () => {
    render(<AgreementIntelligenceHubScreen agreementId={AGREEMENT_ID} />);

    expect(screen.getByTestId('agreement-intelligence-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saturday Beach Event' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Agreement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review structured result' })).toBeInTheDocument();
    expect(screen.getByText('Apex Promotions')).toBeInTheDocument();
    expect(screen.queryByTestId('open-commercial-workspace')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create Commercial Workspace' })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(/Upload or paste a commercial agreement/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload Agreement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paste Agreement Text' })).not.toBeInTheDocument();
  });
});
