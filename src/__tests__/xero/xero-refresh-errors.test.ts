import {
  classifyXeroRefreshFailure,
  isRetryableXeroRefreshCategory,
  sanitizeXeroRefreshMessage,
  toXeroRefreshFailureDiagnostics,
  XeroRefreshError,
} from '@/lib/xero/xero-refresh-errors';

describe('classifyXeroRefreshFailure', () => {
  it('classifies HTTP 400 + invalid_grant as invalid_grant and keeps the provider code', () => {
    const classified = classifyXeroRefreshFailure({
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: {
          error: 'invalid_grant',
          error_description: 'Invalid refresh_token',
        },
      },
    });

    expect(classified).toEqual({
      category: 'invalid_grant',
      statusCode: 400,
      providerError: 'invalid_grant',
      message: 'Invalid refresh_token',
    });
  });

  it('classifies HTTP 401 as invalid_grant', () => {
    const classified = classifyXeroRefreshFailure({
      message: 'unauthorized',
      response: { status: 401 },
    });

    expect(classified.category).toBe('invalid_grant');
    expect(classified.statusCode).toBe(401);
  });

  it('classifies HTTP 429 as transient', () => {
    const classified = classifyXeroRefreshFailure({
      message: 'Too Many Requests',
      response: { status: 429 },
    });

    expect(classified.category).toBe('transient');
    expect(classified.statusCode).toBe(429);
  });

  it('classifies HTTP 500+ as transient', () => {
    expect(
      classifyXeroRefreshFailure({ message: 'bad gateway', response: { status: 503 } })
    ).toMatchObject({
      category: 'transient',
      statusCode: 503,
    });
    expect(
      classifyXeroRefreshFailure({ message: 'internal error', response: { status: 500 } })
    ).toMatchObject({
      category: 'transient',
      statusCode: 500,
    });
  });

  it('classifies network timeout and connection errors as transient', () => {
    expect(classifyXeroRefreshFailure(new Error('fetch failed')).category).toBe('transient');
    expect(classifyXeroRefreshFailure(new Error('ETIMEDOUT')).category).toBe('transient');

    const timeout = classifyXeroRefreshFailure({
      code: 'ETIMEDOUT',
      message: 'connect ETIMEDOUT 127.0.0.1:443',
    });
    expect(timeout.category).toBe('transient');
    expect(timeout.providerError).toBe('ETIMEDOUT');
  });

  it('classifies Prisma and database persistence failures as persist_failed', () => {
    expect(
      classifyXeroRefreshFailure(new Error('prisma.xero_connections.update failed')).category
    ).toBe('persist_failed');
    expect(classifyXeroRefreshFailure(new Error('database write failed')).category).toBe(
      'persist_failed'
    );

    const prismaError = Object.assign(new Error('Timed out fetching a new connection from the pool'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2024',
    });
    expect(classifyXeroRefreshFailure(prismaError)).toMatchObject({
      category: 'persist_failed',
      providerError: 'P2024',
    });
  });

  it('classifies programming TypeErrors as internal, not transient', () => {
    const classified = classifyXeroRefreshFailure(
      new TypeError("Cannot read properties of undefined (reading 'refresh')")
    );
    expect(classified.category).toBe('internal');
    expect(isRetryableXeroRefreshCategory(classified.category)).toBe(false);
  });

  it('classifies missing OpenID client as internal', () => {
    expect(
      classifyXeroRefreshFailure(
        new Error('Xero OpenID client is not initialized; cannot refresh tokens')
      ).category
    ).toBe('internal');
  });

  it('does not treat malformed or unrecognised provider errors as transient', () => {
    const classified = classifyXeroRefreshFailure({
      message: 'TokenSet missing access_token',
      response: { status: 418, body: { unexpected: true } },
    });

    expect(classified.category).toBe('unclassified');
    expect(classified.statusCode).toBe(418);
    expect(classified.providerError).toBeNull();
    expect(classified.message).toBe('TokenSet missing access_token');
  });

  it('preserves XeroRefreshError categories', () => {
    const error = new XeroRefreshError('db write failed', 'persist_failed');
    expect(classifyXeroRefreshFailure(error).category).toBe('persist_failed');
  });

  it('sanitizes credentials out of diagnostic messages', () => {
    const classified = classifyXeroRefreshFailure(
      new Error(
        'refresh failed Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb access_token=secret-access refresh_token=secret-refresh client_secret=super-secret'
      )
    );

    expect(classified.message).not.toMatch(/secret-access|secret-refresh|super-secret|eyJhbGciOi/);
    expect(classified.message).toContain('[redacted]');
    expect(sanitizeXeroRefreshMessage(classified.message)).toBe(classified.message);

    const diagnostics = toXeroRefreshFailureDiagnostics(classified);
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /secret-access|secret-refresh|super-secret|Bearer eyJ/
    );
  });
});
