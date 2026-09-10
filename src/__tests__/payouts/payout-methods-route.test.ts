import { NextRequest } from 'next/server';

jest.mock('@/lib/rate-limit', () => ({
  applyRateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/supabase/middleware', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@/lib/auth/get-org', () => ({
  getOrganizationForAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/auth/admin-shared', () => ({
  isBetaAdminEmail: jest.fn().mockReturnValue(true),
}));

jest.mock('@/lib/auth/step-up.server', () => ({
  assertRecentStepUp: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    payment: { info: jest.fn() },
  },
}));

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payout_methods: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { GET, POST } from '@/app/api/payout-methods/route';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/payout-methods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/payout-methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      user: { id: USER_ID, email: 'admin@example.com' },
      response: null,
    });
    (getOrganizationForAuthenticatedUser as jest.Mock).mockResolvedValue({ id: ORG_ID });
    mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'method-1',
      ...data,
    }));
  });

  it('creates BANK_TRANSFER without details', async () => {
    const response = await POST(
      postRequest({
        methodType: 'BANK_TRANSFER',
        handle: 'notes-only',
        notes: 'Pay by bank',
      })
    );
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method_type: 'BANK_TRANSFER',
        handle: 'notes-only',
        details: undefined,
        hedera_account_id: undefined,
      }),
    });
  });

  it('creates CRYPTO with valid destination details', async () => {
    const response = await POST(
      postRequest({
        methodType: 'CRYPTO',
        details: {
          address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
          asset: 'USDT',
          network: 'tron',
        },
      })
    );
    const json = await response.json();
    expect(response.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.details).toEqual({
      address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      asset: 'USDT',
      network: 'tron',
    });
    expect(json.data.details).toEqual({
      address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      asset: 'USDT',
      network: 'tron',
    });
    expect(json.data.handle).toBe('TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS');
  });

  it('creates CRYPTO without details for backwards compatibility', async () => {
    const response = await POST(
      postRequest({
        methodType: 'CRYPTO',
        handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      })
    );
    expect(response.status).toBe(201);
    expect(mockCreate.mock.calls[0][0].data.details).toBeUndefined();
  });

  it('rejects malformed CRYPTO details and secrets', async () => {
    const malformed = await POST(
      postRequest({
        methodType: 'CRYPTO',
        details: { asset: 'USDT' },
      })
    );
    expect(malformed.status).toBe(400);

    const secrets = await POST(
      postRequest({
        methodType: 'CRYPTO',
        details: {
          address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
          asset: 'USDT',
          network: 'tron',
          apiKey: 'should-not-store',
        },
      })
    );
    expect(secrets.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('preserves Hedera account id and does not require details', async () => {
    const response = await POST(
      postRequest({
        methodType: 'HEDERA',
        hederaAccountId: '0.0.12345',
      })
    );
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method_type: 'HEDERA',
        hedera_account_id: '0.0.12345',
        details: undefined,
      }),
    });
  });
});

describe('GET /api/payout-methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockResolvedValue({
      user: { id: USER_ID, email: 'admin@example.com' },
      response: null,
    });
    (getOrganizationForAuthenticatedUser as jest.Mock).mockResolvedValue({ id: ORG_ID });
  });

  it('returns persisted details and hides secret-bearing rows', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'm1',
        user_id: USER_ID,
        method_type: 'CRYPTO',
        handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        notes: null,
        is_default: true,
        status: 'ACTIVE',
        hedera_account_id: null,
        details: {
          address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
          asset: 'USDT',
          network: 'tron',
          apiKey: 'nope',
        },
        created_at: new Date('2026-09-09T00:00:00.000Z'),
      },
    ]);

    const response = await GET(
      new NextRequest(`http://localhost/api/payout-methods?userId=${USER_ID}`)
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data[0].details).toBeNull();
  });

  it('returns valid persisted destination details', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'm2',
        user_id: USER_ID,
        method_type: 'CRYPTO',
        handle: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
        notes: null,
        is_default: true,
        status: 'ACTIVE',
        hedera_account_id: null,
        details: {
          address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
          asset: 'USDT',
          network: 'tron',
        },
        created_at: new Date('2026-09-09T00:00:00.000Z'),
      },
    ]);

    const response = await GET(
      new NextRequest(`http://localhost/api/payout-methods?userId=${USER_ID}`)
    );
    const json = await response.json();
    expect(json.data[0].details).toEqual({
      address: 'TXsmKpEuW7qWnXzJLGP9eDLvWPR2GRn1FS',
      asset: 'USDT',
      network: 'tron',
    });
  });
});
