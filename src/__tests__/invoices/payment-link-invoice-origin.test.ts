import { NextRequest } from 'next/server';

jest.mock('@/lib/payment-links/payment-link-post-create', () => ({
  runPaymentLinkPostCreateEffects: jest.fn(),
}));

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/supabase/middleware', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/entitlements/gate-api.server', () => ({
  requireEntitlement: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/auth/permissions', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/server/short-code', () => ({
  generateUniqueShortCode: jest.fn().mockResolvedValue('test1234'),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findFirst: jest.fn().mockResolvedValue({ default_currency: 'AUD' }),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/payment-links/create-payment-link-in-tx', () => ({
  insertPaymentLinkInTransaction: jest.fn(),
}));

jest.mock('@/lib/invoices/agreement-invoice-prefill.server', () => ({
  resolveParticipantPortalInvoiceProvenance: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    api: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    payment: { info: jest.fn() },
  },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  AuditEventType: { PAYMENT_LINK_CREATED: 'PAYMENT_LINK_CREATED' },
  logPaymentEvent: jest.fn(),
}));

jest.mock('@/lib/audit/request-context.server', () => ({
  extractRequestAuditContext: jest.fn().mockReturnValue({}),
}));

import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { insertPaymentLinkInTransaction } from '@/lib/payment-links/create-payment-link-in-tx';
import { resolveParticipantPortalInvoiceProvenance } from '@/lib/invoices/agreement-invoice-prefill.server';
import { POST } from '@/app/api/payment-links/route';

const CONVERTED_ORG = '550e8400-e29b-41d4-a716-446655440000';
const SOURCE_ORG = '660e8400-e29b-41d4-a716-446655440099';
const SARAH_USER = 'user-sarah';
const ORGANISER_DEAL = 'aiwf-saturday-beach';

const mockRequireAuth = requireAuth as jest.Mock;
const mockGetOrg = getOrganizationForAuthenticatedUser as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockInsert = insertPaymentLinkInTransaction as jest.Mock;
const mockResolveOrigin = resolveParticipantPortalInvoiceProvenance as jest.Mock;

const SARAH_PROVENANCE = {
  invoiceOrigin: 'participant_portal',
  originParticipantId: 'p-sarah-1',
  originSourceOrganizationId: SOURCE_ORG,
  originDealId: ORGANISER_DEAL,
};

function invoiceBody(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: CONVERTED_ORG,
    amount: 6000,
    currency: 'AUD',
    invoiceCurrency: 'AUD',
    description: 'Producer fee — Saturday Beach Event',
    customerName: 'Apex Promotions Pty Ltd',
    invoiceOnlyMode: true,
    ...overrides,
  };
}

describe('POST /api/payment-links participant portal provenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: SARAH_USER, email: 'sarah@example.com' },
      response: null,
    });
    mockGetOrg.mockResolvedValue({ id: CONVERTED_ORG, name: 'Sarah workspace' });
    mockInsert.mockImplementation(async (_tx, args) => ({
      id: 'pl-sarah-1',
      short_code: 'test1234',
      status: 'OPEN',
      organization_id: args.organizationId,
      amount: args.validatedData.amount,
      invoice_origin: args.invoiceOriginProvenance?.invoiceOrigin ?? null,
      origin_participant_id: args.invoiceOriginProvenance?.originParticipantId ?? null,
      origin_source_organization_id:
        args.invoiceOriginProvenance?.originSourceOrganizationId ?? null,
      origin_deal_id: args.invoiceOriginProvenance?.originDealId ?? null,
      pilot_deal_id: args.pilotDealIdToStore,
    }));
    mockTransaction.mockImplementation(async (fn) => fn({}));
    mockResolveOrigin.mockResolvedValue({ kind: 'ok', provenance: SARAH_PROVENANCE });
  });

  it('persists server-derived participant_portal provenance and leaves pilot_deal_id unset', async () => {
    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        invoiceBody({
          invoiceOrigin: 'participant_portal',
          sourceParticipantId: 'p-sarah-1',
          originDealId: 'spoofed-organiser-deal',
          originParticipantId: 'p-someone-else',
          originSourceOrganizationId: 'org-spoof',
        })
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockResolveOrigin).toHaveBeenCalledWith({
      user: { id: SARAH_USER, email: 'sarah@example.com' },
      organizationId: CONVERTED_ORG,
      sourceParticipantId: 'p-sarah-1',
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: CONVERTED_ORG,
        pilotDealIdToStore: null,
        invoiceOriginProvenance: SARAH_PROVENANCE,
      })
    );
    expect(mockInsert.mock.calls[0][1].validatedData).not.toHaveProperty('originDealId');
    expect(mockInsert.mock.calls[0][1].validatedData).not.toHaveProperty('pilotDealId');
  });

  it('does not attach participant_portal provenance to a normal manual create', async () => {
    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        invoiceBody({
          originDealId: ORGANISER_DEAL,
          originParticipantId: 'p-sarah-1',
          originSourceOrganizationId: SOURCE_ORG,
          invoice_origin: 'participant_portal',
          sourceParticipantId: 'p-sarah-1',
        })
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockResolveOrigin).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invoiceOriginProvenance: null,
        pilotDealIdToStore: null,
      })
    );
  });

  it('creates an ordinary invoice when participant-portal provenance cannot be resolved', async () => {
    mockResolveOrigin.mockResolvedValue({ kind: 'denied' });
    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        invoiceBody({
          invoiceOrigin: 'participant_portal',
          sourceParticipantId: 'p-sarah-1',
        })
      ),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invoiceOriginProvenance: null,
        pilotDealIdToStore: null,
      })
    );
    const json = (await response.json()) as { data: { invoiceOrigin?: string | null } };
    expect(json.data.invoiceOrigin).toBeNull();
  });

  it('returns server-stamped invoiceOrigin on a successful participant-portal create', async () => {
    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        invoiceBody({
          invoiceOrigin: 'participant_portal',
          sourceParticipantId: 'p-sarah-1',
        })
      ),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = (await response.json()) as { data: { invoiceOrigin?: string | null } };
    expect(json.data.invoiceOrigin).toBe('participant_portal');
  });
});
