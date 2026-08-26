import { attachParticipantWorkspaceAttribution } from '@/lib/participants/participant-workspace-attribution.server';
import { resolveParticipantPortalInvoiceProvenance } from '@/lib/invoices/agreement-invoice-prefill.server';

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/deal-network-demo/pilot-snapshot.server', () => ({
  dealRowToRecentDeal: jest.fn((row: { id: string; deal_payload: unknown }) => ({
    ...(row.deal_payload as object),
    id: row.id,
  })),
  participantRowToDemo: jest.fn((row: { id: string; participant_payload: unknown }) => ({
    ...(row.participant_payload as object),
    id: row.id,
  })),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    user_organizations: {
      findUnique: jest.fn(),
    },
    organizations: {
      findUnique: jest.fn(),
    },
    deal_network_pilot_participants: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { prisma } from '@/lib/server/prisma';

const SARAH = { id: 'user-sarah', email: 'sarah@example.com' };
const ORGANISER = { id: 'user-organiser', email: 'organiser@example.com' };
const JAKE = { id: 'user-jake', email: 'jake@example.com' };
const SARAH_ORG = 'org-sarah-existing';
const SOURCE_ORG = 'org-saturday-beach-organiser';
const JAKE_ORG = 'org-jake';
const PARTICIPANT = 'p-sarah-1';
const DEAL = 'aiwf-saturday-beach';

const membershipFind = prisma.user_organizations.findUnique as jest.Mock;
const orgFind = prisma.organizations.findUnique as jest.Mock;
const participantFindMany = prisma.deal_network_pilot_participants.findMany as jest.Mock;
const participantUpdateMany = prisma.deal_network_pilot_participants.updateMany as jest.Mock;
const participantFindUnique = prisma.deal_network_pilot_participants.findUnique as jest.Mock;

function eligibleSarahRow() {
  return {
    id: PARTICIPANT,
    source_organization_id: SOURCE_ORG,
    deal_id: DEAL,
    deal: { id: DEAL },
    source_organization: { id: SOURCE_ORG },
  };
}

function sarahParticipantRecord(convertedOrganizationId: string | null) {
  return {
    id: PARTICIPANT,
    email: SARAH.email,
    authenticated_user_id: SARAH.id,
    converted_organization_id: convertedOrganizationId,
    source_organization_id: SOURCE_ORG,
    deal_id: DEAL,
    participant_payload: {
      id: PARTICIPANT,
      name: 'Sarah Williams',
      role: 'Contributor',
      commissionKind: 'fixed_amount',
      commissionValue: 6000,
    },
    deal: {
      id: DEAL,
      user_id: ORGANISER.id,
      deal_payload: {
        dealName: 'Saturday Beach Event',
        partner: 'Apex Promotions Pty Ltd',
        projectValueCurrency: 'AUD',
      },
    },
  };
}

describe('invoice activation reuse attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    membershipFind.mockResolvedValue({ role: 'OWNER' });
    orgFind.mockResolvedValue({ id: SARAH_ORG });
    participantFindMany.mockResolvedValue([eligibleSarahRow()]);
    participantUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('attaches the authorised participant’s existing org, then invoice provenance succeeds', async () => {
    const attached = await attachParticipantWorkspaceAttribution({
      userId: SARAH.id,
      newOrganizationId: SARAH_ORG,
      hint: { kind: 'hint', value: PARTICIPANT },
    });
    expect(attached).toEqual({ attached: true, participantId: PARTICIPANT });
    expect(participantUpdateMany).toHaveBeenCalledWith({
      where: {
        id: PARTICIPANT,
        authenticated_user_id: SARAH.id,
        converted_organization_id: null,
        source_organization_id: { not: null },
        NOT: { source_organization_id: SARAH_ORG },
      },
      data: {
        converted_organization_id: SARAH_ORG,
        converted_at: expect.any(Date),
      },
    });
    const update = participantUpdateMany.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(update.data).not.toHaveProperty('source_organization_id');
    expect(update.data).not.toHaveProperty('authenticated_user_id');

    participantFindUnique.mockResolvedValue(sarahParticipantRecord(SARAH_ORG));
    const provenance = await resolveParticipantPortalInvoiceProvenance({
      user: SARAH,
      organizationId: SARAH_ORG,
      sourceParticipantId: PARTICIPANT,
    });
    expect(provenance.kind).toBe('ok');
    if (provenance.kind !== 'ok') return;
    expect(provenance.provenance).toEqual({
      invoiceOrigin: 'participant_portal',
      originParticipantId: PARTICIPANT,
      originSourceOrganizationId: SOURCE_ORG,
      originDealId: DEAL,
    });
  });

  it('cannot attach another user’s organisation', async () => {
    membershipFind.mockResolvedValue(null);
    orgFind.mockResolvedValue({ id: JAKE_ORG });
    const attached = await attachParticipantWorkspaceAttribution({
      userId: SARAH.id,
      newOrganizationId: JAKE_ORG,
      hint: { kind: 'hint', value: PARTICIPANT },
    });
    expect(attached).toEqual({ attached: false, participantId: null });
    expect(participantUpdateMany).not.toHaveBeenCalled();

    participantFindUnique.mockResolvedValue(sarahParticipantRecord(null));
    const provenance = await resolveParticipantPortalInvoiceProvenance({
      user: SARAH,
      organizationId: JAKE_ORG,
      sourceParticipantId: PARTICIPANT,
    });
    expect(provenance.kind).toBe('denied');
  });

  it('does not attach organiser preview and denies organiser provenance', async () => {
    participantFindMany.mockResolvedValue([]);
    const attached = await attachParticipantWorkspaceAttribution({
      userId: ORGANISER.id,
      newOrganizationId: SOURCE_ORG,
      hint: { kind: 'hint', value: PARTICIPANT },
    });
    expect(attached).toEqual({ attached: false, participantId: null });
    expect(participantUpdateMany).not.toHaveBeenCalled();

    participantFindUnique.mockResolvedValue(sarahParticipantRecord(null));
    const provenance = await resolveParticipantPortalInvoiceProvenance({
      user: ORGANISER,
      organizationId: SOURCE_ORG,
      sourceParticipantId: PARTICIPANT,
    });
    expect(provenance.kind).toBe('denied');
  });

  it('keeps an already-correct converted organisation unchanged and provenance still succeeds', async () => {
    participantFindMany.mockResolvedValue([]);
    const attached = await attachParticipantWorkspaceAttribution({
      userId: SARAH.id,
      newOrganizationId: SARAH_ORG,
      hint: { kind: 'hint', value: PARTICIPANT },
    });
    expect(attached).toEqual({ attached: false, participantId: null });
    expect(participantUpdateMany).not.toHaveBeenCalled();

    participantFindUnique.mockResolvedValue(sarahParticipantRecord(SARAH_ORG));
    const provenance = await resolveParticipantPortalInvoiceProvenance({
      user: SARAH,
      organizationId: SARAH_ORG,
      sourceParticipantId: PARTICIPANT,
    });
    expect(provenance.kind).toBe('ok');
  });

  it('does not let Jake claim Sarah’s provenance against his own org', async () => {
    participantFindUnique.mockResolvedValue(sarahParticipantRecord(SARAH_ORG));
    const provenance = await resolveParticipantPortalInvoiceProvenance({
      user: JAKE,
      organizationId: JAKE_ORG,
      sourceParticipantId: PARTICIPANT,
    });
    expect(provenance.kind).toBe('denied');
  });
});
