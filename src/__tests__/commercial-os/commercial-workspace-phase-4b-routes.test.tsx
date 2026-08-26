/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import { ApprovalCentreHeader } from '@/components/projects/approval-centre-header';
import { ApprovalCentreParticipantCard } from '@/components/projects/approval-centre-participant-card';
import { createArrangementCtaHrefResolver } from '@/lib/commercial-os/arrangement-operator-routes';

const WORKSPACE_ID = 'aiwf-saturday-beach';

const mockSearchParamsGet = jest.fn<(key: string) => string | null>(() => null);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => `/workspace/arrangements/${WORKSPACE_ID}/people`,
  useParams: () => ({ workspaceId: WORKSPACE_ID, participantId: 'p-apex' }),
  useSearchParams: () => ({ get: (key: string) => mockSearchParamsGet(key) }),
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

jest.mock('@/components/projects/project-funding-sources-panel', () => ({
  ProjectFundingSourcesPanel: () => <div data-testid="funding-sources-panel" />,
}));

import {
  fetchWorkspaceParticipants,
  fetchWorkspaceSummary,
} from '@/lib/projects/workspace-fetch';
import { CommercialWorkspaceOperatorLayout } from '@/components/journey/lovable/commercial-workspace-operator-layout';
import { CommercialWorkspacePeoplePanel } from '@/components/journey/lovable/commercial-workspace-people-panel';
import { CommercialWorkspaceMoneyPanel } from '@/components/journey/lovable/commercial-workspace-money-panel';
import { CommercialWorkspaceOverviewPanel } from '@/components/journey/lovable/commercial-workspace-overview-panel';
import { SupplierOnboardingReviewScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-review-screen';
import { SupplierOnboardingFormScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-form-screen';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

const mockedSummary = fetchWorkspaceSummary as jest.MockedFunction<typeof fetchWorkspaceSummary>;
const mockedParticipants = fetchWorkspaceParticipants as jest.MockedFunction<
  typeof fetchWorkspaceParticipants
>;

const aiDeal: RecentDeal = {
  id: WORKSPACE_ID,
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

function compensation() {
  return {
    compensationType: 'FIXED_FEE' as const,
    fixedAmount: 500,
    configured: true,
    configuredAt: '2026-06-27T09:00:00.000Z',
    revenueSources: [],
    customerAttributionEnabled: false,
    commissionSourceMode: 'all_active' as const,
    commissionServiceIds: [],
  };
}

function acceptedParticipant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p-apex',
    dealId: WORKSPACE_ID,
    dealName: 'Saturday Beach Event',
    name: 'Apex Promotions',
    email: 'apex@example.com',
    role: 'Contributor',
    inviteToken: 'invite-token',
    approvalStatus: 'Approved',
    approvedAt: '2026-06-27T10:00:00.000Z',
    commissionKind: 'fixed_amount',
    commissionValue: 500,
    compensationProfile: compensation(),
    ...overrides,
  } as DemoParticipant;
}

function submittedParticipant(): DemoParticipant {
  return acceptedParticipant({
    paymentSetup: {
      paymentRequestGeneratedAt: '2026-06-28T00:00:00.000Z',
      token: 'tok',
      tokenExpiresAt: '2099-01-01T00:00:00.000Z',
    },
    supplierOnboarding: {
      lifecycle: 'SUBMITTED',
      submission: { submittedAt: '2026-06-28T12:00:00.000Z', declarationAccepted: true },
    },
    payoutOnboardingPhase: 'SUBMITTED',
  });
}

function xeroReadyParticipant(): DemoParticipant {
  return acceptedParticipant({
    paymentSetup: {
      paymentRequestGeneratedAt: '2026-06-28T00:00:00.000Z',
      token: 'tok',
      tokenExpiresAt: '2099-01-01T00:00:00.000Z',
    },
    supplierOnboarding: { lifecycle: 'APPROVED' },
    payoutVerificationConfirmed: true,
    payoutOnboardingPhase: 'APPROVED',
  });
}

function settlementReadyParticipant(): DemoParticipant {
  return acceptedParticipant({
    paymentSetup: {
      paymentRequestGeneratedAt: '2026-06-28T00:00:00.000Z',
      xeroExportedAt: '2026-06-29T00:00:00.000Z',
      xeroSyncStatus: 'synced',
    },
    supplierOnboarding: { lifecycle: 'APPROVED' },
    payoutVerificationConfirmed: true,
    payoutOnboardingPhase: 'APPROVED',
  });
}

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

function operatorHrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a[href]')].map((el) => el.getAttribute('href') ?? '');
}

describe('Phase 4B Commercial Workspace route adapters', () => {
  beforeEach(() => {
    mockedSummary.mockReset();
    mockedParticipants.mockReset();
    mockSearchParamsGet.mockReset();
    mockSearchParamsGet.mockReturnValue(null);
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
      if (url.includes('/invoices') || url.includes('/api/payment-links')) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      if (url.includes('payment-request/generate')) {
        return {
          ok: true,
          json: async () => ({
            participant: acceptedParticipant({
              paymentSetup: { paymentRequestGeneratedAt: '2026-06-28T00:00:00.000Z' },
              supplierOnboarding: { lifecycle: 'INVITED' },
            }),
            portalUrl: 'https://example.test/participant/portal-token?step=payout',
            message: 'Payment request ready to share',
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;
  });

  it('uses dashboard hrefs when Approval Centre has no OS resolver', () => {
    render(
      <ApprovalCentreHeader
        participants={[acceptedParticipant()]}
        agreementName="Saturday Beach Event"
        projectId={WORKSPACE_ID}
      />
    );
    expect(screen.getByTestId('approval-centre-next-cta')).toHaveAttribute(
      'href',
      `/dashboard/projects/${WORKSPACE_ID}/participants?focus=payment-requests`
    );

    render(
      <ApprovalCentreParticipantCard
        participant={submittedParticipant()}
        onShareAgreement={jest.fn()}
        onConfigureEarnings={jest.fn()}
        projectId={WORKSPACE_ID}
      />
    );
    expect(screen.getByTestId('approval-centre-cta-review_payment')).toHaveAttribute(
      'href',
      `/dashboard/projects/${WORKSPACE_ID}/participants/p-apex/review`
    );
  });

  it('routes Approval Centre header and card CTAs through Commercial OS', async () => {
    mockWorkspace(aiDeal, [acceptedParticipant()]);
    const { container } = render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <CommercialWorkspacePeoplePanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('commercial-workspace-people')).toBeInTheDocument();
    expect(screen.getByTestId('approval-centre-next-cta')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/people?focus=payment-requests`
    );
    expect(operatorHrefs(container).filter((href) => href.includes('/dashboard/projects'))).toEqual(
      []
    );
  });

  it('keeps payment-request coordination on People', async () => {
    mockSearchParamsGet.mockImplementation((key) =>
      key === 'focus' ? 'payment-requests' : null
    );
    mockWorkspace(aiDeal, [acceptedParticipant()]);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <CommercialWorkspacePeoplePanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('workspace-people-payment-requests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Request Payout Details/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/deal-network-pilot/participants/p-apex/payment-request/generate'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByTestId('commercial-workspace-people')).toBeInTheDocument();
  });

  it('links OS review back to People onboarding and accounting to Money', async () => {
    mockWorkspace(aiDeal, [submittedParticipant()]);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <SupplierOnboardingReviewScreen
          participantId="p-apex"
          backHref={COMMERCIAL_OS_ROUTES.arrangementPeopleFocus(WORKSPACE_ID, 'onboarding')}
          accountingHref={COMMERCIAL_OS_ROUTES.arrangementMoneyAccounting(WORKSPACE_ID)}
          accountingLinkLabel="View in Money"
        />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('review-back-link')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/people?focus=onboarding`
    );
    expect(screen.getByTestId('review-accounting-link')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/money?section=accounting`
    );
    expect(screen.queryByRole('link', { name: /funding tab/i })).not.toBeInTheDocument();
  });

  it('links OS onboard back to People onboarding', async () => {
    mockWorkspace(aiDeal, [acceptedParticipant()]);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <SupplierOnboardingFormScreen
          participantId="p-apex"
          backHref={COMMERCIAL_OS_ROUTES.arrangementPeopleFocus(WORKSPACE_ID, 'onboarding')}
        />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('onboard-back-link')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/people?focus=onboarding`
    );
  });

  it('maps Money accounting onboarding CTA to People, not dashboard', async () => {
    mockSearchParamsGet.mockImplementation((key) =>
      key === 'section' ? 'accounting' : null
    );
    mockWorkspace(aiDeal, [acceptedParticipant()]);
    render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <CommercialWorkspaceMoneyPanel />
      </CommercialWorkspaceOperatorLayout>
    );

    expect(await screen.findByTestId('workspace-money-accounting')).toBeInTheDocument();
    expect(screen.getByTestId('funding-workflow-onboarding-cta')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/people?focus=onboarding`
    );
  });

  it('maps settlement CTA to /workspace/settlement', () => {
    const resolveCtaHref = createArrangementCtaHrefResolver(WORKSPACE_ID);
    render(
      <ApprovalCentreHeader
        participants={[settlementReadyParticipant()]}
        agreementName="Saturday Beach Event"
        projectId={WORKSPACE_ID}
        resolveCtaHref={resolveCtaHref}
      />
    );
    expect(screen.getByTestId('approval-centre-next-cta')).toHaveAttribute(
      'href',
      '/workspace/settlement'
    );

    render(
      <ApprovalCentreParticipantCard
        participant={settlementReadyParticipant()}
        onShareAgreement={jest.fn()}
        onConfigureEarnings={jest.fn()}
        projectId={WORKSPACE_ID}
        resolveCtaHref={resolveCtaHref}
      />
    );
    expect(screen.getByTestId('approval-centre-cta-settlement')).toHaveAttribute(
      'href',
      '/workspace/settlement'
    );
  });

  it('routes xero and review card CTAs onto nested OS paths', () => {
    const resolveCtaHref = createArrangementCtaHrefResolver(WORKSPACE_ID);
    render(
      <ApprovalCentreParticipantCard
        participant={submittedParticipant()}
        onShareAgreement={jest.fn()}
        onConfigureEarnings={jest.fn()}
        projectId={WORKSPACE_ID}
        resolveCtaHref={resolveCtaHref}
      />
    );
    expect(screen.getByTestId('approval-centre-cta-review_payment')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/people/p-apex/review`
    );

    render(
      <ApprovalCentreParticipantCard
        participant={xeroReadyParticipant()}
        onShareAgreement={jest.fn()}
        onConfigureEarnings={jest.fn()}
        projectId={WORKSPACE_ID}
        resolveCtaHref={resolveCtaHref}
      />
    );
    expect(screen.getByTestId('approval-centre-cta-xero_export')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/money?section=accounting`
    );
  });

  it('keeps AI-created and manual Phase 4A operator flows intact', async () => {
    mockWorkspace(aiDeal, [acceptedParticipant()]);
    const ai = render(
      <CommercialWorkspaceOperatorLayout workspaceId={WORKSPACE_ID}>
        <CommercialWorkspaceOverviewPanel />
      </CommercialWorkspaceOperatorLayout>
    );
    expect(await screen.findByTestId('workspace-tab-agreement')).toHaveAttribute(
      'href',
      `/workspace/arrangements/${WORKSPACE_ID}/agreement`
    );
    ai.unmount();

    mockWorkspace(manualDeal, []);
    const manual = render(
      <CommercialWorkspaceOperatorLayout workspaceId="demo-manual-1">
        <CommercialWorkspaceOverviewPanel />
      </CommercialWorkspaceOperatorLayout>
    );
    expect(await screen.findByTestId('commercial-workspace-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-tab-agreement')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-tab-people')).toBeInTheDocument();
    manual.unmount();
  });
});
