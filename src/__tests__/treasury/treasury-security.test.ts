import {
  encryptTreasurySecret,
  decryptTreasurySecret,
  redactApiKeyMaterial,
} from '@/lib/treasury/integration/encryption';

describe('treasury credential encryption', () => {
  const original = process.env.TREASURY_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.TREASURY_ENCRYPTION_KEY = 'test-treasury-key-for-unit-tests';
  });

  afterAll(() => {
    if (original) process.env.TREASURY_ENCRYPTION_KEY = original;
    else delete process.env.TREASURY_ENCRYPTION_KEY;
  });

  it('encrypts and decrypts API keys', () => {
    const secret = 'ds-readonly-api-key-123456789';
    const encrypted = encryptTreasurySecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTreasurySecret(encrypted)).toBe(secret);
  });

  it('redacts API key for logs', () => {
    expect(redactApiKeyMaterial('abcdefghijklmnop')).toBe('abcd…mnop');
    expect(redactApiKeyMaterial('short')).toBe('***');
  });
});

describe('DigitalSurgeClient auth header', () => {
  it('never logs raw api key in client code path', async () => {
    const { DigitalSurgeClient } = await import('@/lib/treasury/connectors/digital-surge/client');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new DigitalSurgeClient('super-secret-key-value');
    await client.listAllTransactions({ page: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer super-secret-key-value',
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('console');
  });
});
