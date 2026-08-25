import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  agreementIdFromPilotDealId,
  commercialWorkspaceShowsAgreementTab,
  commercialWorkspaceSourceOf,
  listCommercialWorkspaces,
  sourceAgreementHref,
  stampManualCommercialWorkspace,
  toCommercialWorkspaceListItem,
} from '@/lib/commercial-os/commercial-workspace-collection';
import { commercialWorkspaceNextStep } from '@/lib/commercial-os/commercial-workspace-next-step';

function deal(overrides: Partial<RecentDeal> = {}): RecentDeal {
  return {
    id: 'demo-1',
    dealName: 'Saturday Beach Event',
    partner: 'Apex',
    value: 12000,
    introducer: '—',
    closer: '—',
    status: 'Approved',
    lastUpdated: '2026-08-24T00:00:00.000Z',
    paymentStatus: 'Not Paid',
    currentStage: 'Work In Progress',
    ...overrides,
  };
}

function participant(overrides: Partial<DemoParticipant> = {}): DemoParticipant {
  return {
    id: 'p1',
    dealId: 'demo-1',
    dealName: 'Saturday Beach Event',
    name: 'Apex Promotions',
    email: 'apex@example.com',
    role: 'Contributor',
    ...overrides,
  } as DemoParticipant;
}

describe('Commercial Workspace collection mapping', () => {
  it('maps a persisted deal to a clickable Commercial Workspace card', () => {
    const item = toCommercialWorkspaceListItem(deal(), [participant()]);
    expect(item.name).toBe('Saturday Beach Event');
    expect(item.href).toBe('/workspace/arrangements/demo-1');
    expect(item.participantCount).toBe(1);
    expect(item.sourceLabel).toBe('Manual');
    expect(item.settlementLabel).toBe('Ready to settle');
  });

  it('labels creation source from createdVia and known deal id prefixes', () => {
    expect(commercialWorkspaceSourceOf(deal({ createdVia: 'agreement_intelligence_workflow' }))).toBe(
      'agreement_intelligence'
    );
    expect(commercialWorkspaceSourceOf(deal({ id: 'aiwf-agr-1' }))).toBe('agreement_intelligence');
    expect(commercialWorkspaceSourceOf(deal({ createdVia: 'ai_conversation_import' }))).toBe(
      'conversation_import'
    );
    expect(commercialWorkspaceSourceOf(deal({ id: 'onb-deal-1' }))).toBe('onboarding');
    expect(commercialWorkspaceSourceOf(deal({ id: 'rmwf-wf-1' }))).toBe('referral_management');
    expect(commercialWorkspaceSourceOf(deal({ createdVia: 'deal_network_pilot_manual' }))).toBe(
      'manual'
    );
    expect(commercialWorkspaceSourceOf(deal({ id: 'demo-9' }))).toBe('manual');
  });

  it('stamps manual source metadata without replacing an existing createdVia', () => {
    const stamped = stampManualCommercialWorkspace(
      deal({ createdVia: undefined, currentStage: undefined, status: 'Pending' })
    );
    expect(stamped.createdVia).toBe('deal_network_pilot_manual');
    expect(stamped.currentStage).toBe('Introduced');
    expect(
      stampManualCommercialWorkspace(deal({ createdVia: 'agreement_intelligence_workflow' }))
        .createdVia
    ).toBe('agreement_intelligence_workflow');
  });

  it('omits archived deals and counts participants from the existing snapshot', () => {
    const items = listCommercialWorkspaces(
      [
        deal({ id: 'keep-1', dealName: 'Keep' }),
        deal({ id: 'gone-1', dealName: 'Gone', archived: true }),
      ],
      [
        participant({ id: 'a', dealId: 'keep-1', dealName: 'Keep' }),
        participant({ id: 'b', dealId: 'keep-1', dealName: 'Keep' }),
        participant({ id: 'c', dealId: 'gone-1', dealName: 'Gone' }),
      ]
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('keep-1');
    expect(items[0]?.participantCount).toBe(2);
    expect(items[0]?.href).toBe('/workspace/arrangements/keep-1');
  });

  it('derives Agreement Intelligence detail href from the aiwf- pilot deal convention', () => {
    expect(agreementIdFromPilotDealId('aiwf-saturday-beach')).toBe('saturday-beach');
    expect(sourceAgreementHref('saturday-beach')).toBe(
      '/workspace/workflows/agreement-intelligence/saturday-beach'
    );
    expect(commercialWorkspaceShowsAgreementTab('agreement_intelligence', null)).toBe(true);
    expect(commercialWorkspaceShowsAgreementTab('manual', null)).toBe(false);
    expect(commercialWorkspaceShowsAgreementTab('manual', 'agr-1')).toBe(true);
  });

  it('points empty workspaces at People as the next operational step', () => {
    const step = commercialWorkspaceNextStep({
      workspaceId: 'demo-1',
      participantCount: 0,
      pendingApprovals: 0,
      hasFundingSources: false,
      fundingLabel: 'No funding sources connected yet',
    });
    expect(step.href).toBe('/workspace/arrangements/demo-1/people');
    expect(step.cta).toBe('Open People');
  });
});
