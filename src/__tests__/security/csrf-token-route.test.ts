import { NextRequest } from 'next/server';
import { GET } from '@/app/api/security/csrf-token/route';
import { createSignedCsrfToken } from '@/lib/security/csrf';

process.env.CSRF_SECRET = 'test-csrf-secret-minimum-32-characters';
process.env.RELAX_ENV_VALIDATION = '1';

function makeCsrfTokenRequest(cookieToken?: string) {
  const headers = cookieToken
    ? new Headers({ cookie: `csrf_token=${cookieToken}` })
    : undefined;

  return new NextRequest('http://localhost/api/security/csrf-token', { headers });
}

describe('GET /api/security/csrf-token', () => {
  it('reuses an existing valid csrf_token cookie instead of rotating', async () => {
    const existing = createSignedCsrfToken();
    const response = await GET(makeCsrfTokenRequest(existing));
    const body = (await response.json()) as { csrfToken: string };

    expect(response.status).toBe(200);
    expect(body.csrfToken).toBe(existing);
  });

  it('reuses a percent-encoded csrf_token cookie instead of rotating', async () => {
    const existing = createSignedCsrfToken();
    const response = await GET(makeCsrfTokenRequest(encodeURIComponent(existing)));
    const body = (await response.json()) as { csrfToken: string };

    expect(response.status).toBe(200);
    expect(body.csrfToken).toBe(existing);
  });

  it('issues a new signed token when the cookie is missing', async () => {
    const response = await GET(makeCsrfTokenRequest());
    const body = (await response.json()) as { csrfToken: string };

    expect(response.status).toBe(200);
    expect(typeof body.csrfToken).toBe('string');
    expect(body.csrfToken.split('.')).toHaveLength(2);
  });

  it('issues a new signed token when the cookie signature is invalid', async () => {
    const existing = createSignedCsrfToken();
    const invalid = `${existing.split('.')[0]}.invalid-signature`;

    const response = await GET(makeCsrfTokenRequest(invalid));
    const body = (await response.json()) as { csrfToken: string };

    expect(response.status).toBe(200);
    expect(body.csrfToken).not.toBe(invalid);
    expect(body.csrfToken.split('.')).toHaveLength(2);
  });
});
