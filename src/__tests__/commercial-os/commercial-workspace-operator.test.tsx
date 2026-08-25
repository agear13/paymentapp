/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';

const aiDeal: RecentDeal = {
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

const manualDeal: RecentDeal = {
  ...aiDeal,
  id: 'demo-manual-1',
  dealName: 'Manual Festival',
  createdVia: 'deal_network_pilot_manual',
  currentStage: 'Introduced',
  status: 'Pending',
};

const aiParticipants: DemoParticipant[] = [
  {
    id: 'p-apex',
    dealId: 'aiwf-saturday-beach',
    dealName: 'Saturday Beach Event',
    name: 'Apex Promotions',
    email: 'apex@example.com',
    role: 'Contributor',
  } as DemoParticipant,
];

function summaryFor(deal: RecentDeal, count: number): ProjectWorkspaceSummary {
  return {
    id: deal.id,
    name: deal.dealName,
    value: deal.value,
    currencyLabel: deal.value ? `$${deal.value} AUD` : '$0 AUD',
    operationalStage: deal.currentStage ?? 'Introduced',
    operationalStageLabel: deal.currentStage ?? 'Setup in progress',
    settlementStatus: deal.status,
    paymentStatus: deal.paymentStatus,
    participantCount: count,
    participantsReady: 0,
    participantsPending: count,
    fundingLabel: 'No funding sources connected yet',
    fundingSubcopy: 'Add invoices or funding sources.',
    payoutLabel: deal.status,
    needsAttention: true,
  };
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/workspace/arrangements/aiwf-saturday-beach',
}));

jest.mock('@/lib/projects/workspace-fetch', () => ({
  fetchWorkspaceSummary: jest.fn(),
  fetchWorkspaceParticipants: jest.fn(),
  fetchWorkspaceFullSnapshot: jest.fn(),
  persistWorkspaceFullSnapshot: jest.fn(),
}));

jest.mock('@/hooks/use-operational-coordination-state', () => ({
  useOperationalCoordinationState: () => ({
    kpis: null,
    guidance: {},
    graph: null,
    workspaceContext: null,
    activation: null,
    loading: false,
    reloadCoordinationSnapshot: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-organization', () => ({
  useOrganization: () => ({
    organizationId: 'org-1',
    organization: { id: 'org-1', name: 'Test Org' },
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/use-organization-currency', () => ({
  useOrganizationCurrency: () => ({ currency: 'AUD', isLoading: false }),
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

jest.mock('@/components/projects/invite-project-participant-modal', () => ({
  InviteProjectParticipantModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="invite-participant-modal" /> : null,
}));

jest.mock('@/components/projects/approval-centre-participant-card', () => ({
  ApprovalCentreParticipantCard: ({ participant }: { participant: { name: string } }) => (
    <div data-testid="approval-centre-card">{participant.name}</div>
  ),
}));

jest.mock('@/components/projects/project-funding-sources-panel', () => ({
  ProjectFundingSourcesPanel: () => <div data-testid="funding-sources-panel" />,
}));

import {
  fetchWorkspaceParticipants,
  fetchWorkspaceSummary,
} from '@/lib/projects/workspace-fetch';
import { CommercialWorkspaceOperatorLayout } from '@/components/journey/lovable/commercial-workspace-operator-layout';
import { CommercialWorkspaceOverviewPanel } from '@/components/journey/lovable/commercial-workspace-overview-panel';
import { CommercialWorkspacePeoplePanel } from '@/components/journey/lovable/commercial-workspace-people-panel';
import { CommercialWorkspaceMoneyPanel } from '@/components/journey/lovable/commercial-workspace-money-panel';
import { CommercialWorkspaceAgreementPanel } from '@/components/journey/lovable/commercial-workspace-agreement-panel';

const mockedSummary = fetchWorkspaceSummary as jest.MockedFunction<typeof fetchWorkspaceSummary>;
const mockedParticipants = fetchWorkspaceParticipants as jest.MockedFunction<
  typeof fetchWorkspaceParticipants
>;

function mockWorkspace(deal: RecentDeal, participants: DemoParticipant[]) {
  mockedSummary.mockResolvedValue({
    deal,
    summary: summaryFor(deal, participants.length),
    participantCount: participants.length,
    deals: [deal],
  });
  mockedParticipants.mockResolvedValue({
    participants,
    projectParticipants: participants,
  });
}

describe('Commercial Workspace operator surface', () => {
  beforeEach(() => {
    mockedSummary.mockReset();
    mockedParticipants.mockReset();
    global.fetch = jest.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('source-agreement')) {
        return {
          ok: true,
          json: async () => ({
            agreement: url.includes('aiwf-saturday-beach')
              ? {
                  id: 'saturday-beach',
                  title: 'Saturday Beach Event',
                  href: '/workspace/workflows/agreement-intelligence/saturday-beach',
                }
              : null,
          }),
        } as Response;
      }
      if (url.includes('/invoices')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/payment-links')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('/api/deal-network-pilot/obligations')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;
  });

  it('shows operator tabs including Agreement for an AI-created workspace', async () => {
    mockWorkspace(aiDeal, aiParticipants);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId="aiwf-saturday-beach">
        <CommercialWorkspaceOverviewPanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('commercial-workspace-detail')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-agreement')).toHaveAttribute(
      'href',
      '/workspace/arrangements/aiwf-saturday-beach/agreement'
    );
    expect(screen.getByTestId('workspace-tab-people')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-obligations')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-money')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-activity')).toBeInTheDocument();
    expect(screen.getByTestId('commercial-workspace-overview')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-next-step')).toBeInTheDocument();
  });

  it('omits the Agreement tab for a manually created workspace', async () => {
    mockWorkspace(manualDeal, []);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId="demo-manual-1">
        <CommercialWorkspaceOverviewPanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('commercial-workspace-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-tab-agreement')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-people')).toBeInTheDocument();
  });

  it('reuses existing participant creation on People', async () => {
    mockWorkspace(aiDeal, aiParticipants);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId="aiwf-saturday-beach">
        <CommercialWorkspacePeoplePanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('commercial-workspace-people')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-add-participant')).toBeInTheDocument();
    expect(screen.getByTestId('approval-centre-card')).toHaveTextContent('Apex Promotions');
  });

  it('attaches invoices by selecting a payment link id, not a pasted URL', async () => {
    mockWorkspace(aiDeal, aiParticipants);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId="aiwf-saturday-beach">
        <CommercialWorkspaceMoneyPanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('commercial-workspace-money')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-attach-invoice-select')).toBeInTheDocument();
    expect(screen.queryByLabelText(/linked payment/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('funding-sources-panel')).toBeInTheDocument();
  });

  it('shows the linked agreement for AI workspaces without a second store', async () => {
    mockWorkspace(aiDeal, aiParticipants);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId="aiwf-saturday-beach">
        <CommercialWorkspaceAgreementPanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('workspace-agreement-linked')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-agreement-detail-link')).toHaveAttribute(
      'href',
      '/workspace/workflows/agreement-intelligence/saturday-beach'
    );
  });
});
