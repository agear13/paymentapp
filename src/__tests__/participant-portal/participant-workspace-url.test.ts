import {
  buildCanonicalParticipantWorkspaceUrl,
  buildParticipantWorkspaceUrl,
  participantWorkspacePath,
} from '@/lib/participant-portal/participant-portal-url';

const TOKEN = '9c1e725e-45fd-4456-bf45-db4d710addf4';

function mockRequest(input: {
  origin: string;
  protocol?: string;
  headers?: Record<string, string>;
}) {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    nextUrl: { origin: input.origin, protocol: input.protocol ?? 'https:' },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe('canonical participant workspace URL', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_INFRASTRUCTURE_DOMAINS;
    delete process.env.RENDER;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER_EXTERNAL_HOSTNAME;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    delete process.env.TRUST_PROXY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps the canonical /participant/{token} path', () => {
    expect(participantWorkspacePath(TOKEN)).toBe(`/participant/${TOKEN}`);
  });

  it('never emits https://localhost:10000 for a deployed Render copy-link request', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    const url = buildCanonicalParticipantWorkspaceUrl(
      TOKEN,
      mockRequest({
        origin: 'https://localhost:10000',
        headers: {
          host: 'localhost:10000',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.provvypay.com',
        },
      })
    );

    expect(url).toBe(`https://app.provvypay.com/participant/${TOKEN}`);
    expect(url).not.toContain('localhost');
    expect(url).not.toContain('10000');
  });

  it('still rejects a raw nextUrl.origin of localhost:10000 in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    expect(buildParticipantWorkspaceUrl(TOKEN, 'https://localhost:10000')).toBe(
      `https://app.provvypay.com/participant/${TOKEN}`
    );
  });

  it('uses the staging public origin for invitation emails, not production env', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.provvypay.com';

    const url = buildCanonicalParticipantWorkspaceUrl(
      TOKEN,
      mockRequest({
        origin: 'https://localhost:10000',
        headers: {
          host: 'localhost:10000',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'staging.provvypay.com',
        },
      })
    );

    expect(url).toBe(`https://staging.provvypay.com/participant/${TOKEN}`);
  });

  it('generates the local origin during development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;

    const url = buildCanonicalParticipantWorkspaceUrl(
      TOKEN,
      mockRequest({
        origin: 'http://localhost:3000',
        protocol: 'http:',
        headers: { host: 'localhost:3000' },
      })
    );

    expect(url).toBe(`http://localhost:3000/participant/${TOKEN}`);
  });

  it('uses the same canonical URL for invitation emails as copy approval link', () => {
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    process.env.NEXT_PUBLIC_APP_URL = 'https://provvypay-api.onrender.com';
    process.env.ALLOW_INFRASTRUCTURE_DOMAINS = 'true';

    const request = mockRequest({
      origin: 'https://localhost:10000',
      headers: {
        host: 'localhost:10000',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'provvypay-api.onrender.com',
      },
    });
    const copied = buildCanonicalParticipantWorkspaceUrl(TOKEN, request);
    const emailed = buildParticipantWorkspaceUrl(TOKEN, copied.replace(`/participant/${TOKEN}`, ''));

    expect(copied).toBe(`https://provvypay-api.onrender.com/participant/${TOKEN}`);
    expect(emailed).toBe(copied);
    expect(copied).not.toContain('localhost');
  });

  it('can still emit localhost when the local origin is explicitly configured', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(
      buildCanonicalParticipantWorkspaceUrl(
        TOKEN,
        mockRequest({
          origin: 'http://localhost:10000',
          protocol: 'http:',
          headers: { host: 'localhost:10000' },
        })
      )
    ).toBe(`http://localhost:10000/participant/${TOKEN}`);
  });
});
