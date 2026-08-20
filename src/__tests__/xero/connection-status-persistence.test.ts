import { decryptToken, encryptToken } from '@/lib/xero/encryption';

const mockRefreshAccessToken = jest.fn();

jest.mock('@/lib/xero/client', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  getXeroTenants: jest.fn(),
  revokeConnection: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    xero_connections: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    xero: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';
import {
  getConnectionStatus,
  getValidAccessToken,
} from '@/lib/xero/connection-service';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const findUnique = prisma.xero_connections.findUnique as jest.Mock;
const upsert = prisma.xero_connections.upsert as jest.Mock;

type ConnectionRow = {
  id: string;
  organization_id: string;
  tenant_id: string;
  access_token: string;
  refresh_token: string;
  id_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: Date;
  connected_at: Date;
};

describe('Xero connection status persistence', () => {
  let row: ConnectionRow | null;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.XERO_ENCRYPTION_KEY = 'test-xero-status-persistence-key';
    row = null;

    findUnique.mockImplementation(async ({ where }: { where: { organization_id: string } }) =>
      row && row.organization_id === where.organization_id ? { ...row } : null
    );

    upsert.mockImplementation(
      async ({
        where,
        create,
        update,
      }: {
        where: { organization_id: string };
        create: ConnectionRow;
        update: Partial<ConnectionRow>;
      }) => {
        row = row
          ? { ...row, ...update, organization_id: where.organization_id }
          : { ...create, organization_id: where.organization_id };
        return { ...row };
      }
    );
  });

  function persistRow(overrides: Partial<ConnectionRow> = {}) {
    row = {
      id: 'conn-1',
      organization_id: ORG_ID,
      tenant_id: 'tenant-1',
      access_token: encryptToken('access-old'),
      refresh_token: encryptToken('refresh-old'),
      id_token: encryptToken('id-old'),
      token_type: 'Bearer',
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
      expires_at: new Date(Date.now() - 60_000),
      connected_at: new Date('2026-01-15T00:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns disconnected when no xero_connections row exists', async () => {
    const status = await getConnectionStatus(ORG_ID);
    expect(status).toEqual({ connected: false });
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('stays connected when the access token is expired and refresh fails', async () => {
    persistRow();
    mockRefreshAccessToken.mockRejectedValue(new Error('invalid_grant'));

    const status = await getConnectionStatus(ORG_ID);

    expect(status.connected).toBe(true);
    expect(status.stale).toBe(true);
    expect(status.tenantId).toBe('tenant-1');
    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it('does not treat a decryptable persisted connection as disconnected', async () => {
    persistRow({ expires_at: new Date(Date.now() + 30 * 60 * 1000) });

    const status = await getConnectionStatus(ORG_ID);

    expect(status.connected).toBe(true);
    expect(status.stale).toBeUndefined();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('serializes concurrent refreshes for the same organization', async () => {
    persistRow();
    mockRefreshAccessToken.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        idToken: 'id-new',
        scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
        tokenType: 'Bearer',
      };
    });

    const [first, second] = await Promise.all([
      getValidAccessToken(ORG_ID),
      getValidAccessToken(ORG_ID),
    ]);

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(first).toBe('access-new');
    expect(second).toBe('access-new');
    expect(mockRefreshAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
      })
    );
  });

  it('keeps the previous refresh token when Xero omits a rotated one', async () => {
    persistRow();
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: '',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      idToken: null,
      scope: null,
      tokenType: null,
    });

    const token = await getValidAccessToken(ORG_ID);

    expect(token).toBe('access-new');
    expect(decryptStoredRefresh()).toBe('refresh-old');
  });
});

function decryptStoredRefresh(): string {
  const lastUpsert = upsert.mock.calls.at(-1)?.[0];
  return decryptToken(lastUpsert.update.refresh_token);
}
