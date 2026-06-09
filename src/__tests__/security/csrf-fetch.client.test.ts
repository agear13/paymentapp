/**
 * @jest-environment jsdom
 */

import {
  csrfAwareFetch,
  ensureClientCsrfReady,
  getClientCsrfToken,
  resetClientCsrfStateForTests,
} from '@/lib/security/csrf-fetch.client';
import { getProvvyPayCsrfGlobal } from '@/lib/security/csrf-global.client';

const SIGNED_TOKEN = 'csrf-random-part.csrf-signature-part';

describe('ensureClientCsrfReady', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetClientCsrfStateForTests();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetClientCsrfStateForTests();
    global.fetch = originalFetch;
  });

  it('returns immediately when a token is already installed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: SIGNED_TOKEN }),
    });

    await ensureClientCsrfReady();
    expect(getClientCsrfToken()).toBe(SIGNED_TOKEN);

    await ensureClientCsrfReady();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/security/csrf-token', {
      credentials: 'include',
    });
  });

  it('deduplicates concurrent bootstrap requests', async () => {
    let resolveBootstrap: (() => void) | null = null;
    const bootstrapPromise = new Promise<Response>((resolve) => {
      resolveBootstrap = () =>
        resolve({
          ok: true,
          json: async () => ({ csrfToken: SIGNED_TOKEN }),
        } as Response);
    });

    fetchMock.mockReturnValueOnce(bootstrapPromise);

    const first = ensureClientCsrfReady();
    const second = ensureClientCsrfReady();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveBootstrap?.();
    await Promise.all([first, second]);

    expect(getClientCsrfToken()).toBe(SIGNED_TOKEN);
  });

  it('shares bootstrap state across separate global accessors (duplicate bundles)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: SIGNED_TOKEN }),
    });

    const stateA = getProvvyPayCsrfGlobal();
    const stateB = getProvvyPayCsrfGlobal();
    expect(stateA).toBe(stateB);

    const first = ensureClientCsrfReady();
    const second = ensureClientCsrfReady();

    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stateA.csrfToken).toBe(SIGNED_TOKEN);
    expect(stateB.csrfToken).toBe(SIGNED_TOKEN);
  });
});

describe('csrfAwareFetch onboarding mutations', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetClientCsrfStateForTests();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetClientCsrfStateForTests();
    global.fetch = originalFetch;
  });

  it('bootstraps CSRF before the first authenticated POST', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: SIGNED_TOKEN }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { organizationId: 'org_1' } }),
      });

    const response = await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: 'Acme' }),
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/security/csrf-token', {
      credentials: 'include',
    });

    const mutationCall = fetchMock.mock.calls[1];
    expect(mutationCall[0]).toBe('/api/onboarding/bootstrap-workspace');
    expect(mutationCall[1]?.headers?.get('x-csrf-token')).toBe(SIGNED_TOKEN);
  });

  it('skips bootstrap fetch for later mutations once the token is ready', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: SIGNED_TOKEN }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: 'Acme' }),
    });

    await csrfAwareFetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org_1', state: { step: 'start_method' } }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/security/csrf-token', {
      credentials: 'include',
    });

    const patchCall = fetchMock.mock.calls[2];
    expect(patchCall[0]).toBe('/api/onboarding');
    expect(patchCall[1]?.headers?.get('x-csrf-token')).toBe(SIGNED_TOKEN);
  });

  it('reads the latest token from global state when the interceptor runs', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: SIGNED_TOKEN }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    await ensureClientCsrfReady();

    const state = getProvvyPayCsrfGlobal();
    const updatedToken = 'updated-token.updated-signature';
    state.csrfToken = updatedToken;

    await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceName: 'Acme' }),
    });

    const mutationCall = fetchMock.mock.calls[1];
    expect(mutationCall[1]?.headers?.get('x-csrf-token')).toBe(updatedToken);
  });
});
