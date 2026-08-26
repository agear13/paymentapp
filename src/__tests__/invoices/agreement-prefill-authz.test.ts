import { loadAuthorizedAgreementInvoicePrefill } from '@/lib/invoices/agreement-invoice-prefill.server';

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
    deal_network_pilot_participants: {
      findUnique: jest.fn(),
    },
  },
}));

import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';

const mockOrg = getOrganizationForAuthenticatedUser as jest.Mock;
const mockFindUnique = prisma.deal_network_pilot_participants.findUnique as jest.Mock;

const SARAH_USER = { id: 'user-sarah', email: 'sarah@example.com' };
const ORGANISER = { id: 'user-organiser', email: 'organiser@example.com' };
const CONVERTED_ORG = 'org-sarah-converted';
const SOURCE_ORG = 'org-saturday-beach-organiser';

const sarahRow = {
  id: 'p-sarah-1',
  email: 'sarah@example.com',
  authenticated_user_id: SARAH_USER.id,
  converted_organization_id: CONVERTED_ORG,
  source_organization_id: SOURCE_ORG,
  deal_id: 'aiwf-saturday-beach',
  participant_payload: {
    id: 'p-sarah-1',
    name: 'Sarah Williams',
    role: 'Contributor',
    roleDetails: 'Producer',
    commissionKind: 'fixed_amount',
    commissionValue: 6000,
    compensationProfile: { compensationType: 'FIXED_FEE', fixedAmount: 6000 },
    status: 'Confirmed',
    inviteToken: 'tok-sarah',
    approvalStatus: 'Approved',
  },
  deal: {
    id: 'aiwf-saturday-beach',
    user_id: ORGANISER.id,
    deal_payload: {
      dealName: 'Saturday Beach Event',
      partner: 'Apex Promotions Pty Ltd',
      value: 25000,
      projectValueCurrency: 'AUD',
      payoutTrigger: 'upon approval of the event plan',
    },
  },
};

describe('loadAuthorizedAgreementInvoicePrefill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(sarahRow);
    mockOrg.mockResolvedValue({ id: CONVERTED_ORG, name: 'Sarah workspace' });
  });

  it('returns Sarah’s party-owned amount for the bound participant in her converted org', async () => {
    const result = await loadAuthorizedAgreementInvoicePrefill({
      user: SARAH_USER,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.prefill.amount).toBe(6000);
    expect(result.prefill.originSourceOrganizationId).toBe(SOURCE_ORG);
    expect(result.prefill.originDealId).toBe('aiwf-saturday-beach');
    expect(result.prefill.amount).not.toBe(12500);
  });

  it('denies the originating organiser (operator preview is not invoice authority)', async () => {
    const result = await loadAuthorizedAgreementInvoicePrefill({
      user: ORGANISER,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('denied');
  });

  it('denies a converted participant whose current org is not the converted workspace', async () => {
    mockOrg.mockResolvedValue({ id: 'org-someone-else', name: 'Other' });
    const result = await loadAuthorizedAgreementInvoicePrefill({
      user: SARAH_USER,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('denied');
  });
});

describe('resolveParticipantPortalInvoiceProvenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(sarahRow);
    mockOrg.mockResolvedValue({ id: CONVERTED_ORG, name: 'Sarah workspace' });
  });

  it('returns participant_portal provenance for Sarah’s converted organisation', async () => {
    const { resolveParticipantPortalInvoiceProvenance } = await import(
      '@/lib/invoices/agreement-invoice-prefill.server'
    );
    const result = await resolveParticipantPortalInvoiceProvenance({
      user: SARAH_USER,
      organizationId: CONVERTED_ORG,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.provenance).toEqual({
      invoiceOrigin: 'participant_portal',
      originParticipantId: 'p-sarah-1',
      originSourceOrganizationId: SOURCE_ORG,
      originDealId: 'aiwf-saturday-beach',
    });
  });

  it('denies an authenticated user claiming another participant’s provenance', async () => {
    const { resolveParticipantPortalInvoiceProvenance } = await import(
      '@/lib/invoices/agreement-invoice-prefill.server'
    );
    const result = await resolveParticipantPortalInvoiceProvenance({
      user: { id: 'user-jake', email: 'jake@example.com' },
      organizationId: CONVERTED_ORG,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('denied');
  });

  it('denies the originating organiser', async () => {
    const { resolveParticipantPortalInvoiceProvenance } = await import(
      '@/lib/invoices/agreement-invoice-prefill.server'
    );
    const result = await resolveParticipantPortalInvoiceProvenance({
      user: ORGANISER,
      organizationId: CONVERTED_ORG,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('denied');
  });

  it('denies provenance when the session org is not the converted workspace', async () => {
    const { resolveParticipantPortalInvoiceProvenance } = await import(
      '@/lib/invoices/agreement-invoice-prefill.server'
    );
    const result = await resolveParticipantPortalInvoiceProvenance({
      user: SARAH_USER,
      organizationId: 'org-someone-else',
      sourceParticipantId: 'p-sarah-1',
    });
    expect(result.kind).toBe('denied');
  });
});
