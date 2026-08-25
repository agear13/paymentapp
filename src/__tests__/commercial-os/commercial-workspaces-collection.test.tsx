/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

const snapshot = {
  deals: [
    {
      id: 'aiwf-saturday-beach',
      dealName: 'Saturday Beach Event',
      partner: 'Apex',
      value: 12000,
      introducer: '—',
      closer: '—',
      status: 'Approved' as const,
      lastUpdated: '2026-08-24T00:00:00.000Z',
      paymentStatus: 'Not Paid' as const,
      currentStage: 'Work In Progress' as const,
      createdVia: 'agreement_intelligence_workflow',
    } satisfies RecentDeal,
  ],
  participants: [
    {
      id: 'p-apex',
      dealId: 'aiwf-saturday-beach',
      dealName: 'Saturday Beach Event',
      name: 'Apex Promotions',
      email: 'apex@example.com',
      role: 'Contributor',
    } as DemoParticipant,
  ],
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/workspace/arrangements/aiwf-saturday-beach',
}));

jest.mock('@/lib/projects/workspace-fetch', () => {
  const deal = {
    id: 'aiwf-saturday-beach',
    dealName: 'Saturday Beach Event',
    partner: 'Apex',
    value: 12000,
    introducer: '—',
    closer: '—',
    status: 'Approved',
    lastUpdated: '2026-08-24T00:00:00.000Z',
    paymentStatus: 'Not Paid',
    currentStage: 'Work In Progress',
    createdVia: 'agreement_intelligence_workflow',
  };
  const participants = [
    {
      id: 'p-apex',
      dealId: 'aiwf-saturday-beach',
      dealName: 'Saturday Beach Event',
      name: 'Apex Promotions',
      email: 'apex@example.com',
      role: 'Contributor',
    },
  ];
  const summary = {
    id: deal.id,
    name: deal.dealName,
    value: 12000,
    currencyLabel: '$12,000 AUD',
    operationalStage: 'Work In Progress',
    operationalStageLabel: 'Work In Progress',
    settlementStatus: 'Approved',
    paymentStatus: 'Not Paid',
    participantCount: 1,
    participantsReady: 0,
    participantsPending: 1,
    fundingLabel: 'No funding sources connected yet',
    fundingSubcopy: 'Add invoices or funding sources.',
    payoutLabel: 'Ready to pay out',
    needsAttention: true,
  };
  return {
    fetchWorkspaceSummary: jest.fn(async () => ({
      deal,
      summary,
      participantCount: 1,
      deals: [deal],
    })),
    fetchWorkspaceParticipants: jest.fn(async () => ({
      participants,
      projectParticipants: participants,
    })),
    fetchWorkspaceFullSnapshot: jest.fn(),
    persistWorkspaceFullSnapshot: jest.fn(),
  };
});

jest.mock('@/lib/deal-network-demo/pilot-store', () => ({
  fetchPilotSnapshot: jest.fn(async () => snapshot),
  persistPilotSnapshot: jest.fn(async () => true),
}));

jest.mock('@/hooks/use-entitlements', () => ({
  useEntitlements: () => ({
    loading: false,
    entitlements: { plan: 'professional', pilotBypass: true },
    isAllowed: () => true,
    getDecision: () => null,
    plan: 'professional',
    pilotBypass: true,
    usage: {},
  }),
  trackEntitlementAnalytics: jest.fn(),
}));

jest.mock('@/components/deal-network-demo/create-deal-modal', () => ({
  CreateDealModal: (props: { open: boolean; copy?: string; experienceMode?: string }) => (
    <div
      data-testid="create-deal-modal"
      data-open={String(props.open)}
      data-copy={props.copy ?? ''}
      data-mode={props.experienceMode ?? ''}
    />
  ),
}));

import { CommercialWorkspacesIndexScreen } from '@/components/journey/lovable/commercial-workspaces-index-screen';
import { CommercialWorkspaceDetailScreen } from '@/components/journey/lovable/commercial-workspace-detail-screen';

describe('Commercial Workspaces collection', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/workspace/arrangements');
  });

  it('lists existing deals as clickable Commercial Workspaces', async () => {
    render(<CommercialWorkspacesIndexScreen />);

    const card = await screen.findByTestId('commercial-workspace-card');
    expect(card).toHaveAttribute('href', '/workspace/arrangements/aiwf-saturday-beach');
    expect(screen.getByText('Saturday Beach Event')).toBeInTheDocument();
    expect(screen.getByText('Agreement Intelligence')).toBeInTheDocument();
    expect(screen.getByText('1 participant')).toBeInTheDocument();
    expect(screen.getByTestId('create-commercial-workspace')).toHaveTextContent(
      'Create Commercial Workspace'
    );
    const modal = screen.getByTestId('create-deal-modal');
    expect(modal).toHaveAttribute('data-open', 'false');
    expect(modal).toHaveAttribute('data-copy', 'commercial_workspace');
    expect(modal).toHaveAttribute('data-mode', 'project');
  });

  it('opens the existing create modal from ?create=1 without a second creation service', async () => {
    window.history.pushState({}, '', '/workspace/arrangements?create=1');
    render(<CommercialWorkspacesIndexScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('create-deal-modal')).toHaveAttribute('data-open', 'true');
    });
  });

  it('opens the intended detail route for a persisted workspace', async () => {
    render(<CommercialWorkspaceDetailScreen workspaceId="aiwf-saturday-beach" />);

    expect(await screen.findByTestId('commercial-workspace-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saturday Beach Event' })).toBeInTheDocument();
    expect(screen.getByText('Agreement Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/You are in the Commercial Workspace/i)).toBeInTheDocument();
    expect(screen.getByTestId('source-agreement-intelligence')).toHaveAttribute(
      'href',
      '/workspace/workflows/agreement-intelligence/saturday-beach'
    );
    expect(screen.getByTestId('workspace-tab-agreement')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-people')).toHaveAttribute(
      'href',
      '/workspace/arrangements/aiwf-saturday-beach/people'
    );
  });
});
