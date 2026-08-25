/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
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
}));

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
  CreateDealModal: () => null,
}));

import { CommercialWorkspacesIndexScreen } from '@/components/journey/lovable/commercial-workspaces-index-screen';
import { CommercialWorkspaceDetailScreen } from '@/components/journey/lovable/commercial-workspace-detail-screen';

describe('Commercial Workspaces collection', () => {
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
  });

  it('opens the intended detail route for a persisted workspace', async () => {
    render(<CommercialWorkspaceDetailScreen workspaceId="aiwf-saturday-beach" />);

    expect(await screen.findByTestId('commercial-workspace-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saturday Beach Event' })).toBeInTheDocument();
    expect(screen.getByText('Agreement Intelligence')).toBeInTheDocument();
  });
});
