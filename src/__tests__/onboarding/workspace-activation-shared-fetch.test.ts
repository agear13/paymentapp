import {
  fetchSharedWorkspaceActivation,
  invalidateWorkspaceActivationSharedFetch,
  resetWorkspaceActivationSharedFetchForTests,
} from '@/lib/onboarding/workspace-activation-shared-fetch';
import {
  beginCoordinationRequestCount,
  flushCoordinationRequestCount,
  resetCoordinationRequestCountForTests,
} from '@/lib/operations/dev/coordination-request-count';

const okPayload = {
  activation: { degraded: false, primaryProjectId: 'proj-1' },
  nextAction: { id: 'add-participant' },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchSharedWorkspaceActivation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetWorkspaceActivationSharedFetchForTests();
    resetCoordinationRequestCountForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    resetWorkspaceActivationSharedFetchForTests();
    resetCoordinationRequestCountForTests();
  });

  it('dedupes concurrent callers onto one HTTP request', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(okPayload));
    global.fetch = fetchMock as typeof fetch;

    beginCoordinationRequestCount('payments');
    const [first, second, third] = await Promise.all([
      fetchSharedWorkspaceActivation(),
      fetchSharedWorkspaceActivation(),
      fetchSharedWorkspaceActivation(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/activation', { cache: 'no-store' });
    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(first).toEqual({
      status: 'ok',
      payload: {
        activation: okPayload.activation,
        nextAction: okPayload.nextAction,
        operationalOnboarding: undefined,
        operationalInitialization: undefined,
        correlationId: undefined,
      },
    });
    expect(flushCoordinationRequestCount()?.activation).toBe(1);
  });

  it('issues a new request after the in-flight call settles', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(okPayload))
      .mockResolvedValueOnce(jsonResponse(okPayload));
    global.fetch = fetchMock as typeof fetch;

    await fetchSharedWorkspaceActivation();
    await fetchSharedWorkspaceActivation();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh request after invalidate while a call is in flight', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      releaseFirst = () => resolve(jsonResponse(okPayload));
    });
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(jsonResponse({ ...okPayload, activation: { degraded: true } }));
    global.fetch = fetchMock as typeof fetch;

    const firstCall = fetchSharedWorkspaceActivation();
    invalidateWorkspaceActivationSharedFetch();
    const secondCall = fetchSharedWorkspaceActivation();
    releaseFirst?.();

    const [first, second] = await Promise.all([firstCall, secondCall]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
    if (first.status === 'ok' && second.status === 'ok') {
      expect(first.payload.activation.degraded).toBe(false);
      expect(second.payload.activation.degraded).toBe(true);
    }
  });

  it('returns fallback for 401 without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ error: 'Unauthorized' }, 401)
    ) as typeof fetch;

    await expect(fetchSharedWorkspaceActivation()).resolves.toEqual({ status: 'fallback' });
  });

  it('returns fallback when the payload is missing activation fields', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true })) as typeof fetch;

    await expect(fetchSharedWorkspaceActivation()).resolves.toEqual({ status: 'fallback' });
  });
});
