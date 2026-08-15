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
import { POST } from '@/app/api/payment-links/route';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

const mockRequireAuth = requireAuth as jest.Mock;
const mockGetOrg = getOrganizationForAuthenticatedUser as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockInsert = insertPaymentLinkInTransaction as jest.Mock;

describe('POST /api/payment-links validation errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: USER_ID, email: 'merchant@example.com' },
      response: null,
    });
    mockGetOrg.mockResolvedValue({ id: ORG_ID, name: 'Test Org' });
  });

  it('accepts Australian local phone and persists normalized E.164', async () => {
    mockInsert.mockImplementation(async (_tx, args) => ({
      id: 'pl-1',
      short_code: 'test1234',
      status: 'ACTIVE',
      organization_id: ORG_ID,
      amount: args.validatedData.amount,
      currency: 'AUD',
      customer_phone: args.validatedData.customerPhone,
    }));
    mockTransaction.mockImplementation(async (fn) => fn({}));

    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        amount: 1500,
        currency: 'AUD',
        invoiceCurrency: 'AUD',
        description: 'Consulting services',
        invoiceDate: new Date('2026-08-14T12:00:00.000Z').toISOString(),
        dueDate: new Date('2026-08-28T12:00:00.000Z').toISOString(),
        invoiceReference: 'INV-0042',
        customerName: 'Danielle Test',
        customerEmail: 'client@example.com',
        customerPhone: '0412345678',
        invoiceOnlyMode: false,
        paymentMethod: 'STRIPE',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        validatedData: expect.objectContaining({
          customerPhone: '+61412345678',
        }),
      })
    );
  });

  it('returns structured validation details for invalid customerPhone', async () => {
    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        amount: 1500,
        currency: 'AUD',
        invoiceCurrency: 'AUD',
        description: 'Consulting services',
        invoiceDate: new Date('2026-08-14T12:00:00.000Z').toISOString(),
        dueDate: new Date('2026-08-28T12:00:00.000Z').toISOString(),
        invoiceReference: 'INV-0042',
        customerName: 'Danielle Test',
        customerEmail: 'client@example.com',
        customerPhone: '041234567',
        invoiceOnlyMode: false,
        paymentMethod: 'STRIPE',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation error');
    expect(body.details[0]).toMatchObject({
      field: 'customerPhone',
      message: expect.stringContaining('valid phone number'),
    });
    expect(JSON.stringify(body)).not.toContain('041234567');
  });

  it('persists payment_method = null when customerChoosesAtCheckout is true', async () => {
    mockInsert.mockImplementation(async (_tx, args) => ({
      id: 'pl-2',
      short_code: 'test5678',
      status: 'ACTIVE',
      organization_id: ORG_ID,
      payment_method: args.resolvedPaymentMethod,
    }));
    mockTransaction.mockImplementation(async (fn) => fn({}));

    const request = new NextRequest('http://localhost/api/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: ORG_ID,
        amount: 1500,
        currency: 'AUD',
        invoiceCurrency: 'AUD',
        description: 'Consulting services',
        invoiceDate: new Date('2026-08-14T12:00:00.000Z').toISOString(),
        dueDate: new Date('2026-08-28T12:00:00.000Z').toISOString(),
        customerName: 'Beth',
        customerEmail: 'client@example.com',
        invoiceOnlyMode: false,
        customerChoosesAtCheckout: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        resolvedPaymentMethod: null,
      })
    );
  });
});
