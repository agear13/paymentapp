/**
 * Regression: Commercial Workspace → People participant must be a Canton
 * required party before Accept. An earlier proposal (or a stale required set)
 * must be revised — not reused — so the real E2E approve path succeeds.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearCommercialNetworkConfigs,
  createCantonLedgerRuntime,
  createProjectionService,
  setDefaultCommercialNetworkProviderRegistry,
  createCommercialNetworkProviderRegistry,
} from '@/lib/commercial-network';
import { readCantonWorkflowFromDeal } from '@/lib/commercial-network/canton-workflow-persistence';
import {
  resolveCantonPartyForParticipant,
} from '@/lib/commercial-network/server/canton-party-mapping.server';
import {
  syncCantonParticipantApproval,
  syncCantonProposalOnAgreementShare,
} from '@/lib/commercial-network/server/canton-workflow-sync.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';
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
  resolveOrganizationIdForPilotDeal: jest.fn().mockResolvedValue('org-people-canton'),
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

const DEAL_ID = 'demo-1788060360188';

function peopleParticipant(id: string, name: string): DemoParticipant {
  return {
    id,
    name,
    email: `${id}@test.com`,
    role: 'Contributor',
    commissionKind: 'fixed_amount',
    commissionValue: 2500,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: `token-${id}`,
    dealId: DEAL_ID,
    workspaceSource: 'project',
    participationModel: 'fixed_payout',
    agreementSharedAt: '2026-08-30T02:00:00.000Z',
    agreementLifecycle: 'SHARED',
    compensationProfile: {
      compensationType: 'FIXED_FEE',
      fixedAmount: 2500,
      configured: true,
      revenueSources: [],
    },
  };
}

describe('People-flow Canton required-party mapping', () => {
  let dealPayload: RecentDeal;

  beforeEach(() => {
    clearCommercialNetworkConfigs();
    setDefaultCommercialNetworkProviderRegistry(
      createCommercialNetworkProviderRegistry({
        canton: () => {
          const projections = createProjectionService();
          const runtime = createCantonLedgerRuntime({
            now: () => '2026-08-30T03:00:00.000Z',
          });
          const { createCantonCommercialNetworkProvider } = jest.requireActual(
            '@/lib/commercial-network/providers/canton/canton-provider'
          );
          const provider = createCantonCommercialNetworkProvider({
            defaultPlatformParty: 'party::provvypay-platform',
            runtime,
            now: () => '2026-08-30T03:00:00.000Z',
          });
          provider.subscribeToWorkflowEvents((event: unknown) => {
            projections.project(event);
          });
          return provider;
        },
      })
    );

    dealPayload = {
      id: DEAL_ID,
      dealName: 'Harbour Pavilion booking',
      partner: 'Venue Co',
      value: 48600,
      introducer: 'A',
      closer: 'B',
      status: 'Pending',
      lastUpdated: '2026-08-30T00:00:00.000Z',
      paymentStatus: 'Not Paid',
      projectValueCurrency: 'AUD',
    };

    (prisma.deal_network_pilot_deals.findUnique as jest.Mock).mockImplementation(async () => ({
      id: DEAL_ID,
      user_id: 'organiser-1',
      deal_payload: dealPayload,
    }));

    (prisma.deal_network_pilot_deals.update as jest.Mock).mockImplementation(
      async ({ data }: { data: { deal_payload: RecentDeal } }) => {
        dealPayload = data.deal_payload;
      }
    );

    (prisma.deal_network_pilot_participants.update as jest.Mock).mockResolvedValue({});
  });

  it('revises an earlier proposal so a later People participant can Accept', async () => {
    const seed = peopleParticipant('seed-venue', 'Harbour Pavilion');
    const people = peopleParticipant('proj-p-1788062167277-kg621q', 'Kai Garcia');

    (getPilotParticipantsForDeal as jest.Mock).mockResolvedValue([seed]);

    const firstShare = await syncCantonProposalOnAgreementShare({ dealId: DEAL_ID });
    expect(firstShare.ok).toBe(true);
    expect(firstShare.proposalContractId).toBeTruthy();

    let workflow = readCantonWorkflowFromDeal(dealPayload);
    expect(workflow?.requiredParticipants.map((r) => r.party)).toEqual([
      resolveCantonPartyForParticipant(seed),
    ]);

    (getPilotParticipantsForDeal as jest.Mock).mockResolvedValue([seed, people]);

    const secondShare = await syncCantonProposalOnAgreementShare({ dealId: DEAL_ID });
    expect(secondShare.ok).toBe(true);
    expect(secondShare.proposalContractId).not.toBe(firstShare.proposalContractId);

    workflow = readCantonWorkflowFromDeal(dealPayload);
    const peopleParty = resolveCantonPartyForParticipant(people);
    expect(peopleParty).toBe('party::participant-proj-p-1788062167277-kg621q');
    expect(workflow?.requiredParticipants.map((r) => r.party)).toEqual(
      expect.arrayContaining([
        resolveCantonPartyForParticipant(seed),
        peopleParty,
      ])
    );

    const approved = await syncCantonParticipantApproval({
      dealId: DEAL_ID,
      participant: { ...people, approvalStatus: 'Approved' },
    });
    expect(approved.ok).toBe(true);
    expect(approved.error).toBeUndefined();
    expect(approved.stage === 'PartiallyBound' || approved.stage === 'Bound').toBe(true);

    const approvedPeople: DemoParticipant = {
      ...people,
      approvalStatus: 'Approved',
      approvedAt: '2026-08-30T03:05:00.000Z',
    };
    const draft = generateDraftInvoice(
      buildSupplierOnboardingInput(approvedPeople, {
        id: DEAL_ID,
        name: dealPayload.dealName,
      })
    );
    expect(draft.total).toBeGreaterThan(0);
    expect(draft.currency).toBe('AUD');

    const approveRoute = readFileSync(
      join(process.cwd(), 'app/api/deal-network-pilot/invites/[token]/approve/route.ts'),
      'utf8'
    );
    expect(approveRoute).toContain('generatePaymentRequestForParticipant');
    expect(approveRoute).toContain('sendEmail: false');
  });

  it('creates required parties from a first People-flow share (no prior proposal)', async () => {
    const people = peopleParticipant('proj-p-only', 'Only Person');
    (getPilotParticipantsForDeal as jest.Mock).mockResolvedValue([people]);

    const share = await syncCantonProposalOnAgreementShare({ dealId: DEAL_ID });
    expect(share.ok).toBe(true);

    const approved = await syncCantonParticipantApproval({
      dealId: DEAL_ID,
      participant: { ...people, approvalStatus: 'Approved' },
    });
    expect(approved.ok).toBe(true);
    expect(approved.stage).toBe('Bound');
    expect(approved.agreementContractId).toBeTruthy();
  });
});
