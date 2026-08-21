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
      updateMany: jest.fn(),
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
import { revokeConnection } from '@/lib/xero/client';
import {
  disconnectXero,
  getConnectionStatus,
  getValidAccessToken,
} from '@/lib/xero/connection-service';

const ORG_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const findUnique = prisma.xero_connections.findUnique as jest.Mock;
const upsert = prisma.xero_connections.upsert as jest.Mock;
const remove = prisma.xero_connections.delete as jest.Mock;
const updateMany = prisma.xero_connections.updateMany as jest.Mock;
const mockRevokeConnection = revokeConnection as jest.Mock;

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
  token_version: number;
  last_refresh_at: Date | null;
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
        update: Partial<ConnectionRow> & { token_version?: { increment: number } };
      }) => {
        const nextVersion = row
          ? (row.token_version ?? 0) + (update.token_version?.increment ?? 0)
          : create.token_version ?? 0;
        const { token_version: _ignored, ...restUpdate } = update;
        row = row
          ? { ...row, ...restUpdate, token_version: nextVersion, organization_id: where.organization_id }
          : { ...create, organization_id: where.organization_id };
        return { ...row };
      }
    );

    updateMany.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { organization_id: string; token_version: number };
        data: Partial<ConnectionRow> & { token_version?: { increment: number } };
      }) => {
        if (!row || row.organization_id !== where.organization_id) {
          return { count: 0 };
        }
        if ((row.token_version ?? 0) !== where.token_version) {
          return { count: 0 };
        }
        const { token_version: _ignored, ...rest } = data;
        row = {
          ...row,
          ...rest,
          token_version: (row.token_version ?? 0) + (data.token_version?.increment ?? 1),
        };
        return { count: 1 };
      }
    );

    remove.mockImplementation(async ({ where }: { where: { organization_id: string } }) => {
      if (row && row.organization_id === where.organization_id) {
        row = null;
      }
    });
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
      token_version: 0,
      last_refresh_at: null,
      ...overrides,
    };
  }

  it('returns disconnected when no xero_connections row exists', async () => {
    const status = await getConnectionStatus(ORG_ID);
    expect(status).toEqual({ connected: false, connectionState: 'DISCONNECTED' });
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('uses a valid access token without refreshing', async () => {
    persistRow({ expires_at: new Date(Date.now() + 30 * 60 * 1000) });

    const token = await getValidAccessToken(ORG_ID);

    expect(token).toBe('access-old');
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('marks AUTH_REAUTH_REQUIRED when the refresh token is invalid', async () => {
    persistRow();
    mockRefreshAccessToken.mockRejectedValue(new Error('invalid_grant'));

    const status = await getConnectionStatus(ORG_ID);

    expect(status.connected).toBe(true);
    expect(status.stale).toBe(true);
    expect(status.reauthorizationRequired).toBe(true);
    expect(status.connectionState).toBe('AUTH_REAUTH_REQUIRED');
    expect(status.transientRefreshFailure).toBeUndefined();
    expect(mockRefreshAccessToken).toHaveBeenCalled();
  });

  it('does not mark reconnect required on a transient refresh failure', async () => {
    persistRow();
    mockRefreshAccessToken.mockRejectedValue(new Error('fetch failed'));

    const status = await getConnectionStatus(ORG_ID);

    expect(status.connected).toBe(true);
    expect(status.stale).toBeUndefined();
    expect(status.reauthorizationRequired).toBeUndefined();
    expect(status.transientRefreshFailure).toBe(true);
    expect(status.connectionState).toBe('ERROR');
  });

  it('does not treat a decryptable persisted connection as disconnected', async () => {
    persistRow({ expires_at: new Date(Date.now() + 30 * 60 * 1000) });

    const status = await getConnectionStatus(ORG_ID);

    expect(status.connected).toBe(true);
    expect(status.stale).toBeUndefined();
    expect(status.connectionState).toBe('AUTHENTICATED');
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('persists both rotated access and refresh tokens on successful refresh', async () => {
    persistRow();
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      idToken: 'id-new',
      scope: 'offline_access accounting.transactions accounting.contacts accounting.settings.read',
      tokenType: 'Bearer',
    });

    const token = await getValidAccessToken(ORG_ID);

    expect(token).toBe('access-new');
    expect(decryptToken(row!.refresh_token)).toBe('refresh-new');
    expect(decryptToken(row!.access_token)).toBe('access-new');
    expect(row!.token_version).toBe(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: ORG_ID, token_version: 0 },
      })
    );
  });

  it('does not leave partial credentials when persistence fails', async () => {
    persistRow();
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      tokenType: 'Bearer',
    });
    updateMany.mockRejectedValueOnce(new Error('database write failed'));

    const token = await getValidAccessToken(ORG_ID);

    expect(token).toBeNull();
    expect(decryptToken(row!.access_token)).toBe('access-old');
    expect(decryptToken(row!.refresh_token)).toBe('refresh-old');
    expect(row!.token_version).toBe(0);
  });

  it('does not persist a losing refresh token when another writer already rotated', async () => {
    persistRow();
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'access-loser',
      refreshToken: 'refresh-loser',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      tokenType: 'Bearer',
    });
    updateMany.mockImplementationOnce(async () => {
      row = {
        ...row!,
        access_token: encryptToken('access-winner'),
        refresh_token: encryptToken('refresh-winner'),
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
        token_version: 1,
      };
      return { count: 0 };
    });

    const token = await getValidAccessToken(ORG_ID);

    expect(token).toBe('access-winner');
    expect(decryptToken(row!.refresh_token)).toBe('refresh-winner');
    expect(decryptToken(row!.refresh_token)).not.toBe('refresh-loser');
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
    expect(decryptToken(row!.refresh_token)).toBe('refresh-old');
    expect(row!.token_version).toBe(1);
  });

  it('deletes the local connection even when Xero revoke fails', async () => {
    persistRow({ expires_at: new Date(Date.now() + 30 * 60 * 1000) });
    mockRevokeConnection.mockRejectedValue(new Error('xero unavailable'));

    await disconnectXero(ORG_ID);

    expect(remove).toHaveBeenCalledWith({ where: { organization_id: ORG_ID } });
    expect(await getConnectionStatus(ORG_ID)).toEqual({
      connected: false,
      connectionState: 'DISCONNECTED',
    });
  });

  it('deletes an undecryptable persisted row so the workspace can reconnect', async () => {
    persistRow({
      access_token: 'not-valid-ciphertext',
      refresh_token: 'not-valid-ciphertext',
    });

    await disconnectXero(ORG_ID);

    expect(mockRevokeConnection).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith({ where: { organization_id: ORG_ID } });
    expect(await getConnectionStatus(ORG_ID)).toEqual({
      connected: false,
      connectionState: 'DISCONNECTED',
    });
  });
});
