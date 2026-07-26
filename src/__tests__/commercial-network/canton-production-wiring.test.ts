/**
 * Integration test: production API paths → Canton workflow sync (simulated ledger).
 */

import {
  clearCommercialNetworkConfigs,
  createCantonLedgerRuntime,
  createProjectionService,
  setDefaultCommercialNetworkProviderRegistry,
  createCommercialNetworkProviderRegistry,
} from '@/lib/commercial-network';
import { readCantonWorkflowFromDeal } from '@/lib/commercial-network/canton-workflow-persistence';
import {
  syncCantonParticipantApproval,
  syncCantonProposalOnAgreementShare,
  syncCantonSettlementReady,
} from '@/lib/commercial-network/server/canton-workflow-sync.server';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    deal_network_pilot_deals: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deal_network_pilot_participants: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/referrals/ensure-referral-issuance', () => ({
  resolveOrganizationIdForPilotDeal: jest.fn().mockResolvedValue('org-canton-test'),
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => {
  const actual = jest.requireActual('@/lib/deal-network-demo/pilot-snapshot.server');
  return {
    ...actual,
    getPilotParticipantsForDeal: jest.fn(),
  };
});

import { prisma } from '@/lib/server/prisma';
import { getPilotParticipantsForDeal } from '@/lib/deal-network-demo/pilot-snapshot.server';

const DEAL_ID = 'deal-canton-wire-test';

function projectParticipant(id: string, name: string, role: DemoParticipant['role']): DemoParticipant {
  return {
    id,
    name,
    email: `${id}@test.com`,
    role,
    commissionKind: 'pct_of_deal',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: `token-${id}`,
    dealId: DEAL_ID,
    workspaceSource: 'project',
    participationModel: 'fixed_payout',
    agreementSharedAt: '2026-07-16T10:00:00.000Z',
    agreementLifecycle: 'SHARED',
  };
}

describe('Canton workflow production wiring (simulated)', () => {
  let dealPayload: RecentDeal;

  beforeEach(() => {
    clearCommercialNetworkConfigs();
    setDefaultCommercialNetworkProviderRegistry(
      createCommercialNetworkProviderRegistry({
        canton: () => {
          const projections = createProjectionService();
          const runtime = createCantonLedgerRuntime({
            now: () => '2026-07-16T12:00:00.000Z',
          });
          const { createCantonCommercialNetworkProvider } = jest.requireActual(
            '@/lib/commercial-network/providers/canton/canton-provider'
          );
          const provider = createCantonCommercialNetworkProvider({
            defaultPlatformParty: 'party::provvypay-platform',
            runtime,
            now: () => '2026-07-16T12:00:00.000Z',
          });
          provider.subscribeToWorkflowEvents((event) => {
            projections.project(event);
          });
          return provider;
        },
      })
    );

    dealPayload = {
      id: DEAL_ID,
      dealName: 'Summer Festival',
      partner: 'Venue Co',
      value: 48600,
      introducer: 'A',
      closer: 'B',
      status: 'Pending',
      lastUpdated: '2026-07-16T00:00:00.000Z',
      paymentStatus: 'Not Paid',
      projectValueCurrency: 'AUD',
    };

    (prisma.deal_network_pilot_deals.findUnique as jest.Mock).mockImplementation(async () => ({
      id: DEAL_ID,
      user_id: 'user-1',
      deal_payload: dealPayload,
    }));

    (prisma.deal_network_pilot_deals.update as jest.Mock).mockImplementation(
      async ({ data }: { data: { deal_payload: RecentDeal } }) => {
        dealPayload = data.deal_payload;
      }
    );

    (prisma.deal_network_pilot_participants.update as jest.Mock).mockResolvedValue({});
  });

  it('runs proposal → accept → bound → settlement ready with contract ids persisted', async () => {
    const p1 = projectParticipant('p-venue', 'Harbour Pavilion', 'Contributor');
    const p2 = projectParticipant('p-promoter', 'Loop Promotions', 'Connector');
    const p3 = projectParticipant('p-artist', 'DJ Nova', 'Closer');

    (getPilotParticipantsForDeal as jest.Mock).mockResolvedValue([p1, p2, p3]);

    const proposal = await syncCantonProposalOnAgreementShare({ dealId: DEAL_ID });
    expect(proposal.ok).toBe(true);
    expect(proposal.proposalContractId).toBeTruthy();
    expect(proposal.stage).toBe('Proposed');

    let workflow = readCantonWorkflowFromDeal(dealPayload);
    expect(workflow?.proposalContractId).toBe(proposal.proposalContractId);

    for (const participant of [p1, p2, p3]) {
      const approved = await syncCantonParticipantApproval({
        dealId: DEAL_ID,
        participant: { ...participant, approvalStatus: 'Approved' },
      });
      expect(approved.ok).toBe(true);
    }

    workflow = readCantonWorkflowFromDeal(dealPayload);
    expect(workflow?.stage).toBe('Bound');
    expect(workflow?.agreementContractId).toBeTruthy();
    expect(workflow?.proposalContractId).toBeNull();

    const ready = await syncCantonSettlementReady({ dealId: DEAL_ID });
    expect(ready.ok).toBe(true);
    expect(ready.stage).toBe('SettlementReady');
    expect(ready.settlementReadyContractId).toBeTruthy();

    workflow = readCantonWorkflowFromDeal(dealPayload);
    expect(workflow?.settlementReadyContractId).toBe(ready.settlementReadyContractId);
    expect(ready.commandId).toMatch(/^sca-ready-/);
  });
});
